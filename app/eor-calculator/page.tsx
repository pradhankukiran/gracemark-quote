"use client"

import { useEffect, useRef, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
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

import { ClientInfoForm } from "./components/ClientInfoForm"
import { QuotationTypeForm } from "./components/QuotationTypeForm"
import { EmployeeInfoForm } from "./components/EmployeeInfoForm"
import { CountryComparisonForm } from "./components/CountryComparisonForm"
import { FormActions } from "./components/FormActions"
import { BenefitsSelection } from "./components/BenefitsSelection"
import { RetrieveBenefitsButton } from "./components/RetrieveBenefitsButton"
import { LocalOfficeInformation } from "./components/LocalOfficeInformation"
import { isLatamCountry } from "@/lib/shared/utils/validationUtils"


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

  const { validationData, isLoadingValidations, validationError } = useCountryValidation(
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
    onValidationError: updateValidationError,
  })

  const {
    usdConversionError,
    clearUSDConversions,
  } = useUSDConversion()

  const {
    benefitsData,
    isLoadingBenefits,
    benefitsError,
    benefitsFetched,
    benefitsSkipped,
    canFetchBenefits,
    fetchBenefitsManually,
    skipBenefits,
  } = useBenefits({
    countryCode: selectedCountryData?.code || null,
    workVisa: formData.workVisaRequired,
    hoursPerDay: formData.hoursPerDay,
    daysPerWeek: formData.daysPerWeek,
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
      clearLocalOfficeInfo();
      
      updateFormData({
        baseSalary: "",
        holidayDays: "",
        probationPeriod: "",
        hoursPerDay: "",
        daysPerWeek: "",
        startDate: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryData?.code]);

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
            updateBenefitSelection(benefitKey, benefit.providers[0].plans[0].id);
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

    // Benefits must be explicitly fetched or skipped before allowing quote generation
    if (!benefitsFetched && !benefitsSkipped) {
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

    return true
  }, [isFormValid, benefitsFetched, benefitsSkipped, benefitsData?.data, formData.selectedBenefits])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleClearAll = () => {
    clearAllData()
    clearQuotes()
    clearUSDConversions()
    clearBenefitsSelection()
  }



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
                  country={formData.country}
                  currency={currency}
                  isCurrencyManuallySet={formData.isCurrencyManuallySet}
                  originalCurrency={formData.originalCurrency}
                  workVisaRequired={formData.workVisaRequired}
                  baseSalary={formData.baseSalary}
                  hoursPerDay={formData.hoursPerDay}
                  daysPerWeek={formData.daysPerWeek}
                  holidayDays={formData.holidayDays}
                  probationPeriod={formData.probationPeriod}
                  countries={countries}
                  salaryConversionMessage={salaryConversionMessage}
                  validationData={validationData}
                  validationErrors={validationErrors}
                  convertedValidation={convertedValidation}
                  isLoadingValidations={isLoadingValidations}
                  isConvertingValidation={isConvertingValidation}
                  isValidationReady={isValidationReady}
                  onFormUpdate={updateFormData}
                  onValidationError={updateValidationError}
                  onCountryChange={handleCountryChange}
                  onCurrencyOverride={overrideCurrency}
                  onCurrencyReset={resetToDefaultCurrency}
                />

                <Separator />

                {/* Show Retrieve Benefits button if benefits haven't been fetched or skipped yet */}
                {!benefitsFetched && !benefitsSkipped && (
                  <RetrieveBenefitsButton
                    countryName={formData.country}
                    isLoading={isLoadingBenefits}
                    canFetch={!!canFetchBenefits}
                    onFetchBenefits={fetchBenefitsManually}
                    onSkipBenefits={skipBenefits}
                  />
                )}

                {/* Show message when benefits are skipped */}
                {benefitsSkipped && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-1 bg-blue-100 rounded-full mt-0.5">
                        <Heart className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-blue-800 font-medium">Benefits Skipped</h4>
                        <p className="text-blue-700 text-sm mt-1">
                          You&apos;ve chosen to skip benefits selection. Your quote will include basic employment costs only.
                          {" "}
                          <button 
                            onClick={() => {
                              // Reset skip state to show retrieve button again
                              fetchBenefitsManually()
                            }}
                            className="underline hover:no-underline"
                          >
                            Add benefits instead?
                          </button>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show Benefits Selection only after benefits have been fetched */}
                {benefitsFetched && (
                  <BenefitsSelection
                    benefitsData={benefitsData}
                    isLoadingBenefits={isLoadingBenefits}
                    benefitsError={benefitsError}
                    selectedBenefits={formData.selectedBenefits}
                    onBenefitChange={updateBenefitSelection}
                  />
                )}

                {/* Show Local Office Information for LATAM countries */}
                {isLatamCountry(selectedCountryData?.code) && (
                  <>
                    <Separator />
                    <LocalOfficeInformation
                      localOfficeInfo={formData.localOfficeInfo}
                      isCurrencyManuallySet={formData.isCurrencyManuallySet}
                      originalCurrency={formData.originalCurrency}
                      currency={currency}
                      onLocalOfficeUpdate={updateLocalOfficeInfo}
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
                />
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
