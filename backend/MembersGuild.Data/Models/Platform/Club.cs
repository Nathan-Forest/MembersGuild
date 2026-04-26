namespace MembersGuild.Data.Models.Platform;

public class Club
{
    public int Id { get; set; }
    public string Slug { get; set; } = string.Empty;          // "bsm", "forestden"
    public string Name { get; set; } = string.Empty;          // "Brisbane Southside Masters Swimming"
    public string DisplayName { get; set; } = string.Empty;   // "BSM Swimming"
    public string? LogoUrl { get; set; }
    public string PrimaryColor { get; set; } = "#1a56db";
    public string SecondaryColor { get; set; } = "#1e429f";
    public string SubscriptionTier { get; set; } = "standard"; // standard, premium
    public string SubscriptionStatus { get; set; } = "active"; // active, suspended, cancelled
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public int MemberCap { get; set; } = 50;
    public string SchemaName { get; set; } = string.Empty;    // "club_bsm"
    public bool IsDemo { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ClubFeature> Features { get; set; } = new List<ClubFeature>();
}
