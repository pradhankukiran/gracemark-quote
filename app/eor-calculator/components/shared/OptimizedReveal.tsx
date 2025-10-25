import { ReactNode, memo, useState, useEffect } from "react"

interface OptimizedRevealProps {
  isVisible: boolean
  children: ReactNode
  className?: string
  animation?: 'smooth' | 'fade' | 'none'
}

/**
 * Optimized reveal component that minimizes re-renders and uses efficient CSS transitions
 * Uses CSS Grid for smooth height animations
 */
export const OptimizedReveal = memo(({
  isVisible,
  children,
  className = "",
  animation = 'smooth'
}: OptimizedRevealProps) => {
  const [shouldRender, setShouldRender] = useState(isVisible)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
    } else {
      const timer = setTimeout(() => setShouldRender(false), 400) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!shouldRender) return null

  // For 'none' animation, simply show/hide without transitions
  if (animation === 'none') {
    return isVisible ? <div className={className}>{children}</div> : null
  }

  // Use CSS Grid for smooth height transitions
  // Bouncy when opening, smooth when closing
  return (
    <div
      style={{
        transition: isVisible
          ? 'grid-template-rows 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out'
          : 'grid-template-rows 0.3s ease-out, opacity 0.25s ease-in'
      }}
      className={`grid ${
        isVisible
          ? 'grid-rows-[1fr] opacity-100'
          : 'grid-rows-[0fr] opacity-0'
      } ${className}`}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  )
})

OptimizedReveal.displayName = 'OptimizedReveal'

// Specific variants for common use cases
export const FadeReveal = memo(({ isVisible, children, className }: Omit<OptimizedRevealProps, 'animation'>) => (
  <OptimizedReveal isVisible={isVisible} animation="fade" className={className}>
    {children}
  </OptimizedReveal>
))

FadeReveal.displayName = 'FadeReveal'

export const SmoothReveal = memo(({ isVisible, children, className }: Omit<OptimizedRevealProps, 'animation'>) => (
  <OptimizedReveal isVisible={isVisible} animation="smooth" className={className}>
    {children}
  </OptimizedReveal>
))

SmoothReveal.displayName = 'SmoothReveal'

export const InstantReveal = memo(({ isVisible, children, className }: Omit<OptimizedRevealProps, 'animation'>) => (
  <OptimizedReveal isVisible={isVisible} animation="none" className={className}>
    {children}
  </OptimizedReveal>
))

InstantReveal.displayName = 'InstantReveal'