import './globals.css'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import WeatherTicker from '@/components/WeatherTicker'

export const metadata: Metadata = {
  title: 'Local News & Events',
  description: 'Local hub for news, weather, and events.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WeatherTicker />
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
