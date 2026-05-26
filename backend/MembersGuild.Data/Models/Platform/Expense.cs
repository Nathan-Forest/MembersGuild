public class Expense
{
    public int Id { get; set; }
    public string Category { get; set; } = "other";
    // server | domain | email | aws | software | marketing | other
    public string Description { get; set; } = "";
    public decimal AmountAud { get; set; }
    public DateOnly BillingDate { get; set; }
    public bool IsRecurring { get; set; }
    public string? RecurrenceInterval { get; set; } // monthly | annual
    public string? Vendor { get; set; }
    public string? ReceiptUrl { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}