using Resend;

namespace MembersGuild.API.Services;

public class EmailService
{
    private readonly IResend _resend;
    private readonly IConfiguration _config;

    public EmailService(IResend resend, IConfiguration config)
    {
        _resend = resend;
        _config = config;
    }

    private string From => _config["Resend:FromAddress"] ?? "noreply@membersguild.com.au";

    // Notification to membership officer / club captain
    public async Task SendCatsNotificationAsync(
        IEnumerable<string> recipients,
        string clubName,
        string clubSlug,
        string firstName,
        string lastName,
        string email,
        string? phone,
        int initialCredits,
        IEnumerable<(string Label, string Answer)> answers)
    {
        var answersHtml = answers.Any()
            ? $@"<h3 style='color:#1a2744;'>Their responses:</h3>
                 <ul style='line-height:1.8;'>
                 {string.Join("", answers.Select(a =>
                     $"<li><strong>{a.Label}:</strong> {a.Answer}</li>"))}</ul>"
            : "";

        var portalUrl = $"https://{clubSlug}.membersguild.com.au";

        var html = $@"
            <div style='font-family:sans-serif;max-width:600px;'>
              <h2 style='color:#1a2744;'>New CATS Sign-Up</h2>
              <h3 style='color:#1a2744;'>Member Details</h3>
              <ul style='line-height:1.8;'>
                <li><strong>Name:</strong> {firstName} {lastName}</li>
                <li><strong>Email:</strong> {email}</li>
                {(!string.IsNullOrEmpty(phone) ? $"<li><strong>Phone:</strong> {phone}</li>" : "")}
                <li><strong>Credits granted:</strong> {initialCredits}</li>
              </ul>
              {answersHtml}
              <p>They can log in at <a href='{portalUrl}'>{portalUrl}</a></p>
              <hr style='border:none;border-top:1px solid #eee;margin:24px 0;'/>
              <p style='color:#999;font-size:12px;'>Sent by MembersGuild · {clubName}</p>
            </div>";

        var message = new EmailMessage
        {
            From = $"{clubName} <{From}>",
            Subject = $"New CATS Sign-Up — {firstName} {lastName}",
            HtmlBody = html
        };

        foreach (var r in recipients)
            message.To.Add(r);

        await _resend.EmailSendAsync(message);
    }

    // Welcome email to the new member
    public async Task SendWelcomeEmailAsync(
    string recipientEmail,
    string firstName,
    string clubName,
    string clubSlug,
    string subjectTemplate,
    string bodyTemplate,
    string? password = null)       // ← optional, null for self-registered
    {
        var portalUrl = $"https://{clubSlug}.membersguild.com.au";

        // Remove the password line entirely if no password was generated
        if (string.IsNullOrEmpty(password))
        {
            bodyTemplate = string.Join('\n', bodyTemplate
                .Split('\n')
                .Where(l => !l.Contains("{{password}}")));
        }

        var subject = subjectTemplate.Replace("{{clubName}}", clubName);

        var body = bodyTemplate
            .Replace("{{firstName}}", firstName)
            .Replace("{{clubName}}", clubName)
            .Replace("{{email}}", recipientEmail)
            .Replace("{{password}}", password ?? "")
            .Replace("{{portalUrl}}", portalUrl);

        var html = $@"
        <div style='font-family:sans-serif;max-width:600px;'>
          {string.Join("", body.Split('\n')
                  .Select(l => $"<p style='line-height:1.6;color:#333;'>{l}</p>"))}
          <hr style='border:none;border-top:1px solid #eee;margin:24px 0;'/>
          <p style='color:#999;font-size:12px;'>Sent by MembersGuild · {clubName}</p>
        </div>";

        var message = new EmailMessage
        {
            From = $"{clubName} <{From}>",
            Subject = subject,
            HtmlBody = html,
        };
        message.To.Add(recipientEmail);

        await _resend.EmailSendAsync(message);
    }

