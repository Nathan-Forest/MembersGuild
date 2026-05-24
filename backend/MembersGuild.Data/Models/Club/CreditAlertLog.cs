namespace MembersGuild.Data.Models.Club;

public class CreditAlertLog
{
    public long Id { get; set; }
    public int MemberId { get; set; }
    public int RuleId { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}