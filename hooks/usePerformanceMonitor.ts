import { useEffect, useCallback } from 'react'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  interactionTime: number
}

export function usePerformanceMonitor(componentName: string) {
  const measurePerformance = useCallback(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      const metrics: PerformanceMetrics = {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        renderTime: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        interactionTime: navigation.domInteractive - navigation.fetchStart
      }

      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.group(`🚀 Performance Metrics - ${componentName}`)
        console.log('Load Time:', `${metrics.loadTime.toFixed(2)}ms`)
        console.log('Render Time:', `${metrics.renderTime.toFixed(2)}ms`)
        console.log('Interaction Time:', `${metrics.interactionTime.toFixed(2)}ms`)
        console.groupEnd()
      }

      return metrics
    }
    return null
  }, [componentName])

  const measureComponentRender = useCallback((startTime: number) => {
    const endTime = performance.now()
    const renderTime = endTime - startTime

    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${componentName} render time: ${renderTime.toFixed(2)}ms`)
    }

    return renderTime
  }, [componentName])

  useEffect(() => {
    // Measure initial load performance
    const timeout = setTimeout(measurePerformance, 100)
    return () => clearTimeout(timeout)
  }, [measurePerformance])

  return { measurePerformance, measureComponentRender }
}
