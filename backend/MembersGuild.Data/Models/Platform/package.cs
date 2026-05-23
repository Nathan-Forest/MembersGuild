namespace MembersGuild.Data.Models.Platform;

public class Package
{
    public int      Id          { get; set; }
    public string   Name        { get; set; } = string.Empty;
    public string   Type        { get; set; } = "tier";
    public decimal  Price       { get; set; }
    public string?  Description { get; set; }
    public bool     IsActive    { get; set; } = true;
    public int      SortOrder   { get; set; }
    public DateTime CreatedAt   { get; set; } = DateTime.UtcNow;

    public List<PackageFeature> Features { get; set; } = new();
}