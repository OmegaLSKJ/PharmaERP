import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { setupSmartPrint } from './lib/printUtils'

// Initialize intelligent print orientation (automatically chooses Portrait vs Landscape for best visibility)
setupSmartPrint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

