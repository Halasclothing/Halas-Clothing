import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...props,
})

export type IconProps = SVGProps<SVGSVGElement>

export const IconDashboard = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="7.5" height="7.5" /><rect x="13.5" y="3" width="7.5" height="7.5" /><rect x="3" y="13.5" width="7.5" height="7.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" /></svg>
)
export const IconProducts = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" /><path d="M4 7.5V17l8 4 8-4V7.5" /><path d="M12 12v9" /></svg>
)
export const IconCollections = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="8" height="7" /><rect x="13" y="4" width="8" height="7" /><rect x="3" y="13" width="8" height="7" /><rect x="13" y="13" width="8" height="7" /></svg>
)
export const IconInventory = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" /><path d="M3 8.5V16l9 4.5 9-4.5V8.5" /><path d="M7.5 6.2 16.5 11" /></svg>
)
export const IconOrders = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3h9l4 4v14H6z" /><path d="M14.5 3v4.5H19" /><path d="M9 12h7M9 16h5" /></svg>
)
export const IconDeliveries = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 7h11v10H3z" /><path d="M14 10h4l3 3v4h-7" /><circle cx="7" cy="18.5" r="1.6" /><circle cx="17" cy="18.5" r="1.6" /></svg>
)
export const IconCustomers = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" /><path d="M16.5 5.2a3.2 3.2 0 0 1 0 6.2M18 14.6c2 .7 3.3 2.3 3.3 4.4" /></svg>
)
export const IconAnalytics = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-5M12 16V8M16 16v-3M20 16V6" /></svg>
)
export const IconNotifications = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.4 5.5 1.4 5.5H4.6S6 13.5 6 9.5Z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></svg>
)
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 14.4a8 8 0 0 0 0-4.8l1.6-1.2-2-3.4-1.9.8a8 8 0 0 0-4.1-2.4L12.6 1h-4l-.4 2.4a8 8 0 0 0-4.1 2.4l-1.9-.8-2 3.4L1.8 9.6a8 8 0 0 0 0 4.8L.2 15.6l2 3.4 1.9-.8a8 8 0 0 0 4.1 2.4l.4 2.4h4l.4-2.4a8 8 0 0 0 4.1-2.4l1.9.8 2-3.4Z" /></svg>
)
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconArrowLeft = (p: IconProps) => (
  <svg {...base(p)}><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></svg>
)
export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
)
export const IconExternal = (p: IconProps) => (
  <svg {...base(p)}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 14v6H4V5h6" /></svg>
)
export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 21H4V3h5" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" /></svg>
)
export const IconMenu = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 6 12 12M18 6 6 18" /></svg>
)
export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></svg>
)
export const IconDuplicate = (p: IconProps) => (
  <svg {...base(p)}><rect x="8" y="8" width="12" height="12" /><path d="M16 8V4H4v12h4" /></svg>
)
export const IconUpload = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v4h16v-4" /></svg>
)
export const IconPrint = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 8V3h10v5" /><rect x="4" y="8" width="16" height="8" /><path d="M7 16v5h10v-5" /></svg>
)
export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></svg>
)
export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 11a8 8 0 0 0-14-5L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14 5l3-3" /><path d="M21 20v-5h-5" /></svg>
)
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 12 5 5 9-10" /></svg>
)
export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17.5v.5" /></svg>
)
export const IconPhone = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3h4l2 5-2.5 1.5a13 13 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2Z" /></svg>
)
export const IconEye = (p: IconProps) => (
  <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const IconFilter = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" /></svg>
)
export const IconMail = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" /><path d="m3 7 9 6 9-6" /></svg>
)
export const IconImage = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></svg>
)
export const IconBox = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 3 8v8l9 5 9-5V8l-9-5Z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></svg>
)
export const IconTrendUp = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 17 9.5 10.5l4 4L21 7" /><path d="M15 7h6v6" /></svg>
)
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}><rect x="4.5" y="10" width="15" height="11" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
