import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Calculator, RotateCcw, AlertCircle, Loader2 } from "lucide-react"

interface FormActionsProps {
  isCalculating: boolean
  isFormValid: boolean
  error: string | null
  onCalculate: () => void
  onClear: () => void
}

export const FormActions = memo(({
  isCalculating,
  isFormValid,
  error,
  onCalculate,
  onClear,
}: FormActionsProps) => {
  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-800">Calculation Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Form Validation Status */}
      {!isFormValid && !error && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-yellow-800">Form Incomplete</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Please fill in all required fields to calculate your quote.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4">
        <Button
          onClick={onCalculate}
          disabled={!isFormValid || isCalculating}
          size="lg"
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 px-10 text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none cursor-pointer"
        >
          {isCalculating ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Calculating Quote...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate Quote
            </div>
          )}
        </Button>

        <Button
          onClick={onClear}
          variant="outline"
          size="lg"
          disabled={isCalculating}
          className="w-full sm:w-auto border-2 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-4 px-10 text-lg shadow-lg hover:shadow-xl transition-all duration-200 bg-transparent cursor-pointer"
        >
          <RotateCcw className="h-5 w-5 mr-2" />
          Clear Form
        </Button>
      </div>

      {/* Calculation Info */}
      <div className="text-center text-sm text-slate-500 pt-2">
        Based on 160 working hours per month (8 hours × 5 days × 4 weeks)
      </div>
    </div>
  )
})

FormActions.displayName = 'FormActions'