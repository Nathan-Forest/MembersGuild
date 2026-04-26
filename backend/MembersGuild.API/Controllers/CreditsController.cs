using MembersGuild.API.DTOs.Credits;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/credits")]
[Authorize]
public class CreditsController : ControllerBase
{
    private readonly ICreditService _credits;

    public CreditsController(ICreditService credits)
    {
        _credits = credits;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole => User.FindFirst("role")?.Value ?? "";

    /// <summary>GET /api/credits/my-account — own account summary</summary>
    [HttpGet("my-account")]
    public async Task<IActionResult> GetMyAccount()
    {
        var result = await _credits.GetMyAccountAsync(CurrentUserId);
        return Ok(result);
    }

    /// <summary>GET /api/credits/balances — Finance/Webmaster only</summary>
    [HttpGet("balances")]
    public async Task<IActionResult> GetAllBalances()
    {
        if (!CanManageCredits()) return Forbid();
        return Ok(await _credits.GetAllBalancesAsync());
    }

    /// <summary>GET /api/credits/transactions — Finance/Webmaster only</summary>
    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions([FromQuery] int? userId)
    {
        if (!CanManageCredits()) return Forbid();
        return Ok(await _credits.GetAllTransactionsAsync(userId));
    }

    /// <summary>POST /api/credits/adjust — Finance/Webmaster only</summary>
    [HttpPost("adjust")]
    public async Task<IActionResult> AdjustCredits([FromBody] AdjustCreditsRequest request)
    {
        if (!CanManageCredits()) return Forbid();

        try
        {
            var result = await _credits.AdjustCreditsAsync(request, CurrentUserId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    private bool CanManageCredits() => CurrentRole is "finance" or "webmaster";
}