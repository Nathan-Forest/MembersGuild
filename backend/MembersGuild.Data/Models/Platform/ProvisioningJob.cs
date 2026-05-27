using System.ComponentModel.DataAnnotations.Schema;

namespace MembersGuild.Data.Models.Platform;

[Table("provisioning_jobs", Schema = "platform")]
public class ProvisioningJob
{
    public Guid   Id          { get; set; } = Guid.NewGuid();
    public string Type        { get; set; } = string.Empty;
    public string TargetSlug  { get; set; } = string.Empty;
    public string Status      { get; set; } = "pending";
    public DateTime  StartedAt   { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? Error { get; set; }
}