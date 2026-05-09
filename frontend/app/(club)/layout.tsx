import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getClubConfig, buildCssVariables } from '@/lib/club-config'
import ClubNav from '@/components/layout/ClubNav'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)

  return {
    title: config ? `${config.displayName} | MembersGuild` : 'MembersGuild — Built for clubs. Trusted by members.',
    manifest: '/manifest.json',
    themeColor: config?.primaryColor ?? '#1a56db',
  }
}

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const config = await getClubConfig(host)

  // No club slug — root domain. Show platform landing page.
  if (!config) {
    return <PlatformLandingPage />
  }

  const cssVars = buildCssVariables(config)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ClubNav config={config} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {config.displayName} · Powered by{' '}
          <a href="https://membersguild.com.au" className="hover:underline">MembersGuild</a>
        </footer>
      </div>
    </>
  )
}

// ── Platform landing page ──────────────────────────────────────────────────────

function PlatformLandingPage() {
  const features = [
    {
      icon: '🏊',
      title: 'Session Booking',
      description: 'Members register for sessions online. Credits deduct automatically. Capacity enforced. No spreadsheets.',
    },
    {
      icon: '💳',
      title: 'Credit System',
      description: 'Members purchase credit packs. Finance confirms bank transfers. Credits release instantly.',
    },
    {
      icon: '📋',
      title: 'Attendance Tracking',
      description: 'Coaches mark attendance with QR codes. NSBA credits refunded automatically. Full audit trail.',
    },
    {
      icon: '👥',
      title: 'Member Management',
      description: 'Full member database with role-based access. Emergency contacts. Credit history. One-tap call.',
    },
    {
      icon: '🏪',
      title: 'Swim Shop',
      description: 'Sell credit packs and merchandise. Finance confirms payments. Orders tracked end to end.',
    },
    {
      icon: '📱',
      title: 'Mobile Ready',
      description: 'Installs on iPhone and Android from the browser. No App Store needed. Works offline.',
    },
  ]

  const pricing = [
    {
      name: 'Small Club',
      members: 'Under 50 members',
      price: '$49',
      color: '#1a56db',
      features: ['All standard features', 'Unlimited sessions', 'Member portal', 'Email support'],
    },
    {
      name: 'Medium Club',
      members: '50–150 members',
      price: '$99',
      color: '#1e429f',
      features: ['Everything in Small', 'Priority support', 'Custom branding', 'Attendance reports'],
      featured: true,
    },
    {
      name: 'Large Club',
      members: '150+ members',
      price: '$199',
      color: '#1e3a8a',
      features: ['Everything in Medium', 'Dedicated onboarding', 'CSV member import', 'Phone support'],
    },
  ]

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', sans-serif; background: #0c1220; color: #e2e8f0; }
          .display { font-family: 'Cormorant Garamond', serif; }
          
          .hero {
            min-height: 100vh;
            background: linear-gradient(135deg, #0c1220 0%, #0f1d35 50%, #0c1220 100%);
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
          }
          .hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(26,86,219,0.15) 0%, transparent 70%);
          }

          nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5rem 2rem;
            position: relative;
            z-index: 10;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .nav-logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            text-decoration: none;
          }

          .nav-logo-mark {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #1a56db, #1e429f);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
          }

          .nav-logo-text {
            font-family: 'Cormorant Garamond', serif;
            font-size: 1.25rem;
            font-weight: 600;
            color: #f1f5f9;
            letter-spacing: 0.02em;
          }

          .nav-cta {
            background: rgba(26,86,219,0.15);
            border: 1px solid rgba(26,86,219,0.4);
            color: #93c5fd;
            padding: 0.5rem 1.25rem;
            border-radius: 6px;
            font-size: 0.875rem;
            text-decoration: none;
            transition: all 0.2s;
          }
          .nav-cta:hover { background: rgba(26,86,219,0.3); color: #bfdbfe; }

          .hero-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 4rem 2rem;
            position: relative;
            z-index: 10;
          }

          .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(26,86,219,0.12);
            border: 1px solid rgba(26,86,219,0.3);
            color: #93c5fd;
            font-size: 0.8rem;
            font-weight: 500;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            padding: 0.375rem 1rem;
            border-radius: 100px;
            margin-bottom: 2rem;
          }

          .hero-title {
            font-family: 'Cormorant Garamond', serif;
            font-size: clamp(3rem, 8vw, 6rem);
            font-weight: 700;
            line-height: 1.05;
            color: #f8fafc;
            margin-bottom: 1.5rem;
            letter-spacing: -0.01em;
          }

          .hero-title span {
            background: linear-gradient(135deg, #60a5fa, #93c5fd);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .hero-sub {
            font-size: 1.25rem;
            color: #94a3b8;
            max-width: 560px;
            line-height: 1.7;
            margin-bottom: 2.5rem;
            font-weight: 300;
          }

          .hero-actions {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            justify-content: center;
          }

          .btn-primary {
            background: #1a56db;
            color: white;
            padding: 0.875rem 2rem;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.2s;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .btn-primary:hover { background: #1648c7; transform: translateY(-1px); }

          .btn-ghost {
            background: rgba(255,255,255,0.05);
            color: #cbd5e1;
            padding: 0.875rem 2rem;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 500;
            text-decoration: none;
            border: 1px solid rgba(255,255,255,0.1);
            transition: all 0.2s;
          }
          .btn-ghost:hover { background: rgba(255,255,255,0.09); }

          .hero-stats {
            display: flex;
            gap: 3rem;
            margin-top: 4rem;
            padding-top: 3rem;
            border-top: 1px solid rgba(255,255,255,0.06);
          }
          .stat { text-align: center; }
          .stat-value {
            font-family: 'Cormorant Garamond', serif;
            font-size: 2.5rem;
            font-weight: 700;
            color: #f1f5f9;
          }
          .stat-label { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }

          section { padding: 6rem 2rem; }

          .section-inner { max-width: 1100px; margin: 0 auto; }

          .section-label {
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #60a5fa;
            margin-bottom: 1rem;
          }

          .section-title {
            font-family: 'Cormorant Garamond', serif;
            font-size: clamp(2rem, 4vw, 3rem);
            font-weight: 700;
            color: #f1f5f9;
            line-height: 1.15;
            margin-bottom: 1rem;
          }

          .section-sub {
            color: #94a3b8;
            font-size: 1.05rem;
            line-height: 1.7;
            max-width: 560px;
            font-weight: 300;
          }

          .features-section { background: #0a1020; }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-top: 3rem;
          }

          .feature-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: 1.75rem;
            transition: all 0.2s;
          }
          .feature-card:hover {
            background: rgba(255,255,255,0.05);
            border-color: rgba(26,86,219,0.3);
            transform: translateY(-2px);
          }

          .feature-icon {
            font-size: 1.75rem;
            margin-bottom: 1rem;
          }

          .feature-title {
            font-size: 1rem;
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 0.5rem;
          }

          .feature-desc {
            font-size: 0.9rem;
            color: #64748b;
            line-height: 1.65;
          }

          .pricing-section { background: #0c1220; }

          .pricing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-top: 3rem;
          }

          .pricing-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 16px;
            padding: 2rem;
            position: relative;
          }

          .pricing-card.featured {
            background: rgba(26,86,219,0.1);
            border-color: rgba(26,86,219,0.4);
          }

          .featured-badge {
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #1a56db;
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 0.25rem 0.875rem;
            border-radius: 100px;
            white-space: nowrap;
          }

          .pricing-name {
            font-size: 1rem;
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 0.25rem;
          }

          .pricing-members {
            font-size: 0.8rem;
            color: #64748b;
            margin-bottom: 1.5rem;
          }

          .pricing-price {
            font-family: 'Cormorant Garamond', serif;
            font-size: 3.5rem;
            font-weight: 700;
            color: #f1f5f9;
            line-height: 1;
          }

          .pricing-period { font-size: 1rem; color: #64748b; font-family: 'DM Sans', sans-serif; }

          .pricing-divider {
            height: 1px;
            background: rgba(255,255,255,0.07);
            margin: 1.5rem 0;
          }

          .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }

          .pricing-feature {
            font-size: 0.875rem;
            color: #94a3b8;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .pricing-feature::before {
            content: '✓';
            color: #1a56db;
            font-weight: 700;
            flex-shrink: 0;
          }

          .pricing-cta {
            display: block;
            text-align: center;
            margin-top: 1.75rem;
            padding: 0.75rem;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            text-decoration: none;
            background: rgba(26,86,219,0.15);
            border: 1px solid rgba(26,86,219,0.3);
            color: #93c5fd;
            transition: all 0.2s;
          }
          .pricing-cta:hover { background: rgba(26,86,219,0.3); }
          .pricing-card.featured .pricing-cta {
            background: #1a56db;
            border-color: #1a56db;
            color: white;
          }
          .pricing-card.featured .pricing-cta:hover { background: #1648c7; }

          .setup-note {
            text-align: center;
            margin-top: 1.5rem;
            font-size: 0.8rem;
            color: #475569;
          }

          .cta-section {
            background: linear-gradient(135deg, #0f1d35 0%, #1a2d50 100%);
            border-top: 1px solid rgba(26,86,219,0.2);
            border-bottom: 1px solid rgba(26,86,219,0.2);
            text-align: center;
          }

          footer {
            background: #080e1a;
            border-top: 1px solid rgba(255,255,255,0.05);
            padding: 2rem;
            text-align: center;
          }

          .footer-logo {
            font-family: 'Cormorant Garamond', serif;
            font-size: 1.1rem;
            color: #475569;
            margin-bottom: 0.5rem;
          }

          .footer-tagline {
            font-size: 0.8rem;
            color: #334155;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          @media (max-width: 640px) {
            .hero-stats { gap: 1.5rem; }
            nav { padding: 1rem 1.25rem; }
          }
        `}</style>
      </head>
      <body>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <div className="hero">
          <nav>
            <a href="/" className="nav-logo">
              <div className="nav-logo-mark">🏰</div>
              <span className="nav-logo-text">MembersGuild</span>
            </a>
            <a href="mailto:hello@membersguild.com.au" className="nav-cta">
              Get in touch →
            </a>
          </nav>

          <div className="hero-content">
            <div className="hero-badge">
              <span>🇦🇺</span>
              Built in Australia for community sport
            </div>

            <h1 className="hero-title">
              The membership platform<br />
              <span>clubs actually want</span>
            </h1>

            <p className="hero-sub">
              Session booking, credit management, attendance tracking, and member
              management — all in one white-labelled portal your club installs in a day.
            </p>

            <div className="hero-actions">
              <a href="mailto:hello@membersguild.com.au" className="btn-primary">
                Register your club
              </a>
              <a href="https://forestden.membersguild.com.au" className="btn-ghost">
                View live demo →
              </a>
            </div>

            <div className="hero-stats">
              <div className="stat">
                <div className="stat-value">1 day</div>
                <div className="stat-label">To go live</div>
              </div>
              <div className="stat">
                <div className="stat-value">$199</div>
                <div className="stat-label">Setup fee</div>
              </div>
              <div className="stat">
                <div className="stat-value">$49</div>
                <div className="stat-label">From per month</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Features ──────────────────────────────────────────────── */}
        <section className="features-section">
          <div className="section-inner">
            <div className="section-label">What's included</div>
            <h2 className="section-title">Everything your club needs.<br />Nothing it doesn't.</h2>
            <p className="section-sub">
              Built from real feedback from real clubs. Every feature earns its place.
            </p>

            <div className="features-grid">
              {features.map(f => (
                <div key={f.title} className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────── */}
        <section className="pricing-section">
          <div className="section-inner">
            <div className="section-label">Simple pricing</div>
            <h2 className="section-title">Pay for what you need.<br />Upgrade as you grow.</h2>
            <p className="section-sub">
              All plans include every feature. Pricing scales with your member count.
              Plus a one-time $199 setup and configuration fee.
            </p>

            <div className="pricing-grid">
              {pricing.map(p => (
                <div key={p.name} className={`pricing-card${p.featured ? ' featured' : ''}`}>
                  {p.featured && <div className="featured-badge">Most popular</div>}
                  <div className="pricing-name">{p.name}</div>
                  <div className="pricing-members">{p.members}</div>
                  <div>
                    <span className="pricing-price">{p.price}</span>
                    <span className="pricing-period"> /month</span>
                  </div>
                  <div className="pricing-divider" />
                  <ul className="pricing-features">
                    {p.features.map(f => (
                      <li key={f} className="pricing-feature">{f}</li>
                    ))}
                  </ul>
                  <a href="mailto:hello@membersguild.com.au" className="pricing-cta">
                    Get started
                  </a>
                </div>
              ))}
            </div>
            <p className="setup-note">All plans include a $199 one-time setup fee · No lock-in contracts · Cancel anytime</p>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="cta-section">
          <div className="section-inner">
            <div className="section-label">Ready to get started?</div>
            <h2 className="section-title">Your club portal,<br />live in one day.</h2>
            <p className="section-sub" style={{ margin: '0 auto 2.5rem', textAlign: 'center' }}>
              We handle the setup. You handle the swimming.
              Get in touch and we'll have your club live within 24 hours.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="mailto:hello@membersguild.com.au" className="btn-primary">
                hello@membersguild.com.au
              </a>
              <a href="https://forestden.membersguild.com.au" className="btn-ghost">
                View live demo →
              </a>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer>
          <div className="footer-logo">🏰 MembersGuild</div>
          <div className="footer-tagline">Built for clubs · Trusted by members</div>
          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#1e293b' }}>
            © {new Date().getFullYear()} MembersGuild · Brisbane, Australia · ABN registered
          </div>
        </footer>

      </body>
    </html>
  )
}