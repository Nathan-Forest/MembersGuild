public class ClubDiscount
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public int DiscountCodeId { get; set; }
    public DiscountCode DiscountCode { get; set; } = null!;
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    public int? AppliedBy { get; set; }
    public int AppliesToMonthFrom { get; set; } = 2;
}