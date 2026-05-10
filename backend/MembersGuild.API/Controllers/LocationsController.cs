using MembersGuild.API.DTOs.Locations;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/locations")]
[Authorize]
public class LocationsController : ControllerBase
{
    private readonly ClubDbContextFactory _dbFactory;

    public LocationsController(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    private string CurrentRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    private bool CanManage() =>
        CurrentRole is "coach" or "committee" or "webmaster";

    /// <summary>GET /api/locations — all roles</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var locations = await db.Locations
            .OrderBy(l => l.Name)
            .Select(l => new LocationResponse(l.Id, l.Name, l.Address, l.Phone, l.Capacity, l.IsActive))
            .ToListAsync();
        return Ok(locations);
    }

    /// <summary>GET /api/locations/active — active only, for session dropdowns</summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var locations = await db.Locations
            .Where(l => l.IsActive)
            .OrderBy(l => l.Name)
            .Select(l => new LocationResponse(l.Id, l.Name, l.Address, l.Phone, l.Capacity, l.IsActive))
            .ToListAsync();
        return Ok(locations);
    }

    /// <summary>POST /api/locations — Coach/Committee/Webmaster</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLocationRequest request)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var location = new Location
        {
            Name     = request.Name.Trim(),
            Address  = request.Address?.Trim(),
            Phone    = request.Phone?.Trim(),
            Capacity = request.Capacity,
            IsActive = true,
        };

        db.Locations.Add(location);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new LocationResponse(
            location.Id, location.Name, location.Address,
            location.Phone, location.Capacity, location.IsActive));
    }

    /// <summary>PUT /api/locations/{id} — Coach/Committee/Webmaster</summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateLocationRequest request)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var location = await db.Locations.FindAsync(id);
        if (location is null) return NotFound();

        location.Name     = request.Name.Trim();
        location.Address  = request.Address?.Trim();
        location.Phone    = request.Phone?.Trim();
        location.Capacity = request.Capacity;
        location.IsActive = request.IsActive;

        await db.SaveChangesAsync();

        return Ok(new LocationResponse(
            location.Id, location.Name, location.Address,
            location.Phone, location.Capacity, location.IsActive));
    }

    /// <summary>DELETE /api/locations/{id} — Webmaster only</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (CurrentRole != "webmaster") return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var location = await db.Locations.FindAsync(id);
        if (location is null) return NotFound();

        // Soft delete — keeps historical session data intact
        location.IsActive = false;
        await db.SaveChangesAsync();

        return NoContent();
    }
}