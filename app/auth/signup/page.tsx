'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createSupabaseClient } from '@/lib/supabase'
import { Bot, Eye, EyeOff, User, Mail, Phone, Globe } from 'lucide-react'

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    sponsorId: '',
    fullName: '',
    country: '',
    mobileNo: '',
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createSupabaseClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            country: formData.country,
            mobile_no: formData.mobileNo,
            sponsor_id: formData.sponsorId,
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            full_name: formData.fullName,
            country: formData.country,
            mobile_no: formData.mobileNo,
            sponsor_id: formData.sponsorId || null,
          })

        if (profileError) throw profileError

        // Build referral chain if sponsor exists
        if (formData.sponsorId) {
          const { error: referralError } = await supabase
            .rpc('build_referral_chain', {
              referred_user_id: authData.user.id,
              sponsor_referral_code: formData.sponsorId
            })

          if (referralError) {
            console.error('Referral chain error:', referralError)
          }
        }

        router.push('/dashboard')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            <Link href="/auth/signin" className="text-blue-300 hover:text-white transition-colors flex items-center">
              <User className="h-4 w-4 mr-1" />
              Sign in
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="jarvis-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white text-center mb-2">Create</h2>
          <h3 className="text-xl text-white text-center mb-8">new account</h3>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Sponsor ID
              </label>
              <input
                type="text"
                name="sponsorId"
                value={formData.sponsorId}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter sponsor referral code (optional)"
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Country
              </label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="bg-gray-800">--Select--</option>
                <option value="US" className="bg-gray-800">United States</option>
                <option value="UK" className="bg-gray-800">United Kingdom</option>
                <option value="CA" className="bg-gray-800">Canada</option>
                <option value="AU" className="bg-gray-800">Australia</option>
                <option value="DE" className="bg-gray-800">Germany</option>
                <option value="FR" className="bg-gray-800">France</option>
                <option value="IN" className="bg-gray-800">India</option>
                <option value="PK" className="bg-gray-800">Pakistan</option>
                <option value="BD" className="bg-gray-800">Bangladesh</option>
                <option value="NG" className="bg-gray-800">Nigeria</option>
              </select>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Mobile No
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-3 bg-white/5 border border-white/20 border-r-0 rounded-l-lg text-white">
                  📱
                </span>
                <input
                  type="tel"
                  name="mobileNo"
                  value={formData.mobileNo}
                  onChange={handleChange}
                  required
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-r-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter mobile number"
                />
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                E-Mail ID
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
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

            <div className="text-sm text-gray-300">
              By clicking on Sign-up button, you are agree to our{' '}
              <Link href="/terms" className="text-blue-400 hover:underline">Terms and Conditions</Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'SIGN UP'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
