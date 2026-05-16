namespace MembersGuild.Data.Models.Club;

public class ShopOrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ShopItemId { get; set; }
    public int? VariantId { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public int CreditValue { get; set; }
    public string ItemNameSnapshot { get; set; } = "";      // name at time of purchase
    public string? VariantNameSnapshot { get; set; }

    public ShopOrder? Order { get; set; }
    public ShopItem? ShopItem { get; set; }
    public ShopItemVariant? Variant { get; set; }
}