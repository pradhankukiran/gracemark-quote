import { useMemo, useCallback, memo } from "react"
import { User } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface ContractorInfoFormProps {
  contractorName: string
  country: string
  currency: string
  displayInUSD: boolean
  countries: string[]
  onFormUpdate: (updates: Partial<ICFormData>) => void
  onCountryChange: (country: string) => void
  onCurrencyToggle: (useUSD: boolean) => void
}

export const ContractorInfoForm = memo(({
  contractorName,
  country,
  currency,
  displayInUSD,
  countries,
  onFormUpdate,
  onCountryChange,
  onCurrencyToggle,
}: ContractorInfoFormProps) => {

  const countryOptions = useMemo(() =>
    countries.map(country => ({ value: country, label: country })),
    [countries]
  )

  const handleContractorNameChange = useCallback((value: string) => {
    onFormUpdate({ contractorName: value })
  }, [onFormUpdate])

  const handleCountryChange = useCallback((value: string) => {
    onCountryChange(value)
  }, [onCountryChange])

  const handleCurrencyToggle = useCallback((checked: boolean) => {
    onCurrencyToggle(checked)
  }, [onCurrencyToggle])

  const displayCurrency = displayInUSD ? "USD" : currency

  return (
    <div>
      <FormSectionHeader
        icon={User}
        title="Contractor Information"
        subtitle="Basic details about the independent contractor"
      />
      <div className={FORM_STYLES.GRID_3_COL}>
        <FormField
          type="input"
          label="Contractor Name"
          htmlFor="contractorName"
          value={contractorName}
          onChange={handleContractorNameChange}
          placeholder="Enter contractor name"
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
          value={displayCurrency}
          onChange={() => {}} // Currency is auto-updated based on country
          readOnly
        />
      </div>

      {currency !== "USD" && country && (
        <div className="mt-4">
          <Label
            htmlFor="currency-toggle"
            className="flex items-center gap-3 p-3 border-2 rounded-md cursor-pointer transition-all duration-200 hover:border-primary/50"
          >
            <Checkbox
              id="currency-toggle"
              checked={displayInUSD}
              onCheckedChange={handleCurrencyToggle}
              className="h-5 w-5"
            />
            <div className="space-y-1">
              <span className="block text-base font-medium text-slate-800">
                Display amounts in USD
              </span>
              <p className="text-sm text-slate-600">
                Toggle to view and input all monetary values in USD instead of {currency}
              </p>
            </div>
          </Label>
        </div>
      )}
    </div>
  )
})

ContractorInfoForm.displayName = 'ContractorInfoForm'
