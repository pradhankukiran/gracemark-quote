import { ReactNode, useEffect, useState } from "react"
import { ANIMATION_STYLES } from "../../styles/constants"

interface AnimatedRevealProps {
  isVisible: boolean
  children: ReactNode
  animation?: keyof typeof ANIMATION_STYLES
  className?: string
}

export const AnimatedReveal = ({ 
  isVisible, 
  children, 
  animation = "HEIGHT_SMOOTH",
  className = "" 
}: AnimatedRevealProps) => {
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      // Small delay to ensure proper animation timing
      setTimeout(() => setIsAnimating(true), 10)
    } else {
      setIsAnimating(false)
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!shouldRender) return null

  const getAnimationClasses = () => {
    const baseAnimation = ANIMATION_STYLES[animation]
    
    // Rubber band/bounce animations
    if (animation.includes("BOUNCE")) {
      return `${baseAnimation} ${
        isAnimating && isVisible 
          ? ANIMATION_STYLES.BOUNCE_VISIBLE_STATE
          : ANIMATION_STYLES.BOUNCE_HIDDEN_STATE
      }`
    }
    
    if (animation.includes("HEIGHT")) {
      return `${baseAnimation} ${
        isAnimating && isVisible 
          ? "max-h-screen opacity-100" 
          : "max-h-0 opacity-0"
      }`
    }
    
    if (animation.includes("SLIDE_FADE")) {
      return `${baseAnimation} ${
        isAnimating && isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2"
      }`
    }
    
    if (animation.includes("FADE")) {
      return `${baseAnimation} ${
        isAnimating && isVisible ? "opacity-100" : "opacity-0"
      }`
    }
    
    // Default smooth reveal
    return `${baseAnimation} ${
      isAnimating && isVisible
        ? "opacity-100 max-h-screen translate-y-0"
        : "opacity-0 max-h-0 -translate-y-2"
    }`
  }

  return (
    <div className={`${getAnimationClasses()} ${className}`}>
      {children}
    </div>
  )
}

// Export specific animation variants for common use cases
export const SmoothReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="HEIGHT_SMOOTH" className={className}>
    {children}
  </AnimatedReveal>
)

export const FastReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="HEIGHT_FAST" className={className}>
    {children}
  </AnimatedReveal>
)

export const FadeReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="FADE_SMOOTH" className={className}>
    {children}
  </AnimatedReveal>
)

export const SlideReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="SLIDE_FADE_UP" className={className}>
    {children}
  </AnimatedReveal>
)

// Rubber band/bounce animation variants
export const BounceReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="HEIGHT_BOUNCE" className={className}>
    {children}
  </AnimatedReveal>
)

export const BounceSlideReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="SLIDE_BOUNCE" className={className}>
    {children}
  </AnimatedReveal>
)

export const BounceScaleReveal = ({ isVisible, children, className }: Omit<AnimatedRevealProps, 'animation'>) => (
  <AnimatedReveal isVisible={isVisible} animation="SCALE_BOUNCE" className={className}>
    {children}
  </AnimatedReveal>
)