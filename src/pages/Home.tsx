import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EditorialFrame } from '../components/EditorialFrame'
import { ProductCard } from '../components/ProductCard'
import { SectionHead } from '../components/SectionHead'
import { StickyChapter } from '../components/StickyChapter'
import { IconArrow } from '../components/Icons'
import { Reveal, stagger, useLineMasks } from '../motion/Reveal'
import { PRODUCTS, COLLECTIONS, isNewIn, isOnSale } from '../data/catalog'
import { getCatalogueCollections, getCatalogueProducts } from '../data/api'
import type { CollectionMeta, Product } from '../data/types'
import { craftImgs, heroImg, lookbookImgs } from '../data/images'
import { formatPrice } from '../data/format'
import { useDocumentTitle } from '../useDocumentTitle'

export function Home() {
  useDocumentTitle('HALA.S CLOTHING — The Ivory Hour, Autumn Edit')
  const heroRef = useRef<HTMLDivElement>(null)
  const [products, setProducts] = useState<Product[]>(PRODUCTS)
  const [collections, setCollections] = useState<CollectionMeta[]>(COLLECTIONS)
  useLineMasks(heroRef)
  useEffect(() => { let active = true; getCatalogueProducts().then((items) => { if (active) setProducts(items) }).catch(() => undefined); return () => { active = false } }, [])
  useEffect(() => { let active = true; getCatalogueCollections().then((items) => { if (active) setCollections(items) }).catch(() => undefined); return () => { active = false } }, [])

  const newIn = products.filter((p) => isNewIn(p))
  const sale = products.filter(isOnSale)
  const prices = products.map((p) => p.price).filter((n) => n > 0)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const shopable = collections.filter((c) => c.handle !== 'all')

  return (
    <>
      {/* HERO — layered/tilted composition, oversized type, parallax depth */}
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero__copy">
          <Reveal as="p" variant="fade" className="micro micro--stone" delay={60}>
            The Ivory Hour · Autumn Edit 2026
          </Reveal>

          <h2 id="hero-title" className="hero__title display" ref={heroRef}>
            <span className="line-mask" data-index={0}>
              <span style={{ fontSize: '0.42em', letterSpacing: '0.08em' }}>The</span>
            </span>
            <span className="line-mask l2" data-index={1}>
              <span style={{ fontSize: 'var(--text-mega)' }} className="display">
                Ivory
              </span>
            </span>
            <span className="line-mask l3" data-index={2}>
              <span style={{ fontSize: 'clamp(2.2rem,7vw,6rem)' }}>
                hour, <em>worn.</em>
              </span>
            </span>
          </h2>

          <Reveal as="p" variant="up" delay={380} className="lede" style={{ marginTop: '1.4rem' }}>
            Contemporary Pakistani womenswear, cut and finished in Lahore. Presented as a publication — garments
            first, noise never.
          </Reveal>

          <div className="hero__ctas">
            <Reveal as="p" variant="fade" delay={460} style={{ display: 'inline-block' }}>
              <Link className="btn btn--solid" to="/collections/new-in">
                Shop New In <IconArrow />
              </Link>
            </Reveal>
            <Reveal as="p" variant="fade" delay={540} style={{ display: 'inline-block' }}>
              <Link className="btn" to="/lookbook">
                Read the lookbook
              </Link>
            </Reveal>
          </div>
        </div>

        <div className="hero__art collage">
          <div className="layer layer--a">
            <EditorialFrame
              img={heroImg}
              ratio="hero"
              variant="curtain"
              eager
              hoverZoom
              parallax={0.04}
              sizes="(max-width: 900px) 86vw, 58vw"
            />
          </div>
          <div className="layer layer--b">
            <EditorialFrame
              img={lookbookImgs.l5}
              ratio="tall"
              variant="mask"
              delay={160}
              parallax={-0.03}
              sizes="(max-width: 900px) 44vw, 26vw"
            />
          </div>
          <div className="layer layer--c">
            <EditorialFrame
              img={craftImgs.fabrics}
              ratio="square"
              variant="rise"
              delay={280}
              parallax={0.06}
              sizes="24vw"
            />
          </div>
        </div>
      </section>

      {/* Deliberately cropped typographic band */}
      <div className="type-band" aria-hidden="true">
        <div className="marquee">
          {[0, 1].map((copy) => (
            <div key={copy}>
              {['Ready to Wear', 'Dresses', 'Co-Ord Sets', 'New In', 'Sale'].map((word, i) => (
                <span className="display" key={i} style={{ whiteSpace: 'nowrap' }}>
                  {word} <span style={{ opacity: 0.35 }}>—</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* MANIFESTO — calm interval, staggered line groups */}
      <section className="section container">
        <div className="manifesto">
          <Reveal as="div" variant="up" className="manifesto__statement">
            <p>
              A garment should hold its <em>quiet</em> — even in a room built for noise.
            </p>
          </Reveal>
          <div data-stagger>
            {[
              ['01', 'Cut in Lahore', 'Every piece is patterned and finished in our own atelier.'],
              ['02', 'Small batches', 'Fabrics are dyed in short runs, so colour is never approximate.'],
              ['03', 'Worn twice a year at minimum', 'Nothing here is designed for a single occasion.'],
            ].map(([num, title, body], i) => (
              <Reveal as="div" variant="up" key={num} style={stagger(i, 120) as CSSProperties}>
                <p className="micro micro--stone">{num}</p>
                <h3 className="display" style={{ fontSize: 'var(--text-md)', marginTop: '0.2rem' }}>
                  {title}
                </h3>
                <p className="notice" style={{ color: 'var(--ink-soft)', marginTop: '0.35rem' }}>
                  {body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* NEW IN — staggered rail of real catalogue data */}
      <section className="section section--tight container" aria-labelledby="new-in">
        <SectionHead index="01 / New In" title="Just arrived" action={{ to: '/collections/new-in', label: 'All new in' }} />
        <div className="rail-wrap">
          <div className="rail" role="region" tabIndex={0} aria-labelledby="new-in" data-stagger>
            {newIn.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} sizes="(max-width: 700px) 66vw, 30vw" />
            ))}
          </div>
        </div>
        <h3 id="new-in" className="visually-hidden">
          New In products
        </h3>
      </section>

      {/* COLLECTION INDEX — oversized type, hover preview */}
      <section className="section container" aria-labelledby="collections-title">
        <h2 id="collections-title" className="visually-hidden">
          Collections
        </h2>
        <Reveal as="p" variant="fade" className="micro micro--stone" style={{ marginBottom: '1.4rem' }}>
          02 / Chapters of the edit
        </Reveal>
        <div className="colindex">
          {shopable.map((collection, i) => (
            <Reveal
              as="a"
              variant="up"
              key={collection.handle}
              delay={i * 60}
              className="colindex__row"
              href={`/collections/${collection.handle}`}
            >
              <span className="colindex__title display">{collection.title}</span>
              <span className="colindex__count">{collection.tagline}</span>
              <span className="colindex__preview" aria-hidden="true">
                <EditorialFrame img={collection.image} ratio="portrait" variant="fade" sizes="190px" />
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CRAFT — pinned chapter (Effect 5) */}
      <section className="section--tight" aria-label="Craft">
        <StickyChapter
          eyebrow="03 / In the atelier"
          tilt
          media={[craftImgs.zardozi, lookbookImgs.l1, craftImgs.fabrics]}
          steps={[
            {
              numeral: 'i.',
              title: 'Embroidery by hand',
              body: 'Zardozi and chikankari work is done on the adda frame, one garment at a time. It is why an embellished hem takes days and never looks printed.',
              link: { to: '/product/rani-zardozi-formal-gown', label: 'See the Rani gown' },
              media: craftImgs.zardozi,
            },
            {
              numeral: 'ii.',
              title: 'Colour decided in the cloth',
              body: 'Dyeing happens in short runs on natural fibre, so ochre reads as ochre in daylight and under a bulb — not as two different garments.',
              link: { to: '/collections/ready-to-wear', label: 'Browse ready to wear' },
              media: lookbookImgs.l1,
            },
            {
              numeral: 'iii.',
              title: 'Finished, then checked twice',
              body: 'Seams are pressed, hems are weighed against the body of the garment, and anything that pulls is taken back. What leaves the atelier is meant to be worn for years.',
              link: { to: '/collections/all', label: 'See every piece' },
              media: craftImgs.fabrics,
            },
          ]}
        />
      </section>

      {/* LOOKBOOK BAND — layered collage with depth */}
      <section className="collage-band section--warm" aria-labelledby="lookbook-band">
        <div className="container">
          <Reveal as="p" variant="fade" className="micro micro--stone">
            04 / Campaign
          </Reveal>
          <Reveal as="h2" variant="up" id="lookbook-band" delay={80} className="display display--xl" style={{ marginTop: '0.6rem' }}>
            The Ivory Hour
          </Reveal>
          <div className="collage-band__art collage">
            <div className="layer band-a">
              <EditorialFrame img={lookbookImgs.l2} ratio="wide" variant="mask" hoverZoom parallax={0.04} sizes="52vw" />
            </div>
            <div className="layer band-b">
              <EditorialFrame img={lookbookImgs.l3} ratio="tall" variant="mask" delay={140} parallax={-0.05} sizes="40vw" />
            </div>
            <div className="layer band-c">
              <EditorialFrame img={craftImgs.zardozi} ratio="square" variant="rise" delay={260} sizes="22vw" />
            </div>
          </div>
          <Reveal as="p" variant="up" delay={120} className="lede">
            Photographed in a Lahore courtyard at the end of the day — three chapters, nine garments, no retouching
            of a single silhouette.
          </Reveal>
          <Reveal as="p" variant="fade" delay={200} style={{ marginTop: '1.2rem' }}>
            <Link className="btn btn--solid" to="/lookbook">
              Open the lookbook <IconArrow />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* SALE — dark chapter with a wipe transition (Effect 6) */}
      <Reveal
        as="section"
        variant="fade"
        className="section section--ink transition-wipe"
        aria-labelledby="sale-title"
      >
        <div className="container">
          <div className="section-head">
            <div>
              <p className="micro" style={{ color: 'var(--stone-light)' }}>
                05 / End of season
              </p>
              <h2 id="sale-title" className="display display--hero" style={{ marginTop: '0.6rem' }}>
                Reduced, <em>not reinvented.</em>
              </h2>
            </div>
            <p className="lede" style={{ color: 'var(--stone-light)', maxWidth: '32ch' }}>
              {sale.length} pieces from earlier chapters, marked from their own recorded price.
            </p>
          </div>

          <div className="rail" role="region" tabIndex={0} aria-label="Sale products">
            {sale.map((product, i) => (
              <div key={product.id} style={stagger(i, 110) as CSSProperties} data-stagger-parent="true">
                <ProductCard product={product} sizes="(max-width: 700px) 66vw, 30vw" />
              </div>
            ))}
          </div>

          <Reveal as="p" variant="fade" delay={120} style={{ marginTop: '2rem' }}>
            <Link className="btn" to="/collections/sale">
              Shop the sale <IconArrow />
            </Link>
          </Reveal>
        </div>
      </Reveal>

      {/* CLOSING RULE */}
      <section className="section container" aria-label="Note">
        <Reveal as="div" variant="up" className="grid12">
          <p className="display display--lg" style={{ gridColumn: '1 / span 12' }}>
            Prices shown in Pakistani Rupees.
          </p>
          <p className="lede" style={{ gridColumn: '1 / span 7', color: 'var(--ink-soft)' }}>
            This storefront reads from HALA.S's own catalogue rather than a third-party store connection. Product
            data, colours and prices come from that catalogue alone — nothing is generated for display.
          </p>
          <p className="micro micro--stone" style={{ gridColumn: '9 / span 4', alignSelf: 'end' }}>
            {products.length} pieces · {formatPrice(minPrice)}–{formatPrice(maxPrice)}
          </p>
        </Reveal>
      </section>
    </>
  )
}
