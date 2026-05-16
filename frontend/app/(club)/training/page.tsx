'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrainingSettings {
  metricsEnabled: boolean
  setsEnabled: boolean
  videosEnabled: boolean
  setsLabel: string
  metricsLabel: string
}

interface MemberTimeResponse {
  metricId: number
  metricName: string
  unit: string
  category: string | null
  value: string | null
  updatedAt: string | null
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

type Tab = 'pbs' | 'sets' | 'videos'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     'bg-green-100 text-green-800',
  intermediate: 'bg-amber-100 text-amber-800',
  advanced:     'bg-red-100 text-red-800',
}

function getYoutubeEmbedUrl(url: string): string {
  let videoId = ''
  if (url.includes('youtu.be/'))
    videoId = url.split('youtu.be/').pop()?.split('?')[0] ?? ''
  else if (url.includes('v='))
    videoId = url.split('v=').pop()?.split('&')[0] ?? ''
  else if (url.includes('/embed/'))
    videoId = url.split('/embed/').pop()?.split('?')[0] ?? ''
  return `https://www.youtube.com/embed/${videoId}`
}

export default function TrainingPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<TrainingSettings | null>(null)
  const [times, setTimes] = useState<MemberTimeResponse[]>([])
  const [sets, setSets] = useState<TrainingSet[]>([])
  const [setOfWeek, setSetOfWeek] = useState<TrainingSet | null>(null)
  const [videos, setVideos] = useState<TrainingVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('pbs')

  // Filters
  const [setDifficulty, setSetDifficulty] = useState('')
  const [setCategory, setSetCategory] = useState('')
  const [videoCategory, setVideoCategory] = useState('')

  // Video modal
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentRole(user.role as UserRole)
    loadAll()
  }, [router])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, t, sets, sow, v] = await Promise.all([
        api.get<TrainingSettings>('/training/settings'),
        api.get<MemberTimeResponse[]>('/training/times/mine'),
        api.get<TrainingSet[]>('/training/sets'),
        api.get<TrainingSet | null>('/training/sets/week'),
        api.get<TrainingVideo[]>('/training/videos'),
      ])
      setSettings(s)
      setTimes(t)
      setSets(sets)
      setSetOfWeek(sow)
      setVideos(v)

      // Set default tab to first enabled feature
      if (!s.metricsEnabled) setActiveTab(s.setsEnabled ? 'sets' : 'videos')
    } catch { }
    finally { setLoading(false) }
  }

  // Group times by category
  const timesByCategory = times.reduce((acc, t) => {
    const cat = t.category ?? 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<string, MemberTimeResponse[]>)

  // Filter sets
  const filteredSets = sets.filter(s => {
    if (setDifficulty && s.difficulty !== setDifficulty) return false
    if (setCategory && s.category !== setCategory) return false
    return true
  })

  const setCategories = [...new Set(sets.map(s => s.category))]
  const videoCategories = [...new Set(videos.map(v => v.category))]
  const filteredVideos = videoCategory
    ? videos.filter(v => v.category === videoCategory)
    : videos

  const tabs = [
    settings?.metricsEnabled && { key: 'pbs' as Tab, label: settings.metricsLabel },
    settings?.setsEnabled    && { key: 'sets' as Tab, label: settings.setsLabel },
    settings?.videosEnabled  && { key: 'videos' as Tab, label: 'Videos' },
  ].filter(Boolean) as { key: Tab; label: string }[]

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Training</h1>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="card p-4 h-32 animate-pulse bg-gray-100" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Training</h1>

      {/* Tabs */}
      {tabs.length > 1 && (
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
      )}

      {/* ── Personal Bests Tab ─────────────────────────────────────────── */}
      {activeTab === 'pbs' && settings.metricsEnabled && (
        <div className="space-y-6">
          {times.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">🏆</p>
              <p className="text-sm font-medium text-gray-600">No personal bests recorded yet</p>
              <p className="text-xs text-gray-400 mt-1">Ask your coach to enter your times</p>
            </div>
          ) : (
            Object.entries(timesByCategory).map(([category, categoryTimes]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  {category}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {categoryTimes.map(t => (
                    <div key={t.metricId} className="card p-4">
                      <p className="text-xs text-gray-400 mb-1">{t.metricName}</p>
                      {t.value ? (
                        <>
                          <p className="text-2xl font-bold text-gray-900">{t.value}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {t.updatedAt
                              ? new Date(t.updatedAt).toLocaleDateString('en-AU', {
                                  day: 'numeric', month: 'short', year: 'numeric'
                                })
                              : ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-xl text-gray-300 font-medium">—</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Training Sets Tab ──────────────────────────────────────────── */}
      {activeTab === 'sets' && settings.setsEnabled && (
        <div className="space-y-6">
          {/* Set of the Week */}
          {setOfWeek && (
            <div className="card p-6 border-2"
              style={{ borderColor: 'var(--color-primary)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⭐</span>
                <span className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-primary)' }}>
                  {settings.setsLabel} of the Week
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">{setOfWeek.title}</h3>
              {setOfWeek.description && (
                <p className="text-sm text-gray-500 mb-3">{setOfWeek.description}</p>
              )}
              <div className="flex items-center gap-3 mb-4">
                <span className={`badge text-xs ${DIFFICULTY_COLORS[setOfWeek.difficulty] ?? 'bg-gray-100 text-gray-700'}`}>
                  {setOfWeek.difficulty.charAt(0).toUpperCase() + setOfWeek.difficulty.slice(1)}
                </span>
                <span className="badge bg-gray-100 text-gray-700 text-xs">{setOfWeek.category}</span>
                {setOfWeek.totalDistance && (
                  <span className="text-xs text-gray-400">{setOfWeek.totalDistance.toLocaleString()}m total</span>
                )}
              </div>
              <pre className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap font-mono">
                {setOfWeek.content}
              </pre>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select className="input sm:w-44" value={setDifficulty}
              onChange={e => setSetDifficulty(e.target.value)}>
              <option value="">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select className="input sm:w-44" value={setCategory}
              onChange={e => setSetCategory(e.target.value)}>
              <option value="">All Categories</option>
              {setCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Sets list */}
          {filteredSets.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm text-gray-500">No training sets found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSets.filter(s => !s.isSetOfWeek).map(s => (
                <div key={s.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{s.title}</h3>
                      {s.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge text-xs ${DIFFICULTY_COLORS[s.difficulty] ?? 'bg-gray-100 text-gray-700'}`}>
                        {s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1)}
                      </span>
                      <span className="badge bg-gray-100 text-gray-700 text-xs">{s.category}</span>
                      {s.totalDistance && (
                        <span className="text-xs text-gray-400">{s.totalDistance.toLocaleString()}m</span>
                      )}
                    </div>
                  </div>
                  <pre className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap font-mono">
                    {s.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Videos Tab ────────────────────────────────────────────────── */}
      {activeTab === 'videos' && settings.videosEnabled && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-3">
            <select className="input sm:w-44" value={videoCategory}
              onChange={e => setVideoCategory(e.target.value)}>
              <option value="">All Categories</option>
              {videoCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">🎥</p>
              <p className="text-sm text-gray-500">No videos available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map(v => (
                <button key={v.id} onClick={() => setSelectedVideo(v)}
                  className="card overflow-hidden text-left hover:shadow-md transition-shadow">
                  {v.thumbnailUrl ? (
                    <div className="relative">
                      <img src={v.thumbnailUrl} alt={v.title}
                        className="w-full h-44 object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow">
                          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-44 bg-gray-100 flex items-center justify-center">
                      <span className="text-4xl">🎥</span>
                    </div>
                  )}
                  <div className="p-4">
                    <span className="badge bg-gray-100 text-gray-600 text-xs mb-2">{v.category}</span>
                    <p className="font-semibold text-gray-900 leading-snug">{v.title}</p>
                    {v.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{v.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Video Player Modal ─────────────────────────────────────────── */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">{selectedVideo.title}</h2>
                <span className="badge bg-gray-100 text-gray-600 text-xs mt-1">{selectedVideo.category}</span>
              </div>
              <button onClick={() => setSelectedVideo(null)}
                className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={getYoutubeEmbedUrl(selectedVideo.youtubeUrl)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {selectedVideo.description && (
              <div className="p-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">{selectedVideo.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}