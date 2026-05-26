public class PaymentEvent
{
    public long Id { get; set; }
    public int? ClubId { get; set; }
    public string EventType { get; set; } = "";
    // setup_paid | payment_succeeded | payment_failed | subscription_cancelled
    // card_updated | grace_extended | manually_restored | portal_suspended | portal_restored
    public decimal? AmountAud { get; set; }
    public string? StripeEventId { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
}