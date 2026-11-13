import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { invalidateLiveCatalogue } from '../../data/live'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  deleteProduct,
  duplicateProduct,
  listAdminProducts,
  levelOf,
  setProductStatus,
  type AdminProduct,
  type ProductStatus,
} from '../api'
import { useAsync, useDebounced } from '../hooks'
import { dateOnly, money, number } from '../format'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui'
import { IconDuplicate, IconPlus, IconSearch, IconTrash } from '../icons'

type SortKey = 'newest' | 'title' | 'price-asc' | 'price-desc' | 'stock'

const statusFilters: { value: ProductStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
]

const stockOf = (product: AdminProduct) =>
  (product.product_variants ?? [])
    .filter((variant) => variant.is_active !== false)
    .reduce((total, variant) => total + levelOf(variant).available_quantity, 0)

export function ProductsPage() {
  useDocumentTitle('Products — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(listAdminProducts, [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [status, setStatus] = useState<ProductStatus | 'all'>('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<AdminProduct | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const products = data ?? []

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products],
  )

  const counts = useMemo(
    () => ({
      all: products.length,
      published: products.filter((product) => product.status === 'published').length,
      draft: products.filter((product) => product.status === 'draft').length,
      archived: products.filter((product) => product.status === 'archived').length,
    }),
    [products],
  )

  const visible = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    const filtered = products.filter((product) => {
      if (status !== 'all' && product.status !== status) return false
      if (category !== 'all' && product.category !== category) return false
      if (!term) return true
      return [product.title, product.handle, product.sku ?? '', product.category, ...(product.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'price-asc':
          return Number(a.price) - Number(b.price)
        case 'price-desc':
          return Number(b.price) - Number(a.price)
        case 'stock':
          return stockOf(a) - stockOf(b)
        case 'newest':
        default:
          return +new Date(b.created_at) - +new Date(a.created_at)
      }
    })
  }, [products, status, category, debounced, sort])

  const run = async (id: string, action: () => Promise<unknown>, message: string) => {
    setBusyId(id)
    setNotice(null)
    try {
      await action()
      invalidateLiveCatalogue()
      setNotice(message)
      reload()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'The action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  const togglePublish = (product: AdminProduct) => {
    const next: ProductStatus = product.status === 'published' ? 'draft' : 'published'
    void run(
      product.id,
      () => setProductStatus(product.id, next),
      next === 'published'
        ? `${product.title} is now live on the storefront.`
        : `${product.title} was moved to drafts and removed from the storefront.`,
    )
  }

  const confirmDelete = async () => {
    if (!removing) return
    setDeleteBusy(true)
    try {
      await deleteProduct(removing.id)
      invalidateLiveCatalogue()
      setNotice(`${removing.title} was permanently deleted.`)
      setRemoving(null)
      reload()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'The product could not be deleted.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Create, edit and publish pieces. Published products appear on the storefront automatically."
        actions={
          <Link className="admin-btn admin-btn--primary" to="/admin/products/new">
            <IconPlus /> Add product
          </Link>
        }
      />

      {notice && (
        <Notice tone="info" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <div className="admin-toolbar">
        <div className="admin-tabs">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={status === filter.value ? 'is-active' : ''}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
              <span>{counts[filter.value]}</span>
            </button>
          ))}
        </div>
        <div className="admin-toolbar__right">
          <label className="admin-search">
            <IconSearch />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, handle, SKU or tag"
              aria-label="Search products"
            />
          </label>
          <select
            className="admin-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort products"
          >
            <option value="newest">Newest</option>
            <option value="title">Title A–Z</option>
            <option value="price-asc">Price low to high</option>
            <option value="price-desc">Price high to low</option>
            <option value="stock">Stock low to high</option>
          </select>
        </div>
      </div>

      {loading && !data && <Spinner label="Loading products" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && visible.length === 0 && (
        <EmptyState
          title={products.length === 0 ? 'No products yet.' : 'No products match these filters.'}
          description={
            products.length === 0
              ? 'Add your first piece. It will stay private until you publish it.'
              : 'Try another search, status or category.'
          }
          action={
            products.length === 0 ? (
              <Link className="admin-btn admin-btn--primary" to="/admin/products/new">
                Add your first product
              </Link>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setSearch('')
                  setStatus('all')
                  setCategory('all')
                }}
              >
                Clear filters
              </button>
            )
          }
        />
      )}

      {data && visible.length > 0 && (
        <div className="admin-card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--products">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th className="is-right">Price</th>
                  <th className="is-right">Available</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const stock = stockOf(product)
                  const image = product.product_images[0]?.url
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-cell">
                          {image ? <img src={image} alt="" loading="lazy" /> : <span className="admin-thumb-fallback" />}
                          <div>
                            <Link className="admin-link admin-link--strong" to={`/admin/products/${product.id}`}>
                              {product.title}
                            </Link>
                            <small className="admin-cell-sub">/{product.handle}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge value={product.status} />
                      </td>
                      <td>{product.category || '—'}</td>
                      <td className="is-right">
                        {money(product.price)}
                        {product.compare_at_price ? (
                          <small className="admin-cell-sub admin-cell-sub--strike">{money(product.compare_at_price)}</small>
                        ) : null}
                      </td>
                      <td className="is-right">
                        <span className={stock <= 0 ? 'stock stock--out' : 'stock'}>{number(stock)}</span>
                      </td>
                      <td>{dateOnly(product.updated_at)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <Link className="admin-btn admin-btn--ghost admin-btn--small" to={`/admin/products/${product.id}`}>
                            Edit
                          </Link>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--small"
                            disabled={busyId === product.id}
                            onClick={() => togglePublish(product)}
                          >
                            {product.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="Duplicate"
                            aria-label={`Duplicate ${product.title}`}
                            disabled={busyId === product.id}
                            onClick={() =>
                              void run(product.id, () => duplicateProduct(product.id), `${product.title} was duplicated as a draft.`)
                            }
                          >
                            <IconDuplicate />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn admin-icon-btn--danger"
                            title="Delete"
                            aria-label={`Delete ${product.title}`}
                            disabled={busyId === product.id}
                            onClick={() => setRemoving(product)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this product?"
        body={`“${removing?.title ?? ''}” and its variants and images will be permanently removed. Past order items keep their recorded details. This cannot be undone.`}
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
