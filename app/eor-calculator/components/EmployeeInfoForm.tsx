import { memo } from "react"
import { User } from "lucide-react"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import {
  EmployeeHolidays,
  EmployeeLocationInfo,
  EmployeeProbation,
  EmployeeSalaryInfo,
  EmployeeWorkSchedule,
} from "./employee"

interface EmployeeInfoFormProps {
  country: string
  currency: string
  isCurrencyManuallySet: boolean
  originalCurrency: string | null
  workVisaRequired: boolean
  baseSalary: string
  hoursPerDay: string
  daysPerWeek: string
  holidayDays: string
  probationPeriod: string
  countries: string[]
  salaryConversionMessage: string | null
  validationData: ValidationAPIResponse | null
  validationErrors: ValidationErrors
  convertedValidation: {
    minSalary?: string
    maxSalary?: string
    currency?: string
  }
  isLoadingValidations: boolean
  isConvertingValidation: boolean
  isValidationReady: boolean
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
  onCountryChange: (country: string) => void
  onCurrencyOverride: (currency: string, conversionInfoCallback?: (info: string) => void) => void
  onCurrencyReset: () => void
}

export const EmployeeInfoForm = memo(({
  country,
  currency,
  isCurrencyManuallySet,
  originalCurrency,
  workVisaRequired,
  baseSalary,
  hoursPerDay,
  daysPerWeek,
  holidayDays,
  probationPeriod,
  countries,
  salaryConversionMessage,
  validationData,
  validationErrors,
  convertedValidation,
  isLoadingValidations,
  isConvertingValidation,
  isValidationReady,
  onFormUpdate,
  onValidationError,
  onCountryChange,
  onCurrencyOverride,
  onCurrencyReset,
}: EmployeeInfoFormProps) => {
  return (
    <div>
      <FormSectionHeader icon={User} title="Employee Information" />
      <div className="space-y-6">
        <EmployeeLocationInfo
        country={country}
        currency={currency}
        isCurrencyManuallySet={isCurrencyManuallySet}
        originalCurrency={originalCurrency}
        workVisaRequired={workVisaRequired}
        countries={countries}
        onFormUpdate={onFormUpdate}
        onCountryChange={onCountryChange}
        onCurrencyOverride={onCurrencyOverride}
        onCurrencyReset={onCurrencyReset}
      />
      <EmployeeSalaryInfo
        baseSalary={baseSalary}
        currency={currency}
        isCurrencyManuallySet={isCurrencyManuallySet}
        salaryConversionMessage={salaryConversionMessage}
        validationData={validationData}
        validationErrors={validationErrors}
        convertedValidation={convertedValidation}
        isLoadingValidations={isLoadingValidations}
        isConvertingValidation={isConvertingValidation}
        isValidationReady={isValidationReady}
        onFormUpdate={onFormUpdate}
        onValidationError={onValidationError}
      />
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
    </div>
  )
})

EmployeeInfoForm.displayName = 'EmployeeInfoForm'