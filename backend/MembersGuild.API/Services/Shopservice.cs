using MembersGuild.API.DTOs.Shop;
using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;
 
namespace MembersGuild.API.Services;
 
public class ShopService
{
    private readonly ClubDbContextFactory _dbFactory;
 
    public ShopService(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
 
    // ── Categories ────────────────────────────────────────────────────────────
 
    public async Task<List<ShopCategoryResponse>> GetCategoriesAsync(bool includeInactive = false)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var query = db.ShopCategories.AsQueryable();
        if (!includeInactive) query = query.Where(c => c.IsActive);
        return await query
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Select(c => new ShopCategoryResponse(
                c.Id, c.Name, c.Slug, c.IsSystem, c.DisplayOrder, c.IsActive))
            .ToListAsync();
    }
 
    public async Task<ShopCategoryResponse> CreateCategoryAsync(CreateCategoryRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var slug = req.Slug.ToLower().Trim();
        if (await db.ShopCategories.AnyAsync(c => c.Slug == slug))
            throw new InvalidOperationException("A category with this slug already exists.");
        var cat = new ShopCategory { Name = req.Name.Trim(), Slug = slug, DisplayOrder = req.DisplayOrder };
        db.ShopCategories.Add(cat);
        await db.SaveChangesAsync();
        return new ShopCategoryResponse(cat.Id, cat.Name, cat.Slug, cat.IsSystem, cat.DisplayOrder, cat.IsActive);
    }
 
    public async Task<ShopCategoryResponse> UpdateCategoryAsync(int id, UpdateCategoryRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var cat = await db.ShopCategories.FindAsync(id)
            ?? throw new KeyNotFoundException("Category not found.");
        if (cat.IsSystem) throw new InvalidOperationException("System categories cannot be modified.");
        cat.Name = req.Name.Trim(); cat.DisplayOrder = req.DisplayOrder; cat.IsActive = req.IsActive;
        await db.SaveChangesAsync();
        return new ShopCategoryResponse(cat.Id, cat.Name, cat.Slug, cat.IsSystem, cat.DisplayOrder, cat.IsActive);
    }
 
    public async Task DeleteCategoryAsync(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var cat = await db.ShopCategories.FindAsync(id)
            ?? throw new KeyNotFoundException("Category not found.");
        if (cat.IsSystem) throw new InvalidOperationException("System categories cannot be deleted.");
        var hasItems = await db.ShopItems.AnyAsync(i => i.Category == cat.Slug);
        if (hasItems) throw new InvalidOperationException("Cannot delete a category that has items.");
        db.ShopCategories.Remove(cat);
        await db.SaveChangesAsync();
    }
 
    // ── Items ─────────────────────────────────────────────────────────────────
 
