'use client'

import MembersGuildContactForm from '@/components/MembersGuildContactForm'

export function PlatformLandingPage() {
    const navy   = '#1a56db'
      const dark   = '#0a0a0f'
      const card   = '#0a0f1a'
      const muted  = '#94a3b8'
      const border = '#0f1f35'
    
      const features = [
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          title: 'Session Booking',
          desc: 'Members register for sessions online. Credits deduct automatically. Capacity enforced. QR code check-in at the door.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
          title: 'Credit System',
          desc: 'Members purchase credit packs. Finance confirms bank transfers. Credits release instantly. Full transaction history.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
          title: 'Attendance Tracking',
          desc: 'Coaches mark attendance with QR codes. NSBA credits refunded automatically. Full audit trail per session.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          title: 'Member Management',
          desc: 'Full member database with role-based access. Emergency contacts. Credit history. CSV bulk import. One-tap call.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          ),
          title: 'Club Shop',
          desc: 'Sell credit packs and merchandise. Finance confirms payments. Orders tracked end to end. No third-party fees.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
          title: 'Training & Personal Bests',
          desc: 'Log training sets, track metrics, and record personal bests. Sport-agnostic naming. Coaches manage everything.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          ),
          title: 'Club News & Updates',
          desc: 'Post announcements directly to the member dashboard. Keep your club informed without WhatsApp chaos.',
        },
        {
          icon: (
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
          title: 'Mobile Ready',
          desc: 'Installs on iPhone and Android from the browser. No App Store needed. Works offline. Branded with your logo.',
        },
      ]
    
      const standardPlans = [
        {
          name: 'Small Club',
          members: 'Up to 50 members',
          price: '$49',
          features: [
            'Session Calendar & Booking',
            'Attendance Tracking & QR Check-in',
            'Member Portal & Management',
            'Club Shop & Credit System',
            'Reports & CSV Export',
          ],
          addons: 'Training & News available as add-ons',
          highlight: false,
        },
        {
          name: 'Medium Club',
          members: '50–150 members',
          price: '$99',
          features: [
            'Everything in Small',
            'Training & Personal Bests',
            'Club News & Updates',
            'Priority support',
            'Configurable feature flags',
          ],
          addons: null,
          highlight: true,
        },
        {
          name: 'Large Club',
          members: '150+ members',
          price: '$199',
          features: [
            'Everything in Medium',
            'Unlimited members',
            'Dedicated onboarding',
            'CSV member import',
            'Phone support',
          ],
          addons: null,
          highlight: false,
        },
      ]
    
      return (
        <div style={{ background: dark, color: '#fff', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
    
          {/* ── Nav ─────────────────────────────────────── */}
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
              {[['#features', 'Features'], ['#pricing', 'Pricing'], ['#start', 'Register'], ['#support', 'Support']].map(([href, label]) => (
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
                all in one white-labelled portal your club is live with in a day.
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
                {[['1 day', 'To go live'], ['0', 'Headaches'], ['$49', 'From per month']].map(([val, lbl]) => (
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
                    <div style={{ color: '#60a5fa', marginBottom: '1rem' }}>{f.icon}</div>
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
                  Core features included on every plan. Training and News available as add-ons or included from Medium.
                </p>
              </div>
    
              {/* Standard tiers */}
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: muted, marginBottom: '1.5rem' }}>
                Standard Plans
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {plan.features.map(f => (
                        <li key={f} style={{ fontSize: '0.85rem', color: muted, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{ color: navy, flexShrink: 0 }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                    {plan.addons && (
                      <p style={{ fontSize: '0.75rem', color: '#334155', marginBottom: '1.25rem', borderTop: `1px solid ${border}`, paddingTop: '0.75rem' }}>
                        + {plan.addons}
                      </p>
                    )}
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
    
              {/* Add-ons */}
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: muted, margin: '2.5rem 0 1.5rem' }}>
                Add-Ons — for Small Clubs
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
                {[
                  { name: 'Training Add-On', price: '$19', desc: 'Training sets, metrics, and Personal Bests module.' },
                  { name: 'News Add-On', price: '$9', desc: 'Club News & Updates board on the member dashboard.' },
                ].map(addon => (
                  <div key={addon.name} style={{
                    background: dark, border: `1px solid ${border}`,
                    borderRadius: '0.75rem', padding: '1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                  }}>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', margin: '0 0 0.25rem' }}>{addon.name}</p>
                      <p style={{ fontSize: '0.8rem', color: muted, margin: 0 }}>{addon.desc}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{addon.price}</span>
                      <span style={{ fontSize: '0.75rem', color: muted }}>/mo</span>
                    </div>
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
                  {['Everything in Standard', 'File storage & sharing', 'Club chat services', 'Secure Accounting System'].map(f => (
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
                  Let's get your club live.
                </h2>
                <p style={{ color: muted, fontSize: '0.95rem', lineHeight: 1.8 }}>
                  From sign-up to first session in a single day. No spreadsheets, no duct tape, no compromises.
                  Fill in your details and I'll be in touch within 24 hours.
                </p>
              </div>
              <MembersGuildContactForm />
            </div>
          </section>
    
          {/* ── Support ──────────────────────────────────── */}
          <section id="support" style={{ padding: '4rem 2rem', background: card, borderTop: `1px solid ${border}` }}>
            <div style={{ maxWidth: '48rem', margin: '0 auto', textAlign: 'center' }}>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: navy, marginBottom: '1rem' }}>
                Support
              </p>
              <h2 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 300, color: '#fff', marginBottom: '1rem' }}>
                Help is built in.
              </h2>
              <p style={{ color: muted, fontSize: '0.9rem', lineHeight: 1.8, marginBottom: '2rem' }}>
                Every club portal includes a full help centre with how-to guides, FAQs, and a direct support request form.
                Members and administrators can find answers without waiting for a reply.
              </p>
              <a href="https://forestden.membersguild.com.au/support" target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', padding: '0.75rem 1.75rem', borderRadius: '0.5rem',
                border: `1px solid ${border}`, color: '#fff', textDecoration: 'none',
                fontSize: '0.85rem', letterSpacing: '0.08em',
              }}>
                View Help Centre Example →
              </a>
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