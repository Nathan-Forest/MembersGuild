namespace MembersGuild.Data.Models.Platform;

public class ClubFeature
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string FeatureKey { get; set; } = string.Empty;  // "calendar", "shop", "training", etc.
    public bool IsEnabled { get; set; } = false;
    public string EnabledBy { get; set; } = "platform";    // "platform" or "club"

    public Club? Club { get; set; }
}

/// <summary>
/// Known feature keys — avoids magic strings throughout the codebase.
/// </summary>
public static class FeatureKeys
{
    public const string Calendar   = "calendar";
    public const string MySessions = "my_sessions";
    public const string Attendance = "attendance";
    public const string Training   = "training";
    public const string Shop       = "shop";
    public const string MyAccount  = "my_account";
}
