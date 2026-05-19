namespace MembersGuild.Data.Models.Club;

public class ClubCustomRole
{
    public int    Id           { get; set; }
    public string RoleName     { get; set; } = "";   // "president"
    public string DisplayLabel { get; set; } = "";   // "President"
    public string InheritsFrom { get; set; } = "";   // "committee,membership,finance"
    public bool   IsActive     { get; set; } = true;
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;

    public string[] BaseRoles =>
        InheritsFrom.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}