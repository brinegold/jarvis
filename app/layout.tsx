import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ServerInitializer } from '@/components/ServerInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jarvis Staking - Smart Crypto Growth Platform',
  description: 'Invest in Future Smart Crypto Growth with Jarvis Staking. Revolutionary cryptocurrency investment platform offering secure, decentralized alternatives to traditional money.',
  icons: {
    icon: '/logo_32x32.png',
    shortcut: '/logo_32x32.png',
    apple: '/logo_32x32.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ServerInitializer />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
