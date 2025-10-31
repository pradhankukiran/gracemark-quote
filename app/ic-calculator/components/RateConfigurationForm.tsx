import { useMemo, useCallback, memo } from "react"
import { Calculator } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { Label } from "@/components/ui/label"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

type RateConversionMessage = { type: "success" | "error"; text: string } | null

interface RateConfigurationFormProps {
  rateBasis: "hourly" | "monthly"
  rateAmount: string
  rateConversionMessage: RateConversionMessage
  onFormUpdate: (updates: Partial<ICFormData>) => void
  currency: string
  totalMonthlyHours: string
  markupPercentage: string
}

export const RateConfigurationForm = memo(({
  rateBasis,
  rateAmount,
  rateConversionMessage,
  onFormUpdate,
  currency,
  totalMonthlyHours,
  markupPercentage,
}: RateConfigurationFormProps) => {
  const rateBasisOptions = useMemo(() => [
    { value: "hourly", label: "Hourly" },
    { value: "monthly", label: "Monthly" },
  ], [])

  const handleRateBasisChange = useCallback((value: string) => {
    onFormUpdate({ rateBasis: value as "hourly" | "monthly" })
  }, [onFormUpdate])

  const handleRateAmountChange = useCallback((value: string) => {
    onFormUpdate({ rateAmount: value })
  }, [onFormUpdate])

  const handleTotalMonthlyHoursChange = useCallback((value: string) => {
    onFormUpdate({ totalMonthlyHours: value })
  }, [onFormUpdate])

  const handleMarkupPercentageChange = useCallback((value: string) => {
    onFormUpdate({ markupPercentage: value })
  }, [onFormUpdate])

  const getRateLabel = () => {
    const unit = rateBasis === "hourly" ? "hour" : "month"
    return `Pay Rate (per ${unit})`
  }

  const getRatePlaceholder = () => {
    if (rateBasis === "monthly") {
      return "8000"
    }
    return "50"
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
          label="Rate Basis"
          htmlFor="rateBasis"
          value={rateBasis}
          onChange={handleRateBasisChange}
          options={rateBasisOptions}
          required
        />
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE} htmlFor="rateAmount">
            {getRateLabel()}
          </Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-semibold text-slate-500">
              {currency}
            </span>
            <input
              id="rateAmount"
              value={rateAmount}
              onChange={(event) => handleRateAmountChange(event.target.value)}
              placeholder={getRatePlaceholder()}
              required
              type="number"
              className="h-12 w-full rounded-md border-2 border-slate-200 bg-white pl-16 pr-4 text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className={FORM_STYLES.LABEL_BASE} htmlFor="markupPercentage">
            Markup Percentage
          </Label>
          <div className="relative">
            <input
              id="markupPercentage"
              value={markupPercentage}
              onChange={(event) => handleMarkupPercentageChange(event.target.value)}
              placeholder="40"
              type="number"
              step="0.1"
              min="0"
              className="h-12 w-full rounded-md border-2 border-slate-200 bg-white pr-12 pl-4 text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-semibold text-slate-500">
              %
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Adjust if the client requires a different margin (e.g. 25% for discounted engagements).
          </p>
        </div>

        <div className="space-y-2">
        <Label className={FORM_STYLES.LABEL_BASE} htmlFor="totalMonthlyHours">
          Total Monthly Hours
        </Label>
        <input
          id="totalMonthlyHours"
          value={totalMonthlyHours}
          onChange={(event) => handleTotalMonthlyHoursChange(event.target.value)}
          placeholder="160"
          type="number"
          min="1"
          max="160"
          className="h-12 w-full rounded-md border-2 border-slate-200 bg-white px-4 text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
        <p className="text-sm text-slate-500">
          Standard conversions assume 160 hours. Adjust if the contractor works fewer hours per month.
        </p>
      </div>
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
