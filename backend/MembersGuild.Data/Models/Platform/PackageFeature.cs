namespace MembersGuild.Data.Models.Platform;

public class PackageFeature
{
    public int Id { get; set; }
    public int PackageId { get; set; }
    public Package Package { get; set; } = null!;
    public string FeatureKey { get; set; } = "";
}