import { memo, useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EORFormData } from "@/lib/shared/types"
import { FORM_STYLES } from "../../styles/constants"
import { allCurrencies } from "@/lib/country-data"

interface EmployeeLocationInfoProps {
  country: string
  currency: string
  isCurrencyManuallySet: boolean
  originalCurrency: string | null
  workVisaRequired: boolean
  countries: string[]
  onFormUpdate: (updates: Partial<EORFormData>) => void
  onCountryChange: (country: string) => void
  onCurrencyOverride: (currency: string) => void
  onCurrencyReset: () => void
}

export const EmployeeLocationInfo = memo(({ 
  country,
  currency,
  isCurrencyManuallySet,
  originalCurrency,
  workVisaRequired,
  countries,
  onFormUpdate,
  onCountryChange,
  onCurrencyOverride,
  onCurrencyReset
}: EmployeeLocationInfoProps) => {
  const [isEditingCurrency, setIsEditingCurrency] = useState(false)

  const handleChangeClick = useCallback(() => {
    setIsEditingCurrency(true)
  }, [])

  const handleCurrencySelect = useCallback((newCurrency: string) => {
    if (newCurrency === currency) {
      setIsEditingCurrency(false)
      return
    }
    
    onCurrencyOverride(newCurrency)
    setIsEditingCurrency(false)
  }, [currency, onCurrencyOverride])

  useEffect(() => {
    setIsEditingCurrency(false)
  }, [country])

  return (
    <div className="mb-6">
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label htmlFor="country" className={FORM_STYLES.LABEL_BASE}>
            Country
          </Label>
          <Select
            value={country}
            onValueChange={onCountryChange}
          >
            <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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
            {isCurrencyManuallySet && (
              <span className="ml-2 text-xs text-blue-600 font-medium">
                (Custom)
              </span>
            )}
          </Label>
          
          {!isEditingCurrency ? (
            <div className="relative">
              <Input
                id="currency"
                value={currency}
                readOnly
                className="h-12 border-2 border-slate-200 bg-slate-50 text-slate-700 pr-24"
              />
              {country && (
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
            <Select value={currency} onValueChange={handleCurrencySelect}>
              <SelectTrigger className="!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {allCurrencies.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {isCurrencyManuallySet && originalCurrency && (
            <button
              type="button"
              onClick={onCurrencyReset}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Reset to {originalCurrency} (default for {country})
            </button>
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
            value={workVisaRequired ? "true" : "false"}
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