import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted webfonts (no CDN): weights match actual use — 400 body,
// 500 headings/table headers, 600 zone-label names; mono is single-weight.
// The display face ships only its 900 cut: it is confined to hero/poster
// scale and must never become a third reading font.
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/big-shoulders-display/900.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
