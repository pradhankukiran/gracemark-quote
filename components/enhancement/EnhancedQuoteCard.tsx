// Enhanced Quote Card - Displays provider quote with LLM enhancements

"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  Shield,
  Calculator,
  Info
} from "lucide-react"
import { useEnhancementContext } from "@/hooks/enhancement/EnhancementContext"
import { ProviderType } from "@/lib/types/enhancement"
import { EORFormData } from "@/lib/shared/types"
import { EnhancementBreakdown } from "./EnhancementBreakdown"
import { ConfidenceIndicator } from "./ConfidenceIndicator"
import { ProviderLogo } from "@/app/quote/components/ProviderLogo"
import { validateQuoteWithDebugging, normalizeQuoteForEnhancement } from "@/lib/shared/utils/quoteNormalizer"
import { safeToLocaleString, parseMoney, formatCurrency, safeNumber, safeDifference } from "@/lib/shared/utils/formatUtils"

interface EnhancedQuoteCardProps {
  provider: ProviderType
  baseQuote: any
  formData: EORFormData
  quoteType?: 'all-inclusive' | 'statutory-only'
  className?: string
  compact?: boolean
  showRetry?: boolean
  enhancementKey?: string
}

export const EnhancedQuoteCard: React.FC<EnhancedQuoteCardProps> = ({
  provider,
  baseQuote,
  formData,
  quoteType = 'all-inclusive',
  className = "",
  compact = false,
  showRetry = true,
  enhancementKey
}) => {
  const { 
    enhancing, 
    enhancements, 
    errors, 
    enhanceQuote,
    getEnhancementStatus 
  } = useEnhancementContext()

  const [validationError, setValidationError] = useState<string | null>(null)
  
  const key = enhancementKey || provider
  const isEnhancing = enhancing[key]
  const enhancement = enhancements[key]
  const error = errors[key]
  const status = getEnhancementStatus(key)

  // Validate quote data
  const quoteValidation = validateQuoteWithDebugging(provider, baseQuote)
  const hasValidQuote = quoteValidation.isValid

  // Auto-enhancement disabled; enhancement is orchestrated upstream.
  // Exception: for comparison variants (enhancementKey provided), trigger only AFTER
  // the primary enhancement for this provider has completed to avoid parallel spikes.
  useEffect(() => {
    if (!enhancementKey) return
    if (!hasValidQuote) return
    if (status !== 'idle') return
    // Wait for primary (provider key) to finish enhancement first
    const primaryDone = !!enhancements[provider] && !enhancing[provider]
    if (!primaryDone) return
    // Fire and forget; context tracks state
    void enhanceQuote(provider, baseQuote, formData, quoteType, { key })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancementKey, hasValidQuote, status, provider, baseQuote, formData, quoteType, key, enhancements, enhancing])

  const handleRetry = () => {
    if (hasValidQuote) {
      enhanceQuote(provider, baseQuote, formData, quoteType, { key })
      setValidationError(null)
    } else {
      console.warn(`Cannot retry enhancement - invalid quote data for provider ${provider}:`, quoteValidation)
      setValidationError(quoteValidation.reason || 'Invalid quote data')
    }
  }

  // No direct clear action in this UI; enhancements are managed upstream

  // Derive normalized base quote for display (prefer enhancement.baseQuote if available)
  const normalizedForDisplay = React.useMemo(() => {
    if (enhancement?.baseQuote) return enhancement.baseQuote
    const normalized = normalizeQuoteForEnhancement(provider, baseQuote)
    return normalized || undefined
  }, [enhancement?.baseQuote, provider, baseQuote])

  // Calculate total with enhancements - with safe fallbacks
  const getDisplayTotal = (): number => {
    if (enhancement) {
      // Use safe number to handle undefined finalTotal
      return safeNumber(enhancement.finalTotal, 0)
    }
    
    // Prefer normalized monthly total if available
    if (normalizedForDisplay?.monthlyTotal && typeof normalizedForDisplay.monthlyTotal === 'number') {
      return safeNumber(normalizedForDisplay.monthlyTotal, 0)
    }
    
    // Fall back to total_costs (if it's a string that needs parsing)
    if (baseQuote?.total_costs && typeof baseQuote.total_costs === 'string') {
      return parseMoney(baseQuote.total_costs, 0)
    }
    
    // Final fallback
    return 0
  }

  const getDisplayCurrency = (): string => {
    return enhancement?.baseCurrency || baseQuote?.currency || 'USD'
  }

  const hasEnhancements = enhancement && enhancement.totalEnhancement > 0

  return (
    <Card className={`relative ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={provider} />
            <div>
              <CardTitle className="text-lg">
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={quoteType === 'all-inclusive' ? 'default' : 'secondary'}>
                  {quoteType.replace('-', ' ').toUpperCase()}
                </Badge>
                <StatusIndicator status={status} />
              </div>
            </div>
          </div>

          {showRetry && (
            <div className="flex items-center gap-2">
              {error && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isEnhancing}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cost Summary */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Monthly Total</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(getDisplayTotal(), getDisplayCurrency())}
              </p>
              {hasEnhancements && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{safeToLocaleString(enhancement?.totalEnhancement)} enhanced
                </p>
              )}
            </div>
            
            {enhancement && enhancement.overallConfidence > 0 && (
              <ConfidenceIndicator 
                score={enhancement.overallConfidence} 
                size="large"
              />
            )}
          </div>
        </div>

        {/* Enhancement Status */}
        {isEnhancing && (
          <div className="flex items-center justify-center py-6">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-slate-600">Analyzing legal requirements...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Enhancement Failed</p>
                <p className="text-sm text-red-600 mt-1">{error.message}</p>
                {showRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {validationError && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Invalid Quote Data</p>
                <p className="text-sm text-orange-600 mt-1">{validationError}</p>
                <p className="text-xs text-orange-500 mt-2">
                  This quote cannot be enhanced due to missing or invalid data. 
                  Please check the quote source or try refreshing the page.
                </p>
                {process.env.NODE_ENV === 'development' && quoteValidation.quoteInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-orange-500 cursor-pointer">Debug Info</summary>
                    <pre className="text-xs text-orange-400 mt-1 p-2 bg-orange-100 rounded max-h-32 overflow-auto">
                      {JSON.stringify(quoteValidation.quoteInfo, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Quote (Local Currency) Itemization */}
        {enhancement?.fullQuote && !compact && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700">Full Quote (Local Currency)</h4>
              <div className="rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 text-xs text-slate-500">
                  <div>Item</div>
                  <div className="text-right">Monthly Amount</div>
                  <div className="hidden sm:block text-right">Currency</div>
                </div>
                <div className="divide-y">
                  {enhancement.fullQuote.items?.filter(i => (i?.monthly_amount || 0) > 0).map((it, idx) => {
                    const raw = String(it?.name || it?.key || '').trim()
                    const needsRecalc = /##RECALC##/i.test(raw)
                    const clean = raw.replace(/##RECALC##/gi, '').trim()
                    return (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
                        <div className="text-slate-700 text-sm inline-flex items-center gap-1">
                          <span>{clean}</span>
                          {needsRecalc && <Calculator className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="text-right font-medium text-slate-900">{formatCurrency(it.monthly_amount || 0, enhancement.fullQuote!.currency)}</div>
                        <div className="hidden sm:block text-right text-slate-600 text-sm">{enhancement.fullQuote!.currency}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="p-3 bg-slate-50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="flex items-center justify-between"><span className="text-slate-600">Contributions</span><span className="font-medium">{formatCurrency(enhancement.fullQuote.subtotals.contributions || 0, enhancement.fullQuote.currency)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-600">Bonuses</span><span className="font-medium">{formatCurrency(enhancement.fullQuote.subtotals.bonuses || 0, enhancement.fullQuote.currency)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-600">Allowances</span><span className="font-medium">{formatCurrency(enhancement.fullQuote.subtotals.allowances || 0, enhancement.fullQuote.currency)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-600">Termination</span><span className="font-medium">{formatCurrency(enhancement.fullQuote.subtotals.termination || 0, enhancement.fullQuote.currency)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Enhancement Breakdown (legacy delta view) */}
        {enhancement && !compact && (
          <>
            <Separator />
            <EnhancementBreakdown enhancement={enhancement} />
          </>
        )}

        {/* Compact key enhancements summary */}
        {enhancement && compact && enhancement.totalEnhancement > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-600 mb-2">Key Enhancements (monthly)</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {/* Termination monthlyized */}
              {(() => {
                const tc = enhancement.enhancements.terminationCosts
                if (!tc || !tc.totalTerminationCost) return null
                const months = Math.max(1, Number(tc.basedOnContractMonths || 12))
                const monthly = months > 0 ? (tc.totalTerminationCost / months) : 0
                if (monthly <= 0) return null
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Termination</span>
                    <span className="font-medium">{formatCurrency(monthly, getDisplayCurrency())}</span>
                  </div>
                )
              })()}
              {/* 13th salary */}
              {enhancement.enhancements.thirteenthSalary && !enhancement.enhancements.thirteenthSalary.isAlreadyIncluded && (enhancement.enhancements.thirteenthSalary.monthlyAmount || 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">13th Salary</span>
                  <span className="font-medium">{formatCurrency(enhancement.enhancements.thirteenthSalary.monthlyAmount || 0, getDisplayCurrency())}</span>
                </div>
              )}
              {/* Employer contributions (aggregate) */}
              {(() => {
                const extras = enhancement.enhancements.additionalContributions || {}
                const sum = Object.values(extras).reduce((s, n) => s + (Number(n) || 0), 0)
                if (sum <= 0) return null
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Contributions</span>
                    <span className="font-medium">{formatCurrency(sum, getDisplayCurrency())}</span>
                  </div>
                )
              })()}
              {/* Allowances (if present) */}
              {enhancement.enhancements.transportationAllowance && !enhancement.enhancements.transportationAllowance.isAlreadyIncluded && (enhancement.enhancements.transportationAllowance.monthlyAmount || 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Transportation</span>
                  <span className="font-medium">{formatCurrency(enhancement.enhancements.transportationAllowance.monthlyAmount || 0, getDisplayCurrency())}</span>
                </div>
              )}
              {enhancement.enhancements.remoteWorkAllowance && !enhancement.enhancements.remoteWorkAllowance.isAlreadyIncluded && (enhancement.enhancements.remoteWorkAllowance.monthlyAmount || 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Remote Work</span>
                  <span className="font-medium">{formatCurrency(enhancement.enhancements.remoteWorkAllowance.monthlyAmount || 0, getDisplayCurrency())}</span>
                </div>
              )}
              {enhancement.enhancements.mealVouchers && !enhancement.enhancements.mealVouchers.isAlreadyIncluded && (enhancement.enhancements.mealVouchers.monthlyAmount || 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Meal Vouchers</span>
                  <span className="font-medium">{formatCurrency(enhancement.enhancements.mealVouchers.monthlyAmount || 0, getDisplayCurrency())}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Base Quote Information */}
        {!compact && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-slate-700 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Base Provider Quote (monthly)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Base Salary:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      safeNumber(normalizedForDisplay?.baseCost),
                      getDisplayCurrency()
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Additional Costs:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      safeDifference(normalizedForDisplay?.monthlyTotal, normalizedForDisplay?.baseCost),
                      getDisplayCurrency()
                    )}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Warnings */}
        {enhancement?.warnings.length && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-orange-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Important Notes
              </h4>
              <ul className="space-y-1">
                {enhancement.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-orange-600 flex items-start gap-2">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Status indicator component
const StatusIndicator: React.FC<{ status: 'idle' | 'loading' | 'success' | 'error' }> = ({ status }) => {
  switch (status) {
    case 'loading':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Analyzing
        </Badge>
      )
    case 'success':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Enhanced
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      )
    case 'idle':
    default:
      return (
        <Badge variant="secondary" className="bg-slate-100 text-slate-600">
          <Shield className="h-3 w-3 mr-1" />
          Base Quote
        </Badge>
      )
  }
}
