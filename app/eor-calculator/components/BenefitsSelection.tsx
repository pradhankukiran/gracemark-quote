"use client"

import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Heart, Paperclip, Info } from "lucide-react"
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
              
              {isPension && (provider.min_contribution || provider.max_contribution) ? (
                <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                  <div className="flex items-center">
                    <Info className="h-5 w-5 text-slate-500 mr-3" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        Employer Contribution: {provider.min_contribution}%
                        {provider.max_contribution && provider.max_contribution !== provider.min_contribution && ` - ${provider.max_contribution}%`}
                      </p>
                      {provider.client_info && <p className="text-xs text-slate-500 mt-1">{provider.client_info}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {provider.plans.map((plan: Plan) => {
                    const planId = plan.id
                    const isSelected = selectedPlanId === planId
                    const isDisabled = benefit.is_mandatory && selectedPlanId && selectedPlanId !== planId

                    return (
                      <div 
                        key={planId} 
                        className={`border-2 rounded-md p-3 transition-all duration-200 cursor-pointer ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : isDisabled
                            ? 'border-slate-200 bg-slate-50 opacity-50'
                            : 'border-slate-200 hover:border-primary/50'
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
                        }}
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
                            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 mt-1 pointer-events-none"
                          />
                          <Label 
                            className={`flex-1 cursor-pointer ${
                              isDisabled ? 'text-slate-400' : 'text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{plan.name}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-semibold">
                                  {plan.price > 0 ? `${provider.currency} ${plan.price.toFixed(2)}` : 'Included'}
                                </span>
                                {plan.attachments.length > 0 && (
                                  <div className="flex items-center gap-2 text-slate-500">
                                    {plan.attachments.map(attachment => (
                                      <a
                                        key={attachment.id}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={attachment.label}
                                        className="hover:text-primary"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Paperclip className="h-4 w-4" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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