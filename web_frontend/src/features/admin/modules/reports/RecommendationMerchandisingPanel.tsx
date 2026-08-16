import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, Pin, Plus, Save, Search, Trash2 } from 'lucide-react'
import { Button, EmptyState } from '../../components/ui'
import { useToast } from '../../notifications/notification-context'
import { listManagedProducts } from '../catalog/products/product.service'
import type { ManagedProduct } from '../catalog/products/product.types'
import type { RecommendationContext } from './recommendationAnalytics.types'
import {
  listRecommendationMerchandisingRules,
  updateRecommendationMerchandisingRule,
  type PinnedRecommendationProduct,
  type RecommendationMerchandisingRule,
} from './recommendationMerchandising.service'
import { getRecommendationProductCandidates } from './recommendationMerchandisingSearch'

const contexts: Array<{ value: RecommendationContext; label: string; helper: string }> = [
  { value: 'home', label: 'Trang chủ', helper: 'Ưu tiên sản phẩm trong khu vực gợi ý cá nhân.' },
  { value: 'product_detail_similar', label: 'Chi tiết sản phẩm', helper: 'Đặt sản phẩm nổi bật trước kết quả tương tự.' },
  { value: 'cart', label: 'Giỏ hàng', helper: 'Ưu tiên sản phẩm mua kèm phù hợp.' },
]

const toDateTimeLocal = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const toIsoDate = (value: string) => value ? new Date(value).toISOString() : null

const fromProduct = (product: ManagedProduct, position: number): PinnedRecommendationProduct => ({
  productId: product._id,
  position,
  name: product.name,
  image: product.productImage,
  isActive: product.isActive,
})

