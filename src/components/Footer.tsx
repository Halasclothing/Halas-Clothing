import { Link } from 'react-router-dom'
import { Reveal } from '../motion/Reveal'

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { to: '/collections/new-in', label: 'New In' },
      { to: '/collections/ready-to-wear', label: 'Ready to Wear' },
      { to: '/collections/dresses', label: 'Dresses' },
      { to: '/collections/co-ord-sets', label: 'Co-Ord Sets' },
      { to: '/collections/sale', label: 'Sale' },
      { to: '/collections/all', label: 'All Products' },
    ],
  },
  {
    title: 'Editorial',
    links: [
      { to: '/lookbook', label: 'The Ivory Hour' },
      { to: '/wishlist', label: 'Wishlist' },
      { to: '/journal', label: 'The Journal' },
    ],
  },
  { title: 'Information', links: [ { to: '/about', label: 'About HALA.S' }, { to: '/contact', label: 'Contact' }, { to: '/size-guide', label: 'Size Guide' }, { to: '/faq', label: 'FAQ' }, { to: '/shipping', label: 'Shipping & Returns' }, { to: '/privacy', label: 'Privacy' }, { to: '/terms', label: 'Terms' } ] },
]

const WORDS = ['HALA.S CLOTHING', 'THE IVORY HOUR', 'CUT IN LAHORE', 'AUTUMN EDIT 2026']

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer__marquee" aria-hidden="true">
        <div className="marquee">
          {[0, 1].map((copy) => (
            <div key={copy}>
              {WORDS.map((word, i) => (
                <span className="display" key={i} style={{ whiteSpace: 'nowrap', fontSize: 'clamp(1.6rem,4vw,3rem)' }}>
                  {word} <span style={{ opacity: 0.4 }}>/</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="container">
        <div className="footer__grid">
          <Reveal as="div" variant="up" className="footer__brand">
            HALA<span style={{ color: 'var(--accent-soft)' }}>.</span>S
          </Reveal>

          {COLUMNS.map((column) => (
            <Reveal as="nav" variant="up" key={column.title} aria-label={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}

          <Reveal as="div" variant="up" delay={80}>
            <h3 className="micro" style={{ color: 'var(--stone-light)', marginBottom: '0.9rem' }}>
              Atelier
            </h3>
            <p className="notice" style={{ color: 'var(--stone-light)' }}>
              For product, sizing and order questions, use the customer assistant or the official HALA.S contact channel.
            </p>
          </Reveal>
        </div>

        <div className="footer__legal">
          <p className="micro">© 2026 HALA.S CLOTHING · Prices in Pakistani Rupees</p>
          <p className="micro">HALA.S CLOTHING · Cash on Delivery</p>
          <Link className="footer-admin-link" to="/admin">Private admin studio</Link>
        </div>
      </div>
    </footer>
  )
}
