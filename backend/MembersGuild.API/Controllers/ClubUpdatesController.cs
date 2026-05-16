using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/updates")]
[Authorize]
public class ClubUpdatesController : ControllerBase
{
    private readonly ClubDbContextFactory _dbFactory;

    public ClubUpdatesController(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole =>
        User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    // GET /api/updates — all active updates, latest first (all roles)
    [HttpGet]
    public async Task<IActionResult> GetUpdates()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var updates = await db.ClubUpdates
            .Include(u => u.Author)
            .Where(u => u.IsActive)
            .OrderByDescending(u => u.CreatedAt)
            .Take(20)
            .Select(u => new
            {
                u.Id, u.Title, u.Content, u.CreatedAt,
                authorName = $"{u.Author!.FirstName} {u.Author.LastName}",
            })
            .ToListAsync();
        return Ok(updates);
    }

    // POST /api/updates — committee, membership, finance, webmaster
    [HttpPost]
    [Authorize(Roles = "committee,membership,finance,webmaster")]
    public async Task<IActionResult> CreateUpdate([FromBody] CreateUpdateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Content))
            return BadRequest(new { error = "Content is required." });
        if (req.Content.Length > 1000)
            return BadRequest(new { error = "Content must be under 1000 characters." });

        await using var db = _dbFactory.CreateForCurrentClub();

        var update = new ClubUpdate
        {
            Title     = req.Title?.Trim() ?? "",
            Content   = req.Content.Trim(),
            CreatedBy = CurrentUserId,
            IsActive  = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.ClubUpdates.Add(update);
        await db.SaveChangesAsync();

        var author = await db.Users.FindAsync(CurrentUserId);
        return Ok(new
        {
            update.Id, update.Title, update.Content, update.CreatedAt,
            authorName = author != null ? $"{author.FirstName} {author.LastName}" : "",
        });
    }

    // DELETE /api/updates/{id} — webmaster only
    [HttpDelete("{id}")]
    [Authorize(Roles = "committee,membership,finance,webmaster")]
    public async Task<IActionResult> DeleteUpdate(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var update = await db.ClubUpdates.FindAsync(id);
        if (update is null) return NotFound();

        // Non-webmaster can only delete their own updates
        if (CurrentRole != "webmaster" && update.CreatedBy != CurrentUserId)
            return Forbid();

        update.IsActive = false; // soft delete
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

public record CreateUpdateRequest(string? Title, string Content);