import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getClubConfig, buildCssVariables } from '@/lib/club-config'
import ClubNav from '@/components/layout/ClubNav'
import MembersGuildContactForm from '@/components/MembersGuildContactForm'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)
  return {
    title: config ? `${config.displayName} | MembersGuild` : 'Members Guild',
    manifest: '/manifest.json',
  }
}

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)

  if (!config) return <PlatformLandingPage />

  const cssVars = buildCssVariables(config)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ClubNav config={config} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <div className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {config.displayName} · Powered by{' '}
          <a href="https://membersguild.com.au" className="hover:underline">MembersGuild</a>
        </div>
      </div>
    </>
  )
}

function PlatformLandingPage() {
  const navy   = '#1a56db'
  const dark   = '#0a0a0f'
  const card   = '#0a0f1a'
  const muted  = '#94a3b8'
  const border = '#0f1f35'

  const features = [
    { icon: '🏊', title: 'Session Booking',      desc: 'Members register for sessions online. Credits deduct automatically. Capacity enforced. No spreadsheets.' },
    { icon: '💳', title: 'Credit System',         desc: 'Members purchase credit packs. Finance confirms bank transfers. Credits release instantly.' },
    { icon: '📋', title: 'Attendance Tracking',   desc: 'Coaches mark attendance with QR codes. Credits refunded automatically. Full audit trail.' },
    { icon: '👥', title: 'Member Management',     desc: 'Full member database with role-based access. Emergency contacts. Credit history. One-tap call.' },
    { icon: '🏪', title: 'Club Shop',             desc: 'Sell credit packs and merchandise. Finance confirms payments. Orders tracked end to end.' },
    { icon: '📱', title: 'Mobile Ready',           desc: 'Installs on iPhone and Android from the browser. No App Store needed. Works offline.' },
  ]

  const standardPlans = [
    {
      name: 'Small Club', members: 'Under 50 members', price: '$49',
      features: ['All standard features', 'Unlimited sessions', 'Member portal', 'Email support'],
      highlight: false,
    },
    {
      name: 'Medium Club', members: '50–150 members', price: '$99',
      features: ['Everything in Small', 'Priority support', 'Custom branding', 'Attendance reports'],
      highlight: true,
    },
    {
      name: 'Large Club', members: '150+ members', price: '$199',
      features: ['Everything in Medium', 'Dedicated onboarding', 'CSV member import', 'Phone support'],
      highlight: false,
    },
  ]

  return (
    <div style={{ background: dark, color: '#fff', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── DG Nav ──────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 2.5rem',
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <a href="https://digitalguildhall.com.au" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fff', fontWeight: 600 }}>
            Digital <span style={{ color: '#d97706' }}>Guildhall</span>
          </span>
        </a>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {[['#features', 'Features'], ['#pricing', 'Pricing'], ['#start', 'Register']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: muted, textDecoration: 'none', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {label}
            </a>
          ))}
          <a href="https://forestden.membersguild.com.au" target="_blank" rel="noopener noreferrer" style={{
            padding: '0.5rem 1.25rem', borderRadius: '0.4rem',
            background: navy, color: '#fff', textDecoration: 'none',
            fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em',
          }}>
            Live Demo →
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8rem 2rem 4rem', textAlign: 'center',
        background: `radial-gradient(ellipse at 40% 30%, #0a1535 0%, ${dark} 65%)`,
      }}>
        <div style={{ maxWidth: '52rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '2rem' }}>
            A Digital Guildhall Product
          </p>

          <img
            src="/logo.png"
            alt="Members Guild"
            style={{ height: '9rem', objectFit: 'contain', margin: '0 auto 2rem', display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
          />

          <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 1.5rem' }}>
            MEMBERS GUILD
          </h1>

          <div style={{ width: '3rem', height: '2px', background: navy, margin: '0 auto 2rem' }} />

          <p style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 200, color: '#fff', marginBottom: '1.25rem', letterSpacing: '0.05em' }}>
            The membership platform clubs actually want.
          </p>

          <p style={{ fontSize: '1.05rem', color: muted, lineHeight: 1.8, maxWidth: '36rem', margin: '0 auto 3rem' }}>
            Session booking, credit management, attendance tracking, and member management —
            all in one white-labelled portal your club installs in a day.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#start" style={{
              padding: '0.875rem 2rem', borderRadius: '0.5rem',
              background: navy, color: '#fff', textDecoration: 'none',
              fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              Register Your Club →
            </a>
            <a href="https://forestden.membersguild.com.au" target="_blank" rel="noopener noreferrer" style={{
              padding: '0.875rem 2rem', borderRadius: '0.5rem',
              border: `1px solid ${border}`, color: '#fff', textDecoration: 'none',
              fontSize: '0.85rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              View Live Demo
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginTop: '4rem', paddingTop: '3rem', borderTop: `1px solid ${border}`, flexWrap: 'wrap' }}>
            {[['1 day', 'To go live'], ['$199', 'One-off setup'], ['$49', 'From per month']].map(([val, lbl]) => (
              <div key={lbl} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{val}</div>
                <div style={{ fontSize: '0.8rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.25rem' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section id="features" style={{ padding: '7rem 2rem', background: card, borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '1rem' }}>
              What's Included
            </p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 300, color: '#fff' }}>
              Everything your club needs. Nothing it doesn't.
            </h2>
            <p style={{ color: muted, marginTop: '1rem', fontSize: '0.95rem' }}>
              Built from real feedback from real clubs. Every feature earns its place.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {features.map(f => (
              <div key={f.title} style={{ background: dark, border: `1px solid ${border}`, borderRadius: '0.75rem', padding: '1.75rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: muted, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────── */}
      <section style={{ padding: '7rem 2rem', borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '1rem' }}>
            How It Works
          </p>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 300, color: '#fff', marginBottom: '4rem' }}>
            Your club portal, live in one day.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', textAlign: 'left' }}>
            {[
              ['01', 'Register your club', 'Fill in the form below. I\'ll be in touch within 24 hours to confirm your plan and kick off setup.'],
              ['02', 'I handle everything', 'Domain config, white-labelling, member import, payment setup. Your portal is ready before the next training session.'],
              ['03', 'You handle the sport', 'Hand out login links to your members. Sessions go live. Credits flow. You never touch a spreadsheet again.'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: navy, minWidth: '3rem', flexShrink: 0 }}>{num}</div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.4rem' }}>{title}</h3>
                  <p style={{ fontSize: '0.875rem', color: muted, lineHeight: 1.7 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────── */}
      <section id="pricing" style={{ padding: '7rem 2rem', background: card, borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '1rem' }}>
              Simple Pricing
            </p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 300, color: '#fff' }}>
              Pay for what you need. Upgrade as you grow.
            </h2>
            <p style={{ color: muted, marginTop: '1rem', fontSize: '0.95rem' }}>
              All plans include every feature. Plus a one-time $199 setup fee. No lock-in contracts.
            </p>
          </div>

          {/* Standard tier */}
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: muted, marginBottom: '1.5rem' }}>
            Standard Plan
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {standardPlans.map(plan => (
              <div key={plan.name} style={{
                background: plan.highlight ? '#060d1f' : dark,
                border: `1px solid ${plan.highlight ? navy : border}`,
                borderRadius: '1rem', padding: '2rem', position: 'relative',
              }}>
                {plan.highlight && (
                  <div style={{
                    position: 'absolute', top: '-0.75rem', left: '50%', transform: 'translateX(-50%)',
                    background: navy, color: '#fff', fontSize: '0.65rem', fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '0.2rem 0.75rem', borderRadius: '9999px', whiteSpace: 'nowrap',
                  }}>
                    Most Popular
                  </div>
                )}
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>{plan.name}</h3>
                <p style={{ fontSize: '0.8rem', color: muted, marginBottom: '1.5rem' }}>{plan.members}</p>
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: plan.highlight ? '#60a5fa' : '#fff' }}>{plan.price}</span>
                  <span style={{ fontSize: '0.85rem', color: muted, marginLeft: '0.4rem' }}>/month</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: '0.85rem', color: muted, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ color: navy, flexShrink: 0 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a href="#start" style={{
                  display: 'block', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center',
                  background: plan.highlight ? navy : 'transparent',
                  border: `1px solid ${plan.highlight ? navy : border}`,
                  color: '#fff', textDecoration: 'none', fontSize: '0.85rem',
                  fontWeight: plan.highlight ? 600 : 400,
                }}>
                  Get Started →
                </a>
              </div>
            ))}
          </div>

          {/* Premium tier */}
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: muted, marginBottom: '1.5rem' }}>
            Premium Plan
          </p>
          <div style={{
            background: dark, border: `1px solid ${border}`, borderRadius: '1rem', padding: '2rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem',
          }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: 0 }}>Unlimited Members</h3>
                <span style={{
                  fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: '#1c1c1c', color: muted, padding: '0.2rem 0.6rem', borderRadius: '9999px',
                  border: `1px solid ${border}`,
                }}>
                  Coming Soon
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: muted, lineHeight: 1.7, margin: 0 }}>
                Built for ambitious clubs ready to scale. Everything in Standard, plus next-generation features currently in development.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              {['Everything in Standard', 'File storage & sharing', 'Club chat services', 'Dedicated account manager'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: muted }}>
                  <span style={{ color: '#334155' }}>✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: '#334155' }}>
            All plans include a $199 one-time setup fee · No lock-in contracts · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────── */}
      <section id="start" style={{ padding: '7rem 2rem', borderTop: `1px solid ${border}` }}>
        <div style={{ maxWidth: '40rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '1rem' }}>
              Register Your Club
            </p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 300, color: '#fff', marginBottom: '1rem' }}>
              Ready to ditch the spreadsheets?
            </h2>
            <p style={{ color: muted, fontSize: '0.95rem', lineHeight: 1.8 }}>
              Fill in your details and I'll be in touch within 24 hours to get your club portal set up.
            </p>
          </div>
          <MembersGuildContactForm />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer style={{
        padding: '2rem 2.5rem', borderTop: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '1rem', background: '#060a10',
      }}>
        <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0 }}>
          © {new Date().getFullYear()}{' '}
          <span style={{ color: '#60a5fa' }}>Members Guild</span>
          {' '}· Built for clubs · Trusted by members
        </p>
        <a href="https://digitalguildhall.com.au" style={{ fontSize: '0.8rem', color: '#334155', textDecoration: 'none' }}>
          Part of <span style={{ color: '#d97706' }}>Digital Guildhall</span> →
        </a>
      </footer>
    </div>
  )
}