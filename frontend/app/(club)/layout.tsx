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
  const features = [
    { icon: '🏊', title: 'Session Booking', description: 'Members register for sessions online. Credits deduct automatically. Capacity enforced. No spreadsheets.' },
    { icon: '💳', title: 'Credit System', description: 'Members purchase credit packs. Finance confirms bank transfers. Credits release instantly.' },
    { icon: '📋', title: 'Attendance Tracking', description: 'Coaches mark attendance with QR codes. NSBA credits refunded automatically. Full audit trail.' },
    { icon: '👥', title: 'Member Management', description: 'Full member database with role-based access. Emergency contacts. Credit history. One-tap call.' },
    { icon: '🏪', title: 'Swim Shop', description: 'Sell credit packs and merchandise. Finance confirms payments. Orders tracked end to end.' },
    { icon: '📱', title: 'Mobile Ready', description: 'Installs on iPhone and Android from the browser. No App Store needed. Works offline.' },
  ]

  const pricing = [
    { name: 'Small Club', members: 'Under 50 members', price: '$49', featured: false, features: ['All standard features', 'Unlimited sessions', 'Member portal', 'Email support'] },
    { name: 'Medium Club', members: '50–150 members', price: '$99', featured: true, features: ['Everything in Small', 'Priority support', 'Custom branding', 'Attendance reports'] },
    { name: 'Large Club', members: '150+ members', price: '$199', featured: false, features: ['Everything in Medium', 'Dedicated onboarding', 'CSV member import', 'Phone support'] },
  ]

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    .mgl { font-family: 'DM Sans', sans-serif; background: #0c1220; color: #e2e8f0; min-height: 100vh; }
    .mgl * { box-sizing: border-box; }
    .mgl-hero { min-height: 100vh; background: linear-gradient(135deg, #0c1220 0%, #0f1d35 50%, #0c1220 100%); display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .mgl-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(26,86,219,0.15) 0%, transparent 70%); }
    .mgl-nav { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem 2rem; position: relative; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .mgl-nav-cta { background: rgba(26,86,219,0.15); border: 1px solid rgba(26,86,219,0.4); color: #93c5fd; padding: 0.5rem 1.25rem; border-radius: 6px; font-size: 0.875rem; text-decoration: none; }
    .mgl-nav-cta:hover { background: rgba(26,86,219,0.3); }
    .mgl-hero-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4rem 2rem; position: relative; z-index: 10; }
    .mgl-badge { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(26,86,219,0.12); border: 1px solid rgba(26,86,219,0.3); color: #93c5fd; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.375rem 1rem; border-radius: 100px; margin-bottom: 2rem; }
    .mgl-h1 { font-family: 'Cormorant Garamond', serif; font-size: clamp(3rem, 8vw, 6rem); font-weight: 700; line-height: 1.05; color: #f8fafc; margin-bottom: 1.5rem; }
    .mgl-h1 span { background: linear-gradient(135deg, #60a5fa, #93c5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .mgl-sub { font-size: 1.2rem; color: #94a3b8; max-width: 560px; line-height: 1.7; margin-bottom: 2.5rem; font-weight: 300; }
    .mgl-actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
    .mgl-btn { background: #1a56db; color: white; padding: 0.875rem 2rem; border-radius: 8px; font-size: 0.95rem; font-weight: 500; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); }
    .mgl-btn:hover { background: #1648c7; }
    .mgl-btn-ghost { background: rgba(255,255,255,0.05); color: #cbd5e1; padding: 0.875rem 2rem; border-radius: 8px; font-size: 0.95rem; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); }
    .mgl-btn-ghost:hover { background: rgba(255,255,255,0.09); }
    .mgl-stats { display: flex; gap: 3rem; margin-top: 4rem; padding-top: 3rem; border-top: 1px solid rgba(255,255,255,0.06); }
    .mgl-stat-val { font-family: 'Cormorant Garamond', serif; font-size: 2.5rem; font-weight: 700; color: #f1f5f9; }
    .mgl-stat-lbl { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .mgl-sec { padding: 6rem 2rem; }
    .mgl-inner { max-width: 1100px; margin: 0 auto; }
    .mgl-lbl { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #60a5fa; margin-bottom: 1rem; }
    .mgl-h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; color: #f1f5f9; line-height: 1.15; margin-bottom: 1rem; }
    .mgl-sub2 { color: #94a3b8; font-size: 1.05rem; line-height: 1.7; max-width: 560px; font-weight: 300; }
    .mgl-features-bg { background: #0a1020; }
    .mgl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 3rem; }
    .mgl-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 1.75rem; }
    .mgl-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(26,86,219,0.3); }
    .mgl-card-icon { font-size: 1.75rem; margin-bottom: 1rem; }
    .mgl-card-title { font-size: 1rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.5rem; }
    .mgl-card-desc { font-size: 0.9rem; color: #64748b; line-height: 1.65; }
    .mgl-pgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 3rem; }
    .mgl-pcard { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 2rem; position: relative; }
    .mgl-pcard-featured { background: rgba(26,86,219,0.1); border-color: rgba(26,86,219,0.4); }
    .mgl-pbadge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #1a56db; color: white; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.25rem 0.875rem; border-radius: 100px; white-space: nowrap; }
    .mgl-pname { font-size: 1rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.25rem; }
    .mgl-pmembers { font-size: 0.8rem; color: #64748b; margin-bottom: 1.5rem; }
    .mgl-pprice { font-family: 'Cormorant Garamond', serif; font-size: 3.5rem; font-weight: 700; color: #f1f5f9; line-height: 1; }
    .mgl-pperiod { font-size: 1rem; color: #64748b; }
    .mgl-pdiv { height: 1px; background: rgba(255,255,255,0.07); margin: 1.5rem 0; }
    .mgl-pfeatures { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; padding: 0; }
    .mgl-pfeature { font-size: 0.875rem; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem; }
    .mgl-pfeature::before { content: '✓'; color: #1a56db; font-weight: 700; }
    .mgl-pcta { display: block; text-align: center; margin-top: 1.75rem; padding: 0.75rem; border-radius: 8px; font-size: 0.9rem; font-weight: 500; text-decoration: none; background: rgba(26,86,219,0.15); border: 1px solid rgba(26,86,219,0.3); color: #93c5fd; }
    .mgl-pcard-featured .mgl-pcta { background: #1a56db; border-color: #1a56db; color: white; }
    .mgl-note { text-align: center; margin-top: 1.5rem; font-size: 0.8rem; color: #475569; }
    .mgl-cta-bg { background: linear-gradient(135deg, #0f1d35 0%, #1a2d50 100%); border-top: 1px solid rgba(26,86,219,0.2); border-bottom: 1px solid rgba(26,86,219,0.2); text-align: center; }
    .mgl-footer { background: #080e1a; border-top: 1px solid rgba(255,255,255,0.05); padding: 2rem; text-align: center; }
    .mgl-footer-tag { font-size: 0.8rem; color: #334155; letter-spacing: 0.05em; text-transform: uppercase; }
    .mgl-footer-copy { margin-top: 1rem; font-size: 0.75rem; color: #1e293b; }
    @media (max-width: 640px) { .mgl-stats { gap: 1.5rem; } .mgl-nav { padding: 1rem 1.25rem; } }
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="mgl">

        {/* Hero */}
        <div className="mgl-hero">
          <div className="mgl-nav">
            <img src="/logo.png" alt="MembersGuild" style={{ height: '36px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
            <a href="mailto:hello@membersguild.com.au" className="mgl-nav-cta">Get in touch →</a>
          </div>

          <div className="mgl-hero-body">
            <img src="/logo.png" alt="MembersGuild" style={{ height: '110px', width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.85, marginBottom: '2rem' }} />
            <div className="mgl-badge"><span>🇦🇺</span> Built in Australia for community sport</div>
            <h1 className="mgl-h1">The membership platform<br /><span>clubs actually want</span></h1>
            <p className="mgl-sub">Session booking, credit management, attendance tracking, and member management — all in one white-labelled portal your club installs in a day.</p>
            <div className="mgl-actions">
              <a href="mailto:hello@membersguild.com.au" className="mgl-btn">Register your club</a>
              <a href="https://forestden.membersguild.com.au" className="mgl-btn-ghost">View live demo →</a>
            </div>
            <div className="mgl-stats">
              <div><div className="mgl-stat-val">1 day</div><div className="mgl-stat-lbl">To go live</div></div>
              <div><div className="mgl-stat-val">$199</div><div className="mgl-stat-lbl">Setup fee</div></div>
              <div><div className="mgl-stat-val">$49</div><div className="mgl-stat-lbl">From per month</div></div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mgl-sec mgl-features-bg">
          <div className="mgl-inner">
            <div className="mgl-lbl">What&apos;s included</div>
            <h2 className="mgl-h2">Everything your club needs.<br />Nothing it doesn&apos;t.</h2>
            <p className="mgl-sub2">Built from real feedback from real clubs. Every feature earns its place.</p>
            <div className="mgl-grid">
              {features.map(f => (
                <div key={f.title} className="mgl-card">
                  <div className="mgl-card-icon">{f.icon}</div>
                  <div className="mgl-card-title">{f.title}</div>
                  <div className="mgl-card-desc">{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mgl-sec">
          <div className="mgl-inner">
            <div className="mgl-lbl">Simple pricing</div>
            <h2 className="mgl-h2">Pay for what you need.<br />Upgrade as you grow.</h2>
            <p className="mgl-sub2">All plans include every feature. Pricing scales with your member count. Plus a one-time $199 setup fee.</p>
            <div className="mgl-pgrid">
              {pricing.map(p => (
                <div key={p.name} className={p.featured ? 'mgl-pcard mgl-pcard-featured' : 'mgl-pcard'}>
                  {p.featured && <div className="mgl-pbadge">Most popular</div>}
                  <div className="mgl-pname">{p.name}</div>
                  <div className="mgl-pmembers">{p.members}</div>
                  <div><span className="mgl-pprice">{p.price}</span><span className="mgl-pperiod"> /month</span></div>
                  <div className="mgl-pdiv" />
                  <ul className="mgl-pfeatures">
                    {p.features.map(f => <li key={f} className="mgl-pfeature">{f}</li>)}
                  </ul>
                  <a href="mailto:hello@membersguild.com.au" className="mgl-pcta">Get started</a>
                </div>
              ))}
            </div>
            <p className="mgl-note">All plans include a $199 one-time setup fee · No lock-in contracts · Cancel anytime</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mgl-sec mgl-cta-bg">
          <div className="mgl-inner">
            <div className="mgl-lbl">Ready to get started?</div>
            <h2 className="mgl-h2">Your club portal,<br />live in one day.</h2>
            <p className="mgl-sub2" style={{ margin: '0 auto 2.5rem', textAlign: 'center' }}>We handle the setup. You handle the sport. Get in touch and we&apos;ll have your club live within 24 hours.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="mailto:hello@membersguild.com.au" className="mgl-btn">hello@membersguild.com.au</a>
              <a href="https://forestden.membersguild.com.au" className="mgl-btn-ghost">View live demo →</a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mgl-footer">
          <img src="/logo.png" alt="MembersGuild" style={{ height: '52px', width: 'auto', opacity: 0.2, marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }} />
          <div className="mgl-footer-tag">Built for clubs · Trusted by members</div>
          <div className="mgl-footer-copy">© {new Date().getFullYear()} MembersGuild · Brisbane, Australia · ABN registered</div>
        </div>

      </div>
    </>
  )
}