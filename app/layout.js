import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata = {
  title: 'RF Pressecenter',
  description: 'Infoskærm og admin',
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="da">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
