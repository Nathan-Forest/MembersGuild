using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Models;
using MembersGuild.API.Services;
 
namespace MembersGuild.API.Controllers;
 
[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController(ShopService shopService, ClubContext clubContext) : ControllerBase
{
    private int CurrentUserId =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
 
    private string CurrentRole =>
        User.FindFirst(ClaimTypes.Role)?.Value ?? "";
 
    // ── Member: My Orders ─────────────────────────────────────────────────────
 
    // GET /api/orders/mine
    [HttpGet("mine")]
    public async Task<IActionResult> GetMyOrders()
    {
        var result = await shopService.GetMyOrdersAsync(CurrentUserId);
        return Ok(result);
    }
 
    // GET /api/orders/mine/{id}
    [HttpGet("mine/{id}")]
    public async Task<IActionResult> GetMyOrder(int id)
    {
        try
        {
            var order = await shopService.GetOrderAsync(id);
 
            // Members can only view their own orders
            if (CurrentRole is not ("committee" or "finance" or "webmaster") &&
                order.MemberId != CurrentUserId)
                return Forbid();
 
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // POST /api/orders
    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest req)
    {
        if (req.Items == null || req.Items.Count == 0)
            return BadRequest(new { error = "Order must contain at least one item." });
 
        try
        {
            var order = await shopService.CreateOrderAsync(
                CurrentUserId, clubContext.Slug, req);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // ── Management: All Orders ────────────────────────────────────────────────
 
    // GET /api/orders?status=pending
    [HttpGet]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> GetOrders([FromQuery] string? status = null)
    {
        var result = await shopService.GetOrdersAsync(status);
        return Ok(result);
    }
 
    // GET /api/orders/{id}
    [HttpGet("{id}")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> GetOrder(int id)
    {
        try
        {
            var result = await shopService.GetOrderAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // POST /api/orders/{id}/confirm
    [HttpPost("{id}/confirm")]
    [Authorize(Roles = "finance,webmaster")]
    public async Task<IActionResult> ConfirmPayment(int id, [FromBody] ConfirmPaymentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ReceiptNumber))
            return BadRequest(new { error = "Receipt number is required." });
 
        try
        {
            var result = await shopService.ConfirmPaymentAsync(id, req, CurrentUserId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // POST /api/orders/{id}/deliver
    [HttpPost("{id}/deliver")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> MarkDelivered(int id, [FromBody] DeliverOrderRequest req)
    {
        try
        {
            var result = await shopService.MarkDeliveredAsync(id, req, CurrentUserId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // POST /api/orders/{id}/cancel
    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "finance,webmaster")]
    public async Task<IActionResult> CancelOrder(int id)
    {
        try
        {
            var result = await shopService.CancelOrderAsync(id, CurrentUserId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}