    public async Task SendPasswordResetAsync(
    string recipientEmail,
    string firstName,
    string clubName,
    string clubSlug,
    string token)
    {
        var resetUrl = $"https://{clubSlug}.membersguild.com.au/reset-password?token={token}";

        var html = $@"
        <div style='font-family:sans-serif;max-width:600px;'>
          <h2 style='color:#1a2744;'>Reset Your Password</h2>
          <p style='color:#333;'>Hi {firstName},</p>
          <p style='color:#333;'>We received a request to reset your {clubName} password.
             Click the button below to set a new one:</p>
          <p style='margin:32px 0;'>
            <a href='{resetUrl}'
               style='background:#1a2744;color:white;padding:14px 28px;border-radius:8px;
                      text-decoration:none;font-weight:600;font-size:15px;'>
              Reset Password
            </a>
          </p>
          <p style='color:#888;font-size:13px;'>
            This link expires in <strong>1 hour</strong>.
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style='border:none;border-top:1px solid #eee;margin:24px 0;'/>
          <p style='color:#999;font-size:12px;'>Sent by MembersGuild · {clubName}</p>
        </div>";

        var message = new EmailMessage
        {
            From = $"{clubName} <{From}>",
            Subject = $"Reset your {clubName} password",
            HtmlBody = html,
        };
        message.To.Add(recipientEmail);

        await _resend.EmailSendAsync(message);
    }

    public async Task SendWelcomeResendAsync(
    string recipientEmail,
    string firstName,
    string clubName,
    string clubSlug,
    string resetUrl)
    {
        var html = $@"
        <div style='font-family:sans-serif;max-width:600px;'>
          <h2 style='color:#1a2744;'>Welcome to {clubName}!</h2>
          <p style='color:#333;'>Hi {firstName},</p>
          <p style='color:#333;'>Your account is ready. Click below to set your password and access your member portal:</p>
          <p style='margin:32px 0;'>
            <a href='{resetUrl}'
               style='background:#1a2744;color:white;padding:14px 28px;border-radius:8px;
                      text-decoration:none;font-weight:600;font-size:15px;'>
              Access My Account
            </a>
          </p>
          <p style='color:#888;font-size:13px;'>This link expires in <strong>24 hours</strong>.</p>
          <hr style='border:none;border-top:1px solid #eee;margin:24px 0;'/>
          <p style='color:#999;font-size:12px;'>Sent by MembersGuild · {clubName}</p>
        </div>";

        var message = new EmailMessage
        {
            From = $"{clubName} <{From}>",
            Subject = $"Welcome to {clubName} — Access your account",
            HtmlBody = html,
        };
        message.To.Add(recipientEmail);

        await _resend.EmailSendAsync(message);
    }

    public async Task SendSupportRequestAsync(
    string clubName, string clubSlug,
    string category, string name, string email,
    string description, string? startedAt,
    string? device, bool guideRead)
    {
        var body = $"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a2744">Support Request — {clubName}</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;color:#666;width:140px">Club</td>
                <td style="padding:8px;font-weight:600">{clubName} ({clubSlug})</td></tr>
            <tr style="background:#f9f9f9">
                <td style="padding:8px;color:#666">Category</td>
                <td style="padding:8px;font-weight:600">{category}</td></tr>
            <tr><td style="padding:8px;color:#666">Name</td>
                <td style="padding:8px">{name}</td></tr>
            <tr style="background:#f9f9f9">
                <td style="padding:8px;color:#666">Email</td>
                <td style="padding:8px"><a href="mailto:{email}">{email}</a></td></tr>
            <tr><td style="padding:8px;color:#666">Guide Read</td>
                <td style="padding:8px">{(guideRead ? "✓ Yes" : "✗ No")}</td></tr>
            <tr style="background:#f9f9f9">
                <td style="padding:8px;color:#666">Started</td>
                <td style="padding:8px">{startedAt ?? "Not specified"}</td></tr>
            <tr><td style="padding:8px;color:#666">Device</td>
                <td style="padding:8px">{device ?? "Not specified"}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px">
            <p style="color:#333;font-weight:600;margin:0 0 8px">Problem Description:</p>
            <p style="color:#555;margin:0;white-space:pre-wrap">{description}</p>
          </div>
          <p style="color:#999;font-size:12px;margin-top:24px">
            Sent by MembersGuild · {clubName}
          </p>
        </div>
        """;

        var message = new EmailMessage
        {
            From = From,
            Subject = $"[Support] {clubName} — {category}",
            HtmlBody = body,
        };
        message.To.Add("support@membersguild.com.au");

        await _resend.EmailSendAsync(message); ;
    }
}