// Server initialization - automatic scheduler removed
// Profit distribution is now handled via:
// 1. External cron jobs calling /api/auto-profit-distribution
// 2. Manual admin button

// Flag to ensure initialization only happens once
let isInitialized = false

export function initializeServer() {
  if (isInitialized) {
    console.log('Server already initialized, skipping...')
    return
  }

  console.log('Initializing server components...')
  console.log('Profit distribution system: External cron jobs + manual admin button')
  
  isInitialized = true
  console.log('Server initialization complete')
}

// Auto-initialize when this module is imported
if (typeof window === 'undefined') {
  // Only run on server-side
  initializeServer()
}
