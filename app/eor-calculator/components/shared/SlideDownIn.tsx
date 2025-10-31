"use client"

import { ReactNode, useEffect, useState } from "react"

interface SlideDownInProps {
  isVisible: boolean
  children: ReactNode
  className?: string
}

export const SlideDownIn = ({
  isVisible,
  children,
  className = "",
}: SlideDownInProps) => {
  const [shouldRender, setShouldRender] = useState(isVisible)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!shouldRender) return null

  return (
    <div
      className={`
        transition-all duration-300 ease-in-out
        ${isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-8'
        }
        ${className}
      `}
    >
      {children}
    </div>
  )
}