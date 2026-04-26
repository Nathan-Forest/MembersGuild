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

export default function MyAccountPage() {
  const router = useRouter()
  const [data, setData] = useState<MyAccountResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }

    api.get<MyAccountResponse>('/credits/my-account')
      .then(setData)
      .catch(() => setError('Failed to load account data'))
      .finally(() => setLoading(false))
  }, [router])

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
          hint={data.creditBalance <= 2 && data.creditBalance > 0 ? 'Running low — visit the Swim Shop to top up' : undefined}
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
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            No transactions yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentTransactions.map(tx => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
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

function CreditCard({
  label, value, color, warning, hint
}: {
  label: string
  value: number
  color: 'blue' | 'amber'
  warning?: string
  hint?: string
}) {
  const bg    = color === 'blue'  ? 'bg-[var(--color-primary)]' : 'bg-amber-400'
  const text  = 'text-white'

  return (
    <div className={`${bg} ${text} rounded-xl p-6`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-5xl font-bold">{value}</p>
      {warning && (
        <p className="mt-2 text-sm opacity-90 flex items-center gap-1">
          <span>⚠️</span> {warning}
        </p>
      )}
      {hint && !warning && (
        <p className="mt-2 text-sm opacity-80">{hint}</p>
      )}
    </div>
  )
}

function TransactionRow({ tx }: { tx: TransactionResponse }) {
  const isCredit = tx.amount > 0
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
          {tx.notes && (
            <p className="text-xs text-gray-400 mt-0.5">{tx.notes}</p>
          )}
        </div>
      </div>

      <div className="text-right">
        <p className={`text-sm font-bold ${amountClass}`}>{amountLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Balance: {tx.balanceAfter} · {formatDate(tx.createdAt)}
        </p>
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