using MembersGuild.API.DTOs.Sessions;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public interface ISessionService
{
    Task<List<SessionResponse>> GetSessionsAsync(int currentUserId, DateTime? from, DateTime? to);
    Task<SessionResponse?> GetSessionAsync(int id, int currentUserId);
    Task<SessionResponse> CreateSessionAsync(CreateSessionRequest request, int createdBy);
    Task<SessionResponse?> UpdateSessionAsync(int id, UpdateSessionRequest request);
    Task<bool> DeleteSessionAsync(int id);
    Task<SessionResponse> BookSessionAsync(int sessionId, int userId, string role);
    Task<bool> UnbookSessionAsync(int sessionId, int userId, string role, int requestingUserId);
    Task<List<SessionResponse>> CreateRecurringSessionsAsync(RecurringSessionRequest request, int createdBy);
}

public class SessionService : ISessionService
{
    private readonly ClubDbContextFactory _dbFactory;

    public SessionService(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<List<SessionResponse>> GetSessionsAsync(int currentUserId, DateTime? from, DateTime? to)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var query = db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .Include(s => s.Bookings)
            .AsQueryable();

        if (from.HasValue) query = query.Where(s => s.StartTime >= from.Value);
        if (to.HasValue)   query = query.Where(s => s.StartTime <= to.Value);

        var sessions = await query
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        return sessions.Select(s => MapSession(s, currentUserId)).ToList();
    }

    public async Task<SessionResponse?> GetSessionAsync(int id, int currentUserId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var session = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == id);

