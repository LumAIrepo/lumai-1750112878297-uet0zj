import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/providers/wallet-provider'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PumpClone - Launch Your Meme Token',
  description: 'The ultimate platform for launching meme tokens with automated bonding curves and fair launches on Solana',
  keywords: ['solana', 'meme tokens', 'defi', 'bonding curve', 'fair launch', 'cryptocurrency'],
  authors: [{ name: 'PumpClone Team' }],
  creator: 'PumpClone',
  publisher: 'PumpClone',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://pumpclone.com'),
  openGraph: {
    title: 'PumpClone - Launch Your Meme Token',
    description: 'The ultimate platform for launching meme tokens with automated bonding curves and fair launches on Solana',
    url: 'https://pumpclone.com',
    siteName: 'PumpClone',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PumpClone - Launch Your Meme Token',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PumpClone - Launch Your Meme Token',
    description: 'The ultimate platform for launching meme tokens with automated bonding curves and fair launches on Solana',
    images: ['/og-image.png'],
    creator: '@pumpclone',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={`${inter.className} antialiased min-h-screen bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <WalletProvider>
              <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
            </WalletProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}