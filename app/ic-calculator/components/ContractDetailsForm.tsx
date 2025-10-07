import { useCallback, memo } from "react"
import { DollarSign } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

interface ContractDetailsFormProps {
  contractDuration: string
  paymentFrequency: string
  complianceLevel: string
  backgroundCheckRequired: boolean
  mspFee: string
  backgroundCheckMonthlyFee: string
  currency: string
  contractDurations: Array<{ value: string; label: string }>
  paymentFrequencies: Array<{ value: string; label: string }>
  complianceLevels: Array<{ value: string; label: string }>
  onFormUpdate: (updates: Partial<ICFormData>) => void
}

export const ContractDetailsForm = memo(({
  contractDuration,
  paymentFrequency,
  complianceLevel,
  backgroundCheckRequired,
  mspFee,
  backgroundCheckMonthlyFee,
  currency,
  contractDurations,
  paymentFrequencies,
  complianceLevels,
  onFormUpdate,
}: ContractDetailsFormProps) => {
  const handleContractDurationChange = useCallback((value: string) => {
    onFormUpdate({ contractDuration: value })
  }, [onFormUpdate])

  const handlePaymentFrequencyChange = useCallback((value: string) => {
    onFormUpdate({ paymentFrequency: value })
  }, [onFormUpdate])

  const handleComplianceLevelChange = useCallback((value: string) => {
    onFormUpdate({ complianceLevel: value })
  }, [onFormUpdate])

  const handleBackgroundCheckChange = useCallback((checked: boolean) => {
    onFormUpdate({ backgroundCheckRequired: checked })
  }, [onFormUpdate])

  const handleMspFeeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onFormUpdate({ mspFee: e.target.value })
  }, [onFormUpdate])

  return (
    <div>
      <FormSectionHeader
        icon={DollarSign}
        title="Contract Details"
        subtitle="Contract terms and additional services"
      />
      <div className={FORM_STYLES.GRID_2_COL}>
        <FormField
          type="select"
          label="Contract Duration"
          htmlFor="contractDuration"
          value={contractDuration}
          onChange={handleContractDurationChange}
          options={contractDurations}
          required
        />
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

      <div className="mt-4 space-y-2">
        <Label
          htmlFor="msp-fee"
          className="text-base font-semibold text-slate-700 uppercase tracking-wide"
        >
          MSP Fee (Optional)
        </Label>
        <Input
          id="msp-fee"
          type="number"
          value={mspFee}
          onChange={handleMspFeeChange}
          placeholder="Enter MSP fee amount (if applicable)"
          className="h-12 border-slate-200 text-slate-700"
        />
        <p className="text-sm text-slate-500">
          Monthly Managed Service Provider fee for applicable clients
        </p>
      </div>

      <div className="mt-4">
        <Label
          htmlFor="background-check"
          className="flex items-center space-x-3 p-3 border-2 rounded-md cursor-pointer transition-all duration-200 hover:border-primary/50"
        >
          <Checkbox
            id="background-check"
            checked={backgroundCheckRequired}
            onCheckedChange={handleBackgroundCheckChange}
            className="h-5 w-5"
          />
          <div>
            <span className="text-base font-medium text-slate-800">
              Background Check Required
            </span>
            <p className="text-sm text-slate-600 mt-1">
              One-time fee of $200 (amortized over contract duration)
            </p>
            {backgroundCheckRequired && backgroundCheckMonthlyFee && (
              <p className="text-sm text-slate-600 mt-1">
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

      <div className="mt-4 space-y-2">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Bill Rate is calculated as Pay Rate × 1.40 (40% GMK markup)
          </p>
        </div>
      </div>
    </div>
  )
})

ContractDetailsForm.displayName = 'ContractDetailsForm'
