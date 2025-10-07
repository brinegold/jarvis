'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Eye,
  Settings,
  LogOut
} from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  pendingWithdrawals: number
  totalWithdrawals: number
  totalInvestments: number
}

interface PendingWithdrawal {
  id: string
  user_id: string
  amount: number
  wallet_address: string
  created_at: string
  user_email: string
  username: string
}

export default function AdminDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingWithdrawals: 0,
    totalWithdrawals: 0,
    totalInvestments: 0
  })
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      checkAdminAccess()
    }
  }, [user, loading, router])

  const checkAdminAccess = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      if (!profile?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
      await fetchAdminData()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAdminData = async () => {
    try {
      // Fetch stats
      const [usersCount, withdrawalsData, investmentsData] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('withdrawal_requests').select('*'),
        supabase.from('investment_plans').select('investment_amount')
      ])

      const pendingWithdrawalsCount = withdrawalsData.data?.filter(w => w.status === 'pending').length || 0
      const totalWithdrawalsAmount = withdrawalsData.data?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0
      const totalInvestmentsAmount = investmentsData.data?.reduce((sum, i) => sum + (i.investment_amount || 0), 0) || 0

      setStats({
        totalUsers: usersCount.count || 0,
        pendingWithdrawals: pendingWithdrawalsCount,
        totalWithdrawals: totalWithdrawalsAmount,
        totalInvestments: totalInvestmentsAmount
      })

      // Fetch pending withdrawals with user details
      const { data: pendingData, error: pendingError } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          profiles!inner(username)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (pendingError) throw pendingError

      console.log('Main admin page - pending withdrawals:', pendingData) // Debug log

      const formattedPending = pendingData?.map(w => ({
        id: w.id,
        user_id: w.user_id,
        amount: w.amount,
        wallet_address: w.wallet_address,
        created_at: w.created_at,
        user_email: w.user_id, // Use user_id as fallback since email is in auth.users
        username: w.profiles.username
      })) || []

      console.log('Main admin page - formatted pending:', formattedPending) // Debug log
      setPendingWithdrawals(formattedPending)

    } catch (error) {
      console.error('Error fetching admin data:', error)
    }
  }

  const handleDistributeProfits = async () => {
    try {
      const response = await fetch('/api/admin/distribute-profits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const data = await response.json()

      if (response.ok) {
        alert(`✅ Profit distribution completed successfully!\n\nTimestamp: ${data.timestamp}`)
        // Refresh admin data to see updated stats
        await fetchAdminData()
      } else {
        throw new Error(data.error || 'Failed to distribute profits')
      }
    } catch (error: any) {
      console.error('Error distributing profits:', error)
      alert(`❌ Failed to distribute profits: ${error.message}`)
    }
  }

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject') => {
    const loadingMessage = action === 'approve' 
      ? 'Processing withdrawal on blockchain...' 
      : 'Rejecting withdrawal...';
    
    // Show loading state
    const originalAlert = window.alert;
    window.alert = () => {}; // Temporarily disable alerts
    
    try {
      // Show processing message
      if (action === 'approve') {
        alert('Processing withdrawal on BSC blockchain. This may take a few moments...');
      }
      
      const response = await fetch('/api/admin/approve-withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withdrawalId,
          action
        })
      })

      const data = await response.json()

      // Restore alert function
      window.alert = originalAlert;

      if (response.ok) {
        if (action === 'approve') {
          alert(`✅ Withdrawal approved and processed successfully!\n\n💰 Net Amount: $${data.netAmount?.toFixed(2)}\n💸 Withdrawal Fee: $${data.withdrawalFee?.toFixed(2)}\n🔗 Blockchain TX: ${data.txHash}\n\nThe USDT has been sent to the user's wallet!`)
        } else {
          alert('✅ Withdrawal rejected successfully!')
        }
        
        // Refresh data
        await fetchAdminData()
      } else {
        throw new Error(data.error || `Failed to ${action} withdrawal`)
      }
    } catch (error: any) {
      // Restore alert function
      window.alert = originalAlert;
      
      console.error(`Error ${action}ing withdrawal:`, error)
      alert(`❌ Failed to ${action} withdrawal: ${error.message}`)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-300">You don't have admin privileges.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Settings className="h-8 w-8 text-white" />
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className="text-white hover:text-blue-300 flex items-center space-x-2"
            >
              <Eye className="h-5 w-5" />
              <span>User View</span>
            </Link>
            <button className="text-white hover:text-red-300 flex items-center space-x-2">
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Users</p>
                <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <Users className="h-12 w-12 text-blue-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Pending Withdrawals</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingWithdrawals}</p>
              </div>
              <AlertCircle className="h-12 w-12 text-yellow-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Withdrawals</p>
                <p className="text-3xl font-bold text-green-400">${stats.totalWithdrawals.toFixed(2)}</p>
              </div>
              <CreditCard className="h-12 w-12 text-green-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Investments</p>
                <p className="text-3xl font-bold text-purple-400">${stats.totalInvestments.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Link 
            href="/admin/withdrawals"
            className="jarvis-button px-6 py-3 rounded-lg text-white font-semibold"
          >
            Manage Withdrawals
          </Link>
          <Link 
            href="/admin/users"
            className="jarvis-card px-6 py-3 rounded-lg text-white font-semibold hover:bg-white/10"
          >
            Manage Users
          </Link>
          <Link 
            href="/admin/investments"
            className="jarvis-card px-6 py-3 rounded-lg text-white font-semibold hover:bg-white/10"
          >
            Investment Plans
          </Link>
          <button
            onClick={handleDistributeProfits}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-white font-semibold"
          >
            Distribute Profits
          </button>
        </div>

        {/* Pending Withdrawals */}
        <div className="jarvis-card rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Pending Withdrawals</h2>
          
          {pendingWithdrawals.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-300">No pending withdrawals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingWithdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div>
                          <p className="text-white font-semibold">{withdrawal.username}</p>
                          <p className="text-gray-400 text-sm">{withdrawal.user_email}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Amount</p>
                          <p className="text-white font-semibold">${withdrawal.amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Wallet Address</p>
                          <p className="text-white font-mono text-xs">{withdrawal.wallet_address}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Requested</p>
                          <p className="text-white">{new Date(withdrawal.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
