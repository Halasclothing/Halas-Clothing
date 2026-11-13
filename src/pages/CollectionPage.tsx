import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { catalogApi, SORT_OPTIONS, type SortKey } from '../data/api'
import type { CollectionHandle, CollectionMeta } from '../data/types'
import { applySort, useCollection } from '../data/hooks'
import { Reveal } from '../motion/Reveal'
import { useDocumentTitle } from '../useDocumentTitle'
import { ProductCard } from '../components/ProductCard'
import { EditorialFrame } from '../components/EditorialFrame'
import { Drawer } from '../components/Drawer'
import { IconArrow, IconClose } from '../components/Icons'
import { NotFoundPage } from './NotFoundPage'

export function CollectionPage() {
  const params = useParams()
  const handle = (params.handle ?? 'all') as CollectionHandle
  const [search, setSearch] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const sort = (search.get('sort') as SortKey) || 'featured'
  const sizeFilter = search.getAll('size')
  const colourFilter = search.getAll('colour')
  const inStockOnly = search.get('stock') === '1'

  const { products, meta, loading, error } = useCollection(handle)
  const facets = useMemo(() => catalogApi.facets(products), [products])
  const [collections, setCollections] = useState<CollectionMeta[]>([])

  useEffect(() => {
    let alive = true
    catalogApi
      .listCollections()
      .then((list) => alive && setCollections(list))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useDocumentTitle(meta ? `${meta.title} — HALA.S CLOTHING` : 'Collection — HALA.S CLOTHING')

  const visible = useMemo(() => {
    let list = products
    if (sizeFilter.length) list = list.filter((p) => p.sizes.some((s) => s.available && sizeFilter.includes(s.label)))
    if (colourFilter.length) list = list.filter((p) => colourFilter.includes(p.colourName))
    if (inStockOnly) list = list.filter((p) => p.sizes.some((s) => s.available))
    return applySort(list, sort)
  }, [products, sizeFilter, colourFilter, inStockOnly, sort])

  if (!loading && !meta && !error) return <NotFoundPage reason="unknown-collection" />

  const activeCount = sizeFilter.length + colourFilter.length + (inStockOnly ? 1 : 0)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(search)
    if (value === null || value === 'featured') next.delete(key)
    else next.set(key, value)
    setSearch(next, { replace: true })
  }

  const toggleMulti = (key: string, value: string) => {
    const next = new URLSearchParams(search)
    const current = next.getAll(key)
    next.delete(key)
    ;(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]).forEach((v) =>
      next.append(key, v),
    )
    setSearch(next, { replace: true })
  }

  const clearAll = () => setSearch(new URLSearchParams(), { replace: true })

  return (
    <>
      <header className="collection-head container">
        <div>
          <Reveal as="p" variant="fade" className="micro micro--stone">
            Collection
          </Reveal>
          <Reveal as="h1" variant="up" delay={60} className="display display--hero" style={{ marginTop: '0.5rem' }}>
            {meta?.title ?? '…'}
          </Reveal>
          {meta && (
            <Reveal as="p" variant="up" delay={140} className="lede" style={{ marginTop: '1.2rem' }}>
              {meta.tagline}
            </Reveal>
          )}
        </div>
        {meta && (
          <div style={{ justifySelf: 'stretch', alignSelf: 'end' }}>
            <EditorialFrame
              img={meta.image}
              ratio={handle === 'all' ? 'wide' : 'portrait'}
              variant="mask-side"
              delay={120}
              className="tilt-r-soft"
              sizes="(max-width: 900px) 86vw, 28vw"
            />
          </div>
        )}
      </header>

      <div className="container">
        <div className="toolbar">
          <div className="toolbar__left">
            <button type="button" className="btn btn--ghost" onClick={() => setFiltersOpen(true)}>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            <p className="micro micro--stone" role="status" aria-live="polite">
              {loading ? 'Loading pieces…' : `${visible.length} ${visible.length === 1 ? 'piece' : 'pieces'}`}
            </p>
          </div>
          <div className="toolbar__right">
            <label className="micro micro--stone" htmlFor="sort">
              Sort
            </label>
            <select id="sort" className="select" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeCount > 0 && (
          <ul className="chips" aria-label="Active filters">
            {sizeFilter.map((size) => (
              <li key={size} className="chip">
                Size {size}
                <button type="button" onClick={() => toggleMulti('size', size)} aria-label={`Remove size ${size} filter`}>
                  ×
                </button>
              </li>
            ))}
            {colourFilter.map((colour) => (
              <li key={colour} className="chip">
                {colour}
                <button type="button" onClick={() => toggleMulti('colour', colour)} aria-label={`Remove ${colour} colour filter`}>
                  ×
                </button>
              </li>
            ))}
            {inStockOnly && (
              <li className="chip">
                In stock
                <button type="button" onClick={() => setParam('stock', null)} aria-label="Remove in-stock filter">
                  ×
                </button>
              </li>
            )}
            <li>
              <button type="button" className="link-sweep" onClick={clearAll}>
                Clear all
              </button>
            </li>
          </ul>
        )}

        {error && (
          <div className="state">
            <p className="display display--lg">The catalogue could not be read.</p>
            <p className="notice">Please try again in a moment.</p>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="shop-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="state">
            <p className="display display--lg">Nothing matches those filters.</p>
            <p className="notice">
              {products.length} pieces are in {meta?.title.toLowerCase()} — loosen one filter to see them.
            </p>
            <div className="buy-row">
              <button type="button" className="btn btn--solid" onClick={clearAll}>
                Clear filters
              </button>
              <Link className="btn" to="/collections/all">
                All products <IconArrow />
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="shop-grid" data-stagger>
            {visible.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} sizes="(max-width: 700px) 46vw, 32vw" />
            ))}
          </div>
        )}

        <section className="section recent-rail" aria-label="Other collections">
          <p className="micro micro--stone" style={{ marginBottom: '1rem' }}>
            Elsewhere in the edit
          </p>
          <div className="chips">
            {collections.filter((c) => c.handle !== handle).map((c) => (
              <Link className="chip" to={`/collections/${c.handle}`} key={c.handle}>
                {c.title}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Filters" side="left">
        <div className="drawer__head">
          <p className="micro">Refine</p>
          <button type="button" className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Close filters" data-autofocus>
            <IconClose />
          </button>
        </div>

        <div className="drawer__body">
          <div className="stagger-in" data-open={filtersOpen}>
            <div className="filter-group">
              <p className="micro">Size</p>
              <div className="filter-options">
                {facets.sizes.map((size) => (
                  <label className="opt" key={size}>
                    <input type="checkbox" checked={sizeFilter.includes(size)} onChange={() => toggleMulti('size', size)} />
                    {size}
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <p className="micro">Colour</p>
              <div className="filter-options">
                {facets.colours.map((colour) => (
                  <label className="opt" key={colour.name}>
                    <input
                      type="checkbox"
                      checked={colourFilter.includes(colour.name)}
                      onChange={() => toggleMulti('colour', colour.name)}
                    />
                    <span className="swatch" style={{ '--sw': colour.hex } as CSSProperties} />
                    {colour.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <p className="micro">Availability</p>
              <div className="filter-options">
                <label className="opt">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setParam('stock', e.target.checked ? '1' : null)}
                  />
                  In stock only ({facets.inStock})
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="drawer__foot">
          <div className="total">
            <span className="micro">{visible.length} results</span>
            <button type="button" className="link-sweep" onClick={clearAll}>
              Clear all
            </button>
          </div>
          <button type="button" className="btn btn--solid" onClick={() => setFiltersOpen(false)}>
            Show results <IconArrow />
          </button>
        </div>
      </Drawer>
    </>
  )
}
