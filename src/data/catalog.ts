import type { CollectionMeta, Product } from './types'
import { catalogImg, heroImg, lookbookImgs } from './images'

const S = (...labels: string[]) =>
  ['XS', 'S', 'M', 'L', 'XL'].map((label) => ({ label, available: labels.includes(label) }))

export const PRODUCTS: Product[] = [
  {
    id: 'p01',
    handle: 'zohra-chikankari-midi-dress',
    title: 'Zohra Chikankari Midi Dress',
    colourName: 'Ivory',
    colourHex: '#efe9dc',
    price: 14900,
    currency: 'PKR',
    fabric: 'Fine cotton lawn',
    care: 'Cold hand wash separately; dry in shade.',
    description:
      'A midi dress in ivory lawn worked entirely in white-on-white chikankari, with a modest neckline and a flare that moves without weight. Cut long through the body so it sits flat at the shoulder.',
    images: [
      catalogImg('p-zohra', 'Zohra Chikankari Midi Dress in ivory cotton lawn, front view on a model.'),
      lookbookImgs.l1,
    ],
    sizes: S('XS', 'S', 'M', 'L'),
    collections: ['dresses'],
    releasedAt: '2026-10-02',
  },
  {
    id: 'p02',
    handle: 'mehr-raw-silk-co-ord',
    title: 'Mehr Raw Silk Co-Ord',
    colourName: 'Ink Black',
    colourHex: '#16140f',
    price: 18500,
    currency: 'PKR',
    fabric: 'Raw silk',
    care: 'Dry clean only.',
    description:
      'A boxy camp-collar shirt in matte raw silk, paired with a straight tailored trouser. The silk holds its shape through the day, so the line stays crisp from the first meeting to the last.',
    images: [
      catalogImg('p-mehr', 'Mehr Raw Silk Co-Ord: black raw silk shirt and straight trousers, front view.'),
      lookbookImgs.l2,
    ],
    sizes: S('S', 'M', 'L', 'XL'),
    collections: ['co-ord-sets'],
    releasedAt: '2026-08-14',
  },
  {
    id: 'p03',
    handle: 'rani-zardozi-formal-gown',
    title: 'Rani Zardozi Formal Gown',
    colourName: 'Garnet',
    colourHex: '#6d1f26',
    price: 32000,
    compareAtPrice: 39500,
    currency: 'PKR',
    fabric: 'Silk canvas with gold zardozi',
    care: 'Dry clean only; store flat.',
    description:
      'A floor-length gown in garnet silk canvas, finished with hand zardozi along the hem and cuffs. The bodice is structured, the skirt left quiet — the embroidery does the speaking.',
    images: [
      catalogImg('p-rani', 'Rani Zardozi Formal Gown in garnet silk with gold embroidered hem, front view.'),
    ],
    sizes: S('XS', 'S', 'M'),
    collections: ['dresses'],
    releasedAt: '2026-05-20',
  },
  {
    id: 'p04',
    handle: 'sahil-linen-shirt-trouser',
    title: 'Sahil Linen Shirt & Trouser',
    colourName: 'Stone',
    colourHex: '#c3bcac',
    price: 12900,
    currency: 'PKR',
    fabric: 'Washed linen',
    care: 'Machine wash cold on gentle; iron damp.',
    description:
      'A camp-collar shirt in washed stone linen with a rolled sleeve, cut to sit over wide straight trousers. Made for long afternoons — the linen softens rather than creases badly.',
    images: [
      catalogImg('p-sahil', 'Sahil Linen Shirt and Trouser set in stone beige linen, front view.'),
      lookbookImgs.l2,
    ],
    sizes: S('S', 'M', 'L', 'XL'),
    collections: ['ready-to-wear', 'co-ord-sets'],
    releasedAt: '2026-07-08',
  },
  {
    id: 'p05',
    handle: 'noor-ochre-kurta-set',
    title: 'Noor Ochre Kurta Set',
    colourName: 'Ochre',
    colourHex: '#c8922e',
    price: 9800,
    compareAtPrice: 12400,
    currency: 'PKR',
    fabric: 'Cotton slub with block print',
    care: 'First wash separate; cold machine wash.',
    description:
      'A straight kurta in ochre cotton slub with a small hand-blocked motif down the placket, matched to plain straight pants. The block print is deliberately sparse so it reads as texture, not pattern.',
    images: [catalogImg('p-noor', 'Noor Ochre Kurta Set: block-printed ochre kurta with straight pants.')],
    sizes: S('XS', 'S', 'M', 'L', 'XL'),
    collections: ['ready-to-wear'],
    releasedAt: '2026-04-11',
  },
  {
    id: 'p06',
    handle: 'gul-rose-gharara-set',
    title: 'Gul Rose Gharara Set',
    colourName: 'Dusty Rose',
    colourHex: '#c08b8b',
    price: 24500,
    currency: 'PKR',
    fabric: 'Silk cotton with organza dupatta',
    care: 'Dry clean only.',
    description:
      'A short kurta with gathered flowing trousers in dusty rose silk cotton, finished with a plain organza dupatta. The gather sits low on the hip so the volume falls from the knee, not the waist.',
    images: [
      catalogImg('p-gul', 'Gul Rose Gharara Set with organza dupatta, front view on a model.'),
      lookbookImgs.l4,
    ],
    sizes: S('S', 'M', 'L'),
    collections: ['co-ord-sets'],
    releasedAt: '2026-10-10',
  },
  {
    id: 'p07',
    handle: 'sitara-embellished-evening-dress',
    title: 'Sitara Embellished Evening Dress',
    colourName: 'Ink Black',
    colourHex: '#1a1815',
    price: 38000,
    currency: 'PKR',
    fabric: 'Crepe with tonal beadwork',
    care: 'Dry clean only; do not hang beaded section.',
    description:
      'A column evening dress in ink crepe with tonal beadwork concentrated at the shoulder, so the light catches it only when you move. No contrast, no sequin spill — one quiet surface of work.',
    images: [
      catalogImg('p-sitara', 'Sitara Embellished Evening Dress in ink black with tonal beadwork.'),
      lookbookImgs.l6,
    ],
    sizes: S('XS', 'S', 'M', 'L'),
    collections: ['dresses'],
    releasedAt: '2026-09-28',
  },
  {
    id: 'p08',
    handle: 'aman-ecru-shirt-dress',
    title: 'Aman Ecru Shirt Dress',
    colourName: 'Ecru',
    colourHex: '#e6ddcb',
    price: 8900,
    compareAtPrice: 11200,
    currency: 'PKR',
    fabric: 'Cotton poplin',
    care: 'Machine wash warm; tumble low.',
    description:
      'An oversized ecru poplin shirt dress with dropped shoulders and a hem at mid-calf. Comes with a self belt, worn loose — the shape is meant to be lived in, not cinched.',
    images: [catalogImg('p-aman', 'Aman Ecru Shirt Dress in cotton poplin, worn loose with self belt.')],
    sizes: S('S', 'M', 'L', 'XL'),
    collections: ['ready-to-wear'],
    releasedAt: '2026-03-30',
  },
  {
    id: 'p09',
    handle: 'laila-emerald-kurta-dupatta',
    title: 'Laila Emerald Kurta with Dupatta',
    colourName: 'Deep Emerald',
    colourHex: '#1f3d33',
    price: 16700,
    currency: 'PKR',
    fabric: 'Silk blend with ivory dupatta',
    care: 'Dry clean recommended for the dupatta.',
    description:
      'A straight kurta in deep emerald silk blend, sold with a plain ivory dupatta finished with a narrow hand-rolled edge. Worn together it reads formal; apart, the kurta is everyday.',
    images: [
      catalogImg('p-laila', 'Laila Emerald Kurta with contrasting ivory dupatta, front view.'),
      lookbookImgs.l3,
    ],
    sizes: S('XS', 'S', 'M', 'L'),
    collections: ['ready-to-wear'],
    releasedAt: '2026-06-18',
  },
  {
    id: 'p10',
    handle: 'nadia-champagne-silk-slip',
    title: 'Nadia Champagne Silk Slip Dress',
    colourName: 'Champagne',
    colourHex: '#d9c8a8',
    price: 21300,
    currency: 'PKR',
    fabric: 'Bias-cut silk with resham embroidery',
    care: 'Dry clean only.',
    description:
      'A bias-cut champagne slip with resham floral embroidery only at the neckline. Cut on the true bias so the fabric skims rather than clings — it needs no lining to fall well.',
    images: [
      catalogImg('p-nadia', 'Nadia Champagne Silk Slip Dress with resham embroidery at the neckline.'),
      lookbookImgs.l5,
    ],
    sizes: S('XS', 'S', 'M', 'XL'),
    collections: ['dresses'],
    releasedAt: '2026-10-16',
  },
  {
    id: 'p11',
    handle: 'zubia-charcoal-trouser-tunic',
    title: 'Zubia Charcoal Trouser & Tunic',
    colourName: 'Charcoal',
    colourHex: '#3c3b39',
    price: 15400,
    currency: 'PKR',
    fabric: 'Wool-blend suiting',
    care: 'Dry clean only; steam to refresh.',
    description:
      'A short boxy tunic in charcoal wool blend over a wide-leg tailored trouser. The suiting has enough body to hold the wide leg, which is the whole point of the set.',
    images: [catalogImg('p-zubia', 'Zubia Charcoal Trouser and Tunic co-ord, front view.')],
    sizes: S('S', 'M', 'L'),
    collections: ['co-ord-sets'],
    releasedAt: '2026-09-05',
  },
  {
    id: 'p12',
    handle: 'ira-sand-cape-kurta',
    title: 'Ira Sand Cape Kurta',
    colourName: 'Sand',
    colourHex: '#cdbfa3',
    price: 11600,
    compareAtPrice: 14800,
    currency: 'PKR',
    fabric: 'Cotton voile over kurta',
    care: 'Hand wash cold; reshape while damp.',
    description:
      'A sleeveless voile cape layered over a simple straight kurta and trousers in sand. The cape is unlined and unhurried — it moves before the rest of the outfit does.',
    images: [catalogImg('p-ira', 'Ira Sand Cape Kurta with layered voile cape, front view.')],
    sizes: S('XS', 'S', 'L', 'XL'),
    collections: ['ready-to-wear'],
    releasedAt: '2026-05-02',
  },
]

