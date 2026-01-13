import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mercantil Seguros Bot - Generador de Cotizaciones',
  description: 'Interfaz de prueba para el bot de cotizaciones de seguro de viaje de Mercantil Seguros',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

