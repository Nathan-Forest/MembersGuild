namespace MembersGuild.Data.Models.Platform;

public class AuditLog
{
    public long Id { get; set; }
    public int? ClubId { get; set; }
    public string? ClubSlug { get; set; }
    public string? ActorEmail { get; set; }
    public string Action { get; set; } = string.Empty;     // "member.created", "credits.adjusted"
    public string? EntityType { get; set; }                // "user", "session", "order"
    public string? EntityId { get; set; }
    public string? Metadata { get; set; }                  // JSON string
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
