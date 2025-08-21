import { useRef, useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User } from "lucide-react"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "../types"
import { isValidNumericFormat } from "../utils/validationUtils"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { LoadingSpinner } from "./shared/LoadingSpinner"
import { ErrorDisplay } from "./shared/ErrorDisplay"
import { FORM_STYLES } from "../styles/constants"
import { allCurrencies } from "@/lib/country-data"

interface EmployeeInfoFormProps {
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
}

export const EmployeeInfoForm = ({
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
}: EmployeeInfoFormProps) => {
  const baseSalaryInputRef = useRef<HTMLInputElement>(null)
  const [isEditingCurrency, setIsEditingCurrency] = useState(false)
  const [salaryConversionInfo, setSalaryConversionInfo] = useState<string | null>(null)

  const handleValidatedInput = (
    field: keyof ValidationErrors,
    value: string,
    formField: keyof EORFormData
  ) => {
    if (isValidNumericFormat(value)) {
      onFormUpdate({ [formField]: value })
      onValidationError(field, null)
    }
  }

  const handleBlurValidation = (
    field: keyof ValidationErrors,
    value: string,
    validatorType: 'salary' | 'holiday' | 'probation' | 'hours' | 'days'
  ) => {
    if (!value) {
      onValidationError(field, null)
      return
    }

    // Skip validation if conversion is still in progress
    if (isConvertingValidation && validatorType === 'salary' && formData.isCurrencyManuallySet) {
      return
    }

    // Use converted validation data if currency has been manually set
    let effectiveValidationData = validationData
    if (
      validatorType === 'salary' &&
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

    // Dynamically import and use the appropriate validator
    import("../utils/validationUtils").then(({
      validateSalaryInput, 
      validateHolidayInput, 
      validateProbationInput, 
      validateHoursInput, 
      validateDaysInput 
    }) => {

      let isValid = false
      switch (validatorType) {
        case 'salary':
          isValid = validateSalaryInput(value, effectiveValidationData)
          break
        case 'holiday':
          isValid = validateHolidayInput(value, effectiveValidationData)
          break
        case 'probation':
          isValid = validateProbationInput(value, effectiveValidationData)
          break
        case 'hours':
          isValid = validateHoursInput(value, effectiveValidationData)
          break
        case 'days':
          isValid = validateDaysInput(value, effectiveValidationData)
          break
      }

      if (!isValid) {
        import("../utils/validationUtils").then(({ generateValidationErrorMessage }) => {
          const errorMsg = generateValidationErrorMessage(validatorType, effectiveValidationData, formData.currency)
          onValidationError(field, errorMsg)
        })
      } else {
        onValidationError(field, null)
      }
    })
  }

  const handleChangeClick = () => {
    setIsEditingCurrency(true)
  }

  const handleCurrencySelect = (newCurrency: string) => {
    // Don't proceed if same currency is selected
    if (newCurrency === formData.currency) {
      setIsEditingCurrency(false)
      return
    }
    
    onCurrencyOverride(newCurrency, setSalaryConversionInfo)
    setIsEditingCurrency(false)
  }

  // Reset editing state when country changes
  useEffect(() => {
    setIsEditingCurrency(false)
    setSalaryConversionInfo(null)
  }, [formData.country])

  // Clear salary conversion info after a delay
  useEffect(() => {
    if (salaryConversionInfo) {
      const timeout = setTimeout(() => {
        setSalaryConversionInfo(null)
      }, 5000) // Clear after 5 seconds

      return () => clearTimeout(timeout)
    }
  }, [salaryConversionInfo])


  return (
    <div>
      <FormSectionHeader icon={User} title="Employee Information" />
      
      {/* Employee Name, Job Title, and Employment Type */}
      <div className={`${FORM_STYLES.GRID_3_COL} mb-6`}>
        <div className="space-y-2">
          <Label
            htmlFor="employeeName"
            className={FORM_STYLES.LABEL_BASE}
          >
            Employee Name
          </Label>
          <Input
            id="employeeName"
            value={formData.employeeName}
            onChange={(e) => onFormUpdate({ employeeName: e.target.value })}
            placeholder="John Doe"
            className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="jobTitle"
            className={FORM_STYLES.LABEL_BASE}
          >
            Job Title
          </Label>
          <Input
            id="jobTitle"
            value={formData.jobTitle}
            onChange={(e) => onFormUpdate({ jobTitle: e.target.value })}
            placeholder="Software Engineer"
            className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="employmentType"
            className={FORM_STYLES.LABEL_BASE}
          >
            Employment Type
          </Label>
          <Select
            value={formData.employmentType}
            onValueChange={(value) => onFormUpdate({ employmentType: value })}
          >
            <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      {/* Location, Currency & Work Visa */}
      <div className="mb-6">
        <div className={FORM_STYLES.GRID_3_COL}>
          <div className="space-y-2">
            <Label htmlFor="country" className={FORM_STYLES.LABEL_BASE}>
              Country
            </Label>
            <Select
              value={formData.country}
              onValueChange={(value) => onFormUpdate({ country: value })}
            >
              <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="currency"
              className={FORM_STYLES.LABEL_BASE}
            >
              Currency
              {formData.isCurrencyManuallySet && (
                <span className="ml-2 text-xs text-blue-600 font-medium">
                  (Custom)
                </span>
              )}
            </Label>
            
            {!isEditingCurrency ? (
              <div className="relative">
                <Input
                  id="currency"
                  value={formData.currency}
                  readOnly
                  className="h-12 border-2 border-slate-200 bg-slate-50 text-slate-700 pr-24"
                />
                {formData.country && (
                  <button
                    type="button"
                    onClick={handleChangeClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleChangeClick()
                      }
                    }}
                    className="absolute top-1/2 right-2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-xs text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                    aria-label="Change currency"
                  >
                    Change?
                  </button>
                )}
              </div>
            ) : (
              <Select value={formData.currency} onValueChange={handleCurrencySelect}>
                <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {allCurrencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {formData.isCurrencyManuallySet && formData.originalCurrency && (
              <button
                type="button"
                onClick={onCurrencyReset}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Reset to {formData.originalCurrency} (default for {formData.country})
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="workVisaRequired"
              className={FORM_STYLES.LABEL_BASE}
            >
              Work Visa Required
            </Label>
            <Select
              value={formData.workVisaRequired ? "true" : "false"}
              onValueChange={(value) => onFormUpdate({ workVisaRequired: value === "true" })}
            >
              <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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

      {/* Salary Information */}
      {validationData && !isLoadingValidations && (
        <div className="mb-6">
          {/* <h5 className={`${FORM_STYLES.LABEL_BASE} mb-3`}>
            Salary Information ({validationData.data.currency})
          </h5> */}
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
                    validationData.data.salary.min ? 
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
                value={formData.baseSalary}
                onChange={(e) => handleValidatedInput('salary', e.target.value, 'baseSalary')}
                onBlur={() => handleBlurValidation('salary', formData.baseSalary, 'salary')}
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
              {salaryConversionInfo && (
                <p className="text-green-600 text-sm mt-1 flex items-center">
                  <span className="mr-1">✓</span>
                  {salaryConversionInfo}
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
                    validationData.data.salary.max ? 
                      `${validationData.data.currency} ${Number(validationData.data.salary.max).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                      "Not specified"
                }
                disabled
                className="h-12 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Holiday Information */}
      {validationData && !isLoadingValidations && (
        <div className="mb-6">
          {/* <h5 className={`${FORM_STYLES.LABEL_BASE} mb-3`}>Holiday Days</h5> */}
          <div className={FORM_STYLES.GRID_3_COL}>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Minimum Holidays</Label>
              <Input
                value={validationData.data.holiday.min || "Not specified"}
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
                value={formData.holidayDays}
                onChange={(e) => handleValidatedInput('holidays', e.target.value, 'holidayDays')}
                onBlur={() => handleBlurValidation('holidays', formData.holidayDays, 'holiday')}
                className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.holidays ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.holidays && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.holidays}</p>
              )}</div>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Maximum Holidays</Label>
              <Input
                value={validationData.data.holiday.max || "Not specified"}
                disabled
                className="h-12 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>{/* <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Most Common</Label>
              <Input
                value={validationData.data.holiday.mostCommon || "Not specified"}
                disabled
                className="h-12 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div> */}
            
          </div>
        </div>
      )}

      {/* Probation Period */}
      {validationData && !isLoadingValidations && (validationData.data.probation.min || validationData.data.probation.max) && (
        <div className="mb-6">
          {/* <h5 className={`${FORM_STYLES.LABEL_BASE} mb-3`}>Probation Period</h5> */}
          <div className={FORM_STYLES.GRID_3_COL}>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Minimum Probation</Label>
              <Input
                value={validationData.data.probation.min || "Not specified"}
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
                value={formData.probationPeriod}
                onChange={(e) => handleValidatedInput('probation', e.target.value, 'probationPeriod')}
                onBlur={() => handleBlurValidation('probation', formData.probationPeriod, 'probation')}
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
                value={validationData.data.probation.max || "Not specified"}
                disabled
                className="h-12 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Work Schedule */}
      {validationData && !isLoadingValidations && (
        <div className="mb-6">
          {/* <h5 className={`${FORM_STYLES.LABEL_BASE} mb-3`}>Work Schedule</h5> */}
          <div className={`${FORM_STYLES.GRID_3_COL} mb-4`}>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Min Hours/Day</Label>
              <Input
                value={validationData.data.work_schedule.hours.min || "Not specified"}
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
                value={formData.hoursPerDay}
                onChange={(e) => handleValidatedInput('hours', e.target.value, 'hoursPerDay')}
                onBlur={() => handleBlurValidation('hours', formData.hoursPerDay, 'hours')}
                className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.hours ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.hours && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.hours}</p>
              )}</div>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Max Hours/Day</Label>
              <Input
                value={validationData.data.work_schedule.hours.max || "Not specified"}
                disabled
                className="h-12 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
          </div>
          <div className={FORM_STYLES.GRID_3_COL}>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Min Days/Week</Label>
              <Input
                value={validationData.data.work_schedule.days.min || "Not specified"}
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
                value={formData.daysPerWeek}
                onChange={(e) => handleValidatedInput('days', e.target.value, 'daysPerWeek')}
                onBlur={() => handleBlurValidation('days', formData.daysPerWeek, 'days')}
                className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.days ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.days && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.days}</p>
              )}</div>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Max Days/Week</Label>
              <Input
                value={validationData.data.work_schedule.days.max || "Not specified"}
                disabled
                className="h-12 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}