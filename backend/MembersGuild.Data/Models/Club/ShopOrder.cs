namespace MembersGuild.Data.Models.Club;

public class ShopOrder
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string PaymentReference { get; set; } = "";      // BSM-WADE-1234
    public string Status { get; set; } = "pending";
    public decimal TotalAmount { get; set; }
    public int TotalCredits { get; set; }
    public string PaymentMethod { get; set; } = "bank_transfer";
    public string? PaymentReceiptNumber { get; set; }
    public DateTime? PaymentConfirmedAt { get; set; }
    public int? PaymentConfirmedBy { get; set; }
    public string? FulfillmentNotes { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public int? DeliveredBy { get; set; }
    public DateTime? CancelledAt { get; set; }
    public int? CancelledBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
    public User? ConfirmedByUser { get; set; }
    public User? DeliveredByUser { get; set; }
    public User? CancelledByUser { get; set; }
    public List<ShopOrderItem> Items { get; set; } = [];
}