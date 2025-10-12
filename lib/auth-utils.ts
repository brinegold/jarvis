import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-server'

export async function getUserFromRequest(request: NextRequest) {
  try {
    // Get authorization token from cookies
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) {
      return { user: null, error: 'No cookies found' }
    }

    // Parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        acc[key] = decodeURIComponent(value)
      }
      return acc
    }, {} as Record<string, string>)

    // Look for Supabase session token
    const sessionToken = cookies['sb-access-token'] || 
                        cookies['supabase-auth-token'] ||
                        cookies['sb-localhost-auth-token']

    if (!sessionToken) {
      return { user: null, error: 'No auth token found in cookies' }
    }

    // For now, we'll use a simpler approach - validate the session exists in the database
    // This is a workaround for the auth client version issues
    
    // Extract user ID from the session token (this is a simplified approach)
    // In production, you'd want to properly verify the JWT token
    
    return { user: null, error: 'Authentication method needs to be implemented' }
    
  } catch (error) {
    console.error('Error getting user from request:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

// Simplified version that skips auth for now - ONLY FOR DEVELOPMENT
export async function skipAuthForDev() {
  // This is a temporary solution to bypass auth issues during development
  // In production, proper authentication should be implemented
  return {
    user: { id: 'dev-user', email: 'dev@example.com' },
    error: null
  }
}
