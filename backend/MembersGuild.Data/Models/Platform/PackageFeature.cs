namespace MembersGuild.Data.Models.Platform;

public class PackageFeature
{
    public int    Id         { get; set; }
    public int    PackageId  { get; set; }
    public string FeatureKey { get; set; } = string.Empty;

    public Package? Package { get; set; }
}