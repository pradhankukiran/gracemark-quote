import { memo, useMemo } from "react"
import { User } from "lucide-react"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "../types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { LoadingSpinner } from "./shared/LoadingSpinner"
import { ErrorDisplay } from "./shared/ErrorDisplay"
import { SmoothReveal } from "./shared/AnimatedReveal"

// Import optimized sub-components
import { EmployeeBasicInfo } from "./employee/EmployeeBasicInfo"
import { EmployeeLocationInfo } from "./employee/EmployeeLocationInfo"
import { EmployeeSalaryInfo } from "./employee/EmployeeSalaryInfo"
import { EmployeeHolidays } from "./employee/EmployeeHolidays"
import { EmployeeProbation } from "./employee/EmployeeProbation"
import { EmployeeWorkSchedule } from "./employee/EmployeeWorkSchedule"

interface OptimizedEmployeeInfoFormProps {
  formData: EORFormData
  countries: string[]
  validationData: ValidationAPIResponse | null
  validationError: string | null
  isLoadingValidations: boolean
  validationErrors: ValidationErrors
  convertedValidation: {
    minSalary?: string
    maxSalary?: string
    currency?: string
  }
  isConvertingValidation: boolean
  isValidationReady: boolean
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
  onCurrencyOverride: (currency: string, conversionInfoCallback?: (info: string) => void) => void
  onCurrencyReset: () => void
  onCountryChange?: (country: string) => void
}

export const OptimizedEmployeeInfoForm = memo(({
  formData,
  countries,
  validationData,
  validationError,
  isLoadingValidations,
  validationErrors,
  convertedValidation,
  isConvertingValidation,
  isValidationReady,
  onFormUpdate,
  onValidationError,
  onCurrencyOverride,
  onCurrencyReset,
  onCountryChange
}: OptimizedEmployeeInfoFormProps) => {
  
  // Memoize the validation-dependent sections to prevent unnecessary re-renders
  const hasValidationData = useMemo(() => 
    validationData && !isLoadingValidations, 
    [validationData, isLoadingValidations]
  )

  const hasProbationData = useMemo(() => 
    validationData?.data.probation.min || validationData?.data.probation.max,
    [validationData?.data.probation.min, validationData?.data.probation.max]
  )

  // Use provided country change handler or fallback to default
  const handleCountryChange = onCountryChange || ((country: string) => onFormUpdate({ country }))

  return (
    <div>
      <FormSectionHeader icon={User} title="Employee Information" />
      
      {/* Employee Basic Information - Always visible */}
      <EmployeeBasicInfo
        formData={formData}
        onFormUpdate={onFormUpdate}
      />

      {/* Location, Currency & Work Visa */}
      <EmployeeLocationInfo
        formData={formData}
        countries={countries}
        onFormUpdate={onFormUpdate}
        onCountryChange={handleCountryChange}
        onCurrencyOverride={onCurrencyOverride}
        onCurrencyReset={onCurrencyReset}
      />

      {/* Validation Loading/Error States */}
      {isLoadingValidations && (
        <LoadingSpinner message="Loading country validation data..." />
      )}

      {validationError && (
        <ErrorDisplay 
          title="Validation data unavailable" 
          message={validationError} 
        />
      )}

      {/* Salary Information - Only show when validation data is available */}
      <SmoothReveal isVisible={hasValidationData}>
        <EmployeeSalaryInfo
          formData={formData}
          validationData={validationData}
          validationErrors={validationErrors}
          convertedValidation={convertedValidation}
          isConvertingValidation={isConvertingValidation}
          isValidationReady={isValidationReady}
          onFormUpdate={onFormUpdate}
          onValidationError={onValidationError}
        />
      </SmoothReveal>

      {/* Holiday Information - Only show when validation data is available */}
      <SmoothReveal isVisible={hasValidationData}>
        <EmployeeHolidays
          formData={formData}
          validationData={validationData}
          validationErrors={validationErrors}
          onFormUpdate={onFormUpdate}
          onValidationError={onValidationError}
        />
      </SmoothReveal>

      {/* Probation Period - Only show when validation data has probation info */}
      <SmoothReveal isVisible={hasValidationData && !!hasProbationData}>
        <EmployeeProbation
          formData={formData}
          validationData={validationData}
          validationErrors={validationErrors}
          onFormUpdate={onFormUpdate}
          onValidationError={onValidationError}
        />
      </SmoothReveal>

      {/* Work Schedule - Only show when validation data is available */}
      <SmoothReveal isVisible={hasValidationData}>
        <EmployeeWorkSchedule
          formData={formData}
          validationData={validationData}
          validationErrors={validationErrors}
          onFormUpdate={onFormUpdate}
          onValidationError={onValidationError}
        />
      </SmoothReveal>
    </div>
  )
})

OptimizedEmployeeInfoForm.displayName = 'OptimizedEmployeeInfoForm'