'use client'

import { useEffect, useRef } from 'react'

export function ServerInitializer() {
  const initialized = useRef(false)

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return
    initialized.current = true

    // Call the init endpoint to start profit distribution
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        console.log('Server initialization response:', data)
      })
      .catch(error => {
        console.error('Failed to initialize server:', error)
      })
  }, [])

  return null // This component doesn't render anything
}
