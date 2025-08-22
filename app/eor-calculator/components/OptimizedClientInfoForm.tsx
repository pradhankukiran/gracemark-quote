import { memo, useMemo } from "react"
import { MapPin } from "lucide-react"
import { EORFormData } from "../types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FORM_STYLES } from "../styles/constants"
import { useDebouncedFormField } from "../hooks/useDebouncedInput"

interface OptimizedClientInfoFormProps {
  formData: EORFormData
  countries: string[]
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onCountryChange?: (country: string) => void
}

export const OptimizedClientInfoForm = memo(({ 
  formData, 
  countries, 
  onFormUpdate,
  onCountryChange 
}: OptimizedClientInfoFormProps) => {
  
  // Memoize country options to prevent recalculation
  const countryOptions = useMemo(() => 
    countries.map(country => ({ value: country, label: country })), 
    [countries]
  )

  // Use debounced input for client name to prevent excessive re-renders
  const clientName = useDebouncedFormField(
    formData.clientName,
    (value: string) => onFormUpdate({ clientName: value })
  )

  const handleCountryChange = (country: string) => {
    if (onCountryChange) {
      onCountryChange(country)
    } else {
      onFormUpdate({ clientCountry: country })
    }
  }

  const handleClientTypeChange = (type: 'new' | 'existing', isChecked: boolean) => {
    if (isChecked) {
      onFormUpdate({ clientType: type })
    } else {
      onFormUpdate({ clientType: null })
    }
  }

  return (
    <div>
      <FormSectionHeader icon={MapPin} title="Client Information" />
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <label htmlFor="clientName" className="text-base font-semibold text-slate-700 uppercase tracking-wide">
            Client Name
          </label>
          <input
            id="clientName"
            type="text"
            value={clientName.value}
            onChange={(e) => clientName.handleChange(e.target.value)}
            placeholder="Enter client name"
            className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 w-full px-3 rounded-md"
          />
          <div className="flex gap-3 justify-end">
            {[
              { value: 'new', label: 'New' },
              { value: 'existing', label: 'Existing' }
            ].map((option) => (
              <label 
                key={option.value}
                className="flex items-center gap-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.clientType === option.value}
                  onChange={(e) => handleClientTypeChange(option.value as 'new' | 'existing', e.target.checked)}
                  className="h-3 w-3 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                />
                <span className="text-xs text-slate-600">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-2">
          <label htmlFor="clientCountry" className="text-base font-semibold text-slate-700 uppercase tracking-wide">
            Client Country
          </label>
          <select
            id="clientCountry"
            value={formData.clientCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 w-full px-3 rounded-md bg-white"
          >
            <option value="">Select client country</option>
            {countryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
})

OptimizedClientInfoForm.displayName = 'OptimizedClientInfoForm'