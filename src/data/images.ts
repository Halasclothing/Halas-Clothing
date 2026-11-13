import type { ImageRef } from './types'

const catalogImg = (id: string, alt: string): ImageRef => ({
  src: `/images/products/${id}.jpg`,
  small: `/images/products/${id}-420.jpg`,
  width: 1024,
  height: 1280,
  alt,
  kind: 'catalog',
})

const campaignImg = (id: string, alt: string, w = 1024, h = 1536): ImageRef => ({
  src: `/images/lookbook/${id}.jpg`,
  small: `/images/lookbook/${id}-420.jpg`,
  width: w,
  height: h,
  alt,
  kind: 'campaign',
})

export const craftImgs = {
  zardozi: {
    src: '/images/craft/zardozi.jpg',
    small: '/images/craft/zardozi-420.jpg',
    width: 1024,
    height: 1024,
    alt: 'An artisan embroidering gold zardozi thread onto ivory fabric held in a wooden adda frame.',
    kind: 'craft',
  },
  fabrics: {
    src: '/images/craft/fabrics.jpg',
    small: '/images/craft/fabrics-420.jpg',
    width: 1024,
    height: 1024,
    alt: 'A folded stack of dyed natural fabrics in ivory, sand, ochre, emerald and ink black.',
    kind: 'craft',
  },
} satisfies Record<string, ImageRef>

export const heroImg: ImageRef = {
  src: '/images/campaign/hero-wide.jpg',
  small: '/images/campaign/hero-wide-420.jpg',
  width: 1792,
  height: 1024,
  alt: 'A model in an ivory embroidered ensemble standing against a sunlit lime-plaster haveli wall.',
  kind: 'campaign',
}

export const lookbookImgs = {
  l1: campaignImg(
    'l1',
    'A model in an ivory embroidered dress against an old Lahore plaster wall, arch shadows falling across her.',
  ),
  l2: campaignImg(
    'l2',
    'Two models in linen and raw-silk co-ord sets seated on a woven charpai in a sunlit courtyard.',
    1536,
    1024,
  ),
  l3: campaignImg(
    'l3',
    'Back view of a model in an emerald kurta with ivory dupatta walking through a sandstone arched corridor.',
  ),
  l4: campaignImg(
    'l4',
    'A model in a dusty rose set on a rooftop at dusk, her organza dupatta caught in the wind.',
    1536,
    1024,
  ),
  l5: campaignImg(
    'l5',
    'Seated portrait of a model in a champagne silk slip dress with gold earrings, looking away.',
  ),
  l6: campaignImg(
    'l6',
    'A vast Lahore courtyard with carved balconies and a single figure in a black evening dress below.',
    1536,
    1024,
  ),
} satisfies Record<string, ImageRef>

export { catalogImg, campaignImg }
