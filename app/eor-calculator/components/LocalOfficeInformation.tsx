import { memo, useMemo, useEffect, useRef } from "react"
import { Building2, Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LocalOfficeInfo, LocalOfficeCustomCost } from "@/lib/shared/types"
import { FormSectionHeader } from "./shared/FormSectionHeader"
import { FORM_STYLES } from "../styles/constants"
import { getOriginalLocalOfficeData } from "@/lib/shared/utils/localOfficeData"
import { useLocalOfficeConversion } from "../hooks/useLocalOfficeConversion"
// import { LoadingSpinner } from "./shared/LoadingSpinner" // Unused

interface LocalOfficeInformationProps {
  localOfficeInfo: LocalOfficeInfo
  isCurrencyManuallySet: boolean
  originalCurrency: string | null
  currency: string
  onLocalOfficeUpdate: (updates: Partial<LocalOfficeInfo>) => void
  onConversionStatusChange?: (isConverting: boolean) => void
  onManualFieldEdit?: (field: keyof LocalOfficeInfo) => void
  countryCode?: string
  title?: string
  scopeId?: string
  customCosts?: LocalOfficeCustomCost[]
  onAddCustomCost?: () => void
  onCustomCostChange?: (id: string, updates: Partial<LocalOfficeCustomCost>) => void
  onRemoveCustomCost?: (id: string) => void
}

export const LocalOfficeInformation = memo(({
  localOfficeInfo,
  isCurrencyManuallySet,
  originalCurrency,
  currency,
  onLocalOfficeUpdate,
  onManualFieldEdit,
  onConversionStatusChange,
  countryCode,
  title,
  scopeId = 'primary',
  customCosts = [],
  onAddCustomCost,
  onCustomCostChange,
  onRemoveCustomCost,
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
    convertedForKey,
  } = useLocalOfficeConversion({
    originalData,
    countryCode: countryCode || null,
    formCurrency: currency,
    isCurrencyManuallySet: isCurrencyManuallySet,
    originalCurrency: originalCurrency,
    scopeId,
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

    if (convertedForKey !== conversionKey) {
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
  }, [convertedLocalOffice, convertedForKey, isConvertingLocalOffice, conversionKey, onLocalOfficeUpdate])

  const getDisplayCurrency = () => {
    return currency
  }

  const domId = (field: keyof LocalOfficeInfo) => `${scopeId}-${field}`
  const customDomId = (id: string, field: 'label' | 'amount') => `${scopeId}-custom-${field}-${id}`

  const isNAValue = (value?: string | null) => {
    if (!value) return false
    return value.trim().toUpperCase() === 'N/A'
  }

  const getDisplayValue = (field: keyof LocalOfficeInfo) => {
    // Show form state value (which includes converted values after update)
    const formValue = localOfficeInfo[field]
    if (formValue && !isNAValue(formValue) && formValue !== '') {
      return formValue
    }

    // Fall back to original data while converting or if no form value
    const originalValue = originalData?.[field]
    if (originalValue && !isNAValue(originalValue) && originalValue !== '') {
      return originalValue
    }

    return ''
  }

  const getPlaceholder = (field: keyof LocalOfficeInfo) => {
    if (isConvertingLocalOffice) return 'Converting...'
    const formValue = localOfficeInfo[field]
    const originalValue = originalData?.[field]
    if (isNAValue(formValue) || isNAValue(originalValue)) {
      return 'N/A'
    }

    const value = getDisplayValue(field)
    return value || 'Enter amount'
  }

  const isFieldDisabled = (_field: keyof LocalOfficeInfo) => {
    return isConvertingLocalOffice
  }

  const handleFieldUpdate = (field: keyof LocalOfficeInfo, value: string) => {
    // When user manually edits, record override and update form state
    if (onManualFieldEdit) {
      onManualFieldEdit(field)
    }
    onLocalOfficeUpdate({ [field]: value })
  }

  const handleCustomCostFieldUpdate = (id: string, updates: Partial<LocalOfficeCustomCost>) => {
    if (!onCustomCostChange) return
    onCustomCostChange(id, updates)
  }

  const renderCustomCosts = () => {
    if (!customCosts || customCosts.length === 0) {
      return null
    }

    return (
      <div className="mt-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-700 uppercase tracking-wide">Additional Local Office Costs</h3>
        {customCosts.map((cost) => (
          <div
            key={cost.id}
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto]"
          >
            <div className="space-y-2">
              <Label htmlFor={customDomId(cost.id, 'label')} className="text-sm font-medium text-slate-600">
                Cost Name
              </Label>
              <Input
                id={customDomId(cost.id, 'label')}
                value={cost.label}
                onChange={(e) => handleCustomCostFieldUpdate(cost.id, { label: formatCostLabel(e.target.value) })}
                placeholder="Enter cost name"
                disabled={isConvertingLocalOffice}
                className="h-11 border-slate-200 text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={customDomId(cost.id, 'amount')} className="text-sm font-medium text-slate-600">
                Amount ({getDisplayCurrency()})
              </Label>
              <Input
                id={customDomId(cost.id, 'amount')}
                value={cost.amount}
                onChange={(e) => handleCustomCostFieldUpdate(cost.id, { amount: e.target.value })}
                placeholder="Enter amount"
                disabled={isConvertingLocalOffice}
                className="h-11 border-slate-200 text-slate-700"
              />
            </div>
            <div className="flex items-end">
              {onRemoveCustomCost && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveCustomCost(cost.id)}
                  disabled={isConvertingLocalOffice}
                  className="text-slate-500 hover:text-slate-700"
                  aria-label="Remove cost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <FormSectionHeader
        icon={Building2}
        title={title || "Local Office Information"}
        action={onAddCustomCost ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAddCustomCost}
            disabled={isConvertingLocalOffice}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Costs
          </Button>
        ) : undefined}
      />
      <div className={FORM_STYLES.GRID_3_COL}>
        <div className="space-y-2">
          <Label
            htmlFor={domId('mealVoucher')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Meal Voucher ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('mealVoucher')}
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
            htmlFor={domId('transportation')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Transportation ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('transportation')}
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
            htmlFor={domId('wfh')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            WFH ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('wfh')}
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
            htmlFor={domId('healthInsurance')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Health Insurance ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('healthInsurance')}
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
            htmlFor={domId('monthlyPaymentsToLocalOffice')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Monthly Payments to Local Office ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('monthlyPaymentsToLocalOffice')}
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
            htmlFor={domId('vat')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            VAT (%)
          </Label>
          <Input
            id={domId('vat')}
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
            htmlFor={domId('preEmploymentMedicalTest')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Pre-Employment Medical Test ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('preEmploymentMedicalTest')}
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
            htmlFor={domId('drugTest')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Drug Test ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('drugTest')}
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
            htmlFor={domId('backgroundCheckViaDeel')}
            className="text-base font-semibold text-slate-700 uppercase tracking-wide"
          >
            Background Check via Deel ({getDisplayCurrency()})
          </Label>
          <Input
            id={domId('backgroundCheckViaDeel')}
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

      {renderCustomCosts()}
    </div>
  )
});

LocalOfficeInformation.displayName = 'LocalOfficeInformation';
  const formatCostLabel = (value: string) => {
    if (!value) return ''
    return value.replace(/\s+/g, ' ').trim().toUpperCase()
  }