    public async Task<List<ShopItemResponse>> GetItemsAsync(string? categorySlug = null, bool includeInactive = false)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var query = db.ShopItems
            .Include(i => i.Variants.Where(v => includeInactive || v.IsActive))
            .AsQueryable();
        if (!includeInactive) query = query.Where(i => i.IsActive);
        if (categorySlug != null) query = query.Where(i => i.Category == categorySlug);
        var items = await query.OrderBy(i => i.DisplayOrder).ThenBy(i => i.Name).ToListAsync();
        var slugs = items.Select(i => i.Category).Distinct().ToList();
        var catNames = await db.ShopCategories
            .Where(c => slugs.Contains(c.Slug))
            .ToDictionaryAsync(c => c.Slug, c => c.Name);
        return items.Select(i => MapItem(i, catNames)).ToList();
    }
 
    public async Task<ShopItemResponse?> GetItemAsync(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var item = await db.ShopItems.Include(i => i.Variants).FirstOrDefaultAsync(i => i.Id == id);
        if (item is null) return null;
        var catName = await db.ShopCategories.Where(c => c.Slug == item.Category)
            .Select(c => c.Name).FirstOrDefaultAsync() ?? item.Category;
        return MapItem(item, new Dictionary<string, string> { [item.Category] = catName });
    }
 
    public async Task<ShopItemResponse> CreateItemAsync(CreateItemRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var category = await db.ShopCategories.FirstOrDefaultAsync(c => c.Slug == req.Category)
            ?? throw new KeyNotFoundException($"Category '{req.Category}' not found.");
        var item = new ShopItem
        {
            Name = req.Name.Trim(), Description = req.Description?.Trim(),
            Category = req.Category, BasePrice = req.BasePrice,
            CreditValue = req.CreditValue, IsActive = true, DisplayOrder = req.DisplayOrder,
        };
        db.ShopItems.Add(item);
        await db.SaveChangesAsync();
        return MapItem(item, new Dictionary<string, string> { [category.Slug] = category.Name });
    }
 
    public async Task<ShopItemResponse?> UpdateItemAsync(int id, UpdateItemRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var item = await db.ShopItems.Include(i => i.Variants).FirstOrDefaultAsync(i => i.Id == id);
        if (item is null) return null;
        var category = await db.ShopCategories.FirstOrDefaultAsync(c => c.Slug == req.Category)
            ?? throw new KeyNotFoundException($"Category '{req.Category}' not found.");
        item.Name = req.Name.Trim(); item.Description = req.Description?.Trim();
        item.Category = req.Category; item.BasePrice = req.BasePrice;
        item.CreditValue = req.CreditValue; item.IsActive = req.IsActive; item.DisplayOrder = req.DisplayOrder;
        await db.SaveChangesAsync();
        return MapItem(item, new Dictionary<string, string> { [category.Slug] = category.Name });
    }
 
    public async Task UpdateItemImageAsync(int id, string imageUrl)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var item = await db.ShopItems.FindAsync(id) ?? throw new KeyNotFoundException("Item not found.");
        item.ImageUrl = imageUrl;
        await db.SaveChangesAsync();
    }
 
    public async Task<bool> DeleteItemAsync(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var item = await db.ShopItems.FindAsync(id);
        if (item is null) return false;
        if (item.IsSystem) throw new InvalidOperationException("System items cannot be deleted.");
        db.ShopItems.Remove(item);
        await db.SaveChangesAsync();
        return true;
    }
 
    // ── Variants ──────────────────────────────────────────────────────────────
 
    public async Task<ShopItemVariantResponse> CreateVariantAsync(int itemId, CreateVariantRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var item = await db.ShopItems.FindAsync(itemId) ?? throw new KeyNotFoundException("Item not found.");
        if (item.Category == "credits") throw new InvalidOperationException("Credit items cannot have variants.");
        var variant = new ShopItemVariant
        {
            ShopItemId = itemId, Name = req.Name.Trim(),
            StockQuantity = req.StockQuantity, AdditionalPrice = req.AdditionalPrice, IsActive = true,
        };
        db.ShopItemVariants.Add(variant);
        await db.SaveChangesAsync();
        return new ShopItemVariantResponse(variant.Id, variant.Name, variant.StockQuantity, variant.AdditionalPrice, variant.IsActive);
    }
 
    public async Task<ShopItemVariantResponse?> UpdateVariantAsync(int variantId, UpdateVariantRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var variant = await db.ShopItemVariants.FindAsync(variantId);
        if (variant is null) return null;
        variant.Name = req.Name.Trim(); variant.StockQuantity = req.StockQuantity;
        variant.AdditionalPrice = req.AdditionalPrice; variant.IsActive = req.IsActive;
        await db.SaveChangesAsync();
        return new ShopItemVariantResponse(variant.Id, variant.Name, variant.StockQuantity, variant.AdditionalPrice, variant.IsActive);
    }
 
    public async Task UpdateVariantStockAsync(int variantId, int quantity)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var variant = await db.ShopItemVariants.FindAsync(variantId)
            ?? throw new KeyNotFoundException("Variant not found.");
        variant.StockQuantity = quantity;
        await db.SaveChangesAsync();
    }
 
    public async Task<bool> DeleteVariantAsync(int variantId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var variant = await db.ShopItemVariants.FindAsync(variantId);
        if (variant is null) return false;
        db.ShopItemVariants.Remove(variant);
        await db.SaveChangesAsync();
        return true;
    }
 
    // ── Credit Price ──────────────────────────────────────────────────────────
 
    public async Task<decimal> GetCreditPriceAsync()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var setting = await db.ClubSettings.FindAsync("credit_price_aud");
        return setting != null && decimal.TryParse(setting.Value, out var price) ? price : 5.00m;
    }
 
    public async Task SetCreditPriceAsync(decimal pricePerCredit, int updatedBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var setting = await db.ClubSettings.FindAsync("credit_price_aud");
        if (setting is null)
        {
            db.ClubSettings.Add(new ClubSetting
                { Key = "credit_price_aud", Value = pricePerCredit.ToString("F2"), UpdatedBy = updatedBy, UpdatedAt = DateTime.UtcNow });
        }
        else
        {
            setting.Value = pricePerCredit.ToString("F2");
            setting.UpdatedBy = updatedBy; setting.UpdatedAt = DateTime.UtcNow;
        }
        var systemPacks = await db.ShopItems
            .Where(i => i.Category == "credits" && i.IsSystem && i.CreditValue.HasValue)
            .ToListAsync();
        foreach (var pack in systemPacks)
            pack.BasePrice = pack.CreditValue!.Value * pricePerCredit;
        await db.SaveChangesAsync();
    }
 
    // ── Orders ────────────────────────────────────────────────────────────────
 
    public async Task<List<ShopOrderSummaryResponse>> GetOrdersAsync(string? status = null)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var query = db.ShopOrders.Include(o => o.User).AsQueryable();
        if (status != null) query = query.Where(o => o.Status == status);
        return await query.OrderByDescending(o => o.CreatedAt)
            .Select(o => new ShopOrderSummaryResponse(
                o.Id, o.PaymentReference,
                $"{o.User!.FirstName} {o.User.LastName}", o.User.Email,
                o.Status, o.TotalAmount, o.TotalCredits, o.CreatedAt, o.PaymentConfirmedAt))
            .ToListAsync();
    }
 
    public async Task<List<ShopOrderSummaryResponse>> GetMyOrdersAsync(int userId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        return await db.ShopOrders.Include(o => o.User)
            .Where(o => o.UserId == userId).OrderByDescending(o => o.CreatedAt)
            .Select(o => new ShopOrderSummaryResponse(
                o.Id, o.PaymentReference,
                $"{o.User!.FirstName} {o.User.LastName}", o.User.Email,
                o.Status, o.TotalAmount, o.TotalCredits, o.CreatedAt, o.PaymentConfirmedAt))
            .ToListAsync();
    }
 
    public async Task<ShopOrderResponse?> GetOrderAsync(int orderId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var order = await db.ShopOrders
            .Include(o => o.User)
            .Include(o => o.ConfirmedByUser)
            .Include(o => o.Items).ThenInclude(i => i.ShopItem)
            .Include(o => o.Items).ThenInclude(i => i.Variant)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        return order is null ? null : MapOrder(order);
    }
 
    public async Task<ShopOrderResponse> CreateOrderAsync(int userId, string clubSlug, CreateOrderRequest req)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(userId) ?? throw new KeyNotFoundException("User not found.");
        if (user.Role == "cats") throw new InvalidOperationException("CATS members cannot make purchases.");
 
        decimal totalAmount = 0; int totalCredits = 0;
        var orderItems = new List<ShopOrderItem>();
 
        foreach (var cartItem in req.Items)
        {
            if (cartItem.Quantity < 1) throw new InvalidOperationException("Quantity must be at least 1.");
            var item = await db.ShopItems.Include(i => i.Variants)
                .FirstOrDefaultAsync(i => i.Id == cartItem.ItemId && i.IsActive)
                ?? throw new KeyNotFoundException($"Item {cartItem.ItemId} not found or unavailable.");
 
            var unitPrice = item.BasePrice;
            ShopItemVariant? variant = null;
 
            if (item.Category != "credits")
            {
                var activeVariants = item.Variants.Where(v => v.IsActive).ToList();
                if (activeVariants.Count > 0)
                {
                    if (!cartItem.VariantId.HasValue)
                        throw new InvalidOperationException($"Please select a variant for '{item.Name}'.");
                    variant = activeVariants.FirstOrDefault(v => v.Id == cartItem.VariantId)
                        ?? throw new KeyNotFoundException($"Variant not found for '{item.Name}'.");
                    if (variant.StockQuantity < cartItem.Quantity)
                        throw new InvalidOperationException(
                            $"Only {variant.StockQuantity} of '{item.Name} — {variant.Name}' available.");
                    variant.StockQuantity -= cartItem.Quantity;
                    unitPrice += variant.AdditionalPrice;
                }
            }
 
            var creditValue = item.CreditValue ?? 0;
            totalAmount += unitPrice * cartItem.Quantity;
            totalCredits += creditValue * cartItem.Quantity;
            orderItems.Add(new ShopOrderItem
            {
                ShopItemId = item.Id, VariantId = variant?.Id, Quantity = cartItem.Quantity,
                UnitPrice = unitPrice, CreditValue = creditValue,
                ItemNameSnapshot = item.Name, VariantNameSnapshot = variant?.Name,
            });
        }
 
        var order = new ShopOrder
        {
            UserId = userId, PaymentReference = "", Status = OrderStatus.Pending,
            TotalAmount = totalAmount, TotalCredits = totalCredits,
            PaymentMethod = "bank_transfer", Items = orderItems,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        db.ShopOrders.Add(order);
        await db.SaveChangesAsync();
 
        order.PaymentReference = GeneratePaymentReference(clubSlug, user.LastName, order.Id);
        await db.SaveChangesAsync();
        return (await GetOrderAsync(order.Id))!;
    }
 
    public async Task<ShopOrderResponse?> ConfirmPaymentAsync(int orderId, ConfirmPaymentRequest req, int confirmedByUserId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var order = await db.ShopOrders
            .Include(o => o.Items).ThenInclude(i => i.ShopItem)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return null;
        if (order.Status != OrderStatus.Pending)
            throw new InvalidOperationException($"Order is '{order.Status}' — only pending orders can be confirmed.");
 
        if (order.TotalCredits > 0)
        {
            var member = await db.Users.FindAsync(order.UserId)!;
            member!.CreditBalance += order.TotalCredits;
            db.CreditTransactions.Add(new CreditTransaction
            {
                UserId = order.UserId, Amount = order.TotalCredits, BalanceAfter = member.CreditBalance,
                TransactionType = TransactionTypes.PaymentConfirmed, ReferenceId = order.Id,
                ReferenceType = "order", Notes = $"Shop order {order.PaymentReference}",
                CreatedBy = confirmedByUserId, CreatedAt = DateTime.UtcNow,
            });
        }
 
        var hasMerchandise = order.Items.Any(i => i.ShopItem?.Category != "credits");
        order.Status = hasMerchandise ? OrderStatus.PendingDelivery : OrderStatus.Delivered;
        order.PaymentConfirmedAt = DateTime.UtcNow; order.PaymentConfirmedBy = confirmedByUserId;
        order.PaymentReceiptNumber = req.ReceiptNumber.Trim();
        if (!string.IsNullOrWhiteSpace(req.Notes)) order.FulfillmentNotes = req.Notes.Trim();
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetOrderAsync(order.Id);
    }
 
    public async Task<ShopOrderResponse?> MarkDeliveredAsync(int orderId, DeliverOrderRequest req, int deliveredByUserId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var order = await db.ShopOrders.FindAsync(orderId);
        if (order is null) return null;
        if (order.Status != OrderStatus.PendingDelivery)
            throw new InvalidOperationException("Order must be 'Pending Delivery' to mark as delivered.");
        order.Status = OrderStatus.Delivered; order.DeliveredAt = DateTime.UtcNow;
        order.DeliveredBy = deliveredByUserId;
        if (!string.IsNullOrWhiteSpace(req.Notes)) order.FulfillmentNotes = req.Notes.Trim();
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetOrderAsync(order.Id);
    }
 
    public async Task<ShopOrderResponse?> CancelOrderAsync(int orderId, int cancelledByUserId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var order = await db.ShopOrders
            .Include(o => o.Items).ThenInclude(i => i.Variant)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return null;
        if (order.Status is OrderStatus.Delivered or OrderStatus.Cancelled)
            throw new InvalidOperationException($"Cannot cancel an order with status '{order.Status}'.");
        foreach (var item in order.Items.Where(i => i.Variant is not null))
            item.Variant!.StockQuantity += item.Quantity;
        order.Status = OrderStatus.Cancelled; order.CancelledAt = DateTime.UtcNow;
        order.CancelledBy = cancelledByUserId; order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetOrderAsync(order.Id);
    }
 
    // ── Inventory ─────────────────────────────────────────────────────────────
 
    public async Task<List<InventoryItemResponse>> GetInventoryAsync()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var variants = await db.ShopItemVariants
            .Include(v => v.ShopItem)
            .Where(v => v.ShopItem!.IsActive && v.ShopItem.Category != "credits")
            .OrderBy(v => v.ShopItem!.DisplayOrder).ThenBy(v => v.ShopItem!.Name).ThenBy(v => v.Name)
            .ToListAsync();
        var slugs = variants.Select(v => v.ShopItem!.Category).Distinct().ToList();
        var catNames = await db.ShopCategories.Where(c => slugs.Contains(c.Slug))
            .ToDictionaryAsync(c => c.Slug, c => c.Name);
        return variants.Select(v => new InventoryItemResponse(
            v.Id, v.Name, v.ShopItemId, v.ShopItem!.Name,
            catNames.GetValueOrDefault(v.ShopItem.Category, v.ShopItem.Category),
            v.StockQuantity, v.StockQuantity <= 3 && v.StockQuantity > 0,
            v.StockQuantity == 0, v.IsActive)).ToList();
    }
 
    // ── Helpers ───────────────────────────────────────────────────────────────
 
    private static string GeneratePaymentReference(string clubSlug, string surname, int orderId)
    {
        var slug = clubSlug.ToUpper();
        var name = new string(surname.ToUpper().Where(char.IsLetter).ToArray());
        if (name.Length > 8) name = name[..8];
        return $"{slug}-{name}-{orderId}";
    }
 
    private static ShopItemResponse MapItem(ShopItem i, Dictionary<string, string> catNames) =>
        new(i.Id, i.Name, i.Description, i.Category,
            catNames.GetValueOrDefault(i.Category, i.Category),
            i.ImageUrl, i.BasePrice, i.CreditValue, i.IsSystem, i.IsActive, i.DisplayOrder,
            i.Variants.Select(v =>
                new ShopItemVariantResponse(v.Id, v.Name, v.StockQuantity, v.AdditionalPrice, v.IsActive)
            ).ToList());
 
    private static ShopOrderResponse MapOrder(ShopOrder o) =>
        new(o.Id, o.PaymentReference, o.Status, o.TotalAmount, o.TotalCredits,
            o.PaymentMethod, o.PaymentReceiptNumber, o.PaymentConfirmedAt,
            o.ConfirmedByUser is not null ? $"{o.ConfirmedByUser.FirstName} {o.ConfirmedByUser.LastName}" : null,
            o.FulfillmentNotes, o.DeliveredAt, o.CancelledAt,
            o.Items.Select(i => new ShopOrderItemResponse(
                i.Id, i.ShopItemId, i.ItemNameSnapshot, i.ShopItem?.Category,
                i.VariantId, i.VariantNameSnapshot, i.Quantity, i.UnitPrice, i.CreditValue,
                i.UnitPrice * i.Quantity)).ToList(),
            o.UserId,
            o.User is not null ? $"{o.User.FirstName} {o.User.LastName}" : "",
            o.User?.Email ?? "", o.CreatedAt, o.UpdatedAt);
}
 