        return session is null ? null : MapSession(session, currentUserId);
    }

    public async Task<SessionResponse> CreateSessionAsync(CreateSessionRequest request, int createdBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var session = new Session
        {
            Title                   = request.Title.Trim(),
            Description             = request.Description?.Trim(),
            LocationId              = request.LocationId,
            CoachId                 = request.CoachId,
            StartTime               = request.StartTime.ToUniversalTime(),
            EndTime                 = request.EndTime.ToUniversalTime(),
            Capacity                = request.Capacity,
            CreditCost              = request.CreditCost,
            RegistrationCutoffHours = request.RegistrationCutoffHours,
            CreatedBy               = createdBy,
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync();

        await db.Entry(session).Reference(s => s.Location).LoadAsync();
        await db.Entry(session).Reference(s => s.Coach).LoadAsync();

        return MapSession(session, createdBy);
    }

    public async Task<SessionResponse?> UpdateSessionAsync(int id, UpdateSessionRequest request)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var session = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (session is null) return null;

        session.Title                   = request.Title.Trim();
        session.Description             = request.Description?.Trim();
        session.LocationId              = request.LocationId;
        session.CoachId                 = request.CoachId;
        session.StartTime               = request.StartTime.ToUniversalTime();
        session.EndTime                 = request.EndTime.ToUniversalTime();
        session.Capacity                = request.Capacity;
        session.CreditCost              = request.CreditCost;
        session.RegistrationCutoffHours = request.RegistrationCutoffHours;
        session.UpdatedAt               = DateTime.UtcNow;

        await db.SaveChangesAsync();

        await db.Entry(session).Reference(s => s.Location).LoadAsync();
        await db.Entry(session).Reference(s => s.Coach).LoadAsync();

        return MapSession(session, 0);
    }

    public async Task<bool> DeleteSessionAsync(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var session = await db.Sessions.Include(s => s.Bookings).FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return false;

        // Refund credits to all booked members
        foreach (var booking in session.Bookings)
        {
            var user = await db.Users.FindAsync(booking.UserId);
            if (user is null) continue;

            user.CreditBalance += session.CreditCost;
            db.CreditTransactions.Add(new CreditTransaction
            {
                UserId          = booking.UserId,
                Amount          = session.CreditCost,
                BalanceAfter    = user.CreditBalance,
                TransactionType = TransactionTypes.SessionRefund,
                ReferenceId     = session.Id,
                ReferenceType   = "session",
                Notes           = $"Session cancelled: {session.Title}",
            });
        }

        db.Sessions.Remove(session);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<SessionResponse> BookSessionAsync(int sessionId, int userId, string role)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var session = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new InvalidOperationException("Session not found");

        if (session.IsCancelled)
            throw new InvalidOperationException("Session is cancelled");

        if (session.Bookings.Any(b => b.UserId == userId))
            throw new InvalidOperationException("Already registered for this session");

        if (session.Bookings.Count >= session.Capacity)
            throw new InvalidOperationException("Session is full");

        // Registration cutoff check
        if (DateTime.UtcNow > session.StartTime.AddHours(-session.RegistrationCutoffHours))
            throw new InvalidOperationException("Registration is closed for this session");

        var user = await db.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("User not found");

        // CATS booking limit check
        if (role == Roles.Cats)
        {
            var totalBookings = await db.SessionBookings.CountAsync(b => b.UserId == userId);
            var catsSetting = await db.ClubSettings
                .FirstOrDefaultAsync(s => s.Key == ClubSettingKeys.CatsSessionLimit);
            var limit = int.TryParse(catsSetting?.Value, out var l) ? l : 3;

            if (totalBookings >= limit)
                throw new InvalidOperationException($"CATS members are limited to {limit} sessions");
        }

        // Credit check (coaches don't use credits)
        if (role != Roles.Coach)
        {
            if (user.CreditBalance < session.CreditCost)
                throw new InvalidOperationException("Insufficient credits");

            user.CreditBalance -= session.CreditCost;
            db.CreditTransactions.Add(new CreditTransaction
            {
                UserId          = userId,
                Amount          = -session.CreditCost,
                BalanceAfter    = user.CreditBalance,
                TransactionType = TransactionTypes.SessionBooking,
                ReferenceId     = session.Id,
                ReferenceType   = "session",
                Notes           = $"Booked: {session.Title}",
            });
        }

        db.SessionBookings.Add(new SessionBooking
        {
            SessionId = sessionId,
            UserId    = userId,
        });

        await db.SaveChangesAsync();
        return MapSession(session, userId);
    }

    public async Task<bool> UnbookSessionAsync(int sessionId, int userId, string role, int requestingUserId)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var session = await db.Sessions
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session is null) return false;

        var booking = session.Bookings.FirstOrDefault(b => b.UserId == userId);
        if (booking is null) return false;

        // Only staff or the booking owner can unbook
        var isStaff = Roles.IsStaff(role);
        if (!isStaff && requestingUserId != userId) return false;

        db.SessionBookings.Remove(booking);

        // Refund credit
        if (role != Roles.Coach)
        {
            var user = await db.Users.FindAsync(userId);
            if (user is not null)
            {
                user.CreditBalance += session.CreditCost;
                db.CreditTransactions.Add(new CreditTransaction
                {
                    UserId          = userId,
                    Amount          = session.CreditCost,
                    BalanceAfter    = user.CreditBalance,
                    TransactionType = TransactionTypes.SessionRefund,
                    ReferenceId     = session.Id,
                    ReferenceType   = "session",
                    Notes           = $"Unregistered: {session.Title}",
                });
            }
        }

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<SessionResponse>> CreateRecurringSessionsAsync(
        RecurringSessionRequest request, int createdBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var groupId = Guid.NewGuid();
        var sessions = new List<Session>();
        var current = request.StartDate;

        while (current <= request.EndDate)
        {
            if (request.DaysOfWeek.Contains(current.DayOfWeek))
            {
                var startDt = current.ToDateTime(request.StartTime).ToUniversalTime();
                var endDt   = current.ToDateTime(request.EndTime).ToUniversalTime();

                sessions.Add(new Session
                {
                    Title                   = request.Title.Trim(),
                    Description             = request.Description?.Trim(),
                    LocationId              = request.LocationId,
                    CoachId                 = request.CoachId,
                    StartTime               = startDt,
                    EndTime                 = endDt,
                    Capacity                = request.Capacity,
                    CreditCost              = request.CreditCost,
                    RegistrationCutoffHours = request.RegistrationCutoffHours,
                    IsRecurring             = true,
                    RecurringGroupId        = groupId,
                    CreatedBy               = createdBy,
                });
            }
            current = current.AddDays(1);
        }

        db.Sessions.AddRange(sessions);
        await db.SaveChangesAsync();

        return sessions.Select(s => MapSession(s, createdBy)).ToList();
    }

    private static SessionResponse MapSession(Session s, int currentUserId) => new(
        s.Id, s.Title, s.Description,
        s.LocationId, s.Location?.Name,
        s.CoachId, s.Coach is null ? null : $"{s.Coach.FirstName} {s.Coach.LastName}",
        s.StartTime, s.EndTime,
        s.Capacity, s.CreditCost, s.RegistrationCutoffHours,
        s.IsCancelled, s.IsRecurring,
        s.Bookings?.Count ?? 0,
        s.Bookings?.Any(b => b.UserId == currentUserId) ?? false
    );
}