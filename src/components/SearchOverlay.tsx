import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { catalogApi } from '../data/api'
import { COLLECTIONS } from '../data/catalog'
import { formatPrice } from '../data/format'
import type { Product } from '../data/types'
import { useUi } from '../state/ui'
import { useFocusTrap } from '../motion/useFocusTrap'
import { EditorialImage } from './EditorialFrame'
import { IconClose } from './Icons'

const SHORTCUTS = COLLECTIONS.filter((c) => c.handle !== 'all')

export function SearchOverlay() {
  const { isOpen, close } = useUi()
  const open = isOpen('search')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[] | null>(null)

  useFocusTrap(ref, open)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(term.trim()), 160)
    return () => window.clearTimeout(t)
  }, [term])

  useEffect(() => {
    if (!query) {
      setResults(null)
      return
    }
    let alive = true
    catalogApi.search(query, 8).then((r) => alive && setResults(r))
    return () => {
      alive = false
    }
  }, [query])

  const list = useMemo(() => results ?? [], [results])

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && list.length) {
      event.preventDefault()
      itemRefs.current[0]?.focus()
    } else if (event.key === 'Enter' && list.length) {
      event.preventDefault()
      navigate(`/product/${list[0].handle}`)
      close()
    }
  }

  const onListKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      itemRefs.current[Math.min(index + 1, list.length - 1)]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index === 0) inputRef.current?.focus()
      else itemRefs.current[index - 1]?.focus()
    }
  }

  const reset = () => {
    setTerm('')
    setQuery('')
    setResults(null)
  }

  return (
    <div
      className="search overlay-panel"
      ref={ref}
      data-open={open}
      role="dialog"
      aria-modal="true"
      aria-label="Product search"
      aria-hidden={!open}
      {...(!open ? { inert: '' } : {})}
    >
      <div className="container">
        <div className="search__input-row">
          <label className="visually-hidden" htmlFor="site-search">
            Search products
          </label>
          <input
            id="site-search"
            ref={inputRef}
            data-autofocus
            className="field search__field"
            type="search"
            autoComplete="off"
            placeholder="Silk, co-ord, emerald…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onInputKey}
          />
          <button type="button" className="icon-btn" onClick={() => { close(); reset() }} aria-label="Close search">
            <IconClose />
          </button>
        </div>

        <div className="search__results">
          {!query && (
            <nav aria-label="Collections">
              <p className="micro micro--stone" style={{ marginBottom: '0.9rem' }}>
                Browse
              </p>
              <ul className="search__shortcuts">
                {SHORTCUTS.map((c) => (
                  <li key={c.handle}>
                    <Link className="link-sweep" to={`/collections/${c.handle}`} onClick={() => { close(); reset() }}>
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {query && results === null && (
            <p className="micro micro--stone" role="status">
              Searching…
            </p>
          )}

          {query && results !== null && list.length === 0 && (
            <div className="state" role="status">
              <p className="display display--lg">No match for “{query}”.</p>
              <p className="notice">Try a fabric, a colour or a piece name — or browse a collection.</p>
            </div>
          )}

          {list.length > 0 && (
            <ul role="list">
              {list.map((product, i) => (
                <li key={product.id}>
                  <Link
                    className="result"
                    to={`/product/${product.handle}`}
                    ref={(el) => {
                      itemRefs.current[i] = el
                    }}
                    onKeyDown={(e) => onListKey(e, i)}
                    onClick={() => {
                      close()
                      reset()
                    }}
                  >
                    <span className="frame frame--portrait" style={{ display: 'block' }}>
                      <EditorialImage img={product.images[0]} sizes="54px" />
                    </span>
                    <span>
                      <span className="card__title" style={{ display: 'block' }}>
                        {product.title}
                      </span>
                      <span className="micro micro--stone">{product.colourName}</span>
                    </span>
                    <span className="price">{formatPrice(product.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
