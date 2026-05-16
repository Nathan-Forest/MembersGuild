'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderSummary {
  id: number
  paymentReference: string
  memberName: string
  memberEmail: string
  status: string
  totalAmount: number
  totalCredits: number
  createdAt: string
  paymentConfirmedAt?: string
}

interface OrderDetail extends OrderSummary {
  paymentMethod: string
  paymentReceiptNumber?: string
  confirmedByName?: string
  fulfillmentNotes?: string
  deliveredAt?: string
  cancelledAt?: string
  items: {
    id: number
    itemName: string
    categorySlug?: string
    variantName?: string
    quantity: number
    unitPrice: number
    creditValue: number
    lineTotal: number
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'all',              label: 'All' },
  { key: 'pending',          label: 'Pending' },
  { key: 'payment_confirmed',label: 'Confirmed' },
  { key: 'pending_delivery', label: 'Pending Delivery' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'cancelled',        label: 'Cancelled' },
]

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:           'bg-amber-100 text-amber-700',
    payment_confirmed: 'bg-blue-100 text-blue-700',
    pending_delivery:  'bg-purple-100 text-purple-700',
    delivered:         'bg-green-100 text-green-700',
    cancelled:         'bg-gray-100 text-gray-500',
  }
  const labels: Record<string, string> = {
    pending:           'Pending Payment',
    payment_confirmed: 'Payment Confirmed',
    pending_delivery:  'Pending Delivery',
    delivered:         'Delivered',
    cancelled:         'Cancelled',
  }
  return { cls: map[status] ?? 'bg-gray-100 text-gray-500', label: labels[status] ?? status }
}

