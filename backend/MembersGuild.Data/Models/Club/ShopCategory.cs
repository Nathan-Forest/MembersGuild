namespace MembersGuild.Data.Models.Club;

public class ShopCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";      // "credits", "merchandise"
    public bool IsSystem { get; set; }           // credits = true, cannot be deleted
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}