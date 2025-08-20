import React from "react"
import { LucideIcon } from "lucide-react"

interface FormSectionHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  className?: string
}

export const FormSectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  className = ""
}: FormSectionHeaderProps) => {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-slate-600 mb-6">{subtitle}</p>
      )}
    </div>
  )
}