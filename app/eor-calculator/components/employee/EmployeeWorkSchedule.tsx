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

  const handleHoursValidation = useCallback((value: string) => {
    if (!value || !isValidationReady()) {
      onValidationError('hours', null)
      return
    }

    validateField('hours', value, 'hours', validationData, currency, onValidationError)
  }, [isValidationReady, validateField, validationData, currency, onValidationError])

  const handleDaysValidation = useCallback((value: string) => {
    if (!value || !isValidationReady()) {
      onValidationError('days', null)
      return
    }

    validateField('days', value, 'days', validationData, currency, onValidationError)
  }, [isValidationReady, validateField, validationData, currency, onValidationError])

  const debouncedHours = useDebouncedInput(
    hoursPerDay || "",
    {
      onImmediate: (value: string) => {
        if (isValidNumericFormat(value)) {
          onFormUpdate({ hoursPerDay: value })
          onValidationError('hours', null)
        }
      },
      onValidate: (value: string) => handleHoursValidation(value)
    }
  )

  const debouncedDays = useDebouncedInput(
    daysPerWeek || "",
    {
      onImmediate: (value: string) => {
        if (isValidNumericFormat(value)) {
          onFormUpdate({ daysPerWeek: value })
          onValidationError('days', null)
        }
      },
      onValidate: (value: string) => handleDaysValidation(value)
    }
  )

  return (
    <div className="mb-6">
      <div className={`${FORM_STYLES.GRID_3_COL} mb-4`}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Min Hours/Day</Label>
          <Input
            value={validationData?.data?.work_schedule?.hours?.min || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="hoursPerDay"
            className={FORM_STYLES.LABEL_BASE}
          >
            Hours per Day <span className="text-slate-400 font-normal">(Optional)</span>
          </Label>
          <Input
            id="hoursPerDay"
            type="text"
            placeholder="Optional - leave empty for default (8 hours)"
            value={debouncedHours.value}
            onChange={(e) => debouncedHours.handleChange(e.target.value)}
            onBlur={() => handleHoursValidation(debouncedHours.value)}
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
            value={validationData?.data?.work_schedule?.hours?.max || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>Min Days/Week</Label>
          <Input
            value={validationData?.data?.work_schedule?.days?.min || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="daysPerWeek"
            className={FORM_STYLES.LABEL_BASE}
          >
            Days per Week <span className="text-slate-400 font-normal">(Optional)</span>
          </Label>
          <Input
            id="daysPerWeek"
            type="text"
            placeholder="Optional - leave empty for default (5 days)"
            value={debouncedDays.value}
            onChange={(e) => debouncedDays.handleChange(e.target.value)}
            onBlur={() => handleDaysValidation(debouncedDays.value)}
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
            value={validationData?.data?.work_schedule?.days?.max || "Not specified"}
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
    </div>
  )
})

EmployeeWorkSchedule.displayName = 'EmployeeWorkSchedule'
