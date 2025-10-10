'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Users, Copy, Share, Gift } from 'lucide-react'
import Link from 'next/link'
import { dualReferralService } from '@/lib/referralService'

interface Profile {
  referral_code: string
  full_name: string
}

interface ReferralStats {
  total_referrals: number
  total_commission: number
  total_usdt_earned: number
  total_jrc_earned: number
  level_stats: Array<{
    level: number
    count: number
    usdtEarned: number
    jrcEarned: number
    usdtRate: number
    jrcRate: number
  }>
}

export default function ReferralPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const supabase = createSupabaseClient()

  const referralLevels = [
    { level: 1, percentage: 15 },
    { level: 2, percentage: 10 },
    { level: 3, percentage: 5 },
    { level: 4, percentage: 3 },
    { level: 5, percentage: 2 },
    { level: 6, percentage: 1 },
    { level: 7, percentage: 0.5 },
    { level: 8, percentage: 0.2 },
    { level: 9, percentage: 0.1 },
    { level: 10, percentage: 0.05 }
  ]

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code, full_name')
        .eq('id', user?.id)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // Fetch dual referral stats using the new service
      const dualStats = await dualReferralService.getReferralStats(user?.id || '')

      // Fetch legacy commission for backward compatibility
      const { data: legacyCommissions, error: commissionsError } = await supabase
        .from('referral_commissions')
        .select('commission_amount')
        .eq('referrer_id', user?.id)

      const legacyCommission = legacyCommissions?.reduce((sum, c) => sum + parseFloat(c.commission_amount?.toString() || '0'), 0) || 0

      console.log('Dual stats received:', dualStats)
      
      setStats({
        total_referrals: dualStats.totalReferrals,
        total_commission: legacyCommission, // Keep for backward compatibility
        total_usdt_earned: dualStats.totalUsdtEarned,
        total_jrc_earned: dualStats.totalJrcEarned,
        level_stats: dualStats.levelStats
      })

    } catch (error) {
      console.error('Error fetching referral data:', error)
    }
  }

  const copyReferralLink = async () => {
    if (!profile) return

    const referralLink = `${window.location.origin}/auth/signup?ref=${profile.referral_code}`
    
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = referralLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareReferralLink = async () => {
    if (!profile) return

    const referralLink = `${window.location.origin}/auth/signup?ref=${profile.referral_code}`
    const shareText = `Join Jarvis Staking and start earning with smart crypto investments! Use my referral code: ${profile.referral_code}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Jarvis Staking',
          text: shareText,
          url: referralLink
        })
      } catch (error) {
        console.log('Share cancelled')
      }
    } else {
      copyReferralLink()
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
          <h1 className="text-xl font-bold text-white">Referral Program</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Referral Stats */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-white text-xl font-bold mb-2">Your Referral Stats</h2>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <p className="text-gray-300 text-sm">Total Referrals</p>
                <p className="text-2xl font-bold text-blue-400">{stats?.total_referrals || 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 rounded-lg p-3">
                <p className="text-gray-300 text-sm">USDT Earned</p>
                <p className="text-xl font-bold text-green-400">${stats?.total_usdt_earned?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3">
                <p className="text-gray-300 text-sm">JRC Earned</p>
                <p className="text-xl font-bold text-yellow-400">{stats?.total_jrc_earned?.toLocaleString() || '0'} JRC</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Gift className="h-6 w-6 mr-2 text-yellow-400" />
            Your Referral Code
          </h3>
          
          <div className="bg-white/10 rounded-lg p-4 mb-4">
            <p className="text-center text-2xl font-bold text-yellow-400 tracking-wider">
              {profile?.referral_code || 'Loading...'}
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={copyReferralLink}
              className="flex-1 jarvis-button py-3 rounded-lg text-white font-semibold flex items-center justify-center"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={shareReferralLink}
              className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded-lg text-white font-semibold flex items-center justify-center transition-colors"
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </button>
          </div>
        </div>

        {/* Commission Structure */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Dual Commission Structure</h3>
          <div className="space-y-3">
            {stats?.level_stats && stats.level_stats.length > 0 ? stats.level_stats.map((levelStat) => {
              return (
                <div key={levelStat.level} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{levelStat.level}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Level {levelStat.level}</p>
                        <p className="text-gray-300 text-sm">{levelStat.count} referrals</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-green-500/10 rounded p-2">
                      <p className="text-green-400 font-bold text-sm">{levelStat.usdtRate}% USDT</p>
                      <p className="text-gray-400 text-xs">Earned: ${levelStat.usdtEarned?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="bg-yellow-500/10 rounded p-2">
                      <p className="text-yellow-400 font-bold text-sm">{levelStat.jrcRate}% JRC</p>
                      <p className="text-gray-400 text-xs">Earned: {levelStat.jrcEarned?.toLocaleString() || '0'} JRC</p>
                    </div>
                  </div>
                </div>
              )
            }) : referralLevels.map((level) => (
              <div key={level.level} className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{level.level}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">Level {level.level}</p>
                      <p className="text-gray-300 text-sm">0 referrals</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-green-500/10 rounded p-2">
                    <p className="text-green-400 font-bold text-sm">{level.percentage}% USDT</p>
                    <p className="text-gray-400 text-xs">Earned: $0.00</p>
                  </div>
                  <div className="bg-yellow-500/10 rounded p-2">
                    <p className="text-yellow-400 font-bold text-sm">{level.percentage + 5}% JRC</p>
                    <p className="text-gray-400 text-xs">Earned: 0 JRC</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">How Referrals Work</h3>
          <div className="space-y-3 text-gray-300 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <p>Share your referral code with friends and family</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <p>When they invest or stake, you earn dual commissions in both USDT and JRC coins</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <p>Earn from 10 levels deep - build your network and maximize earnings</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">4</span>
              </div>
              <p>USDT commissions go to your main wallet, JRC coins are added to your coin balance</p>
            </div>
          </div>
        </div>

        {/* Referral Benefits */}
        <div className="jarvis-card rounded-2xl p-6">
          <h3 className="text-white font-bold text-lg mb-4">Dual Referral Benefits</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-4">
              <Users className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-white font-semibold">10 Levels</p>
              <p className="text-gray-300 text-sm">Deep Commission</p>
            </div>
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-4">
              <Gift className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <p className="text-white font-semibold">Dual Rewards</p>
              <p className="text-gray-300 text-sm">USDT + JRC Coins</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-center text-yellow-400 font-semibold text-sm">
              🎉 Earn up to 15% USDT + 20% JRC coins on Level 1 referrals!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
