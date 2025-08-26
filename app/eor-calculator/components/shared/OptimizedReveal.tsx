import { ReactNode, memo, useMemo, useState, useEffect } from "react"

interface OptimizedRevealProps {
  isVisible: boolean
  children: ReactNode
  className?: string
  animation?: 'smooth' | 'fade' | 'none'
}

/**
 * Optimized reveal component that minimizes re-renders and uses efficient CSS transitions
 * Replaces BounceReveal for better performance
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
      const timer = setTimeout(() => setShouldRender(false), 300) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [isVisible])
  
  // Memoize animation classes to prevent recalculation
  const animationClasses = useMemo(() => {
    const baseClasses = "overflow-hidden transition-all ease-in-out"
    
    switch (animation) {
      case 'fade':
        return `${baseClasses} duration-300 ${isVisible ? 'opacity-100 max-h-screen' : 'opacity-0 pointer-events-none max-h-0'}`
      case 'smooth':
        return `${baseClasses} duration-300 ${isVisible ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`
      case 'none':
        return isVisible ? '' : 'hidden'
      default:
        return `${baseClasses} duration-300 ${isVisible ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`
    }
  }, [isVisible, animation])

  if (!shouldRender) return null

  // For 'none' animation, simply show/hide without transitions
  if (animation === 'none') {
    return isVisible ? <div className={className}>{children}</div> : null
  }

  return (
    <div className={`${animationClasses} ${className}`}>
      {children}
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