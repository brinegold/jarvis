'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Bot, Eye, EyeOff, User } from 'lucide-react'

export default function SignInPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    captcha: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString())
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.captcha !== captchaCode) {
      setError('Invalid captcha code')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await (supabase.auth as any).signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) throw error

      if (data.user) {
        router.push('/dashboard')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen jarvis-gradient flex items-center justify-center p-4">
      <div className="floating-shapes"></div>
      
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <Image 
              src="/logo_300x300.png" 
              alt="Jarvis Staking Logo" 
              width={48} 
              height={48} 
              className="h-12 w-12"
              priority
              unoptimized={process.env.NODE_ENV === 'development'}
            />
            <span className="text-2xl font-bold text-white">Jarvis Staking</span>
          </Link>
          <div className="flex items-center justify-end mb-4">
            <Link href="/auth/signup" className="text-blue-300 hover:text-white transition-colors flex items-center">
              <User className="h-4 w-4 mr-1" />
              Sign Up
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="jarvis-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Sign in to</h2>
          <h3 className="text-xl text-white text-center mb-8">your account</h3>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Captcha
              </label>
              <div className="flex items-center space-x-4">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-mono text-lg tracking-wider">
                  {captchaCode}
                </div>
                <input
                  type="text"
                  name="captcha"
                  value={formData.captcha}
                  onChange={handleChange}
                  required
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter captcha"
                />
              </div>
            </div>

            <div className="text-right">
              <Link href="/auth/forgot-password" className="text-purple-400 hover:text-purple-300 text-sm">
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'SIGN IN'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
