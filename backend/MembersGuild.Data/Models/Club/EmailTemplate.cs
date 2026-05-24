namespace MembersGuild.Data.Models.Club;
public class EmailTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}