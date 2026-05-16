'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import type { MyAccountResponse, TransactionResponse } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  session_booking:   'Session booking',
  session_refund:    'Session refund',
  nsba_refund:       'NSBA refund',
  manual_add:        'Credits added',
  manual_remove:     'Credits removed',
  shop_purchase:     'Shop purchase',
  shop_refund:       'Shop refund',
  cats_initial:      'Welcome credits',
  payment_confirmed: 'Payment confirmed',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Order types ───────────────────────────────────────────────────────────────

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
  paymentReceiptNumber?: string
  fulfillmentNotes?: string
  deliveredAt?: string
  cancelledAt?: string
  items: {
    id: number
    itemName: string
    variantName?: string
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

function orderStatusBadge(status: string) {
  const map: Record<string, { cls: string; label: string; icon: string }> = {
    pending:           { cls: 'bg-amber-100 text-amber-700',   label: 'Awaiting Payment',  icon: '⏳' },
    payment_confirmed: { cls: 'bg-blue-100 text-blue-700',     label: 'Payment Confirmed', icon: '✓'  },
    pending_delivery:  { cls: 'bg-purple-100 text-purple-700', label: 'Pending Delivery',  icon: '📦' },
    delivered:         { cls: 'bg-green-100 text-green-700',   label: 'Delivered',         icon: '✅' },
    cancelled:         { cls: 'bg-gray-100 text-gray-500',     label: 'Cancelled',         icon: '✕'  },
  }
  return map[status] ?? { cls: 'bg-gray-100 text-gray-500', label: status, icon: '?' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyAccountPage() {
  const router = useRouter()
  const [data, setData]       = useState<MyAccountResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Orders
  const [orders, setOrders]               = useState<OrderSummary[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [orderDetails, setOrderDetails]   = useState<Record<number, OrderDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [copied, setCopied]               = useState<string | null>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }

    // Load credits + orders + payment settings in parallel
    api.get<MyAccountResponse>('/credits/my-account')
      .then(setData)
      .catch(() => setError('Failed to load account data'))
      .finally(() => setLoading(false))

    api.get<OrderSummary[]>('/orders/mine')
      .then(setOrders)
      .catch(() => {})
      .finally(() => setOrdersLoading(false))

    api.get<PaymentSettings>('/settings/payment')
      .then(setPaymentSettings)
      .catch(() => {})
  }, [router])

  async function loadOrderDetail(id: number) {
    if (orderDetails[id]) {
      setExpandedOrder(expandedOrder === id ? null : id)
      return
    }
    setLoadingDetail(id)
    try {
      const d = await api.get<OrderDetail>(`/orders/mine/${id}`)
      setOrderDetails(prev => ({ ...prev, [id]: d }))
      setExpandedOrder(id)
    } catch { }
    finally { setLoadingDetail(null) }
  }

  function copyRef(ref: string) {
    navigator.clipboard.writeText(ref)
    setCopied(ref)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <PageShell><LoadingState /></PageShell>
  if (error)   return <PageShell><ErrorState message={error} /></PageShell>
  if (!data)   return null

  return (
    <PageShell>
      {/* Credit summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CreditCard
          label="Available Credits"
          value={data.creditBalance}
          color="blue"
          warning={data.creditBalance === 0 ? 'You have no credits remaining' : undefined}
          hint={data.creditBalance <= 2 && data.creditBalance > 0
            ? 'Running low — visit the Swim Shop to top up' : undefined}
        />
        <CreditCard
          label="Pending Credits"
          value={data.pendingCredits}
          color="amber"
          hint={data.pendingCredits > 0
            ? 'Awaiting payment confirmation from Finance'
            : 'No pending orders'}
        />
      </div>

      {/* Transaction history */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Transaction History</h2>
        </div>
        {data.recentTransactions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No transactions yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentTransactions.map(tx => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>

      {/* ── Order History ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Order History</h2>
        </div>

        {ordersLoading ? (
          <div className="p-6 space-y-3">
            {[1,2].map(i => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-3">
            <p className="text-sm text-gray-400">No orders yet</p>
            <a href="/shop"
              className="inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
              Visit the Swim Shop →
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map(order => {
              const badge  = orderStatusBadge(order.status)
              const isOpen = expandedOrder === order.id
              const d      = orderDetails[order.id]

              return (
                <div key={order.id}>
                  {/* Order row */}
                  <button
                    onClick={() => loadOrderDetail(order.id)}
                    className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors text-left">
                    <span className="text-lg flex-shrink-0">{badge.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {order.paymentReference}
                        </span>
                        <span className={`badge text-xs ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        ${order.totalAmount.toFixed(2)}
                      </p>
                      {order.totalCredits > 0 && (
                        <p className="text-xs text-amber-600">🪙 +{order.totalCredits}</p>
                      )}
                    </div>
                    <span className={`text-gray-400 text-xs transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 space-y-4">
                      {loadingDetail === order.id ? (
                        <p className="text-sm text-gray-400 text-center py-2">Loading...</p>
                      ) : d ? (
                        <>
                          {/* Pending payment instructions */}
                          {d.status === 'pending' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                              <p className="text-sm font-semibold text-amber-900">⏳ Payment Required</p>
                              <div className="bg-white rounded-lg border border-amber-200 p-3">
                                <p className="text-xs text-amber-600 font-medium mb-1">
                                  YOUR PAYMENT REFERENCE
                                </p>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-mono font-bold text-gray-900 text-lg tracking-wider">
                                    {d.paymentReference}
                                  </span>
                                  <button
                                    onClick={e => { e.stopPropagation(); copyRef(d.paymentReference) }}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex-shrink-0">
                                    {copied === d.paymentReference ? '✓ Copied' : 'Copy'}
                                  </button>
                                </div>
                                <p className="text-xs text-amber-600 mt-1">
                                  Use this exact reference in your bank transfer
                                </p>
                              </div>
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
                                    <p className="text-xs mt-1 text-amber-700">{paymentSettings.paymentInstructions}</p>
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
                                <span className="font-medium text-gray-900">
                                  ${item.lineTotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
                            <div className="px-4 py-3 flex justify-between text-sm font-semibold bg-gray-50">
                              <span>Total</span>
                              <span>${d.totalAmount.toFixed(2)} AUD</span>
                            </div>
                          </div>

                          {/* Timeline */}
                          <div className="text-xs text-gray-400 space-y-1">
                            <p>📅 Ordered {formatDate(d.createdAt)}</p>
                            {d.paymentConfirmedAt && (
                              <p>✓ Payment confirmed {formatDate(d.paymentConfirmedAt)}
                                {d.paymentReceiptNumber && ` · Receipt: ${d.paymentReceiptNumber}`}
                              </p>
                            )}
                            {d.deliveredAt && <p>📦 Delivered {formatDate(d.deliveredAt)}</p>}
                            {d.cancelledAt && <p>✕ Cancelled {formatDate(d.cancelledAt)}</p>}
                            {d.fulfillmentNotes && <p>💬 {d.fulfillmentNotes}</p>}
                          </div>

                          {/* Credits confirmed banner */}
                          {(d.status === 'payment_confirmed' || d.status === 'delivered') && d.totalCredits > 0 && (
                            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700">
                              🪙 <strong>{d.totalCredits} credits</strong> have been added to your account.
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* How credits work */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">How Credits Work</h3>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• Each training session costs 1 credit</li>
          <li>• Credits are deducted when you register for a session</li>
          <li>• If you advise you can't attend (NSBA), your credit is refunded</li>
          <li>• Purchase credit packs from the Swim Shop</li>
          <li>• Credits are released once your payment is confirmed</li>
        </ul>
      </div>
    </PageShell>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="page-title">My Account</h1>
      {children}
    </div>
  )
}

function CreditCard({ label, value, color, warning, hint }: {
  label: string; value: number; color: 'blue' | 'amber'; warning?: string; hint?: string
}) {
  const bg = color === 'blue' ? 'bg-[var(--color-primary)]' : 'bg-amber-400'
  return (
    <div className={`${bg} text-white rounded-xl p-6`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-5xl font-bold">{value}</p>
      {warning && <p className="mt-2 text-sm opacity-90 flex items-center gap-1"><span>⚠️</span> {warning}</p>}
      {hint && !warning && <p className="mt-2 text-sm opacity-80">{hint}</p>}
    </div>
  )
}

function TransactionRow({ tx }: { tx: TransactionResponse }) {
  const isCredit    = tx.amount > 0
  const amountClass = isCredit ? 'text-green-600' : 'text-red-600'
  const amountLabel = isCredit ? `+${tx.amount}` : `${tx.amount}`
  return (
    <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
          ${isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isCredit ? '+' : '−'}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
          </p>
          {tx.notes && <p className="text-xs text-gray-400 mt-0.5">{tx.notes}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${amountClass}`}>{amountLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">Balance: {tx.balanceAfter} · {formatDate(tx.createdAt)}</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 rounded-xl bg-gray-200" />
        <div className="h-32 rounded-xl bg-gray-200" />
      </div>
      <div className="h-64 rounded-xl bg-gray-200" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}