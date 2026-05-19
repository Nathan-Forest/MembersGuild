using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Services;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.Data.Contexts;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly SettingsService _settings;
    private readonly ClubDbContextFactory _dbFactory;
    private readonly PlatformDbContext _platformDb;
    private readonly ClubContext _clubContext;

    public SettingsController(
        SettingsService settings,
        ClubDbContextFactory dbFactory,
        PlatformDbContext platformDb,
        ClubContext clubContext)
    {
        _settings = settings;
        _dbFactory = dbFactory;
        _platformDb = platformDb;
        _clubContext = clubContext;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

    // ── GET /api/settings/payment ────────────────────────────────────────────
    [HttpGet("payment")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaymentSettings()
    {
        var result = await _settings.GetPaymentSettingsAsync();
        if (result is null) return Ok(new { });
        return Ok(new
        {
            bankName = result.BankName,
            accountName = result.AccountName,
            bsb = result.Bsb,
            accountNumber = result.AccountNumber,
            paymentInstructions = result.PaymentInstructions,
        });
    }

    // ── PUT /api/settings/payment ────────────────────────────────────────────
    [HttpPut("payment")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> SavePaymentSettings([FromBody] PaymentSettingsRequest req)
    {
        await _settings.SavePaymentSettingsAsync(req, CurrentUserId);
        return Ok(new { success = true });
    }

    // ── GET /api/settings/labels ─────────────────────────────────────────────
    [HttpGet("labels")]
    public async Task<IActionResult> GetLabels()
    {
        var label = await _settings.GetAssociationNumberLabelAsync();
        return Ok(new { associationNumberLabel = label });
    }

    // ── GET /api/settings/club ───────────────────────────────────────────────
    [HttpGet("club")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> GetClubSettings()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        // Load all club settings in one hit
        var s = await db.ClubSettings.ToDictionaryAsync(x => x.Key, x => x.Value);
        string Get(string key, string def) => s.GetValueOrDefault(key, def);

        return Ok(new ClubSettingsResponse(
            DisplayName: _clubContext.DisplayName,
            LogoUrl: _clubContext.LogoUrl,
            PrimaryColor: _clubContext.PrimaryColor,
            SecondaryColor: _clubContext.SecondaryColor,
            AssociationNumberLabel: Get("association_number_label", "Association Number"),
            CatsInitialCredits: int.TryParse(Get("cats_initial_credits", "3"), out var c) ? c : 3,
            CatsDescription: Get("cats_description", "Register for a free trial membership and get 3 complimentary sessions"),
            AttendanceLanesLabel: Get("attendance_lanes_label", "Lanes"),
            AttendanceLanesEnabled: Get("attendance_lanes_enabled", "true") == "true",
            ClubTimezone: Get("club_timezone", "Australia/Brisbane"),
            CreditPriceAud: Get("credit_price_aud", "5.00"),
            WelcomeEmailSubject: Get("welcome_email_subject", "Welcome to {{clubName}}!"),
            WelcomeEmailBody: Get("welcome_email_body", "Hi {{firstName}}, welcome!")
        ));
    }

    // ── PUT /api/settings/club ───────────────────────────────────────────────
    [HttpPut("club")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateClubSettings([FromBody] UpdateClubSettingsRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        // Upsert all club_settings keys
        var updates = new Dictionary<string, string>
        {
            ["association_number_label"] = req.AssociationNumberLabel,
            ["cats_initial_credits"] = req.CatsInitialCredits.ToString(),
            ["cats_description"] = req.CatsDescription,
            ["attendance_lanes_label"] = req.AttendanceLanesLabel,
            ["attendance_lanes_enabled"] = req.AttendanceLanesEnabled.ToString().ToLower(),
            ["club_timezone"] = req.ClubTimezone,
            ["credit_price_aud"] = req.CreditPriceAud,
            ["welcome_email_subject"] = req.WelcomeEmailSubject,
            ["welcome_email_body"] = req.WelcomeEmailBody,
        };

        foreach (var (key, value) in updates)
        {
            var row = await db.ClubSettings.FirstOrDefaultAsync(s => s.Key == key);
            if (row is null)
            {
                db.ClubSettings.Add(new MembersGuild.Data.Models.Club.ClubSetting
                {
                    Key = key,
                    Value = value,
                    UpdatedBy = CurrentUserId,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                row.Value = value;
                row.UpdatedBy = CurrentUserId;
                row.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        if (decimal.TryParse(req.CreditPriceAud, out var pricePerCredit) && pricePerCredit > 0)
        {
            var systemItems = await db.ShopItems
                .Where(i => i.IsSystem && i.CreditValue.HasValue)
                .ToListAsync();

            foreach (var item in systemItems)
            {
                item.BasePrice = item.CreditValue!.Value * pricePerCredit;
            }
            await db.SaveChangesAsync();
        }

        // Update branding in platform.clubs
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club is not null)
        {
            club.DisplayName = req.DisplayName.Trim();
            club.PrimaryColor = req.PrimaryColor;
            club.SecondaryColor = req.SecondaryColor;
            club.UpdatedAt = DateTime.UtcNow;
            await _platformDb.SaveChangesAsync();
        }

        return Ok(new { success = true });
    }

    // ── POST /api/settings/logo ──────────────────────────────────────────────
    public record LogoUploadRequest(string FileName, string ContentType, string Data);

    [HttpPost("logo")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UploadLogo([FromBody] LogoUploadRequest req)
    {
        var allowedTypes = new[] { "image/png", "image/jpeg", "image/svg+xml", "image/webp" };
        if (!allowedTypes.Contains(req.ContentType))
            return BadRequest(new { error = "Unsupported file type" });

        var ext = req.ContentType switch
        {
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            "image/svg+xml" => ".svg",
            "image/webp" => ".webp",
            _ => ".png"
        };

        var slug = _clubContext.Slug;
        var uploadDir = Path.Combine("/uploads", slug);
        Directory.CreateDirectory(uploadDir);

        var bytes = Convert.FromBase64String(req.Data);
        var path = Path.Combine(uploadDir, $"logo{ext}");
        await System.IO.File.WriteAllBytesAsync(path, bytes);

        var logoUrl = $"/api/files/{slug}/logo{ext}";

        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is not null)
        {
            club.LogoUrl = logoUrl;
            club.UpdatedAt = DateTime.UtcNow;
            await _platformDb.SaveChangesAsync();
        }

        return Ok(new { logoUrl });
    }
}