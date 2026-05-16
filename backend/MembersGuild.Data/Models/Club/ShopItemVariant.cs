namespace MembersGuild.Data.Models.Club;

public class ShopItemVariant
{
    public int Id { get; set; }
    public int ShopItemId { get; set; }
    public string Name { get; set; } = "";          // "Large", "Blue/White"
    public int StockQuantity { get; set; }
    public decimal AdditionalPrice { get; set; }
    public bool IsActive { get; set; } = true;

    public ShopItem? ShopItem { get; set; }
}