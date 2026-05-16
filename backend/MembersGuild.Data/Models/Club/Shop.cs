namespace MembersGuild.API.Models;
 
// ── Entities ─────────────────────────────────────────────────────────────────
 
public class ShopCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public bool IsSystem { get; set; }          // credits = true, cannot be deleted
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public List<ShopItem> Items { get; set; } = [];
}
 
public class ShopItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int CategoryId { get; set; }
    public ShopCategory? Category { get; set; }
    public string? ImageUrl { get; set; }
    public decimal BasePrice { get; set; }      // AUD, always set
    public int? CreditValue { get; set; }       // only for credit category items
    public bool IsSystem { get; set; }          // standard 1/5/10 packs — price editable, undeletable
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public List<ShopItemVariant> Variants { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
 
public class ShopItemVariant
{
    public int Id { get; set; }
    public int ShopItemId { get; set; }
    public ShopItem? ShopItem { get; set; }
    public string Name { get; set; } = "";      // "Large", "Blue/White"
    public int StockQuantity { get; set; }
    public decimal AdditionalPrice { get; set; }
    public bool IsActive { get; set; } = true;
}
 
public class ShopOrder
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string PaymentReference { get; set; } = "";   // BSM-WADE-1234
    public string Status { get; set; } = OrderStatus.Pending;
    public decimal TotalAmount { get; set; }
    public int TotalCredits { get; set; }
    public string PaymentMethod { get; set; } = "bank_transfer";
    public string? PaymentReceiptNumber { get; set; }
    public DateTime? PaymentConfirmedAt { get; set; }
    public int? PaymentConfirmedBy { get; set; }
    public User? ConfirmedByUser { get; set; }
    public string? FulfillmentNotes { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public int? DeliveredBy { get; set; }
    public User? DeliveredByUser { get; set; }
    public DateTime? CancelledAt { get; set; }
    public int? CancelledBy { get; set; }
    public User? CancelledByUser { get; set; }
    public List<ShopOrderItem> Items { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
 
public class ShopOrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public ShopOrder? Order { get; set; }
    public int ShopItemId { get; set; }
    public ShopItem? ShopItem { get; set; }
    public int? VariantId { get; set; }
    public ShopItemVariant? Variant { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public int CreditValue { get; set; }
    public string ItemNameSnapshot { get; set; } = "";   // name at purchase time
    public string? VariantNameSnapshot { get; set; }
}
 
// ── Order Status Constants ────────────────────────────────────────────────────
 
public static class OrderStatus
{
    public const string Pending = "pending";
    public const string PaymentConfirmed = "payment_confirmed";
    public const string PendingDelivery = "pending_delivery";
    public const string Delivered = "delivered";
    public const string Cancelled = "cancelled";
}
 
// ── DTOs / Responses ─────────────────────────────────────────────────────────
 
public record ShopCategoryResponse(
    int Id,
    string Name,
    string Slug,
    bool IsSystem,
    int DisplayOrder,
    bool IsActive);
 
public record ShopItemVariantResponse(
    int Id,
    string Name,
    int StockQuantity,
    decimal AdditionalPrice,
    bool IsActive);
 
public record ShopItemResponse(
    int Id,
    string Name,
    string? Description,
    int CategoryId,
    string CategoryName,
    string CategorySlug,
    string? ImageUrl,
    decimal BasePrice,
    int? CreditValue,
    bool IsSystem,
    bool IsActive,
    int DisplayOrder,
    List<ShopItemVariantResponse> Variants);
 
public record ShopOrderItemResponse(
    int Id,
    int ShopItemId,
    string ItemName,
    string? CategorySlug,
    int? VariantId,
    string? VariantName,
    int Quantity,
    decimal UnitPrice,
    int CreditValue,
    decimal LineTotal);
 
public record ShopOrderResponse(
    int Id,
    string PaymentReference,
    string Status,
    decimal TotalAmount,
    int TotalCredits,
    string PaymentMethod,
    string? PaymentReceiptNumber,
    DateTime? PaymentConfirmedAt,
    string? ConfirmedByName,
    string? FulfillmentNotes,
    DateTime? DeliveredAt,
    DateTime? CancelledAt,
    List<ShopOrderItemResponse> Items,
    // Member info (for management view)
    int MemberId,
    string MemberName,
    string MemberEmail,
    DateTime CreatedAt,
    DateTime UpdatedAt);
 
public record ShopOrderSummaryResponse(
    int Id,
    string PaymentReference,
    string MemberName,
    string MemberEmail,
    string Status,
    decimal TotalAmount,
    int TotalCredits,
    DateTime CreatedAt,
    DateTime? PaymentConfirmedAt);
 
// ── Request DTOs ──────────────────────────────────────────────────────────────
 
public record CreateCategoryRequest(string Name, string Slug, int DisplayOrder);
public record UpdateCategoryRequest(string Name, int DisplayOrder, bool IsActive);
 
public record CreateItemRequest(
    string Name,
    string? Description,
    int CategoryId,
    decimal BasePrice,
    int? CreditValue,
    int DisplayOrder);
 
public record UpdateItemRequest(
    string Name,
    string? Description,
    int CategoryId,
    decimal BasePrice,
    int? CreditValue,
    bool IsActive,
    int DisplayOrder);
 
public record CreateVariantRequest(string Name, int StockQuantity, decimal AdditionalPrice);
public record UpdateVariantRequest(string Name, int StockQuantity, decimal AdditionalPrice, bool IsActive);
 
public record CreateOrderItemRequest(int ItemId, int? VariantId, int Quantity);
public record CreateOrderRequest(List<CreateOrderItemRequest> Items);
 
public record ConfirmPaymentRequest(string ReceiptNumber, string? Notes);
public record DeliverOrderRequest(string? Notes);
public record UpdateStockRequest(int Quantity);
 
public record CreditPriceRequest(decimal PricePerCredit);