import { useMemo, useCallback, memo } from "react"
import { Calculator } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

interface RateConfigurationFormProps {
  rateType: "pay-rate" | "bill-rate"
  rateAmount: string
  onFormUpdate: (updates: Partial<ICFormData>) => void
}

export const RateConfigurationForm = memo(({
  rateType,
  rateAmount,
  onFormUpdate,
}: RateConfigurationFormProps) => {
  const rateTypeOptions = useMemo(() => [
    { value: "pay-rate", label: "Pay Rate (What contractor receives)" },
    { value: "bill-rate", label: "Bill Rate (What client pays)" }
  ], [])

  const handleRateTypeChange = useCallback((value: string) => {
    onFormUpdate({ rateType: value as "pay-rate" | "bill-rate" })
  }, [onFormUpdate])

  const handleRateAmountChange = useCallback((value: string) => {
    onFormUpdate({ rateAmount: value })
  }, [onFormUpdate])

  const getRateLabel = () => {
    return rateType === "pay-rate" ? "Pay Rate (per hour)" : "Bill Rate (per hour)"
  }

  const getRatePlaceholder = () => {
    return rateType === "pay-rate" ? "50" : "75"
  }

  return (
    <div>
      <FormSectionHeader
        icon={Calculator}
        title="Rate Configuration"
        subtitle="Configure the hourly rate structure for the contract"
      />
      <div className={FORM_STYLES.GRID_2_COL}>
        <FormField
          type="select"
          label="Rate Type"
          htmlFor="rateType"
          value={rateType}
          onChange={handleRateTypeChange}
          options={rateTypeOptions}
          required
        />
        <FormField
          type="input"
          label={getRateLabel()}
          htmlFor="rateAmount"
          value={rateAmount}
          onChange={handleRateAmountChange}
          placeholder={getRatePlaceholder()}
          required
        />
      </div>
      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <p className="text-sm text-slate-600">
          <strong>Rate Type Explanation:</strong>
        </p>
        <ul className="text-sm text-slate-600 mt-1 ml-4 list-disc space-y-1">
          <li><strong>Pay Rate:</strong> The amount the contractor receives per hour (before platform fees)</li>
          <li><strong>Bill Rate:</strong> The total amount charged to the client per hour (includes all fees)</li>
        </ul>
      </div>
    </div>
  )
})

RateConfigurationForm.displayName = 'RateConfigurationForm'