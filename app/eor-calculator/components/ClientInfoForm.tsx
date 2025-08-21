import { MapPin } from "lucide-react"
import { EORFormData } from "../types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FormField } from "./shared/FormField"
import { FORM_STYLES } from "../styles/constants"

interface ClientInfoFormProps {
  formData: EORFormData
  countries: string[]
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const ClientInfoForm = ({ formData, countries, onFormUpdate }: ClientInfoFormProps) => {
  const countryOptions = countries.map(country => ({ value: country, label: country }))

  return (
    <div>
      <FormSectionHeader icon={MapPin} title="Client Information" />
      <div className={FORM_STYLES.GRID_3_COL}>
        <FormField
          type="input"
          label="Client Name"
          htmlFor="clientName"
          value={formData.clientName}
          onChange={(value) => onFormUpdate({ clientName: value })}
          placeholder="Enter client name"
        />
        <FormField
          type="select"
          label="Client Country"
          htmlFor="clientCountry"
          value={formData.clientCountry}
          onChange={(value) => onFormUpdate({ clientCountry: value })}
          placeholder="Select client country"
          options={countryOptions}
        />
        <FormField
          type="input"
          label="Client Currency"
          htmlFor="clientCurrency"
          value={formData.clientCurrency}
          onChange={() => {}}
          readOnly
        />
      </div>
    </div>
  )
}