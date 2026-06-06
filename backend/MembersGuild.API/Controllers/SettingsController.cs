using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Services;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.Data.Contexts;
using Microsoft.EntityFrameworkCore;
using MembersGuild.Data.Models.Platform;
using MembersGuild.Data.Models.Club;

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
    private readonly IWebHostEnvironment _env;

    public SettingsController(
        SettingsService settings,
        ClubDbContextFactory dbFactory,
        PlatformDbContext platformDb,
        ClubContext clubContext,
        IWebHostEnvironment env)
    {
        _settings = settings;
        _dbFactory = dbFactory;
        _platformDb = platformDb;
        _clubContext = clubContext;
        _env = env;
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
            WelcomeEmailBody: Get("welcome_email_body", "Hi {{firstName}}, welcome!"),
            CatsNotificationEmail: Get("cats_notification_email", ""),
            TrainingMetricsEnabled: Get("training_metrics_enabled", "true") == "true",
            TrainingSetsEnabled: Get("training_sets_enabled", "true") == "true",
            TrainingVideosEnabled: Get("training_videos_enabled", "true") == "true"
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
            ["cats_notification_email"] = req.CatsNotificationEmail,
            ["training_metrics_enabled"] = req.TrainingMetricsEnabled.ToString().ToLower(),
            ["training_sets_enabled"] = req.TrainingSetsEnabled.ToString().ToLower(),
            ["training_videos_enabled"] = req.TrainingVideosEnabled.ToString().ToLower(),
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
    public async Task<IActionResult> UploadLogo(
    [FromBody] LogoUploadRequest req,
    [FromServices] StorageService storage)
    {
        byte[] imageBytes;
        try { imageBytes = Convert.FromBase64String(req.Data); }
        catch { return BadRequest(new { error = "Invalid image data" }); }

        var (logoUrl, icon192Url, icon512Url) = await storage.UploadLogoWithIconsAsync(
            imageBytes, _clubContext.Slug);

        // Update logo URL on platform.clubs
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);
        if (club != null)
        {
            club.LogoUrl = logoUrl;
            club.UpdatedAt = DateTime.UtcNow;
            await _platformDb.SaveChangesAsync();
        }

        // Save icon URLs to club_settings for manifest
        await using var db = _dbFactory.CreateForCurrentClub();
        await UpsertSettingAsync(db, "pwa_icon_192_url", icon192Url);
        await UpsertSettingAsync(db, "pwa_icon_512_url", icon512Url);

        return Ok(new { logoUrl });
    }

    private async Task UpsertSettingAsync(ClubDbContext db, string key, string value)
    {
        var setting = await db.ClubSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (setting is not null)
            setting.Value = value;
        else
            db.ClubSettings.Add(new ClubSetting { Key = key, Value = value });
        await db.SaveChangesAsync();
    }

    private static readonly Dictionary<string, string> FeatureLabels = new()
    {
        ["calendar"] = "Session Calendar & Booking",
        ["my_sessions"] = "My Sessions",
        ["attendance"] = "Attendance Tracking",
        ["training"] = "Training & Personal Bests",
        ["shop"] = "Swim Shop",
        ["my_account"] = "Credits & My Account",
        ["news"] = "Club News & Updates",
    };

    // GET /api/settings/features
    [HttpGet("features")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> GetFeatures()
    {
        var club = await _platformDb.Clubs
            .Include(c => c.Features)
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club is null) return NotFound();

        // Derive granted features from active packages
        var grantedKeys = await _platformDb.ClubPackages
            .Include(cp => cp.Package)
                .ThenInclude(p => p!.Features)
            .Where(cp => cp.ClubId == club.Id
                      && cp.EndDate == null
                      && cp.Package != null)
            .SelectMany(cp => cp.Package!.Features.Select(f => f.FeatureKey))
            .Distinct()
            .ToListAsync();

        var result = FeatureLabels.Keys.Select(key =>
        {
            var feature = club.Features.FirstOrDefault(f => f.FeatureKey == key);
            var platformGranted = grantedKeys.Contains(key);
            return new
            {
                key,
                label = FeatureLabels[key],
                platformGranted,
                isEnabled = platformGranted && (feature?.IsEnabled ?? true),
            };
        });

        return Ok(result);
    }

    // PUT /api/settings/features/{key}
    [HttpPut("features/{key}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateFeature(string key, [FromBody] bool enabled)
    {
        if (!FeatureLabels.ContainsKey(key))
            return BadRequest(new { error = "Unknown feature key" });

        var club = await _platformDb.Clubs
            .Include(c => c.Features)
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club is null) return NotFound();

        var feature = club.Features.FirstOrDefault(f => f.FeatureKey == key);

        // Webmaster cannot enable features the platform hasn't granted
        if (enabled && (feature is null || !feature.PlatformGranted))
            return Forbid();

        if (feature is null)
        {
            _platformDb.ClubFeatures.Add(new ClubFeature
            {
                ClubId = club.Id,
                FeatureKey = key,
                IsEnabled = enabled,
                EnabledBy = "club",
                PlatformGranted = false,
            });
        }
        else
        {
            feature.IsEnabled = enabled;
            feature.EnabledBy = "club";
        }

        await _platformDb.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // GET /api/settings/cats-fields
    [HttpGet("cats-fields")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> GetCatsFields()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var fields = await db.CatsFormFields
            .Where(f => f.IsActive)
            .OrderBy(f => f.DisplayOrder)
            .Select(f => new { f.Id, f.FieldKey, f.FieldLabel, f.FieldType, f.FieldOptions, f.IsRequired, f.DisplayOrder })
            .ToListAsync();
        return Ok(fields);
    }

    // POST /api/settings/cats-fields
    [HttpPost("cats-fields")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> AddCatsField([FromBody] CatsFieldRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var maxOrder = await db.CatsFormFields
            .Where(f => f.IsActive)
            .MaxAsync(f => (int?)f.DisplayOrder) ?? 0;

        var field = new CatsFormField
        {
            FieldKey = Guid.NewGuid().ToString("N")[..8], // short unique key
            FieldLabel = req.FieldLabel.Trim(),
            FieldType = req.FieldType,
            FieldOptions = req.FieldOptions?.Trim(),
            IsRequired = req.IsRequired,
            DisplayOrder = maxOrder + 1,
            IsActive = true,
        };

        db.CatsFormFields.Add(field);
        await db.SaveChangesAsync();
        return Ok(new { field.Id, field.FieldKey, field.FieldLabel, field.FieldType, field.FieldOptions, field.IsRequired });
    }

    // DELETE /api/settings/cats-fields/{id}
    [HttpDelete("cats-fields/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteCatsField(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var field = await db.CatsFormFields.FindAsync(id);
        if (field is null) return NotFound();
        field.IsActive = false;
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }
    // GET /api/settings/report-recipients
    [HttpGet("report-recipients")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> GetReportRecipients()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var setting = await db.ClubSettings.FirstOrDefaultAsync(s => s.Key == "attendance_report_recipients");
        var json = setting?.Value ?? "[]";
        return Ok(json);
    }

    // PUT /api/settings/report-recipients
    [HttpPut("report-recipients")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateReportRecipients([FromBody] List<ReportRecipientDto> recipients)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var json = System.Text.Json.JsonSerializer.Serialize(recipients);
        await UpsertSettingAsync(db, "attendance_report_recipients", json);
        return Ok(new { success = true });
    }

}