import { memo, useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EORFormData } from "../../types"
import { FORM_STYLES } from "../../styles/constants"
import { allCurrencies } from "@/lib/country-data"

interface EmployeeLocationInfoProps {
  formData: EORFormData
  countries: string[]
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onCountryChange: (country: string) => void
  onCurrencyOverride: (currency: string, conversionInfoCallback?: (info: string) => void) => void
  onCurrencyReset: () => void
}

export const EmployeeLocationInfo = memo(({ 
  formData, 
  countries,
  onFormUpdate,
  onCountryChange,
  onCurrencyOverride,
  onCurrencyReset
}: EmployeeLocationInfoProps) => {
  const [isEditingCurrency, setIsEditingCurrency] = useState(false)
  const [salaryConversionInfo, setSalaryConversionInfo] = useState<string | null>(null)

  const handleChangeClick = useCallback(() => {
    setIsEditingCurrency(true)
  }, [])

  const handleCurrencySelect = useCallback((newCurrency: string) => {
    // Don't proceed if same currency is selected
    if (newCurrency === formData.currency) {
      setIsEditingCurrency(false)
      return
    }
    
    onCurrencyOverride(newCurrency, setSalaryConversionInfo)
    setIsEditingCurrency(false)
  }, [formData.currency, onCurrencyOverride])

  // Reset editing state when country changes
  useEffect(() => {
    setIsEditingCurrency(false)
    setSalaryConversionInfo(null)
  }, [formData.country])

  // Clear salary conversion info after a delay
  useEffect(() => {
    if (salaryConversionInfo) {
      const timeout = setTimeout(() => {
        setSalaryConversionInfo(null)
      }, 5000) // Clear after 5 seconds

      return () => clearTimeout(timeout)
    }
  }, [salaryConversionInfo])

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label htmlFor="country" className={FORM_STYLES.LABEL_BASE}>
            Country
          </Label>
          <Select
            value={formData.country}
            onValueChange={onCountryChange}
          >
            <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="currency"
            className={FORM_STYLES.LABEL_BASE}
          >
            Currency
            {formData.isCurrencyManuallySet && (
              <span className="ml-2 text-xs text-blue-600 font-medium">
                (Custom)
              </span>
            )}
          </Label>
          
          {!isEditingCurrency ? (
            <div className="relative">
              <Input
                id="currency"
                value={formData.currency}
                readOnly
                className="h-12 border-2 border-slate-200 bg-slate-50 text-slate-700 pr-24"
              />
              {formData.country && (
                <button
                  type="button"
                  onClick={handleChangeClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleChangeClick()
                    }
                  }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-xs text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label="Change currency"
                >
                  Change?
                </button>
              )}
            </div>
          ) : (
            <Select value={formData.currency} onValueChange={handleCurrencySelect}>
              <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {allCurrencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {formData.isCurrencyManuallySet && formData.originalCurrency && (
            <button
              type="button"
              onClick={onCurrencyReset}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Reset to {formData.originalCurrency} (default for {formData.country})
            </button>
          )}

          {salaryConversionInfo && (
            <p className="text-green-600 text-sm mt-1 flex items-center">
              <span className="mr-1">✓</span>
              {salaryConversionInfo}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="workVisaRequired"
            className={FORM_STYLES.LABEL_BASE}
          >
            Work Visa Required
          </Label>
          <Select
            value={formData.workVisaRequired ? "true" : "false"}
            onValueChange={(value) => onFormUpdate({ workVisaRequired: value === "true" })}
          >
            <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
})

EmployeeLocationInfo.displayName = 'EmployeeLocationInfo'