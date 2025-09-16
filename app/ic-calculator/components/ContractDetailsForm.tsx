import { useCallback, memo } from "react"
import { DollarSign } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

interface ContractDetailsFormProps {
  contractDuration: string
  paymentFrequency: string
  complianceLevel: string
  backgroundCheckRequired: boolean
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

  return (
    <div>
      <FormSectionHeader
        icon={DollarSign}
        title="Contract Details"
        subtitle="Contract terms and additional services"
      />
      <div className={FORM_STYLES.GRID_3_COL}>
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
        <FormField
          type="select"
          label="Compliance Level"
          htmlFor="complianceLevel"
          value={complianceLevel}
          onChange={handleComplianceLevelChange}
          options={complianceLevels}
          required
        />
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
          </div>
        </Label>
      </div>

      <div className="mt-4 space-y-2">
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Compliance Level Details:</strong>
          </p>
          <ul className="text-sm text-yellow-700 mt-1 ml-4 list-disc space-y-1">
            <li><strong>Standard (1%):</strong> Basic compliance monitoring and documentation</li>
            <li><strong>Premium (2%):</strong> Enhanced compliance with additional legal support and monitoring</li>
          </ul>
        </div>
      </div>
    </div>
  )
})

ContractDetailsForm.displayName = 'ContractDetailsForm'