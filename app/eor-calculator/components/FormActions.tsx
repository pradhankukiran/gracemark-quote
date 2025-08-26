import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Calculator, RotateCcw, Loader2, AlertCircle } from "lucide-react"

interface FormActionsProps {
  isCalculating: boolean
  isFormValid: boolean
  error: string | null
  usdConversionError: string | null
  onCalculate: () => void
  onClear: () => void
}

export const FormActions = memo(({
  isCalculating,
  isFormValid,
  error,
  usdConversionError,
  onCalculate,
  onClear,
}: FormActionsProps) => {
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-red-800 font-medium">Error calculating quote</h4>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {usdConversionError && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-yellow-800 font-medium">USD conversion warning</h4>
            <p className="text-yellow-700 text-sm mt-1">{usdConversionError}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 pt-4">
        <div className="hidden sm:block"></div>
        <Button
          onClick={onCalculate}
          disabled={isCalculating || !isFormValid}
          className="w-full sm:w-auto h-12 text-xl font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 cursor-pointer"
        >
          {isCalculating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Calculating Quote...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-5 w-5" />
              Get Quote
            </>
          )}
        </Button>
        <Button
          onClick={onClear}
          variant="outline"
          className="w-full sm:w-auto h-12 text-xl font-semibold border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl transition-all duration-200 px-8 bg-transparent cursor-pointer"
        >
          <RotateCcw className="mr-2 h-5 w-5" />
          Clear
        </Button>
      </div>
    </div>
  )
});

FormActions.displayName = 'FormActions';