'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopCategory { id: number; name: string; slug: string; isSystem: boolean }
interface ShopItemVariant {
  id: number; name: string; stockQuantity: number; additionalPrice: number; isActive: boolean
}
interface ShopItem {
  id: number; name: string; description?: string
  category: string; categoryName: string; imageUrl?: string
  basePrice: number; creditValue?: number
  isActive: boolean; displayOrder: number
  variants: ShopItemVariant[]
}
interface CartItem {
  itemId: number; variantId?: number; quantity: number
  name: string; variantName?: string
  unitPrice: number; creditValue: number; categorySlug: string
}
interface CompletedOrder {
  id: number; paymentReference: string
  totalAmount: number; totalCredits: number
  items: { itemName: string; variantName?: string; quantity: number; unitPrice: number; lineTotal: number }[]
}
interface PaymentSettings {
  bankName?: string; accountName?: string
  bsb?: string; accountNumber?: string; paymentInstructions?: string
}

// ── Cart helpers (localStorage) ───────────────────────────────────────────────

function cartKey(slug: string) { return `mg_cart_${slug}` }

function loadCart(slug: string): CartItem[] {
  try { return JSON.parse(localStorage.getItem(cartKey(slug)) ?? '[]') }
  catch { return [] }
}

function persistCart(slug: string, cart: CartItem[]) {
  localStorage.setItem(cartKey(slug), JSON.stringify(cart))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const user = getCurrentUser()

  const [categories, setCategories]         = useState<ShopCategory[]>([])
  const [items, setItems]                   = useState<ShopItem[]>([])
  const [loading, setLoading]               = useState(true)
  const [selectedCat, setSelectedCat]       = useState('all')
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [slug, setSlug]                     = useState('')
  const [creditBalance, setCreditBalance]   = useState(0)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)

  // Variant picker
  const [variantItem, setVariantItem]       = useState<ShopItem | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null)
  const [variantQty, setVariantQty]         = useState(1)

  // Cart & checkout
  const [showCart, setShowCart]             = useState(false)
  const [checkingOut, setCheckingOut]       = useState(false)
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null)
  const [orderError, setOrderError]         = useState('')
  const [copied, setCopied]                 = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const s = window.location.hostname.split('.')[0]
    setSlug(s)
    setCart(loadCart(s))

    Promise.all([
      api.get<ShopCategory[]>('/shop/categories'),
      api.get<ShopItem[]>('/shop/items'),
      api.get<{ creditBalance: number }>('/credits/my-account').then(r => r.creditBalance).catch(() => 0),
      api.get<PaymentSettings>('/settings/payment').catch(() => null),
    ]).then(([cats, shopItems, balance, payment]) => {
      setCategories(cats)
      setItems(shopItems)
      setCreditBalance(balance)
      setPaymentSettings(payment)
    }).finally(() => setLoading(false))
  }, [])

  // ── Cart operations ──────────────────────────────────────────────────────────

  function updateCart(newCart: CartItem[]) {
    setCart(newCart)
    persistCart(slug, newCart)
  }

  function addToCart(item: ShopItem, variantId?: number, qty = 1) {
    const variant = variantId ? item.variants.find(v => v.id === variantId) : undefined
    const unitPrice = item.basePrice + (variant?.additionalPrice ?? 0)

    const existing = cart.find(c => c.itemId === item.id && c.variantId === variantId)
    if (existing) {
      updateCart(cart.map(c =>
        c.itemId === item.id && c.variantId === variantId
          ? { ...c, quantity: c.quantity + qty }
          : c
      ))
    } else {
      updateCart([...cart, {
        itemId: item.id, variantId, quantity: qty,
        name: item.name, variantName: variant?.name,
        unitPrice, creditValue: item.creditValue ?? 0,
        categorySlug: item.category,
      }])
    }
    setShowCart(true)
  }

  function removeFromCart(itemId: number, variantId?: number) {
    updateCart(cart.filter(c => !(c.itemId === itemId && c.variantId === variantId)))
  }

  function updateQty(itemId: number, variantId: number | undefined, qty: number) {
    if (qty < 1) { removeFromCart(itemId, variantId); return }
    updateCart(cart.map(c =>
      c.itemId === itemId && c.variantId === variantId ? { ...c, quantity: qty } : c
    ))
  }

  const cartTotal   = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0)
  const cartCredits = cart.reduce((sum, c) => sum + c.creditValue * c.quantity, 0)
  const cartCount   = cart.reduce((sum, c) => sum + c.quantity, 0)

  // ── Variant picker ───────────────────────────────────────────────────────────

  function openVariantPicker(item: ShopItem) {
    const activeVariants = item.variants.filter(v => v.isActive && v.stockQuantity > 0)
    if (activeVariants.length === 0) return
    if (activeVariants.length === 1) { addToCart(item, activeVariants[0].id); return }
    setVariantItem(item); setSelectedVariant(null); setVariantQty(1)
  }

  function handleAddClick(item: ShopItem) {
    if (item.category === 'credits') { addToCart(item); return }
    const active = item.variants.filter(v => v.isActive && v.stockQuantity > 0)
    if (item.variants.length === 0) { addToCart(item); return }
    openVariantPicker(item)
  }

  // ── Checkout ─────────────────────────────────────────────────────────────────

  async function checkout() {
    if (cart.length === 0) return
    setCheckingOut(true); setOrderError('')
    try {
      const order = await api.post<CompletedOrder>('/orders', {
        items: cart.map(c => ({ itemId: c.itemId, variantId: c.variantId ?? null, quantity: c.quantity }))
      })
      setCompletedOrder(order)
      updateCart([])
      setShowCart(false)
    } catch (err: any) {
      setOrderError(err.message ?? 'Checkout failed. Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  function copyReference() {
    if (!completedOrder) return
    navigator.clipboard.writeText(completedOrder.paymentReference)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const filteredItems = selectedCat === 'all'
    ? items
    : items.filter(i => i.category === selectedCat)

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => <div key={i} className="card h-48 animate-pulse bg-gray-100" />)}
    </div>
  )

  // ── Order Confirmation ────────────────────────────────────────────────────────

  if (completedOrder) return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="card p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">Order Confirmed!</h2>
        <p className="text-sm text-gray-500">
          Order #{completedOrder.id} · ${completedOrder.totalAmount.toFixed(2)} AUD
          {completedOrder.totalCredits > 0 && ` · 🪙 ${completedOrder.totalCredits} credits`}
        </p>

        {/* Payment Reference */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Your Payment Reference
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-bold text-gray-900 font-mono tracking-wider">
              {completedOrder.paymentReference}
            </span>
            <button onClick={copyReference}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Use this exact reference when transferring payment
          </p>
        </div>

        {/* Order Items */}
        <div className="text-left space-y-2 border-t border-gray-100 pt-4">
          {completedOrder.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.itemName}{item.variantName ? ` — ${item.variantName}` : ''} × {item.quantity}
              </span>
              <span className="font-medium">${item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Payment Instructions */}
        <div className="bg-blue-50 rounded-xl p-4 text-left space-y-2 border border-blue-100">
          <p className="text-sm font-semibold text-blue-900">Payment Instructions</p>
          {paymentSettings?.accountName ? (
            <div className="text-sm text-blue-800 space-y-1">
              {paymentSettings.bankName && <p>Bank: {paymentSettings.bankName}</p>}
              <p>Account Name: {paymentSettings.accountName}</p>
              {paymentSettings.bsb && <p>BSB: {paymentSettings.bsb}</p>}
              {paymentSettings.accountNumber && <p>Account: {paymentSettings.accountNumber}</p>}
              <p className="font-semibold">Reference: {completedOrder.paymentReference}</p>
              {paymentSettings.paymentInstructions && (
                <p className="text-xs mt-2">{paymentSettings.paymentInstructions}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-blue-800">
              Transfer ${completedOrder.totalAmount.toFixed(2)} to your club's bank account using
              reference <strong>{completedOrder.paymentReference}</strong>.
              Contact your club treasurer for bank details.
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Credits will be added to your account once payment is confirmed by the treasurer.
        </p>
        <button onClick={() => setCompletedOrder(null)}
          className="btn-primary px-6 py-2 text-sm w-full">
          Continue Shopping
        </button>
      </div>
    </div>
  )

  // ── Main Shop ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Swim Shop</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your credit balance: <span className="font-semibold text-gray-900">🪙 {creditBalance}</span>
          </p>
        </div>
        <button onClick={() => setShowCart(true)}
          className="relative btn-secondary px-4 py-2 text-sm flex items-center gap-2">
          🛒 Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary)' }}>
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setSelectedCat('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCat === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={selectedCat === 'all' ? { backgroundColor: 'var(--color-primary)' } : {}}>
          All
        </button>
        {categories.map(cat => (
          <button key={cat.slug} onClick={() => setSelectedCat(cat.slug)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCat === cat.slug ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={selectedCat === cat.slug ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {filteredItems.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">🛒</p>
          <p className="text-gray-500 text-sm">No items available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const activeVariants = item.variants.filter(v => v.isActive)
            const inStock = item.category === 'credits' || item.variants.length === 0
              || activeVariants.some(v => v.stockQuantity > 0)

            return (
              <div key={item.id} className={`card flex flex-col overflow-hidden ${!inStock ? 'opacity-60' : ''}`}>
                {/* Image */}
                <div className="h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl">
                      {item.category === 'credits' ? '🪙' : '📦'}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                    )}
                    {item.creditValue && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="badge bg-amber-100 text-amber-700 text-xs">
                          🪙 {item.creditValue} credit{item.creditValue !== 1 ? 's' : ''} granted
                        </span>
                      </div>
                    )}
                    {/* Variant stock summary */}
                    {activeVariants.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {activeVariants.filter(v => v.stockQuantity > 0).length} of {activeVariants.length} sizes available
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="font-bold text-gray-900">${item.basePrice.toFixed(2)}</p>
                    <button
                      onClick={() => handleAddClick(item)}
                      disabled={!inStock}
                      className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                      {!inStock ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Variant Picker Modal ─────────────────────────────────────────────── */}
      {variantItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{variantItem.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">${variantItem.basePrice.toFixed(2)} base price</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Option</label>
                <div className="grid grid-cols-2 gap-2">
                  {variantItem.variants.filter(v => v.isActive).map(v => (
                    <button key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      disabled={v.stockQuantity === 0}
                      className={`p-3 rounded-lg border-2 text-sm text-left transition-colors
                        ${v.stockQuantity === 0 ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50' :
                          selectedVariant === v.id
                            ? 'border-[var(--color-primary)] bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="font-medium">{v.name}</p>
                      {v.additionalPrice > 0 && (
                        <p className="text-xs text-gray-500">+${v.additionalPrice.toFixed(2)}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.stockQuantity === 0 ? 'Out of stock' : `${v.stockQuantity} left`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setVariantQty(Math.max(1, variantQty - 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                    −
                  </button>
                  <span className="font-medium w-8 text-center">{variantQty}</span>
                  <button onClick={() => setVariantQty(variantQty + 1)}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setVariantItem(null)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!selectedVariant) return
                  addToCart(variantItem, selectedVariant, variantQty)
                  setVariantItem(null)
                }}
                disabled={!selectedVariant}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cart Drawer ──────────────────────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="w-full max-w-sm bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🛒</p>
                  <p className="text-sm text-gray-500">Your cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={`${item.itemId}-${item.variantId}`}
                    className="flex items-start gap-3 pb-4 border-b border-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      {item.variantName && (
                        <p className="text-xs text-gray-500">{item.variantName}</p>
                      )}
                      {item.creditValue > 0 && (
                        <p className="text-xs text-amber-600">🪙 +{item.creditValue * item.quantity} credits</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                        <button onClick={() => updateQty(item.itemId, item.variantId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800">
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQty(item.itemId, item.variantId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800">
                          +
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.itemId, item.variantId)}
                        className="text-red-400 hover:text-red-600 text-sm">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-gray-100 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-gray-900">${cartTotal.toFixed(2)} AUD</span>
                  </div>
                  {cartCredits > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Credits you'll receive</span>
                      <span className="font-semibold text-amber-600">🪙 +{cartCredits}</span>
                    </div>
                  )}
                </div>

                {orderError && (
                  <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{orderError}</p>
                )}

                <button onClick={checkout} disabled={checkingOut}
                  className="btn-primary w-full py-3 text-sm font-semibold">
                  {checkingOut ? 'Placing Order...' : `Place Order · $${cartTotal.toFixed(2)}`}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Payment by bank transfer. Credits released after confirmation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}