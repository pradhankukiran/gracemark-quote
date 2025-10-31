import { useMemo, useCallback, memo } from "react"
import { MapPin } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"
import { getStateTypeLabel } from "@/lib/country-data"

interface LocationFormProps {
  country: string
  state: string
  currency: string
  countries: string[]
  availableStates: Array<{ code: string; name: string }>
  showStateDropdown: boolean
  onFormUpdate: (updates: Partial<ICFormData>) => void
  onCountryChange: (country: string) => void
}

export const LocationForm = memo(({
  country,
  state,
  currency,
  countries,
  availableStates,
  showStateDropdown,
  onFormUpdate,
  onCountryChange,
}: LocationFormProps) => {
  const countryOptions = useMemo(() =>
    countries.map(country => ({ value: country, label: country })),
    [countries]
  )

  const stateOptions = useMemo(() =>
    availableStates.map(state => ({ value: state.code, label: state.name })),
    [availableStates]
  )

  const handleCountryChange = useCallback((value: string) => {
    onCountryChange(value)
  }, [onCountryChange])

  const handleStateChange = useCallback((value: string) => {
    onFormUpdate({ state: value })
  }, [onFormUpdate])

  const getStateLabel = () => {
    if (showStateDropdown && availableStates.length > 0) {
      return getStateTypeLabel(availableStates[0]?.code?.substring(0, 2) || "")
    }
    return "State/Province"
  }

  const gridCols = showStateDropdown ? FORM_STYLES.GRID_3_COL : FORM_STYLES.GRID_2_COL

  return (
    <div>
      <FormSectionHeader
        icon={MapPin}
        title="Location & Currency"
        subtitle="Geographic location determines applicable rates and regulations"
      />
      <div className={gridCols}>
        <FormField
          type="select"
          label="Country"
          htmlFor="country"
          value={country}
          onChange={handleCountryChange}
          placeholder="Select country"
          options={countryOptions}
          required
        />

        {showStateDropdown && (
          <FormField
            type="select"
            label={getStateLabel()}
            htmlFor="state"
            value={state}
            onChange={handleStateChange}
            placeholder={`Select ${getStateLabel().toLowerCase()}`}
            options={stateOptions}
          />
        )}

        <FormField
          type="input"
          label="Currency"
          htmlFor="currency"
          value={currency}
          onChange={() => {}} // Currency is auto-updated based on country
          readOnly
        />
      </div>

      {country && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Regional Note:</strong> Rates and fees are automatically adjusted based on the selected country
            to account for local market conditions and regulatory requirements.
          </p>
        </div>
      )}
    </div>
  )
})

LocationForm.displayName = 'LocationForm'