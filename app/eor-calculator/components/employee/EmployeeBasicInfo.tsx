import { memo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EORFormData } from "../../types"
import { FORM_STYLES } from "../../styles/constants"
import { useDebouncedFormField } from "../../hooks/useDebouncedInput"

interface EmployeeBasicInfoProps {
  formData: EORFormData
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const EmployeeBasicInfo = memo(({ 
  formData, 
  onFormUpdate 
}: EmployeeBasicInfoProps) => {
  const employeeName = useDebouncedFormField(
    formData.employeeName,
    (value: string) => onFormUpdate({ employeeName: value })
  )

  const jobTitle = useDebouncedFormField(
    formData.jobTitle,
    (value: string) => onFormUpdate({ jobTitle: value })
  )

  return (
    <div className={`${FORM_STYLES.GRID_3_COL} mb-6`}>
      <div className="space-y-2">
        <Label
          htmlFor="employeeName"
          className={FORM_STYLES.LABEL_BASE}
        >
          Employee Name
        </Label>
        <Input
          id="employeeName"
          value={employeeName.value}
          onChange={(e) => employeeName.handleChange(e.target.value)}
          placeholder="John Doe"
          className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="jobTitle"
          className={FORM_STYLES.LABEL_BASE}
        >
          Job Title
        </Label>
        <Input
          id="jobTitle"
          value={jobTitle.value}
          onChange={(e) => jobTitle.handleChange(e.target.value)}
          placeholder="Software Engineer"
          className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="employmentType"
          className={FORM_STYLES.LABEL_BASE}
        >
          Employment Type
        </Label>
        <Select
          value={formData.employmentType}
          onValueChange={(value) => onFormUpdate({ employmentType: value })}
        >
          <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full-time">Full-time</SelectItem>
            <SelectItem value="part-time">Part-time</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})

EmployeeBasicInfo.displayName = 'EmployeeBasicInfo'