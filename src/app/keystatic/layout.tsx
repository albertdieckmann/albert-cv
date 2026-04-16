'use client'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export default function KeystaticLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Nulstil gemt sidebar-bredde fra localStorage hvis den er kollapset
    for (const key of Object.keys(localStorage)) {
      if (key.includes('keystatic-app-split-view')) {
        localStorage.removeItem(key)
      }
    }
  }, [])

  return (
    <>
      <style>{`
        /* SplitView-wrapper: tving vandret layout */
        :has(> [data-split-pane="primary"]) {
          display: flex !important;
          flex-direction: row !important;
          height: 100vh !important;
          overflow: hidden !important;
        }

        /* Nav-panel: fast bredde til venstre */
        [data-split-pane="primary"] {
          flex-shrink: 0 !important;
          min-width: 220px !important;
          max-width: 280px !important;
          height: 100vh !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          position: relative !important;
        }

        /* Indholdsområde: fylder resten */
        [data-split-pane]:not([data-split-pane="primary"]) {
          flex: 1 !important;
          min-width: 0 !important;
          height: 100vh !important;
          overflow-y: auto !important;
        }
      `}</style>
      {children}
    </>
  )
}
