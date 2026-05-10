'use client'

import { useState } from 'react'

const navy = '#1a56db'

export default function MembersGuildContactForm() {
  const [form, setForm]       = useState({ name: '', email: '', phone: '', club: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    if (!form.name || !form.email) { setError('Name and email are required.'); return }
    setSending(true); setError('')
    try {
      await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setSent(true)
    } catch {
      setError('Something went wrong. Email hello@membersguild.com.au directly.')
    }
    setSending(false)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '0.875rem 1rem', borderRadius: '0.5rem',
    background: '#060d1a', border: '1px solid #0f2040', color: '#fff',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏆</div>
        <p style={{ fontSize: '1.25rem', fontWeight: 300, color: '#fff', marginBottom: '0.5rem' }}>
          Enquiry received!
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          I'll be in touch within 24 hours to get your club set up.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <input type="text" placeholder="Name *" value={form.name}
          onChange={e => set('name', e.target.value)} style={{ ...input, flex: 1 }} />
        <input type="email" placeholder="Email *" value={form.email}
          onChange={e => set('email', e.target.value)} style={{ ...input, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <input type="tel" placeholder="Phone" value={form.phone}
          onChange={e => set('phone', e.target.value)} style={{ ...input, flex: 1 }} />
        <input type="text" placeholder="Club name" value={form.club}
          onChange={e => set('club', e.target.value)} style={{ ...input, flex: 1 }} />
      </div>
      <textarea placeholder="Tell me about your club and what you're looking for..." rows={4}
        value={form.message} onChange={e => set('message', e.target.value)}
        style={{ ...input, resize: 'none' }} />
      {error && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</p>}
      <button onClick={submit} disabled={sending} style={{
        padding: '0.875rem', borderRadius: '0.5rem', border: 'none',
        background: navy, color: '#fff', fontSize: '0.9rem', fontWeight: 600,
        cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
        letterSpacing: '0.05em', fontFamily: 'inherit',
      }}>
        {sending ? 'Sending...' : 'REGISTER YOUR CLUB →'}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
        Or email directly:{' '}
        <a href="mailto:hello@membersguild.com.au"
          style={{ color: '#60a5fa', textDecoration: 'none' }}>
          hello@membersguild.com.au
        </a>
      </p>
    </div>
  )
}