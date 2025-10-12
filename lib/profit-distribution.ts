import { supabaseAdmin } from './supabase-server'

export async function distributeProfits() {
  try {
    console.log('Starting comprehensive profit distribution...')

    // Distribute regular investment profits
    await distributeInvestmentProfits()
    
    // Distribute JRC staking profits (independent of investment profits)
    await distributeJrcStakingProfits()

  } catch (error) {
    console.error('Error in comprehensive profit distribution:', error)
  }
}

// Function to distribute regular investment profits
async function distributeInvestmentProfits() {
  try {
    console.log('Starting regular investment profit distribution...')

    // Get all active investment plans
    const { data: plans, error: plansError } = await supabaseAdmin
      .from('investment_plans')
      .select(`
        id,
        user_id,
        plan_type,
        investment_amount,
        daily_percentage,
        created_at,
        profiles!inner(id)
      `)
      .eq('is_active', true)

    if (plansError) {
      console.error('Error fetching plans:', plansError)
      return
    }

    if (!plans || plans.length === 0) {
      console.log('No active investment plans found')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const profitDistributions: any[] = []
    const userUpdates = new Map()

    for (const plan of plans) {
      // Check if 24 hours have passed since plan creation
      const planCreatedAt = new Date(plan.created_at)
      const now = new Date()
      const hoursSinceCreation = (now.getTime() - planCreatedAt.getTime()) / (1000 * 60)
      
      if (hoursSinceCreation < 1) {
        console.log(`Plan ${plan.id} created ${hoursSinceCreation.toFixed(2)} hours ago, needs to wait 24 hours`)
        continue
      }

      // Check if profit already distributed today
      const { data: existingDistribution } = await supabaseAdmin
        .from('profit_distributions')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('distribution_date', today)
        .single()

      if (existingDistribution) {
        console.log(`Profit already distributed today for plan ${plan.id}`)
        continue
      }

      // Calculate daily profit (full daily amount)
      const dailyProfitRate = plan.daily_percentage / 100
      const profitAmount = plan.investment_amount * dailyProfitRate

      // Add to profit distributions
      profitDistributions.push({
        plan_id: plan.id,
        user_id: plan.user_id,
        profit_amount: profitAmount,
        distribution_date: today
      })

      // Accumulate user updates
      if (userUpdates.has(plan.user_id)) {
        userUpdates.set(plan.user_id, userUpdates.get(plan.user_id) + profitAmount)
      } else {
        userUpdates.set(plan.user_id, profitAmount)
      }

      console.log(`Calculated daily profit for plan ${plan.id}: $${profitAmount.toFixed(8)}`)
    }

    if (profitDistributions.length === 0) {
      console.log('No new profits to distribute')
      return
    }

    // Insert profit distributions
    const { error: distributionError } = await supabaseAdmin
      .from('profit_distributions')
      .insert(profitDistributions)

    if (distributionError) {
      console.error('Error inserting profit distributions:', distributionError)
      return
    }

    // Update user balances and plan totals
    for (const [userId, totalProfit] of Array.from(userUpdates.entries())) {
      // Get current balance first
      const { data: currentProfile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('main_wallet_balance')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error(`Error fetching profile for user ${userId}:`, fetchError)
        continue
      }

      // Update user main wallet balance
      const { error: walletError } = await supabaseAdmin
        .from('profiles')
        .update({
          main_wallet_balance: (currentProfile.main_wallet_balance || 0) + totalProfit
        })
        .eq('id', userId)

      if (walletError) {
        console.error(`Error updating wallet for user ${userId}:`, walletError)
        continue
      }

      // Create profit transaction
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          transaction_type: 'profit',
          amount: totalProfit,
          net_amount: totalProfit,
          status: 'completed',
          description: 'Daily profit distribution'
        })

      if (transactionError) {
        console.error(`Error creating transaction for user ${userId}:`, transactionError)
      }

      console.log(`Updated wallet for user ${userId}: +$${totalProfit.toFixed(8)}`)
    }

    // Update investment plans total profit earned
    for (const distribution of profitDistributions) {
      // Get current total profit earned first
      const { data: currentPlan, error: fetchPlanError } = await supabaseAdmin
        .from('investment_plans')
        .select('total_profit_earned')
        .eq('id', distribution.plan_id)
        .single()

      if (fetchPlanError) {
        console.error(`Error fetching plan ${distribution.plan_id}:`, fetchPlanError)
        continue
      }

      const { error: planUpdateError } = await supabaseAdmin
        .from('investment_plans')
        .update({
          total_profit_earned: (currentPlan.total_profit_earned || 0) + distribution.profit_amount
        })
        .eq('id', distribution.plan_id)

      if (planUpdateError) {
        console.error(`Error updating plan ${distribution.plan_id}:`, planUpdateError)
      }
    }

    console.log(`Successfully distributed investment profits to ${userUpdates.size} users`)
    console.log(`Total investment distributions: ${profitDistributions.length}`)

  } catch (error) {
    console.error('Error in investment profit distribution:', error)
  }
}

