import { memo } from "react"
import { User } from "lucide-react"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import {
  EmployeeLocationInfo,
  EmployeeSalaryInfo,
  EmployeeContractDuration,
  OptionalEmployeeDataSection,
} from "./employee"

interface EmployeeInfoFormProps {
  country: string
  currency: string
  isCurrencyManuallySet: boolean
  originalCurrency: string | null
  workVisaRequired: boolean
  baseSalary: string
  contractDuration: string
  contractDurationUnit: 'months' | 'years'
  contractType: 'remote' | 'hybrid' | 'on-site'
  showOptionalEmployeeData: boolean
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
  onCountryChange: (country: string) => void
  onCurrencyOverride: (currency: string, conversionInfoCallback?: (info: string) => void) => void
  onCurrencyReset: () => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

// Custom comparison function for better memoization
const arePropsEqual = (
  prevProps: EmployeeInfoFormProps,
  nextProps: EmployeeInfoFormProps
): boolean => {
  // Compare primitive values
  const primitiveKeys: (keyof EmployeeInfoFormProps)[] = [
    'country', 'currency', 'isCurrencyManuallySet', 'originalCurrency',
    'workVisaRequired', 'baseSalary', 'contractDuration', 'contractDurationUnit', 'contractType',
    'showOptionalEmployeeData', 'hoursPerDay', 'daysPerWeek', 'holidayDays', 'probationPeriod',
    'salaryConversionMessage', 'isLoadingValidations', 'isConvertingValidation',
    'isValidationReady'
  ]
  
  for (const key of primitiveKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false
    }
  }

  // Compare arrays (countries should be memoized but let's be safe)
  if (JSON.stringify(prevProps.countries) !== JSON.stringify(nextProps.countries)) {
    return false
  }

  // Compare callback references (they should be memoized from parent)
  const callbackKeys: (keyof EmployeeInfoFormProps)[] = [
    'onFormUpdate', 'onCountryChange', 
    'onCurrencyOverride', 'onCurrencyReset', 'onValidationError'
  ]
  
  for (const key of callbackKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false
    }
  }

  // Deep compare validationData
  if (prevProps.validationData !== nextProps.validationData) {
    if (!prevProps.validationData && !nextProps.validationData) {
      // Both null/undefined, equal
    } else if (!prevProps.validationData || !nextProps.validationData) {
      return false
    } else if (
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

  // Deep compare convertedValidation
  if (JSON.stringify(prevProps.convertedValidation) !== JSON.stringify(nextProps.convertedValidation)) {
    return false
  }

  return true
}

export const EmployeeInfoForm = memo(({
  country,
  currency,
  isCurrencyManuallySet,
  originalCurrency,
  workVisaRequired,
  baseSalary,
  contractDuration,
  contractDurationUnit,
  contractType,
  showOptionalEmployeeData,
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
  onCountryChange,
  onCurrencyOverride,
  onCurrencyReset,
  onValidationError,
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
      <EmployeeContractDuration
        contractDuration={contractDuration}
        contractDurationUnit={contractDurationUnit}
        contractType={contractType}
        onFormUpdate={onFormUpdate}
      />
      <OptionalEmployeeDataSection
        showOptionalEmployeeData={showOptionalEmployeeData}
        hoursPerDay={hoursPerDay}
        daysPerWeek={daysPerWeek}
        holidayDays={holidayDays}
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
}, arePropsEqual)

EmployeeInfoForm.displayName = 'EmployeeInfoForm'