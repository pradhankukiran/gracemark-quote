import { memo, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"
import { FORM_STYLES } from "../../styles/constants"
import { useDebouncedInput } from "../../hooks/useDebouncedInput"
import { useValidationUtils } from "../../hooks/useValidationUtils"
import { isValidNumericFormat } from "@/lib/shared/utils/validationUtils"

interface EmployeeHolidaysProps {
  holidayDays: string
  currency: string
  validationData: ValidationAPIResponse | null
  validationErrors: ValidationErrors
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

export const EmployeeHolidays = memo(({
  holidayDays,
  currency,
  validationData,
  validationErrors,
  onFormUpdate,
  onValidationError
}: EmployeeHolidaysProps) => {
  const { validateField, isValidationReady } = useValidationUtils()

  const holidaysInput = useDebouncedInput(holidayDays, {
    debounceDelay: 300,
    onImmediate: (value: string) => {
      if (isValidNumericFormat(value)) {
        onFormUpdate({ holidayDays: value })
        onValidationError('holidays', null)
      }
    },
    onValidate: (value: string) => handleHolidaysValidation(value)
  })

  const handleHolidaysValidation = useCallback((value: string) => {
    if (!value || !isValidationReady()) {
      onValidationError('holidays', null)
      return
    }

    const result = validateField('holidays', value, 'holiday', validationData, currency)
    onValidationError('holidays', result.isValid ? null : result.errorMessage || 'Invalid holiday days')
  }, [isValidationReady, validateField, validationData, currency, onValidationError])

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Minimum Holidays</Label>
          <Input
            value={validationData?.data.holiday.min || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="holidayDays"
            className={FORM_STYLES.LABEL_BASE}
          >
            Holiday Days
          </Label>
          <Input
            id="holidayDays"
            type="text"
            placeholder="Enter number of holidays"
            value={holidaysInput.value}
            onChange={(e) => holidaysInput.handleChange(e.target.value)}
            onBlur={() => handleHolidaysValidation(holidaysInput.value)}
            className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
              validationErrors.holidays ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {validationErrors.holidays && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.holidays}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Maximum Holidays</Label>
          <Input
            value={validationData?.data.holiday.max || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
    </div>
  )
})

EmployeeHolidays.displayName = 'EmployeeHolidays'
