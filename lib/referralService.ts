import { createSupabaseClient } from './supabase'

export interface ReferralCommissionRates {
  level: number
  usdtRate: number // Percentage for USDT commission
  jrcRate: number  // Percentage for JRC coin commission
}

export interface ReferralTransaction {
  userId: string
  amount: number
  transactionType: 'staking' | 'investment' | 'deposit'
  planType?: string
}

export class DualReferralService {
  private supabase = createSupabaseClient()
  
  // 10-level referral commission structure
  private readonly commissionRates: ReferralCommissionRates[] = [
    { level: 1, usdtRate: 15, jrcRate: 20 },   // Level 1: 15% USDT, 20% JRC
    { level: 2, usdtRate: 10, jrcRate: 15 },   // Level 2: 10% USDT, 15% JRC
    { level: 3, usdtRate: 5, jrcRate: 10 },    // Level 3: 5% USDT, 10% JRC
    { level: 4, usdtRate: 3, jrcRate: 8 },     // Level 4: 3% USDT, 8% JRC
    { level: 5, usdtRate: 2, jrcRate: 6 },     // Level 5: 2% USDT, 6% JRC
    { level: 6, usdtRate: 1, jrcRate: 4 },     // Level 6: 1% USDT, 4% JRC
    { level: 7, usdtRate: 0.5, jrcRate: 3 },   // Level 7: 0.5% USDT, 3% JRC
    { level: 8, usdtRate: 0.2, jrcRate: 2 },   // Level 8: 0.2% USDT, 2% JRC
    { level: 9, usdtRate: 0.1, jrcRate: 1.5 }, // Level 9: 0.1% USDT, 1.5% JRC
    { level: 10, usdtRate: 0.05, jrcRate: 1 }  // Level 10: 0.05% USDT, 1% JRC
  ]

  /**
   * Process dual referral commissions for a transaction
   */
  async processDualReferralCommissions(transaction: ReferralTransaction): Promise<void> {
    try {
      console.log(`Processing dual referral commissions for user ${transaction.userId}, amount: ${transaction.amount}`)
      
      // Get user's referral chain
      const referralChain = await this.getReferralChain(transaction.userId)
      
      if (referralChain.length === 0) {
        console.log(`No referral chain found for user ${transaction.userId}`)
        return
      }

      // Process commissions for each level
      for (let i = 0; i < referralChain.length && i < this.commissionRates.length; i++) {
        const referrer = referralChain[i]
        const rates = this.commissionRates[i]
        
        await this.payDualCommission(
          referrer.id,
          transaction.userId,
          transaction.amount,
          rates,
          transaction.transactionType,
          transaction.planType
        )
      }
    } catch (error) {
      console.error('Error processing dual referral commissions:', error)
      throw error
    }
  }

  /**
   * Get the referral chain for a user (up to 10 levels)
   */
  private async getReferralChain(userId: string): Promise<any[]> {
    const chain: any[] = []
    let currentUserId = userId
    
    for (let level = 1; level <= 10; level++) {
      // Find who referred this user
      const { data: referralData, error } = await this.supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', currentUserId)
        .single()
      
      if (error || !referralData?.referred_by) {
        break
      }
      
      // Get referrer details
      const { data: referrer, error: referrerError } = await this.supabase
        .from('profiles')
        .select('id, full_name, referral_code, main_wallet_balance, total_jarvis_tokens')
        .eq('id', referralData.referred_by)
        .single()
      
      if (referrerError || !referrer) {
        break
      }
      
      chain.push({
        ...referrer,
        level
      })
      
      currentUserId = referrer.id
    }
    
    return chain
  }

