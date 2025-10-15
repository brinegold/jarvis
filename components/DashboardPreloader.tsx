'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useDashboardData } from '@/hooks/useDashboardData'

// This component preloads dashboard data when user is authenticated
// It runs in the background and caches the data for faster dashboard loading
export default function DashboardPreloader() {
  const { user } = useAuth()
  
  // This will cache the dashboard data in the background
  const { loading } = useDashboardData(user?.id)

  useEffect(() => {
    if (user && !loading) {
      // Prefetch dashboard route for faster navigation
      if (typeof window !== 'undefined') {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = '/dashboard'
        document.head.appendChild(link)
        
        // Clean up
        return () => {
          if (document.head.contains(link)) {
            document.head.removeChild(link)
          }
        }
      }
    }
  }, [user, loading])

  // This component doesn't render anything visible
  return null
}
