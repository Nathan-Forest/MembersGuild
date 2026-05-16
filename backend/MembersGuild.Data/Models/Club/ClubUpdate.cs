namespace MembersGuild.Data.Models.Club;

public class ClubUpdate
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public int CreatedBy { get; set; }
    public User? Author { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}