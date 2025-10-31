import { useMemo, memo } from "react"
import { FileText, CheckCircle2 } from "lucide-react"
import { EORFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"

interface QuotationTypeFormProps {
  quoteType: "all-inclusive" | "statutory-only"
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const QuotationTypeForm = memo(({ quoteType, onFormUpdate }: QuotationTypeFormProps) => {
  const quotationOptions = useMemo(() => [
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
  ], [])

  return (
    <div>
      <FormSectionHeader icon={FileText} title="Quotation Type" />
      <div className="grid md:grid-cols-2 gap-4">
        {quotationOptions.map((option) => (
          <div key={option.value} className="relative">
            <label className={`
              flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 h-full
              ${quoteType === option.value
                ? 'border-primary bg-primary/5'
                : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50/50'
              }
            `}>
              {quoteType === option.value && (
                <div className="absolute top-2 right-2 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <input
                type="radio"
                name="quoteType"
                value={option.value}
                checked={quoteType === option.value}
                onChange={(e) => onFormUpdate({ quoteType: e.target.value as "all-inclusive" | "statutory-only" })}
                className="sr-only"
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
});

QuotationTypeForm.displayName = 'QuotationTypeForm';