namespace MembersGuild.Data.Models.Platform;

public class SupportRequest
{
    public int      Id          { get; set; }
    public string   ClubSlug    { get; set; } = string.Empty;
    public string   Category    { get; set; } = string.Empty;
    public string   Name        { get; set; } = string.Empty;
    public string   Email       { get; set; } = string.Empty;
    public string   Description { get; set; } = string.Empty;
    public string?  StartedAt   { get; set; }
    public string?  Device      { get; set; }
    public bool     GuideRead   { get; set; }
    public string   Status      { get; set; } = "open";
    public DateTime CreatedAt   { get; set; } = DateTime.UtcNow;
}