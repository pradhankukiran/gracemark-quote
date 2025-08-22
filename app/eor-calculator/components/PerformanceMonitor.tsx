import { useEffect, useRef, useState } from "react"

interface PerformanceMetrics {
  renderCount: number
  lastRenderTime: number
  averageRenderTime: number
  totalRenderTime: number
}

interface PerformanceMonitorProps {
  componentName: string
  enabled?: boolean
  showMetrics?: boolean
}

/**
 * Development component to monitor component performance
 * Only active in development mode
 */
export const PerformanceMonitor = ({ 
  componentName, 
  enabled = process.env.NODE_ENV === 'development',
  showMetrics = false
}: PerformanceMonitorProps) => {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0
  })
  const renderStartRef = useRef<number>(0)
  const [metrics, setMetrics] = useState<PerformanceMetrics>(metricsRef.current)

  useEffect(() => {
    if (!enabled) return

    // Record render start time
    renderStartRef.current = performance.now()

    return () => {
      // Calculate render time on cleanup
      const renderTime = performance.now() - renderStartRef.current
      const current = metricsRef.current

      current.renderCount++
      current.lastRenderTime = renderTime
      current.totalRenderTime += renderTime
      current.averageRenderTime = current.totalRenderTime / current.renderCount

      if (showMetrics) {
        setMetrics({ ...current })
      }

      // Log performance warnings
      if (renderTime > 16) {
        console.warn(
          `🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
          {
            renderCount: current.renderCount,
            averageRenderTime: current.averageRenderTime.toFixed(2),
          }
        )
      }

      if (current.renderCount % 50 === 0) {
        console.log(
          `📊 ${componentName} performance summary:`,
          {
            renders: current.renderCount,
            averageRenderTime: current.averageRenderTime.toFixed(2) + 'ms',
            totalRenderTime: current.totalRenderTime.toFixed(2) + 'ms',
          }
        )
      }
    }
  })

  if (!enabled || !showMetrics) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="font-bold mb-1">{componentName}</div>
      <div>Renders: {metrics.renderCount}</div>
      <div>Last: {metrics.lastRenderTime.toFixed(1)}ms</div>
      <div>Avg: {metrics.averageRenderTime.toFixed(1)}ms</div>
    </div>
  )
}

/**
 * Hook to measure and log component render performance
 */
export const useRenderPerformance = (componentName: string, enabled = process.env.NODE_ENV === 'development') => {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0
  })
  const renderStartRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    renderStartRef.current = performance.now()

    return () => {
      const renderTime = performance.now() - renderStartRef.current
      const current = metricsRef.current

      current.renderCount++
      current.lastRenderTime = renderTime
      current.totalRenderTime += renderTime
      current.averageRenderTime = current.totalRenderTime / current.renderCount

      if (renderTime > 16) {
        console.warn(`🐌 ${componentName} slow render: ${renderTime.toFixed(2)}ms`)
      }
    }
  })

  return metricsRef.current
}