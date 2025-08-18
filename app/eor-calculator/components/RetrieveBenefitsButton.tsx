"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Heart } from "lucide-react"

interface RetrieveBenefitsButtonProps {
  countryName: string
  isLoading: boolean
  canFetch: boolean
  onFetchBenefits: () => void
}

export const RetrieveBenefitsButton = ({
  countryName,
  isLoading,
  canFetch,
  onFetchBenefits,
}: RetrieveBenefitsButtonProps) => {
  if (!canFetch) {
    return null
  }

  return (
    <div className="text-center py-6">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Employee Benefits</h3>
      </div>
      
      <p className="text-slate-600 mb-6 max-w-md mx-auto">
        Ready to load benefit options for your employee in <span className="font-semibold">{countryName}</span>?
      </p>
      
      <Button
        onClick={onFetchBenefits}
        disabled={isLoading}
        size="lg"
        className="px-8 py-3 text-base font-medium"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading Benefits...
          </>
        ) : (
          <>
            <Heart className="h-5 w-5 mr-2" />
            Retrieve Benefits for {countryName}
          </>
        )}
      </Button>
    </div>
  )
}