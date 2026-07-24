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

    private bool HasRole(params string[] roles) =>
     roles.Any(r => User.IsInRole(r));

    private bool CanManage() => HasRole("coach", "committee", "webmaster");

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
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
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

        location.Name = request.Name.Trim();
        location.Address = request.Address?.Trim();
        location.Phone = request.Phone?.Trim();
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
        if (!User.IsInRole("webmaster")) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var location = await db.Locations.FindAsync(id);
        if (location is null) return NotFound();

        // Soft delete — keeps historical session data intact
        location.IsActive = false;
        await db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>GET /api/locations/{locationId}/pools — all roles</summary>
    [HttpGet("{locationId:int}/pools")]
    public async Task<IActionResult> GetPools(int locationId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var pools = await db.Pools
            .Where(p => p.LocationId == locationId)
            .OrderBy(p => p.Name)
            .Select(p => new PoolResponse(p.Id, p.LocationId, p.Name, p.HireFeePerHourPerLane, p.IsActive))
            .ToListAsync();
        return Ok(pools);
    }

    /// <summary>GET /api/locations/{locationId}/pools/active — active only, for session/attendance dropdowns</summary>
    [HttpGet("{locationId:int}/pools/active")]
    public async Task<IActionResult> GetActivePools(int locationId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var pools = await db.Pools
            .Where(p => p.LocationId == locationId && p.IsActive)
            .OrderBy(p => p.Name)
            .Select(p => new PoolResponse(p.Id, p.LocationId, p.Name, p.HireFeePerHourPerLane, p.IsActive))
            .ToListAsync();
        return Ok(pools);
    }

    /// <summary>POST /api/locations/{locationId}/pools — Webmaster only</summary>
    [HttpPost("{locationId:int}/pools")]
    public async Task<IActionResult> CreatePool(int locationId, [FromBody] CreatePoolRequest request)
    {
        if (!User.IsInRole("webmaster")) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var location = await db.Locations.FindAsync(locationId);
        if (location is null) return NotFound(new { error = "Location not found" });

        var pool = new Pool
        {
            LocationId = locationId,
            Name = request.Name.Trim(),
            HireFeePerHourPerLane = request.HireFeePerHourPerLane,
            IsActive = true,
        };

        db.Pools.Add(pool);
        await db.SaveChangesAsync();

        return Ok(new PoolResponse(pool.Id, pool.LocationId, pool.Name, pool.HireFeePerHourPerLane, pool.IsActive));
    }

    /// <summary>PUT /api/locations/pools/{id} — Webmaster only</summary>
    [HttpPut("pools/{id:int}")]
    public async Task<IActionResult> UpdatePool(int id, [FromBody] UpdatePoolRequest request)
    {
        if (!User.IsInRole("webmaster")) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var pool = await db.Pools.FindAsync(id);
        if (pool is null) return NotFound();

        pool.Name = request.Name.Trim();
        pool.HireFeePerHourPerLane = request.HireFeePerHourPerLane;
        pool.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        return Ok(new PoolResponse(pool.Id, pool.LocationId, pool.Name, pool.HireFeePerHourPerLane, pool.IsActive));
    }

    /// <summary>DELETE /api/locations/pools/{id} — Webmaster only (soft delete)</summary>
    [HttpDelete("pools/{id:int}")]
    public async Task<IActionResult> DeletePool(int id)
    {
        if (!User.IsInRole("webmaster")) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var pool = await db.Pools.FindAsync(id);
        if (pool is null) return NotFound();

        pool.IsActive = false;
        await db.SaveChangesAsync();
        return NoContent();
    }
}