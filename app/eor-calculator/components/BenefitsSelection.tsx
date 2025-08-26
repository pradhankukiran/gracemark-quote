"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info, Gift, Loader2, ChevronUp } from "lucide-react"
import { BenefitsAPIResponse, Benefit, SelectedBenefit } from "@/lib/shared/types"
import { LoadingSpinner } from "./shared/LoadingSpinner"
import { ErrorDisplay } from "./shared/ErrorDisplay"
import { SmoothReveal } from "./shared/OptimizedReveal"
import { FormSectionHeader } from "./shared/FormSectionHeader"

interface BenefitsSelectionProps {
  benefitsData: BenefitsAPIResponse | null
  isLoadingBenefits: boolean
  benefitsError: string | null
  selectedBenefits: {
    [key: string]: SelectedBenefit | undefined
  }
  onBenefitChange: (benefitType: string, benefitData: SelectedBenefit | undefined) => void
}

export const BenefitsSelection = React.memo(({
  benefitsData,
  isLoadingBenefits,
  benefitsError,
  selectedBenefits,
  onBenefitChange,
}: BenefitsSelectionProps) => {
  const blobCacheRef = React.useRef<Map<string, string>>(new Map())
  const [loadingAttachments, setLoadingAttachments] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    return () => {
      blobCacheRef.current.forEach(blobUrl => URL.revokeObjectURL(blobUrl))
      // eslint-disable-next-line react-hooks/exhaustive-deps
      blobCacheRef.current.clear()
    }
  }, [])

  const openPDFInNewTab = React.useCallback(async (attachmentUrl: string, attachmentLabel: string) => {
    if (blobCacheRef.current.has(attachmentUrl)) {
      const cachedBlobUrl = blobCacheRef.current.get(attachmentUrl)!
      window.open(cachedBlobUrl, '_blank')
      return
    }
    try {
      setLoadingAttachments(prev => new Set(prev).add(attachmentUrl))
      const response = await fetch(attachmentUrl)
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      blobCacheRef.current.set(attachmentUrl, blobUrl)
      const newTab = window.open(blobUrl, '_blank')
      if (newTab) newTab.document.title = attachmentLabel || 'PDF Document'
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
        blobCacheRef.current.delete(attachmentUrl)
      }, 30 * 60 * 1000)
    } catch (error) {
      console.error('Error opening PDF:', error)
      window.open(attachmentUrl, '_blank')
    } finally {
      setLoadingAttachments(prev => {
        const newSet = new Set(prev)
        newSet.delete(attachmentUrl)
        return newSet
      })
    }
  }, [])

  const getBenefitKey = React.useCallback((benefitName: string): string => {
    return benefitName.toLowerCase().replace(/\s+/g, "_")
  }, [])

  const renderBenefit = React.useCallback((benefit: Benefit) => {
    const benefitKey = getBenefitKey(benefit.name)
    const selectedBenefit = selectedBenefits[benefitKey]
    const selectedPlanId = selectedBenefit?.planId
    const isPension = benefit.name.toLowerCase() === 'pension'

    const allPlans = benefit.providers.flatMap(provider => 
      provider.plans.map(plan => ({ ...plan, provider }))
    )
    
    const selectedPlanDetails = allPlans.find(p => p.id === selectedPlanId)

    return (
      <div key={benefit.name} className="space-y-3">
        <div className="flex items-center gap-3">
          <Label htmlFor={benefitKey} className="text-base font-semibold text-slate-700 uppercase tracking-wide">
            {benefit.name}
          </Label>
          <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
            benefit.is_mandatory 
              ? "bg-red-100 text-red-800" 
              : "bg-slate-100 text-slate-800"
          }`}>
            {benefit.is_mandatory ? "Mandatory" : "Optional"}
          </span>
        </div>
        <p className="text-sm text-slate-600">{benefit.description}</p>
        
        <Select
          value={selectedPlanId || "none"}
          onValueChange={(value) => {
            if (value === "none") {
              onBenefitChange(benefitKey, undefined)
            } else {
              const selectedPlan = allPlans.find(p => p.id === value)
              if (selectedPlan) {
                const benefitData: SelectedBenefit = {
                  planId: selectedPlan.id,
                  planName: selectedPlan.name,
                  providerId: selectedPlan.provider.id,
                  providerName: selectedPlan.provider.name,
                  price: selectedPlan.price,
                  currency: selectedPlan.provider.currency,
                  isMandatory: benefit.is_mandatory,
                  benefitName: benefit.name
                }
                onBenefitChange(benefitKey, benefitData)
              }
            }
          }}
          disabled={benefit.is_mandatory && allPlans.length === 1}
        >
          <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {!benefit.is_mandatory && (
              <SelectItem value="none">No Plan</SelectItem>
            )}
            {allPlans.map(plan => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name} ({plan.provider.name}) - {plan.price > 0 ? `${plan.provider.currency} ${plan.price.toFixed(2)}` : 'Included'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPlanDetails && (
          <div className="bg-slate-50 border-2 border-slate-200 rounded-md p-3 mt-2 space-y-3">
            {selectedPlanDetails.attachments.length > 0 && (
              <div>
                {selectedPlanDetails.attachments.map(attachment => {
                  const isLoading = loadingAttachments.has(attachment.url)
                  const isCached = blobCacheRef.current.has(attachment.url)
                  return (
                    <button
                      key={attachment.id}
                      type="button"
                      disabled={isLoading}
                      className={`text-sm block transition-colors ${
                        isLoading 
                          ? 'text-slate-400 cursor-not-allowed' 
                          : 'text-primary hover:underline cursor-pointer'
                      }`}
                      onClick={() => !isLoading && openPDFInNewTab(attachment.url, attachment.label)}
                    >
                      {isLoading ? `⏳ Opening ${attachment.label}...` : `📋 ${attachment.label}${isCached ? ' ⚡' : ''}`}
                    </button>
                  )
                })}
              </div>
            )}

            {isPension && (selectedPlanDetails.provider.min_contribution || selectedPlanDetails.provider.max_contribution) && (
              <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    Employer Contribution: {selectedPlanDetails.provider.min_contribution}%
                    {selectedPlanDetails.provider.max_contribution && selectedPlanDetails.provider.max_contribution !== selectedPlanDetails.provider.min_contribution && ` - ${selectedPlanDetails.provider.max_contribution}%`}
                  </span>
                </div>
                {selectedPlanDetails.provider.client_info && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {selectedPlanDetails.provider.client_info}
                  </p>
                )}
              </div>
            )}

            {selectedPlanDetails.provider.home_page_url && (
              <div className="text-sm text-slate-500">
                Provider: <a 
                  href={selectedPlanDetails.provider.home_page_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {selectedPlanDetails.provider.name}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }, [getBenefitKey, onBenefitChange, openPDFInNewTab, selectedBenefits, loadingAttachments])

  const [isExpanded, setIsExpanded] = React.useState(true)
  const hasData = !!benefitsData?.data?.length
  const showContent = isExpanded && !isLoadingBenefits && !benefitsError && hasData
  const showError = isExpanded && !isLoadingBenefits && !!benefitsError

  return (
    <div>
      <div
        className="flex items-center justify-between cursor-pointer p-2 -m-2 rounded-md hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <FormSectionHeader icon={Gift} title="Benefits Package" />
        <div className="flex items-center gap-4">
          {isLoadingBenefits && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          <ChevronUp className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${!isExpanded && "rotate-180"}`} />
        </div>
      </div>

      <SmoothReveal isVisible={showContent}>
        <div className="mt-4 p-4 bg-slate-50 border-2 border-slate-200 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefitsData?.data.map(renderBenefit)}
          </div>
        </div>
      </SmoothReveal>

      <SmoothReveal isVisible={showError}>
        <div className="mt-4">
          <ErrorDisplay title="Benefits data unavailable" message={benefitsError!} />
        </div>
      </SmoothReveal>
    </div>
  )
})

BenefitsSelection.displayName = 'BenefitsSelection'