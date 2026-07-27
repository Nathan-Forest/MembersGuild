using Microsoft.AspNetCore.Authorization;
using MembersGuild.Data.Contexts;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using MembersGuild.API.DTOs.Shop;


namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly ShopService _shop;
    private readonly SquareService _square;
    private readonly PlatformDbContext _platformDb;

    public OrdersController(ShopService shop, SquareService square, PlatformDbContext platformDb)
    {
        _shop = shop;
        _square = square;
        _platformDb = platformDb;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    private string ClubSlug => HttpContext.Request.Headers["X-Club-Slug"].ToString();

    // ── Member: My Orders ─────────────────────────────────────────────────────

    [HttpGet("mine")]
    public async Task<IActionResult> GetMyOrders()
        => Ok(await _shop.GetMyOrdersAsync(CurrentUserId));
    private bool HasRole(params string[] roles) =>
    roles.Any(r => User.IsInRole(r));

    [HttpGet("mine/{id}")]
    public async Task<IActionResult> GetMyOrder(int id)
    {
        var order = await _shop.GetOrderAsync(id);
        if (order is null) return NotFound();
        var isStaff = HasRole("committee", "finance", "webmaster");
        if (!isStaff && order.MemberId != CurrentUserId) return Forbid();
        return Ok(order);
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { error = "Order must contain at least one item." });
        try
        {
            var order = await _shop.CreateOrderAsync(CurrentUserId, ClubSlug, req);
            return Ok(order);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{id}/pay-by-card")]
    public async Task<IActionResult> PayByCard(int id, [FromBody] PayByCardRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.SourceId))
            return BadRequest(new { error = "Card details are required." });

        var order = await _shop.GetOrderAsync(id);
        if (order is null) return NotFound();

        var isStaff = HasRole("committee", "finance", "webmaster");
        if (!isStaff && order.MemberId != CurrentUserId) return Forbid();

        if (order.Status != "pending")
            return BadRequest(new { error = $"Order is '{order.Status}' — only pending orders can be paid." });

        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == ClubSlug);
        if (club is null) return BadRequest(new { error = "Club not found." });

        try
        {
            var paymentId = await _square.CreatePaymentAsync(club.Id, req.SourceId, order.TotalAmount, order.PaymentReference);
            var result = await _shop.ConfirmSquarePaymentAsync(id, paymentId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ── Management: All Orders ────────────────────────────────────────────────

    [HttpGet]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> GetOrders([FromQuery] string? status = null)
        => Ok(await _shop.GetOrdersAsync(status));

    [HttpGet("{id}")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> GetOrder(int id)
    {
        var result = await _shop.GetOrderAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/confirm")]
    [Authorize(Roles = "finance,webmaster")]
    public async Task<IActionResult> ConfirmPayment(int id, [FromBody] ConfirmPaymentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ReceiptNumber))
            return BadRequest(new { error = "Receipt number is required." });
        try
        {
            var result = await _shop.ConfirmPaymentAsync(id, req, CurrentUserId);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{id}/deliver")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> MarkDelivered(int id, [FromBody] DeliverOrderRequest req)
    {
        try
        {
            var result = await _shop.MarkDeliveredAsync(id, req, CurrentUserId);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "finance,webmaster")]
    public async Task<IActionResult> CancelOrder(int id)
    {
        try
        {
            var result = await _shop.CancelOrderAsync(id, CurrentUserId);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}