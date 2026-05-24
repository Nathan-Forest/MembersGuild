using MembersGuild.API.Extensions;
using MembersGuild.API.Services;
using MembersGuild.Data.Models.Club;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/settings/email-alerts")]
[Authorize(Roles = "webmaster")]
public class EmailAlertsController : ControllerBase
{
    private readonly ClubDbContextFactory _dbFactory;
    private readonly CreditAlertService _alertService;

    public EmailAlertsController(ClubDbContextFactory dbFactory, CreditAlertService alertService)
    {
        _dbFactory = dbFactory;
        _alertService = alertService;
    }

    // ── Alert Settings ─────────────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<IActionResult> GetAlertSettings()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var enabled = await db.ClubSettings.FindAsync("credit_alerts_enabled");
        var cooldownOn = await db.ClubSettings.FindAsync("credit_alert_cooldown_enabled");
        var cooldownDays = await db.ClubSettings.FindAsync("credit_alert_cooldown_days");
        return Ok(new
        {
            creditAlertsEnabled = enabled?.Value == "true",
            creditAlertCooldownEnabled = cooldownOn?.Value == "true",
            creditAlertCooldownDays = int.TryParse(cooldownDays?.Value, out var d) ? d : 7,
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateAlertSettings([FromBody] AlertSettingsRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        await Upsert(db, "credit_alerts_enabled", req.CreditAlertsEnabled ? "true" : "false");
        await Upsert(db, "credit_alert_cooldown_enabled", req.CreditAlertCooldownEnabled ? "true" : "false");
        await Upsert(db, "credit_alert_cooldown_days", req.CreditAlertCooldownDays.ToString());
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    private static async Task Upsert(MembersGuild.Data.Contexts.ClubDbContext db, string key, string value)
    {
        var s = await db.ClubSettings.FindAsync(key);
        if (s == null) db.ClubSettings.Add(new ClubSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
        else { s.Value = value; s.UpdatedAt = DateTime.UtcNow; }
    }

    // ── Templates ──────────────────────────────────────────────────────────

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var templates = await db.EmailTemplates
            .OrderByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .ToListAsync();
        return Ok(templates);
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] EmailTemplateRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        if (req.IsDefault) await ClearDefaultTemplates(db);

        var t = new EmailTemplate
        {
            Name = req.Name,
            Subject = req.Subject,
            Body = req.Body,
            IsDefault = req.IsDefault,
        };
        db.EmailTemplates.Add(t);
        await db.SaveChangesAsync();
        return Ok(t);
    }

    [HttpPut("templates/{id}")]
    public async Task<IActionResult> UpdateTemplate(int id, [FromBody] EmailTemplateRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var t = await db.EmailTemplates.FindAsync(id);
        if (t == null) return NotFound();

        if (req.IsDefault) await ClearDefaultTemplates(db);

        t.Name = req.Name;
        t.Subject = req.Subject;
        t.Body = req.Body;
        t.IsDefault = req.IsDefault;
        await db.SaveChangesAsync();
        return Ok(t);
    }

    [HttpDelete("templates/{id}")]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var inUse = await db.CreditAlertRules.AnyAsync(r => r.EmailTemplateId == id);
        if (inUse) return BadRequest(new { error = "Template is in use by an alert rule." });

        var t = await db.EmailTemplates.FindAsync(id);
        if (t == null) return NotFound();
        db.EmailTemplates.Remove(t);
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── Rules ──────────────────────────────────────────────────────────────

    [HttpGet("rules")]
    public async Task<IActionResult> GetRules()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var rules = await db.CreditAlertRules
            .Include(r => r.EmailTemplate)
            .OrderBy(r => r.ThresholdCredits)
            .ToListAsync();
        return Ok(rules);
    }

    [HttpPost("rules")]
    public async Task<IActionResult> CreateRule([FromBody] CreditAlertRuleRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var exists = await db.EmailTemplates.AnyAsync(t => t.Id == req.EmailTemplateId);
        if (!exists) return BadRequest(new { error = "Template not found." });

        var rule = new CreditAlertRule
        {
            ThresholdCredits = req.ThresholdCredits,
            EmailTemplateId = req.EmailTemplateId,
            IsEnabled = true,
        };
        db.CreditAlertRules.Add(rule);
        await db.SaveChangesAsync();

        await db.Entry(rule).Reference(r => r.EmailTemplate).LoadAsync();
        return Ok(rule);
    }

    [HttpPut("rules/{id}")]
    public async Task<IActionResult> UpdateRule(int id, [FromBody] CreditAlertRuleRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var rule = await db.CreditAlertRules.FindAsync(id);
        if (rule == null) return NotFound();
        rule.ThresholdCredits = req.ThresholdCredits;
        rule.EmailTemplateId = req.EmailTemplateId;
        rule.IsEnabled = req.IsEnabled;
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpDelete("rules/{id}")]
    public async Task<IActionResult> DeleteRule(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var rule = await db.CreditAlertRules.FindAsync(id);
        if (rule == null) return NotFound();
        db.CreditAlertRules.Remove(rule);
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── Manual send ────────────────────────────────────────────────────────

    [HttpPost("send-low-credit/{memberId}")]
    public async Task<IActionResult> ManualSend(int memberId)
    {
        await _alertService.SendManualAsync(memberId);
        return Ok(new { success = true });
    }

    [HttpPost("send-low-credit-bulk")]
    public async Task<IActionResult> BulkManualSend([FromBody] BulkSendRequest req)
    {
        foreach (var memberId in req.UserIds)
            await _alertService.SendManualAsync(memberId);
        return Ok(new { sent = req.UserIds.Count });
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static async Task ClearDefaultTemplates(MembersGuild.Data.Contexts.ClubDbContext db)
    {
        var defaults = await db.EmailTemplates.Where(t => t.IsDefault).ToListAsync();
        foreach (var t in defaults) t.IsDefault = false;
        await db.SaveChangesAsync();
    }
}

// ── DTOs ───────────────────────────────────────────────────────────────────────
public record EmailTemplateRequest(string Name, string Subject, string Body, bool IsDefault);
public record CreditAlertRuleRequest(int ThresholdCredits, int EmailTemplateId, bool IsEnabled);
public record AlertSettingsRequest(bool CreditAlertsEnabled, bool CreditAlertCooldownEnabled, int CreditAlertCooldownDays);
public record BulkSendRequest(List<int> UserIds);