using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MembersGuild.API.Services;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "coach,committee,membership,finance,webmaster")]
public class ReportsController : ControllerBase
{
    private readonly ReportsService _reports;

    public ReportsController(ReportsService reports)
    {
        _reports = reports;
    }

    private static (DateTime start, DateTime end) ParseDates(string? start, string? end)
    {
        var s = DateTime.TryParse(start, out var sd) ? sd : DateTime.UtcNow.AddMonths(-1);
        var e = DateTime.TryParse(end,   out var ed) ? ed.AddDays(1).AddTicks(-1) : DateTime.UtcNow;
        return (s, e);
    }

    [HttpGet("financial")]
    public async Task<IActionResult> Financial([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _reports.GetFinancialReportAsync(s, e));
    }

    [HttpGet("membership")]
    public async Task<IActionResult> Membership([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _reports.GetMembershipReportAsync(s, e));
    }

    [HttpGet("cats")]
    public async Task<IActionResult> Cats([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _reports.GetCatsReportAsync(s, e));
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> Attendance([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _reports.GetAttendanceReportAsync(s, e));
    }

    [HttpGet("lanes")]
    public async Task<IActionResult> Lanes([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _reports.GetLanesReportAsync(s, e));
    }

    [HttpGet("coaches")]
    public async Task<IActionResult> Coaches([FromQuery] string? start, [FromQuery] string? end)
    {
        var (s, e) = ParseDates(start, end);
        return Ok(await _reports.GetCoachesReportAsync(s, e));
    }
}