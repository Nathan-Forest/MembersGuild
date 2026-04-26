using MembersGuild.API.DTOs.Members;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/members")]
[Authorize]
public class MembersController : ControllerBase
{
    private readonly IMemberService _members;

    public MembersController(IMemberService members)
    {
        _members = members;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole => User.FindFirst("role")?.Value ?? "";

    /// <summary>GET /api/members — staff only</summary>
    [HttpGet]
    public async Task<IActionResult> GetMembers([FromQuery] string? search, [FromQuery] string? credits)
    {
        if (!IsStaff()) return Forbid();
        return Ok(await _members.GetMembersAsync(search, credits));
    }

    /// <summary>GET /api/members/stats</summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        if (!IsStaff()) return Forbid();
        return Ok(await _members.GetStatsAsync());
    }

    /// <summary>GET /api/members/{id}</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetMember(int id)
    {
        // Members can view their own profile
        if (!IsStaff() && CurrentUserId != id) return Forbid();

        var member = await _members.GetMemberAsync(id);
        return member is null ? NotFound() : Ok(member);
    }

    /// <summary>POST /api/members — Membership/Webmaster only</summary>
    [HttpPost]
    public async Task<IActionResult> CreateMember([FromBody] CreateMemberRequest request)
    {
        if (!CanManageMembers()) return Forbid();

        try
        {
            var member = await _members.CreateMemberAsync(request, CurrentUserId);
            return CreatedAtAction(nameof(GetMember), new { id = member.Id }, member);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    /// <summary>PUT /api/members/{id} — Membership/Webmaster only</summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateMember(int id, [FromBody] UpdateMemberRequest request)
    {
        // Members can edit their own profile
        if (!CanManageMembers() && CurrentUserId != id) return Forbid();

        var member = await _members.UpdateMemberAsync(id, request);
        return member is null ? NotFound() : Ok(member);
    }

    /// <summary>PUT /api/members/{id}/role — Membership/Webmaster only</summary>
    [HttpPut("{id:int}/role")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRoleRequest request)
    {
        if (!CanManageMembers()) return Forbid();

        var success = await _members.UpdateRoleAsync(id, request.Role, CurrentUserId);
        return success ? Ok() : NotFound();
    }

    /// <summary>PUT /api/members/{id}/active — Membership/Webmaster only</summary>
    [HttpPut("{id:int}/active")]
    public async Task<IActionResult> SetActive(int id, [FromBody] bool isActive)
    {
        if (!CanManageMembers()) return Forbid();

        var success = await _members.SetActiveAsync(id, isActive);
        return success ? Ok() : NotFound();
    }

    /// <summary>POST /api/members/{id}/reset-password — Webmaster only</summary>
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        if (CurrentRole != "webmaster") return Forbid();

        var temp = await _members.ResetPasswordAsync(id);
        return Ok(new ResetPasswordResponse(temp));
    }

    /// <summary>DELETE /api/members/{id} — Webmaster only</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteMember(int id)
    {
        if (CurrentRole != "webmaster") return Forbid();

        var success = await _members.DeleteMemberAsync(id, CurrentUserId);
        if (!success) return id == CurrentUserId
            ? BadRequest(new { error = "Cannot delete your own account" })
            : NotFound();

        return NoContent();
    }

    private bool IsStaff() => CurrentRole is "coach" or "committee" or "membership" or "finance" or "webmaster";
    private bool CanManageMembers() => CurrentRole is "membership" or "webmaster";
}