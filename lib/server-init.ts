import { startProfitDistribution } from './profit-distribution'

// Flag to ensure initialization only happens once
let isInitialized = false

export function initializeServer() {
  if (isInitialized) {
    console.log('Server already initialized, skipping...')
    return
  }

  console.log('Initializing server components...')
  
  // Get interval from environment variable or default to 1 minute for testing
  const intervalMinutes = process.env.PROFIT_DISTRIBUTION_INTERVAL 
    ? parseInt(process.env.PROFIT_DISTRIBUTION_INTERVAL) 
    : 1 // Default to 1 minute for testing
  
  // Start automatic profit distribution
  startProfitDistribution(intervalMinutes)
  
  isInitialized = true
  console.log('Server initialization complete')
}

// Auto-initialize when this module is imported
if (typeof window === 'undefined') {
  // Only run on server-side
  initializeServer()
}
