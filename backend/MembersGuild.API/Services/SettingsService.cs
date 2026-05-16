using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public class SettingsService
{
    private readonly ClubDbContextFactory _dbFactory;

    public SettingsService(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<PaymentSettings?> GetPaymentSettingsAsync()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        return await db.PaymentSettings.FirstOrDefaultAsync();
    }

    public async Task<PaymentSettings> SavePaymentSettingsAsync(PaymentSettingsRequest req, int updatedBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var settings = await db.PaymentSettings.FirstOrDefaultAsync();

        if (settings is null)
        {
            settings = new PaymentSettings { Id = 1 };
            db.PaymentSettings.Add(settings);
        }

        settings.BankName            = req.BankName?.Trim();
        settings.AccountName         = req.AccountName?.Trim();
        settings.Bsb                 = req.Bsb?.Trim();
        settings.AccountNumber       = req.AccountNumber?.Trim();
        settings.PaymentInstructions = req.PaymentInstructions?.Trim();
        settings.UpdatedBy           = updatedBy;
        settings.UpdatedAt           = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return settings;
    }
}

public record PaymentSettingsRequest(
    string? BankName,
    string? AccountName,
    string? Bsb,
    string? AccountNumber,
    string? PaymentInstructions);