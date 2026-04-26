namespace MembersGuild.Data.Models.Club;

public class CreditTransaction
{
    public long Id { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Positive = credit added. Negative = credit deducted.
    /// </summary>
    public int Amount { get; set; }

    /// <summary>
    /// Snapshot of balance immediately after this transaction. Provides audit trail.
    /// </summary>
    public int BalanceAfter { get; set; }

    public string TransactionType { get; set; } = string.Empty;
    public int? ReferenceId { get; set; }        // session_id, order_id, etc.
    public string? ReferenceType { get; set; }   // "session", "order", "manual"
    public string? Notes { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}

/// <summary>
/// Known transaction type codes — avoids magic strings.
/// </summary>
public static class TransactionTypes
{
    public const string SessionBooking  = "session_booking";
    public const string SessionRefund   = "session_refund";
    public const string NsbaRefund      = "nsba_refund";
    public const string ManualAdd       = "manual_add";
    public const string ManualRemove    = "manual_remove";
    public const string ShopPurchase    = "shop_purchase";
    public const string ShopRefund      = "shop_refund";
    public const string CatsInitial     = "cats_initial";
    public const string PaymentConfirmed = "payment_confirmed";
}
