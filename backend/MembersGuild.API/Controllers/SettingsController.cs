using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Services;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController : ControllerBase
{
    private readonly SettingsService _settings;

    public SettingsController(SettingsService settings)
    {
        _settings = settings;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

    // GET /api/settings/payment — public (needed for shop page without auth)
    [HttpGet("payment")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaymentSettings()
    {
        var result = await _settings.GetPaymentSettingsAsync();
        if (result is null) return Ok(new { });
        return Ok(new
        {
            bankName = result.BankName,
            accountName = result.AccountName,
            bsb = result.Bsb,
            accountNumber = result.AccountNumber,
            paymentInstructions = result.PaymentInstructions,
        });
    }

    // PUT /api/settings/payment — Webmaster only
    [HttpPut("payment")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> SavePaymentSettings([FromBody] PaymentSettingsRequest req)
    {
        var result = await _settings.SavePaymentSettingsAsync(req, CurrentUserId);
        return Ok(new { success = true });
    }

    // GET /api/settings/labels — returns configurable field labels
    [HttpGet("labels")]
    [Authorize]
    public async Task<IActionResult> GetLabels()
    {
        var label = await _settings.GetAssociationNumberLabelAsync();
        return Ok(new { associationNumberLabel = label });
    }
}