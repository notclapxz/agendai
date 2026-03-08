import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'Agenda Legal — MLP',
  description: 'Agenda personal del estudio MLP',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Agenda',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Script síncrono — corre ANTES del primer paint.
            Fija --app-h a window.innerHeight para evitar el layout shift
            que causa parpadeo en la barra de navegación de Samsung. */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{document.documentElement.style.setProperty('--app-h',window.innerHeight+'px')}catch(e){}})()`,
        }} />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
