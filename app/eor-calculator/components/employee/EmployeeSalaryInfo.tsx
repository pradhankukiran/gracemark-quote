import { memo, useRef, useCallback, useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"
import { FORM_STYLES } from "../../styles/constants"
import { useDebouncedInput } from "../../hooks/useDebouncedInput"
import { useValidationUtils } from "../../hooks/useValidationUtils"
import { isValidNumericFormat } from "@/lib/shared/utils/validationUtils"

interface EmployeeSalaryInfoProps {
  baseSalary: string
  currency: string
  isCurrencyManuallySet: boolean
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
  salaryConversionMessage: string | null
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

export const EmployeeSalaryInfo = memo(({
  baseSalary,
  currency,
  isCurrencyManuallySet,
  validationData,
  validationErrors,
  convertedValidation,
  isLoadingValidations,
  isConvertingValidation,
  isValidationReady,
  salaryConversionMessage,
  onFormUpdate,
  onValidationError
}: EmployeeSalaryInfoProps) => {
  const baseSalaryInputRef = useRef<HTMLInputElement>(null)
  const { validateField, isValidationReady: isValidationUtilsReady } = useValidationUtils()
  const [validationsEnabled, setValidationsEnabled] = useState(false)

  const isLoading = isLoadingValidations || isConvertingValidation;
  const loadingText = isConvertingValidation ? "Converting..." : "Loading...";

  const salaryInput = useDebouncedInput(baseSalary, {
    debounceDelay: 300,
    onImmediate: (value: string) => {
      if (isValidNumericFormat(value)) {
        onFormUpdate({ baseSalary: value })
        onValidationError('salary', null)
      }
    },
    onValidate: (value: string) => {
      handleSalaryValidation(value)
    }
  })
  const salaryValue = salaryInput.value

  const handleSalaryValidation = useCallback((value: string) => {
    if (!validationsEnabled) {
      onValidationError('salary', null)
      return
    }

    if (!value || !isValidationUtilsReady()) {
      onValidationError('salary', null)
      return
    }

    if (isConvertingValidation && isCurrencyManuallySet) {
      return
    }

    let effectiveValidationData = validationData
    if (
      isCurrencyManuallySet &&
      convertedValidation.currency === currency &&
      validationData
    ) {
      effectiveValidationData = {
        ...validationData,
        data: {
          ...validationData.data,
          salary: {
            ...validationData.data.salary,
            min: convertedValidation.minSalary ? convertedValidation.minSalary.replace(/[/\,\s]/g, '') : validationData.data.salary.min,
            max: convertedValidation.maxSalary ? convertedValidation.maxSalary.replace(/[/\,\s]/g, '') : validationData.data.salary.max
          }
        }
      }
    }

    validateField('salary', value, 'salary', effectiveValidationData, currency, onValidationError)
  }, [
    isValidationUtilsReady,
    isConvertingValidation,
    isCurrencyManuallySet,
    currency,
    convertedValidation,
    validationData,
    validateField,
    onValidationError,
    validationsEnabled
  ])


  const handleSalaryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    salaryInput.handleChange(e.target.value)
  }, [salaryInput])

  const handleSalaryBlur = useCallback(() => {
    handleSalaryValidation(salaryValue)
  }, [handleSalaryValidation, salaryValue])

  useEffect(() => {
    if (!validationsEnabled) {
      onValidationError('salary', null)
      return
    }

    if (salaryValue) {
      handleSalaryValidation(salaryValue)
    }
  }, [validationsEnabled, handleSalaryValidation, salaryValue, onValidationError])

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>
            Minimum Salary
            {isLoading && (
              <span className="ml-2 text-xs text-slate-500">({loadingText})</span>
            )}
          </Label>
          <Input
            value={
              isLoading ? loadingText :
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
            placeholder={`Enter amount in ${currency}`}
            value={salaryInput.value}
            onChange={handleSalaryChange}
            onBlur={handleSalaryBlur}
            className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
              validationErrors.salary ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {salaryConversionMessage && isValidationReady && (
            <p className="text-green-600 text-sm mt-1 flex items-center">
              <span className="mr-1">✓</span>
              {salaryConversionMessage}
            </p>
          )}
          {validationErrors.salary && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.salary}</p>
          )}
          {validationsEnabled && !isValidationReady && isCurrencyManuallySet && (
            <p className="text-blue-600 text-sm mt-1 flex items-center">
              <span className="mr-1">⏳</span>
              Validation pending currency conversion...
            </p>
          )}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="salary-validations"
              checked={validationsEnabled}
              onCheckedChange={(checked) => setValidationsEnabled(checked === true)}
              className="h-4 w-4"
            />
            <Label htmlFor="salary-validations" className="text-sm font-medium text-slate-700">
              Validations
            </Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE}>
            Maximum Salary
            {isLoading && (
              <span className="ml-2 text-xs text-slate-500">({loadingText})</span>
            )}
          </Label>
          <Input
            value={
              isLoading ? loadingText :
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
