"use client"

import { useEffect, useRef, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Heart } from "lucide-react"
import Link from "next/link"

import { useEORForm } from "./hooks/useEORForm"
import { useQuoteCalculation } from "./hooks/useQuoteCalculation"
import { useCurrencyConversion } from "./hooks/useCurrencyConversion"
import { useCountryValidation } from "./hooks/useCountryValidation"
import { useUSDConversion } from "./hooks/useUSDConversion"
import { useBenefits } from "./hooks/useBenefits"
import { useValidationConversion } from "./hooks/useValidationConversion"
import { getDefaultValues } from "@/lib/shared/utils/apiUtils"

import { ClientInfoForm } from "./components/ClientInfoForm"
import { QuotationTypeForm } from "./components/QuotationTypeForm"
import { EmployeeInfoForm } from "./components/EmployeeInfoForm"
import { CountryComparisonForm } from "./components/CountryComparisonForm"
import { FormActions } from "./components/FormActions"
import { BenefitsSelection } from "./components/BenefitsSelection"
import { LocalOfficeInformation } from "./components/LocalOfficeInformation"
import { FormSectionHeader } from "./components/shared/FormSectionHeader"
import { SmoothReveal } from "./components/shared/OptimizedReveal"


export default function EORCalculatorPage() {

  // Initialize hooks
  const {
    formData,
    currency,
    clientCurrency,
    compareCurrency,
    validationErrors,
    countries,
    selectedCountryData,
    updateFormData,
    updateValidationError,
    clearAllData,
    clearStoredData,
    clearValidationErrors,
    isFormValid,
    updateBenefitSelection,
    clearBenefitsSelection,
    updateLocalOfficeInfo,
    clearLocalOfficeInfo,
    overrideCurrency,
    resetToDefaultCurrency,
    handleCompareCountryChange,
    handleCountryChange,
    salaryConversionMessage,
  } = useEORForm()

  const { validationData, isLoadingValidations } = useCountryValidation(
    selectedCountryData?.code || null
  )

  // Use validation conversion hook at page level
  const {
    convertedValidation,
    isConvertingValidation,
    isValidationReady,
  } = useValidationConversion(
    validationData,
    currency,
    formData.isCurrencyManuallySet,
    formData.originalCurrency
  )

  // Track local office conversion status
  const [isConvertingLocalOffice, setIsConvertingLocalOffice] = useState(false)

  const {
    isConverting,
    conversionInfo,
    triggerManualConversion,
    markAsManuallyEdited,
    clearConversionData,
  } = useCurrencyConversion({
    baseSalary: formData.baseSalary,
    enableComparison: formData.enableComparison,
    compareCountry: formData.compareCountry,
    currency,
    compareCurrency,
    onFormUpdate: updateFormData,
  })

  const {
    error,
    calculateQuote,
    clearQuotes,
  } = useQuoteCalculation({
    formData,
    currency,
    clientCurrency,
    compareCurrency,
    validationData,
    convertedValidation,
  })

  const {
    usdConversionError,
    clearUSDConversions,
  } = useUSDConversion()

  // Compute fallback values for benefits when optional employee data is not provided
  // This ensures benefits work with default 40 hours/week (8 hours × 5 days) when optional section is unchecked
  const defaults = getDefaultValues(selectedCountryData?.code)
  const benefitsHoursPerDay = formData.hoursPerDay || defaults.hoursPerDay
  const benefitsDaysPerWeek = formData.daysPerWeek || defaults.daysPerWeek

  const {
    benefitsData,
    isLoadingBenefits,
    benefitsError,
    benefitsFetched,
    canFetchBenefits,
    fetchBenefitsManually,
  } = useBenefits({
    countryCode: selectedCountryData?.code || null,
    workVisa: formData.workVisaRequired,
    hoursPerDay: benefitsHoursPerDay,
    daysPerWeek: benefitsDaysPerWeek,
    employmentType: formData.employmentType,
  })

  // Track whether we've auto-selected benefits for current benefits data to prevent infinite loops
  const hasAutoSelectedBenefitsRef = useRef(false)

  // Clear benefits selection, validation errors, and form input data when country changes
  useEffect(() => {
    if (selectedCountryData?.code) {
      clearBenefitsSelection();
      clearValidationErrors();
      clearQuotes();
      clearUSDConversions();
      // Note: Don't clear local office info here - handleCountryChange already loads the correct data

      updateFormData({
        baseSalary: "",
        holidayDays: "",
        probationPeriod: "",
        hoursPerDay: "",
        daysPerWeek: "",
        startDate: "",
      });

      if (canFetchBenefits) {
        fetchBenefitsManually();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryData?.code, canFetchBenefits]);

  // Reset auto-selection flag when benefits data changes
  useEffect(() => {
    hasAutoSelectedBenefitsRef.current = false
  }, [benefitsData])

  // Auto-select mandatory benefits (with proper dependencies and infinite loop prevention)
  useEffect(() => {
    if (benefitsData?.data && !hasAutoSelectedBenefitsRef.current) {
      benefitsData.data.forEach(benefit => {
        if (benefit.is_mandatory && benefit.name.toLowerCase() === 'pension') {
          const benefitKey = benefit.name.toLowerCase().replace(/\s+/g, "_");
          if (!formData.selectedBenefits[benefitKey] && benefit.providers[0]?.plans[0]?.id) {
            const firstPlan = benefit.providers[0].plans[0];
            const benefitData = {
              planId: firstPlan.id,
              planName: firstPlan.name,
              providerId: benefit.providers[0].id,
              providerName: benefit.providers[0].name,
              price: firstPlan.price,
              currency: benefit.providers[0].currency,
              isMandatory: benefit.is_mandatory,
              benefitName: benefit.name
            };
            updateBenefitSelection(benefitKey, benefitData);
          }
        }
      });
      hasAutoSelectedBenefitsRef.current = true
    }
  }, [benefitsData, formData.selectedBenefits, updateBenefitSelection]);

  const isPageValid = useMemo(() => {
    if (!isFormValid()) {
      return false
    }

    // If benefits are shown, they must be fetched, and mandatory benefits must be selected
    if (formData.showBenefits) {
      if (!benefitsFetched) {
        return false
      }

      if (benefitsData?.data) {
        const mandatoryBenefits = benefitsData.data.filter(b => b.is_mandatory)
        if (mandatoryBenefits.length > 0) {
          const allMandatorySelected = mandatoryBenefits.every(benefit => {
            const benefitKey = benefit.name.toLowerCase().replace(/\s+/g, "_")
            return !!formData.selectedBenefits[benefitKey]
          })
          if (!allMandatorySelected) return false
        }
      }
    }

    return true
  }, [isFormValid, formData.showBenefits, benefitsFetched, benefitsData?.data, formData.selectedBenefits])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleClearAll = () => {
    clearAllData()
    clearQuotes()
    clearUSDConversions()
    clearBenefitsSelection()
  }

  // Memoize grouped props to reduce unnecessary rerenders
  const employeeDataProps = useMemo(() => ({
    country: formData.country,
    workVisaRequired: formData.workVisaRequired,
    baseSalary: formData.baseSalary,
    contractDuration: formData.contractDuration,
    contractDurationUnit: formData.contractDurationUnit,
    showOptionalEmployeeData: formData.showOptionalEmployeeData,
    hoursPerDay: formData.hoursPerDay,
    daysPerWeek: formData.daysPerWeek,
    holidayDays: formData.holidayDays,
    probationPeriod: formData.probationPeriod,
  }), [
    formData.country,
    formData.workVisaRequired,
    formData.baseSalary,
    formData.contractDuration,
    formData.contractDurationUnit,
    formData.showOptionalEmployeeData,
    formData.hoursPerDay,
    formData.daysPerWeek,
    formData.holidayDays,
    formData.probationPeriod,
  ])

  const currencyProps = useMemo(() => ({
    currency,
    isCurrencyManuallySet: formData.isCurrencyManuallySet,
    originalCurrency: formData.originalCurrency,
    salaryConversionMessage,
  }), [currency, formData.isCurrencyManuallySet, formData.originalCurrency, salaryConversionMessage])

  const validationProps = useMemo(() => ({
    validationData,
    validationErrors,
    convertedValidation,
    isLoadingValidations,
    isConvertingValidation,
    isValidationReady,
  }), [validationData, validationErrors, convertedValidation, isLoadingValidations, isConvertingValidation, isValidationReady])

  const callbackProps = useMemo(() => ({
    onFormUpdate: updateFormData,
    onCountryChange: handleCountryChange,
    onCurrencyOverride: overrideCurrency,
    onCurrencyReset: resetToDefaultCurrency,
    onValidationError: updateValidationError,
  }), [updateFormData, handleCountryChange, overrideCurrency, resetToDefaultCurrency, updateValidationError])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
            <main className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-primary transition-all duration-200 hover:gap-3 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
        </div>

        <div className="space-y-8">
          {/* Form Section */}
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                EOR Quote Calculator
              </h1>
              {/* <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Get accurate EOR cost estimates starting with Deel's comprehensive data
              </p> */}
            </div>

            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <ClientInfoForm
                  clientName={formData.clientName}
                  clientType={formData.clientType}
                  clientCountry={formData.clientCountry}
                  clientCurrency={clientCurrency}
                  countries={countries}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <QuotationTypeForm
                  quoteType={formData.quoteType}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <EmployeeInfoForm
                  {...employeeDataProps}
                  {...currencyProps}
                  {...validationProps}
                  {...callbackProps}
                  countries={countries}
                />

                <Separator />

                <FormSectionHeader
                  icon={Heart}
                  title="Employee Benefits (Optional)"
                  subtitle="Select benefit plans for the employee. Mandatory benefits must have a selection."
                />

                <Label
                  htmlFor="show-benefits"
                  className={`
                    flex items-center space-x-4 p-4 border-2 rounded-md cursor-pointer transition-all duration-200
                    ${formData.showBenefits
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:border-primary/50'
                    }
                  `}
                >
                  <Checkbox
                    id="show-benefits"
                    checked={formData.showBenefits}
                    onCheckedChange={(checked) => {
                      const newShowBenefits = !!checked
                      updateFormData({ showBenefits: newShowBenefits })
                    }}
                    disabled={!canFetchBenefits}
                    className="h-5 w-5"
                  />
                  <span className="text-base font-medium text-slate-800">
                    Add Employee Benefits
                  </span>
                </Label>
                {!canFetchBenefits && !formData.showBenefits && (
                  <p className="text-sm text-slate-500 mt-2">
                    Please select a country and employment type to add benefits.
                  </p>
                )}

                {/* Show Benefits Selection only after benefits have been fetched */}
                <SmoothReveal isVisible={formData.showBenefits && benefitsFetched}>
                  <BenefitsSelection
                    benefitsData={benefitsData}
                    isLoadingBenefits={isLoadingBenefits}
                    benefitsError={benefitsError}
                    selectedBenefits={formData.selectedBenefits}
                    onBenefitChange={updateBenefitSelection}
                  />
                </SmoothReveal>

                {/* Show Local Office Information for all countries */}
                {selectedCountryData && (
                  <>
                    <Separator />
                    <LocalOfficeInformation
                      localOfficeInfo={formData.localOfficeInfo}
                      isCurrencyManuallySet={formData.isCurrencyManuallySet}
                      originalCurrency={formData.originalCurrency}
                      currency={currency}
                      onLocalOfficeUpdate={updateLocalOfficeInfo}
                      onConversionStatusChange={setIsConvertingLocalOffice}
                      countryCode={selectedCountryData?.code}
                    />
                  </>
                )}

                <Separator />

                <CountryComparisonForm
                  country={formData.country}
                  enableComparison={formData.enableComparison}
                  compareCountry={formData.compareCountry}
                  compareSalary={formData.compareSalary}
                  compareCurrency={compareCurrency}
                  countries={countries}
                  isConverting={isConverting}
                  conversionInfo={conversionInfo}
                  onFormUpdate={updateFormData}
                  onTriggerConversion={triggerManualConversion}
                  onMarkAsManuallyEdited={markAsManuallyEdited}
                  onClearConversionData={clearConversionData}
                  onCompareCountryChange={handleCompareCountryChange}
                />

                <FormActions
                  isCalculating={false}
                  isFormValid={isPageValid}
                  error={error}
                  usdConversionError={usdConversionError}
                  onCalculate={calculateQuote}
                  onClear={handleClearAll}
                  onClearStorage={clearStoredData}
                  enableComparison={formData.enableComparison}
                  isConvertingLocalOffice={isConvertingLocalOffice}
                  isConvertingValidation={isConvertingValidation}
                />
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
