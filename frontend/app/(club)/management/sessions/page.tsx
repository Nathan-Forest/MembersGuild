'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole, Location } from '@/types'

interface SessionResponse {
  id: number
  title: string
  description: string | null
  locationId: number | null
  locationName: string | null
  coachId: number | null
  coachName: string | null
  startTime: string
  endTime: string
  capacity: number
  creditCost: number
  registrationCutoffHours: number
  isCancelled: boolean
  isRecurring: boolean
  bookedCount: number
  isBooked: boolean
}

interface CoachOption {
  id: number
  fullName: string
}

const emptyForm = {
  title: '', description: '', locationId: '',
  coachId: '', startTime: '', endTime: '',
  capacity: '25', creditCost: '1', registrationCutoffHours: '24',
}

const emptyRecurring = {
  title: '', description: '', locationId: '', coachId: '',
  startTime: '', endTime: '', startDate: '', endDate: '',
  capacity: '25', creditCost: '1', registrationCutoffHours: '24',
  days: [] as number[],
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit', hour12: false
  })
}

function capacityColor(booked: number, capacity: number) {
  const remaining = capacity - booked
  if (remaining <= 0) return 'text-red-600 font-semibold'
  if (remaining <= 5) return 'text-amber-600 font-semibold'
  return 'text-green-700'
}

