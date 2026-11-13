import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
  ...props,
})

export const IconBag = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)

export const IconHeart = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />
  </svg>
)

export const IconSearch = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <circle cx={11} cy={11} r={6} />
    <path d="m16 16 4 4" />
  </svg>
)

export const IconClose = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const IconMenu = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
)

export const IconArrow = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path d="M4 12h15m-5-6 6 6-6 6" />
  </svg>
)

export const IconPlus = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconMinus = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path d="M5 12h14" />
  </svg>
)

export const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="m5 13 4 4L19 7" />
  </svg>
)

export const IconLink = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M10 14a4 4 0 0 1 0-5.7l2.2-2.2a4 4 0 0 1 5.6 5.6l-1 1" />
    <path d="M14 10a4 4 0 0 0 0 5.7l-2.2 2.2a4 4 0 0 1-5.6-5.6l1-1" />
  </svg>
)
