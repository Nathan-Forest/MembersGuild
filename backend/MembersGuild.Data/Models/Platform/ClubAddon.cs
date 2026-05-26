public class ClubAddon
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public int AddonId { get; set; }
    public Addon Addon { get; set; } = null!;
    public string? StripeSubItemId { get; set; }
    public DateTime ActivatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeactivatedAt { get; set; }
    public bool IsActive { get; set; } = true;
}