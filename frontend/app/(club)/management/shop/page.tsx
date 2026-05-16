'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopCategory {
  id: number
  name: string
  slug: string
  isSystem: boolean
  displayOrder: number
  isActive: boolean
}

interface ShopItemVariant {
  id: number
  name: string
  stockQuantity: number
  additionalPrice: number
  isActive: boolean
}

interface ShopItem {
  id: number
  name: string
  description?: string
  category: string
  categoryName: string
  imageUrl?: string
  basePrice: number
  creditValue?: number
  isSystem: boolean
  isActive: boolean
  displayOrder: number
  variants: ShopItemVariant[]
}

const emptyItem = {
  name: '', description: '', category: 'credits',
  basePrice: 0, creditValue: undefined as number | undefined,
  isActive: true, displayOrder: 0,
}

const emptyVariant = { name: '', stockQuantity: 0, additionalPrice: 0 }
const emptyCategory = { name: '', slug: '', displayOrder: 0 }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManageShopPage() {
  const user = getCurrentUser()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'settings'>('items')
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [itemForm, setItemForm] = useState({ ...emptyItem })
  const [itemSaving, setItemSaving] = useState(false)
  const [itemError, setItemError] = useState('')

  // Variant modal
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [variantItem, setVariantItem] = useState<ShopItem | null>(null)
  const [editingVariant, setEditingVariant] = useState<ShopItemVariant | null>(null)
  const [variantForm, setVariantForm] = useState({ ...emptyVariant })
  const [variantSaving, setVariantSaving] = useState(false)

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<ShopCategory | null>(null)
  const [catForm, setCatForm] = useState({ ...emptyCategory })
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState('')

  // Settings
  const [creditPrice, setCreditPrice] = useState<number>(5)
  const [newCreditPrice, setNewCreditPrice] = useState('')
  const [priceSaving, setPriceSaving] = useState(false)
  const [priceSuccess, setPriceSuccess] = useState(false)

  // Payment settings state
  const [paymentForm, setPaymentForm] = useState({
    bankName: '', accountName: '', bsb: '', accountNumber: '', paymentInstructions: ''
  })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Image upload
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFor, setUploadingFor] = useState<number | null>(null)

  const isWebmaster = user?.role === 'webmaster'

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isWebmaster) { router.replace('/dashboard'); return }
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [cats, shopItems, priceRes] = await Promise.all([
        api.get<ShopCategory[]>('/shop/categories?includeInactive=true'),
        api.get<ShopItem[]>('/shop/items?includeInactive=true'),
        api.get<{ pricePerCredit: number }>('/shop/credit-price'),
      ])
      setCategories(cats)
      setItems(shopItems)
      setCreditPrice(priceRes.pricePerCredit)
      setNewCreditPrice(priceRes.pricePerCredit.toString())
    } catch (err) {
      console.error('Failed to load shop data:', err)
    } finally {
      setLoading(false)
    }

    const payment = await api.get<any>('/settings/payment').catch(() => null)
    if (payment) {
      setPaymentForm({
        bankName: payment.bankName ?? '',
        accountName: payment.accountName ?? '',
        bsb: payment.bsb ?? '',
        accountNumber: payment.accountNumber ?? '',
        paymentInstructions: payment.paymentInstructions ?? '',
      })
    }
  }
  // ── Items ─────────────────────────────────────────────────────────────────

  function openAddItem() {
    const defaultCat = categories.find(c => c.isActive)?.slug ?? 'credits'
    setEditingItem(null)
    setItemForm({ ...emptyItem, category: defaultCat })
    setItemError('')
    setShowItemModal(true)
  }

  function openEditItem(item: ShopItem) {
    setEditingItem(item)
    setItemForm({
      name: item.name, description: item.description ?? '',
      category: item.category, basePrice: item.basePrice,
      creditValue: item.creditValue, isActive: item.isActive,
      displayOrder: item.displayOrder,
    })
    setItemError('')
    setShowItemModal(true)
  }

  async function saveItem() {
    if (!itemForm.name.trim()) { setItemError('Name is required.'); return }
    if (itemForm.basePrice <= 0) { setItemError('Price must be greater than zero.'); return }
    setItemSaving(true); setItemError('')
    try {
      if (editingItem) {
        const updated = await api.put<ShopItem>(`/shop/items/${editingItem.id}`, itemForm)
        setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i))
      } else {
        const created = await api.post<ShopItem>('/shop/items', itemForm)
        setItems(prev => [...prev, created])
      }
      setShowItemModal(false)
    } catch (err: any) {
      setItemError(err.message ?? 'Failed to save item.')
    } finally {
      setItemSaving(false)
    }
  }

  async function savePaymentSettings() {
    setPaymentSaving(true)
    try {
      await api.put('/settings/payment', paymentForm)
      setPaymentSuccess(true)
      setTimeout(() => setPaymentSuccess(false), 3000)
    } catch (err: any) {
      alert(err.message ?? 'Failed to save payment details.')
    } finally {
      setPaymentSaving(false)
    }
  }

  async function deleteItem(item: ShopItem) {
    if (item.isSystem) return
    if (!confirm(`Remove "${item.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/shop/items/${item.id}`)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } catch (err: any) {
      alert(err.message ?? 'Failed to remove item.')
    }
  }

  // ── Image Upload ──────────────────────────────────────────────────────────

  async function handleImageUpload(itemId: number, file: File) {
    setUploadingFor(itemId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = document.cookie.match(/token=([^;]+)/)?.[1] ?? ''
      const slug = window.location.hostname.split('.')[0]
      const res = await fetch(`/api/shop/items/${itemId}/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Club-Slug': slug,
        },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, imageUrl: data.imageUrl } : i))
    } catch (err: any) {
      alert(err.message ?? 'Image upload failed.')
    } finally {
      setUploadingFor(null)
    }
  }

  // ── Variants ──────────────────────────────────────────────────────────────

  function openAddVariant(item: ShopItem) {
    setVariantItem(item); setEditingVariant(null)
    setVariantForm({ ...emptyVariant }); setShowVariantModal(true)
  }

  function openEditVariant(item: ShopItem, variant: ShopItemVariant) {
    setVariantItem(item); setEditingVariant(variant)
    setVariantForm({ name: variant.name, stockQuantity: variant.stockQuantity, additionalPrice: variant.additionalPrice })
    setShowVariantModal(true)
  }

  async function saveVariant() {
    if (!variantItem) return
    setVariantSaving(true)
    try {
      if (editingVariant) {
        const updated = await api.put<ShopItemVariant>(
          `/shop/variants/${editingVariant.id}`,
          { ...variantForm, isActive: editingVariant.isActive }
        )
        setItems(prev => prev.map(i => i.id === variantItem.id
          ? { ...i, variants: i.variants.map(v => v.id === editingVariant.id ? updated : v) }
          : i))
      } else {
        const created = await api.post<ShopItemVariant>(
          `/shop/items/${variantItem.id}/variants`, variantForm)
        setItems(prev => prev.map(i => i.id === variantItem.id
          ? { ...i, variants: [...i.variants, created] }
          : i))
      }
      setShowVariantModal(false)
    } catch (err: any) {
      alert(err.message ?? 'Failed to save variant.')
    } finally {
      setVariantSaving(false)
    }
  }

  async function deleteVariant(item: ShopItem, variant: ShopItemVariant) {
    if (!confirm(`Remove variant "${variant.name}"?`)) return
    try {
      await api.delete(`/shop/variants/${variant.id}`)
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, variants: i.variants.filter(v => v.id !== variant.id) }
        : i))
    } catch (err: any) {
      alert(err.message ?? 'Failed to remove variant.')
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────

  function openAddCategory() {
    setEditingCat(null); setCatForm({ ...emptyCategory }); setCatError(''); setShowCatModal(true)
  }

  function openEditCategory(cat: ShopCategory) {
    setEditingCat(cat)
    setCatForm({ name: cat.name, slug: cat.slug, displayOrder: cat.displayOrder })
    setCatError(''); setShowCatModal(true)
  }

  async function saveCategory() {
    if (!catForm.name.trim()) { setCatError('Name is required.'); return }
    if (!catForm.slug.trim()) { setCatError('Slug is required.'); return }
    setCatSaving(true); setCatError('')
    try {
      if (editingCat) {
        const updated = await api.put<ShopCategory>(
          `/shop/categories/${editingCat.id}`,
          { name: catForm.name, displayOrder: catForm.displayOrder, isActive: true }
        )
        setCategories(prev => prev.map(c => c.id === editingCat.id ? updated : c))
      } else {
        const created = await api.post<ShopCategory>('/shop/categories', catForm)
        setCategories(prev => [...prev, created])
      }
      setShowCatModal(false)
    } catch (err: any) {
      setCatError(err.message ?? 'Failed to save category.')
    } finally {
      setCatSaving(false)
    }
  }

  async function deleteCategory(cat: ShopCategory) {
    if (cat.isSystem) return
    if (!confirm(`Delete category "${cat.name}"?`)) return
    try {
      await api.delete(`/shop/categories/${cat.id}`)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
    } catch (err: any) {
      alert(err.message ?? 'Failed to delete category.')
    }
  }

  // ── Credit Price ──────────────────────────────────────────────────────────

  async function saveCreditPrice() {
    const price = parseFloat(newCreditPrice)
    if (isNaN(price) || price <= 0) return
    setPriceSaving(true)
    try {
      await api.put('/shop/credit-price', { pricePerCredit: price })
      setCreditPrice(price)
      setPriceSuccess(true)
      setTimeout(() => setPriceSuccess(false), 3000)
      // Reload items to get updated system pack prices
      const updated = await api.get<ShopItem[]>('/shop/items?includeInactive=true')
      setItems(updated)
    } catch (err: any) {
      alert(err.message ?? 'Failed to update credit price.')
    } finally {
      setPriceSaving(false)
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const filteredItems = categoryFilter === 'all'
    ? items
    : items.filter(i => i.category === categoryFilter)

  const activeCategories = categories.filter(c => c.isActive)

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Manage Shop</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {(['items', 'categories', 'settings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
              {tab === 'items' ? 'Shop Items' : tab === 'categories' ? 'Categories' : 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Items Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Category filter pills */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${categoryFilter === 'all'
                  ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                style={categoryFilter === 'all' ? { backgroundColor: 'var(--color-primary)' } : {}}>
                All
              </button>
              {activeCategories.map(cat => (
                <button key={cat.slug} onClick={() => setCategoryFilter(cat.slug)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${categoryFilter === cat.slug
                    ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  style={categoryFilter === cat.slug ? { backgroundColor: 'var(--color-primary)' } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>
            <button onClick={openAddItem} className="btn-primary px-4 py-2 text-sm">
              + Add Item
            </button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-3xl mb-3">🛒</p>
              <p className="text-sm text-gray-500">No items yet</p>
              <button onClick={openAddItem} className="btn-primary px-6 py-2 mt-4 text-sm">
                Add First Item
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(item => (
                <div key={item.id} className={`card p-4 ${!item.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Image */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">
                            {item.category === 'credits' ? '🪙' : '📦'}
                          </span>
                        )}
                      </div>
                      {item.category !== 'credits' && (
                        <button
                          onClick={() => { setUploadingFor(item.id); imageInputRef.current?.click() }}
                          className="absolute -bottom-1 -right-1 bg-white border border-gray-200 rounded-full p-0.5 text-xs hover:bg-gray-50"
                          title="Upload image">
                          {uploadingFor === item.id ? '⏳' : '📷'}
                        </button>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.isSystem && (
                          <span className="badge bg-blue-100 text-blue-700 text-xs">System</span>
                        )}
                        {!item.isActive && (
                          <span className="badge bg-gray-100 text-gray-500 text-xs">Inactive</span>
                        )}
                        <span className="badge bg-gray-100 text-gray-600 text-xs">{item.categoryName}</span>
                        {item.creditValue && (
                          <span className="badge bg-amber-100 text-amber-700 text-xs">
                            🪙 {item.creditValue} credit{item.creditValue !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                      )}
                      <p className="text-sm font-medium text-gray-700 mt-1">
                        ${item.basePrice.toFixed(2)} AUD
                      </p>

                      {/* Variants */}
                      {item.category !== 'credits' && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.variants.map(v => (
                              <span key={v.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                {v.name}
                                {v.additionalPrice > 0 && ` +$${v.additionalPrice.toFixed(2)}`}
                                · {v.stockQuantity} in stock
                                <button onClick={() => openEditVariant(item, v)}
                                  className="text-blue-500 hover:text-blue-700 ml-0.5">✏️</button>
                                <button onClick={() => deleteVariant(item, v)}
                                  className="text-red-400 hover:text-red-600">×</button>
                              </span>
                            ))}
                            <button onClick={() => openAddVariant(item)}
                              className="text-xs text-[var(--color-primary)] hover:underline">
                              + Add Variant
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => openEditItem(item)}
                        className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                      {!item.isSystem && (
                        <button onClick={() => deleteItem(item)}
                          className="btn-danger text-xs px-3 py-1.5">Remove</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hidden image input */}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file && uploadingFor) handleImageUpload(uploadingFor, file)
              e.target.value = ''
            }} />
        </div>
      )}

      {/* ── Categories Tab ────────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAddCategory} className="btn-primary px-4 py-2 text-sm">
              + Add Category
            </button>
          </div>
          <div className="space-y-3">
            {categories.map(cat => (
              <div key={cat.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{cat.name}</p>
                      {cat.isSystem && (
                        <span className="badge bg-blue-100 text-blue-700 text-xs">System</span>
                      )}
                      {!cat.isActive && (
                        <span className="badge bg-gray-100 text-gray-500 text-xs">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">slug: {cat.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!cat.isSystem && (
                    <>
                      <button onClick={() => openEditCategory(cat)}
                        className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                      <button onClick={() => deleteCategory(cat)}
                        className="btn-danger text-xs px-3 py-1.5">Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settings Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-lg">

          {/* Credit Price card — already exists, keep it */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Credit Price</h3>
              <p className="text-sm text-gray-500 mt-1">
                Sets the price per credit. Updating this automatically recalculates
                the standard 1, 5, and 10 credit pack prices.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input type="number" min="0.01" step="0.01"
                  value={newCreditPrice}
                  onChange={e => setNewCreditPrice(e.target.value)}
                  className="input pl-7 w-full" placeholder="5.00" />
              </div>
              <span className="text-sm text-gray-500">AUD per credit</span>
              <button onClick={saveCreditPrice} disabled={priceSaving}
                className="btn-primary px-4 py-2 text-sm">
                {priceSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
            {priceSuccess && (
              <p className="text-sm text-green-600">
                ✓ Credit price updated. Standard pack prices recalculated.
              </p>
            )}
            <p className="text-xs text-gray-400">Current price: ${creditPrice.toFixed(2)} per credit</p>
          </div>

          {/* Payment / Bank Details */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Bank Transfer Details</h3>
              <p className="text-sm text-gray-500 mt-1">
                Shown to members after placing an order so they know where to transfer payment.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input className="input w-full" placeholder="e.g. Commonwealth Bank"
                  value={paymentForm.bankName}
                  onChange={e => setPaymentForm(f => ({ ...f, bankName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input className="input w-full" placeholder="e.g. Brisbane Southside Masters Swimming Club"
                  value={paymentForm.accountName}
                  onChange={e => setPaymentForm(f => ({ ...f, accountName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BSB</label>
                  <input className="input w-full font-mono" placeholder="062-000"
                    value={paymentForm.bsb}
                    onChange={e => setPaymentForm(f => ({ ...f, bsb: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input className="input w-full font-mono" placeholder="12345678"
                    value={paymentForm.accountNumber}
                    onChange={e => setPaymentForm(f => ({ ...f, accountNumber: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Instructions</label>
                <textarea className="input w-full h-20 resize-none"
                  placeholder="e.g. Please include your member number in the description."
                  value={paymentForm.paymentInstructions}
                  onChange={e => setPaymentForm(f => ({ ...f, paymentInstructions: e.target.value }))} />
              </div>
            </div>
            {paymentSuccess && (
              <p className="text-sm text-green-600">✓ Payment details saved.</p>
            )}
            <button onClick={savePaymentSettings} disabled={paymentSaving}
              className="btn-primary px-4 py-2 text-sm">
              {paymentSaving ? 'Saving...' : 'Save Bank Details'}
            </button>
          </div>

        </div>
      )}

      {/* ── Item Modal ────────────────────────────────────────────────────── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">
                {editingItem ? 'Edit Item' : 'Add Item'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input className="input w-full" value={itemForm.name}
                  onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input w-full h-20 resize-none" value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="input w-full" value={itemForm.category}
                  disabled={editingItem?.isSystem}
                  onChange={e => setItemForm(f => ({ ...f, category: e.target.value, creditValue: e.target.value !== 'credits' ? undefined : f.creditValue }))}>
                  {activeCategories.map(cat => (
                    <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (AUD)</label>
                  <input type="number" min="0.01" step="0.01" className="input w-full"
                    value={itemForm.basePrice}
                    onChange={e => setItemForm(f => ({ ...f, basePrice: parseFloat(e.target.value) || 0 }))} />
                </div>
                {itemForm.category === 'credits' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credits Granted</label>
                    <input type="number" min="1" step="1" className="input w-full"
                      value={itemForm.creditValue ?? ''}
                      onChange={e => setItemForm(f => ({ ...f, creditValue: parseInt(e.target.value) || undefined }))} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input type="number" min="0" className="input w-full" value={itemForm.displayOrder}
                  onChange={e => setItemForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} />
              </div>
              {editingItem && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={itemForm.isActive}
                    onChange={e => setItemForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              )}
              {itemError && <p className="text-sm text-red-500">{itemError}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={saveItem} disabled={itemSaving} className="btn-primary px-4 py-2 text-sm">
                {itemSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Variant Modal ─────────────────────────────────────────────────── */}
      {showVariantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">
                {editingVariant ? 'Edit Variant' : 'Add Variant'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{variantItem?.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variant Name</label>
                <input className="input w-full" placeholder="e.g. Large, Blue/White"
                  value={variantForm.name}
                  onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                <input type="number" min="0" className="input w-full"
                  value={variantForm.stockQuantity}
                  onChange={e => setVariantForm(f => ({ ...f, stockQuantity: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Price (AUD)</label>
                <input type="number" min="0" step="0.01" className="input w-full"
                  value={variantForm.additionalPrice}
                  onChange={e => setVariantForm(f => ({ ...f, additionalPrice: parseFloat(e.target.value) || 0 }))} />
                <p className="text-xs text-gray-400 mt-1">Added on top of the base item price</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowVariantModal(false)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={saveVariant} disabled={variantSaving} className="btn-primary px-4 py-2 text-sm">
                {variantSaving ? 'Saving...' : editingVariant ? 'Save' : 'Add Variant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ────────────────────────────────────────────────── */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">
                {editingCat ? 'Edit Category' : 'Add Category'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input className="input w-full" placeholder="e.g. Merchandise, Event Tickets"
                  value={catForm.name}
                  onChange={e => {
                    const name = e.target.value
                    setCatForm(f => ({
                      ...f, name,
                      slug: editingCat ? f.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                    }))
                  }} />
              </div>
              {!editingCat && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input className="input w-full font-mono" placeholder="merchandise"
                    value={catForm.slug}
                    onChange={e => setCatForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
                  <p className="text-xs text-gray-400 mt-1">Unique identifier, letters and hyphens only</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input type="number" min="0" className="input w-full"
                  value={catForm.displayOrder}
                  onChange={e => setCatForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} />
              </div>
              {catError && <p className="text-sm text-red-500">{catError}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCatModal(false)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={saveCategory} disabled={catSaving} className="btn-primary px-4 py-2 text-sm">
                {catSaving ? 'Saving...' : editingCat ? 'Save' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}