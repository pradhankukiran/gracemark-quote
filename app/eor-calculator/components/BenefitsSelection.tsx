"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Heart, Info } from "lucide-react"
import { BenefitsAPIResponse, Benefit, Provider, Plan } from "../types"

interface BenefitsSelectionProps {
  benefitsData: BenefitsAPIResponse | null
  isLoadingBenefits: boolean
  benefitsError: string | null
  selectedBenefits: {
    [key: string]: string | undefined
  }
  onBenefitChange: (benefitType: string, planId: string | undefined) => void
}

export const BenefitsSelection = ({
  benefitsData,
  isLoadingBenefits,
  benefitsError,
  selectedBenefits,
  onBenefitChange,
}: BenefitsSelectionProps) => {
  // Cache blob URLs by attachment URL to prevent duplicate fetches
  const blobCacheRef = React.useRef<Map<string, string>>(new Map())
  
  // Track loading states for each attachment
  const [loadingAttachments, setLoadingAttachments] = React.useState<Set<string>>(new Set())

  // Cleanup blob URLs when component unmounts
  React.useEffect(() => {
    return () => {
      blobCacheRef.current.forEach(blobUrl => URL.revokeObjectURL(blobUrl))
      blobCacheRef.current.clear()
    }
  }, [])

  const openPDFInNewTab = async (attachmentUrl: string, attachmentLabel: string) => {
    // Check if we already have this PDF cached
    if (blobCacheRef.current.has(attachmentUrl)) {
      const cachedBlobUrl = blobCacheRef.current.get(attachmentUrl)!
      window.open(cachedBlobUrl, '_blank')
      return
    }

    try {
      // Set loading state
      setLoadingAttachments(prev => new Set(prev).add(attachmentUrl))

      // Fetch PDF as blob
      const response = await fetch(attachmentUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(blob)
      
      // Cache the blob URL
      blobCacheRef.current.set(attachmentUrl, blobUrl)
      
      // Open in new tab with a descriptive title
      const newTab = window.open(blobUrl, '_blank')
      
      if (newTab) {
        // Set a more descriptive title for the new tab
        newTab.document.title = attachmentLabel || 'PDF Document'
      }
      
      // Clean up this specific blob URL after 30 minutes
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
        blobCacheRef.current.delete(attachmentUrl)
      }, 30 * 60 * 1000) // 30 minutes
      
    } catch (error) {
      console.error('Error opening PDF:', error)
      // Fallback to direct link if blob approach fails
      window.open(attachmentUrl, '_blank')
    } finally {
      // Clear loading state
      setLoadingAttachments(prev => {
        const newSet = new Set(prev)
        newSet.delete(attachmentUrl)
        return newSet
      })
    }
  }
  if (isLoadingBenefits) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-full">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Employee Benefits</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
          <span className="text-slate-600">Loading country benefits data...</span>
        </div>
      </div>
    )
  }

  if (benefitsError) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-full">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Employee Benefits</h2>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="text-yellow-800 font-medium">Benefits data unavailable</h5>
              <p className="text-yellow-700 text-sm mt-1">{benefitsError}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!benefitsData || !benefitsData.data || benefitsData.data.length === 0) {
    return null
  }

  const getBenefitKey = (benefitName: string): string => {
    return benefitName.toLowerCase().replace(/\s+/g, "_")
  }

  const renderBenefit = (benefit: Benefit) => {
    const benefitKey = getBenefitKey(benefit.name)
    const selectedPlanId = selectedBenefits[benefitKey]
    const isPension = benefit.name.toLowerCase() === 'pension'

    return (
      <div key={benefit.name} className="mb-6 last:mb-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-base font-semibold text-slate-700 uppercase tracking-wide">{benefit.name}</h3>
          <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
            benefit.is_mandatory 
              ? "bg-red-100 text-red-800" 
              : "bg-slate-100 text-slate-800"
          }`}>
            {benefit.is_mandatory ? "Mandatory" : "Optional"}
          </span>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">{benefit.description}</p>

        <div className="space-y-4">
          {benefit.providers.map((provider: Provider) => (
            <div key={provider.id}>
              <h4 className="text-sm font-medium text-slate-600 mb-3">{provider.name}</h4>
              
                <div className="grid gap-3">
                  {provider.plans.map((plan: Plan) => {
                    const planId = plan.id
                    const isSelected = selectedPlanId === planId
                    const isDisabled = benefit.is_mandatory && selectedPlanId && selectedPlanId !== planId

                    return (
                      <div 
                        key={planId} 
                        className={`border-2 rounded-md p-3 transition-all duration-200 ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : isDisabled
                            ? 'border-slate-200 bg-slate-50 opacity-50'
                            : 'border-slate-200 hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <input
                            type="radio"
                            id={planId}
                            name={benefitKey}
                            value={planId}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => {}} // onClick on parent div handles it
                            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 mt-1"
                          />
                          <Label 
                            htmlFor={planId}
                            className={`flex-1 cursor-pointer ${
                              isDisabled ? 'text-slate-400' : 'text-slate-700'
                            }`}
                            onClick={() => {
                              if (isDisabled) return;
                              
                              // For mandatory benefits: always select the clicked plan
                              if (benefit.is_mandatory) {
                                onBenefitChange(benefitKey, planId);
                              } else {
                                // For optional benefits: toggle selection (unselect if already selected)
                                if (isSelected) {
                                  onBenefitChange(benefitKey, undefined);
                                } else {
                                  onBenefitChange(benefitKey, planId);
                                }
                              }
                            }}>
                            <div className="w-full">
                              <div className="flex items-center justify-between w-full mb-2">
                                <span className="font-medium">{plan.name}</span>
                                <span className="text-sm font-semibold">
                                  {plan.price > 0 ? `${provider.currency} ${plan.price.toFixed(2)}` : 'Included'}
                                </span>
                              </div>
                              
                              {/* Show attachments as text links */}
                              {plan.attachments.length > 0 && (
                                <div className="mb-2">
                                  {plan.attachments.map(attachment => {
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
                                        onClick={(e) => {
                                          // Comprehensive event stopping
                                          e.preventDefault()
                                          e.stopPropagation()
                                          e.nativeEvent.stopImmediatePropagation()
                                          
                                          if (!isLoading) {
                                            openPDFInNewTab(attachment.url, attachment.label)
                                          }
                                        }}
                                      >
                                        {isLoading ? (
                                          <>⏳ Opening {attachment.label}...</>
                                        ) : (
                                          <>📋 {attachment.label}{isCached ? ' ⚡' : ''}</>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                              
                              {/* Show pension contribution information if available */}
                              {isPension && (provider.min_contribution || provider.max_contribution) && (
                                <div className="bg-primary/5 p-3 rounded-md border border-primary/20 mb-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Info className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold text-primary">
                                      Employer Contribution: {provider.min_contribution}%
                                      {provider.max_contribution && provider.max_contribution !== provider.min_contribution && ` - ${provider.max_contribution}%`}
                                    </span>
                                  </div>
                                  {provider.client_info && (
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                      {provider.client_info}
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {/* Show provider website if available */}
                              {provider.home_page_url && (
                                <div className="text-xs text-slate-500">
                                  Provider: <a 
                                    href={provider.home_page_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {provider.name}
                                  </a>
                                </div>
                              )}
                            </div>
                          </Label>
                        </div>
                      </div>
                    )
                  })}
                </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Employee Benefits</h2>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Select benefit plans for the employee. Mandatory benefits must have a selection.
      </p>
      <div className="space-y-6">
        {benefitsData.data.map(renderBenefit)}
      </div>
    </div>
  )
}