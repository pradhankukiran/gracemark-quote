// Confidence Indicator - Visual indicator for enhancement confidence scores

"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfidenceIndicatorProps {
  score: number
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  showIcon?: boolean
  className?: string
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  size = 'medium',
  showLabel = true,
  showIcon = true,
  className
}) => {
  // Normalize score to 0-1 range
  const normalizedScore = Math.max(0, Math.min(1, score))
  
  // Get confidence level and styling
  const getConfidenceData = (score: number) => {
    if (score >= 0.8) {
      return {
        level: 'High',
        color: 'green',
        bgClass: 'bg-green-100',
        textClass: 'text-green-700',
        borderClass: 'border-green-200',
        icon: CheckCircle2,
        description: 'Reliable legal data available'
      }
    } else if (score >= 0.6) {
      return {
        level: 'Good',
        color: 'blue',
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
        icon: TrendingUp,
        description: 'Based on standard legal requirements'
      }
    } else if (score >= 0.4) {
      return {
        level: 'Medium',
        color: 'yellow',
        bgClass: 'bg-yellow-100',
        textClass: 'text-yellow-700',
        borderClass: 'border-yellow-200',
        icon: AlertCircle,
        description: 'Estimated based on available data'
      }
    } else if (score >= 0.2) {
      return {
        level: 'Low',
        color: 'orange',
        bgClass: 'bg-orange-100',
        textClass: 'text-orange-700',
        borderClass: 'border-orange-200',
        icon: AlertCircle,
        description: 'Limited data - estimates may vary'
      }
    } else {
      return {
        level: 'Very Low',
        color: 'red',
        bgClass: 'bg-red-100',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        icon: XCircle,
        description: 'Insufficient data for reliable estimate'
      }
    }
  }

  const confidenceData = getConfidenceData(normalizedScore)
  const Icon = confidenceData.icon

  // Size-based styling
  const sizeClasses = {
    small: {
      container: 'text-xs',
      icon: 'h-3 w-3',
      padding: 'px-2 py-1'
    },
    medium: {
      container: 'text-sm',
      icon: 'h-4 w-4',
      padding: 'px-3 py-1'
    },
    large: {
      container: 'text-base',
      icon: 'h-5 w-5',
      padding: 'px-4 py-2'
    }
  }

  const currentSizeClasses = sizeClasses[size]

  // Progress bar component for visual confidence
  const ConfidenceBar = () => (
    <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
      <div 
        className={cn(
          "h-full transition-all duration-500 ease-out",
          confidenceData.color === 'green' && "bg-green-500",
          confidenceData.color === 'blue' && "bg-blue-500",
          confidenceData.color === 'yellow' && "bg-yellow-500",
          confidenceData.color === 'orange' && "bg-orange-500",
          confidenceData.color === 'red' && "bg-red-500"
        )}
        style={{ width: `${normalizedScore * 100}%` }}
      />
    </div>
  )

  if (size === 'large') {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Analysis Confidence</span>
          <Badge 
            variant="secondary"
            className={cn(
              confidenceData.bgClass,
              confidenceData.textClass,
              currentSizeClasses.padding
            )}
          >
            {showIcon && <Icon className={cn(currentSizeClasses.icon, "mr-1")} />}
            {confidenceData.level}
          </Badge>
        </div>
        <ConfidenceBar />
        <p className="text-xs text-slate-500">{confidenceData.description}</p>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {size === 'medium' && <ConfidenceBar />}
      
      <Badge 
        variant="secondary"
        className={cn(
          confidenceData.bgClass,
          confidenceData.textClass,
          confidenceData.borderClass,
          currentSizeClasses.container,
          currentSizeClasses.padding,
          "border"
        )}
      >
        {showIcon && <Icon className={cn(currentSizeClasses.icon, "mr-1")} />}
        {showLabel && confidenceData.level}
        {!showLabel && `${Math.round(normalizedScore * 100)}%`}
      </Badge>
    </div>
  )
}

// Alternative minimal version for compact displays
export const ConfidenceScore: React.FC<{ score: number; className?: string }> = ({ 
  score, 
  className 
}) => {
  const normalizedScore = Math.max(0, Math.min(1, score))
  const percentage = Math.round(normalizedScore * 100)
  
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600"
    if (score >= 0.6) return "text-blue-600"
    if (score >= 0.4) return "text-yellow-600"
    if (score >= 0.2) return "text-orange-600"
    return "text-red-600"
  }

  return (
    <span className={cn("font-mono text-xs", getScoreColor(normalizedScore), className)}>
      {percentage}%
    </span>
  )
}

// Confidence level text helper
export const getConfidenceLevel = (score: number): string => {
  const normalizedScore = Math.max(0, Math.min(1, score))
  
  if (normalizedScore >= 0.8) return 'High'
  if (normalizedScore >= 0.6) return 'Good'
  if (normalizedScore >= 0.4) return 'Medium'
  if (normalizedScore >= 0.2) return 'Low'
  return 'Very Low'
}

// Confidence description helper
export const getConfidenceDescription = (score: number): string => {
  const normalizedScore = Math.max(0, Math.min(1, score))
  
  if (normalizedScore >= 0.8) return 'Based on reliable legal data and clear requirements'
  if (normalizedScore >= 0.6) return 'Based on standard legal requirements for this country'
  if (normalizedScore >= 0.4) return 'Estimated using available legal information'
  if (normalizedScore >= 0.2) return 'Rough estimate - limited data available'
  return 'Very rough estimate - insufficient legal data'
}
