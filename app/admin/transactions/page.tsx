'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileText,
  Users,
  CreditCard,
  Coins
} from 'lucide-react'
import Link from 'next/link'

interface Transaction {
  id: string
  user_id: string
  transaction_type: string
  amount: number
  fee: number
  net_amount: number
  status: string
  description: string
  reference_id: string
  created_at: string
  updated_at: string
  user_email?: string
  username?: string
  full_name?: string
}

interface TransactionStats {
  totalTransactions: number
  totalVolume: number
  totalJrcVolume: number
  totalFees: number
  pendingCount: number
  completedCount: number
  failedCount: number
}

export default function AdminTransactionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<TransactionStats>({
    totalTransactions: 0,
    totalVolume: 0,
    totalJrcVolume: 0,
    totalFees: 0,
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const supabase = createSupabaseClient()

  const transactionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'investment', label: 'Investments' },
    { value: 'staking', label: 'Staking' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'profit', label: 'Profits' },
    { value: 'referral_bonus', label: 'Referral Bonuses' },
    { value: 'jarvis_token_add', label: 'JRV Token Add' },
    { value: 'jarvis_token_deduct', label: 'JRV Token Deduct' }
  ]

  const statusTypes = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  const dateFilters = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' }
  ]

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

      if (error || !profile?.is_admin) {
        router.push('/dashboard')
        return
      }

      await fetchTransactions()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTransactions = useCallback(async () => {
    try {
      console.log('🔄 Fetching transactions...')
      
      // Fetch transactions with user details
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles!inner(username, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(1000) // Limit for performance

      if (transactionsError) throw transactionsError

      // Fetch user emails using the admin endpoint
      const userIds = transactionsData?.map(t => t.user_id) || []
      let emailMap = new Map<string, string>()
      
      try {
        const emailResponse = await fetch('/api/admin/get-user-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds })
        })
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json()
          emailMap = new Map(emailData.users?.map((user: any) => [user.id, user.email]) || [])
        }
      } catch (error) {
        console.warn('Could not fetch user emails:', error)
      }

      // Process transactions with user data
      const processedTransactions = transactionsData?.map(transaction => ({
        ...transaction,
        user_email: emailMap.get(transaction.user_id) || transaction.user_id,
        username: transaction.profiles?.username || 'N/A',
        full_name: transaction.profiles?.full_name || 'N/A'
      })) || []

      setTransactions(processedTransactions)

      // Calculate statistics
      const totalTransactions = processedTransactions.length
      
      // Separate USDT and JRC volumes
      const totalVolume = processedTransactions
        .filter(t => !t.description?.includes('JRC Staking'))
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      
      const totalJrcVolume = processedTransactions
        .filter(t => t.description?.includes('JRC Staking'))
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      
      const totalFees = processedTransactions.reduce((sum, t) => sum + (t.fee || 0), 0)
      const pendingCount = processedTransactions.filter(t => t.status === 'pending').length
      const completedCount = processedTransactions.filter(t => t.status === 'completed').length
      const failedCount = processedTransactions.filter(t => t.status === 'failed').length

      setStats({
        totalTransactions,
        totalVolume,
        totalJrcVolume,
        totalFees,
        pendingCount,
        completedCount,
        failedCount
      })

      console.log('✅ Transactions loaded:', totalTransactions)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }, [supabase])

  const getFilteredTransactions = () => {
    let filtered = transactions

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(t => 
        (t.user_email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (t.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (t.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (t.reference_id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === typeFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          break
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3)
          break
      }

      if (dateFilter !== 'all') {
        filtered = filtered.filter(t => new Date(t.created_at) >= filterDate)
      }
    }

    return filtered
  }

  const getPaginatedTransactions = () => {
    const filtered = getFilteredTransactions()
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return {
      transactions: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / itemsPerPage),
      totalCount: filtered.length
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-400/20'
      case 'pending': return 'text-yellow-400 bg-yellow-400/20'
      case 'failed': return 'text-red-400 bg-red-400/20'
      case 'cancelled': return 'text-gray-400 bg-gray-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit': return 'text-green-400'
      case 'investment': return 'text-cyan-400'
      case 'staking': return 'text-indigo-400'
      case 'withdrawal': return 'text-red-400'
      case 'profit': return 'text-blue-400'
      case 'referral_bonus': return 'text-purple-400'
      case 'jarvis_token_add': return 'text-yellow-400'
      case 'jarvis_token_deduct': return 'text-orange-400'
      default: return 'text-gray-400'
    }
  }

  const exportTransactions = () => {
    const filtered = getFilteredTransactions()
    const csvContent = [
      ['Date', 'User', 'Email', 'Type', 'Amount', 'Fee', 'Net Amount', 'Status', 'Description', 'Reference ID'].join(','),
      ...filtered.map(t => [
        new Date(t.created_at).toLocaleString(),
        t.full_name || t.username || 'N/A',
        t.user_email || 'N/A',
        t.transaction_type,
        t.amount,
        t.fee || 0,
        t.net_amount,
        t.status,
        `"${t.description || ''}"`,
        t.reference_id || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const openTransactionModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setShowTransactionModal(true)
  }

  const closeTransactionModal = () => {
    setShowTransactionModal(false)
    setSelectedTransaction(null)
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  const { transactions: paginatedTransactions, totalPages, totalCount } = getPaginatedTransactions()

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="text-white hover:text-blue-300">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-2xl font-bold text-white">Transaction Management</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchTransactions}
              className="text-white hover:text-blue-300 flex items-center space-x-2"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportTransactions}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-white">{stats.totalTransactions.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">USDT Volume</p>
                <p className="text-2xl font-bold text-white">${stats.totalVolume.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">JRC Volume</p>
                <p className="text-2xl font-bold text-white">{stats.totalJrcVolume.toFixed(0)} JRC</p>
              </div>
              <Coins className="h-8 w-8 text-yellow-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Fees</p>
                <p className="text-2xl font-bold text-white">${stats.totalFees.toFixed(2)}</p>
              </div>
              <CreditCard className="h-8 w-8 text-purple-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingCount}</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-400">{stats.completedCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">{stats.failedCount}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="jarvis-card rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users, descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {statusTypes.map(status => (
                  <option key={status.value} value={status.value} className="bg-gray-800">
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {transactionTypes.map(type => (
                  <option key={type.value} value={type.value} className="bg-gray-800">
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {dateFilters.map(date => (
                  <option key={date.value} value={date.value} className="bg-gray-800">
                    {date.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setTypeFilter('all')
                  setDateFilter('all')
                  setCurrentPage(1)
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-300">
            Showing {paginatedTransactions.length} of {totalCount} transactions
          </div>
        </div>

        {/* Transactions Table */}
        <div className="jarvis-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-semibold">Date</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">User</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Type</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Amount</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Fee</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Net Amount</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((transaction, index) => (
                  <tr key={transaction.id} className={index % 2 === 0 ? 'bg-white/5' : ''}>
                    <td className="p-4">
                      <div className="text-white text-sm">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-white font-semibold">{transaction.full_name}</div>
                      <div className="text-gray-400 text-sm">{transaction.user_email}</div>
                    </td>
                    <td className="p-4">
                      <span className={`${getTypeColor(transaction.transaction_type)} font-semibold capitalize`}>
                        {transaction.transaction_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-white font-semibold">
                        {transaction.description?.includes('JRC Staking') 
                          ? `${transaction.amount.toFixed(0)} JRC`
                          : `$${transaction.amount.toFixed(2)}`
                        }
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300">
                        ${(transaction.fee || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-white font-semibold">
                        {transaction.description?.includes('JRC Staking') 
                          ? `${transaction.net_amount.toFixed(0)} JRC`
                          : `$${transaction.net_amount.toFixed(2)}`
                        }
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => openTransactionModal(transaction)}
                        className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-white/10 p-4 flex items-center justify-between">
              <div className="text-gray-300 text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white/10 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-white/10 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {showTransactionModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="jarvis-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Transaction Details</h2>
              <button
                onClick={closeTransactionModal}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Transaction ID</p>
                  <p className="text-white font-mono text-sm">{selectedTransaction.id}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Reference ID</p>
                  <p className="text-white font-mono text-sm">{selectedTransaction.reference_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">User</p>
                  <p className="text-white font-semibold">{selectedTransaction.full_name}</p>
                  <p className="text-gray-400 text-sm">{selectedTransaction.user_email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Type</p>
                  <p className={`font-semibold capitalize ${getTypeColor(selectedTransaction.transaction_type)}`}>
                    {selectedTransaction.transaction_type.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Amount</p>
                  <p className="text-white font-semibold text-lg">
                    {selectedTransaction.description?.includes('JRC Staking') 
                      ? `${selectedTransaction.amount.toFixed(0)} JRC`
                      : `$${selectedTransaction.amount.toFixed(2)}`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Fee</p>
                  <p className="text-white font-semibold">${(selectedTransaction.fee || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Net Amount</p>
                  <p className="text-white font-semibold text-lg">
                    {selectedTransaction.description?.includes('JRC Staking') 
                      ? `${selectedTransaction.net_amount.toFixed(0)} JRC`
                      : `$${selectedTransaction.net_amount.toFixed(2)}`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Status</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedTransaction.status)}`}>
                    {selectedTransaction.status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Created</p>
                  <p className="text-white">{new Date(selectedTransaction.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Updated</p>
                  <p className="text-white">{new Date(selectedTransaction.updated_at).toLocaleString()}</p>
                </div>
              </div>
              
              {selectedTransaction.description && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Description</p>
                  <p className="text-white bg-white/5 rounded-lg p-3">{selectedTransaction.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
