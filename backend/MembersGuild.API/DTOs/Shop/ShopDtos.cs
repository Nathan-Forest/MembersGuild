namespace MembersGuild.API.DTOs.Shop;
 
// ── Order Status Constants ────────────────────────────────────────────────────
 
public static class OrderStatus
{
    public const string Pending          = "pending";
    public const string PaymentConfirmed = "payment_confirmed";
    public const string PendingDelivery  = "pending_delivery";
    public const string Delivered        = "delivered";
    public const string Cancelled        = "cancelled";
}
 
// ── Responses ─────────────────────────────────────────────────────────────────
 
public record ShopCategoryResponse(
    int Id, string Name, string Slug,
    bool IsSystem, int DisplayOrder, bool IsActive);
 
public record ShopItemVariantResponse(
    int Id, string Name,
    int StockQuantity, decimal AdditionalPrice, bool IsActive);
 
public record ShopItemResponse(
    int Id, string Name, string? Description,
    string Category, string CategoryName,
    string? ImageUrl, decimal BasePrice, int? CreditValue,
    bool IsSystem, bool IsActive, int DisplayOrder,
    List<ShopItemVariantResponse> Variants);
 
public record ShopOrderItemResponse(
    int Id, int ShopItemId, string ItemName, string? CategorySlug,
    int? VariantId, string? VariantName,
    int Quantity, decimal UnitPrice, int CreditValue, decimal LineTotal);
 
public record ShopOrderResponse(
    int Id, string PaymentReference, string Status,
    decimal TotalAmount, int TotalCredits, string PaymentMethod,
    string? PaymentReceiptNumber, DateTime? PaymentConfirmedAt,
    string? ConfirmedByName, string? FulfillmentNotes,
    DateTime? DeliveredAt, DateTime? CancelledAt,
    List<ShopOrderItemResponse> Items,
    int MemberId, string MemberName, string MemberEmail,
    DateTime CreatedAt, DateTime UpdatedAt);
 
public record ShopOrderSummaryResponse(
    int Id, string PaymentReference, string MemberName, string MemberEmail,
    string Status, decimal TotalAmount, int TotalCredits,
    DateTime CreatedAt, DateTime? PaymentConfirmedAt);
 
public record InventoryItemResponse(
    int VariantId, string VariantName,
    int ItemId, string ItemName, string Category,
    int StockQuantity, bool IsLowStock, bool IsOutOfStock, bool IsActive);
 
// ── Requests ──────────────────────────────────────────────────────────────────
 
public record CreateCategoryRequest(string Name, string Slug, int DisplayOrder);
public record UpdateCategoryRequest(string Name, int DisplayOrder, bool IsActive);
 
public record CreateItemRequest(
    string Name, string? Description, string Category,
    decimal BasePrice, int? CreditValue, int DisplayOrder);
 
public record UpdateItemRequest(
    string Name, string? Description, string Category,
    decimal BasePrice, int? CreditValue, bool IsActive, int DisplayOrder);
 
public record CreateVariantRequest(string Name, int StockQuantity, decimal AdditionalPrice);
public record UpdateVariantRequest(string Name, int StockQuantity, decimal AdditionalPrice, bool IsActive);
 
public record CreateOrderItemRequest(int ItemId, int? VariantId, int Quantity);
public record CreateOrderRequest(List<CreateOrderItemRequest> Items);
 
public record ConfirmPaymentRequest(string ReceiptNumber, string? Notes);
public record DeliverOrderRequest(string? Notes);
public record UpdateStockRequest(int Quantity);
public record CreditPriceRequest(decimal PricePerCredit);