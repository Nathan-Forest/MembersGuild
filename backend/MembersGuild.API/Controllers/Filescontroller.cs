using Microsoft.AspNetCore.Mvc;
 
namespace MembersGuild.API.Controllers;
 
/// <summary>
/// Serves uploaded files (shop images, profile photos, training assets).
/// Path structure: /api/files/{clubSlug}/{folder}/{filename}
/// e.g. /api/files/bsm/shop/abc123.jpg
///      /api/files/bsm/members/def456.png
/// Files are stored on disk at /uploads/{clubSlug}/{folder}/{filename}
/// No auth required — images are public (URLs are unguessable GUIDs).
/// </summary>
[ApiController]
[Route("api/files")]
public class FilesController(IWebHostEnvironment env) : ControllerBase
{
    private static readonly Dictionary<string, string> ContentTypes = new()
    {
        [".jpg"]  = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"]  = "image/png",
        [".gif"]  = "image/gif",
        [".webp"] = "image/webp",
    };
 
    [HttpGet("{clubSlug}/{**filePath}")]
    public IActionResult GetFile(string clubSlug, string filePath)
    {
        var uploadsRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, "uploads"));
        var fullPath    = Path.GetFullPath(Path.Combine(uploadsRoot, clubSlug, filePath));
 
        // Path traversal guard — must stay inside uploads directory
        if (!fullPath.StartsWith(uploadsRoot + Path.DirectorySeparatorChar))
            return BadRequest(new { error = "Invalid path." });
 
        if (!System.IO.File.Exists(fullPath))
            return NotFound();
 
        var ext = Path.GetExtension(fullPath).ToLowerInvariant();
        if (!ContentTypes.TryGetValue(ext, out var contentType))
            return BadRequest(new { error = "Unsupported file type." });
 
        // Cache for 7 days — images don't change (new upload = new GUID filename)
        Response.Headers.CacheControl = "public, max-age=604800";
 
        return PhysicalFile(fullPath, contentType);
    }
}