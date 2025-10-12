import { memo, useMemo, useEffect, useRef } from "react"
import { Building2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LocalOfficeInfo } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FORM_STYLES } from "../styles/constants"
import { getOriginalLocalOfficeData } from "@/lib/shared/utils/localOfficeData"
import { useLocalOfficeConversion, getConvertedLocalOfficeValue } from "../hooks/useLocalOfficeConversion"
// import { LoadingSpinner } from "./shared/LoadingSpinner" // Unused

interface LocalOfficeInformationProps {
  localOfficeInfo: LocalOfficeInfo
  isCurrencyManuallySet: boolean
  originalCurrency: string | null
  currency: string
  onLocalOfficeUpdate: (updates: Partial<LocalOfficeInfo>) => void
  onConversionStatusChange?: (isConverting: boolean) => void
  countryCode?: string
}

export const LocalOfficeInformation = memo(({
  localOfficeInfo,
  isCurrencyManuallySet,
  originalCurrency,
  currency,
  onLocalOfficeUpdate,
  onConversionStatusChange,
  countryCode,
}: LocalOfficeInformationProps) => {
  // Memoize originalData to prevent recreating the object on every render
  const originalData = useMemo(() =>
    countryCode ? getOriginalLocalOfficeData(countryCode) : null,
    [countryCode]
  )

  const {
    convertedLocalOffice,
    isConvertingLocalOffice,
    conversionKey,
  } = useLocalOfficeConversion({
    originalData,
    countryCode: countryCode || null,
    formCurrency: currency,
    isCurrencyManuallySet: isCurrencyManuallySet,
    originalCurrency: originalCurrency,
  })

  // Notify parent of conversion status changes
  useEffect(() => {
    if (onConversionStatusChange) {
      onConversionStatusChange(isConvertingLocalOffice)
    }
  }, [isConvertingLocalOffice, onConversionStatusChange])

  // Track the last conversion key to prevent duplicate updates
  const lastAppliedConversionKeyRef = useRef<string>('')

  // Apply converted values to form state when conversion completes
  useEffect(() => {
    // Don't update if still converting
    if (isConvertingLocalOffice) {
      return
    }

    // Don't update if we've already applied this conversion
    if (conversionKey === lastAppliedConversionKeyRef.current) {
      return
    }

    // Don't update if no converted values
    if (Object.keys(convertedLocalOffice).length === 0) {
      return
    }

    // Update form state with converted values
    const updates: Partial<LocalOfficeInfo> = {}
    Object.keys(convertedLocalOffice).forEach(key => {
      const field = key as keyof LocalOfficeInfo
      const convertedValue = convertedLocalOffice[field]
      if (convertedValue && convertedValue !== 'N/A' && convertedValue !== '') {
        updates[field] = convertedValue
      }
    })

    if (Object.keys(updates).length > 0) {
      onLocalOfficeUpdate(updates)
      lastAppliedConversionKeyRef.current = conversionKey
    }
  }, [convertedLocalOffice, isConvertingLocalOffice, conversionKey, onLocalOfficeUpdate])

  const getDisplayCurrency = () => {
    return currency
  }

  const getDisplayValue = (field: keyof LocalOfficeInfo) => {
    // Show form state value (which includes converted values after update)
    const formValue = localOfficeInfo[field]
    if (formValue && formValue !== 'N/A' && formValue !== '') {
      return formValue
    }

    // Fall back to original data while converting or if no form value
    return originalData?.[field] || ''
  }

  const getPlaceholder = (field: keyof LocalOfficeInfo) => {
    const value = getDisplayValue(field)
    if (isConvertingLocalOffice) return 'Converting...'
    return value === 'N/A' ? 'N/A' : (value || 'Enter amount')
  }

  const isFieldDisabled = (field: keyof LocalOfficeInfo) => {
    const value = getDisplayValue(field)
    return value === 'N/A' || isConvertingLocalOffice
  }

  const handleFieldUpdate = (field: keyof LocalOfficeInfo, value: string) => {
    // When user manually edits, update form state
    onLocalOfficeUpdate({ [field]: value })
  }

  return (
    <div>
      <FormSectionHeader icon={Building2} title="Local Office Information" />
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label
            htmlFor="mealVoucher"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Meal Voucher ({getDisplayCurrency()})
          </Label>
          <Input
            id="mealVoucher"
            value={getDisplayValue('mealVoucher')}
            onChange={(e) => handleFieldUpdate('mealVoucher', e.target.value)}
            placeholder={getPlaceholder('mealVoucher')}
            disabled={isFieldDisabled('mealVoucher')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('mealVoucher') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="transportation"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Transportation ({getDisplayCurrency()})
          </Label>
          <Input
            id="transportation"
            value={getDisplayValue('transportation')}
            onChange={(e) => handleFieldUpdate('transportation', e.target.value)}
            placeholder={getPlaceholder('transportation')}
            disabled={isFieldDisabled('transportation')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('transportation') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="wfh"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            WFH ({getDisplayCurrency()})
          </Label>
          <Input
            id="wfh"
            value={getDisplayValue('wfh')}
            onChange={(e) => handleFieldUpdate('wfh', e.target.value)}
            placeholder={getPlaceholder('wfh')}
            disabled={isFieldDisabled('wfh')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('wfh') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <Label
            htmlFor="healthInsurance"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Health Insurance ({getDisplayCurrency()})
          </Label>
          <Input
            id="healthInsurance"
            value={getDisplayValue('healthInsurance')}
            onChange={(e) => handleFieldUpdate('healthInsurance', e.target.value)}
            placeholder={getPlaceholder('healthInsurance')}
            disabled={isFieldDisabled('healthInsurance')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('healthInsurance') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="monthlyPaymentsToLocalOffice"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Monthly Payments to Local Office ({getDisplayCurrency()})
          </Label>
          <Input
            id="monthlyPaymentsToLocalOffice"
            value={getDisplayValue('monthlyPaymentsToLocalOffice')}
            onChange={(e) => handleFieldUpdate('monthlyPaymentsToLocalOffice', e.target.value)}
            placeholder={getPlaceholder('monthlyPaymentsToLocalOffice')}
            disabled={isFieldDisabled('monthlyPaymentsToLocalOffice')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('monthlyPaymentsToLocalOffice') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
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
            value={getDisplayValue('vat')}
            onChange={(e) => handleFieldUpdate('vat', e.target.value)}
            placeholder={getPlaceholder('vat')}
            disabled={isFieldDisabled('vat')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('vat') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor="preEmploymentMedicalTest"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Pre-Employment Medical Test ({getDisplayCurrency()})
          </Label>
          <Input
            id="preEmploymentMedicalTest"
            value={getDisplayValue('preEmploymentMedicalTest')}
            onChange={(e) => handleFieldUpdate('preEmploymentMedicalTest', e.target.value)}
            placeholder={getPlaceholder('preEmploymentMedicalTest')}
            disabled={isFieldDisabled('preEmploymentMedicalTest')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('preEmploymentMedicalTest') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="drugTest"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Drug Test ({getDisplayCurrency()})
          </Label>
          <Input
            id="drugTest"
            value={getDisplayValue('drugTest')}
            onChange={(e) => handleFieldUpdate('drugTest', e.target.value)}
            placeholder={getPlaceholder('drugTest')}
            disabled={isFieldDisabled('drugTest')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('drugTest') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="backgroundCheckViaDeel"
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Background Check via Deel ({getDisplayCurrency()})
          </Label>
          <Input
            id="backgroundCheckViaDeel"
            value={getDisplayValue('backgroundCheckViaDeel')}
            onChange={(e) => handleFieldUpdate('backgroundCheckViaDeel', e.target.value)}
            placeholder={getPlaceholder('backgroundCheckViaDeel')}
            disabled={isFieldDisabled('backgroundCheckViaDeel')}
            className={`h-12 border-slate-200 text-slate-700 ${
              isFieldDisabled('backgroundCheckViaDeel') 
                ? 'bg-slate-50 cursor-not-allowed' 
                : 'bg-white'
            }`}
          />
        </div>
      </div>
    </div>
  )
});

LocalOfficeInformation.displayName = 'LocalOfficeInformation';
