'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { GUIDES, SUPPORT_CATEGORIES, type Guide } from '@/lib/guides'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How do I log in for the first time?',
    a: 'Check your email for a welcome message from your club. It contains a link to set your password and access the portal. If you can\'t find it, ask your club administrator to resend it.',
  },
  {
    q: 'I forgot my password — what do I do?',
    a: 'Tap "Forgot your password?" on the login page and enter your email. You\'ll receive a reset link within a few minutes. Reset links expire after 1 hour.',
  },
  {
    q: 'Why can\'t I book a session?',
    a: 'You need at least 1 credit to book a session. Check your balance on the Dashboard — if it\'s 0, visit the Shop to purchase a credit pack. Sessions may also be fully booked.',
  },
  {
    q: 'What happens to my credit if I cancel?',
    a: 'Credits are refunded when you unregister before the session starts. If a coach marks you as NSBA (No Show But Advised), your credit is also refunded automatically.',
  },
  {
    q: 'How long does it take for my credits to appear after payment?',
    a: 'Once you submit your Shop order, your club\'s finance team confirms the bank transfer and releases the credits. This usually happens within 1–2 business days.',
  },
  {
    q: 'How do I update my emergency contact?',
    a: 'Go to My Profile (tap your initial in the top right), then tap Edit Profile. Update your emergency contact details and tap Save Changes.',
  },
  {
    q: 'Can I install this as an app on my phone?',
    a: 'Yes. On Android, open Chrome and tap the three-dot menu → Add to Home Screen → Install. On iPhone, open Safari, tap the Share button, then Add to Home Screen.',
  },
  {
    q: 'How do I add a member who shows up without registering?',
    a: 'Open the session Attendance Sheet, tap + Walk-in, search for the member\'s name, and select them. They\'ll be registered and marked attended immediately.',
  },
]

// ── Category tabs ─────────────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { key: 'members', label: 'Members', icon: '👤', description: 'Logging in, booking sessions, credits and your profile' },
  { key: 'committee', label: 'Committee', icon: '📋', description: 'Attendance, shop management and member administration' },
  { key: 'webmaster', label: 'Webmaster', icon: '⚙️', description: 'Portal setup, settings and advanced configuration' },
] as const

// ── Support form ──────────────────────────────────────────────────────────────

interface SupportForm {
  category: string
  name: string
  email: string
  description: string
  startedAt: string
  device: string
  guideRead: boolean
}

