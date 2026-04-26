namespace MembersGuild.Data.Models.Club;

public class ShopItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "merchandise"; // "credits", "merchandise"
    public string? ImageUrl { get; set; }
    public decimal? BasePrice { get; set; }   // AUD — null for credit-only items
    public int? CreditValue { get; set; }     // credits granted when purchased
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ShopItemVariant> Variants { get; set; } = new List<ShopItemVariant>();
}

public class ShopItemVariant
{
    public int Id { get; set; }
    public int ShopItemId { get; set; }
    public string Name { get; set; } = string.Empty;  // "Large", "Blue / White"
    public int StockQuantity { get; set; } = 0;
    public decimal AdditionalPrice { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public ShopItem? ShopItem { get; set; }
}

public class ShopOrder
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Status { get; set; } = OrderStatus.Pending;
    public decimal? TotalAmount { get; set; }
    public int TotalCredits { get; set; } = 0;
    public string PaymentMethod { get; set; } = "bank_transfer";
    public string? PaymentReference { get; set; }       // provided by member (BSB etc.)
    public string? PaymentReceiptNumber { get; set; }   // logged by finance on confirmation
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
    public ICollection<ShopOrderItem> Items { get; set; } = new List<ShopOrderItem>();
}

public class ShopOrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ShopItemId { get; set; }
    public int? VariantId { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal? UnitPrice { get; set; }
    public int CreditValue { get; set; } = 0;
    public string? ItemNameSnapshot { get; set; }  // name at time of purchase

    public ShopOrder? Order { get; set; }
}

public static class OrderStatus
{
    public const string Pending           = "pending";
    public const string PaymentConfirmed  = "payment_confirmed";
    public const string PendingDelivery   = "pending_delivery";
    public const string Delivered         = "delivered";
    public const string Cancelled         = "cancelled";
}