// Function to distribute JRC staking profits
async function distributeJrcStakingProfits() {
  try {
    console.log('Starting JRC staking profit distribution...')

    // First check if the jrc_staking_plans table exists
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('jrc_staking_plans')
      .select('count')
      .limit(1)

    if (tableError) {
      console.log('JRC staking table does not exist yet. Please run the add_staking_system.sql migration first.')
      return
    }

    // Get all active JRC staking plans
    const { data: stakingPlans, error: stakingError } = await supabaseAdmin
      .from('jrc_staking_plans')
      .select('*')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString()) // Only plans that haven't expired yet

    if (stakingError) {
      console.error('Error fetching JRC staking plans:', stakingError)
      return
    }

    console.log(`Found ${stakingPlans?.length || 0} JRC staking plans`)
    
    if (!stakingPlans || stakingPlans.length === 0) {
      console.log('No active JRC staking plans found')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const stakingDistributions: any[] = []
    const stakingUserUpdates = new Map()

    for (const plan of stakingPlans) {
      // Check if 24 hours have passed since staking plan creation
      const planCreatedAt = new Date(plan.created_at)
      const now = new Date()
      const hoursSinceCreation = (now.getTime() - planCreatedAt.getTime()) / (1000 * 60)
      
      if (hoursSinceCreation < 1) {
        console.log(`Staking plan ${plan.id} created ${hoursSinceCreation.toFixed(2)} hours ago, needs to wait 24 hours`)
        continue
      }

      // Check if profit already distributed today
      const { data: existingDistribution } = await supabaseAdmin
        .from('jrc_staking_distributions')
        .select('id')
        .eq('staking_plan_id', plan.id)
        .eq('distribution_date', today)
        .single()

      if (existingDistribution) {
        console.log(`JRC staking profit already distributed today for plan ${plan.id}`)
        continue
      }

      // Calculate daily profit for JRC staking (in JRC coins)
      const dailyProfitRate = plan.daily_percentage / 100
      const profitAmount = plan.amount * dailyProfitRate

      // Add to staking distributions
      stakingDistributions.push({
        staking_plan_id: plan.id,
        user_id: plan.user_id,
        profit_amount: profitAmount,
        distribution_date: today
      })

      // Accumulate user updates (JRC coins)
      if (stakingUserUpdates.has(plan.user_id)) {
        stakingUserUpdates.set(plan.user_id, stakingUserUpdates.get(plan.user_id) + profitAmount)
      } else {
        stakingUserUpdates.set(plan.user_id, profitAmount)
      }

      console.log(`Calculated JRC staking profit for plan ${plan.id}: ${profitAmount.toFixed(2)} JRC`)
    }

    if (stakingDistributions.length === 0) {
      console.log('No new JRC staking profits to distribute')
      return
    }

    // Insert JRC staking distributions
    const { error: distributionError } = await supabaseAdmin
      .from('jrc_staking_distributions')
      .insert(stakingDistributions)

    if (distributionError) {
      console.error('Error inserting JRC staking distributions:', distributionError)
      return
    }

    // Update user JRC balances
    const userIds = Array.from(stakingUserUpdates.keys())
    for (const userId of userIds) {
      const totalProfit = stakingUserUpdates.get(userId)!;
      // Get current JRC balance
      const { data: currentProfile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('total_jarvis_tokens')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error(`Error fetching profile for user ${userId}:`, fetchError)
        continue
      }

      // Update JRC balance
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          total_jarvis_tokens: (currentProfile.total_jarvis_tokens || 0) + totalProfit
        })
        .eq('id', userId)

      if (updateError) {
        console.error(`Error updating JRC balance for user ${userId}:`, updateError)
        continue
      }

      // Create JRC profit transaction
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          transaction_type: 'profit',
          amount: totalProfit,
          net_amount: totalProfit,
          status: 'completed',
          description: 'Daily JRC staking profit'
        })

      if (transactionError) {
        console.error(`Error creating JRC staking transaction for user ${userId}:`, transactionError)
      }

      console.log(`Updated JRC balance for user ${userId}: +${totalProfit.toFixed(2)} JRC`)
    }

    // Update staking plans total profit earned
    for (const distribution of stakingDistributions) {
      // Get current total profit earned first
      const { data: currentPlan, error: fetchPlanError } = await supabaseAdmin
        .from('jrc_staking_plans')
        .select('total_profit_earned')
        .eq('id', distribution.staking_plan_id)
        .single()

      if (fetchPlanError) {
        console.error(`Error fetching staking plan ${distribution.staking_plan_id}:`, fetchPlanError)
        continue
      }

      const { error: planUpdateError } = await supabaseAdmin
        .from('jrc_staking_plans')
        .update({
          total_profit_earned: (currentPlan.total_profit_earned || 0) + distribution.profit_amount
        })
        .eq('id', distribution.staking_plan_id)

      if (planUpdateError) {
        console.error(`Error updating staking plan ${distribution.staking_plan_id}:`, planUpdateError)
      }
    }

    console.log(`Successfully distributed JRC staking profits to ${stakingUserUpdates.size} users`)
    console.log(`Total JRC staking distributions: ${stakingDistributions.length}`)

  } catch (error) {
    console.error('Error in JRC staking profit distribution:', error)
  }
}

