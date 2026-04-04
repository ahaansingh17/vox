import './assets/main.css'

import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { captureRendererException, initRendererSentry } from './telemetry/sentry'

initRendererSentry('renderer')

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    captureRendererException(error, {
      process: 'renderer',
      area: 'react',
      phase: 'root-error-boundary'
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '40px 24px',
            fontFamily: 'monospace',
            color: '#f8e7ef',
            background: '#262624',
            minHeight: '100dvh'
          }}
        >
          <p style={{ color: '#ec89b8', fontWeight: 700, fontSize: '1rem', margin: '0 0 16px' }}>
            App crashed — React rendering error
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              color: '#ffd5e5',
              fontSize: '0.84rem',
              margin: 0
            }}
          >
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
)
