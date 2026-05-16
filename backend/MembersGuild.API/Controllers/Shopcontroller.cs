using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.DTOs.Shop;
using MembersGuild.API.Services;
 
namespace MembersGuild.API.Controllers;
 
[ApiController]
[Route("api/shop")]
[Authorize]
public class ShopController : ControllerBase
{
    private readonly ShopService _shop;
    private readonly IWebHostEnvironment _env;
 
    public ShopController(ShopService shop, IWebHostEnvironment env)
    {
        _shop = shop;
        _env  = env;
    }
 
    private int    CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole   => User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    private string ClubSlug      => HttpContext.Request.Headers["X-Club-Slug"].ToString();
 
    // ── Categories ────────────────────────────────────────────────────────────
 
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories([FromQuery] bool includeInactive = false)
    {
        if (includeInactive && CurrentRole != "webmaster") includeInactive = false;
        return Ok(await _shop.GetCategoriesAsync(includeInactive));
    }
 
    [HttpPost("categories")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest req)
    {
        try { return Ok(await _shop.CreateCategoryAsync(req)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    [HttpPut("categories/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryRequest req)
    {
        try { return Ok(await _shop.UpdateCategoryAsync(id, req)); }
        catch (KeyNotFoundException ex)      { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    [HttpDelete("categories/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        try { await _shop.DeleteCategoryAsync(id); return Ok(new { success = true }); }
        catch (KeyNotFoundException ex)      { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // ── Items ─────────────────────────────────────────────────────────────────
 
    [HttpGet("items")]
    public async Task<IActionResult> GetItems(
        [FromQuery] string? category = null, [FromQuery] bool includeInactive = false)
    {
        if (includeInactive && CurrentRole != "webmaster") includeInactive = false;
        return Ok(await _shop.GetItemsAsync(category, includeInactive));
    }
 
    [HttpGet("items/{id}")]
    public async Task<IActionResult> GetItem(int id)
    {
        var result = await _shop.GetItemAsync(id);
        return result is null ? NotFound() : Ok(result);
    }
 
    [HttpPost("items")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> CreateItem([FromBody] CreateItemRequest req)
    {
        try { return Ok(await _shop.CreateItemAsync(req)); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    [HttpPut("items/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateItemRequest req)
    {
        try
        {
            var result = await _shop.UpdateItemAsync(id, req);
            return result is null ? NotFound() : Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    [HttpDelete("items/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        try
        {
            var deleted = await _shop.DeleteItemAsync(id);
            return deleted ? Ok(new { success = true }) : NotFound();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // ── Image Upload ──────────────────────────────────────────────────────────
 
    [HttpPost("items/{id}/image")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UploadItemImage(int id, IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest(new { error = "No file provided." });
        var allowed = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowed.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Invalid file type. Allowed: JPG, PNG, GIF, WebP." });
        if (file.Length > 5 * 1024 * 1024) return BadRequest(new { error = "File too large. Maximum 5MB." });
 
        var slug       = ClubSlug;
        var uploadPath = Path.Combine(_env.ContentRootPath, "uploads", slug, "shop");
        Directory.CreateDirectory(uploadPath);
        var ext      = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(uploadPath, fileName);
        await using var stream = System.IO.File.Create(fullPath);
        await file.CopyToAsync(stream);
        var imageUrl = $"/api/files/{slug}/shop/{fileName}";
        try
        {
            await _shop.UpdateItemImageAsync(id, imageUrl);
            return Ok(new { imageUrl });
        }
        catch (KeyNotFoundException ex)
        {
            System.IO.File.Delete(fullPath);
            return NotFound(new { error = ex.Message });
        }
    }
 
    // ── Variants ──────────────────────────────────────────────────────────────
 
    [HttpPost("items/{itemId}/variants")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> CreateVariant(int itemId, [FromBody] CreateVariantRequest req)
    {
        try { return Ok(await _shop.CreateVariantAsync(itemId, req)); }
        catch (KeyNotFoundException ex)      { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    [HttpPut("variants/{variantId}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateVariant(int variantId, [FromBody] UpdateVariantRequest req)
    {
        var result = await _shop.UpdateVariantAsync(variantId, req);
        return result is null ? NotFound() : Ok(result);
    }
 
    [HttpDelete("variants/{variantId}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteVariant(int variantId)
    {
        var deleted = await _shop.DeleteVariantAsync(variantId);
        return deleted ? Ok(new { success = true }) : NotFound();
    }
 
    // ── Inventory ─────────────────────────────────────────────────────────────
 
    [HttpGet("inventory")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> GetInventory() => Ok(await _shop.GetInventoryAsync());
 
    [HttpPatch("variants/{variantId}/stock")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> UpdateStock(int variantId, [FromBody] UpdateStockRequest req)
    {
        try { await _shop.UpdateVariantStockAsync(variantId, req.Quantity); return Ok(new { success = true }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // ── Credit Price ──────────────────────────────────────────────────────────
 
    [HttpGet("credit-price")]
    public async Task<IActionResult> GetCreditPrice()
    {
        var price = await _shop.GetCreditPriceAsync();
        return Ok(new { pricePerCredit = price });
    }
 
    [HttpPut("credit-price")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> SetCreditPrice([FromBody] CreditPriceRequest req)
    {
        if (req.PricePerCredit <= 0) return BadRequest(new { error = "Price must be greater than zero." });
        await _shop.SetCreditPriceAsync(req.PricePerCredit, CurrentUserId);
        return Ok(new { success = true, pricePerCredit = req.PricePerCredit });
    }
}