"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Heart } from "lucide-react"

interface RetrieveBenefitsButtonProps {
  countryName: string
  isLoading: boolean
  canFetch: boolean
  onFetchBenefits: () => void
  onSkipBenefits: () => void
}

export const RetrieveBenefitsButton = ({
  countryName,
  isLoading,
  canFetch,
  onFetchBenefits,
  onSkipBenefits,
}: RetrieveBenefitsButtonProps) => {

  return (
    <div className="text-center py-6">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Employee Benefits</h3>
      </div>
      
      <p className="text-slate-600 mb-6 max-w-md mx-auto">
        {canFetch ? (
          <>Ready to load benefit options for your employee in <span className="font-semibold">{countryName}</span>?</>
        ) : (
          <>Complete the employee information above to load benefit options{countryName ? <> for <span className="font-semibold">{countryName}</span></> : null}</>
        )}
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={onFetchBenefits}
          disabled={isLoading || !canFetch}
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
              Retrieve Benefits{countryName ? ` for ${countryName}` : ''}
            </>
          )}
        </Button>
        
        <Button
          onClick={onSkipBenefits}
          disabled={isLoading || !canFetch}
          variant="outline"
          size="lg"
          className="px-8 py-3 text-base font-medium"
        >
          Skip Benefits
        </Button>
      </div>
    </div>
  )
}