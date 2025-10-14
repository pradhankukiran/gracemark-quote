import { useCallback, memo } from "react"
import type { ChangeEvent } from "react"
import { DollarSign } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

interface ContractDetailsFormProps {
  contractDuration: string
  contractDurationUnit: "months" | "years"
  paymentFrequency: string
  backgroundCheckRequired: boolean
  mspPercentage: string
  backgroundCheckMonthlyFee: string
  currency: string
  paymentFrequencies: Array<{ value: string; label: string }>
  onFormUpdate: (updates: Partial<ICFormData>) => void
}

export const ContractDetailsForm = memo(({
  contractDuration,
  contractDurationUnit,
  paymentFrequency,
  backgroundCheckRequired,
  mspPercentage,
  backgroundCheckMonthlyFee,
  currency,
  paymentFrequencies,
  onFormUpdate,
}: ContractDetailsFormProps) => {
  const handleContractDurationChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onFormUpdate({ contractDuration: event.target.value })
  }, [onFormUpdate])

  const handleContractDurationUnitChange = useCallback((unit: "months" | "years") => {
    if (unit === contractDurationUnit) {
      return
    }

    const numericValue = Number(contractDuration)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      onFormUpdate({ contractDurationUnit: unit })
      return
    }

    if (unit === "years") {
      const converted = numericValue / 12
      const formatted = Number.isInteger(converted)
        ? String(converted)
        : converted.toFixed(2).replace(/\.?0+$/, "")
      onFormUpdate({
        contractDuration: formatted,
        contractDurationUnit: unit,
      })
      return
    }

    const converted = numericValue * 12
    const rounded = Math.round(converted)
    onFormUpdate({
      contractDuration: String(rounded),
      contractDurationUnit: unit,
    })
  }, [contractDuration, contractDurationUnit, onFormUpdate])

  const handlePaymentFrequencyChange = useCallback((value: string) => {
    onFormUpdate({ paymentFrequency: value })
  }, [onFormUpdate])

  const handleBackgroundCheckChange = useCallback((checked: boolean) => {
    onFormUpdate({ backgroundCheckRequired: checked })
  }, [onFormUpdate])

  const handleMspPercentageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onFormUpdate({ mspPercentage: e.target.value })
  }, [onFormUpdate])

  return (
    <div>
      <FormSectionHeader
        icon={DollarSign}
        title="Contract Details"
        subtitle="Contract terms and additional services"
      />
      <div className={FORM_STYLES.GRID_2_COL}>
        <div className="space-y-2">
          <Label
            htmlFor="contractDuration"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Contract Duration
          </Label>
          <div className="flex gap-3">
            <Input
              id="contractDuration"
              type="number"
              min={contractDurationUnit === "months" ? "1" : "0.25"}
              step={contractDurationUnit === "months" ? "1" : "0.25"}
              value={contractDuration}
              onChange={handleContractDurationChange}
              placeholder={contractDurationUnit === "months" ? "12" : "1"}
              className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
            <Select
              value={contractDurationUnit}
              onValueChange={(value) => handleContractDurationUnitChange(value as "months" | "years")}
            >
              <SelectTrigger className="h-12 w-28 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="years">Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-slate-500">
            Enter the contract length based on the selected unit.
          </p>
        </div>
        <FormField
          type="select"
          label="Payment Frequency"
          htmlFor="paymentFrequency"
          value={paymentFrequency}
          onChange={handlePaymentFrequencyChange}
          options={paymentFrequencies}
          required
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-2">
          <Label
            htmlFor="msp-percentage"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            MSP Percentage (Optional)
          </Label>
          <div className="relative">
            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-semibold text-slate-500">
              %
            </span>
            <Input
              id="msp-percentage"
              type="number"
              step="0.1"
              min="0"
              value={mspPercentage}
              onChange={handleMspPercentageChange}
              placeholder="Enter MSP percentage (if applicable)"
              className="h-12 border-slate-200 text-slate-700 pr-16"
            />
          </div>
          <p className="text-sm text-slate-500">
            Example: NextSource 8%, Autodesk 2.5%. Leave blank if no MSP applies.
          </p>
        </div>
        <Label
          htmlFor="background-check"
          className="flex h-full items-start gap-3 p-3 border-2 rounded-md cursor-pointer transition-all duration-200 hover:border-primary/50"
        >
          <Checkbox
            id="background-check"
            checked={backgroundCheckRequired}
            onCheckedChange={handleBackgroundCheckChange}
            className="mt-1 h-5 w-5"
          />
          <div className="space-y-1">
            <span className="block text-base font-medium text-slate-800">
              Background Check Required
            </span>
            <p className="text-sm text-slate-600">
              One-time fee of $200 (amortized over contract duration)
            </p>
            {backgroundCheckRequired && backgroundCheckMonthlyFee && (
              <p className="text-sm text-slate-600">
                Approx. {currency}{" "}
                {Number(backgroundCheckMonthlyFee).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                {" "}per month
              </p>
            )}
          </div>
        </Label>
      </div>

      
    </div>
  )
})

ContractDetailsForm.displayName = 'ContractDetailsForm'
