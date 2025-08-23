import { useMemo, useCallback, memo } from "react"
import { MapPin } from "lucide-react"
import { EORFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FormField } from "./shared/FormField"
import { FORM_STYLES } from "../styles/constants"

interface ClientInfoFormProps {
  clientName: string
  clientType: 'new' | 'existing' | null
  clientCountry: string
  clientCurrency: string
  countries: string[]
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const ClientInfoForm = memo(({
  clientName,
  clientType,
  clientCountry,
  clientCurrency,
  countries,
  onFormUpdate,
}: ClientInfoFormProps) => {
  const countryOptions = useMemo(() => countries.map(country => ({ value: country, label: country })), [countries])

  const handleClientCountryChange = useCallback((value: string) => {
    onFormUpdate({ clientCountry: value })
  }, [onFormUpdate])

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
            value={clientName}
            onChange={(e) => onFormUpdate({ clientName: e.target.value })}
            placeholder="Enter client name"
            className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 w-full px-3 rounded-md"
          />
          <div className="flex gap-3 justify-start">
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
                  checked={clientType === option.value}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onFormUpdate({ clientType: option.value as 'new' | 'existing' })
                    } else {
                      onFormUpdate({ clientType: null })
                    }
                  }}
                  className="w-3 h-3 text-primary border border-slate-300 rounded focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-base font-semibold text-slate-700 uppercase tracking-wide">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <FormField
          type="select"
          label="Client Country"
          htmlFor="clientCountry"
          value={clientCountry}
          onChange={handleClientCountryChange}
          placeholder="Select client country"
          options={countryOptions}
        />
        <FormField
          type="input"
          label="Client Currency"
          htmlFor="clientCurrency"
          value={clientCurrency}
          onChange={() => {}}
          readOnly
        />
      </div>
    </div>
  )
})

ClientInfoForm.displayName = 'ClientInfoForm'