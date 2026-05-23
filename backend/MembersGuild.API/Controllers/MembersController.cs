using MembersGuild.API.DTOs.Members;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Security.Cryptography;
using MembersGuild.Data.Models.Club;
using MembersGuild.Data.Contexts;
using Microsoft.EntityFrameworkCore;
using MembersGuild.Data.Models.Platform;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/members")]
[Authorize]
public class MembersController : ControllerBase
{
    private readonly IMemberService _members;
    private readonly ClubDbContextFactory _dbFactory;
    private readonly ClubContext _clubContext;
    private readonly PlatformDbContext _platformDb;    
    private readonly PlatformService _platformSvc;

    public MembersController(
        IMemberService members,
        ClubDbContextFactory dbFactory,
        ClubContext clubContext,
        PlatformDbContext platformDb,     // ← add
        PlatformService platformSvc)    // ← add
    {
        _members = members;
        _dbFactory = dbFactory;
        _clubContext = clubContext;
        _platformDb = platformDb;          // ← add
        _platformSvc = platformSvc;         // ← add
    }

    private int CurrentUserId => int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

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

        // Check member cap
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club != null)
        {
            var cap = await _platformSvc.GetMemberCapAsync(club.Id);
            await using var db = _dbFactory.CreateForCurrentClub();
            var activeCount = await db.Users.CountAsync(u => u.IsActive);

            if (activeCount >= cap)
                return BadRequest(new
                {
                    error = $"Member limit reached. Your plan allows up to {cap} members. " +
                             "Please upgrade your plan to add more members."
                });
        }

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

    [HttpPost("import")]
    [Authorize(Roles = "membership,webmaster")]
    public async Task<IActionResult> ImportMembers([FromBody] List<ImportMemberRequest> requests)
    {
        if (requests == null || requests.Count == 0)
            return BadRequest(new { error = "No data provided" });
        if (requests.Count > 500)
            return BadRequest(new { error = "Maximum 500 members per import" });

        var result = await _members.ImportMembersAsync(requests, CurrentUserId);
        return Ok(result);
    }

    // POST /api/members/resend-welcome
    [HttpPost("resend-welcome")]
    [Authorize(Roles = "webmaster,membership")]
    public async Task<IActionResult> ResendWelcome(
        [FromBody] ResendWelcomeRequest req,
        [FromServices] EmailService emailService)
    {
        if (req.UserIds is null || req.UserIds.Count == 0)
            return BadRequest(new { error = "No members selected" });

        await using var db = _dbFactory.CreateForCurrentClub();

        var users = await db.Users
            .Where(u => req.UserIds.Contains(u.Id) && u.IsActive)
            .ToListAsync();

        if (users.Count == 0)
            return BadRequest(new { error = "No valid members found" });

        // Generate a reset token per user and send a welcome+reset email
        foreach (var user in users)
        {
            // Invalidate existing tokens
            var existing = await db.PasswordResetTokens
                .Where(t => t.UserId == user.Id && t.UsedAt == null)
                .ToListAsync();
            db.PasswordResetTokens.RemoveRange(existing);

            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
                .Replace("+", "-").Replace("/", "_").Replace("=", "");

            db.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddHours(24), // 24hr for welcome context
            });
            await db.SaveChangesAsync();

            var resetUrl = $"https://{_clubContext.Slug}.membersguild.com.au/reset-password?token={token}";
            var capturedUser = user;
            var capturedToken = resetUrl;

            _ = Task.Run(async () =>
            {
                try
                {
                    await emailService.SendWelcomeResendAsync(
                        capturedUser.Email,
                        capturedUser.FirstName,
                        _clubContext.DisplayName,
                        _clubContext.Slug,
                        capturedToken,
                        logoUrl: _clubContext.LogoUrl,
                        primaryColor: _clubContext.PrimaryColor);
                }
                catch { }
            });
        }

        return Ok(new { success = true, sent = users.Count });
    }

    private bool HasRole(params string[] roles) =>
        roles.Any(r => User.IsInRole(r));
    private bool IsStaff() =>
    HasRole("coach", "committee", "membership", "finance", "webmaster");
    private bool CanManageMembers() => HasRole("membership", "webmaster");
}