export default function ManageSessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)

  // Single session modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SessionResponse | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Recurring modal
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [recurring, setRecurring] = useState(emptyRecurring)
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [recurringError, setRecurringError] = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    const role = user.role as UserRole
    setCurrentRole(role)
    if (!['coach', 'committee', 'webmaster'].includes(role)) {
      router.replace('/dashboard'); return
    }
    loadAll()
  }, [router])

  async function loadAll() {
    setLoading(true)
    try {
      const [sessionsData, locationsData, membersData] = await Promise.all([
        api.get<SessionResponse[]>('/sessions'),
        api.get<Location[]>('/locations/active'),
        api.get<{ id: number; firstName: string; lastName: string; role: string }[]>('/members'),
      ])
      setSessions(sessionsData)
      setLocations(locationsData)
      setCoaches(membersData
        .filter(m => m.role === 'coach' || m.role === 'webmaster')
        .map(m => ({ id: m.id, fullName: `${m.firstName} ${m.lastName}` }))
      )
    } catch { }
    finally { setLoading(false) }
  }

  function toLocalDateTimeInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(s: SessionResponse) {
    setEditing(s)
    setForm({
      title:                   s.title,
      description:             s.description ?? '',
      locationId:              s.locationId?.toString() ?? '',
      coachId:                 s.coachId?.toString() ?? '',
      startTime:               toLocalDateTimeInput(s.startTime),
      endTime:                 toLocalDateTimeInput(s.endTime),
      capacity:                s.capacity.toString(),
      creditCost:              s.creditCost.toString(),
      registrationCutoffHours: s.registrationCutoffHours.toString(),
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        title:                   form.title.trim(),
        description:             form.description.trim() || null,
        locationId:              form.locationId ? parseInt(form.locationId) : null,
        coachId:                 form.coachId ? parseInt(form.coachId) : null,
        startTime:               new Date(form.startTime).toISOString(),
        endTime:                 new Date(form.endTime).toISOString(),
        capacity:                parseInt(form.capacity),
        creditCost:              parseInt(form.creditCost),
        registrationCutoffHours: parseInt(form.registrationCutoffHours),
      }
      if (editing) {
        await api.put(`/sessions/${editing.id}`, payload)
      } else {
        await api.post('/sessions', payload)
      }
      setModalOpen(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: SessionResponse) {
    const msg = s.bookedCount > 0
      ? `Delete "${s.title}"? ${s.bookedCount} member(s) are registered — credits will be refunded automatically.`
      : `Delete "${s.title}"?`
    if (!confirm(msg)) return
    try {
      await api.delete(`/sessions/${s.id}`)
      await loadAll()
    } catch { }
  }

  async function handleRecurring(e: React.FormEvent) {
    e.preventDefault()
    setRecurringError('')
    if (recurring.days.length === 0) {
      setRecurringError('Select at least one day of the week')
      return
    }
    setRecurringLoading(true)
    try {
      await api.post('/sessions/recurring', {
        title:                   recurring.title.trim(),
        description:             recurring.description.trim() || null,
        locationId:              recurring.locationId ? parseInt(recurring.locationId) : null,
        coachId:                 recurring.coachId ? parseInt(recurring.coachId) : null,
        startTime:               recurring.startTime,
        endTime:                 recurring.endTime,
        daysOfWeek:              recurring.days,
        startDate:               recurring.startDate,
        endDate:                 recurring.endDate,
        capacity:                parseInt(recurring.capacity),
        creditCost:              parseInt(recurring.creditCost),
        registrationCutoffHours: parseInt(recurring.registrationCutoffHours),
      })
      setRecurringOpen(false)
      setRecurring(emptyRecurring)
      await loadAll()
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : 'Failed to create recurring sessions')
    } finally {
      setRecurringLoading(false)
    }
  }

  function toggleDay(day: number) {
    setRecurring(r => ({
      ...r,
      days: r.days.includes(day) ? r.days.filter(d => d !== day) : [...r.days, day]
    }))
  }

  const upcomingSessions = sessions.filter(s => new Date(s.startTime) >= new Date())
  const pastSessions = sessions.filter(s => new Date(s.startTime) < new Date())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Manage Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">{sessions.length} total sessions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setRecurring(emptyRecurring); setRecurringError(''); setRecurringOpen(true) }}
            className="btn-secondary px-4 py-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recurring
          </button>
          <button onClick={openAdd} className="btn-primary px-4 py-2">
            + Add Session
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card p-4 h-24 animate-pulse bg-gray-100" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm font-medium text-gray-600">No sessions yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first session or set up a recurring schedule</p>
          <button onClick={openAdd} className="btn-primary px-6 py-2 mt-4">Add Session</button>
        </div>
      ) : (
        <>
          {upcomingSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Upcoming — {upcomingSessions.length}
              </h2>
              <div className="space-y-3">
                {upcomingSessions.map(s => (
                  <SessionCard key={s.id} session={s} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {pastSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Past — {pastSessions.length}
              </h2>
              <div className="space-y-3 opacity-60">
                {pastSessions.slice(0, 10).map(s => (
                  <SessionCard key={s.id} session={s} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Session Modal ─────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Session' : 'Add Session'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input type="text" required className="input" placeholder="e.g. Morning Squad"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Optional session description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start time <span className="text-red-500">*</span></label>
                  <input type="datetime-local" required className="input"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End time <span className="text-red-500">*</span></label>
                  <input type="datetime-local" required className="input"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Location</label>
                  <select className="input" value={form.locationId}
                    onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}>
                    <option value="">No location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Coach</label>
                  <select className="input" value={form.coachId}
                    onChange={e => setForm(f => ({ ...f, coachId: e.target.value }))}>
                    <option value="">No coach assigned</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Capacity</label>
                  <input type="number" min="1" className="input" value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Credits</label>
                  <input type="number" min="0" className="input" value={form.creditCost}
                    onChange={e => setForm(f => ({ ...f, creditCost: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Cutoff (hrs)</label>
                  <input type="number" min="0" className="input" value={form.registrationCutoffHours}
                    onChange={e => setForm(f => ({ ...f, registrationCutoffHours: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Session'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Recurring Session Modal ──────────────────────────────────────── */}
      {recurringOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Create Recurring Sessions</h2>
              <button onClick={() => setRecurringOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRecurring} className="p-6 space-y-4">
              {recurringError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {recurringError}
                </div>
              )}

              <div>
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input type="text" required className="input" placeholder="e.g. Morning Squad"
                  value={recurring.title}
                  onChange={e => setRecurring(r => ({ ...r, title: e.target.value }))} />
              </div>

              <div>
                <label className="label">Days of week <span className="text-red-500">*</span></label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_NAMES.map((day, i) => (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        recurring.days.includes(i)
                          ? 'text-white border-transparent'
                          : 'text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                      style={recurring.days.includes(i) ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start time <span className="text-red-500">*</span></label>
                  <input type="time" required className="input"
                    value={recurring.startTime}
                    onChange={e => setRecurring(r => ({ ...r, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End time <span className="text-red-500">*</span></label>
                  <input type="time" required className="input"
                    value={recurring.endTime}
                    onChange={e => setRecurring(r => ({ ...r, endTime: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start date <span className="text-red-500">*</span></label>
                  <input type="date" required className="input"
                    value={recurring.startDate}
                    onChange={e => setRecurring(r => ({ ...r, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End date <span className="text-red-500">*</span></label>
                  <input type="date" required className="input"
                    value={recurring.endDate}
                    onChange={e => setRecurring(r => ({ ...r, endDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Location</label>
                  <select className="input" value={recurring.locationId}
                    onChange={e => setRecurring(r => ({ ...r, locationId: e.target.value }))}>
                    <option value="">No location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Coach</label>
                  <select className="input" value={recurring.coachId}
                    onChange={e => setRecurring(r => ({ ...r, coachId: e.target.value }))}>
                    <option value="">No coach</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Capacity</label>
                  <input type="number" min="1" className="input" value={recurring.capacity}
                    onChange={e => setRecurring(r => ({ ...r, capacity: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Credits</label>
                  <input type="number" min="0" className="input" value={recurring.creditCost}
                    onChange={e => setRecurring(r => ({ ...r, creditCost: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Cutoff (hrs)</label>
                  <input type="number" min="0" className="input" value={recurring.registrationCutoffHours}
                    onChange={e => setRecurring(r => ({ ...r, registrationCutoffHours: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={recurringLoading} className="btn-primary flex-1 py-2.5">
                  {recurringLoading ? 'Creating…' : 'Create Recurring Sessions'}
                </button>
                <button type="button" onClick={() => setRecurringOpen(false)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Session Card ───────────────────────────────────────────────────────────────

function SessionCard({
  session: s,
  onEdit,
  onDelete,
}: {
  session: SessionResponse
  onEdit: (s: SessionResponse) => void
  onDelete: (s: SessionResponse) => void
}) {
  const remaining = s.capacity - s.bookedCount

  return (
    <div className="card p-4 flex items-center gap-4">
      {/* Date block */}
      <div className="flex-shrink-0 w-14 text-center">
        <div className="text-xs font-semibold uppercase text-gray-400">
          {new Date(s.startTime).toLocaleDateString('en-AU', { weekday: 'short' })}
        </div>
        <div className="text-2xl font-bold text-gray-900 leading-none">
          {new Date(s.startTime).getDate()}
        </div>
        <div className="text-xs text-gray-400">
          {new Date(s.startTime).toLocaleDateString('en-AU', { month: 'short' })}
        </div>
      </div>

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{s.title}</p>
          {s.isRecurring && <span className="badge badge-blue text-xs">Recurring</span>}
          {s.isCancelled && <span className="badge badge-gray text-xs">Cancelled</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
          <span>🕐 {new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}–{new Date(s.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          {s.locationName && <span>📍 {s.locationName}</span>}
          {s.coachName && <span>👤 {s.coachName}</span>}
          <span className={`font-medium ${remaining <= 0 ? 'text-red-600' : remaining <= 5 ? 'text-amber-600' : 'text-green-700'}`}>
            👥 {s.bookedCount}/{s.capacity}
          </span>
          <span>💳 {s.creditCost} credit{s.creditCost !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onEdit(s)} className="btn-secondary text-xs px-3 py-1.5">Edit</button>
        <button onClick={() => onDelete(s)} className="btn-danger text-xs px-3 py-1.5">Delete</button>
      </div>
    </div>
  )
}