using System.ComponentModel.DataAnnotations;

namespace MembersGuild.API.DTOs.Public;

/// <summary>
/// Returned by /api/public/club-config — no auth required.
/// Used by Next.js layout to inject branding CSS variables server-side.
/// </summary>
public record ClubConfigResponse(
    string Slug,
    string DisplayName,
    string? LogoUrl,
    string PrimaryColor,
    string SecondaryColor,
    ClubFeaturesDto Features,
    string CatsDescription

);

public record ClubFeaturesDto(
    bool Calendar,
    bool MySessions,
    bool Attendance,
    bool Training,
    bool Shop,
    bool MyAccount
);

/// <summary>
/// Public CATS signup — creates a trial member account.
/// Fixed fields are always present. Custom fields go in CustomFields dict.
/// </summary>
public record CatsSignupRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required, EmailAddress, MaxLength(200)] string Email,
    [Required, MaxLength(20)] string Phone,
    string? Password,                          // auto-generated if not provided
    DateOnly? DateOfBirth,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    Dictionary<string, string>? CustomFields   // sport-specific fields
);

public record CatsSignupResponse(
    int UserId,
    string Email,
    string FirstName,
    string GeneratedPassword,   // returned ONCE — member must change on first login
    int InitialCredits,
    string Message
);
