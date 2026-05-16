'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface ClubUpdate {
  id: number
  title: string
  content: string
  authorName: string
  createdAt: string
}

const MAX_CHARS = 1000

export default function ManageUpdatesPage() {
  const user   = getCurrentUser()
  const router = useRouter()

  const [updates, setUpdates]   = useState<ClubUpdate[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const canPost    = ['committee', 'membership', 'finance', 'webmaster'].includes(user?.role ?? '')
  const isWebmaster = user?.role === 'webmaster'

  useEffect(() => {
    if (!canPost) { router.replace('/dashboard'); return }
    api.get<ClubUpdate[]>('/updates')
      .then(setUpdates)
      .finally(() => setLoading(false))
  }, [])

  async function post() {
    if (!content.trim()) { setError('Content is required.'); return }
    if (content.length > MAX_CHARS) { setError(`Max ${MAX_CHARS} characters.`); return }
    setSaving(true); setError('')
    try {
      const update = await api.post<ClubUpdate>('/updates', {
        title: title.trim() || null,
        content: content.trim(),
      })
      setUpdates(prev => [update, ...prev])
      setTitle(''); setContent(''); setShowForm(false)
    } catch (err: any) {
      setError(err.message ?? 'Failed to post update.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Remove this update?')) return
    try {
      await api.delete(`/updates/${id}`)
      setUpdates(prev => prev.filter(u => u.id !== id))
    } catch (err: any) {
      alert(err.message ?? 'Failed to remove update.')
    }
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Club Updates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Short updates shown on every member's dashboard
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
            + Post Update
          </button>
        )}
      </div>

      {/* Post form */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">New Update</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input className="input w-full"
              placeholder="e.g. Competition this Saturday!"
              value={title}
              onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={4}
              placeholder="Keep it short — one paragraph. Members see this on their dashboard."
              value={content}
              maxLength={MAX_CHARS}
              onChange={e => setContent(e.target.value)} />
            <div className="flex justify-between mt-1">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <p className={`text-xs ml-auto ${content.length > MAX_CHARS * 0.9 ? 'text-amber-500' : 'text-gray-400'}`}>
                {content.length}/{MAX_CHARS}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setTitle(''); setContent(''); setError('') }}
              className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button onClick={post} disabled={saving}
              className="btn-primary px-4 py-2 text-sm">
              {saving ? 'Posting...' : 'Post Update'}
            </button>
          </div>
        </div>
      )}

      {/* Updates list */}
      {updates.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-3xl">📢</p>
          <p className="text-sm text-gray-500">No updates posted yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary px-6 py-2 text-sm">
            Post First Update
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u, i) => (
            <div key={u.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="badge text-xs text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        Latest
                      </span>
                    )}
                    {u.title && (
                      <p className="font-semibold text-gray-900">{u.title}</p>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">{u.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {u.authorName} · {new Date(u.createdAt).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <button onClick={() => remove(u.id)}
                  className="btn-danger text-xs px-3 py-1.5 flex-shrink-0">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}