import './assets/tokens.css'
import './overlay/overlay.css'
import { createRoot } from 'react-dom/client'
import OverlayApp from './overlay/OverlayApp'
import { initRendererSentry } from './telemetry/sentry'

initRendererSentry('overlay-renderer')

createRoot(document.getElementById('overlay-root')).render(<OverlayApp />)