// Global variable to store the interval ID
let distributionInterval: NodeJS.Timeout | null = null

// Function to run profit distribution automatically at specified intervals
export function startProfitDistribution(intervalMinutes: number = 60) {
  console.log(`Starting automated profit distribution system (every ${intervalMinutes} minutes)...`)
  console.log('Users will receive profits 24 hours after investing in a plan.')
  
  // Clear any existing interval
  if (distributionInterval) {
    clearInterval(distributionInterval)
  }
  
  // Run immediately on start
  distributeProfits().catch(error => {
    console.error('Error in initial profit distribution:', error)
  })
  
  // Then run at specified intervals
  distributionInterval = setInterval(() => {
    distributeProfits().catch(error => {
      console.error('Error in scheduled profit distribution:', error)
    })
  }, intervalMinutes * 60 * 1000) // Convert minutes to milliseconds
  
  console.log(`Profit distribution interval set to ${intervalMinutes} minutes`)
  return distributionInterval
}

// Function to stop automatic profit distribution
export function stopProfitDistribution() {
  if (distributionInterval) {
    clearInterval(distributionInterval)
    distributionInterval = null
    console.log('Automatic profit distribution stopped')
    return true
  }
  console.log('No active profit distribution to stop')
  return false
}

// Manual trigger function for testing
export async function triggerProfitDistribution() {
  console.log('Manually triggering daily profit distribution...')
  await distributeProfits()
}

// Manual trigger for investment profits only
export async function triggerInvestmentProfitDistribution() {
  console.log('Manually triggering investment profit distribution...')
  await distributeInvestmentProfits()
}

// Manual trigger for JRC staking profits only
export async function triggerJrcStakingProfitDistribution() {
  console.log('Manually triggering JRC staking profit distribution...')
  await distributeJrcStakingProfits()
}
