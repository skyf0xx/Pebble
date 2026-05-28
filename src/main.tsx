import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAppStore } from './store'

const wsUrl = new URLSearchParams(window.location.search).get('ws')
useAppStore.getState().setWsUrl(wsUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