  /**
   * Pay dual commission (USDT + JRC) to a referrer
   */
  private async payDualCommission(
    referrerId: string,
    referredUserId: string,
    transactionAmount: number,
    rates: ReferralCommissionRates,
    transactionType: string,
    planType?: string
  ): Promise<void> {
    try {
      // Calculate commissions
      const usdtCommission = (transactionAmount * rates.usdtRate) / 100
      const jrcCommission = (transactionAmount * rates.jrcRate) / 100 // JRC coins based on USDT amount
      
      console.log(`Paying Level ${rates.level} commission to ${referrerId}: ${usdtCommission} USDT + ${jrcCommission} JRC`)
      
      // Get current referrer balances
      const { data: referrer, error: referrerError } = await this.supabase
        .from('profiles')
        .select('main_wallet_balance, total_jarvis_tokens')
        .eq('id', referrerId)
        .single()
      
      if (referrerError || !referrer) {
        throw new Error(`Failed to get referrer data: ${referrerError?.message}`)
      }
      
      // Update referrer balances
      const newUsdtBalance = referrer.main_wallet_balance + usdtCommission
      const newJrcBalance = referrer.total_jarvis_tokens + jrcCommission
      
      const { error: updateError } = await this.supabase
        .from('profiles')
        .update({
          main_wallet_balance: newUsdtBalance,
          total_jarvis_tokens: newJrcBalance
        })
        .eq('id', referrerId)
      
      if (updateError) {
        throw new Error(`Failed to update referrer balances: ${updateError.message}`)
      }
      
      // Create USDT commission transaction
      await this.createCommissionTransaction(
        referrerId,
        referredUserId,
        usdtCommission,
        'USDT',
        rates.level,
        transactionType,
        planType
      )
      
      // Create JRC commission transaction
      await this.createCommissionTransaction(
        referrerId,
        referredUserId,
        jrcCommission,
        'JRC',
        rates.level,
        transactionType,
        planType
      )
      
      // Create referral commission record
      await this.createReferralCommissionRecord(
        referrerId,
        referredUserId,
        usdtCommission,
        jrcCommission,
        rates.level,
        transactionType,
        planType
      )
      
    } catch (error) {
      console.error(`Error paying dual commission to ${referrerId}:`, error)
      throw error
    }
  }

  /**
   * Create a commission transaction record
   */
  private async createCommissionTransaction(
    referrerId: string,
    referredUserId: string,
    amount: number,
    currency: 'USDT' | 'JRC',
    level: number,
    transactionType: string,
    planType?: string
  ): Promise<void> {
    const description = `Level ${level} ${currency} referral commission from ${transactionType}${planType ? ` (${planType})` : ''}`
    
    const { error } = await this.supabase
      .from('transactions')
      .insert({
        user_id: referrerId,
        transaction_type: 'referral_bonus',
        amount: amount,
        net_amount: amount,
        status: 'completed',
        description: description,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      throw new Error(`Failed to create ${currency} commission transaction: ${error.message}`)
    }
  }

  /**
   * Create a referral commission record for tracking
   */
  private async createReferralCommissionRecord(
    referrerId: string,
    referredUserId: string,
    usdtAmount: number,
    jrcAmount: number,
    level: number,
    transactionType: string,
    planType?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('referral_commissions')
        .insert({
          referrer_id: referrerId,
          referred_id: referredUserId,
          usdt_commission: usdtAmount,
          jrc_commission: jrcAmount,
          level: level,
          commission_percentage: this.commissionRates[level - 1]?.usdtRate || 0,
          jrc_percentage: this.commissionRates[level - 1]?.jrcRate || 0,
          transaction_type: transactionType,
          plan_type: planType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    
    if (error) {
      console.error('Failed to create referral commission record:', error)
      // Don't throw error here as the main commission payment succeeded
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<{
    totalUsdtEarned: number
    totalJrcEarned: number
    totalReferrals: number
    levelStats: Array<{
      level: number
      count: number
      usdtEarned: number
      jrcEarned: number
      usdtRate: number
      jrcRate: number
    }>
  }> {
    try {
      // Get all referral commissions for this user
      const { data: commissions, error } = await this.supabase
        .from('referral_commissions')
        .select('*')
        .eq('referrer_id', userId)
      
      if (error) {
        throw new Error(`Failed to get referral stats: ${error.message}`)
      }
      
      const totalUsdtEarned = commissions?.reduce((sum, c) => sum + (c.usdt_commission || 0), 0) || 0
      const totalJrcEarned = commissions?.reduce((sum, c) => sum + (c.jrc_commission || 0), 0) || 0
      
      // Calculate level statistics
      const levelStats = this.commissionRates.map(rate => {
        const levelCommissions = commissions?.filter(c => c.level === rate.level) || []
        return {
          level: rate.level,
          count: levelCommissions.length,
          usdtEarned: levelCommissions.reduce((sum, c) => sum + (c.usdt_commission || 0), 0),
          jrcEarned: levelCommissions.reduce((sum, c) => sum + (c.jrc_commission || 0), 0),
          usdtRate: rate.usdtRate,
          jrcRate: rate.jrcRate
        }
      })
      
      // Get total unique referrals
      const uniqueReferrals = new Set(commissions?.map(c => c.referred_id) || [])
      
      return {
        totalUsdtEarned,
        totalJrcEarned,
        totalReferrals: uniqueReferrals.size,
        levelStats
      }
    } catch (error) {
      console.error('Error getting referral stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const dualReferralService = new DualReferralService()
