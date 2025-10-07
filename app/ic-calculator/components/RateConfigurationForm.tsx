import { useMemo, useCallback, memo } from "react"
import { Calculator } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

type RateConversionMessage = { type: "success" | "error"; text: string } | null

interface RateConfigurationFormProps {
  rateType: "pay-rate" | "bill-rate"
  rateBasis: "hourly" | "monthly"
  rateAmount: string
  rateConversionMessage: RateConversionMessage
  onFormUpdate: (updates: Partial<ICFormData>) => void
}

export const RateConfigurationForm = memo(({
  rateType,
  rateBasis,
  rateAmount,
  rateConversionMessage,
  onFormUpdate,
}: RateConfigurationFormProps) => {
  const rateTypeOptions = useMemo(() => [
    { value: "pay-rate", label: "Pay Rate (What contractor receives)" },
    { value: "bill-rate", label: "Bill Rate (What client pays)" }
  ], [])

  const rateBasisOptions = useMemo(() => [
    { value: "hourly", label: "Hourly" },
    { value: "monthly", label: "Monthly" },
  ], [])

  const handleRateTypeChange = useCallback((value: string) => {
    onFormUpdate({ rateType: value as "pay-rate" | "bill-rate" })
  }, [onFormUpdate])

  const handleRateBasisChange = useCallback((value: string) => {
    onFormUpdate({ rateBasis: value as "hourly" | "monthly" })
  }, [onFormUpdate])

  const handleRateAmountChange = useCallback((value: string) => {
    onFormUpdate({ rateAmount: value })
  }, [onFormUpdate])

  const getRateLabel = () => {
    const unit = rateBasis === "hourly" ? "hour" : "month"
    return rateType === "pay-rate"
      ? `Pay Rate (per ${unit})`
      : `Bill Rate (per ${unit})`
  }

  const getRatePlaceholder = () => {
    if (rateBasis === "monthly") {
      return rateType === "pay-rate" ? "8000" : "11000"
    }
    return rateType === "pay-rate" ? "50" : "75"
  }

  return (
    <div>
      <FormSectionHeader
        icon={Calculator}
        title="Rate Configuration"
        subtitle="Configure the rate structure for the contract"
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
          type="select"
          label="Rate Basis"
          htmlFor="rateBasis"
          value={rateBasis}
          onChange={handleRateBasisChange}
          options={rateBasisOptions}
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
          className="md:col-span-2"
        />
      </div>
      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <p className="text-sm text-slate-600">
          <strong>Rate Type Explanation:</strong>
        </p>
        <ul className="text-sm text-slate-600 mt-1 ml-4 list-disc space-y-1">
          <li><strong>Pay Rate:</strong> The amount the contractor receives before fees (per hour or per month, based on the selected basis)</li>
          <li><strong>Bill Rate:</strong> The total amount charged to the client (per hour or per month, matching the selected basis)</li>
        </ul>
      </div>
      {rateConversionMessage && (
        <div
          className={`mt-3 p-3 rounded-md border text-sm ${
            rateConversionMessage.type === "success"
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {rateConversionMessage.text}
        </div>
      )}
    </div>
  )
})

RateConfigurationForm.displayName = 'RateConfigurationForm'
