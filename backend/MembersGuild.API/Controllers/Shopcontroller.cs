using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Models;
using MembersGuild.API.Services;
 
namespace MembersGuild.API.Controllers;
 
[ApiController]
[Route("api/shop")]
[Authorize]
public class ShopController(ShopService shopService, IWebHostEnvironment env, ClubContext clubContext) : ControllerBase
{
    private int CurrentUserId =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
 
    private string CurrentRole =>
        User.FindFirst(ClaimTypes.Role)?.Value ?? "";
 
    // ── Categories ────────────────────────────────────────────────────────────
 
    // GET /api/shop/categories
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories([FromQuery] bool includeInactive = false)
    {
        // Inactive visible to webmaster only
        if (includeInactive && CurrentRole != "webmaster")
            includeInactive = false;
 
        var result = await shopService.GetCategoriesAsync(includeInactive);
        return Ok(result);
    }
 
    // POST /api/shop/categories
    [HttpPost("categories")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest req)
    {
        try
        {
            var result = await shopService.CreateCategoryAsync(req);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
 
    // PUT /api/shop/categories/{id}
    [HttpPut("categories/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryRequest req)
    {
        try
        {
            var result = await shopService.UpdateCategoryAsync(id, req);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // DELETE /api/shop/categories/{id}
    [HttpDelete("categories/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        try
        {
            await shopService.DeleteCategoryAsync(id);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // ── Items ─────────────────────────────────────────────────────────────────
 
    // GET /api/shop/items?category=credits&includeInactive=true
    [HttpGet("items")]
    public async Task<IActionResult> GetItems(
        [FromQuery] string? category = null,
        [FromQuery] bool includeInactive = false)
    {
        if (includeInactive && CurrentRole != "webmaster")
            includeInactive = false;
 
        var result = await shopService.GetItemsAsync(category, includeInactive);
        return Ok(result);
    }
 
    // GET /api/shop/items/{id}
    [HttpGet("items/{id}")]
    public async Task<IActionResult> GetItem(int id)
    {
        try
        {
            var result = await shopService.GetItemAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // POST /api/shop/items
    [HttpPost("items")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> CreateItem([FromBody] CreateItemRequest req)
    {
        try
        {
            var result = await shopService.CreateItemAsync(req);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // PUT /api/shop/items/{id}
    [HttpPut("items/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateItemRequest req)
    {
        try
        {
            var result = await shopService.UpdateItemAsync(id, req);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // DELETE /api/shop/items/{id}
    [HttpDelete("items/{id}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        try
        {
            await shopService.DeleteItemAsync(id);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // ── Image Upload ──────────────────────────────────────────────────────────
 
    // POST /api/shop/items/{id}/image
    [HttpPost("items/{id}/image")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UploadItemImage(int id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });
 
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Invalid file type. Allowed: JPG, PNG, GIF, WebP." });
 
        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { error = "File too large. Maximum size is 5MB." });
 
        var slug = clubContext.Slug;
        var uploadsPath = Path.Combine(env.ContentRootPath, "uploads", slug, "shop");
        Directory.CreateDirectory(uploadsPath);
 
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(uploadsPath, fileName);
 
        await using var stream = System.IO.File.Create(fullPath);
        await file.CopyToAsync(stream);
 
        var imageUrl = $"/api/files/{slug}/shop/{fileName}";
 
        try
        {
            await shopService.UpdateItemImageAsync(id, imageUrl);
            return Ok(new { imageUrl });
        }
        catch (KeyNotFoundException ex)
        {
            // Clean up uploaded file if item not found
            System.IO.File.Delete(fullPath);
            return NotFound(new { error = ex.Message });
        }
    }
 
    // ── Variants ──────────────────────────────────────────────────────────────
 
    // POST /api/shop/items/{itemId}/variants
    [HttpPost("items/{itemId}/variants")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> CreateVariant(int itemId, [FromBody] CreateVariantRequest req)
    {
        try
        {
            var result = await shopService.CreateVariantAsync(itemId, req);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
 
    // PUT /api/shop/variants/{variantId}
    [HttpPut("variants/{variantId}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> UpdateVariant(int variantId, [FromBody] UpdateVariantRequest req)
    {
        try
        {
            var result = await shopService.UpdateVariantAsync(variantId, req);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // DELETE /api/shop/variants/{variantId}
    [HttpDelete("variants/{variantId}")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> DeleteVariant(int variantId)
    {
        try
        {
            await shopService.DeleteVariantAsync(variantId);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // ── Inventory ─────────────────────────────────────────────────────────────
 
    // GET /api/shop/inventory
    [HttpGet("inventory")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> GetInventory()
    {
        var result = await shopService.GetInventoryAsync();
        return Ok(result);
    }
 
    // PATCH /api/shop/variants/{variantId}/stock
    [HttpPatch("variants/{variantId}/stock")]
    [Authorize(Roles = "committee,finance,webmaster")]
    public async Task<IActionResult> UpdateStock(int variantId, [FromBody] UpdateStockRequest req)
    {
        try
        {
            await shopService.UpdateVariantStockAsync(variantId, req.Quantity);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
 
    // ── Credit Price ──────────────────────────────────────────────────────────
 
    // GET /api/shop/credit-price
    [HttpGet("credit-price")]
    public async Task<IActionResult> GetCreditPrice()
    {
        var price = await shopService.GetCreditPriceAsync();
        return Ok(new { pricePerCredit = price });
    }
 
    // PUT /api/shop/credit-price
    [HttpPut("credit-price")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> SetCreditPrice([FromBody] CreditPriceRequest req)
    {
        if (req.PricePerCredit <= 0)
            return BadRequest(new { error = "Price must be greater than zero." });
 
        await shopService.SetCreditPriceAsync(req.PricePerCredit, CurrentUserId);
        return Ok(new { success = true, pricePerCredit = req.PricePerCredit });
    }
}