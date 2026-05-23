using MembersGuild.API.DTOs.Public;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.API.Services;
using MembersGuild.Data.Models.Club;
using MembersGuild.Data.Models.Platform;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/public")]
public class PublicController : ControllerBase
{
    private readonly ClubContext _clubContext;
    private readonly ClubDbContextFactory _dbFactory;
    private readonly IAuthService _authService;

    public PublicController(
        ClubContext clubContext,
        ClubDbContextFactory dbFactory,
        IAuthService authService)
    {
        _clubContext = clubContext;
        _dbFactory = dbFactory;
        _authService = authService;
    }

    /// <summary>
    /// GET /api/public/club-config
    /// No auth required. Used by Next.js layout.tsx server-side to inject branding.
    /// </summary>
    [HttpGet("club-config")]
    public async Task<IActionResult> GetClubConfig()
    {
        string catsDesc;
        string? icon192Url;
        string? icon512Url;

        await using (var db = _dbFactory.CreateForCurrentClub())
        {
            var settings = await db.ClubSettings
                .ToDictionaryAsync(s => s.Key, s => s.Value);

            catsDesc = settings.GetValueOrDefault("cats_description",
                "Register for a free trial membership and get 3 complimentary sessions");
            icon192Url = settings.GetValueOrDefault("pwa_icon_192_url");
            icon512Url = settings.GetValueOrDefault("pwa_icon_512_url");
        }

        return Ok(new ClubConfigResponse(
            _clubContext.Slug,
            _clubContext.DisplayName,
            _clubContext.LogoUrl,
            _clubContext.PrimaryColor,
            _clubContext.SecondaryColor,
            new ClubFeaturesDto(
                Calendar: _clubContext.HasFeature(FeatureKeys.Calendar),
                MySessions: _clubContext.HasFeature(FeatureKeys.MySessions),
                Attendance: _clubContext.HasFeature(FeatureKeys.Attendance),
                Training: _clubContext.HasFeature(FeatureKeys.Training),
                Shop: _clubContext.HasFeature(FeatureKeys.Shop),
                MyAccount: _clubContext.HasFeature(FeatureKeys.MyAccount)
            ),
            catsDesc,
            icon192Url,
            icon512Url
        ));
    }

    /// <summary>
    /// POST /api/public/signup
    /// No auth required. Creates a CATS trial member account.
    /// </summary>
    [HttpPost("signup")]
    public async Task<IActionResult> CatsSignup(
    [FromBody] CatsSignupRequest request,
    [FromServices] EmailService emailService)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var exists = await db.Users.AnyAsync(u => u.Email == request.Email.ToLower());
        if (exists)
            return Conflict(new { error = "An account with this email already exists" });

