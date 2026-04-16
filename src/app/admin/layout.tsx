import type { ReactNode } from 'react'

export const metadata = {
  title: 'Admin – albertdieckmann.dk',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', zIndex: 0 }}>
      <style>{`
        /* Skjul Clerk's development topbar på admin-siden */
        [data-clerk-development-mode-banner],
        .__clerk_dev_badge,
        .__clerk_dev_badge_link {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  )
}
