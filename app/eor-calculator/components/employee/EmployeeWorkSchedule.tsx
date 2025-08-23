import { memo, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"
import { FORM_STYLES } from "../../styles/constants"
import { useDebouncedInput } from "../../hooks/useDebouncedInput"
import { useValidationUtils } from "../../hooks/useValidationUtils"
import { isValidNumericFormat } from "@/lib/shared/utils/validationUtils"

interface EmployeeWorkScheduleProps {
  hoursPerDay: string
  daysPerWeek: string
  currency: string
  validationData: ValidationAPIResponse | null
  validationErrors: ValidationErrors
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

export const EmployeeWorkSchedule = memo(({
  hoursPerDay,
  daysPerWeek,
  currency,
  validationData,
  validationErrors,
  onFormUpdate,
  onValidationError
}: EmployeeWorkScheduleProps) => {
  const { validateField, isValidationReady } = useValidationUtils()

  const hoursInput = useDebouncedInput(hoursPerDay, {
    debounceDelay: 300,
    onImmediate: (value: string) => {
      if (isValidNumericFormat(value)) {
        onFormUpdate({ hoursPerDay: value })
        onValidationError('hours', null)
      }
    },
    onValidate: (value: string) => handleHoursValidation(value)
  })

  const daysInput = useDebouncedInput(daysPerWeek, {
    debounceDelay: 300,
    onImmediate: (value: string) => {
      if (isValidNumericFormat(value)) {
        onFormUpdate({ daysPerWeek: value })
        onValidationError('days', null)
      }
    },
    onValidate: (value: string) => handleDaysValidation(value)
  })

  const handleHoursValidation = useCallback((value: string) => {
    if (!value || !isValidationReady()) {
      onValidationError('hours', null)
      return
    }

    const result = validateField('hours', value, 'hours', validationData, currency)
    onValidationError('hours', result.isValid ? null : result.errorMessage || 'Invalid hours per day')
  }, [isValidationReady, validateField, validationData, currency, onValidationError])

  const handleDaysValidation = useCallback((value: string) => {
    if (!value || !isValidationReady()) {
      onValidationError('days', null)
      return
    }

    const result = validateField('days', value, 'days', validationData, currency)
    onValidationError('days', result.isValid ? null : result.errorMessage || 'Invalid days per week')
  }, [isValidationReady, validateField, validationData, currency, onValidationError])

  return (
    <div className="mb-6">
      <div className={`${FORM_STYLES.GRID_3_COL} mb-4`}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Min Hours/Day</Label>
          <Input
            value={validationData?.data.work_schedule.hours.min || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="hoursPerDay"
            className={FORM_STYLES.LABEL_BASE}
          >
            Hours per Day
          </Label>
          <Input
            id="hoursPerDay"
            type="text"
            placeholder="Enter hours per day"
            value={hoursInput.value}
            onChange={(e) => hoursInput.handleChange(e.target.value)}
            onBlur={() => handleHoursValidation(hoursInput.value)}
            className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
              validationErrors.hours ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {validationErrors.hours && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.hours}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Max Hours/Day</Label>
          <Input
            value={validationData?.data.work_schedule.hours.max || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Min Days/Week</Label>
          <Input
            value={validationData?.data.work_schedule.days.min || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="daysPerWeek"
            className={FORM_STYLES.LABEL_BASE}
          >
            Days per Week
          </Label>
          <Input
            id="daysPerWeek"
            type="text"
            placeholder="Enter days per week"
            value={daysInput.value}
            onChange={(e) => daysInput.handleChange(e.target.value)}
            onBlur={() => handleDaysValidation(daysInput.value)}
            className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
              validationErrors.days ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {validationErrors.days && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.days}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Max Days/Week</Label>
          <Input
            value={validationData?.data.work_schedule.days.max || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
    </div>
  )
})

EmployeeWorkSchedule.displayName = 'EmployeeWorkSchedule'
