import { memo, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "../../types"
import { FORM_STYLES } from "../../styles/constants"
import { useDebouncedInput } from "../../hooks/useDebouncedInput"
import { useValidationUtils } from "../../hooks/useValidationUtils"
import { isValidNumericFormat } from "../../utils/validationUtils"

interface EmployeeProbationProps {
  formData: EORFormData
  validationData: ValidationAPIResponse | null
  validationErrors: ValidationErrors
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

export const EmployeeProbation = memo(({
  formData,
  validationData,
  validationErrors,
  onFormUpdate,
  onValidationError
}: EmployeeProbationProps) => {
  const { validateField, isValidationReady } = useValidationUtils()

  // Debounced input for probation period
  const probationInput = useDebouncedInput(formData.probationPeriod, {
    debounceDelay: 300,
    onImmediate: (value: string) => {
      if (isValidNumericFormat(value)) {
        onFormUpdate({ probationPeriod: value })
        onValidationError('probation', null)
      }
    },
    onValidate: (value: string) => handleProbationValidation(value)
  })

  const handleProbationValidation = useCallback((value: string) => {
    if (!value || !isValidationReady()) {
      onValidationError('probation', null)
      return
    }

    const result = validateField('probation', value, 'probation', validationData, formData.currency)
    onValidationError('probation', result.isValid ? null : result.errorMessage || 'Invalid probation period')
  }, [isValidationReady, validateField, validationData, formData.currency, onValidationError])

  // Only show probation section if validation data has probation info
  if (!validationData?.data.probation.min && !validationData?.data.probation.max) {
    return null
  }

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Minimum Probation</Label>
          <Input
            value={validationData?.data.probation.min || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="probationPeriod"
            className={FORM_STYLES.LABEL_BASE}
          >
            Probation Period
          </Label>
          <Input
            id="probationPeriod"
            type="text"
            placeholder="Enter probation period in days"
            value={probationInput.value}
            onChange={(e) => probationInput.handleChange(e.target.value)}
            onBlur={() => handleProbationValidation(probationInput.value)}
            className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
              validationErrors.probation ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {validationErrors.probation && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.probation}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Maximum Probation</Label>
          <Input
            value={validationData?.data.probation.max || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
    </div>
  )
})

EmployeeProbation.displayName = 'EmployeeProbation'