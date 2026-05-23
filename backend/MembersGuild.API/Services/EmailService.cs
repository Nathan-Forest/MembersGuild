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

  // ── Branded email shell ────────────────────────────────────────────────────
  private static string BuildHtml(
      string content,
      string clubName,
      string clubSlug,
      string? logoUrl = null,
      string primaryColor = "#1a2744")
  {
    var portalUrl = $"https://{clubSlug}.membersguild.com.au";

    var logoHtml = !string.IsNullOrEmpty(logoUrl)
        ? $@"<img src='{logoUrl}' alt='{clubName}' 
                      style='height:64px;max-width:200px;object-fit:contain;display:block;margin:0 auto;' />"
        : $@"<p style='color:#ffffff;font-size:20px;font-weight:700;
                           letter-spacing:0.05em;margin:0;'>{clubName}</p>";

    return $@"<!DOCTYPE html>
<html>
<body style='margin:0;padding:0;background:#f4f4f5;
             font-family:-apple-system,BlinkMacSystemFont,""Segoe UI"",sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0'
         style='background:#f4f4f5;padding:40px 20px;'>
    <tr><td align='center'>
      <table width='600' cellpadding='0' cellspacing='0'
             style='background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;'>

        <!-- Header -->
        <tr>
          <td style='background:{primaryColor};padding:32px;text-align:center;'>
            {logoHtml}
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style='padding:40px;color:#111827;font-size:15px;line-height:1.6;'>
            {content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style='background:#f9fafb;padding:24px;text-align:center;
                     border-top:1px solid #e5e7eb;'>
            <p style='color:#9ca3af;font-size:12px;margin:0;'>
              Sent by <strong>{clubName}</strong> &middot;
              <a href='{portalUrl}' style='color:#9ca3af;'>{portalUrl}</a>
            </p>
            <p style='color:#d1d5db;font-size:11px;margin:6px 0 0;'>
              Powered by MembersGuild
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";
  }

  // ── Shared button helper ───────────────────────────────────────────────────
  private static string ActionButton(string url, string label, string color = "#1a2744") =>
      $@"<p style='margin:32px 0;text-align:center;'>
             <a href='{url}'
                style='background:{color};color:#ffffff;padding:14px 32px;
                       border-radius:8px;text-decoration:none;font-weight:600;
                       font-size:15px;display:inline-block;'>
               {label}
             </a>
           </p>";

  // ── CATS notification ──────────────────────────────────────────────────────
  public async Task SendCatsNotificationAsync(
      IEnumerable<string> recipients,
      string clubName,
      string clubSlug,
      string firstName,
      string lastName,
      string email,
      string? phone,
      int initialCredits,
      IEnumerable<(string Label, string Answer)> answers,
      string? logoUrl = null,
      string primaryColor = "#1a2744")
  {
    var answersHtml = answers.Any()
        ? $@"<h3 style='color:#1a2744;margin-top:24px;'>Their responses</h3>
                 <ul style='line-height:1.8;color:#374151;'>
                 {string.Join("", answers.Select(a =>
                 $"<li><strong>{a.Label}:</strong> {a.Answer}</li>"))}</ul>"
        : "";

    var portalUrl = $"https://{clubSlug}.membersguild.com.au";

    var content = $@"
            <h2 style='color:#111827;margin-top:0;'>New Come &amp; Try Sign-Up</h2>
            <table style='width:100%;border-collapse:collapse;font-size:14px;'>
              <tr style='background:#f9fafb;'>
                <td style='padding:10px 12px;color:#6b7280;width:130px;border-radius:4px;'>Name</td>
                <td style='padding:10px 12px;font-weight:600;'>{firstName} {lastName}</td>
              </tr>
              <tr>
                <td style='padding:10px 12px;color:#6b7280;'>Email</td>
                <td style='padding:10px 12px;'><a href='mailto:{email}' style='color:{primaryColor};'>{email}</a></td>
              </tr>
              {(!string.IsNullOrEmpty(phone) ? $@"
              <tr style='background:#f9fafb;'>
                <td style='padding:10px 12px;color:#6b7280;'>Phone</td>
                <td style='padding:10px 12px;'>{phone}</td>
              </tr>" : "")}
              <tr {(string.IsNullOrEmpty(phone) ? "style='background:#f9fafb;'" : "")}>
                <td style='padding:10px 12px;color:#6b7280;'>Credits</td>
                <td style='padding:10px 12px;'>{initialCredits} granted</td>
              </tr>
            </table>
            {answersHtml}
            {ActionButton(portalUrl, "View in Portal", primaryColor)}";

    var html = BuildHtml(content, clubName, clubSlug, logoUrl, primaryColor);

    var message = new EmailMessage
    {
      From = $"{clubName} <{From}>",
      Subject = $"New CATS Sign-Up — {firstName} {lastName}",
      HtmlBody = html
    };
    foreach (var r in recipients) message.To.Add(r);
    await _resend.EmailSendAsync(message);
  }

  // ── Welcome email ──────────────────────────────────────────────────────────
  public async Task SendWelcomeEmailAsync(
      string recipientEmail,
      string firstName,
      string clubName,
      string clubSlug,
      string subjectTemplate,
      string bodyTemplate,
      string? password = null,
      string? logoUrl = null,
      string primaryColor = "#1a2744")
  {
    var portalUrl = $"https://{clubSlug}.membersguild.com.au";

    if (string.IsNullOrEmpty(password))
      bodyTemplate = string.Join('\n', bodyTemplate
          .Split('\n')
          .Where(l => !l.Contains("{{password}}")));

    var subject = subjectTemplate.Replace("{{clubName}}", clubName);
    var body = bodyTemplate
        .Replace("{{firstName}}", firstName)
        .Replace("{{clubName}}", clubName)
        .Replace("{{email}}", recipientEmail)
        .Replace("{{password}}", password ?? "")
        .Replace("{{portalUrl}}", portalUrl);

    var paragraphs = string.Join("", body.Split('\n')
        .Where(l => !string.IsNullOrWhiteSpace(l))
        .Select(l => $"<p style='margin:0 0 16px;color:#374151;'>{l}</p>"));

    var content = $@"
    <h2 style='color:#111827;margin-top:0;'>Welcome to {clubName}!</h2>
    {paragraphs}
    {ActionButton(portalUrl, "Access My Portal", primaryColor)}
    <p style='color:#9ca3af;font-size:13px;text-align:center;'>
      Need help getting started? Visit our
      <a href='{portalUrl}/support' style='color:{primaryColor};'>Help Centre</a>
      for guides and FAQs.
    </p>";

    var html = BuildHtml(content, clubName, clubSlug, logoUrl, primaryColor);

    var message = new EmailMessage
    {
      From = $"{clubName} <{From}>",
      Subject = subject,
      HtmlBody = html,
    };
    message.To.Add(recipientEmail);
    await _resend.EmailSendAsync(message);
  }

  // ── Password reset ─────────────────────────────────────────────────────────
  public async Task SendPasswordResetAsync(
      string recipientEmail,
      string firstName,
      string clubName,
      string clubSlug,
      string token,
      string? logoUrl = null,
      string primaryColor = "#1a2744")
  {
    var resetUrl = $"https://{clubSlug}.membersguild.com.au/reset-password?token={token}";

    var content = $@"
            <h2 style='color:#111827;margin-top:0;'>Reset Your Password</h2>
            <p style='color:#374151;'>Hi {firstName},</p>
            <p style='color:#374151;'>We received a request to reset your {clubName} password.
               Click the button below to set a new one.</p>
            {ActionButton(resetUrl, "Reset Password", primaryColor)}
            <p style='color:#9ca3af;font-size:13px;'>
              This link expires in <strong>1 hour</strong>.
              If you didn't request this, you can safely ignore this email.
            </p>";

    var html = BuildHtml(content, clubName, clubSlug, logoUrl, primaryColor);

    var message = new EmailMessage
    {
      From = $"{clubName} <{From}>",
      Subject = $"Reset your {clubName} password",
      HtmlBody = html,
    };
    message.To.Add(recipientEmail);
    await _resend.EmailSendAsync(message);
  }

  // ── Resend welcome ─────────────────────────────────────────────────────────
  public async Task SendWelcomeResendAsync(
      string recipientEmail,
      string firstName,
      string clubName,
      string clubSlug,
      string resetUrl,
      string? logoUrl = null,
      string primaryColor = "#1a2744")
  {
    var content = $@"
            <h2 style='color:#111827;margin-top:0;'>Welcome to {clubName}!</h2>
            <p style='color:#374151;'>Hi {firstName},</p>
            <p style='color:#374151;'>Your account is ready. Click below to set your
               password and access your member portal.</p>
            {ActionButton(resetUrl, "Access My Account", primaryColor)}
            <p style='color:#9ca3af;font-size:13px;'>
              This link expires in <strong>24 hours</strong>.
            </p>";

    var html = BuildHtml(content, clubName, clubSlug, logoUrl, primaryColor);

    var message = new EmailMessage
    {
      From = $"{clubName} <{From}>",
      Subject = $"Welcome to {clubName} — Access your account",
      HtmlBody = html,
    };
    message.To.Add(recipientEmail);
    await _resend.EmailSendAsync(message);
  }

  // ── Support request ────────────────────────────────────────────────────────
  public async Task SendSupportRequestAsync(
      string clubName, string clubSlug,
      string category, string name, string email,
      string description, string? startedAt,
      string? device, bool guideRead)
  {
    var content = $@"
            <h2 style='color:#111827;margin-top:0;'>Support Request</h2>
            <table style='width:100%;border-collapse:collapse;font-size:14px;'>
              <tr style='background:#f9fafb;'>
                <td style='padding:10px 12px;color:#6b7280;width:130px;'>Club</td>
                <td style='padding:10px 12px;font-weight:600;'>{clubName} ({clubSlug})</td>
              </tr>
              <tr>
                <td style='padding:10px 12px;color:#6b7280;'>Category</td>
                <td style='padding:10px 12px;'>{category}</td>
              </tr>
              <tr style='background:#f9fafb;'>
                <td style='padding:10px 12px;color:#6b7280;'>Name</td>
                <td style='padding:10px 12px;'>{name}</td>
              </tr>
              <tr>
                <td style='padding:10px 12px;color:#6b7280;'>Email</td>
                <td style='padding:10px 12px;'>
                  <a href='mailto:{email}' style='color:#1a2744;'>{email}</a>
                </td>
              </tr>
              <tr style='background:#f9fafb;'>
                <td style='padding:10px 12px;color:#6b7280;'>Guide Read</td>
                <td style='padding:10px 12px;'>{(guideRead ? "✓ Yes" : "✗ No")}</td>
              </tr>
              <tr>
                <td style='padding:10px 12px;color:#6b7280;'>Started</td>
                <td style='padding:10px 12px;'>{startedAt ?? "Not specified"}</td>
              </tr>
              <tr style='background:#f9fafb;'>
                <td style='padding:10px 12px;color:#6b7280;'>Device</td>
                <td style='padding:10px 12px;'>{device ?? "Not specified"}</td>
              </tr>
            </table>
            <div style='margin-top:24px;padding:16px;background:#f5f5f5;border-radius:8px;'>
              <p style='color:#374151;font-weight:600;margin:0 0 8px;'>Problem Description</p>
              <p style='color:#555;margin:0;white-space:pre-wrap;'>{description}</p>
            </div>";

    var html = BuildHtml(content, clubName, clubSlug);

    var message = new EmailMessage
    {
      From = From,
      Subject = $"[Support] {clubName} — {category}",
      HtmlBody = html,
    };
    message.To.Add("support@membersguild.com.au");
    await _resend.EmailSendAsync(message);
  }
}