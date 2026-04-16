import type { ReactNode } from 'react'

export const metadata = {
  title: 'Redaktør – albertdieckmann.dk',
}

export default function KeystaticLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* Gør admin UI'et mere kompakt */
        [data-keystatic-nav] {
          min-width: 200px !important;
          max-width: 220px !important;
          width: 220px !important;
        }
        /* Sørg for at indholdsområdet fylder det resterende */
        [data-keystatic-content] {
          flex: 1 !important;
          min-width: 0 !important;
        }
      `}</style>
      {children}
    </>
  )
}
