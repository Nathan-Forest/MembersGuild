'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface TrainingSettings {
  metricsEnabled: boolean
  setsEnabled: boolean
  videosEnabled: boolean
  setsLabel: string
  metricsLabel: string
}

interface TrainingSet {
  id: number
  title: string
  description: string | null
  difficulty: string
  category: string
  content: string
  totalDistance: number | null
  isSetOfWeek: boolean
  isActive: boolean
  createdAt: string
}

interface TrainingVideo {
  id: number
  title: string
  description: string | null
  category: string
  youtubeUrl: string
  thumbnailUrl: string | null
  isActive: boolean
  createdAt: string
}

interface MemberTimeResponse {
  metricId: number
  metricName: string
  unit: string
  category: string | null
  value: string | null
  updatedAt: string | null
}

interface MemberOption {
  id: number
  firstName: string
  lastName: string
  role: string
}

type ManageTab = 'sets' | 'videos' | 'times'

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

const emptySetForm = {
  title: '', description: '', difficulty: 'beginner',
  category: '', content: '', totalDistance: '',
}

const emptyVideoForm = {
  title: '', description: '', category: '', youtubeUrl: '',
}

export default function ManageTrainingPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<TrainingSettings | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<ManageTab>('sets')

  // Sets state
  const [sets, setSets] = useState<TrainingSet[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setModalOpen, setSetModalOpen] = useState(false)
  const [editingSet, setEditingSet] = useState<TrainingSet | null>(null)
  const [setForm, setSetForm] = useState(emptySetForm)
  const [setSaving, setSetSaving] = useState(false)
  const [setError, setSetError] = useState('')

  // Videos state
  const [videos, setVideos] = useState<TrainingVideo[]>([])
  const [videosLoading, setVideosLoading] = useState(true)
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<TrainingVideo | null>(null)
  const [videoForm, setVideoForm] = useState(emptyVideoForm)
  const [videoSaving, setVideoSaving] = useState(false)
  const [videoError, setVideoError] = useState('')

  // Member times state
  const [members, setMembers] = useState<MemberOption[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [memberTimes, setMemberTimes] = useState<MemberTimeResponse[]>([])
  const [timesEditing, setTimesEditing] = useState<Record<number, string>>({})
  const [timesSaving, setTimesSaving] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    const role = user.role as UserRole
    setCurrentRole(role)
    if (!['coach', 'committee', 'webmaster'].includes(role)) {
      router.replace('/dashboard'); return
    }
    loadSettings()
    loadSets()
    loadVideos()
    loadMembers()
  }, [router])

  async function loadSettings() {
    try {
      const s = await api.get<TrainingSettings>('/training/settings')
      setSettings(s)
      if (!s.setsEnabled) setActiveTab(s.videosEnabled ? 'videos' : 'times')
    } catch { }
  }

  async function loadSets() {
    setSetsLoading(true)
    try {
      const data = await api.get<TrainingSet[]>('/training/sets')
      setSets(data)
    } catch { }
    finally { setSetsLoading(false) }
  }

  async function loadVideos() {
    setVideosLoading(true)
    try {
      const data = await api.get<TrainingVideo[]>('/training/videos')
      setVideos(data)
    } catch { }
    finally { setVideosLoading(false) }
  }

  async function loadMembers() {
    try {
      const data = await api.get<MemberOption[]>('/members')
      setMembers(data.filter(m => ['cats', 'member', 'coach', 'committee', 'membership', 'finance', 'webmaster'].includes(m.role)))
    } catch { }
  }

  async function loadMemberTimes(memberId: number) {
    try {
      const data = await api.get<MemberTimeResponse[]>(`/training/times/${memberId}`)
      setMemberTimes(data)
      // Pre-populate edit values with existing times
      const initial: Record<number, string> = {}
      data.forEach(t => { if (t.value) initial[t.metricId] = t.value })
      setTimesEditing(initial)
    } catch { }
  }

  // ── Sets ──────────────────────────────────────────────────────────────────

  function openAddSet() {
    setEditingSet(null)
    setSetForm(emptySetForm)
    setSetError('')
    setSetModalOpen(true)
  }

  function openEditSet(s: TrainingSet) {
    setEditingSet(s)
    setSetForm({
      title:         s.title,
      description:   s.description ?? '',
      difficulty:    s.difficulty,
      category:      s.category,
      content:       s.content,
      totalDistance: s.totalDistance?.toString() ?? '',
    })
    setSetError('')
    setSetModalOpen(true)
  }

  async function handleSaveSet(e: React.FormEvent) {
    e.preventDefault()
    setSetError('')
    setSetSaving(true)
    try {
      const payload = {
        title:         setForm.title.trim(),
        description:   setForm.description.trim() || null,
        difficulty:    setForm.difficulty,
        category:      setForm.category.trim(),
        content:       setForm.content.trim(),
        totalDistance: setForm.totalDistance ? parseInt(setForm.totalDistance) : null,
        isActive:      true,
      }
      if (editingSet) {
        await api.put(`/training/sets/${editingSet.id}`, payload)
      } else {
        await api.post('/training/sets', payload)
      }
      setSetModalOpen(false)
      await loadSets()
    } catch (err) {
      setSetError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSetSaving(false) }
  }

  async function handleSetOfWeek(id: number) {
    try {
      await api.put(`/training/sets/${id}/week`, {})
      await loadSets()
    } catch { }
  }

  async function handleDeleteSet(s: TrainingSet) {
    if (!confirm(`Remove "${s.title}" from the library?`)) return
    try {
      await api.delete(`/training/sets/${s.id}`)
      await loadSets()
    } catch { }
  }

  // ── Videos ────────────────────────────────────────────────────────────────

  function openAddVideo() {
    setEditingVideo(null)
    setVideoForm(emptyVideoForm)
    setVideoError('')
    setVideoModalOpen(true)
  }

  function openEditVideo(v: TrainingVideo) {
    setEditingVideo(v)
    setVideoForm({
      title:       v.title,
      description: v.description ?? '',
      category:    v.category,
      youtubeUrl:  v.youtubeUrl,
    })
    setVideoError('')
    setVideoModalOpen(true)
  }

  async function handleSaveVideo(e: React.FormEvent) {
    e.preventDefault()
    setVideoError('')
    setVideoSaving(true)
    try {
      const payload = {
        title:       videoForm.title.trim(),
        description: videoForm.description.trim() || null,
        category:    videoForm.category.trim(),
        youtubeUrl:  videoForm.youtubeUrl.trim(),
        isActive:    true,
      }
      if (editingVideo) {
        await api.put(`/training/videos/${editingVideo.id}`, payload)
      } else {
        await api.post('/training/videos', payload)
      }
      setVideoModalOpen(false)
      await loadVideos()
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setVideoSaving(false) }
  }

  async function handleDeleteVideo(v: TrainingVideo) {
    if (!confirm(`Remove "${v.title}"?`)) return
    try {
      await api.delete(`/training/videos/${v.id}`)
      await loadVideos()
    } catch { }
  }

  // ── Member Times ──────────────────────────────────────────────────────────

  async function handleSaveTimes() {
    if (!selectedMemberId) return
    setTimesSaving(true)
    try {
      const entries = memberTimes.map(t => ({
        metricId: t.metricId,
        value: timesEditing[t.metricId] || null,
      }))
      await api.put(`/training/times/${selectedMemberId}`, { times: entries })
      await loadMemberTimes(selectedMemberId)
    } catch { }
    finally { setTimesSaving(false) }
  }

  const isWebmaster = currentRole === 'webmaster'
  const canEditTimes = ['coach', 'membership', 'webmaster'].includes(currentRole ?? '')

  // Group member times by category
  const timesByCategory = memberTimes.reduce((acc, t) => {
    const cat = t.category ?? 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<string, MemberTimeResponse[]>)

  const tabs: { key: ManageTab; label: string }[] = [
    { key: 'sets', label: settings?.setsLabel ?? 'Training Sets' },
    { key: 'videos', label: 'Videos' },
    ...(canEditTimes ? [{ key: 'times' as ManageTab, label: settings?.metricsLabel ?? 'Personal Bests' }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Manage Training</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Training Sets ──────────────────────────────────────────────── */}
      {activeTab === 'sets' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAddSet} className="btn-primary px-4 py-2">
              + Add {settings?.setsLabel ?? 'Training Set'}
            </button>
          </div>

          {setsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
            </div>
          ) : sets.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm text-gray-500">No training sets yet</p>
              <button onClick={openAddSet} className="btn-primary px-6 py-2 mt-4">
                Add First Set
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sets.map(s => (
                <div key={s.id} className={`card p-4 flex items-start gap-4 ${!s.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{s.title}</p>
                      {s.isSetOfWeek && (
                        <span className="badge text-xs text-white"
                          style={{ backgroundColor: 'var(--color-primary)' }}>
                          ⭐ Set of the Week
                        </span>
                      )}
                      <span className={`badge text-xs ${
                        s.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                        s.difficulty === 'intermediate' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1)}
                      </span>
                      <span className="badge bg-gray-100 text-gray-700 text-xs">{s.category}</span>
                      {s.totalDistance && (
                        <span className="text-xs text-gray-400">{s.totalDistance.toLocaleString()}m</span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{s.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!s.isSetOfWeek && (
                      <button onClick={() => handleSetOfWeek(s.id)}
                        className="btn-secondary text-xs px-3 py-1.5">
                        ⭐ Set of Week
                      </button>
                    )}
                    <button onClick={() => openEditSet(s)}
                      className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                    {isWebmaster && (
                      <button onClick={() => handleDeleteSet(s)}
                        className="btn-danger text-xs px-3 py-1.5">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Videos ─────────────────────────────────────────────────────── */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAddVideo} className="btn-primary px-4 py-2">
              + Add Video
            </button>
          </div>

          {videosLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1,2].map(i => <div key={i} className="card h-48 animate-pulse bg-gray-100" />)}
            </div>
          ) : videos.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">🎥</p>
              <p className="text-sm text-gray-500">No videos yet</p>
              <button onClick={openAddVideo} className="btn-primary px-6 py-2 mt-4">
                Add First Video
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map(v => (
                <div key={v.id} className={`card p-4 flex items-center gap-4 ${!v.isActive ? 'opacity-50' : ''}`}>
                  {v.thumbnailUrl && (
                    <img src={v.thumbnailUrl} alt={v.title}
                      className="w-20 h-14 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{v.category}</span>
                      {v.description && (
                        <span className="text-xs text-gray-400 truncate">{v.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEditVideo(v)}
                      className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                    {isWebmaster && (
                      <button onClick={() => handleDeleteVideo(v)}
                        className="btn-danger text-xs px-3 py-1.5">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Personal Bests Editor ──────────────────────────────────────── */}
      {activeTab === 'times' && canEditTimes && (
        <div className="space-y-4">
          <div>
            <label className="label">Select Member</label>
            <select className="input sm:w-80" value={selectedMemberId ?? ''}
              onChange={e => {
                const id = parseInt(e.target.value)
                setSelectedMemberId(id)
                loadMemberTimes(id)
              }}>
              <option value="">Choose a member…</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>

          {selectedMemberId && memberTimes.length > 0 && (
            <>
              {Object.entries(timesByCategory).map(([category, catTimes]) => (
                <div key={category}>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    {category}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {catTimes.map(t => (
                      <div key={t.metricId} className="card p-3">
                        <label className="text-xs text-gray-400 block mb-1">
                          {t.metricName}
                          <span className="text-gray-300 ml-1">({t.unit})</span>
                        </label>
                        <input
                          type="text"
                          placeholder={t.unit}
                          className="input text-sm"
                          value={timesEditing[t.metricId] ?? ''}
                          onChange={e => setTimesEditing(prev => ({
                            ...prev,
                            [t.metricId]: e.target.value
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <button onClick={handleSaveTimes} disabled={timesSaving}
                  className="btn-primary px-6 py-2.5">
                  {timesSaving ? 'Saving…' : 'Save Personal Bests'}
                </button>
              </div>
            </>
          )}

          {selectedMemberId && memberTimes.length === 0 && (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-sm text-gray-500">
                No metrics configured for this club yet
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Set Modal ─────────────────────────────────────────── */}
      {setModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {editingSet ? 'Edit' : 'Add'} {settings?.setsLabel ?? 'Training Set'}
              </h2>
              <button onClick={() => setSetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveSet} className="p-6 space-y-4">
              {setError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {setError}
                </div>
              )}
              <div>
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input type="text" required className="input"
                  value={setForm.title}
                  onChange={e => setSetForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <input type="text" className="input"
                  value={setForm.description}
                  onChange={e => setSetForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Difficulty <span className="text-red-500">*</span></label>
                  <select className="input" value={setForm.difficulty}
                    onChange={e => setSetForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {DIFFICULTIES.map(d => (
                      <option key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Category <span className="text-red-500">*</span></label>
                  <input type="text" required className="input"
                    placeholder="e.g. Endurance, Sprint, Technique"
                    value={setForm.category}
                    onChange={e => setSetForm(f => ({ ...f, category: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Total Distance (optional)</label>
                <input type="number" min="0" className="input" placeholder="metres"
                  value={setForm.totalDistance}
                  onChange={e => setSetForm(f => ({ ...f, totalDistance: e.target.value }))} />
              </div>
              <div>
                <label className="label">Set Content <span className="text-red-500">*</span></label>
                <textarea required className="input font-mono text-sm resize-none" rows={8}
                  placeholder={"e.g.\n400m Warm up\n4x100m @ 75% effort\n200m cool down"}
                  value={setForm.content}
                  onChange={e => setSetForm(f => ({ ...f, content: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={setSaving} className="btn-primary flex-1 py-2.5">
                  {setSaving ? 'Saving…' : editingSet ? 'Save Changes' : 'Create Set'}
                </button>
                <button type="button" onClick={() => setSetModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Video Modal ───────────────────────────────────────── */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {editingVideo ? 'Edit Video' : 'Add Video'}
              </h2>
              <button onClick={() => setVideoModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveVideo} className="p-6 space-y-4">
              {videoError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {videoError}
                </div>
              )}
              <div>
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input type="text" required className="input"
                  value={videoForm.title}
                  onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <input type="text" className="input"
                  value={videoForm.description}
                  onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Category <span className="text-red-500">*</span></label>
                <input type="text" required className="input"
                  placeholder="e.g. Drills, Strength, Stretches, Technique"
                  value={videoForm.category}
                  onChange={e => setVideoForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <label className="label">YouTube URL <span className="text-red-500">*</span></label>
                <input type="url" required className="input"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoForm.youtubeUrl}
                  onChange={e => setVideoForm(f => ({ ...f, youtubeUrl: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">
                  Supports youtube.com/watch, youtu.be, and embed URLs
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={videoSaving} className="btn-primary flex-1 py-2.5">
                  {videoSaving ? 'Saving…' : editingVideo ? 'Save Changes' : 'Add Video'}
                </button>
                <button type="button" onClick={() => setVideoModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}