export function RecommendationMerchandisingPanel({ canManage }: { canManage: boolean }) {
  const { showBottomToast } = useToast()
  const [rules, setRules] = useState<RecommendationMerchandisingRule[]>([])
  const [products, setProducts] = useState<ManagedProduct[]>([])
  const [activeContext, setActiveContext] = useState<RecommendationContext>('home')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextRules, nextProducts] = await Promise.all([
        listRecommendationMerchandisingRules(),
        listManagedProducts(),
      ])
      setRules(nextRules)
      setProducts(nextProducts.filter((product) => product.isActive))
    } catch (caught) {
      showBottomToast(caught instanceof Error ? caught.message : 'Không thể tải cấu hình điều phối gợi ý.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showBottomToast])

  useEffect(() => { void load() }, [load])

  const activeRule = rules.find((rule) => rule.context === activeContext)
  const activeContextCopy = contexts.find((context) => context.value === activeContext)!
  const pinnedIds = useMemo(
    () => new Set(activeRule?.pinnedProducts.map((product) => product.productId) ?? []),
    [activeRule?.pinnedProducts],
  )
  const candidates = useMemo(() => {
    return getRecommendationProductCandidates(products, pinnedIds, search)
  }, [pinnedIds, products, search])

  const updateActiveRule = (updater: (rule: RecommendationMerchandisingRule) => RecommendationMerchandisingRule) => {
    setRules((current) => current.map((rule) => rule.context === activeContext ? updater(rule) : rule))
  }

  const addProduct = (product: ManagedProduct) => {
    if (!activeRule || activeRule.pinnedProducts.length >= 8) return
    updateActiveRule((rule) => ({
      ...rule,
      pinnedProducts: [...rule.pinnedProducts, fromProduct(product, rule.pinnedProducts.length + 1)],
    }))
  }

  const moveProduct = (index: number, direction: -1 | 1) => {
    if (!activeRule) return
    const target = index + direction
    if (target < 0 || target >= activeRule.pinnedProducts.length) return
    updateActiveRule((rule) => {
      const next = [...rule.pinnedProducts]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...rule, pinnedProducts: next.map((product, itemIndex) => ({ ...product, position: itemIndex + 1 })) }
    })
  }

  const removeProduct = (productId: string) => updateActiveRule((rule) => ({
    ...rule,
    pinnedProducts: rule.pinnedProducts
      .filter((product) => product.productId !== productId)
      .map((product, index) => ({ ...product, position: index + 1 })),
  }))

  const save = async () => {
    if (!activeRule || saving || !canManage) return
    setSaving(true)
    try {
      const saved = await updateRecommendationMerchandisingRule(activeContext, {
        enabled: activeRule.enabled,
        startsAt: activeRule.startsAt ? toIsoDate(activeRule.startsAt) : null,
        endsAt: activeRule.endsAt ? toIsoDate(activeRule.endsAt) : null,
        pinnedProductIds: activeRule.pinnedProducts.map((product) => product.productId),
      })
      setRules((current) => current.map((rule) => rule.context === activeContext ? saved : rule))
      showBottomToast(`Đã cập nhật điều phối gợi ý tại ${activeContextCopy.label}.`, 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể lưu điều phối gợi ý.'
      showBottomToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-rec-loading">Đang tải cấu hình điều phối...</div>

  return (
    <section className="admin-merchandising" aria-label="Điều phối gợi ý sản phẩm">
      <header className="admin-merchandising-heading">
        <div>
          <span><Pin aria-hidden="true" /> Điều phối thủ công</span>
          <h2>Ghim sản phẩm vào vị trí quan trọng</h2>
          <p>Sản phẩm hợp lệ được ghim trước; thuật toán tự lấp các vị trí còn lại.</p>
        </div>
        <Button variant="primary" icon={<Save aria-hidden="true" />} disabled={!canManage || saving} onClick={() => void save()}>
          {saving ? 'Đang lưu' : 'Lưu cấu hình'}
        </Button>
      </header>

      {!canManage ? <div className="admin-rec-error">Cần quyền catalog.write để thay đổi điều phối gợi ý.</div> : null}

      <nav className="admin-merchandising-contexts" aria-label="Vị trí gợi ý">
        {contexts.map((context) => (
          <button key={context.value} type="button" className={context.value === activeContext ? 'is-active' : ''} onClick={() => { setActiveContext(context.value); setSearch('') }}>
            <strong>{context.label}</strong><span>{context.helper}</span>
          </button>
        ))}
      </nav>

      {activeRule ? (
        <>
          <div className="admin-merchandising-schedule">
            <label className="admin-merchandising-switch">
              <input type="checkbox" checked={activeRule.enabled} disabled={!canManage} onChange={(event) => updateActiveRule((rule) => ({ ...rule, enabled: event.target.checked }))} />
              <span><strong>Đang áp dụng</strong><small>Tắt để tạm dừng mà không mất thứ tự đã chọn.</small></span>
            </label>
            <label><span><CalendarClock aria-hidden="true" /> Bắt đầu</span><input type="datetime-local" disabled={!canManage} value={toDateTimeLocal(activeRule.startsAt)} onChange={(event) => updateActiveRule((rule) => ({ ...rule, startsAt: event.target.value }))} /></label>
            <label><span><CalendarClock aria-hidden="true" /> Kết thúc</span><input type="datetime-local" disabled={!canManage} value={toDateTimeLocal(activeRule.endsAt)} onChange={(event) => updateActiveRule((rule) => ({ ...rule, endsAt: event.target.value }))} /></label>
          </div>

          <div className="admin-merchandising-grid">
            <section className="admin-merchandising-pinned">
              <header><div><h3>Sản phẩm đã ghim</h3><p>Vị trí 1 xuất hiện đầu tiên.</p></div><span>{activeRule.pinnedProducts.length}/8</span></header>
              {activeRule.pinnedProducts.length ? activeRule.pinnedProducts.map((product, index) => (
                <article key={product.productId}>
                  <b>{index + 1}</b>
                  {product.image ? <img src={product.image} alt="" /> : <span className="admin-merchandising-image-placeholder" />}
                  <div><strong>{product.name}</strong><span>{index === 0 ? 'Nổi bật đầu tiên' : `Vị trí ${index + 1}`}</span></div>
                  <div className="admin-merchandising-row-actions">
                    <button type="button" aria-label="Đưa sản phẩm lên" disabled={!canManage || index === 0} onClick={() => moveProduct(index, -1)}><ArrowUp /></button>
                    <button type="button" aria-label="Đưa sản phẩm xuống" disabled={!canManage || index === activeRule.pinnedProducts.length - 1} onClick={() => moveProduct(index, 1)}><ArrowDown /></button>
                    <button type="button" className="is-remove" aria-label="Bỏ ghim sản phẩm" disabled={!canManage} onClick={() => removeProduct(product.productId)}><Trash2 /></button>
                  </div>
                </article>
              )) : <EmptyState title="Chưa ghim sản phẩm" description="Thêm sản phẩm từ danh sách bên cạnh. Thuật toán vẫn hoạt động bình thường khi danh sách trống." />}
            </section>

            <section className="admin-merchandising-picker">
              <header><h3>Chọn sản phẩm</h3><p>Tìm theo tên, thương hiệu, danh mục hoặc mã SKU.</p></header>
              <label className="admin-merchandising-search"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, thương hiệu, SKU..." /></label>
              <div className="admin-merchandising-candidates">
                {candidates.map(({ product, isPinned }) => (
                  <article key={product._id}>
                    {product.productImage ? <img src={product.productImage} alt="" /> : <span className="admin-merchandising-image-placeholder" />}
                    <div><strong>{product.name}</strong><span>{product.brandName} · {product.categoryName}</span></div>
                    <button type="button" className={isPinned ? 'is-pinned' : ''} disabled={isPinned || !canManage || activeRule.pinnedProducts.length >= 8} onClick={() => addProduct(product)}>
                      {isPinned ? <><Pin aria-hidden="true" /> Đã ghim</> : <><Plus aria-hidden="true" /> Thêm</>}
                    </button>
                  </article>
                ))}
                {!candidates.length ? (
                  <p className="admin-merchandising-no-result">
                    {search.trim() ? `Không tìm thấy sản phẩm khớp với “${search.trim()}”.` : 'Không còn sản phẩm để thêm.'}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}
