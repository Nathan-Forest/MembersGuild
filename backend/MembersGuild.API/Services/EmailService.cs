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
        string bodyTemplate)
    {
        var portalUrl = $"https://{clubSlug}.membersguild.com.au";

        var subject = subjectTemplate
            .Replace("{{clubName}}", clubName);

        var body = bodyTemplate
            .Replace("{{firstName}}", firstName)
            .Replace("{{clubName}}", clubName)
            .Replace("{{email}}", recipientEmail)
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
            HtmlBody = html
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
}