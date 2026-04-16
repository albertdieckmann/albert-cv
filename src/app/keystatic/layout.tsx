'use client'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export default function KeystaticLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Tving desktop viewport (≥1200px) så Keystatic bruger desktop-layout
    const existing = document.querySelector('meta[name="viewport"]')
    const original = existing?.getAttribute('content') ?? ''

    const meta = existing ?? document.createElement('meta')
    meta.setAttribute('name', 'viewport')
    meta.setAttribute('content', 'width=1280')
    if (!existing) document.head.appendChild(meta)

    // Nulstil sidebar-bredde
    const saved = localStorage.getItem('keystatic-app-split-view')
    if (!saved || Number(saved) < 180) {
      localStorage.setItem('keystatic-app-split-view', '260')
    }

    return () => {
      // Gendan viewport når man forlader /keystatic
      if (original) meta.setAttribute('content', original)
    }
  }, [])

  return <>{children}</>
}
