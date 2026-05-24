using MembersGuild.API.Services;
using MembersGuild.Data.Models.Club;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MembersGuild.Data.Contexts;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/settings/email-alerts")]
[Authorize(Roles = "webmaster")]
public class EmailAlertsController : ControllerBase
{
    private readonly ClubDbContext _db;
    private readonly CreditAlertService _alertService;

    public EmailAlertsController(ClubDbContext db, CreditAlertService alertService)
    {
        _db = db;
        _alertService = alertService;
    }

    // ── Templates ──────────────────────────────────────────────────

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates() =>
        Ok(await _db.EmailTemplates.OrderByDescending(t => t.IsDefault).ThenBy(t => t.Name).ToListAsync());

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] EmailTemplateRequest req)
    {
        if (req.IsDefault)
            await ClearDefaultTemplates();

        var t = new EmailTemplate { Name = req.Name, Subject = req.Subject, Body = req.Body, IsDefault = req.IsDefault };
        _db.EmailTemplates.Add(t);
        await _db.SaveChangesAsync();
        return Ok(t);
    }

    [HttpPut("templates/{id}")]
    public async Task<IActionResult> UpdateTemplate(int id, [FromBody] EmailTemplateRequest req)
    {
        var t = await _db.EmailTemplates.FindAsync(id);
        if (t == null) return NotFound();

        if (req.IsDefault) await ClearDefaultTemplates();

        t.Name = req.Name; t.Subject = req.Subject; t.Body = req.Body; t.IsDefault = req.IsDefault;
        await _db.SaveChangesAsync();
        return Ok(t);
    }

    [HttpDelete("templates/{id}")]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        var inUse = await _db.CreditAlertRules.AnyAsync(r => r.EmailTemplateId == id);
        if (inUse) return BadRequest(new { error = "Template is in use by an alert rule." });

        var t = await _db.EmailTemplates.FindAsync(id);
        if (t == null) return NotFound();
        _db.EmailTemplates.Remove(t);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── Rules ──────────────────────────────────────────────────────

    [HttpGet("rules")]
    public async Task<IActionResult> GetRules() =>
        Ok(await _db.CreditAlertRules.Include(r => r.EmailTemplate).OrderBy(r => r.ThresholdCredits).ToListAsync());

    [HttpPost("rules")]
    public async Task<IActionResult> CreateRule([FromBody] CreditAlertRuleRequest req)
    {
        var exists = await _db.EmailTemplates.AnyAsync(t => t.Id == req.EmailTemplateId);
        if (!exists) return BadRequest(new { error = "Template not found." });

        var rule = new CreditAlertRule { ThresholdCredits = req.ThresholdCredits, EmailTemplateId = req.EmailTemplateId, IsEnabled = true };
        _db.CreditAlertRules.Add(rule);
        await _db.SaveChangesAsync();
        return Ok(rule);
    }

    [HttpPut("rules/{id}")]
    public async Task<IActionResult> UpdateRule(int id, [FromBody] CreditAlertRuleRequest req)
    {
        var rule = await _db.CreditAlertRules.FindAsync(id);
        if (rule == null) return NotFound();
        rule.ThresholdCredits = req.ThresholdCredits;
        rule.EmailTemplateId = req.EmailTemplateId;
        rule.IsEnabled = req.IsEnabled;
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpDelete("rules/{id}")]
    public async Task<IActionResult> DeleteRule(int id)
    {
        var rule = await _db.CreditAlertRules.FindAsync(id);
        if (rule == null) return NotFound();
        _db.CreditAlertRules.Remove(rule);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── Settings ───────────────────────────────────────────────────

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateAlertSettings([FromBody] AlertSettingsRequest req)
    {
        var s = await _db.ClubSettings.FirstOrDefaultAsync();
        if (s == null) return NotFound();
        s.CreditAlertsEnabled = req.CreditAlertsEnabled;
        s.CreditAlertCooldownEnabled = req.CreditAlertCooldownEnabled;
        s.CreditAlertCooldownDays = req.CreditAlertCooldownDays;
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── Manual send ────────────────────────────────────────────────

    [HttpPost("send-low-credit/{memberId}")]
    public async Task<IActionResult> ManualSend(int memberId)
    {
        await _alertService.SendManualAsync(memberId);
        return Ok(new { success = true });
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetAlertSettings()
    {
        var s = await _db.ClubSettings.FirstOrDefaultAsync();
        if (s == null) return NotFound();
        return Ok(new
        {
            creditAlertsEnabled = s.CreditAlertsEnabled,
            creditAlertCooldownEnabled = s.CreditAlertCooldownEnabled,
            creditAlertCooldownDays = s.CreditAlertCooldownDays
        });
    }

    [HttpPost("send-low-credit-bulk")]
    public async Task<IActionResult> BulkManualSend([FromBody] BulkSendRequest req)
    {
        foreach (var memberId in req.UserIds)
            await _alertService.SendManualAsync(memberId);
        return Ok(new { sent = req.UserIds.Count });
    }

    public record BulkSendRequest(List<int> UserIds);
    // ── Helpers ────────────────────────────────────────────────────

    private async Task ClearDefaultTemplates() =>
        await _db.EmailTemplates.Where(t => t.IsDefault).ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDefault, false));
}

// DTOs
public record EmailTemplateRequest(string Name, string Subject, string Body, bool IsDefault);
public record CreditAlertRuleRequest(int ThresholdCredits, int EmailTemplateId, bool IsEnabled);
public record AlertSettingsRequest(bool CreditAlertsEnabled, bool CreditAlertCooldownEnabled, int CreditAlertCooldownDays);