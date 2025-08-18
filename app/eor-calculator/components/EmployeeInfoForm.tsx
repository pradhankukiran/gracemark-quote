import { useRef } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { User, AlertCircle, Loader2 } from "lucide-react"
import { getStateTypeLabel } from "@/lib/country-data"
import { EORFormData, ValidationAPIResponse, ValidationErrors } from "../types"
import { isValidNumericFormat, generateValidationErrorMessage } from "../utils/validationUtils"

interface EmployeeInfoFormProps {
  formData: EORFormData
  countries: string[]
  availableStates: Array<{ code: string; name: string }>
  showStateDropdown: boolean
  selectedCountryCode?: string
  validationData: ValidationAPIResponse | null
  validationError: string | null
  isLoadingValidations: boolean
  validationErrors: ValidationErrors
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

export const EmployeeInfoForm = ({
  formData,
  countries,
  availableStates,
  showStateDropdown,
  selectedCountryCode,
  validationData,
  validationError,
  isLoadingValidations,
  validationErrors,
  onFormUpdate,
  onValidationError,
}: EmployeeInfoFormProps) => {
  const baseSalaryInputRef = useRef<HTMLInputElement>(null)

  const handleValidatedInput = (
    field: keyof ValidationErrors,
    value: string,
    formField: keyof EORFormData,
    validatorType: 'salary' | 'holiday' | 'probation' | 'hours' | 'days'
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
          isValid = validateSalaryInput(value, validationData)
          break
        case 'holiday':
          isValid = validateHolidayInput(value, validationData)
          break
        case 'probation':
          isValid = validateProbationInput(value, validationData)
          break
        case 'hours':
          isValid = validateHoursInput(value, validationData)
          break
        case 'days':
          isValid = validateDaysInput(value, validationData)
          break
      }

      if (!isValid) {
        import("../utils/validationUtils").then(({ generateValidationErrorMessage }) => {
          const errorMsg = generateValidationErrorMessage(validatorType, validationData, formData.currency)
          onValidationError(field, errorMsg)
        })
      } else {
        onValidationError(field, null)
      }
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Employee Information</h3>
      </div>
      
      {/* Employee Name and Job Title */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Label
            htmlFor="employeeName"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
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
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
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
      </div>

      {/* Work Visa Required */}
      <div className="mb-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="workVisaRequired"
            checked={formData.workVisaRequired}
            onCheckedChange={(checked) => onFormUpdate({ workVisaRequired: checked as boolean })}
          />
          <Label htmlFor="workVisaRequired" className="text-sm font-medium text-slate-700">
            Work Visa Required?
          </Label>
        </div>
      </div>

      {/* Location & Currency */}
      <div className="mb-6">
        <div className={`grid gap-4 ${showStateDropdown ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <div className="space-y-2">
            <Label htmlFor="country" className="text-base font-semibold text-slate-700 uppercase tracking-wide">
              Country
            </Label>
            <Select
              value={formData.country}
              onValueChange={(value) => onFormUpdate({ country: value })}
            >
              <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
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

          {showStateDropdown && (
            <div className="space-y-2">
              <Label htmlFor="state" className="text-base font-semibold text-slate-700 uppercase tracking-wide">
                {getStateTypeLabel(selectedCountryCode || "")}
              </Label>
              <Select
                value={formData.state}
                onValueChange={(value) => onFormUpdate({ state: value })}
              >
                <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                  <SelectValue
                    placeholder={`Select ${getStateTypeLabel(selectedCountryCode || "").toLowerCase()}`}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableStates.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="currency"
              className="text-base font-semibold text-slate-700 uppercase tracking-wide"
            >
              Currency
            </Label>
            <div className="h-12 border-2 border-slate-200 px-3 py-2 bg-slate-50 flex items-center">
              <span className="text-slate-700 font-medium">{formData.currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Loading/Error States */}
      {isLoadingValidations && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
          <span className="text-slate-600">Loading country validation data...</span>
        </div>
      )}

      {validationError && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="text-yellow-800 font-medium">Validation data unavailable</h5>
              <p className="text-yellow-700 text-sm mt-1">{validationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Salary Limits (Read-only) */}
      {validationData && !isLoadingValidations && (
        <div className="mb-6">
          <h5 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">
            Salary Limits ({validationData.data.currency})
          </h5>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Minimum</Label>
              <Input
                value={validationData.data.salary.min ? 
                  `${validationData.data.currency} ${Number(validationData.data.salary.min).toLocaleString()}` : 
                  "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Maximum</Label>
              <Input
                value={validationData.data.salary.max ? 
                  `${validationData.data.currency} ${Number(validationData.data.salary.max).toLocaleString()}` : 
                  "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Frequency</Label>
              <Input
                value={validationData.data.salary.frequency || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Annual Base Salary + Employment Type */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <Label
              htmlFor="baseSalary"
              className="text-base font-semibold text-slate-700 uppercase tracking-wide block"
            >
              Annual Base Salary ({formData.currency})
            </Label>
            <Input
              ref={baseSalaryInputRef}
              id="baseSalary"
              type="text"
              placeholder={`Enter annual salary amount in ${formData.currency}`}
              value={formData.baseSalary}
              onChange={(e) => handleValidatedInput('salary', e.target.value, 'baseSalary', 'salary')}
              onBlur={() => handleBlurValidation('salary', formData.baseSalary, 'salary')}
              className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                validationErrors.salary ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {validationErrors.salary && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.salary}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="employmentType"
              className="text-base font-semibold text-slate-700 uppercase tracking-wide block"
            >
              Employment Type
            </Label>
            <Select
              value={formData.employmentType}
              onValueChange={(value) => onFormUpdate({ employmentType: value })}
            >
              <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
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
      </div>

      {/* Holiday Information */}
      {validationData && !isLoadingValidations && (
        <div className="mb-6">
          <h5 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">Holiday Days</h5>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Minimum</Label>
              <Input
                value={validationData.data.holiday.min || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Maximum</Label>
              <Input
                value={validationData.data.holiday.max || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Most Common</Label>
              <Input
                value={validationData.data.holiday.mostCommon || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="holidayDays"
                className="text-base font-semibold text-slate-700 uppercase tracking-wide"
              >
                Holiday Days
              </Label>
              <Input
                id="holidayDays"
                type="text"
                placeholder={validationData.data.holiday.mostCommon || "Enter number of holidays"}
                value={formData.holidayDays}
                onChange={(e) => handleValidatedInput('holidays', e.target.value, 'holidayDays', 'holiday')}
                onBlur={() => handleBlurValidation('holidays', formData.holidayDays, 'holiday')}
                className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.holidays ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.holidays && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.holidays}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Probation Period */}
      {validationData && !isLoadingValidations && (validationData.data.probation.min || validationData.data.probation.max) && (
        <div className="mb-6">
          <h5 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">Probation Period</h5>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Minimum</Label>
              <Input
                value={validationData.data.probation.min || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Maximum</Label>
              <Input
                value={validationData.data.probation.max || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="probationPeriod"
                className="text-base font-semibold text-slate-700 uppercase tracking-wide"
              >
                Probation Period
              </Label>
              <Input
                id="probationPeriod"
                type="text"
                placeholder="Enter probation period in days"
                value={formData.probationPeriod}
                onChange={(e) => handleValidatedInput('probation', e.target.value, 'probationPeriod', 'probation')}
                onBlur={() => handleBlurValidation('probation', formData.probationPeriod, 'probation')}
                className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.probation ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.probation && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.probation}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Work Schedule */}
      {validationData && !isLoadingValidations && (
        <div>
          <h5 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">Work Schedule</h5>
          <div className="grid md:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Min Hours/Day</Label>
              <Input
                value={validationData.data.work_schedule.hours.min || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Max Hours/Day</Label>
              <Input
                value={validationData.data.work_schedule.hours.max || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="hoursPerDay"
                className="text-base font-semibold text-slate-700 uppercase tracking-wide"
              >
                Hours per Day
              </Label>
              <Input
                id="hoursPerDay"
                type="text"
                placeholder="Enter hours per day"
                value={formData.hoursPerDay}
                onChange={(e) => handleValidatedInput('hours', e.target.value, 'hoursPerDay', 'hours')}
                onBlur={() => handleBlurValidation('hours', formData.hoursPerDay, 'hours')}
                className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.hours ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.hours && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.hours}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Min Days/Week</Label>
              <Input
                value={validationData.data.work_schedule.days.min || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-600">Max Days/Week</Label>
              <Input
                value={validationData.data.work_schedule.days.max || "Not specified"}
                disabled
                className="h-10 bg-slate-50 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="daysPerWeek"
                className="text-base font-semibold text-slate-700 uppercase tracking-wide"
              >
                Days per Week
              </Label>
              <Input
                id="daysPerWeek"
                type="text"
                placeholder="Enter days per week"
                value={formData.daysPerWeek}
                onChange={(e) => handleValidatedInput('days', e.target.value, 'daysPerWeek', 'days')}
                onBlur={() => handleBlurValidation('days', formData.daysPerWeek, 'days')}
                className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.days ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.days && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.days}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}