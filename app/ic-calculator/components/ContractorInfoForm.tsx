import { useMemo, useCallback, memo } from "react"
import { User } from "lucide-react"
import { ICFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "../../eor-calculator/components/shared/FormSectionHeader"
import { FormField } from "../../eor-calculator/components/shared/FormField"
import { FORM_STYLES } from "../../eor-calculator/styles/constants"

interface ContractorInfoFormProps {
  contractorName: string
  serviceType: string
  serviceTypes: string[]
  onFormUpdate: (updates: Partial<ICFormData>) => void
}

export const ContractorInfoForm = memo(({
  contractorName,
  serviceType,
  serviceTypes,
  onFormUpdate,
}: ContractorInfoFormProps) => {
  const serviceTypeOptions = useMemo(() =>
    serviceTypes.map(type => ({ value: type, label: type })),
    [serviceTypes]
  )

  const handleContractorNameChange = useCallback((value: string) => {
    onFormUpdate({ contractorName: value })
  }, [onFormUpdate])

  const handleServiceTypeChange = useCallback((value: string) => {
    onFormUpdate({ serviceType: value })
  }, [onFormUpdate])

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
      </div>
    </div>
  )
})

ContractorInfoForm.displayName = 'ContractorInfoForm'