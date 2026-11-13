import { Link } from 'react-router-dom'
import { EditorialFrame } from '../components/EditorialFrame'
import { ProductCard } from '../components/ProductCard'
import { StickyChapter } from '../components/StickyChapter'
import { IconArrow } from '../components/Icons'
import { DisplayLines, Reveal } from '../motion/Reveal'
import { useDocumentTitle } from '../useDocumentTitle'
import { PRODUCTS } from '../data/catalog'
import { craftImgs, lookbookImgs } from '../data/images'

const byHandle = (handle: string) => PRODUCTS.find((p) => p.handle === handle)!

export function LookbookPage() {
  useDocumentTitle('The Ivory Hour — HALA.S CLOTHING Lookbook')

  const chapterOne = [byHandle('zohra-chikankari-midi-dress'), byHandle('nadia-champagne-silk-slip')]
  const chapterTwo = [byHandle('sahil-linen-shirt-trouser'), byHandle('laila-emerald-kurta-dupatta')]
  const chapterThree = [byHandle('sitara-embellished-evening-dress'), byHandle('gul-rose-gharara-set')]

  return (
    <>
      <header className="lookbook-intro container">
        <Reveal as="p" variant="fade" className="micro micro--stone">
          Campaign · Chapter 00
        </Reveal>
        <DisplayLines
          as="h1"
          className="display display--mega"
          lines={['The', 'Ivory', 'Hour']}
          baseDelay={120}
          style={{ marginTop: '0.6rem' }}
        />
        <Reveal as="div" variant="up" delay={420} className="lookbook-credits">
          <p className="lede">
            Nine garments, one courtyard, and the twenty minutes after the sun drops behind the jharoka balconies.
            Photographed in Lahore, Autumn 2026.
          </p>
          <p className="micro micro--stone" style={{ marginTop: '1rem' }}>
            Every tagged piece below opens its real catalogue page.
          </p>
        </Reveal>
      </header>

      {/* Chapter I — pinned imagery while the copy scrolls (Effect 5) */}
      <StickyChapter
        eyebrow="Chapter I · First light"
        tilt
        media={[lookbookImgs.l1, lookbookImgs.l5, craftImgs.zardozi]}
        steps={[
          {
            numeral: 'i',
            title: 'Ivory, before the day starts',
            body: 'Chikankari on cotton lawn reads as texture rather than decoration — at first light it is almost invisible, which is exactly the intention.',
            link: { to: `/product/${chapterOne[0].handle}`, label: chapterOne[0].title },
            media: lookbookImgs.l1,
          },
          {
            numeral: 'ii',
            title: 'Bias cut, no lining',
            body: 'The champagne slip is cut on the true bias, so it falls with the body instead of over it. Resham embroidery sits only at the neckline.',
            link: { to: `/product/${chapterOne[1].handle}`, label: chapterOne[1].title },
            media: lookbookImgs.l5,
          },
          {
            numeral: 'iii',
            title: 'One surface of work',
            body: 'Embellishment is kept to a single field per garment. Nothing competes with the silhouette.',
            media: craftImgs.zardozi,
          },
        ]}
      />

      {/* Chapter II — full-bleed shot with tagged products (Effect 4 + 7) */}
      <section className="section section--warm" aria-labelledby="chapter-two">
        <div className="container">
          <div className="chapter__label">
            <span className="numeral" aria-hidden="true">
              II
            </span>
            <h2 id="chapter-two" className="display display--xl">
              The Courtyard
            </h2>
          </div>

          <Reveal as="div" variant="curtain" className="look-shot">
            <div className="frame" style={{ aspectRatio: '1536 / 1024' }}>
              <img
                src={lookbookImgs.l2.src}
                srcSet={`${lookbookImgs.l2.small} 420w, ${lookbookImgs.l2.src} 1536w`}
                sizes="(max-width: 900px) 94vw, 1200px"
                width={lookbookImgs.l2.width}
                height={lookbookImgs.l2.height}
                alt={lookbookImgs.l2.alt}
                loading="lazy"
                decoding="async"
              />
            </div>
            <Link className="tag" style={{ insetInlineStart: '16%', insetBlockStart: '26%' }} to={`/product/${chapterTwo[0].handle}`}>
              {chapterTwo[0].title.split(' ')[0]}
            </Link>
            <Link className="tag" style={{ insetInlineStart: '62%', insetBlockStart: '58%' }} to={`/product/${chapterTwo[1].handle}`}>
              {chapterTwo[1].title.split(' ')[0]}
            </Link>
          </Reveal>

          <div className="look-note">
            <Reveal as="p" variant="up" className="lede">
              Linen for the afternoon, silk blend for the evening — the two sets worn here share one fitting and one
              colour rule: nothing brighter than the wall behind it.
            </Reveal>
            <div className="chips" style={{ marginTop: '1.4rem' }}>
              {chapterTwo.map((product) => (
                <Link className="chip" to={`/product/${product.handle}`} key={product.id}>
                  {product.title.split(' ')[0]} — worn in Chapter II
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Chapter III — dark chapter, wipe transition (Effect 6) */}
      <Reveal as="section" variant="fade" className="transition-wipe section--ink" aria-labelledby="chapter-three">
        <div className="container">
          <div className="chapter__label">
            <span className="numeral" aria-hidden="true" style={{ color: 'var(--stone-light)' }}>
              III
            </span>
            <h2 id="chapter-three" className="display display--xl">
              <em>Dusk</em>
            </h2>
          </div>

          <div className="grid12 look-duo">
            <div style={{ gridColumn: '1 / span 7' }}>
              <EditorialFrame
                img={lookbookImgs.l6}
                ratio="wide"
                variant="mask"
                hoverZoom
                parallax={0.04}
                sizes="(max-width: 900px) 90vw, 55vw"
              />
            </div>
            <div style={{ gridColumn: '8 / span 5', marginTop: 'clamp(2rem,12vh,9rem)' }}>
              <EditorialFrame
                img={lookbookImgs.l4}
                ratio="wide"
                variant="mask"
                delay={140}
                className="tilt-r"
                hoverZoom
                parallax={-0.04}
                sizes="(max-width: 900px) 90vw, 38vw"
              />
            </div>
            <Reveal as="p" variant="up" delay={120} className="lede" style={{ gridColumn: '1 / span 6', marginTop: '2rem' }}>
              Two evening pieces photographed against architecture that is older than either of them. The beadwork
              is legible only where the last light lands.
            </Reveal>
          </div>

          <div className="rail" role="region" tabIndex={0} aria-label="Pieces from Chapter III" data-stagger style={{ marginTop: '2.5rem' }}>
            {chapterThree.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </div>
      </Reveal>

      <section className="section container" aria-label="Closing">
        <Reveal as="div" variant="up" className="look-closing">
          <p className="display display--lg">Read the edit, then wear it.</p>
          <div className="buy-row">
            <Link className="btn btn--solid" to="/collections/new-in">
              Shop New In <IconArrow />
            </Link>
            <Link className="btn" to="/collections/all">
              All products
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
