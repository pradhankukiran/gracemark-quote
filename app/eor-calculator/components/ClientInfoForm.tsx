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
          <FormField
            type="input"
            label="Client Name"
            htmlFor="clientName"
            value={clientName}
            onChange={(value) => onFormUpdate({ clientName: value })}
            placeholder="Enter client name"
          />
          <div className="relative flex items-center border-2 border-slate-200 rounded-md p-1 bg-slate-100">
            <div
              className={`
                absolute top-1 left-1 h-[calc(100%-0.5rem)] w-1/2 bg-primary rounded-md shadow-sm transition-transform duration-300 ease-in-out
                ${clientType === 'existing' ? 'translate-x-[95%]' : 'translate-x-0'}
              `}
            />
            {[
              { value: 'new', label: 'New Client' },
              { value: 'existing', label: 'Existing Client' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFormUpdate({ clientType: option.value as 'new' | 'existing' })}
                className={`
                  flex-1 py-2 px-4 text-center text-sm font-semibold rounded-md transition-colors duration-200 cursor-pointer z-10
                  ${clientType === option.value
                    ? 'text-white'
                    : 'text-slate-600 hover:text-primary'
                  }
                `}
              >
                {option.label}
              </button>
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