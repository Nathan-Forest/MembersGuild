namespace MembersGuild.Data.Models.Platform;

public class Package
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    // Existing columns — kept for PlatformController compatibility
    public string Type { get; set; } = "tier";
    public decimal Price { get; set; }
    public string? Description { get; set; }

    // New columns added this session
    public string? DisplayName { get; set; }
    public decimal? MonthlyPriceAud { get; set; }
    public decimal? AnnualPriceAud { get; set; }
    public string? StripePriceIdMonthly { get; set; }
    public string? StripePriceIdAnnual { get; set; }

    public int MemberCap { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PackageFeature> Features { get; set; } = new List<PackageFeature>();
}