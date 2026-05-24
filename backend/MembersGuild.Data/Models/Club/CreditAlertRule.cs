namespace MembersGuild.Data.Models.Club;

public class CreditAlertRule
{
    public int Id { get; set; }
    public int ThresholdCredits { get; set; }
    public int EmailTemplateId { get; set; }
    public EmailTemplate EmailTemplate { get; set; } = null!;
    public bool IsEnabled { get; set; } = true;
}