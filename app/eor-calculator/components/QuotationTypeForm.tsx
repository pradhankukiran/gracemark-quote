import { FileText } from "lucide-react"
import { EORFormData } from "../types"
import { FormSectionHeader } from "./shared/FormSectionHeader"

interface QuotationTypeFormProps {
  formData: EORFormData
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const QuotationTypeForm = ({ formData, onFormUpdate }: QuotationTypeFormProps) => {
  const quotationOptions = [
    {
      value: "all-inclusive" as const,
      title: "All Inclusive",
      subtitle: "include statutory benefits, contract termination costs, PTO and others..."
    },
    {
      value: "statutory-only" as const,
      title: "Only Statutory",
      subtitle: "include social security, taxes, and minimum legal benefits"
    }
  ]

  return (
    <div>
      <FormSectionHeader icon={FileText} title="Quotation Type" />
      <div className="space-y-4">
        {quotationOptions.map((option) => (
          <div key={option.value} className="relative">
            <label className="flex items-start gap-4 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-primary/50 transition-all duration-200 hover:bg-slate-50/50">
              <input
                type="radio"
                name="quoteType"
                value={option.value}
                checked={formData.quoteType === option.value}
                onChange={(e) => onFormUpdate({ quoteType: e.target.value as "all-inclusive" | "statutory-only" })}
                className="mt-1 w-4 h-4 text-primary border-slate-300 focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-slate-700 uppercase tracking-wide">
                  {option.title}
                </div>
                <div className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {option.subtitle}
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}