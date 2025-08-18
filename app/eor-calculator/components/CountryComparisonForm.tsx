import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Loader2 } from "lucide-react"
import { getStateTypeLabel } from "@/lib/country-data"
import { EORFormData } from "../types"

interface CountryComparisonFormProps {
  formData: EORFormData
  countries: string[]
  compareAvailableStates: Array<{ code: string; name: string }>
  showCompareStateDropdown: boolean
  compareCountryCode?: string
  isConverting: boolean
  conversionInfo: string | null
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onTriggerConversion: () => void
  onMarkAsManuallyEdited: () => void
  onClearConversionData: () => void
}

export const CountryComparisonForm = ({
  formData,
  countries,
  compareAvailableStates,
  showCompareStateDropdown,
  compareCountryCode,
  isConverting,
  conversionInfo,
  onFormUpdate,
  onTriggerConversion,
  onMarkAsManuallyEdited,
  onClearConversionData,
}: CountryComparisonFormProps) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Country Comparison</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="enableComparison"
            checked={formData.enableComparison}
            onCheckedChange={(checked) => {
              onFormUpdate({
                enableComparison: checked as boolean,
                compareCountry: "",
                compareState: "",
                compareCurrency: "",
                compareSalary: "",
              })
              onClearConversionData()
            }}
          />
          <Label htmlFor="enableComparison" className="text-sm font-medium text-slate-700">
            Compare with another country
          </Label>
        </div>

        {formData.enableComparison && (
          <div className="p-4 bg-slate-50 border-2 border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Comparison Country
            </h4>
            <div className={`grid gap-4 ${showCompareStateDropdown ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              <div className="space-y-2">
                <Label htmlFor="compareCountry" className="text-sm font-medium text-slate-600">
                  Country
                </Label>
                <Select
                  value={formData.compareCountry}
                  onValueChange={(value) => onFormUpdate({ compareCountry: value })}
                >
                  <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                    <SelectValue placeholder="Select country to compare" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries
                      .filter((country) => country !== formData.country)
                      .map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {showCompareStateDropdown && (
                <div className="space-y-2">
                  <Label htmlFor="compareState" className="text-sm font-medium text-slate-600">
                    {getStateTypeLabel(compareCountryCode || "")}
                  </Label>
                  <Select
                    value={formData.compareState}
                    onValueChange={(value) => onFormUpdate({ compareState: value })}
                  >
                    <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                      <SelectValue
                        placeholder={`Select ${getStateTypeLabel(compareCountryCode || "").toLowerCase()}`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {compareAvailableStates.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="compareCurrency" className="text-sm font-medium text-slate-600">
                  Currency
                </Label>
                <Input
                  id="compareCurrency"
                  value={formData.compareCurrency}
                  readOnly
                  className="h-12 border-2 border-slate-200 bg-slate-50 text-slate-600"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h5 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Comparison Salary
              </h5>
              <div className="space-y-2">
                <Label
                  htmlFor="compareSalary"
                  className="text-base font-semibold text-slate-700 uppercase tracking-wide block"
                >
                  Annual Base Salary ({formData.compareCurrency})
                </Label>
                <div className="relative">
                  <Input
                    id="compareSalary"
                    type="number"
                    placeholder={`Enter annual salary amount in ${formData.compareCurrency}`}
                    value={formData.compareSalary}
                    onChange={(e) => {
                      onFormUpdate({ compareSalary: e.target.value })
                      onMarkAsManuallyEdited()
                    }}
                    className="h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    disabled={isConverting}
                  />
                  {isConverting && (
                    <div className="absolute right-3 top-3">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
                {conversionInfo && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border">
                    ℹ️ {conversionInfo}
                  </p>
                )}
                {formData.baseSalary &&
                  formData.currency &&
                  formData.compareCurrency &&
                  formData.currency !== formData.compareCurrency &&
                  !conversionInfo &&
                  !formData.compareSalary &&
                  !isConverting && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onTriggerConversion}
                      className="text-xs h-8"
                    >
                      Convert from {formData.currency}
                    </Button>
                  )}
                {formData.baseSalary &&
                  formData.currency &&
                  formData.compareCurrency &&
                  formData.currency !== formData.compareCurrency &&
                  !conversionInfo &&
                  formData.compareSalary &&
                  !isConverting && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onTriggerConversion}
                      className="text-xs h-8 text-slate-500"
                    >
                      Re-convert from {formData.currency}
                    </Button>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}