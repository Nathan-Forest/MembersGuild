export default function RegisterSuccessPage() {
  const navy   = '#1a56db'
  const dark   = '#0a0a0f'
  const card   = '#0a0f1a'
  const muted  = '#94a3b8'
  const border = '#0f1f35'

  return (
    <div style={{ background: dark, minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '480px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎉</div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '1rem' }}>
          Payment Confirmed
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, color: '#fff', marginBottom: '1rem' }}>
          Welcome to MembersGuild.
        </h1>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '1rem', padding: '2rem', margin: '2rem 0', textAlign: 'left' }}>
          <p style={{ fontSize: '0.875rem', color: muted, lineHeight: 1.8, margin: 0 }}>
            ✓ Payment received — $199 setup fee<br />
            ✓ Confirmation email sent to your inbox<br />
            ✓ Your portal will be live within 24 hours<br />
            ✓ Login credentials will arrive by email
          </p>
        </div>
        <p style={{ fontSize: '0.875rem', color: muted, marginBottom: '2rem' }}>
          Questions? Email{' '}
          <a href="mailto:hello@membersguild.com.au" style={{ color: '#60a5fa', textDecoration: 'none' }}>
            hello@membersguild.com.au
          </a>
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '0.75rem 2rem', borderRadius: '0.5rem',
          background: navy, color: '#fff', textDecoration: 'none',
          fontSize: '0.875rem', fontWeight: 600,
        }}>
          ← Back to Home
        </a>
      </div>
    </div>
  )
}