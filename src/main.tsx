import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/archivo/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/motion.css'
import './styles/site.css'
import './styles/scroll-bg.css'
import './styles/admin.css'
import App from './App'

/** Test hook so reduced-motion behaviour can be verified without OS settings. */
if (new URLSearchParams(window.location.search).get('motion') === 'off') {
  document.documentElement.dataset.motion = 'off'
  window.dispatchEvent(new Event('halas:motion'))
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
