namespace MembersGuild.Data.Models.Platform;

public class ClubApplication
{
    public int Id { get; set; }
    public string Status { get; set; } = "pending_payment";
    // pending_payment | payment_failed | pending_onboard | onboarded | rejected

    // Club details
    public string ClubName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string SportType { get; set; } = "general";
    public int? EstimatedMembers { get; set; }
    public string? Website { get; set; }

    // Webmaster
    public string ContactName { get; set; } = "";
    public string ContactEmail { get; set; } = "";
    public string? ContactPhone { get; set; }

    // Package
    public int? PackageId { get; set; }
    public Package? Package { get; set; }
    public string SelectedAddons { get; set; } = "[]"; // JSON array of addon IDs

    // Stripe
    public string? StripeCustomerId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public DateTime? SetupFeePaidAt { get; set; }

    // Review
    public string? Notes { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedBy { get; set; }

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}