import { Analytics } from '@vercel/analytics/next'
import { Geist, Geist_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth/auth-context'
import { SplashScreen } from '@/components/splash-screen'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const _geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Paradiso CRM Prototype',
  description: 'Internal ops dashboard for scheduling bakery orders against live ingredient stock.',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FFF6E1',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${_geistSans.variable} ${_geistMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <SplashScreen />
          {children}
          <Toaster />
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
