import { memo } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Settings } from "lucide-react"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"
import { FormSectionHeader } from "../shared/FormSectionHeader"
import { EmployeeWorkSchedule } from "./EmployeeWorkSchedule"
import { EmployeeHolidays } from "./EmployeeHolidays"
import { EmployeeProbation } from "./EmployeeProbation"

interface OptionalEmployeeDataSectionProps {
  showOptionalEmployeeData: boolean
  hoursPerDay: string
  daysPerWeek: string
  holidayDays: string
  probationPeriod: string
  currency: string
  validationData: ValidationAPIResponse | null
  validationErrors: ValidationErrors
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

// Custom comparison function for better memoization
const arePropsEqual = (
  prevProps: OptionalEmployeeDataSectionProps,
  nextProps: OptionalEmployeeDataSectionProps
): boolean => {
  // Compare primitive values
  if (
    prevProps.showOptionalEmployeeData !== nextProps.showOptionalEmployeeData ||
    prevProps.hoursPerDay !== nextProps.hoursPerDay ||
    prevProps.daysPerWeek !== nextProps.daysPerWeek ||
    prevProps.holidayDays !== nextProps.holidayDays ||
    prevProps.probationPeriod !== nextProps.probationPeriod ||
    prevProps.currency !== nextProps.currency
  ) {
    return false
  }

  // Compare callback references (they should be memoized from parent)
  if (
    prevProps.onFormUpdate !== nextProps.onFormUpdate ||
    prevProps.onValidationError !== nextProps.onValidationError
  ) {
    return false
  }

  // Deep compare validationData
  if (prevProps.validationData !== nextProps.validationData) {
    // If both are null/undefined, they're equal
    if (!prevProps.validationData && !nextProps.validationData) {
      return true
    }
    // If one is null and the other isn't, they're different
    if (!prevProps.validationData || !nextProps.validationData) {
      return false
    }
    // Compare the actual validation data structure
    if (
      JSON.stringify(prevProps.validationData.data) !== 
      JSON.stringify(nextProps.validationData.data)
    ) {
      return false
    }
  }

  // Deep compare validationErrors
  if (JSON.stringify(prevProps.validationErrors) !== JSON.stringify(nextProps.validationErrors)) {
    return false
  }

  return true
}

export const OptionalEmployeeDataSection = memo(({
  showOptionalEmployeeData,
  hoursPerDay,
  daysPerWeek,
  holidayDays,
  probationPeriod,
  currency,
  validationData,
  validationErrors,
  onFormUpdate,
  onValidationError,
}: OptionalEmployeeDataSectionProps) => {
  return (
    <div>
      <FormSectionHeader icon={Settings} title="Employee Details (Optional)" />

      <div className="space-y-4">
        <Label
          htmlFor="showOptionalEmployeeData"
          className={`
            flex items-center space-x-4 p-4 border-2 rounded-md cursor-pointer transition-all duration-200
            ${
              showOptionalEmployeeData
                ? 'border-primary bg-primary/5'
                : 'border-slate-200 hover:border-primary/50'
            }
          `}
        >
          <Checkbox
            id="showOptionalEmployeeData"
            checked={showOptionalEmployeeData}
            onCheckedChange={(checked) => {
              onFormUpdate({
                showOptionalEmployeeData: checked as boolean,
                hoursPerDay: checked ? hoursPerDay : "",
                daysPerWeek: checked ? daysPerWeek : "",
                holidayDays: checked ? holidayDays : "",
                probationPeriod: checked ? probationPeriod : "",
              })
            }}
            className="h-5 w-5"
          />
          <span className="text-base font-medium text-slate-800">
            Specify detailed employee information (optional)?
          </span>
        </Label>

        {showOptionalEmployeeData && (
          <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-md space-y-6">
            <EmployeeWorkSchedule
              hoursPerDay={hoursPerDay}
              daysPerWeek={daysPerWeek}
              currency={currency}
              validationData={validationData}
              validationErrors={validationErrors}
              onFormUpdate={onFormUpdate}
              onValidationError={onValidationError}
            />
            
            <EmployeeHolidays
              holidayDays={holidayDays}
              currency={currency}
              validationData={validationData}
              validationErrors={validationErrors}
              onFormUpdate={onFormUpdate}
              onValidationError={onValidationError}
            />
            
            <EmployeeProbation
              probationPeriod={probationPeriod}
              currency={currency}
              validationData={validationData}
              validationErrors={validationErrors}
              onFormUpdate={onFormUpdate}
              onValidationError={onValidationError}
            />
          </div>
        )}
      </div>
    </div>
  )
}, arePropsEqual)

OptionalEmployeeDataSection.displayName = 'OptionalEmployeeDataSection'