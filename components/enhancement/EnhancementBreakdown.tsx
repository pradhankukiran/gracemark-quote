// Enhancement Breakdown - Detailed view of all legal enhancements

"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  ChevronDown, 
  ChevronUp,
  Scale,
  Calendar,
  Gift,
  Car,
  Home,
  UtensilsCrossed,
  Stethoscope,
  Info,
  AlertCircle,
  Percent
} from "lucide-react"
import { EnhancedQuote } from "@/lib/types/enhancement"
import { ConfidenceIndicator } from "./ConfidenceIndicator"
import { formatCurrency } from "@/lib/shared/utils/formatUtils"

interface EnhancementBreakdownProps {
  enhancement: EnhancedQuote
  showExplanations?: boolean
}

interface EnhancementItemProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  amount: number
  currency: string
  explanation?: string
  confidence?: number
  isAlreadyIncluded?: boolean
  isMandatory?: boolean
  frequency?: string
}

export const EnhancementBreakdown: React.FC<EnhancementBreakdownProps> = ({
  enhancement,
  showExplanations = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { enhancements, baseCurrency } = enhancement

  // Filter out items with zero amounts or already included
  const getVisibleEnhancements = () => {
    const items: EnhancementItemProps[] = []

    // Termination costs (monthly provision)
    if (enhancements.terminationCosts && enhancements.terminationCosts.totalTerminationCost > 0) {
      const months = enhancements.terminationCosts.basedOnContractMonths || 12
      const monthlyized = months > 0 ? (enhancements.terminationCosts.totalTerminationCost / months) : enhancements.terminationCosts.totalTerminationCost
      items.push({
        icon: Scale,
        title: "Termination Provision",
        amount: monthlyized,
        currency: baseCurrency,
        explanation: `${enhancements.terminationCosts.explanation || ''} (monthly provision over ${months} months)`,
        confidence: enhancements.terminationCosts.confidence,
        isMandatory: true,
        frequency: "monthly"
      })
    }

    // 13th salary
    if (enhancements.thirteenthSalary && enhancements.thirteenthSalary.monthlyAmount > 0 && !enhancements.thirteenthSalary.isAlreadyIncluded) {
      items.push({
        icon: Gift,
        title: "13th Month Salary",
        amount: enhancements.thirteenthSalary.monthlyAmount,
        currency: baseCurrency,
        explanation: enhancements.thirteenthSalary.explanation,
        confidence: enhancements.thirteenthSalary.confidence,
        isMandatory: true,
        frequency: "monthly"
      })
    }

    // 14th salary
    if (enhancements.fourteenthSalary && enhancements.fourteenthSalary.monthlyAmount > 0 && !enhancements.fourteenthSalary.isAlreadyIncluded) {
      items.push({
        icon: Gift,
        title: "14th Month Salary",
        amount: enhancements.fourteenthSalary.monthlyAmount,
        currency: baseCurrency,
        explanation: enhancements.fourteenthSalary.explanation,
        confidence: enhancements.fourteenthSalary.confidence,
        isMandatory: true,
        frequency: "monthly"
      })
    }

    // Vacation bonus
    if (enhancements.vacationBonus && enhancements.vacationBonus.amount > 0 && !enhancements.vacationBonus.isAlreadyIncluded) {
      const vb = enhancements.vacationBonus
      const monthlyized = (vb.frequency === 'yearly') ? (vb.amount || 0) / 12 : (vb.amount || 0)
      items.push({
        icon: Calendar,
        title: "Vacation Bonus",
        amount: monthlyized,
        currency: baseCurrency,
        explanation: vb.explanation,
        confidence: vb.confidence,
        isMandatory: true,
        frequency: "monthly"
      })
    }

    // Transportation allowance
    if (enhancements.transportationAllowance && enhancements.transportationAllowance.monthlyAmount > 0 && !enhancements.transportationAllowance.isAlreadyIncluded) {
      items.push({
        icon: Car,
        title: "Transportation Allowance",
        amount: enhancements.transportationAllowance.monthlyAmount,
        currency: baseCurrency,
        explanation: enhancements.transportationAllowance.explanation,
        confidence: enhancements.transportationAllowance.confidence,
        isMandatory: enhancements.transportationAllowance.isMandatory,
        frequency: "monthly"
      })
    }

    // Remote work allowance
    if (enhancements.remoteWorkAllowance && enhancements.remoteWorkAllowance.monthlyAmount > 0 && !enhancements.remoteWorkAllowance.isAlreadyIncluded) {
      items.push({
        icon: Home,
        title: "Remote Work Allowance",
        amount: enhancements.remoteWorkAllowance.monthlyAmount,
        currency: baseCurrency,
        explanation: enhancements.remoteWorkAllowance.explanation,
        confidence: enhancements.remoteWorkAllowance.confidence,
        isMandatory: enhancements.remoteWorkAllowance.isMandatory,
        frequency: "monthly"
      })
    }

    // Meal vouchers
    if (enhancements.mealVouchers && enhancements.mealVouchers.monthlyAmount > 0 && !enhancements.mealVouchers.isAlreadyIncluded) {
      items.push({
        icon: UtensilsCrossed,
        title: "Meal Vouchers",
        amount: enhancements.mealVouchers.monthlyAmount,
        currency: baseCurrency,
        explanation: enhancements.mealVouchers.explanation,
        confidence: enhancements.mealVouchers.confidence,
        isMandatory: enhancements.mealVouchers.isMandatory,
        frequency: "monthly"
      })
    }

    // Medical exam
    if (
      enhancements.medicalExam &&
      enhancements.medicalExam.required &&
      typeof enhancements.medicalExam.estimatedCost === 'number' &&
      enhancements.medicalExam.estimatedCost > 0
    ) {
      items.push({
        icon: Stethoscope,
        title: "Medical Examination",
        amount: enhancements.medicalExam.estimatedCost || 0,
        currency: baseCurrency,
        explanation: "Pre-employment medical examination required by law",
        confidence: enhancements.medicalExam.confidence,
        isMandatory: true,
        frequency: "one-time"
      })
    }

    // Employer contributions and other additions (per-item rows)
    if (enhancements.additionalContributions) {
      const pretty = (k: string) => {
        const clean = k
          .replace(/^employer_contrib_/, '')
          .replace(/^allowance_/, '')
          .replace(/^local_/, 'Local ')
          .replace(/_/g, ' ')
        return clean.replace(/\b\w/g, c => c.toUpperCase())
      }
      const entries = Object.entries(enhancements.additionalContributions)
      // If only aggregate exists, show it as a single row
      const onlyAggregate = entries.length === 1 && 'employer_contributions_total' in enhancements.additionalContributions
      if (onlyAggregate) {
        const amt = Number(enhancements.additionalContributions['employer_contributions_total'] || 0)
        if (amt > 0) {
          items.push({
            icon: Percent,
            title: 'Employer Contributions (Aggregate)',
            amount: amt,
            currency: baseCurrency,
            explanation: 'Aggregate employer statutory contributions (monthly)',
            confidence: 0.6,
            isMandatory: true,
            frequency: 'monthly'
          })
        }
      }

      entries
        .filter(([k, v]) => (Number(v) || 0) > 0)
        // Skip aggregate and allowance mirror entries (allowances already listed above)
        .filter(([k]) => k !== 'employer_contributions_total' && !k.startsWith('allowance_'))
        .forEach(([key, amount]) => {
          items.push({
            icon: Percent,
            title: pretty(key),
            amount: Number(amount || 0),
            currency: baseCurrency,
            explanation: key.startsWith('local_')
              ? 'Local office expense (monthly)'
              : (key.startsWith('employer_contrib_')
                  ? 'Employer statutory contribution (monthly)'
                  : 'Additional monthly cost'),
            confidence: 0.6,
            isMandatory: key.startsWith('employer_contrib_'),
            frequency: 'monthly'
          })
        })
    }

    return items
  }

  const visibleEnhancements = getVisibleEnhancements()
  const hasEnhancements = visibleEnhancements.length > 0

  if (!hasEnhancements) {
    return (
      <div className="text-center py-4 text-slate-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="font-medium">No Legal Enhancements Required</p>
        <p className="text-sm">This provider quote appears to include all legal requirements.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Legal Requirements & Enhancements
        </h3>
        <Badge variant="outline" className="text-xs">
          {visibleEnhancements.length} item{visibleEnhancements.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-3">
        {visibleEnhancements.map((item, index) => (
          <EnhancementItem
            key={index}
            {...item}
            showExplanation={showExplanations}
          />
        ))}
      </div>

      {/* Total Enhancement */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-green-800">Total Legal Enhancements</p>
            <p className="text-sm text-green-600">Additional monthly costs for legal compliance</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-800">
              +{formatCurrency(enhancement?.totalEnhancement, baseCurrency)}
            </p>
            <p className="text-sm text-green-600">per month</p>
          </div>
        </div>
      </div>

      {/* Overlap Analysis */}
      {enhancement.overlapAnalysis.doubleCountingRisk.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="text-orange-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Potential Double-Counting Risks
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <ul className="space-y-1">
                {enhancement.overlapAnalysis.doubleCountingRisk.map((risk, index) => (
                  <li key={index} className="text-sm text-orange-700 flex items-start gap-2">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// Individual enhancement item component
const EnhancementItem: React.FC<EnhancementItemProps & { showExplanation?: boolean }> = ({
  icon: Icon,
  title,
  amount,
  currency,
  explanation,
  confidence,
  isMandatory,
  frequency,
  showExplanation = true
}) => {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-slate-800">{title}</h4>
              {isMandatory && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                  Required
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 capitalize">{frequency}</p>
          </div>
        </div>
        
        <div className="text-right flex items-center gap-3">
          <div>
            <p className="font-semibold text-slate-900">
              +{formatCurrency(amount, currency)}
            </p>
          </div>
          {confidence !== undefined && (
            <ConfidenceIndicator score={confidence} size="small" />
          )}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && explanation && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between mt-2 text-slate-600"
            >
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                Details
              </span>
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-700">{explanation}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