function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShopOrdersPage() {
  const user   = getCurrentUser()
  const router = useRouter()

  const isFinance   = user?.role === 'finance' || user?.role === 'webmaster'
  const isCommittee = user?.role === 'committee' || isFinance

  const [orders, setOrders]           = useState<OrderSummary[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [detail, setDetail]           = useState<Record<number, OrderDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)

  // Confirm payment modal
  const [confirmingId, setConfirmingId]   = useState<number | null>(null)
  const [receiptNumber, setReceiptNumber] = useState('')
  const [confirmNotes, setConfirmNotes]   = useState('')
  const [confirming, setConfirming]       = useState(false)
  const [confirmError, setConfirmError]   = useState('')

  // Deliver modal
  const [deliveringId, setDeliveringId]   = useState<number | null>(null)
  const [deliverNotes, setDeliverNotes]   = useState('')
  const [delivering, setDelivering]       = useState(false)

  // Cancel
  const [cancellingId, setCancellingId]   = useState<number | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isCommittee) { router.replace('/dashboard'); return }
    loadOrders()
  }, [statusFilter])

  async function loadOrders() {
    setLoading(true)
    try {
      const url = statusFilter === 'all' ? '/orders' : `/orders?status=${statusFilter}`
      const data = await api.get<OrderSummary[]>(url)
      setOrders(data)
    } catch (err) {
      console.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: number) {
    if (detail[id]) { setExpandedId(expandedId === id ? null : id); return }
    setLoadingDetail(id)
    try {
      const data = await api.get<OrderDetail>(`/orders/${id}`)
      setDetail(prev => ({ ...prev, [id]: data }))
      setExpandedId(id)
    } catch (err) {
      console.error('Failed to load order detail:', err)
    } finally {
      setLoadingDetail(null)
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function confirmPayment() {
    if (!confirmingId || !receiptNumber.trim()) { setConfirmError('Receipt number is required.'); return }
    setConfirming(true); setConfirmError('')
    try {
      const updated = await api.post<OrderDetail>(`/orders/${confirmingId}/confirm`, {
        receiptNumber: receiptNumber.trim(),
        notes: confirmNotes.trim() || null,
      })
      setDetail(prev => ({ ...prev, [confirmingId]: updated }))
      setOrders(prev => prev.map(o => o.id === confirmingId
        ? { ...o, status: updated.status, paymentConfirmedAt: updated.paymentConfirmedAt }
        : o))
      setConfirmingId(null); setReceiptNumber(''); setConfirmNotes('')
    } catch (err: any) {
      setConfirmError(err.message ?? 'Failed to confirm payment.')
    } finally {
      setConfirming(false)
    }
  }

  async function markDelivered() {
    if (!deliveringId) return
    setDelivering(true)
    try {
      const updated = await api.post<OrderDetail>(`/orders/${deliveringId}/deliver`, {
        notes: deliverNotes.trim() || null,
      })
      setDetail(prev => ({ ...prev, [deliveringId]: updated }))
      setOrders(prev => prev.map(o => o.id === deliveringId ? { ...o, status: updated.status } : o))
      setDeliveringId(null); setDeliverNotes('')
    } catch (err: any) {
      alert(err.message ?? 'Failed to mark as delivered.')
    } finally {
      setDelivering(false)
    }
  }

  async function cancelOrder(id: number) {
    if (!confirm('Cancel this order? Stock will be restored.')) return
    setCancellingId(id)
    try {
      const updated = await api.post<OrderDetail>(`/orders/${id}/cancel`, {})
      setDetail(prev => ({ ...prev, [id]: updated }))
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
    } catch (err: any) {
      alert(err.message ?? 'Failed to cancel order.')
    } finally {
      setCancellingId(null)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const pendingCount  = orders.filter(o => o.status === 'pending').length
  const pendingValue  = orders.filter(o => o.status === 'pending')
    .reduce((sum, o) => sum + o.totalAmount, 0)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Shop Orders</h1>
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
            <span className="font-semibold text-amber-700">{pendingCount} pending</span>
            <span className="text-amber-600"> · ${pendingValue.toFixed(2)} awaiting payment</span>
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map(tab => {
            const count = tab.key === 'all'
              ? orders.length
              : orders.filter(o => o.status === tab.key).length
            return (
              <button key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`pb-3 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  statusFilter === tab.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
                {count > 0 && statusFilter !== tab.key && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const badge   = statusBadge(order.status)
            const isOpen  = expandedId === order.id
            const d       = detail[order.id]
            const loading = loadingDetail === order.id

            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Order row */}
                <button
                  onClick={() => loadDetail(order.id)}
                  className="w-full p-4 text-left flex items-center gap-4 hover:bg-gray-50 transition-colors">

                  {/* Reference + member */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-gray-900 text-sm">
                        {order.paymentReference}
                      </span>
                      <span className={`badge text-xs ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {order.memberName} · {order.memberEmail}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(order.createdAt)}</p>
                  </div>

                  {/* Totals */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">${order.totalAmount.toFixed(2)}</p>
                    {order.totalCredits > 0 && (
                      <p className="text-xs text-amber-600">🪙 +{order.totalCredits} credits</p>
                    )}
                  </div>

                  {/* Chevron */}
                  <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>

                {/* Expanded detail */}
                {(isOpen || loading) && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {loading ? (
                      <div className="p-4 text-sm text-gray-500 text-center">Loading...</div>
                    ) : d ? (
                      <div className="p-4 space-y-4">

                        {/* Line items */}
                        <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
                          {d.items.map(item => (
                            <div key={item.id} className="px-4 py-3 flex justify-between text-sm">
                              <div>
                                <span className="font-medium text-gray-900">{item.itemName}</span>
                                {item.variantName && (
                                  <span className="text-gray-500"> — {item.variantName}</span>
                                )}
                                <span className="text-gray-400"> × {item.quantity}</span>
                                {item.creditValue > 0 && (
                                  <span className="ml-2 text-xs text-amber-600">
                                    🪙 +{item.creditValue * item.quantity}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium text-gray-900">${item.lineTotal.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="px-4 py-3 flex justify-between text-sm font-semibold bg-gray-50">
                            <span>Total</span>
                            <span>${d.totalAmount.toFixed(2)} AUD</span>
                          </div>
                        </div>

                        {/* Audit info */}
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Ordered: {fmt(d.createdAt)}</p>
                          {d.paymentConfirmedAt && (
                            <p>Payment confirmed: {fmt(d.paymentConfirmedAt)}
                              {d.paymentReceiptNumber && ` · Receipt: ${d.paymentReceiptNumber}`}
                              {d.confirmedByName && ` · by ${d.confirmedByName}`}
                            </p>
                          )}
                          {d.deliveredAt && <p>Delivered: {fmt(d.deliveredAt)}</p>}
                          {d.cancelledAt && <p>Cancelled: {fmt(d.cancelledAt)}</p>}
                          {d.fulfillmentNotes && <p>Notes: {d.fulfillmentNotes}</p>}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          {d.status === 'pending' && isFinance && (
                            <button
                              onClick={() => { setConfirmingId(d.id); setConfirmError('') }}
                              className="btn-primary text-sm px-4 py-2">
                              ✓ Confirm Payment
                            </button>
                          )}
                          {d.status === 'pending_delivery' && isCommittee && (
                            <button
                              onClick={() => setDeliveringId(d.id)}
                              className="btn-primary text-sm px-4 py-2">
                              📦 Mark Delivered
                            </button>
                          )}
                          {(d.status === 'pending' || d.status === 'payment_confirmed' || d.status === 'pending_delivery') && isFinance && (
                            <button
                              onClick={() => cancelOrder(d.id)}
                              disabled={cancellingId === d.id}
                              className="btn-danger text-sm px-4 py-2">
                              {cancellingId === d.id ? 'Cancelling...' : 'Cancel Order'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Confirm Payment Modal ────────────────────────────────────────────── */}
      {confirmingId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Confirm Payment</h2>
              <p className="text-sm text-gray-500 mt-1">
                Order {orders.find(o => o.id === confirmingId)?.paymentReference}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt / Reference Number <span className="text-red-500">*</span>
                </label>
                <input className="input w-full" autoFocus
                  placeholder="e.g. bank transaction ID or receipt number"
                  value={receiptNumber}
                  onChange={e => setReceiptNumber(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">
                  The bank transaction reference you can see in your account statement
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea className="input w-full h-20 resize-none"
                  placeholder="Any notes about this payment..."
                  value={confirmNotes}
                  onChange={e => setConfirmNotes(e.target.value)} />
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
                ⚠️ Confirming this will immediately release{' '}
                <strong>
                  {detail[confirmingId]?.totalCredits
                    ? `🪙 ${detail[confirmingId].totalCredits} credits`
                    : 'credits'}
                </strong>{' '}
                to the member's account.
              </div>
              {confirmError && <p className="text-sm text-red-500">{confirmError}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setConfirmingId(null); setReceiptNumber(''); setConfirmNotes('') }}
                className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={confirmPayment} disabled={confirming}
                className="btn-primary px-4 py-2 text-sm">
                {confirming ? 'Confirming...' : 'Confirm & Release Credits'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark Delivered Modal ─────────────────────────────────────────────── */}
      {deliveringId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Mark as Delivered</h2>
              <p className="text-sm text-gray-500 mt-1">
                Confirm that physical items have been handed to the member
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea className="input w-full h-20 resize-none"
                  placeholder="e.g. collected at Saturday training session"
                  value={deliverNotes}
                  onChange={e => setDeliverNotes(e.target.value)} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setDeliveringId(null); setDeliverNotes('') }}
                className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={markDelivered} disabled={delivering}
                className="btn-primary px-4 py-2 text-sm">
                {delivering ? 'Saving...' : '📦 Mark Delivered'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}