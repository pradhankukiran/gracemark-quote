import { useEffect, memo } from "react"
import { Building2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LocalOfficeInfo } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FORM_STYLES } from "../styles/constants"
import { getOriginalLocalOfficeData } from "@/lib/shared/utils/localOfficeData"
import { useLocalOfficeConversion, getConvertedLocalOfficeValue } from "../hooks/useLocalOfficeConversion"
import { LoadingSpinner } from "./shared/LoadingSpinner"

interface LocalOfficeInformationProps {
  localOfficeInfo: LocalOfficeInfo
  isCurrencyManuallySet: boolean
  originalCurrency: string | null
  currency: string
  onLocalOfficeUpdate: (updates: Partial<LocalOfficeInfo>) => void
  countryCode?: string
}

export const LocalOfficeInformation = memo(({
  localOfficeInfo,
  isCurrencyManuallySet,
  originalCurrency,
  currency,
  onLocalOfficeUpdate,
  countryCode,
}: LocalOfficeInformationProps) => {
  const originalData = countryCode ? getOriginalLocalOfficeData(countryCode) : null

  const {
    convertedLocalOffice,
    isConvertingLocalOffice,
  } = useLocalOfficeConversion({
    originalData,
    countryCode: countryCode || null,
    formCurrency: currency,
    isCurrencyManuallySet: isCurrencyManuallySet,
    originalCurrency: originalCurrency,
  })

  // Store converted values in form state when conversion is complete
  useEffect(() => {
    if (!isConvertingLocalOffice && (originalData || Object.keys(convertedLocalOffice).length > 0)) {
      const updatedLocalOfficeInfo: Partial<LocalOfficeInfo> = {}
      
      // Build the local office data with converted values
      const fields: Array<keyof LocalOfficeInfo> = [
        'mealVoucher', 'transportation', 'wfh', 'healthInsurance',
        'monthlyPaymentsToLocalOffice', 'vat', 'preEmploymentMedicalTest',
        'drugTest', 'backgroundCheckViaDeel'
      ]
      
      fields.forEach(field => {
        const convertedValue = getConvertedLocalOfficeValue(field, convertedLocalOffice, originalData)
        if (convertedValue && convertedValue !== 'N/A') {
          updatedLocalOfficeInfo[field] = convertedValue
        }
      })
      
      // Only update if we have values to set
      if (Object.keys(updatedLocalOfficeInfo).length > 0) {
        onLocalOfficeUpdate(updatedLocalOfficeInfo)
      }
    }
  }, [convertedLocalOffice, originalData, isConvertingLocalOffice, onLocalOfficeUpdate])

  const getDisplayCurrency = () => {
    return currency
  }

  const getDisplayValue = (field: keyof LocalOfficeInfo) => {
    if (isConvertingLocalOffice) {
      return localOfficeInfo[field] || ''
    }
    return getConvertedLocalOfficeValue(field, convertedLocalOffice, originalData) || localOfficeInfo[field] || ''
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
    onLocalOfficeUpdate({ [field]: value })
  }

  return (
    <div>
      <FormSectionHeader icon={Building2} title="Local Office Information" />

      {isConvertingLocalOffice && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <LoadingSpinner className="h-4 w-4" />
            <span className="text-blue-700 text-sm font-medium">
              Converting USD values to {currency}...
            </span>
          </div>
        </div>
      )}
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
