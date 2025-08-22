import { memo, useRef, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "../../types"
import { FORM_STYLES } from "../../styles/constants"
import { useDebouncedInput } from "../../hooks/useDebouncedInput"
import { useValidationUtils } from "../../hooks/useValidationUtils"
import { isValidNumericFormat } from "../../utils/validationUtils"

interface EmployeeSalaryInfoProps {
  formData: EORFormData
  validationData: ValidationAPIResponse | null
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
}

export const EmployeeSalaryInfo = memo(({
  formData,
  validationData,
  validationErrors,
  convertedValidation,
  isConvertingValidation,
  isValidationReady,
  onFormUpdate,
  onValidationError
}: EmployeeSalaryInfoProps) => {
  const baseSalaryInputRef = useRef<HTMLInputElement>(null)
  const { validateField, isValidationReady: isValidationUtilsReady } = useValidationUtils()

  // Use debounced input for salary to prevent excessive re-renders during typing
  const salaryInput = useDebouncedInput(formData.baseSalary, {
    debounceDelay: 300,
    onImmediate: (value: string) => {
      // Update form immediately for UI responsiveness
      if (isValidNumericFormat(value)) {
        onFormUpdate({ baseSalary: value })
        onValidationError('salary', null)
      }
    },
    onValidate: (value: string) => {
      // Perform validation after debounce delay
      handleSalaryValidation(value)
    }
  })

  const handleSalaryValidation = useCallback((value: string) => {
    if (!value || !isValidationUtilsReady()) {
      onValidationError('salary', null)
      return
    }

    // Skip validation if conversion is still in progress
    if (isConvertingValidation && formData.isCurrencyManuallySet) {
      return
    }

    // Use converted validation data if currency has been manually set
    let effectiveValidationData = validationData
    if (
      formData.isCurrencyManuallySet &&
      convertedValidation.currency === formData.currency &&
      validationData
    ) {
      // Create a deep copy to avoid mutating the original validationData state
      const newValidationData = JSON.parse(JSON.stringify(validationData))
      
      if (convertedValidation.minSalary) {
        newValidationData.data.salary.min = convertedValidation.minSalary.replace(/[\,\s]/g, '')
      }
      if (convertedValidation.maxSalary) {
        newValidationData.data.salary.max = convertedValidation.maxSalary.replace(/[\,\s]/g, '')
      }
      effectiveValidationData = newValidationData
    }

    const result = validateField('salary', value, 'salary', effectiveValidationData, formData.currency)
    onValidationError('salary', result.isValid ? null : result.errorMessage || 'Invalid salary amount')
  }, [
    isValidationUtilsReady,
    isConvertingValidation,
    formData.isCurrencyManuallySet,
    formData.currency,
    convertedValidation,
    validationData,
    validateField,
    onValidationError
  ])

  const handleSalaryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    salaryInput.handleChange(e.target.value)
  }, [salaryInput])

  const handleSalaryBlur = useCallback(() => {
    // Trigger final validation on blur
    handleSalaryValidation(salaryInput.value)
  }, [handleSalaryValidation, salaryInput.value])

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>
            Minimum Salary
            {isConvertingValidation && (
              <span className="ml-2 text-xs text-slate-500">(Converting...)</span>
            )}
          </Label>
          <Input
            value={
              isConvertingValidation ? "Converting..." :
              convertedValidation.minSalary ? 
                `${convertedValidation.currency} ${convertedValidation.minSalary}` :
                validationData?.data.salary.min ? 
                  `${validationData.data.currency} ${Number(validationData.data.salary.min).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                  "Not specified"
            }
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="baseSalary"
            className={FORM_STYLES.LABEL_BASE}
          >
            Annual Base Salary
          </Label>
          <Input
            ref={baseSalaryInputRef}
            id="baseSalary"
            type="text"
            placeholder={`Enter amount in ${formData.currency}`}
            value={salaryInput.value}
            onChange={handleSalaryChange}
            onBlur={handleSalaryBlur}
            className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
              validationErrors.salary ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {validationErrors.salary && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.salary}</p>
          )}
          {!isValidationReady && formData.isCurrencyManuallySet && (
            <p className="text-blue-600 text-sm mt-1 flex items-center">
              <span className="mr-1">⏳</span>
              Validation pending currency conversion...
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>
            Maximum Salary
            {isConvertingValidation && (
              <span className="ml-2 text-xs text-slate-500">(Converting...)</span>
            )}
          </Label>
          <Input
            value={
              isConvertingValidation ? "Converting..." :
              convertedValidation.maxSalary ? 
                `${convertedValidation.currency} ${convertedValidation.maxSalary}` :
                validationData?.data.salary.max ? 
                  `${validationData.data.currency} ${Number(validationData.data.salary.max).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                  "Not specified"
            }
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
    </div>
  )
})

EmployeeSalaryInfo.displayName = 'EmployeeSalaryInfo'