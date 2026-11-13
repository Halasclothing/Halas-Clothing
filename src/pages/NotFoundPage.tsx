import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../useDocumentTitle'
import { DisplayLines, Reveal } from '../motion/Reveal'
import { IconArrow } from '../components/Icons'
import { COLLECTIONS } from '../data/catalog'

interface Props {
  reason?: string
  handle?: string
}

export function NotFoundPage({ reason, handle }: Props) {
  useDocumentTitle('Page not found — HALA.S CLOTHING')

  const copy =
    reason === 'unknown-collection'
      ? 'That collection is not part of this edit.'
      : reason === 'catalog-unavailable'
        ? 'The catalogue could not be read right now.'
        : handle
          ? `“${handle}” is not a piece in the current catalogue.`
          : 'This page is not part of the edit.'

  return (
    <div className="container not-found">
      <Reveal as="p" variant="fade" className="micro micro--stone">
        404
      </Reveal>
      <DisplayLines as="h1" className="display display--hero" lines={['Off', 'the', 'page']} baseDelay={100} />
      <Reveal as="p" variant="up" delay={420} className="lede">
        {copy}
      </Reveal>
      <Reveal as="div" variant="fade" delay={500} className="buy-row">
        <Link className="btn btn--solid" to="/collections/all">
          All products <IconArrow />
        </Link>
        <Link className="btn" to="/lookbook">
          Read the lookbook
        </Link>
      </Reveal>

      <Reveal as="div" variant="fade" delay={560} style={{ marginTop: '2.5rem' }}>
        <p className="micro micro--stone" style={{ marginBottom: '0.9rem' }}>
          Collections
        </p>
        <div className="chips">
          {COLLECTIONS.map((c) => (
            <Link className="chip" to={`/collections/${c.handle}`} key={c.handle}>
              {c.title}
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  )
}
