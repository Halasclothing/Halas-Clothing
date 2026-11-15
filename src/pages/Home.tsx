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

const reviewSamples = [
              { name: 'Ayesha Malik', city: 'Lahore', text: 'The outfit looked even more beautiful in person. The finishing is neat and the fabric feels lovely.' },
              { name: 'Hira Ahmed', city: 'Karachi', text: 'Loved the colour and the overall fit. It felt elegant without being over the top.' },
              { name: 'Sana Khan', city: 'Islamabad', text: 'A graceful design with thoughtful details. Perfect for a family get-together.' },
              { name: 'Mahnoor Ali', city: 'Faisalabad', text: 'The stitching and fall of the shirt were just what I wanted. Such a pretty look.' },
              { name: 'Zoya Sheikh', city: 'Rawalpindi', text: 'Beautiful presentation and a lovely outfit. I would happily explore more pieces.' },
              { name: 'Fatima Raza', city: 'Multan', text: 'The design feels modern while still being easy to wear. A lovely addition to my wardrobe.' },
              { name: 'Maham Siddiqui', city: 'Lahore', text: 'The fabric has a lovely feel and the outfit looks graceful. The details make it special.' },
              { name: 'Iqra Javed', city: 'Gujranwala', text: 'I liked the simple elegant look. It was easy to style for a small family event.' },
              { name: 'Amna Tariq', city: 'Sialkot', text: 'The colour was lovely and the overall look felt very polished.' },
              { name: 'Eman Butt', city: 'Islamabad', text: 'A beautiful outfit with neat finishing. I really liked the silhouette.' },
              { name: 'Kiran Shah', city: 'Karachi', text: 'The design is tasteful and the fabric drapes beautifully.' },
              { name: 'Noor Fatima', city: 'Bahawalpur', text: 'Loved the delicate details. It made a lovely outfit for a dinner.' },
              { name: 'Laiba Aslam', city: 'Lahore', text: 'The outfit felt comfortable and looked elegant. A very pretty design.' },
              { name: 'Mehwish Iqbal', city: 'Peshawar', text: 'The colour combination is beautiful and the stitching looks neat.' },
              { name: 'Anaya Hussain', city: 'Multan', text: 'A lovely piece for the festive season. The detailing caught my eye.' },
              { name: 'Sidra Nadeem', city: 'Rawalpindi', text: 'The fit and fall looked graceful. I liked how easy it was to accessorise.' },
              { name: 'Minal Rauf', city: 'Karachi', text: 'The fabric feels soft and the design is understated in the best way.' },
              { name: 'Rabia Khalid', city: 'Lahore', text: 'Really liked the finishing and the overall presentation of the outfit.' },
              { name: 'Hafsa Noor', city: 'Hyderabad', text: 'The style is elegant and comfortable. It worked beautifully for my occasion.' },
              { name: 'Dua Imran', city: 'Islamabad', text: 'Such a pretty colour and a thoughtful design. Very easy to dress up.' },
              { name: 'Saira Younis', city: 'Sargodha', text: 'The outfit has a lovely fall and the details look carefully done.' },
              { name: 'Areeba Saleem', city: 'Faisalabad', text: 'I liked the modern cut with a traditional touch. A graceful look.' },
              { name: 'Nimra Asif', city: 'Lahore', text: 'The fabric and colour looked lovely together. The outfit felt special.' },
              { name: 'Alina Qureshi', city: 'Karachi', text: 'Beautiful design and neat stitching. I would love to see more colours.' },
              { name: 'Maryam Riaz', city: 'Gujrat', text: 'A very wearable design. It felt elegant without being too heavy.' },
              { name: 'Hania Farooq', city: 'Islamabad', text: 'The details are subtle and pretty. A lovely addition to my wardrobe.' },
              { name: 'Sobia Akhtar', city: 'Multan', text: 'I liked the quality of the finishing and the graceful overall look.' },
              { name: 'Sehrish Ahmed', city: 'Lahore', text: 'The outfit was comfortable and the colour was just as I expected.' },
              { name: 'Mishal Khan', city: 'Peshawar', text: 'A beautiful silhouette with lovely detailing. Easy to style for an event.' },
              { name: 'Komal Abbas', city: 'Sialkot', text: 'The design feels timeless and the fabric has a nice drape.' },
              { name: 'Aiman Khalid', city: 'Rawalpindi', text: 'Loved the clean finishing and the elegant look of the outfit.' },
              { name: 'Nadia Bukhari', city: 'Karachi', text: 'A lovely outfit with a refined design. The little details stand out.' },
              { name: 'Rimsha Waqar', city: 'Lahore', text: 'The colour and cut are beautiful. It made getting ready so easy.' },
              { name: 'Bushra Saeed', city: 'Abbottabad', text: 'A graceful outfit and a lovely overall look. I liked the fabric feel.' },
              { name: 'Sana Jamil', city: 'Gujranwala', text: 'The stitching looks neat and the design is both pretty and practical.' },
              { name: 'Hoorain Shah', city: 'Islamabad', text: 'A lovely piece with a soft, elegant look. The details are beautiful.' },
            ]
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

          <Reveal as="p" variant="uah', city: 'Karachi', text: 'The design is tasteful and the fabric drapes beautifully.' },
              { name: 'Noor Fatima', city: 'Bahawalpur', text: 'Loved the delicate details. It made a lovely outfit for a dinner.' },
              { name: 'Laiba Aslam', city: 'Lahore', text: 'The outfit felt comfortable and looked elegant. A very pretty design.' },
              { name: 'Mehwish Iqbal', city: 'Peshawar', text: 'The colour combination is beautiful and the stitching looks neat.' },
              { name: 'Anaya Hussain', city: 'Multan', text: 'A lovely piece for the festive season. The detailing caught my eye.' },
              { name: 'Sidra Nadeem', city: 'Rawalpindi', text: 'The fit and fall looked graceful. I liked how easy it was to accessorise.' },
              { name: 'Minal Rauf', city: 'Karachi', text: 'The fabric feels soft and the design is understated in the best way.' },
              { name: 'Rabia Khalid', city: 'Lahore', text: 'Really liked the finishing and the overall presentation of the outfit.' },
              { name: 'Hafsa Noor', city: 'Hyderabad', text: 'The style is elegant and comfortable. It worked beautifully for my occasion.' },
              { name: 'Dua Imran', city: 'Islamabad', text: 'Such a pretty colour and a thoughtful design. Very easy to dress up.' },
              { name: 'Saira Younis', city: 'Sargodha', text: 'The outfit has a lovely fall and the details look carefully done.' },
              { name: 'Areeba Saleem', city: 'Faisalabad', text: 'I liked the modern cut with a traditional touch. A graceful look.' },
              { name: 'Nimra Asif', city: 'Lahore', text: 'The fabric and colour looked lovely together. The outfit felt special.' },
              { name: 'Alina Qureshi', city: 'Karachi', text: 'Beautiful design and neat stitching. I would love to see more colours.' },
              { name: 'Maryam Riaz', city: 'Gujrat', text: 'A very wearable design. It felt elegant without being too heavy.' },
              { name: 'Hania Farooq', city: 'Islamabad', text: 'The details are subtle and pretty. A lovely addition to my wardrobe.' },
              { name: 'Sobia Akhtar', city: 'Multan', text: 'I liked the quality of the finishing and the graceful overall look.' },
              { name: 'Sehrish Ahmed', city: 'Lahore', text: 'The outfit was comfortable and the colour was just as I expected.' },
              { name: 'Mishal Khan', city: 'Peshawar', text: 'A beautiful silhouette with lovely detailing. Easy to style for an event.' },
              { name: 'Komal Abbas', city: 'Sialkot', text: 'The design feels timeless and the fabric has a nice drape.' },
              { name: 'Aiman Khalid', city: 'Rawalpindi', text: 'Loved the clean finishing and the elegant look of the outfit.' },
              { name: 'Nadia Bukhari', city: 'Karachi', text: 'A lovely outfit with a refined design. The little details stand out.' },
              { name: 'Rimsha Waqar', city: 'Lahore', text: 'The colour and cut are beautiful. It made getting ready so easy.' },
              { name: 'Bushra Saeed', city: 'Abbottabad', text: 'A graceful outfit and a lovely overall look. I liked the fabric feel.' },
              { name: 'Sana Jamil', city: 'Gujranwala', text: 'The stitching looks neat and the design is both pretty and practical.' },
              { name: 'Hoorain Shah', city: 'Islamabad', text: 'A lovely piece with a soft, elegant look. The details are beautiful.' },
            ].map((review) => (
              <article className="review-card" key={review.name}>
                <div className="review-stars" aria-label="Five star sample rating">★★★★★</div>
                <p className="review-quote">“{review.text}”</p>
                <div className="review-person"><span className="review-avatar">{review.name.charAt(0)}</span><span><strong>{review.name}</strong><small>{review.city}, Pakistan</small></span></div>
              </article>
            ))}
          </div>
          <button className="reviews-arrow" type="button" aria-label="Next reviews" onClick={() => { const el = reviewsTrackRef.current; if (el) el.scrollBy({ left: el.clientWidth * 0.82, behavior: 'smooth' }) }}>→</button>
        </div>
        <div className="reviews-hint">Swipe to explore <span aria-hidden="true">⟶</span></div>
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

      {/* CUSTOMER NOTES — two moving rows at the very end of the page */}
      <section className="reviews-section section container" aria-labelledby="reviews-title">
        <div className="reviews-heading">
          <div>
            <p className="micro micro--stone">06 / Notes from the community</p>
            <h2 id="reviews-title" className="display display--xl">Worn, loved, <em>remembered.</em></h2>
          </div>
          <p className="reviews-intro">A little love for the pieces that find a place in your everyday wardrobe.</p>
        </div>
        <div className="reviews-preview-note">PREVIEW SAMPLES · Replace with verified customer reviews before launch</div>
        {[reviewSamples.slice(0, 18), reviewSamples.slice(18, 36)].map((lane, laneIndex) => (
          <div className={`reviews-lane reviews-lane--${laneIndex === 0 ? 'left' : 'right'}`} key={laneIndex}>
            <div className="reviews-track">
              {[0, 1].map((copy) => (
                <div className="reviews-track-inner" key={copy} aria-hidden={copy === 1}>
                  {lane.map((review) => (
                    <article className="review-card" key={`${copy}-${review.name}`}>
                      <div className="review-stars" aria-label="Five star sample rating">★★★★★</div>
                      <p className="review-quote">“{review.text}”</p>
                      <div className="review-person"><span className="review-avatar">{review.name.charAt(0)}</span><span><strong>{review.name}</strong><small>{review.city}, Pakistan</small></span></div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
