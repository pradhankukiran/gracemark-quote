import { useRef } from "react"
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

interface EmployeeInfoFormProps {
  formData: EORFormData
  countries: string[]
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
            </Label>
            <Input
              id="currency"
              value={formData.currency}
              readOnly
              className="h-12 border-2 border-slate-200 bg-slate-50 text-slate-700"
            />
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
              <Label className={FORM_STYLES.LABEL_BASE}>Minimum Salary</Label>
              <Input
                value={validationData.data.salary.min ? 
                  `${validationData.data.currency} ${Number(validationData.data.salary.min).toLocaleString()}` : 
                  "Not specified"}
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
                onChange={(e) => handleValidatedInput('salary', e.target.value, 'baseSalary', 'salary')}
                onBlur={() => handleBlurValidation('salary', formData.baseSalary, 'salary')}
                className={`h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                  validationErrors.salary ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {validationErrors.salary && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.salary}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className={FORM_STYLES.LABEL_BASE}>Maximum Salary</Label>
              <Input
                value={validationData.data.salary.max ? 
                  `${validationData.data.currency} ${Number(validationData.data.salary.max).toLocaleString()}` : 
                  "Not specified"}
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
                onChange={(e) => handleValidatedInput('holidays', e.target.value, 'holidayDays', 'holiday')}
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
                onChange={(e) => handleValidatedInput('probation', e.target.value, 'probationPeriod', 'probation')}
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
                onChange={(e) => handleValidatedInput('hours', e.target.value, 'hoursPerDay', 'hours')}
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
                onChange={(e) => handleValidatedInput('days', e.target.value, 'daysPerWeek', 'days')}
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