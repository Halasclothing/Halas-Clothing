import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { catalogApi } from '../data/api'
import { isOnSale } from '../data/catalog'
import { formatPrice } from '../data/format'
import type { Product } from '../data/types'
import { useProduct } from '../data/hooks'
import { useCart } from '../state/cart'
import { useRecentlyViewed } from '../state/wishlist'
import { useUi } from '../state/ui'
import { Reveal } from '../motion/Reveal'
import { useParallax } from '../motion/useParallax'
import { useDocumentTitle } from '../useDocumentTitle'
import { EditorialImage } from '../components/EditorialFrame'
import { Lightbox } from '../components/Lightbox'
import { ProductCard } from '../components/ProductCard'
import { WishlistButton } from '../components/WishlistButton'
import { SectionHead } from '../components/SectionHead'
import { useScrollLock } from '../motion/useScrollLock'
import { IconCheck, IconLink, IconMinus, IconPlus } from '../components/Icons'
import { NotFoundPage } from './NotFoundPage'

export function ProductPage() {
  const { handle } = useParams()
  const { product, loading, error } = useProduct(handle)
  const cart = useCart()
  const recent = useRecentlyViewed()
  const { open, announce } = useUi()

  const [size, setSize] = useState<string | null>(null)
  const [colour, setColour] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [hint, setHint] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [added, setAdded] = useState(false)
  const [related, setRelated] = useState<Product[]>([])
  const [openPanel, setOpenPanel] = useState<string | null>('details')
  const galleryRef = useParallax<HTMLDivElement>(0.03)

  useScrollLock(lightbox !== null)
  useDocumentTitle(product ? `${product.title} — HALA.S CLOTHING` : 'Product — HALA.S CLOTHING')

  const pushRecent = recent.push
  useEffect(() => {
    if (product) pushRecent(product.handle)
  }, [product, pushRecent])

  useEffect(() => {
    if (!product) return
    let alive = true
    catalogApi.related(product, 4).then((list) => alive && setRelated(list))
    return () => {
      alive = false
    }
  }, [product])

  useEffect(() => {
    setSize(null)
    setColour(null)
    setQuantity(1)
    setHint(null)
    setAdded(false)
    setActive(0)
  }, [product?.id])

  const viewable = useMemo(() => recent.products.filter((p) => p.handle !== handle).slice(0, 4), [recent.products, handle])

  const colourOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const variant of product?.variants ?? []) {
      if (variant.colour) seen.set(variant.colour, variant.colourHex)
    }
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }))
  }, [product])

  const activeColour = product
    ? colour ??
      colourOptions.find((option) =>
        product.variants?.some((variant) => variant.colour === option.name && variant.available),
      )?.name ??
      colourOptions[0]?.name ??
      null
    : null

  const sizeOptions = useMemo(() => {
    if (!product) return []
    if (!product.variants?.length || colourOptions.length <= 1) return product.sizes
    return product.sizes.map((option) => {
      const variants = product.variants!.filter(
        (variant) => variant.size === option.label && variant.colour === activeColour,
      )
      return { label: option.label, available: variants.some((variant) => variant.available) }
    })
  }, [product, colourOptions.length, activeColour])

  if (loading) {
    return (
      <div className="container section">
        <div className="pdp">
          <div className="skeleton" aria-hidden="true" />
          <div>
            <div className="micro micro--stone">Loading piece…</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return <NotFoundPage reason={error ?? 'not-found'} handle={handle} />
  }

  const anyAvailable = sizeOptions.some((option) => option.available)
  const selectedVariant = product.variants?.find(
    (candidate) =>
      candidate.size === size && (!activeColour || candidate.colour === activeColour),
  )
  const displayedUnitPrice = selectedVariant?.price ?? product.price

  const addToBag = () => {
    if (!size) {
      setHint('Choose a size first.')
      return
    }
    const variant = selectedVariant
    if (product.variants?.length && !variant) {
      setHint('This combination is not available. Choose another size or colour.')
      return
    }
    setHint(null)
    cart.add(product, size, quantity, { colour: activeColour ?? undefined, variantId: variant?.id })
    announce(
      `${product.title}${activeColour ? `, ${activeColour}` : ''}, size ${size}, quantity ${quantity} added to bag`,
    )
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
    open('cart')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      announce('Product link copied')
    } catch {
      announce(`Copy this link: ${window.location.href}`)
    }
  }

  const images = product.images

  return (
    <>
      <nav className="container" aria-label="Breadcrumb" style={{ paddingTop: '1.2rem' }}>
        <ol className="crumbs micro micro--stone">
          <li>
            <Link to="/collections/all">Collections</Link>
          </li>
          {product.collections[0] && (
            <li>
              <Link to={`/collections/${product.collections[0]}`}>
                {product.collections[0]
                  .split('-')
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(' ')}
              </Link>
            </li>
          )}
          <li aria-current="page">{product.title}</li>
        </ol>
      </nav>

      <article className="pdp container">
        <div className="pdp__gallery">
          <Reveal as="figure" variant="mask" className="gallery__main">
            <div ref={galleryRef} data-parallax="">
              <div
                className="frame hover-zoom"
                style={{ aspectRatio: `${images[active].width} / ${images[active].height}` }}
              >
                <EditorialImage
                  key={images[active].src}
                  img={images[active]}
                  sizes="(max-width: 900px) 92vw, 46vw"
                  eager={active === 0}
                />
              </div>
            </div>
            <figcaption className="gallery__caption">
              <span className="micro micro--stone">
                {images[active].kind === 'campaign' ? 'Campaign view' : 'Catalogue view'} · image {active + 1} of{' '}
                {images.length}
              </span>
              <button
                type="button"
                className="link-sweep"
                onClick={() => setLightbox(active)}
                aria-label={`Open ${product.title} image in a full-screen viewer`}
              >
                Zoom
              </button>
            </figcaption>
          </Reveal>

          {images.length > 1 && (
            <ul className="gallery__thumbs">
              {images.map((img, i) => (
                <li key={img.src}>
                  <button
                    type="button"
                    className="thumb"
                    aria-current={i === active ? 'true' : undefined}
                    onClick={() => setActive(i)}
                    aria-label={`Show image ${i + 1} of ${images.length}`}
                  >
                    <span className="frame frame--square">
                      <EditorialImage img={img} sizes="64px" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="pdp__aside">
          <Reveal as="div" variant="up">
            <div className="buy-head">
              <p className="micro micro--stone">
                {activeColour || product.colourName}
                {isOnSale(product) && <span className="chip chip--accent" style={{ marginLeft: '0.8rem' }}>Sale</span>}
              </p>
              <h1 className="pdp__title display">{product.title}</h1>
              <p className="price" style={{ fontSize: 'var(--text-md)' }}>
                {product.compareAtPrice && <span className="was">{formatPrice(product.compareAtPrice)}</span>}
                <span>{formatPrice(displayedUnitPrice)}</span>
              </p>
            </div>

            <p className="prose" style={{ marginTop: '1.2rem' }}>
              {product.description}
            </p>

            {colourOptions.length > 1 && (
              <div style={{ marginTop: '1.8rem' }}>
                <p className="micro" id={`colours-${product.handle}`}>
                  Colour — {activeColour}
                </p>
                <div className="colour-grid" role="group" aria-labelledby={`colours-${product.handle}`}>
                  {colourOptions.map((option) => (
                    <button
                      key={option.name}
                      type="button"
                      className="colour-btn"
                      aria-pressed={activeColour === option.name}
                      aria-label={option.name}
                      title={option.name}
                      onClick={() => {
                        setColour(option.name)
                        setSize(null)
                        setHint(null)
                      }}
                    >
                      <span style={{ background: option.hex || '#c8b9a5' }} />
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.8rem' }}>
              <p className="micro" id={`sizes-${product.handle}`}>
                Size
              </p>
              {anyAvailable ? (
                <>
                  <div className="size-grid" role="group" aria-labelledby={`sizes-${product.handle}`}>
                    {sizeOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className="size-btn"
                        aria-pressed={size === option.label}
                        disabled={!option.available}
                        onClick={() => {
                          setSize(option.label)
                          setHint(null)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="pdp__hint" role="status">
                    {hint ?? 'Sizes shown are the atelier’s current availability for this piece.'}
                  </p>
                </>
              ) : (
                <p className="notice">Every size of this piece is currently unavailable.</p>
              )}
            </div>

            {anyAvailable && (
              <div className="buy-row" style={{ alignItems: 'center' }}>
                <div className="stepper">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                    <IconMinus />
                  </button>
                  <output aria-label="Quantity">{quantity}</output>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(12, q + 1))} aria-label="Increase quantity">
                    <IconPlus />
                  </button>
                </div>
                <button type="button" className="btn btn--solid pdp-add-to-cart" onClick={addToBag}>
                  {added ? (
                    <>
                      Added <IconCheck />
                    </>
                  ) : (
                    <>
                      Add to bag — {formatPrice(displayedUnitPrice * quantity)}
                    </>
                  )}
                </button>
                <WishlistButton product={product} className="btn btn--ghost save-btn" labelled />
                <button type="button" className="icon-btn" onClick={copyLink} aria-label="Copy link to this product">
                  <IconLink />
                </button>
              </div>
            )}

            <div style={{ marginTop: '2rem' }}>
              {[
                { id: 'details', title: 'Fabric & details', body: `${product.fabric}. ${product.description}` },
                { id: 'care', title: 'Care', body: product.care },
                {
                  id: 'delivery',
                  title: 'Orders & collection',
                  body: 'This storefront reads from the HALA.S catalogue directly and does not take payment. Availability is confirmed by the atelier before collection.',
                },
              ].map((panel) => (
                <div className="acc" data-open={openPanel === panel.id} key={panel.id}>
                  <h3>
                    <button
                      type="button"
                      className="acc__btn"
                      aria-expanded={openPanel === panel.id}
                      onClick={() => setOpenPanel(openPanel === panel.id ? null : panel.id)}
                    >
                      {panel.title}
                      <span className="acc__sign" aria-hidden="true">
                        +
                      </span>
                    </button>
                  </h3>
                  <div
                    className="acc__panel"
                    {...(openPanel === panel.id
                      ? {}
                      : ({ inert: '', 'aria-hidden': 'true' } as Record<string, string>))}
                  >
                    <div>
                      <p>{panel.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </aside>
      </article>

      {related.length > 0 && (
        <section className="section section--tight container" aria-labelledby="related-title">
          <SectionHead index="Complete the look" title="Worn together" />
          <div className="rail" role="region" tabIndex={0} aria-labelledby="related-title" data-stagger>
            {related.map((item, i) => (
              <ProductCard key={item.id} product={item} index={i} />
            ))}
          </div>
          <h3 id="related-title" className="visually-hidden">
            Related pieces
          </h3>
        </section>
      )}

      {viewable.length > 0 && (
        <section className="section container recent-rail" aria-labelledby="recent-title">
          <h2 id="recent-title" className="micro micro--stone" style={{ marginBottom: '1.4rem' }}>
            Recently viewed
          </h2>
          <div className="rail" role="region" tabIndex={0} aria-labelledby="recent-title" data-stagger>
            {viewable.map((item, i) => (
              <ProductCard key={item.id} product={item} index={i} />
            ))}
          </div>
        </section>
      )}

      {lightbox !== null && (
        <Lightbox
          images={images}
          index={lightbox}
          title={product.title}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}
