'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Bot, TrendingUp, Shield, Users, ArrowRight, Star } from 'lucide-react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (!mounted || loading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen jarvis-gradient relative overflow-hidden">
      {/* Floating Background Shapes */}
      <div className="floating-shapes"></div>
      
      {/* Header */}
      <header className="relative z-10 container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image 
              src="/logo_300x300.png" 
              alt="Jarvis Staking Logo" 
              width={128} 
              height={128} 
              className="!w-32 !h-32"
              style={{ width: '128px', height: '128px' }}
              priority
              unoptimized={process.env.NODE_ENV === 'development'}
            />
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/auth/signin" 
              className="text-white hover:text-blue-200 transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/auth/signup" 
              className="jarvis-button px-6 py-2 rounded-full text-white font-semibold"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Invest<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              in Future
            </span><br />
            Smart Crypto Growth !
          </h1>
          
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
            Cryptocurrency is revolutionizing the world of finance — offering 
            borderless, secure, and decentralized alternatives to traditional 
            money. With strong long-term growth and increasing adoption, now 
            is the perfect time to explore digital assets.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/auth/signup" 
              className="jarvis-button px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center justify-center"
            >
              SIGN UP
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/auth/signin" 
              className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-purple-900 transition-all duration-300"
            >
              SIGN IN
            </Link>
          </div>

          {/* Investment Plan */}
          <div className="flex justify-center mb-16">
            <div className="jarvis-card rounded-2xl p-8 text-center border-2 border-green-400 max-w-md">
              <div className="bg-gradient-to-r from-green-400 to-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-3">USDT Staking</h3>
              <p className="text-gray-300 mb-4 text-lg">$10 to $50,000</p>
              <div className="text-4xl font-bold text-green-400 mb-4">5% Daily</div>
              <p className="text-gray-300 mb-4 text-lg">100 JRC per $10</p>
              <div className="text-sm text-gray-400">
                Current: $0.1/token<br />
                Future: $3/token
              </div>
              <div className="absolute -top-3 -right-3 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                Best Plan
              </div>
            </div>
          </div>

          {/* Token Information */}
          <div className="jarvis-card rounded-2xl p-8 mb-16">
            <h3 className="text-2xl font-bold text-white mb-4">Jarvis Token Information</h3>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <div>
                <h4 className="text-lg font-semibold text-blue-400 mb-2">Current Price</h4>
                <p className="text-3xl font-bold text-white">$0.1 per Token</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-purple-400 mb-2">Future Listing Price</h4>
                <p className="text-3xl font-bold text-white">$3.0 per Token</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg">
              <p className="text-center text-white">
                🚀 <strong>Potential 30x Growth!</strong> Get in early and secure your Jarvis Tokens at the current discounted price.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Daily Profits</h3>
              <p className="text-gray-300">Earn consistent daily returns on your investment with automated profit distribution.</p>
            </div>

            <div className="text-center">
              <div className="bg-blue-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">10-Level Referrals</h3>
              <p className="text-gray-300">Earn up to 15% commission from your referrals across 10 levels of depth.</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Secure Platform</h3>
              <p className="text-gray-300">Built with enterprise-grade security and automated transaction processing.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-300">
            <p>&copy; 2024 Jarvis Staking. All rights reserved.</p>
            <p className="mt-2">Smart Crypto Growth Platform</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
