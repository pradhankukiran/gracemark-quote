import { memo } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EORFormData } from "@/lib/shared/types"
import { FORM_STYLES } from "../../styles/constants"

interface EmployeeContractTypeProps {
  contractType: 'remote' | 'hybrid' | 'on-site'
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const EmployeeContractType = memo(({
  contractType,
  onFormUpdate
}: EmployeeContractTypeProps) => {

  const handleContractTypeChange = (value: 'remote' | 'hybrid' | 'on-site') => {
    onFormUpdate({ contractType: value })
  }

  return (
    <div className="mb-6">
      <div className="space-y-2">
        <Label htmlFor="contractType" className={FORM_STYLES.LABEL_BASE}>
          Contract Type
        </Label>
        <Select
          value={contractType}
          onValueChange={handleContractTypeChange}
        >
          <SelectTrigger id="contractType" className={FORM_STYLES.SELECT_TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="on-site">On-site</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})

EmployeeContractType.displayName = 'EmployeeContractType'
