using System.ComponentModel.DataAnnotations;

namespace MembersGuild.API.DTOs.Credits;

public record CreditBalanceResponse(
    int UserId,
    string FullName,
    int Balance,
    int PendingCredits  // from unconfirmed shop orders
);

public record TransactionResponse(
    long Id,
    int UserId,
    string? UserFullName,
    int Amount,
    int BalanceAfter,
    string TransactionType,
    string TransactionLabel,
    int? ReferenceId,
    string? ReferenceType,
    string? Notes,
    DateTime CreatedAt
);

public record AdjustCreditsRequest(
    [Required] int UserId,
    [Required] int Amount,  // positive = add, negative = remove
    [Required, MaxLength(200)] string Notes
);

public record MyAccountResponse(
    int CreditBalance,
    int PendingCredits,
    List<TransactionResponse> RecentTransactions
);