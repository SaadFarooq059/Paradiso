import { Analytics } from '@vercel/analytics/next'
import { Geist, Geist_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth/auth-context'
import { ThemeProvider } from '@/components/theme-provider'
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
  // Both schemes are supported now, so the browser is told so — this drives the
  // UA styling of form controls and scrollbars, which would otherwise stay light
  // while the page went dark.
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF6E1' },
    { media: '(prefers-color-scheme: dark)', color: '#241A16' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: next-themes sets the class on <html> from an
    // inline script before React hydrates, so the server and client markup for
    // this one element legitimately differ.
    <html
      lang="en"
      suppressHydrationWarning
      className={`bg-background ${_geistSans.variable} ${_geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <SplashScreen />
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