export default function SupportPage() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'committee' | 'webmaster'>('members')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [form, setForm] = useState<SupportForm>({
    category: '', name: '', email: '', description: '',
    startedAt: '', device: '', guideRead: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Pre-fill name/email if logged in
  useState(() => {
    const user = getCurrentUser()
    if (user) {
      setForm(f => ({
        ...f,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email ?? '',
      }))
    }
  })

  // Filtered guides
  const filteredGuides = useMemo(() => {
    if (!search.trim()) return GUIDES.filter(g => g.category === activeTab)
    const q = search.toLowerCase()
    return GUIDES.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    )
  }, [search, activeTab])

  // Selected support category guide
  const selectedCategory = SUPPORT_CATEGORIES.find(c => c.value === form.category)
  const linkedGuide = selectedCategory?.guide ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.name || !form.email || !form.description) return
    setSubmitting(true); setSubmitError('')
    try {
      await api.post('/public/support', {
        category: form.category,
        name: form.name,
        email: form.email,
        description: form.description,
        startedAt: form.startedAt || null,
        device: form.device || null,
        guideRead: form.guideRead,
      })
      setSubmitted(true)
    } catch {
      setSubmitError('Failed to submit. Please try again or email support@membersguild.com.au directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-16">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="text-center pt-6">
        <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
        <p className="text-gray-500 mt-2">
          Find answers, read guides, or contact our support team.
        </p>

        {/* Search */}
        <div className="relative max-w-lg mx-auto mt-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search guides…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 shadow-sm"
            style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── What's New banner ────────────────────────────────────── */}
      {!search && (
        <Link href="/support/whats-new"
          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors group">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🆕</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">What's New</p>
              <p className="text-xs text-gray-500">See the latest updates and fixes to your portal</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      {!search && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900 text-sm">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Guides ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {search ? `Search results for "${search}"` : 'How-to Guides'}
        </h2>

        {/* Category tabs */}
        {!search && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {CATEGORY_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                style={activeTab === tab.key
                  ? { backgroundColor: 'var(--color-primary)' }
                  : {}}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {!search && (
          <p className="text-sm text-gray-500 mb-4">
            {CATEGORY_TABS.find(t => t.key === activeTab)?.description}
          </p>
        )}

        {/* Guide cards */}
        {filteredGuides.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm font-medium text-gray-600">No guides found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredGuides.map(guide => (
              <Link
                key={guide.id}
                href={`/support/${guide.id}`}
                className="card p-5 hover:shadow-md transition-shadow flex items-start gap-4 group"
              >
                <span className="text-2xl flex-shrink-0">{guide.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:underline text-sm">
                    {guide.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {guide.description}
                  </p>
                  {search && (
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${guide.category === 'members' ? 'bg-blue-50 text-blue-700' :
                        guide.category === 'committee' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                      }`}>
                      {guide.category}
                    </span>
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-600 mt-0.5"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Support Form ─────────────────────────────────────────── */}
      <section id="contact">
        <div className="card p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Request Support</h2>
            <p className="text-sm text-gray-500 mt-1">
              Can't find the answer? Submit a support request and we'll get back to you.
            </p>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-4">✅</p>
              <h3 className="font-semibold text-gray-900 text-lg">Request submitted</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                We've received your request and will be in touch shortly.
                Check your email for a confirmation.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm(f => ({ ...f, category: '', description: '', guideRead: false })) }}
                className="mt-6 btn-secondary px-6 py-2 text-sm"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Step 1 — Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you need help with? <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value, guideRead: false }))}
                  className="input"
                  required
                >
                  {SUPPORT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Step 2 — Guide gate */}
              {form.category && linkedGuide && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{linkedGuide.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Before submitting, have you read our guide?
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        This guide covers most common issues with{' '}
                        <span className="font-medium">{form.category.toLowerCase()}</span>.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/support/${linkedGuide.id}`}
                    target="_blank"
                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border-2 border-amber-300 bg-white hover:bg-amber-50 transition-colors w-full justify-between"
                  >
                    <span>📖 {linkedGuide.title}</span>
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.guideRead}
                      onChange={e => setForm(f => ({ ...f, guideRead: e.target.checked }))}
                      className="rounded border-amber-400 w-4 h-4"
                    />
                    <span className="text-sm text-amber-900 font-medium">
                      Yes, I've read the guide and still need help
                    </span>
                  </label>
                </div>
              )}

              {/* Step 2b — No guide for "Other" */}
              {form.category === 'Other' && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    💡 You can also browse all our <Link href="#guides" className="font-medium underline">how-to guides</Link> above — your answer may already be there.
                  </p>
                </div>
              )}

              {/* Step 3 — Full form (revealed after guide check or "Other") */}
              {form.category && (form.guideRead || form.category === 'Other') && (
                <div className="space-y-4 pt-2 border-t border-gray-100">

                  {/* Name + Email */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your name <span className="text-red-500">*</span>
                      </label>
                      <input type="text" required className="input"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your email <span className="text-red-500">*</span>
                      </label>
                      <input type="email" required className="input"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Describe the problem <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required rows={4} className="input resize-none"
                      placeholder="What happened? What were you trying to do? What did you expect to happen?"
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  {/* When + Device */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        When did this start?
                      </label>
                      <input type="text" className="input"
                        placeholder="e.g. Yesterday, after the update…"
                        value={form.startedAt}
                        onChange={e => setForm(f => ({ ...f, startedAt: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Device / browser
                      </label>
                      <input type="text" className="input"
                        placeholder="e.g. iPhone 15, Chrome on Windows…"
                        value={form.device}
                        onChange={e => setForm(f => ({ ...f, device: e.target.value }))} />
                    </div>
                  </div>

                  {submitError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {submitting ? 'Submitting…' : 'Submit Support Request'}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    We aim to respond within 1 business day.
                  </p>
                </div>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  )
}