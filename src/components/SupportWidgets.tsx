import { useMemo, useState } from 'react'

const FAQS = [
  { q: 'How do I choose my size?', keys: ['size','fit','measurement'], a: 'Please check the size options and fit notes on the product page. If you are between sizes, tell us the product name and we can help you ask the atelier for style-specific guidance.' },
  { q: 'How can I track my order?', keys: ['track','tracking','order status','where is my order'], a: 'Order tracking will be available once live order management and shipping notifications are connected. For now, please contact the HALA.S team with your order reference.' },
  { q: 'What are the delivery charges and timings?', keys: ['delivery','shipping','charges','days','when will'], a: 'Delivery coverage, charges and estimated timelines are confirmed by HALA.S customer care before dispatch. Please contact the team for your delivery estimate.' },
  { q: 'Can I return or exchange an item?', keys: ['return','exchange','refund'], a: 'The official return and exchange policy has not yet been supplied. We do not want to promise an eligibility window or refund that may be inaccurate; please confirm with customer care.' },
  { q: 'Which payment methods can I use?', keys: ['payment','pay','card','cash','cod'], a: 'HALA.S currently accepts Cash on Delivery (COD) only. You can pay in cash when your parcel is delivered.' },
  { q: 'How should I care for my outfit?', keys: ['care','wash','clean','fabric'], a: 'Please follow the care instructions on the product page. Some delicate fabrics and embellished pieces may require dry cleaning or specialist handling.' },
  { q: 'Do you offer international delivery?', keys: ['international','abroad','overseas','outside pakistan'], a: 'International shipping availability has not yet been confirmed. Please contact the team with your destination country for an accurate answer.' },
  { q: 'How do I contact HALA.S?', keys: ['contact','whatsapp','human','person','team','support'], a: 'Use the WhatsApp button on the website once the official business number is configured, or contact HALA.S through its verified social channels.' },
]
const GREETING = 'Welcome to HALA.S. I can help with sizing, product care, delivery, returns and payments. Ask me a question or choose a topic below.'
export function SupportWidgets() {
  const [chatOpen, setChatOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<{from:'bot'|'you'; text:string}[]>([{from:'bot',text:GREETING}])
  const whatsapp = String((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '')
  const suggestions = useMemo(() => FAQS.slice(0, 4), [])
  const ask = (value: string) => {
    const q = value.trim(); if (!q) return
    const normalized = q.toLowerCase()
    const found = FAQS.find((item) => item.keys.some((key) => normalized.includes(key)) || normalized.includes(item.q.toLowerCase().replace('?', '')))
    const answer = found?.a || 'I do not have a verified answer for that yet. I do not want to guess about store policies or your order. Please contact HALA.S customer care for confirmation.'
    setMessages((old) => [...old, {from:'you',text:q}, {from:'bot',text:answer}]); setQuestion('')
  }
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hello HALA.S, I need help with a product/order enquiry.')}` : ''
  return <>
    {whatsapp && <a className="whatsapp-float" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Chat with HALA.S on WhatsApp"><span>◉</span><b>WhatsApp</b></a>}
    <div className="support-float">
      {chatOpen && <section className="support-panel" aria-label="HALA.S customer assistant"><header><div><p className="micro">HALA.S CUSTOMER CARE</p><strong>How can we help?</strong></div><button onClick={() => setChatOpen(false)} aria-label="Close chat">×</button></header><div className="support-messages" aria-live="polite">{messages.map((m,i)=><p key={i} className={`support-message support-message--${m.from}`}>{m.text}</p>)}</div><div className="support-suggestions">{suggestions.map((f)=><button key={f.q} onClick={()=>ask(f.q)}>{f.q}</button>)}</div><form className="support-form" onSubmit={(e)=>{e.preventDefault();ask(question)}}><input value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder="Ask a question…" aria-label="Ask a question"/><button type="submit">Send</button></form>{whatsappUrl && <a className="support-whatsapp-link" href={whatsappUrl} target="_blank" rel="noreferrer">Continue on WhatsApp ↗</a>}</section>}
      <button className="support-launch" onClick={()=>setChatOpen((v)=>!v)} aria-expanded={chatOpen}><span>✳</span> {chatOpen ? 'Close' : 'Ask HALA.S'}</button>
    </div>
  </>
}
