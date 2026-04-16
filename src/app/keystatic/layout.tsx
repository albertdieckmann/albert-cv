'use client'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export default function KeystaticLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Sørg for at sidebar-bredde ikke er gemt som 0
    const saved = localStorage.getItem('keystatic-app-split-view')
    if (!saved || Number(saved) < 180) {
      localStorage.setItem('keystatic-app-split-view', '260')
    }
  }, [])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      minWidth: '1024px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      containerType: 'size',
    }}>
      {children}
    </div>
  )
}