/** Transparent merchandising rule: items released within the last 35 days. */
export const NEW_IN_WINDOW_DAYS = 35

export const isNewIn = (p: Product, now = new Date()): boolean => {
  const cutoff = now.getTime() - NEW_IN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return new Date(p.releasedAt).getTime() >= cutoff
}

export const isOnSale = (p: Product): boolean =>
  typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.price

export const COLLECTIONS: CollectionMeta[] = [
  {
    handle: 'new-in',
    title: 'New In',
    tagline: 'The latest cuts, fresh off the atelier floor.',
    image: lookbookImgs.l1,
  },
  {
    handle: 'sale',
    title: 'Sale',
    tagline: 'End-of-season pieces, honestly reduced.',
    image: { ...catalogImg('p-rani', 'Rani Zardozi Formal Gown in garnet silk.') },
  },
  {
    handle: 'ready-to-wear',
    title: 'Ready to Wear',
    tagline: 'Everyday tailoring with an editorial hand.',
    image: catalogImg('p-sahil', 'Sahil Linen Shirt and Trouser set in stone linen.'),
  },
  {
    handle: 'dresses',
    title: 'Dresses',
    tagline: 'From lawn afternoons to formal nights.',
    image: catalogImg('p-zohra', 'Zohra Chikankari Midi Dress in ivory lawn.'),
  },
  {
    handle: 'co-ord-sets',
    title: 'Co-Ord Sets',
    tagline: 'Matched sets, considered to the millimetre.',
    image: catalogImg('p-mehr', 'Mehr Raw Silk Co-Ord in black raw silk.'),
  },
  {
    handle: 'all',
    title: 'All Products',
    tagline: 'The complete HALA.S wardrobe.',
    image: heroImg,
  },
]
