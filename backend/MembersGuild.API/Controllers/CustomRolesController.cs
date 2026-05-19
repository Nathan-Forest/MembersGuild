using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize(Roles = "webmaster")]
public class CustomRolesController : ControllerBase
{
    private readonly ClubDbContextFactory _dbFactory;
    public CustomRolesController(ClubDbContextFactory dbFactory) => _dbFactory = dbFactory;

    private static readonly string[] LockedRoles = ["cats", "member", "coach", "webmaster"];
    private static readonly string[] BaseRoles   = ["committee", "membership", "finance"];

    // GET /api/roles — all roles (custom + base info)
    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var custom = await db.ClubCustomRoles
            .Where(r => r.IsActive)
            .OrderBy(r => r.DisplayLabel)
            .ToListAsync();

        return Ok(new
        {
            baseRoles  = BaseRoles,
            lockedRoles = LockedRoles,
            customRoles = custom.Select(r => new
            {
                r.Id, r.RoleName, r.DisplayLabel,
                inheritsFrom = r.BaseRoles,
            })
        });
    }

    // POST /api/roles — create custom role
    [HttpPost]
    public async Task<IActionResult> CreateRole([FromBody] CreateCustomRoleRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.RoleName) || string.IsNullOrWhiteSpace(req.DisplayLabel))
            return BadRequest(new { error = "Role name and label are required" });

        var roleName = req.RoleName.ToLower().Trim().Replace(" ", "_");

        if (LockedRoles.Contains(roleName) || BaseRoles.Contains(roleName))
            return BadRequest(new { error = "Cannot override a built-in role" });

        if (req.InheritsFrom.Length == 0)
            return BadRequest(new { error = "Must inherit from at least one base role" });

        var invalidBases = req.InheritsFrom.Except(BaseRoles).ToList();
        if (invalidBases.Any())
            return BadRequest(new { error = $"Invalid base roles: {string.Join(", ", invalidBases)}" });

        await using var db = _dbFactory.CreateForCurrentClub();

        if (await db.ClubCustomRoles.AnyAsync(r => r.RoleName == roleName))
            return Conflict(new { error = "A role with this name already exists" });

        var role = new ClubCustomRole
        {
            RoleName     = roleName,
            DisplayLabel = req.DisplayLabel.Trim(),
            InheritsFrom = string.Join(",", req.InheritsFrom),
        };

        db.ClubCustomRoles.Add(role);
        await db.SaveChangesAsync();

        return Ok(new { role.Id, role.RoleName, role.DisplayLabel, inheritsFrom = role.BaseRoles });
    }

    // DELETE /api/roles/{id} — soft delete
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var role = await db.ClubCustomRoles.FindAsync(id);
        if (role is null) return NotFound();

        // Check if any members have this role
        var inUse = await db.Users.AnyAsync(u => u.Role == role.RoleName);
        if (inUse)
            return BadRequest(new { error = "Cannot delete a role that is assigned to members" });

        role.IsActive = false;
        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

public record CreateCustomRoleRequest(
    string   RoleName,
    string   DisplayLabel,
    string[] InheritsFrom
);