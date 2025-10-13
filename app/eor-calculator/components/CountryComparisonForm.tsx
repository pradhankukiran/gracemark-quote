import { useMemo, memo, useRef, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Loader2, RefreshCw } from "lucide-react"
import { EORFormData } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { SmoothReveal } from "./shared/OptimizedReveal"
import { FORM_STYLES } from "../styles/constants"

interface CountryComparisonFormProps {
  country: string
  enableComparison: boolean
  compareCountry: string
  compareSalary: string
  compareCurrency: string
  countries: string[]
  isConverting: boolean
  conversionInfo: string | null
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onTriggerConversion: () => void
  onMarkAsManuallyEdited: () => void
  onClearConversionData: () => void
  onCompareCountryChange: (value: string) => void
  onClearComparisonLocalOffice: () => void
}

export const CountryComparisonForm = memo(({
  country,
  enableComparison,
  compareCountry,
  compareSalary,
  compareCurrency,
  countries,
  isConverting,
  conversionInfo,
  onFormUpdate,
  onTriggerConversion,
  onMarkAsManuallyEdited,
  onClearConversionData,
  onCompareCountryChange,
  onClearComparisonLocalOffice,
}: CountryComparisonFormProps) => {
  const comparisonCountryOptions = useMemo(() => 
    countries
      .filter((c) => c !== country),
    [countries, country]
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (enableComparison) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300) // Match animation duration
    }
  }, [enableComparison])

  return (
    <div ref={scrollRef}>
      <FormSectionHeader icon={MapPin} title="Country Comparison (Optional)" />

      <div className="space-y-4">
        <Label
          htmlFor="enableComparison"
          className={`
            flex items-center space-x-4 p-4 border-2 rounded-md cursor-pointer transition-all duration-200
            ${enableComparison
              ? 'border-primary bg-primary/5'
              : 'border-slate-200 hover:border-primary/50'
            }
          `}
        >
          <Checkbox
            id="enableComparison"
            checked={enableComparison}
            onCheckedChange={(checked) => {
              onFormUpdate({
                enableComparison: checked as boolean,
                compareCountry: "",
                compareState: "",
                compareCurrency: "",
                compareSalary: "",
              })
              onClearConversionData()
              onClearComparisonLocalOffice()
            }}
            className="h-5 w-5"
          />
          <span className="text-base font-medium text-slate-800">
            Compare with another country?
          </span>
        </Label>

        <SmoothReveal isVisible={enableComparison}>
          <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-md">
            <div className={FORM_STYLES.GRID_3_COL}>
              {/* Comparison Country */}
              <div className="space-y-2">
                <Label htmlFor="compareCountry" className={FORM_STYLES.LABEL_BASE}>
                  Comparison Country
                </Label>
                <Select
                  value={compareCountry}
                  onValueChange={onCompareCountryChange}
                >
                  <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {comparisonCountryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="compareCurrency" className={FORM_STYLES.LABEL_BASE}>
                  Currency
                </Label>
                <Input
                  id="compareCurrency"
                  value={compareCurrency}
                  readOnly
                  className="h-12 border-2 border-slate-200 bg-slate-50 text-slate-700"
                />
              </div>

              {/* Converted Base Salary */}
              <div className="space-y-2">
                <Label htmlFor="compareSalary" className={FORM_STYLES.LABEL_BASE}>
                  Converted Base Salary
                </Label>
                <div className="relative">
                  <Input
                    id="compareSalary"
                    type="number"
                    placeholder="Auto-converted salary"
                    value={compareSalary}
                    onChange={(e) => {
                      onFormUpdate({ compareSalary: e.target.value })
                      onMarkAsManuallyEdited()
                    }}
                    className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 pr-10"
                    disabled={isConverting}
                  />
                  <div className="absolute right-3 top-3 flex items-center">
                    {isConverting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                      compareSalary && (
                        <span title={conversionInfo || 'Re-convert salary'} className="cursor-pointer">
                          <RefreshCw
                            className="h-5 w-5 text-slate-400 hover:text-primary transition-colors"
                            onClick={onTriggerConversion}
                          />
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SmoothReveal>
      </div>
    </div>
  )
})

CountryComparisonForm.displayName = 'CountryComparisonForm'
