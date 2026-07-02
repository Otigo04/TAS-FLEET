import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'TAS FLEET',
  description: 'Fahrer- und Flottenverwaltung — TAS WEBWORKS',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0891b2' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
}

/**
 * Setzt die .dark-Klasse VOR dem ersten Paint (kein Theme-Flash).
 * Gespeicherte Wahl (localStorage) gewinnt, sonst Systempräferenz.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('tas-fleet-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  )
}
