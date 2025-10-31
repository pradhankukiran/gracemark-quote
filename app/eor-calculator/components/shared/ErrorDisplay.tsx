import React from "react"
import { AlertCircle } from "lucide-react"

interface ErrorDisplayProps {
  title?: string
  message: string
  className?: string
  variant?: "warning" | "error"
}

export const ErrorDisplay = ({
  title = "Error",
  message,
  className = "",
  variant = "warning"
}: ErrorDisplayProps) => {
  const variantStyles = {
    warning: {
      container: "bg-yellow-50 border border-yellow-200",
      icon: "text-yellow-500",
      title: "text-yellow-800",
      message: "text-yellow-700"
    },
    error: {
      container: "bg-red-50 border border-red-200",
      icon: "text-red-500",
      title: "text-red-800",
      message: "text-red-700"
    }
  }

  const styles = variantStyles[variant]

  return (
    <div className={`${styles.container} p-4 rounded-md mb-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className={`h-5 w-5 ${styles.icon} mt-0.5 flex-shrink-0`} />
        <div>
          <h5 className={`${styles.title} font-medium`}>{title}</h5>
          <p className={`${styles.message} text-sm mt-1`}>{message}</p>
        </div>
      </div>
    </div>
  )
}