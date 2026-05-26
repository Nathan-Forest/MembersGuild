public class DiscountCode
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string? Description { get; set; }
    public string DiscountType { get; set; } = "percent"; // percent | fixed
    public decimal DiscountValue { get; set; }
    public int? MaxUses { get; set; }
    public int UsesCount { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public string? StripeCouponId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}