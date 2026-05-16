namespace MembersGuild.Data.Models.Club;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? ProfilePhotoUrl { get; set; }

    /// <summary>
    /// Role codes: cats, member, coach, committee, membership, finance, webmaster
    /// </summary>
    public string Role { get; set; } = "member";

    public int CreditBalance { get; set; } = 0;
    public string? MemberNumber { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public string FullName => $"{FirstName} {LastName}";
    public DateTime? JoinedAt { get; set; }           // actual club join date, null = use CreatedAt
    public bool ConvertedFromCats { get; set; }        // auto-set when cats → any other role
    public DateTime? CatsConvertedAt { get; set; }     // when the conversion happened

    // Convenience — always returns the real join date
    public DateTime EffectiveJoinDate => JoinedAt ?? CreatedAt;
}

/// <summary>
/// Role codes as constants — avoids magic strings throughout the codebase.
/// </summary>
public static class Roles
{
    public const string Cats = "cats";
    public const string Member = "member";
    public const string Coach = "coach";
    public const string Committee = "committee";
    public const string Membership = "membership";
    public const string Finance = "finance";
    public const string Webmaster = "webmaster";

    // Nathan's platform-level super-admin (not a club role)
    public const string PlatformAdmin = "platform_admin";

    public static readonly string[] AllClubRoles =
        [Cats, Member, Coach, Committee, Membership, Finance, Webmaster];

    /// <summary>
    /// Returns true if the role can perform staff-level actions.
    /// </summary>
    public static bool IsStaff(string role) =>
        role is Coach or Committee or Membership or Finance or Webmaster;
}
