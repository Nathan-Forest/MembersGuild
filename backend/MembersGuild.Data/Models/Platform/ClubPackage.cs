namespace MembersGuild.Data.Models.Platform;

public class ClubPackage
{
    public int       Id        { get; set; }
    public int       ClubId    { get; set; }
    public int       PackageId { get; set; }
    public DateTime  StartDate { get; set; } = DateTime.UtcNow;
    public DateTime? EndDate   { get; set; }

    public Package? Package { get; set; }
}