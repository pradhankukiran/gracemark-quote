import { useMemo, useCallback, memo } from "react"
import { User } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

interface ContractorInfoFormProps {
  contractorName: string
  serviceType: string
  country: string
  currency: string
  serviceTypes: string[]
  countries: string[]
  onFormUpdate: (updates: Partial<ICFormData>) => void
  onCountryChange: (country: string) => void
}

export const ContractorInfoForm = memo(({
  contractorName,
  serviceType,
  country,
  currency,
  serviceTypes,
  countries,
  onFormUpdate,
  onCountryChange,
}: ContractorInfoFormProps) => {
  const serviceTypeOptions = useMemo(() =>
    serviceTypes.map(type => ({ value: type, label: type })),
    [serviceTypes]
  )

  const countryOptions = useMemo(() =>
    countries.map(country => ({ value: country, label: country })),
    [countries]
  )

  const handleContractorNameChange = useCallback((value: string) => {
    onFormUpdate({ contractorName: value })
  }, [onFormUpdate])

  const handleServiceTypeChange = useCallback((value: string) => {
    onFormUpdate({ serviceType: value })
  }, [onFormUpdate])

  const handleCountryChange = useCallback((value: string) => {
    onCountryChange(value)
  }, [onCountryChange])

  return (
    <div>
      <FormSectionHeader
        icon={User}
        title="Contractor Information"
        subtitle="Basic details about the independent contractor"
      />
      <div className={FORM_STYLES.GRID_2_COL}>
        <FormField
          type="input"
          label="Contractor Name"
          htmlFor="contractorName"
          value={contractorName}
          onChange={handleContractorNameChange}
          placeholder="Enter contractor name"
          required
        />
        <FormField
          type="select"
          label="Service Type"
          htmlFor="serviceType"
          value={serviceType}
          onChange={handleServiceTypeChange}
          placeholder="Select service type"
          options={serviceTypeOptions}
          required
        />
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
        <FormField
          type="input"
          label="Currency"
          htmlFor="currency"
          value={currency}
          onChange={() => {}} // Currency is auto-updated based on country
          readOnly
        />
      </div>
    </div>
  )
})

ContractorInfoForm.displayName = 'ContractorInfoForm'