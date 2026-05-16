using System.Security.Claims;
using MembersGuild.API.DTOs.Training;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/training")]
[Authorize]
public class TrainingController : ControllerBase
{
    private readonly ClubDbContextFactory _dbFactory;

    public TrainingController(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    private int CurrentUserId => int.Parse(
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole =>
        User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    private bool CanManage() =>
        CurrentRole is "coach" or "committee" or "webmaster";
    private bool CanEditTimes() =>
        CurrentRole is "coach" or "membership" or "webmaster";
    private bool IsWebmaster() =>
        CurrentRole == "webmaster";

    // ── GET /api/training/settings ───────────────────────────────────────────
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var settings = await db.ClubSettings
            .Where(s => s.Key.StartsWith("training_"))
            .ToDictionaryAsync(s => s.Key, s => s.Value);

        return Ok(new TrainingSettingsResponse(
            MetricsEnabled: settings.GetValueOrDefault(
                "training_metrics_enabled", "true") == "true",
            SetsEnabled: settings.GetValueOrDefault(
                "training_sets_enabled", "true") == "true",
            VideosEnabled: settings.GetValueOrDefault(
                "training_videos_enabled", "true") == "true",
            SetsLabel: settings.GetValueOrDefault(
                "training_sets_label", "Training Sets"),
            MetricsLabel: settings.GetValueOrDefault(
                "training_metrics_label", "Personal Bests")
        ));
    }

    // ── GET /api/training/metrics ────────────────────────────────────────────
    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var metrics = await db.TrainingMetrics
            .Where(m => m.IsActive)
            .OrderBy(m => m.Category)
            .ThenBy(m => m.DisplayOrder)
            .Select(m => new TrainingMetricResponse(
                m.Id, m.Name, m.Unit, m.Category,
                m.DisplayOrder, m.IsActive))
            .ToListAsync();

        return Ok(metrics);
    }

    // ── GET /api/training/times/mine ─────────────────────────────────────────
    [HttpGet("times/mine")]
    public async Task<IActionResult> GetMyTimes()
    {
        return await GetTimesForUser(CurrentUserId);
    }

    // ── GET /api/training/times/{userId} ────────────────────────────────────
    [HttpGet("times/{userId:int}")]
    public async Task<IActionResult> GetMemberTimes(int userId)
    {
        if (!CanEditTimes() && userId != CurrentUserId) return Forbid();
        return await GetTimesForUser(userId);
    }

