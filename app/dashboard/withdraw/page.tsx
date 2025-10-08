'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, History } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  main_wallet_balance: number
}

export default function WithdrawPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('main_wallet_balance')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    const withdrawAmount = parseFloat(amount)
    
    if (withdrawAmount < 10) {
      setError('Minimum withdrawal amount is $10')
      setIsSubmitting(false)
      return
    }

    if (!walletAddress) {
      setError('Please enter your BSC wallet address')
      setIsSubmitting(false)
      return
    }

    if (!profile || withdrawAmount > profile.main_wallet_balance) {
      setError('Insufficient main wallet balance')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/bsc/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount: withdrawAmount,
          walletAddress: walletAddress
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Withdrawal request submitted successfully! Net amount: $${data.netAmount.toFixed(2)} (after 10% fee). Your request is being processed.`)
        setAmount('')
        setWalletAddress('')
        
        // Update local profile state
        setProfile(prev => prev ? { ...prev, main_wallet_balance: prev.main_wallet_balance - withdrawAmount } : null)
      } else {
        setError(data.error || 'Failed to submit withdrawal request')
      }

    } catch (error: any) {
      setError(error.message || 'Failed to submit withdrawal request')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">User Withdraw</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Available Balance */}
        <div className="jarvis-card rounded-2xl p-6 mb-6 text-center">
          <h2 className="text-white text-lg mb-2">Available Main Wallet</h2>
          <p className="text-3xl font-bold text-green-400">${profile?.main_wallet_balance.toFixed(2) || '0.00'}</p>
          <p className="text-gray-300 text-sm mt-2">Amount in USD</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Withdrawal Form */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="10"
                step="0.01"
                required
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-2xl text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-center text-gray-300 text-sm mt-2">Amount in USD</p>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                BSC Wallet Address
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-400 text-sm mt-2">
                Enter your BSC wallet address to receive USDT
              </p>
            </div>

            <div className="bg-red-600/20 border border-red-500 rounded-lg p-4">
              <div className="flex justify-between text-sm text-white mb-2">
                <span>Withdrawal Amount:</span>
                <span>${amount || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm text-white mb-2">
                <span>Withdrawal Fee (10%):</span>
                <span>${amount ? (parseFloat(amount) * 0.10).toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white border-t border-white/20 pt-2">
                <span>Net Amount:</span>
                <span>${amount ? (parseFloat(amount) * 0.90).toFixed(2) : '0.00'}</span>
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Enter Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !amount || !walletAddress}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'SUBMIT'}
            </button>
          </form>
        </div>

        {/* Withdrawal History Button */}
        <Link 
          href="/dashboard/withdraw/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-400" />
            <span className="text-white font-semibold">WITHDRAW HISTORY</span>
          </div>
        </Link>

        {/* Information */}
        <div className="mt-6 space-y-4">
          <div className="jarvis-card rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2">Withdrawal Information</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Minimum withdrawal: $10.00</li>
              <li>• Withdrawal fee: 10% of withdrawal amount</li>
              <li>• Processing time: 24-48 hours</li>
              <li>• Only profits can be withdrawn</li>
              <li>• Principal amount cannot be withdrawn</li>
            </ul>
          </div>

          <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-4">
            <h4 className="text-yellow-400 font-semibold mb-2">Important Notice</h4>
            <p className="text-yellow-200 text-sm">
              You can only withdraw profits earned from your investments. 
              The principal investment amount remains locked in your investment plans.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
