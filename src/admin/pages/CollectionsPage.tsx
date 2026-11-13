import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { invalidateLiveCatalogue } from '../../data/live'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  deleteCollection,
  listAdminCollections,
  saveCollection,
  type AdminCollection,
  type ProductStatus,
} from '../api'
import { dateOnly, number } from '../format'
import { useAsync, useDebounced } from '../hooks'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui'
import { IconExternal, IconPlus, IconSearch, IconTrash } from '../icons'

export function CollectionsPage() {
  useDocumentTitle('Collections — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(listAdminCollections, [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [status, setStatus] = useState<ProductStatus | 'all'>('all')
  const [notice, setNotice] = useState<string | null>(null)
  const [removing, setRemoving] = useState<AdminCollection | null>(null)
  const [busy, setBusy] = useState(false)

  const collections = data ?? []
  const visible = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    return collections.filter((collection) => {
      if (status !== 'all' && collection.status !== status) return false
      if (!term) return true
      return `${collection.title} ${collection.handle} ${collection.description}`.toLowerCase().includes(term)
    })
  }, [collections, status, debounced])

  const sortMembers = (collection: AdminCollection) =>
    [...(collection.collection_products ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((item) => item.product_id)

  const togglePublish = async (collection: AdminCollection) => {
    const next: ProductStatus = collection.status === 'published' ? 'draft' : 'published'
    setBusy(true)
    setNotice(null)
    try {
      await saveCollection({
        collection: {
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          description: collection.description,
          image_url: collection.image_url,
          seo_title: collection.seo_title,
          seo_description: collection.seo_description,
          status: next,
          is_automatic: collection.is_automatic,
          rules: collection.rules ?? { match: 'all', conditions: [] },
          position: collection.position,
        },
        productIds: collection.is_automatic ? [] : sortMembers(collection),
      })
      invalidateLiveCatalogue()
      setNotice(
        next === 'published'
          ? `${collection.title} is now visible on the storefront.`
          : `${collection.title} was unpublished and removed from the storefront navigation.`,
      )
      reload()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'The collection could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await deleteCollection(removing.id)
      invalidateLiveCatalogue()
      setNotice(`${removing.title} was deleted. Products themselves were not deleted.`)
      setRemoving(null)
      reload()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'The collection could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

  const counts = {
    all: collections.length,
    published: collections.filter((collection) => collection.status === 'published').length,
    draft: collections.filter((collection) => collection.status === 'draft').length,
    archived: collections.filter((collection) => collection.status === 'archived').length,
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Collections"
        description="Group pieces manually or let rules keep a collection current automatically. Published collections appear on the storefront."
        actions={
          <Link className="admin-btn admin-btn--primary" to="/admin/collections/new">
            <IconPlus /> Add collection
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
          {(['all', 'published', 'draft', 'archived'] as const).map((value) => (
            <button key={value} type="button" className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>
              {value === 'all' ? 'All' : value === 'draft' ? 'Drafts' : `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`}
              <span>{counts[value]}</span>
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
              placeholder="Search collections"
              aria-label="Search collections"
            />
          </label>
        </div>
      </div>

      {loading && !data && <Spinner label="Loading collections" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && visible.length === 0 && (
        <EmptyState
          title={collections.length === 0 ? 'No collections yet.' : 'No collections match these filters.'}
          description="Collections organise the storefront: new-in, sale, a season, a fabrication, anything you need."
          action={
            <Link className="admin-btn admin-btn--primary" to="/admin/collections/new">
              Add a collection
            </Link>
          }
        />
      )}

      {data && visible.length > 0 && (
        <div className="admin-card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th className="is-right">Products</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((collection) => (
                  <tr key={collection.id}>
                    <td>
                      <div className="admin-product-cell">
                        {collection.image_url ? (
                          <img src={collection.image_url} alt="" loading="lazy" />
                        ) : (
                          <span className="admin-thumb-fallback" />
                        )}
                        <div>
                          <Link className="admin-link admin-link--strong" to={`/admin/collections/${collection.id}`}>
                            {collection.title}
                          </Link>
                          <small className="admin-cell-sub">/{collection.handle}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge value={collection.status} />
                    </td>
                    <td>
                      <span className={`badge badge--${collection.is_automatic ? 'info' : 'neutral'}`}>
                        {collection.is_automatic ? 'Automatic' : 'Manual'}
                      </span>
                    </td>
                    <td className="is-right">
                      {collection.is_automatic
                        ? `${number((collection.rules?.conditions ?? []).length)} rule${(collection.rules?.conditions ?? []).length === 1 ? '' : 's'}`
                        : number((collection.collection_products ?? []).length)}
                    </td>
                    <td>{dateOnly(collection.updated_at)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <Link className="admin-btn admin-btn--ghost admin-btn--small" to={`/admin/collections/${collection.id}`}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--small"
                          disabled={busy}
                          onClick={() => void togglePublish(collection)}
                        >
                          {collection.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        {collection.status === 'published' && (
                          <a
                            className="admin-icon-btn"
                            href={`/collections/${collection.handle}`}
                            target="_blank"
                            rel="noreferrer"
                            title="View on storefront"
                            aria-label={`View ${collection.title} on the storefront`}
                          >
                            <IconExternal />
                          </a>
                        )}
                        <button
                          type="button"
                          className="admin-icon-btn admin-icon-btn--danger"
                          title="Delete"
                          aria-label={`Delete ${collection.title}`}
                          onClick={() => setRemoving(collection)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this collection?"
        body={`“${removing?.title ?? ''}” will be removed from the storefront. Products inside it are not deleted.`}
        confirmLabel="Delete collection"
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
