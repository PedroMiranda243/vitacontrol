import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'VitaControl — Controle Financeiro',
  description: 'Sistema de controle financeiro para consultas de fonoaudiologia - Vitalab Medicina Diagnóstica',
  keywords: ['fonoaudiologia', 'controle financeiro', 'audiometria', 'repasse'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
