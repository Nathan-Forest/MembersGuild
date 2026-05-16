namespace MembersGuild.Data.Models.Club;

public class ShopItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string Category { get; set; } = "merchandise";   // slug e.g. "credits", "merchandise"
    public string? ImageUrl { get; set; }
    public decimal BasePrice { get; set; }
    public int? CreditValue { get; set; }                   // credits granted on purchase
    public bool IsSystem { get; set; }                      // standard packs — undeletable
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<ShopItemVariant> Variants { get; set; } = [];
}