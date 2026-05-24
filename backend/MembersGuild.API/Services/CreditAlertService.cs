using Microsoft.EntityFrameworkCore;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using MembersGuild.API.Middleware;

namespace MembersGuild.API.Services;

public class CreditAlertService
{
    private readonly ClubDbContextFactory _dbFactory;
    private readonly EmailService _email;
    private readonly ClubContext _club;  // ← was IClubContext

    public CreditAlertService(ClubDbContextFactory dbFactory, EmailService email, ClubContext club)  // ← was IClubContext
    {
        _dbFactory = dbFactory;
        _email = email;
        _club = club;
    }

    // Called automatically after any credit deduction
    public async Task CheckAndSendAsync(int memberId, int newBalance)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var settings = await db.ClubSettings.FirstOrDefaultAsync();
        if (settings == null || !settings.CreditAlertsEnabled) return;

        var member = await db.Users.FindAsync(memberId);
        if (member == null || !member.IsActive) return;

        var rules = await db.CreditAlertRules
            .Include(r => r.EmailTemplate)
            .Where(r => r.IsEnabled && newBalance <= r.ThresholdCredits)
            .ToListAsync();

        if (!rules.Any()) return;

        foreach (var rule in rules)
        {
            if (settings.CreditAlertCooldownEnabled)
            {
                var cutoff = DateTime.UtcNow.AddDays(-settings.CreditAlertCooldownDays);
                var recentlySent = await db.CreditAlertLog
                    .AnyAsync(l => l.MemberId == memberId
                               && l.RuleId == rule.Id
                               && l.SentAt >= cutoff);
                if (recentlySent) continue;
            }

            var body = rule.EmailTemplate.Body
                .Replace("{{first_name}}", member.FirstName)
                .Replace("{{last_name}}", member.LastName)
                .Replace("{{balance}}", newBalance.ToString())
                .Replace("{{threshold}}", rule.ThresholdCredits.ToString());

            await _email.SendGenericAsync(
                to: member.Email,
                subject: rule.EmailTemplate.Subject,
                body: body,
                clubName: _club.DisplayName,
                clubSlug: _club.Slug,
                logoUrl: _club.LogoUrl,
                primaryColor: _club.PrimaryColor
            );

            db.CreditAlertLog.Add(new CreditAlertLog
            {
                MemberId = memberId,
                RuleId = rule.Id,
                SentAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
    }

    // Manual send from Members page — always fires, ignores cooldown, uses default template
    public async Task SendManualAsync(int memberId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var member = await db.Users.FindAsync(memberId);
        if (member == null) return;

        var template = await db.EmailTemplates.FirstOrDefaultAsync(t => t.IsDefault)
                    ?? await db.EmailTemplates.FirstOrDefaultAsync();
        if (template == null) return;

        var body = template.Body
            .Replace("{{first_name}}", member.FirstName)
            .Replace("{{last_name}}", member.LastName)
            .Replace("{{balance}}", member.CreditBalance.ToString());

        await _email.SendGenericAsync(
            to: member.Email,
            subject: template.Subject,
            body: body,
            clubName: _club.DisplayName,
            clubSlug: _club.Slug,
            logoUrl: _club.LogoUrl,
            primaryColor: _club.PrimaryColor
        );
    }
}