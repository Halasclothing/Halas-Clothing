import { Link, useParams } from 'react-router-dom'
import { ARTICLES } from '../data/editorial'
import { useDocumentTitle } from '../useDocumentTitle'

export function BlogPage() {
  const { slug } = useParams()
  const article = ARTICLES.find((item) => item.slug === slug)
  useDocumentTitle(article ? `${article.title} — HALA.S Journal` : 'The Journal — HALA.S')
  if (slug && !article) return <section className="editorial-page container"><p className="micro">THE JOURNAL</p><h1 className="display">Story not found.</h1><Link className="btn" to="/journal">Back to journal</Link></section>
  if (article) return <article className="editorial-page container"><Link className="micro" to="/journal">← The Journal</Link><p className="micro micro--stone" style={{marginTop:'2rem'}}>{article.category} · {article.date}</p><h1 className="display editorial-title">{article.title}</h1><img className="editorial-hero" src={article.image} alt="HALA.S editorial"/><div className="editorial-copy">{article.body.map((p) => <p key={p}>{p}</p>)}</div></article>
  return <section className="editorial-page container"><p className="micro micro--stone">NOTES FROM THE ATELIER</p><h1 className="display editorial-title">The Journal<span className="mark">.</span></h1><p className="lede editorial-lede">Stories on craft, considered dressing and the details that make a garment yours.</p><div className="journal-grid">{ARTICLES.map((item) => <Link className="journal-card" to={`/journal/${item.slug}`} key={item.slug}><img src={item.image} alt=""/><p className="micro micro--stone">{item.category}</p><h2 className="display">{item.title}</h2><p className="notice">{item.excerpt}</p><span className="micro">READ STORY ↗</span></Link>)}</div></section>
}
