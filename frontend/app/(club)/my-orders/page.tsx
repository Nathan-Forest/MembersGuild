'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderSummary {
  id: number
  paymentReference: string
  status: string
  totalAmount: number
  totalCredits: number
  createdAt: string
  paymentConfirmedAt?: string
}

interface OrderDetail extends OrderSummary {
  paymentMethod: string
  paymentReceiptNumber?: string
  fulfillmentNotes?: string
  deliveredAt?: string
  cancelledAt?: string
  items: {
    id: number
    itemName: string
    variantName?: string
    categorySlug?: string
    quantity: number
    unitPrice: number
    creditValue: number
    lineTotal: number
  }[]
}

interface PaymentSettings {
  bankName?: string
  accountName?: string
  bsb?: string
  accountNumber?: string
  paymentInstructions?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string; icon: string }> = {
    pending:           { cls: 'bg-amber-100 text-amber-700',  label: 'Awaiting Payment',    icon: '⏳' },
    payment_confirmed: { cls: 'bg-blue-100 text-blue-700',    label: 'Payment Confirmed',   icon: '✓'  },
    pending_delivery:  { cls: 'bg-purple-100 text-purple-700',label: 'Pending Delivery',    icon: '📦' },
    delivered:         { cls: 'bg-green-100 text-green-700',  label: 'Delivered',           icon: '✅' },
    cancelled:         { cls: 'bg-gray-100 text-gray-500',    label: 'Cancelled',           icon: '✕'  },
  }
  return map[status] ?? { cls: 'bg-gray-100 text-gray-500', label: status, icon: '?' }
}

function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyOrdersPage() {
  const [orders, setOrders]           = useState<OrderSummary[]>([])
  const [loading, setLoading]         = useState(true)
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [details, setDetails]         = useState<Record<number, OrderDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [copied, setCopied]           = useState<string | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get<OrderSummary[]>('/orders/mine'),
      api.get<PaymentSettings>('/settings/payment').catch(() => null),
    ]).then(([myOrders, payment]) => {
      setOrders(myOrders)
      setPaymentSettings(payment)
    }).finally(() => setLoading(false))
  }, [])

  async function loadDetail(id: number) {
    if (details[id]) {
      setExpandedId(expandedId === id ? null : id)
      return
    }
    setLoadingDetail(id)
    try {
      const data = await api.get<OrderDetail>(`/orders/mine/${id}`)
      setDetails(prev => ({ ...prev, [id]: data }))
      setExpandedId(id)
    } catch (err) {
      console.error('Failed to load order:', err)
    } finally {
      setLoadingDetail(null)
    }
  }

  function copyRef(ref: string) {
    navigator.clipboard.writeText(ref)
    setCopied(ref)
    setTimeout(() => setCopied(null), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-6 space-y-3 max-w-2xl mx-auto">
      {[1,2,3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>

      {orders.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-4xl">🛒</p>
          <p className="text-gray-500 text-sm">No orders yet</p>
          <a href="/shop" className="btn-primary px-6 py-2 text-sm inline-block">
            Visit the Shop
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const badge   = statusBadge(order.status)
            const isOpen  = expandedId === order.id
            const d       = details[order.id]
            const pending = order.status === 'pending'

            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => loadDetail(order.id)}
                  className="w-full p-4 text-left flex items-center gap-4 hover:bg-gray-50 transition-colors">

                  {/* Status icon */}
                  <div className="text-2xl flex-shrink-0">{badge.icon}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-gray-900 text-sm">
                        {order.paymentReference}
                      </span>
                      <span className={`badge text-xs ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(order.createdAt)}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">${order.totalAmount.toFixed(2)}</p>
                    {order.totalCredits > 0 && (
                      <p className="text-xs text-amber-600">🪙 +{order.totalCredits}</p>
                    )}
                  </div>

                  <span className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {loadingDetail === order.id ? (
                      <div className="p-4 text-sm text-gray-400 text-center">Loading...</div>
                    ) : d ? (
                      <div className="p-4 space-y-4">

                        {/* Pending payment banner */}
                        {pending && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-semibold text-amber-900">
                              ⏳ Payment Required
                            </p>

                            {/* Payment reference - prominent copy */}
                            <div className="bg-white rounded-lg border border-amber-200 p-3">
                              <p className="text-xs text-amber-600 font-medium mb-1">
                                YOUR PAYMENT REFERENCE
                              </p>
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-mono font-bold text-gray-900 text-lg tracking-wider">
                                  {order.paymentReference}
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); copyRef(order.paymentReference) }}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex-shrink-0">
                                  {copied === order.paymentReference ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                              <p className="text-xs text-amber-600 mt-1">
                                Use this exact reference in your bank transfer
                              </p>
                            </div>

                            {/* Bank details */}
                            {paymentSettings?.accountName ? (
                              <div className="text-sm text-amber-800 space-y-0.5">
                                {paymentSettings.bankName && (
                                  <p>Bank: <span className="font-medium">{paymentSettings.bankName}</span></p>
                                )}
                                <p>Account Name: <span className="font-medium">{paymentSettings.accountName}</span></p>
                                {paymentSettings.bsb && (
                                  <p>BSB: <span className="font-mono font-medium">{paymentSettings.bsb}</span></p>
                                )}
                                {paymentSettings.accountNumber && (
                                  <p>Account: <span className="font-mono font-medium">{paymentSettings.accountNumber}</span></p>
                                )}
                                {paymentSettings.paymentInstructions && (
                                  <p className="text-xs mt-2 text-amber-700">{paymentSettings.paymentInstructions}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-amber-800">
                                Contact your club treasurer for bank details.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Items */}
                        <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                          {d.items.map(item => (
                            <div key={item.id} className="px-4 py-3 flex justify-between text-sm">
                              <div>
                                <span className="text-gray-900 font-medium">{item.itemName}</span>
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
                              <span className="font-medium text-gray-900">
                                ${item.lineTotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          <div className="px-4 py-3 flex justify-between text-sm font-semibold">
                            <span>Total</span>
                            <span>${d.totalAmount.toFixed(2)} AUD</span>
                          </div>
                        </div>

                        {/* Status timeline */}
                        <div className="text-xs text-gray-400 space-y-1">
                          <p>📅 Ordered {fmt(d.createdAt)}</p>
                          {d.paymentConfirmedAt && (
                            <p>✓ Payment confirmed {fmt(d.paymentConfirmedAt)}
                              {d.paymentReceiptNumber && ` · Receipt: ${d.paymentReceiptNumber}`}
                            </p>
                          )}
                          {d.deliveredAt && <p>📦 Delivered {fmt(d.deliveredAt)}</p>}
                          {d.cancelledAt && <p>✕ Cancelled {fmt(d.cancelledAt)}</p>}
                          {d.fulfillmentNotes && <p>💬 {d.fulfillmentNotes}</p>}
                        </div>

                        {/* Credits note for confirmed/delivered */}
                        {(d.status === 'payment_confirmed' || d.status === 'delivered') && d.totalCredits > 0 && (
                          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700">
                            🪙 <strong>{d.totalCredits} credits</strong> have been added to your account.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}