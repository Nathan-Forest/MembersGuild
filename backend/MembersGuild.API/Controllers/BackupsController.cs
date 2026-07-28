using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MembersGuild.API.Services;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/backups")]
[Authorize(Roles = "committee,membership,finance,webmaster")]
public class BackupsController : ControllerBase
{
    private readonly BackupsService _backups;

    public BackupsController(BackupsService backups)
    {
        _backups = backups;
    }

    private static (DateTime start, DateTime end) ParseDates(string? start, string? end)
    {
        var s = DateTime.TryParse(start, out var sd)
            ? DateTime.SpecifyKind(sd, DateTimeKind.Utc)
            : DateTime.UtcNow.AddMonths(-1);

        var e = DateTime.TryParse(end, out var ed)
            ? DateTime.SpecifyKind(ed, DateTimeKind.Utc).AddDays(1).AddTicks(-1)
            : DateTime.UtcNow;

        return (s, e);
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> AttendanceExport([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _backups.GetAttendanceExportAsync(s, e));
    }

    [HttpGet("membership")]
    public async Task<IActionResult> MembershipExport()
    {
        return Ok(await _backups.GetMembershipExportAsync());
    }

    [HttpGet("credit-history")]
    public async Task<IActionResult> CreditHistoryExport([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _backups.GetCreditHistoryExportAsync(s, e));
    }
}