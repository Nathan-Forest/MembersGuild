namespace MembersGuild.Data.Models.Club;

public class Location
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public int? Capacity { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Session> Sessions { get; set; } = new List<Session>();
}

public class Session
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? LocationId { get; set; }
    public int? CoachId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int Capacity { get; set; } = 25;
    public int CreditCost { get; set; } = 1;
    public int RegistrationCutoffHours { get; set; } = 24;
    public bool IsCancelled { get; set; } = false;
    public bool IsRecurring { get; set; } = false;
    public Guid? RecurringGroupId { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Location? Location { get; set; }
    public User? Coach { get; set; }
    public ICollection<SessionBooking> Bookings { get; set; } = new List<SessionBooking>();
    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
}

public class SessionBooking
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Session? Session { get; set; }
    public User? User { get; set; }
}

public class AttendanceRecord
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Status codes: attended, absent, late, noshow, nsba
    /// noshow  = registered, didn't show, didn't advise → no credit refund
    /// nsba    = no show but advised → credit refunded
    /// </summary>
    public string Status { get; set; } = string.Empty;

    public bool CreditRefunded { get; set; } = false;
    public string? Notes { get; set; }
    public int? MarkedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Session? Session { get; set; }
    public User? User { get; set; }
}

public static class AttendanceStatus
{
    public const string Attended = "attended";
    public const string Absent   = "absent";
    public const string Late     = "late";
    public const string NoShow   = "noshow";  // no credit refund
    public const string Nsba     = "nsba";    // no show but advised → refund
}
