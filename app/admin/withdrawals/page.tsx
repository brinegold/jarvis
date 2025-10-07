'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  Download,
  Eye
} from 'lucide-react'
import Link from 'next/link'

interface WithdrawalRequest {
  id: string
  user_id: string
  amount: number
  wallet_address: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  processed_at?: string
  user_email: string
  username: string
  main_wallet_balance: number
}

export default function WithdrawalsManagement() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<WithdrawalRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      checkAdminAndFetch()
    }
  }, [user, loading, router])

  useEffect(() => {
    filterWithdrawals()
  }, [withdrawals, statusFilter, searchTerm])

  const checkAdminAndFetch = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      if (error || !profile?.is_admin) {
        router.push('/dashboard')
        return
      }

      await fetchWithdrawals()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          profiles!inner(username, main_wallet_balance)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log('Raw withdrawal data:', data) // Debug log
      console.log('Pending withdrawals:', data?.filter(w => w.status === 'pending')) // Debug log

      const formattedWithdrawals = data?.map(w => ({
        id: w.id,
        user_id: w.user_id,
        amount: w.amount,
        wallet_address: w.wallet_address,
        status: w.status,
        created_at: w.created_at,
        processed_at: w.processed_at,
        user_email: w.user_id, // Use user_id as fallback since email is in auth.users
        username: w.profiles.username,
        main_wallet_balance: w.profiles.main_wallet_balance
      })) || []

      console.log('Formatted withdrawals:', formattedWithdrawals) // Debug log
      setWithdrawals(formattedWithdrawals)
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
    }
  }

  const filterWithdrawals = () => {
    let filtered = withdrawals

    if (statusFilter !== 'all') {
      filtered = filtered.filter(w => w.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(w => 
        w.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.wallet_address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredWithdrawals(filtered)
  }

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject') => {
    setProcessingId(withdrawalId)
    
    try {
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

      if (response.ok) {
        if (action === 'approve') {
          alert(`✅ Withdrawal approved and processed successfully!\n\n💰 Net Amount: $${data.netAmount?.toFixed(2)}\n💸 Withdrawal Fee: $${data.withdrawalFee?.toFixed(2)}\n🔗 Blockchain TX: ${data.txHash}\n\nThe USDT has been sent to the user's wallet!`)
        } else {
          alert('✅ Withdrawal rejected successfully!')
        }
        
        await fetchWithdrawals()
      } else {
        throw new Error(data.error || `Failed to ${action} withdrawal`)
      }
    } catch (error: any) {
      console.error(`Error ${action}ing withdrawal:`, error)
      alert(`❌ Failed to ${action} withdrawal: ${error.message}`)
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-400/20'
      case 'approved': return 'text-green-400 bg-green-400/20'
      case 'rejected': return 'text-red-400 bg-red-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />
      case 'approved': return <CheckCircle className="h-4 w-4" />
      case 'rejected': return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (loading || isLoading) {
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
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="text-white hover:text-blue-300">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-2xl font-bold text-white">Withdrawal Management</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="jarvis-card px-4 py-2 rounded-lg text-white hover:bg-white/10 flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Filters */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by username, email, or wallet address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Filter className="text-gray-400 h-5 w-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Requests</p>
            <p className="text-2xl font-bold text-white">{withdrawals.length}</p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">
              {withdrawals.filter(w => w.status === 'pending').length}
            </p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Approved</p>
            <p className="text-2xl font-bold text-green-400">
              {withdrawals.filter(w => w.status === 'approved').length}
            </p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Amount</p>
            <p className="text-2xl font-bold text-white">
              ${withdrawals.reduce((sum, w) => sum + w.amount, 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Withdrawals Table */}
        <div className="jarvis-card rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Withdrawal Requests</h2>
          
          {filteredWithdrawals.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No withdrawal requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="space-y-4">
                {filteredWithdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-3">
                          <div>
                            <p className="text-white font-semibold">{withdrawal.username}</p>
                            <p className="text-gray-400 text-sm">{withdrawal.user_email}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${getStatusColor(withdrawal.status)}`}>
                            {getStatusIcon(withdrawal.status)}
                            <span className="capitalize">{withdrawal.status}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Amount</p>
                            <p className="text-white font-semibold">${withdrawal.amount.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">User Balance</p>
                            <p className="text-white">${withdrawal.main_wallet_balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Wallet Address</p>
                            <p className="text-white font-mono text-xs break-all">{withdrawal.wallet_address}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Requested</p>
                            <p className="text-white">{new Date(withdrawal.created_at).toLocaleDateString()}</p>
                            {withdrawal.processed_at && (
                              <p className="text-gray-400 text-xs">
                                Processed: {new Date(withdrawal.processed_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {withdrawal.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                            disabled={processingId === withdrawal.id}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                            disabled={processingId === withdrawal.id}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
