public class Addon
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public decimal MonthlyPriceAud { get; set; }
    public string? StripePriceId { get; set; }
    public string? FeatureKey { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}