import { Building2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EORFormData, LocalOfficeInfo } from "../types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FORM_STYLES } from "../styles/constants"

interface LocalOfficeInformationProps {
  formData: EORFormData
  onLocalOfficeUpdate: (updates: Partial<LocalOfficeInfo>) => void
}

export const LocalOfficeInformation = ({
  formData,
  onLocalOfficeUpdate,
}: LocalOfficeInformationProps) => {
  const { localOfficeInfo, currency } = formData

  return (
    <div>
      <FormSectionHeader icon={Building2} title="Local Office Information" />
      <div className={FORM_STYLES.GRID_3_COL}>
        {/* Row 1 */}
        <div className="space-y-2">
          <Label
            htmlFor="mealVoucher"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Meal Voucher ({currency})
          </Label>
          <Input
            id="mealVoucher"
            value={localOfficeInfo.mealVoucher}
            onChange={(e) => onLocalOfficeUpdate({ mealVoucher: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="transportation"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Transportation ({currency})
          </Label>
          <Input
            id="transportation"
            value={localOfficeInfo.transportation}
            onChange={(e) => onLocalOfficeUpdate({ transportation: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="wfh"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            WFH
          </Label>
          <Input
            id="wfh"
            value={localOfficeInfo.wfh}
            onChange={(e) => onLocalOfficeUpdate({ wfh: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Row 2 */}
        <div className="space-y-2">
          <Label
            htmlFor="healthInsurance"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Health Insurance ({currency})
          </Label>
          <Input
            id="healthInsurance"
            value={localOfficeInfo.healthInsurance}
            onChange={(e) => onLocalOfficeUpdate({ healthInsurance: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="monthlyPaymentsToLocalOffice"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Monthly Payments to Local Office ({currency})
          </Label>
          <Input
            id="monthlyPaymentsToLocalOffice"
            value={localOfficeInfo.monthlyPaymentsToLocalOffice}
            onChange={(e) => onLocalOfficeUpdate({ monthlyPaymentsToLocalOffice: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="vat"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            VAT (%)
          </Label>
          <Input
            id="vat"
            value={localOfficeInfo.vat}
            onChange={(e) => onLocalOfficeUpdate({ vat: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Row 3 */}
        <div className="space-y-2">
          <Label
            htmlFor="preEmploymentMedicalTest"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Pre-Employment Medical Test ({currency})
          </Label>
          <Input
            id="preEmploymentMedicalTest"
            value={localOfficeInfo.preEmploymentMedicalTest}
            onChange={(e) => onLocalOfficeUpdate({ preEmploymentMedicalTest: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="drugTest"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Drug Test ({currency})
          </Label>
          <Input
            id="drugTest"
            value={localOfficeInfo.drugTest}
            onChange={(e) => onLocalOfficeUpdate({ drugTest: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="backgroundCheckViaDeel"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Background Check via Deel ({currency})
          </Label>
          <Input
            id="backgroundCheckViaDeel"
            value={localOfficeInfo.backgroundCheckViaDeel}
            onChange={(e) => onLocalOfficeUpdate({ backgroundCheckViaDeel: e.target.value })}
            placeholder="Awaiting configuration"
            disabled
            className="h-12 bg-slate-50 border-slate-200 text-slate-700"
          />
        </div>
      </div>
    </div>
  )
}