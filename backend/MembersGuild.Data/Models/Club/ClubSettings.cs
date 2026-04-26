namespace MembersGuild.Data.Models.Club;

/// <summary>
/// Flexible key-value store for club-level configuration.
/// Keys are defined in ClubSettingKeys to avoid magic strings.
/// </summary>
public class ClubSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public int? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class ClubSettingKeys
{
    public const string CatsInitialCredits  = "cats_initial_credits";    // default: "3"
    public const string CatsSessionLimit    = "cats_session_limit";      // default: "3"
    public const string LowCreditThreshold  = "low_credit_threshold";   // default: "2"
    public const string SessionDefaultCap   = "session_default_cap";    // default: "25"
    public const string CatsWelcomeEmail    = "cats_welcome_email";     // email template
}

/// <summary>
/// Configurable form field shown on the public CATS signup form.
/// Webmaster can add/remove/reorder fields per club.
/// </summary>
public class CatsFormField
{
    public int Id { get; set; }
    public string FieldKey { get; set; } = string.Empty;
    public string FieldLabel { get; set; } = string.Empty;
    public string FieldType { get; set; } = "text";    // text, boolean, select, number
    public string? FieldOptions { get; set; }           // JSON — for select type
    public bool IsRequired { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;
}

/// <summary>
/// Bank transfer payment details displayed to members when placing a shop order.
/// Singleton record (Id = 1 always).
/// </summary>
public class PaymentSettings
{
    public int Id { get; set; } = 1;
    public string? BankName { get; set; }
    public string? AccountName { get; set; }
    public string? Bsb { get; set; }
    public string? AccountNumber { get; set; }
    public string? PaymentInstructions { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Stores the custom CATS profile fields submitted during public signup.
/// Stored as JSON so it adapts to whatever the club has configured.
/// </summary>
public class CatsProfile
{
    public int UserId { get; set; }
    public string CustomFields { get; set; } = "{}";  // JSON
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
