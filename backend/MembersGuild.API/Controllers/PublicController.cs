using MembersGuild.API.DTOs.Public;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.API.Services;
using MembersGuild.Data.Models.Club;
using MembersGuild.Data.Models.Platform;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        await using (var db = _dbFactory.CreateForCurrentClub())
        {
            catsDesc = await db.ClubSettings
                .Where(s => s.Key == "cats_description")
                .Select(s => s.Value)
                .FirstOrDefaultAsync()
                ?? "Register for a free trial membership and get 3 complimentary sessions";
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
            catsDesc
        ));

    }

    /// <summary>
    /// POST /api/public/signup
    /// No auth required. Creates a CATS trial member account.
    /// </summary>
    [HttpPost("signup")]
    public async Task<IActionResult> CatsSignup([FromBody] CatsSignupRequest request)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        // Check email uniqueness
        var exists = await db.Users.AnyAsync(u => u.Email == request.Email.ToLower());
        if (exists)
            return Conflict(new { error = "An account with this email already exists" });

        // Get configured initial credits for this club
        var creditSetting = await db.ClubSettings
            .FirstOrDefaultAsync(s => s.Key == ClubSettingKeys.CatsInitialCredits);
        var initialCredits = int.TryParse(creditSetting?.Value, out var c) ? c : 3;

        // Generate password if not provided
        var passwordProvided = !string.IsNullOrWhiteSpace(request.Password);
        var rawPassword = passwordProvided ? request.Password! : _authService.GenerateTemporaryPassword();

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

        // Store custom CATS fields if provided
        if (request.CustomFields?.Count > 0)
        {
            db.CatsProfiles.Add(new CatsProfile
            {
                UserId = user.Id,
                CustomFields = System.Text.Json.JsonSerializer.Serialize(request.CustomFields),
            });
            await db.SaveChangesAsync();
        }

        // Log initial credit grant
        db.CreditTransactions.Add(new CreditTransaction
        {
            UserId = user.Id,
            Amount = initialCredits,
            BalanceAfter = initialCredits,
            TransactionType = TransactionTypes.CatsInitial,
            Notes = "CATS initial credit grant",
        });
        await db.SaveChangesAsync();

        // TODO: Send CATS welcome email

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
}
