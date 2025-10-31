import React from "react"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export const LoadingSpinner = ({
  message = "Loading...",
  className = "",
  size = "md"
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-slate-400 mr-2`} />
      <span className="text-slate-600">{message}</span>
    </div>
  )
}