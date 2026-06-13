using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Platform;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public class SquareService
{
    private readonly IConfiguration _config;
    private readonly PlatformDbContext _platformDb;
    private readonly ILogger<SquareService> _logger;

    public SquareService(
        IConfiguration config,
        PlatformDbContext platformDb,
        ILogger<SquareService> logger)
    {
        _config = config;
        _platformDb = platformDb;
        _logger = logger;
    }

    // ── OAuth URL ─────────────────────────────────────────────────────────────

    public string BuildAuthUrl(string clubSlug)
    {
        var appId = _config["Square:AppId"]
            ?? throw new InvalidOperationException("Square AppId not configured");

        var state = GenerateStateToken(clubSlug);
        var scopes = "PAYMENTS_WRITE PAYMENTS_READ ORDERS_WRITE CUSTOMERS_WRITE MERCHANT_PROFILE_READ";
        var redirectUri = "https://membersguild.com.au/api/square/callback";
        var baseUrl = IsSandbox()
            ? "https://connect.squareupsandbox.com/oauth2/authorize"
            : "https://connect.squareup.com/oauth2/authorize";

        return $"{baseUrl}?client_id={appId}" +
               $"&scope={Uri.EscapeDataString(scopes)}" +
               $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
               $"&state={Uri.EscapeDataString(state)}" +
               $"&session=false";
    }

    // ── Exchange code for tokens ──────────────────────────────────────────────

    public async Task<SquareConnection> ExchangeCodeAsync(string code, int clubId)
    {
        var appId = _config["Square:AppId"]!;
        var appSecret = _config["Square:AppSecret"]!;
        var redirectUri = "https://membersguild.com.au/api/square/callback";
        var baseUrl = IsSandbox()
            ? "https://connect.squareupsandbox.com"
            : "https://connect.squareup.com";

        using var http = new HttpClient();
        var body = new
        {
            client_id = appId,
            client_secret = appSecret,
            code,
            redirect_uri = redirectUri,
            grant_type = "authorization_code"
        };

        var response = await http.PostAsJsonAsync($"{baseUrl}/oauth2/token", body);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Square token exchange failed: {json}");

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var accessToken  = root.GetProperty("access_token").GetString()!;
        var refreshToken = root.GetProperty("refresh_token").GetString()!;
        var merchantId   = root.GetProperty("merchant_id").GetString()!;
        var expiresAt    = root.GetProperty("expires_at").GetString()!;

        // Fetch merchant name + default location
        var (merchantName, locationId) = await GetMerchantInfoAsync(accessToken, merchantId);

        // Upsert connection
        var existing = await _platformDb.SquareConnections
            .FirstOrDefaultAsync(s => s.ClubId == clubId);

        if (existing is null)
        {
            existing = new SquareConnection { ClubId = clubId };
            _platformDb.SquareConnections.Add(existing);
        }

        existing.MerchantId             = merchantId;
        existing.MerchantName           = merchantName;
        existing.LocationId             = locationId;
        existing.AccessTokenEncrypted   = Encrypt(accessToken);
        existing.RefreshTokenEncrypted  = Encrypt(refreshToken);
        existing.TokenExpiresAt         = DateTime.Parse(expiresAt).ToUniversalTime();
        existing.IsActive               = true;
        existing.UpdatedAt              = DateTime.UtcNow;

        await _platformDb.SaveChangesAsync();

        _logger.LogInformation(
            "Square connected for club {ClubId} — merchant: {MerchantName}",
            clubId, merchantName);

        return existing;
    }

    // ── Get merchant info ─────────────────────────────────────────────────────

    private async Task<(string merchantName, string locationId)> GetMerchantInfoAsync(
        string accessToken, string merchantId)
    {
        var baseUrl = IsSandbox()
            ? "https://connect.squareupsandbox.com"
            : "https://connect.squareup.com";

        using var http = new HttpClient();
        http.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");
        http.DefaultRequestHeaders.Add("Square-Version", "2024-01-18");

        // Get merchant name
        var merchantResp = await http.GetAsync($"{baseUrl}/v2/merchants/{merchantId}");
        var merchantJson = await merchantResp.Content.ReadAsStringAsync();
        using var merchantDoc = JsonDocument.Parse(merchantJson);
        var merchantName = merchantDoc.RootElement
            .GetProperty("merchant")
            .GetProperty("business_name")
            .GetString() ?? "Unknown";

        // Get first active location
        var locResp = await http.GetAsync($"{baseUrl}/v2/locations");
        var locJson = await locResp.Content.ReadAsStringAsync();
        using var locDoc = JsonDocument.Parse(locJson);
        var locations = locDoc.RootElement.GetProperty("locations");
        var locationId = locations.EnumerateArray()
            .FirstOrDefault(l => l.GetProperty("status").GetString() == "ACTIVE")
            .GetProperty("id").GetString() ?? "";

        return (merchantName, locationId);
    }

    // ── Get decrypted access token ────────────────────────────────────────────

    public async Task<string> GetAccessTokenAsync(int clubId)
    {
        var connection = await _platformDb.SquareConnections
            .FirstOrDefaultAsync(s => s.ClubId == clubId && s.IsActive)
            ?? throw new InvalidOperationException("Square not connected for this club");

        return Decrypt(connection.AccessTokenEncrypted);
    }

    // ── Connection status ─────────────────────────────────────────────────────

    public async Task<object?> GetStatusAsync(int clubId)
    {
        var connection = await _platformDb.SquareConnections
            .FirstOrDefaultAsync(s => s.ClubId == clubId && s.IsActive);

        if (connection is null) return null;

        return new
        {
            connected    = true,
            merchantName = connection.MerchantName,
            merchantId   = connection.MerchantId,
            locationId   = connection.LocationId,
            connectedAt  = connection.ConnectedAt,
            expiresAt    = connection.TokenExpiresAt,
        };
    }

    // ── Disconnect ────────────────────────────────────────────────────────────

    public async Task DisconnectAsync(int clubId)
    {
        var connection = await _platformDb.SquareConnections
            .FirstOrDefaultAsync(s => s.ClubId == clubId);

        if (connection is null) return;

        // Revoke token with Square
        try
        {
            var appSecret = _config["Square:AppSecret"]!;
            var accessToken = Decrypt(connection.AccessTokenEncrypted);
            var baseUrl = IsSandbox()
                ? "https://connect.squareupsandbox.com"
                : "https://connect.squareup.com";

            using var http = new HttpClient();
            http.DefaultRequestHeaders.Add("Authorization", $"Client {appSecret}");
            http.DefaultRequestHeaders.Add("Square-Version", "2024-01-18");

            await http.PostAsJsonAsync($"{baseUrl}/oauth2/revoke", new
            {
                client_id    = _config["Square:AppId"],
                access_token = accessToken,
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to revoke Square token: {Message}", ex.Message);
        }

        connection.IsActive   = false;
        connection.UpdatedAt  = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();
    }

    // ── State token (CSRF) ────────────────────────────────────────────────────

    public string GenerateStateToken(string clubSlug)
    {
        var secret = _config["JWT_SECRET"] ?? "fallback";
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = $"{clubSlug}:{timestamp}";
        var key = Encoding.UTF8.GetBytes(secret);
        using var hmac = new System.Security.Cryptography.HMACSHA256(key);
        var sig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLower();
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(payload)) + "." + sig;
    }

    public (string clubSlug, bool valid) ValidateStateToken(string state)
    {
        try
        {
            var parts = state.Split('.');
            if (parts.Length != 2) return ("", false);

            var payload   = Encoding.UTF8.GetString(Convert.FromBase64String(parts[0]));
            var signature = parts[1];
            var secret    = _config["JWT_SECRET"] ?? "fallback";
            var key       = Encoding.UTF8.GetBytes(secret);

            using var hmac = new System.Security.Cryptography.HMACSHA256(key);
            var expected = Convert.ToHexString(
                hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLower();

            if (expected != signature) return ("", false);

            var segments  = payload.Split(':');
            var clubSlug  = segments[0];
            var timestamp = long.Parse(segments[1]);

            // State token expires after 10 minutes
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() - timestamp > 600)
                return ("", false);

            return (clubSlug, true);
        }
        catch { return ("", false); }
    }

    // ── Encryption ────────────────────────────────────────────────────────────

    private string Encrypt(string plaintext)
    {
        var key = GetEncryptionKey();
        using var aes = Aes.Create();
        aes.Key = key;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipherBytes = encryptor.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);

        // Prepend IV to ciphertext
        var result = new byte[aes.IV.Length + cipherBytes.Length];
        aes.IV.CopyTo(result, 0);
        cipherBytes.CopyTo(result, aes.IV.Length);

        return Convert.ToBase64String(result);
    }

    private string Decrypt(string ciphertext)
    {
        var key = GetEncryptionKey();
        var data = Convert.FromBase64String(ciphertext);

        using var aes = Aes.Create();
        aes.Key = key;

        // Extract IV (first 16 bytes)
        var iv = data[..16];
        var cipher = data[16..];
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        var plainBytes = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
        return Encoding.UTF8.GetString(plainBytes);
    }

    private byte[] GetEncryptionKey()
    {
        var keyHex = _config["Square:EncryptionKey"]
            ?? throw new InvalidOperationException("Square encryption key not configured");
        return Convert.FromHexString(keyHex);
    }

    private bool IsSandbox() =>
        _config["Square:Environment"]?.ToLower() != "production";
}