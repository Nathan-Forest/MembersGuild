using MembersGuild.API.DTOs.Credits;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;
using MembersGuild.API.DTOs.Shop;

namespace MembersGuild.API.Services;

public interface ICreditService
{
    Task<MyAccountResponse> GetMyAccountAsync(int userId);
    Task<List<TransactionResponse>> GetAllTransactionsAsync(int? userId);
    Task<List<CreditBalanceResponse>> GetAllBalancesAsync();
    Task<TransactionResponse> AdjustCreditsAsync(AdjustCreditsRequest request, int adjustedBy);
}

public class CreditService : ICreditService
{
    private readonly ClubDbContextFactory _dbFactory;

    private static readonly Dictionary<string, string> TypeLabels = new()
    {
        ["session_booking"]   = "Session booking",
        ["session_refund"]    = "Session refund",
        ["nsba_refund"]       = "NSBA refund",
        ["manual_add"]        = "Credits added",
        ["manual_remove"]     = "Credits removed",
        ["shop_purchase"]     = "Shop purchase",
        ["shop_refund"]       = "Shop refund",
        ["cats_initial"]      = "Welcome credits",
        ["payment_confirmed"] = "Payment confirmed",
    };

    public CreditService(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<MyAccountResponse> GetMyAccountAsync(int userId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var user = await db.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("User not found");

        // Pending credits = sum of credits in unconfirmed shop orders
        var pendingCredits = await db.ShopOrders
            .Where(o => o.UserId == userId && o.Status == OrderStatus.Pending)
            .SumAsync(o => o.TotalCredits);

        var transactions = await db.CreditTransactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .Select(t => MapTransaction(t, null))
            .ToListAsync();

        return new MyAccountResponse(user.CreditBalance, pendingCredits, transactions);
    }

    public async Task<List<TransactionResponse>> GetAllTransactionsAsync(int? userId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var query = db.CreditTransactions
            .Include(t => t.User)
            .AsQueryable();

        if (userId.HasValue)
            query = query.Where(t => t.UserId == userId.Value);

        var transactions = await query
            .OrderByDescending(t => t.CreatedAt)
            .Take(200)
            .ToListAsync();

        return transactions.Select(t => MapTransaction(t, t.User?.FullName)).ToList();
    }

    public async Task<List<CreditBalanceResponse>> GetAllBalancesAsync()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var users = await db.Users
            .Where(u => u.IsActive)
            .OrderBy(u => u.LastName)
            .ToListAsync();

        var userIds = users.Select(u => u.Id).ToList();

        var pendingByUser = await db.ShopOrders
            .Where(o => userIds.Contains(o.UserId) && o.Status == OrderStatus.Pending)
            .GroupBy(o => o.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(o => o.TotalCredits) })
            .ToDictionaryAsync(x => x.UserId, x => x.Total);

        return users.Select(u => new CreditBalanceResponse(
            u.Id, u.FullName, u.CreditBalance,
            pendingByUser.GetValueOrDefault(u.Id, 0)
        )).ToList();
    }

    public async Task<TransactionResponse> AdjustCreditsAsync(AdjustCreditsRequest request, int adjustedBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var user = await db.Users.FindAsync(request.UserId)
            ?? throw new InvalidOperationException("User not found");

        var newBalance = user.CreditBalance + request.Amount;
        user.CreditBalance = newBalance;
        user.UpdatedAt     = DateTime.UtcNow;

        var type = request.Amount > 0 ? TransactionTypes.ManualAdd : TransactionTypes.ManualRemove;

        var transaction = new CreditTransaction
        {
            UserId          = user.Id,
            Amount          = request.Amount,
            BalanceAfter    = newBalance,
            TransactionType = type,
            Notes           = request.Notes,
            CreatedBy       = adjustedBy,
        };

        db.CreditTransactions.Add(transaction);
        await db.SaveChangesAsync();

        return MapTransaction(transaction, user.FullName);
    }

    private static TransactionResponse MapTransaction(CreditTransaction t, string? userName) => new(
        t.Id, t.UserId, userName, t.Amount, t.BalanceAfter,
        t.TransactionType,
        TypeLabels.GetValueOrDefault(t.TransactionType, t.TransactionType),
        t.ReferenceId, t.ReferenceType, t.Notes, t.CreatedAt
    );
}