import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ON Mobility Portal',
  description: 'Fahrer- und Flottenverwaltung mit Supabase Realtime',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
