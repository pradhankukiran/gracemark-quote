import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Calculator, RotateCcw, Loader2, AlertCircle, Trash2 } from "lucide-react"

interface FormActionsProps {
  isCalculating: boolean
  isFormValid: boolean
  error: string | null
  usdConversionError: string | null
  onCalculate: () => void
  onClear: () => void
  onClearStorage?: () => void
  enableComparison: boolean
  isConvertingLocalOffice?: boolean
  isConvertingValidation?: boolean
}

export const FormActions = memo(({
  isCalculating,
  isFormValid,
  error,
  usdConversionError,
  onCalculate,
  onClear,
  onClearStorage,
  enableComparison,
  isConvertingLocalOffice = false,
  isConvertingValidation = false,
}: FormActionsProps) => {
  const isConverting = isConvertingLocalOffice || isConvertingValidation
  const canCalculate = isFormValid && !isConverting

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

      {isConverting && isFormValid && (
        <div className="bg-blue-50 border border-blue-200 p-3 flex items-start gap-3">
          <Loader2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0 animate-spin" />
          <div>
            <p className="text-blue-700 text-sm">Converting currency values, please wait...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 pt-4">
        <div className="flex items-center gap-2">
          {onClearStorage && (
            <Button
              onClick={onClearStorage}
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear Saved Data
            </Button>
          )}
        </div>
        <Button
          onClick={onCalculate}
          disabled={isCalculating || !canCalculate}
          className="w-full sm:w-auto h-12 text-xl font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 cursor-pointer"
        >
          {isCalculating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Calculating Quote...
            </>
          ) : isConverting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-5 w-5" />
              {enableComparison ? "Compare Base Quote" : "Get Base Quote"}
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
