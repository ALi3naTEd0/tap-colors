import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '700', '800', '900'],
  variable: '--font-nunito',
})

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Tap Colors',
  description: '¡Toca los colores! Juego de reflejos para niños — toca los círculos de colores antes de que desaparezcan.',
  openGraph: {
    title: 'Tap Colors',
    description: '¡Toca los colores! Juego de reflejos para niños.',
    siteName: 'Tap Colors',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tap Colors',
    description: '¡Toca los colores! Juego de reflejos para niños.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tap Colors',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={nunito.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
