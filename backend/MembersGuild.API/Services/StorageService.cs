using Amazon.S3;
using Amazon.S3.Model;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace MembersGuild.API.Services;

public class StorageService
{
    private readonly IAmazonS3    _s3;
    private readonly string       _bucket;
    private readonly string       _region;

    public StorageService(IAmazonS3 s3, IConfiguration config)
    {
        _s3     = s3;
        _bucket = config["AWS:BucketName"] ?? "membersguild-assets";
        _region = config["AWS:Region"]     ?? "ap-southeast-2";
    }

    public string GetPublicUrl(string key)
        => $"https://{_bucket}.s3.{_region}.amazonaws.com/{key}";

    public async Task<string> UploadAsync(byte[] data, string key, string contentType)
    {
        using var stream = new MemoryStream(data);
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName  = _bucket,
            Key         = key,
            InputStream = stream,
            ContentType = contentType,
            CannedACL   = S3CannedACL.PublicRead,
        });
        return GetPublicUrl(key);
    }

    // Upload logo and auto-generate PWA icons — returns (logoUrl, icon192Url, icon512Url)
    public async Task<(string Logo, string Icon192, string Icon512)> UploadLogoWithIconsAsync(
        byte[] imageData, string slug)
    {
        var logoUrl   = await UploadAsync(imageData, $"clubs/{slug}/logo.png",       "image/png");
        var icon192   = await ResizeAndUploadAsync(imageData, $"clubs/{slug}/icons/icon-192.png", 192);
        var icon512   = await ResizeAndUploadAsync(imageData, $"clubs/{slug}/icons/icon-512.png", 512);

        return (logoUrl, icon192, icon512);
    }

    // Upload a member profile photo — returns public URL
    public async Task<string> UploadProfilePhotoAsync(byte[] imageData, string slug, int userId)
        => await UploadAsync(imageData, $"clubs/{slug}/members/{userId}/photo.png", "image/png");

    private async Task<string> ResizeAndUploadAsync(byte[] imageData, string key, int size)
    {
        using var input  = new MemoryStream(imageData);
        using var output = new MemoryStream();

        using (var image = await Image.LoadAsync(input))
        {
            image.Mutate(ctx => ctx.Resize(new ResizeOptions
            {
                Size = new Size(size, size),
                Mode = ResizeMode.Pad,
            }));
            await image.SaveAsPngAsync(output);
        }

        return await UploadAsync(output.ToArray(), key, "image/png");
    }
}