        var settings = await db.ClubSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value);

        settings.TryGetValue(ClubSettingKeys.CatsInitialCredits, out var creditsStr);
        var initialCredits = int.TryParse(creditsStr, out var c) ? c : 3;

        var passwordProvided = !string.IsNullOrWhiteSpace(request.Password);
        var rawPassword = passwordProvided
            ? request.Password!
            : _authService.GenerateTemporaryPassword();

        var user = new User
        {
            Email = request.Email.ToLower(),
            PasswordHash = _authService.HashPassword(rawPassword),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone?.Trim(),
            DateOfBirth = request.DateOfBirth,
            EmergencyContactName = request.EmergencyContactName?.Trim(),
            EmergencyContactPhone = request.EmergencyContactPhone?.Trim(),
            Role = Roles.Cats,
            CreditBalance = initialCredits,
            IsActive = true,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        db.CreditTransactions.Add(new CreditTransaction
        {
            UserId = user.Id,
            Amount = initialCredits,
            BalanceAfter = initialCredits,
            TransactionType = TransactionTypes.CatsInitial,
            Notes = "CATS initial credit grant",
        });
        await db.SaveChangesAsync();

        // Build answer list — join custom field answers with their question labels
        var answers = new List<(string Label, string Answer)>();
        if (request.CustomFields?.Count > 0)
        {
            var fieldDefs = await db.CatsFormFields
                .Where(f => f.IsActive && request.CustomFields.Keys.Contains(f.FieldKey))
                .OrderBy(f => f.DisplayOrder)
                .ToListAsync();

            answers = fieldDefs
                .Where(f => request.CustomFields.ContainsKey(f.FieldKey)
                         && !string.IsNullOrWhiteSpace(request.CustomFields[f.FieldKey]))
                .Select(f =>
    {
        var raw = request.CustomFields[f.FieldKey];
        var display = f.FieldType == "checkbox"
            ? (raw == "true" ? "Yes" : "No")
            : raw;
        return (f.FieldLabel, display);
    })
                .ToList();
        }

        // Fire notification email to membership officer / club captain
        settings.TryGetValue("cats_notification_email", out var notificationEmailRaw);
        if (!string.IsNullOrWhiteSpace(notificationEmailRaw))
        {
            var recipients = notificationEmailRaw
                .Split(',')
                .Select(e => e.Trim())
                .Where(e => !string.IsNullOrEmpty(e))
                .ToList();

            _ = Task.Run(async () =>
            {
                try
                {
                    await emailService.SendCatsNotificationAsync(
                        recipients,
                        _clubContext.DisplayName,
                        _clubContext.Slug,
                        user.FirstName,
                        user.LastName,
                        user.Email,
                        user.Phone,
                        initialCredits,
                        answers);
                }
                catch { /* log in future — don't fail signup */ }
            });
        }

        // Fire welcome email to the new member
        settings.TryGetValue("welcome_email_subject", out var welcomeSubject);
        settings.TryGetValue("welcome_email_body", out var welcomeBody);
        if (!string.IsNullOrWhiteSpace(welcomeSubject) && !string.IsNullOrWhiteSpace(welcomeBody))
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await emailService.SendWelcomeEmailAsync(
                        user.Email,
                        user.FirstName,
                        _clubContext.DisplayName,
                        _clubContext.Slug,
                        welcomeSubject,
                        welcomeBody);
                }
                catch { /* log in future — don't fail signup */ }
            });
        }

        return Created($"/api/members/{user.Id}", new CatsSignupResponse(
            user.Id,
            user.Email,
            user.FirstName,
            passwordProvided ? string.Empty : rawPassword,
            initialCredits,
            $"Welcome to {_clubContext.DisplayName}! You have {initialCredits} sessions to use."
        ));
    }

    /// <summary>
    /// GET /api/public/cats-form-fields
    /// Returns the active CATS form fields configured by the club Webmaster.
    /// Used by the public signup form to render dynamic fields.
    /// </summary>
    [HttpGet("cats-form-fields")]
    public async Task<IActionResult> GetCatsFormFields()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var fields = await db.CatsFormFields
            .Where(f => f.IsActive)
            .OrderBy(f => f.DisplayOrder)
            .Select(f => new
            {
                f.FieldKey,
                f.FieldLabel,
                f.FieldType,
                f.FieldOptions,
                f.IsRequired,
            })
            .ToListAsync();

        return Ok(fields);
    }

    // POST /api/public/forgot-password
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest req,
        [FromServices] EmailService emailService)
    {
        // Always return success — never reveal whether email exists
        if (string.IsNullOrWhiteSpace(req.Email))
            return Ok(new { success = true });

        await using var db = _dbFactory.CreateForCurrentClub();

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower().Trim() && u.IsActive);

        if (user is null) return Ok(new { success = true });

        // Invalidate any existing unused tokens
        var existing = await db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync();
        db.PasswordResetTokens.RemoveRange(existing);

        // Generate URL-safe token
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
            .Replace("+", "-").Replace("/", "_").Replace("=", "");

        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        });
        await db.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            try
            {
                await emailService.SendPasswordResetAsync(
                    user.Email, user.FirstName,
                    _clubContext.DisplayName, _clubContext.Slug, token);
            }
            catch { }
        });

        return Ok(new { success = true });
    }

    // POST /api/public/reset-password
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Token and password are required" });

        if (req.Password.Length < 8)
            return BadRequest(new { error = "Password must be at least 8 characters" });

        await using var db = _dbFactory.CreateForCurrentClub();

        var resetToken = await db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.Token);

        if (resetToken is null || resetToken.UsedAt is not null)
            return BadRequest(new { error = "This reset link is invalid or has already been used" });

        if (resetToken.ExpiresAt < DateTime.UtcNow)
            return BadRequest(new { error = "This link has expired. Please request a new one." });

        resetToken.User!.PasswordHash = _authService.HashPassword(req.Password);
        resetToken.UsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { success = true });
    }

}