    // ── PUT /api/training/times/{userId} ────────────────────────────────────
    [HttpPut("times/{userId:int}")]
    public async Task<IActionResult> UpdateMemberTimes(
        int userId, [FromBody] UpdateMemberTimesRequest request)
    {
        if (!CanEditTimes()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        foreach (var entry in request.Times)
        {
            var existing = await db.MemberTimes
                .FirstOrDefaultAsync(t =>
                    t.UserId == userId && t.MetricId == entry.MetricId);

            if (string.IsNullOrWhiteSpace(entry.Value))
            {
                // Clear the time
                if (existing is not null)
                    db.MemberTimes.Remove(existing);
            }
            else
            {
                if (existing is null)
                {
                    db.MemberTimes.Add(new MemberTime
                    {
                        UserId    = userId,
                        MetricId  = entry.MetricId,
                        Value     = entry.Value.Trim(),
                        UpdatedBy = CurrentUserId,
                        UpdatedAt = DateTime.UtcNow,
                    });
                }
                else
                {
                    existing.Value     = entry.Value.Trim();
                    existing.UpdatedBy = CurrentUserId;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await db.SaveChangesAsync();
        return Ok();
    }

    // ── GET /api/training/sets ───────────────────────────────────────────────
    [HttpGet("sets")]
    public async Task<IActionResult> GetSets(
        [FromQuery] string? difficulty,
        [FromQuery] string? category)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var query = db.SwimSets
            .Where(s => s.IsActive)
            .AsQueryable();

        if (!string.IsNullOrEmpty(difficulty))
            query = query.Where(s => s.Difficulty == difficulty);
        if (!string.IsNullOrEmpty(category))
            query = query.Where(s => s.Category == category);

        var sets = await query
            .OrderByDescending(s => s.IsSetOfWeek)
            .ThenByDescending(s => s.CreatedAt)
            .Select(s => new TrainingSetResponse(
                s.Id, s.Title, s.Description,
                s.Difficulty, s.Category, s.Content,
                s.TotalDistance, s.IsSetOfWeek, s.IsActive,
                s.CreatedAt))
            .ToListAsync();

        return Ok(sets);
    }

    // ── GET /api/training/sets/week ──────────────────────────────────────────
    [HttpGet("sets/week")]
    public async Task<IActionResult> GetSetOfWeek()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var set = await db.SwimSets
            .Where(s => s.IsSetOfWeek && s.IsActive)
            .Select(s => new TrainingSetResponse(
                s.Id, s.Title, s.Description,
                s.Difficulty, s.Category, s.Content,
                s.TotalDistance, s.IsSetOfWeek, s.IsActive,
                s.CreatedAt))
            .FirstOrDefaultAsync();

        return Ok(set);
    }

    // ── POST /api/training/sets ──────────────────────────────────────────────
    [HttpPost("sets")]
    public async Task<IActionResult> CreateSet(
        [FromBody] CreateTrainingSetRequest request)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        var set = new SwimSet
        {
            Title         = request.Title.Trim(),
            Description   = request.Description?.Trim(),
            Difficulty    = request.Difficulty,
            Category      = request.Category,
            Content       = request.Content.Trim(),
            TotalDistance = request.TotalDistance,
            CreatedBy     = CurrentUserId,
            IsActive      = true,
        };

        db.SwimSets.Add(set);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSets),
            new TrainingSetResponse(set.Id, set.Title, set.Description,
                set.Difficulty, set.Category, set.Content,
                set.TotalDistance, set.IsSetOfWeek, set.IsActive, set.CreatedAt));
    }

    // ── PUT /api/training/sets/{id} ──────────────────────────────────────────
    [HttpPut("sets/{id:int}")]
    public async Task<IActionResult> UpdateSet(
        int id, [FromBody] UpdateTrainingSetRequest request)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var set = await db.SwimSets.FindAsync(id);
        if (set is null) return NotFound();

        set.Title         = request.Title.Trim();
        set.Description   = request.Description?.Trim();
        set.Difficulty    = request.Difficulty;
        set.Category      = request.Category;
        set.Content       = request.Content.Trim();
        set.TotalDistance = request.TotalDistance;
        set.IsActive      = request.IsActive;
        set.UpdatedAt     = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(new TrainingSetResponse(set.Id, set.Title, set.Description,
            set.Difficulty, set.Category, set.Content,
            set.TotalDistance, set.IsSetOfWeek, set.IsActive, set.CreatedAt));
    }

    // ── DELETE /api/training/sets/{id} ───────────────────────────────────────
    [HttpDelete("sets/{id:int}")]
    public async Task<IActionResult> DeleteSet(int id)
    {
        if (!IsWebmaster()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var set = await db.SwimSets.FindAsync(id);
        if (set is null) return NotFound();

        set.IsActive  = false;
        set.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return NoContent();
    }

    // ── PUT /api/training/sets/{id}/week ─────────────────────────────────────
    [HttpPut("sets/{id:int}/week")]
    public async Task<IActionResult> SetOfWeek(int id)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        // Clear existing set of week
        var existing = await db.SwimSets
            .Where(s => s.IsSetOfWeek)
            .ToListAsync();
        foreach (var s in existing)
            s.IsSetOfWeek = false;

        // Set new one
        var set = await db.SwimSets.FindAsync(id);
        if (set is null) return NotFound();
        set.IsSetOfWeek = true;

        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── GET /api/training/videos ─────────────────────────────────────────────
    [HttpGet("videos")]
    public async Task<IActionResult> GetVideos(
        [FromQuery] string? category)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var query = db.TrainingVideos
            .Where(v => v.IsActive)
            .AsQueryable();

        if (!string.IsNullOrEmpty(category))
            query = query.Where(v => v.Category == category);

        var videos = await query
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new TrainingVideoResponse(
                v.Id, v.Title, v.Description, v.Category,
                v.YoutubeUrl, v.ThumbnailUrl, v.IsActive, v.CreatedAt))
            .ToListAsync();

        return Ok(videos);
    }

    // ── POST /api/training/videos ────────────────────────────────────────────
    [HttpPost("videos")]
    public async Task<IActionResult> CreateVideo(
        [FromBody] CreateTrainingVideoRequest request)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        var video = new TrainingVideo
        {
            Title        = request.Title.Trim(),
            Description  = request.Description?.Trim(),
            Category     = request.Category,
            YoutubeUrl   = request.YoutubeUrl.Trim(),
            ThumbnailUrl = ExtractYoutubeThumbnail(request.YoutubeUrl),
            CreatedBy    = CurrentUserId,
            IsActive     = true,
        };

        db.TrainingVideos.Add(video);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVideos),
            new TrainingVideoResponse(video.Id, video.Title, video.Description,
                video.Category, video.YoutubeUrl, video.ThumbnailUrl,
                video.IsActive, video.CreatedAt));
    }

    // ── PUT /api/training/videos/{id} ────────────────────────────────────────
    [HttpPut("videos/{id:int}")]
    public async Task<IActionResult> UpdateVideo(
        int id, [FromBody] UpdateTrainingVideoRequest request)
    {
        if (!CanManage()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var video = await db.TrainingVideos.FindAsync(id);
        if (video is null) return NotFound();

        video.Title        = request.Title.Trim();
        video.Description  = request.Description?.Trim();
        video.Category     = request.Category;
        video.YoutubeUrl   = request.YoutubeUrl.Trim();
        video.ThumbnailUrl = ExtractYoutubeThumbnail(request.YoutubeUrl);
        video.IsActive     = request.IsActive;

        await db.SaveChangesAsync();

        return Ok(new TrainingVideoResponse(video.Id, video.Title, video.Description,
            video.Category, video.YoutubeUrl, video.ThumbnailUrl,
            video.IsActive, video.CreatedAt));
    }

    // ── DELETE /api/training/videos/{id} ─────────────────────────────────────
    [HttpDelete("videos/{id:int}")]
    public async Task<IActionResult> DeleteVideo(int id)
    {
        if (!IsWebmaster()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var video = await db.TrainingVideos.FindAsync(id);
        if (video is null) return NotFound();

        video.IsActive = false;
        await db.SaveChangesAsync();

        return NoContent();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<IActionResult> GetTimesForUser(int userId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var metrics = await db.TrainingMetrics
            .Where(m => m.IsActive)
            .OrderBy(m => m.Category)
            .ThenBy(m => m.DisplayOrder)
            .ToListAsync();

        var times = await db.MemberTimes
            .Where(t => t.UserId == userId)
            .ToListAsync();

        var result = metrics.Select(m =>
        {
            var time = times.FirstOrDefault(t => t.MetricId == m.Id);
            return new MemberTimeResponse(
                m.Id, m.Name, m.Unit, m.Category,
                time?.Value,
                time?.UpdatedAt);
        }).ToList();

        return Ok(result);
    }

    private static string? ExtractYoutubeThumbnail(string url)
    {
        // Handle formats: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
        string? videoId = null;

        if (url.Contains("youtu.be/"))
            videoId = url.Split("youtu.be/").Last().Split('?').First();
        else if (url.Contains("v="))
            videoId = url.Split("v=").Last().Split('&').First();
        else if (url.Contains("/embed/"))
            videoId = url.Split("/embed/").Last().Split('?').First();

        return videoId is not null
            ? $"https://img.youtube.com/vi/{videoId}/hqdefault.jpg"
            : null;
    }
}