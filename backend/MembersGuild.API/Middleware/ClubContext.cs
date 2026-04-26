namespace MembersGuild.API.Middleware;

/// <summary>
/// Holds resolved club information for the current HTTP request.
/// Populated by ClubResolutionMiddleware and injected via DI (scoped lifetime).
/// Controllers and services use this instead of re-querying the platform schema.
/// </summary>
public class ClubContext
{
    public int ClubId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string SchemaName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string PrimaryColor { get; set; } = "#1a56db";
    public string SecondaryColor { get; set; } = "#1e429f";
    public string SubscriptionStatus { get; set; } = "active";
    public bool IsDemo { get; set; } = false;
    public HashSet<string> EnabledFeatures { get; set; } = new();

    public bool HasFeature(string featureKey) => EnabledFeatures.Contains(featureKey);
}
