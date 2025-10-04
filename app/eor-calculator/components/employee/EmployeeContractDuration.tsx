import { memo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EORFormData } from "@/lib/shared/types"
import { FORM_STYLES } from "../../styles/constants"

interface EmployeeContractDurationProps {
  contractDuration: string
  contractDurationUnit: 'months' | 'years'
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const EmployeeContractDuration = memo(({
  contractDuration,
  contractDurationUnit,
  onFormUpdate
}: EmployeeContractDurationProps) => {

  const handleDurationChange = (value: string) => {
    // Only allow positive numbers
    const numValue = parseInt(value)
    if (value === '' || (numValue > 0 && numValue <= 999)) {
      onFormUpdate({ contractDuration: value })
    }
  }

  const handleUnitChange = (unit: 'months' | 'years') => {
    const currentValue = parseInt(contractDuration) || 12

    // Convert between units
    let newDuration: number
    if (contractDurationUnit === 'months' && unit === 'years') {
      // Converting months to years
      newDuration = Math.max(1, Math.round(currentValue / 12))
    } else if (contractDurationUnit === 'years' && unit === 'months') {
      // Converting years to months
      newDuration = currentValue * 12
    } else {
      newDuration = currentValue
    }

    onFormUpdate({
      contractDuration: String(newDuration),
      contractDurationUnit: unit
    })
  }

  const displayText = contractDurationUnit === 'years'
    ? `${contractDuration} year${parseInt(contractDuration) !== 1 ? 's' : ''} (${parseInt(contractDuration) * 12} months)`
    : `${contractDuration} month${parseInt(contractDuration) !== 1 ? 's' : ''}`

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_2_COL}>
        <div className="space-y-2">
          <Label htmlFor="contractDuration" className={FORM_STYLES.LABEL_BASE}>
            Contract Duration
          </Label>
          <Input
            id="contractDuration"
            type="number"
            min="1"
            max="999"
            value={contractDuration}
            onChange={(e) => handleDurationChange(e.target.value)}
            className={`${FORM_STYLES.INPUT_BASE} ${FORM_STYLES.INPUT_NORMAL}`}
            placeholder="12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractUnit" className={FORM_STYLES.LABEL_BASE}>
            MONTHS/YEARS
          </Label>
          <Select
            value={contractDurationUnit}
            onValueChange={handleUnitChange}
          >
            <SelectTrigger id="contractUnit" className={FORM_STYLES.SELECT_TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="months">Months</SelectItem>
              <SelectItem value="years">Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {displayText}
      </p>
    </div>
  )
})

EmployeeContractDuration.displayName = 'EmployeeContractDuration'
