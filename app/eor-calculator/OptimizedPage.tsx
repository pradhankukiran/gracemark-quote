"use client"

import { useEffect, useRef, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Heart } from "lucide-react"
import Link from "next/link"

// Use optimized hooks
import { useOptimizedEORForm } from "./hooks/useOptimizedEORForm"
import { useQuoteCalculation } from "./hooks/useQuoteCalculation"
import { useCurrencyConversion } from "./hooks/useCurrencyConversion"
import { useCountryValidation } from "./hooks/useCountryValidation"
import { useUSDConversion } from "./hooks/useUSDConversion"
import { useBenefits } from "./hooks/useBenefits"
import { useValidationConversion } from "./hooks/useValidationConversion"

import { OptimizedClientInfoForm } from "./components/OptimizedClientInfoForm"
// Use optimized employee form
import { OptimizedEmployeeInfoForm } from "./components/OptimizedEmployeeInfoForm"
import { CountryComparisonForm } from "./components/CountryComparisonForm"
import { FormActions } from "./components/FormActions"
import { QuoteCard } from "./components/QuoteCard"
import { QuoteComparison } from "./components/QuoteComparison"
import { BenefitsSelection } from "./components/BenefitsSelection"
import { RetrieveBenefitsButton } from "./components/RetrieveBenefitsButton"
import { LocalOfficeInformation } from "./components/LocalOfficeInformation"
import { isLatamCountry } from "./utils/validationUtils"

export default function OptimizedEORCalculatorPage() {
  const quoteRef = useRef<HTMLDivElement>(null)
  
  // Initialize optimized form hook
  const {
    formData,
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
    handleCountryChange,
    handleClientCountryChange,
    handleCompareCountryChange,
  } = useOptimizedEORForm()

  // Memoize country code to prevent unnecessary validation refetches
  const countryCode = useMemo(() => selectedCountryData?.code || null, [selectedCountryData?.code])

  const { validationData, isLoadingValidations, validationError } = useCountryValidation(countryCode)

  // Use validation conversion hook at page level
  const {
    convertedValidation,
    isConvertingValidation,
    isValidationReady,
  } = useValidationConversion(
    validationData,
    formData.currency,
    formData.isCurrencyManuallySet,
    formData.originalCurrency
  )

  const {
    isConverting,
    conversionInfo,
    triggerManualConversion,
    markAsManuallyEdited,
    clearConversionData,
  } = useCurrencyConversion({ formData, onFormUpdate: updateFormData })

  const {
    deelQuote,
    compareQuote,
    isCalculating,
    error,
    calculateQuote,
    clearQuotes,
    dualCurrencyQuotes,
  } = useQuoteCalculation({
    formData,
    validationData,
    convertedValidation,
    onValidationError: updateValidationError,
    onFormUpdate: updateFormData,
  })

  const {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    usdConversionError,
    convertQuoteToUSD,
    clearUSDConversions,
    autoConvertQuote,
  } = useUSDConversion()

  // Memoize benefits parameters to prevent unnecessary refetches
  const benefitsParams = useMemo(() => ({
    countryCode: countryCode,
    workVisa: formData.workVisaRequired,
    hoursPerDay: formData.hoursPerDay,
    daysPerWeek: formData.daysPerWeek,
    employmentType: formData.employmentType,
  }), [countryCode, formData.workVisaRequired, formData.hoursPerDay, formData.daysPerWeek, formData.employmentType])

  const {
    benefitsData,
    isLoadingBenefits,
    benefitsError,
    benefitsFetched,
    benefitsSkipped,
    canFetchBenefits,
    fetchBenefitsManually,
    skipBenefits,
  } = useBenefits(benefitsParams)

  // Optimized country change handler that batches all related clear operations
  const handleOptimizedCountryChange = useCallback((newCountry: string) => {
    // Use the optimized handler from the form hook
    handleCountryChange(newCountry)
    
    // Batch all clear operations to minimize re-renders
    clearBenefitsSelection()
    clearValidationErrors()
    clearQuotes()
    clearUSDConversions()
    clearLocalOfficeInfo()
    
    // Clear form input data to prevent auto-loading of sections
    updateFormData({
      baseSalary: "",
      holidayDays: "",
      probationPeriod: "",
      hoursPerDay: "",
      daysPerWeek: "",
      startDate: "",
      employmentType: "full-time",
      workVisaRequired: false,
    })
  }, [
    handleCountryChange,
    clearBenefitsSelection,
    clearValidationErrors,
    clearQuotes,
    clearUSDConversions,
    clearLocalOfficeInfo,
    updateFormData
  ])

  // Auto-select mandatory benefits (optimized with useCallback to prevent re-renders)
  const handleMandatoryBenefitsSelection = useCallback(() => {
    if (benefitsData?.data) {
      benefitsData.data.forEach(benefit => {
        if (benefit.is_mandatory && benefit.name.toLowerCase() === 'pension') {
          const benefitKey = benefit.name.toLowerCase().replace(/\s+/g, "_")
          if (!formData.selectedBenefits[benefitKey] && benefit.providers[0]?.plans[0]?.id) {
            updateBenefitSelection(benefitKey, benefit.providers[0].plans[0].id)
          }
        }
      })
    }
  }, [benefitsData, formData.selectedBenefits, updateBenefitSelection])

  // Only run benefits selection when benefitsData changes or selectedBenefits is empty
  useEffect(() => {
    handleMandatoryBenefitsSelection()
  }, [handleMandatoryBenefitsSelection])

  // Memoize page validation to prevent expensive recalculations
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
  }, [isFormValid, benefitsFetched, benefitsSkipped, benefitsData, formData.selectedBenefits])

  // Scroll to top on mount (no dependencies needed)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Optimized clear all handler
  const handleClearAll = useCallback(() => {
    clearAllData()
    clearQuotes()
    clearUSDConversions()
    clearBenefitsSelection()
  }, [clearAllData, clearQuotes, clearUSDConversions, clearBenefitsSelection])

  // Scroll to results when quote is calculated (optimized dependencies)
  const hasQuoteData = useMemo(() => 
    dualCurrencyQuotes.isDualCurrencyMode ? 
      (dualCurrencyQuotes.selectedCurrencyQuote || dualCurrencyQuotes.localCurrencyQuote) : 
      deelQuote,
    [dualCurrencyQuotes.isDualCurrencyMode, dualCurrencyQuotes.selectedCurrencyQuote, dualCurrencyQuotes.localCurrencyQuote, deelQuote]
  )

  useEffect(() => {
    if (formData.currentStep === "primary-quote" && hasQuoteData) {
      const timeoutId = setTimeout(() => {
        quoteRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [formData.currentStep, hasQuoteData])

  // Auto-convert quotes to USD (optimized with cleanup)
  useEffect(() => {
    if (!dualCurrencyQuotes.isDualCurrencyMode && deelQuote && deelQuote.currency !== "USD") {
      return autoConvertQuote(deelQuote, "deel")
    }
  }, [deelQuote, dualCurrencyQuotes.isDualCurrencyMode, autoConvertQuote])

  useEffect(() => {
    if (!dualCurrencyQuotes.isDualCurrencyMode && compareQuote && compareQuote.currency !== "USD") {
      return autoConvertQuote(compareQuote, "compare")
    }
  }, [compareQuote, dualCurrencyQuotes.isDualCurrencyMode, autoConvertQuote])

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
            </div>

            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <OptimizedClientInfoForm
                  formData={formData}
                  countries={countries}
                  onFormUpdate={updateFormData}
                  onCountryChange={handleClientCountryChange}
                />

                <Separator />

                <OptimizedEmployeeInfoForm
                  formData={formData}
                  countries={countries}
                  validationData={validationData}
                  validationError={validationError}
                  isLoadingValidations={isLoadingValidations}
                  validationErrors={validationErrors}
                  convertedValidation={convertedValidation}
                  isConvertingValidation={isConvertingValidation}
                  isValidationReady={isValidationReady}
                  onFormUpdate={updateFormData}
                  onValidationError={updateValidationError}
                  onCurrencyOverride={overrideCurrency}
                  onCurrencyReset={resetToDefaultCurrency}
                  onCountryChange={handleOptimizedCountryChange}
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
                            onClick={fetchBenefitsManually}
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
                      formData={formData}
                      onLocalOfficeUpdate={updateLocalOfficeInfo}
                      countryCode={selectedCountryData?.code}
                    />
                  </>
                )}

                <Separator />

                <CountryComparisonForm
                  formData={formData}
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
                  isCalculating={isCalculating}
                  isFormValid={isPageValid}
                  error={error}
                  usdConversionError={usdConversionError}
                  onCalculate={calculateQuote}
                  onClear={handleClearAll}
                />
              </CardContent>
            </Card>
          </div>

          {/* Quote Results Section */}
          <div className="space-y-6" ref={quoteRef}>
            {/* Primary Deel Quote - show when not comparing OR when comparing but no comparison quote yet */}
            {formData.currentStep === "primary-quote" && (
              (dualCurrencyQuotes.isDualCurrencyMode && (dualCurrencyQuotes.selectedCurrencyQuote || dualCurrencyQuotes.localCurrencyQuote)) ||
              (!dualCurrencyQuotes.isDualCurrencyMode && deelQuote)
            ) && (!formData.enableComparison || (formData.enableComparison && !compareQuote && !dualCurrencyQuotes.isDualCurrencyMode)) && (
              <QuoteCard
                quote={dualCurrencyQuotes.isDualCurrencyMode ? undefined : deelQuote || undefined}
                title={`Quote - ${dualCurrencyQuotes.isDualCurrencyMode ? 
                  (dualCurrencyQuotes.selectedCurrencyQuote?.country || formData.country) : 
                  deelQuote?.country || formData.country}`}
                subtitle="Powered by Deel"
                usdConversions={dualCurrencyQuotes.isDualCurrencyMode ? undefined : usdConversions.deel}
                isConvertingToUSD={dualCurrencyQuotes.isDualCurrencyMode ? false : isConvertingDeelToUsd}
                usdConversionError={dualCurrencyQuotes.isDualCurrencyMode ? null : usdConversionError}
                dualCurrencyQuotes={dualCurrencyQuotes}
              />
            )}

            {/* Country Comparison - Single Currency Mode */}
            {formData.currentStep === "primary-quote" && !dualCurrencyQuotes.isDualCurrencyMode && deelQuote && formData.enableComparison && compareQuote && (
              <QuoteComparison
                primaryQuote={deelQuote}
                comparisonQuote={compareQuote}
                primaryTitle={formData.country}
                comparisonTitle={formData.compareCountry}
                usdConversions={usdConversions}
                isConvertingPrimaryToUSD={isConvertingDeelToUsd}
                isConvertingComparisonToUSD={isConvertingCompareToUsd}
                usdConversionError={usdConversionError}
              />
            )}

            {/* Country Comparison - Dual Currency Mode */}
            {formData.currentStep === "primary-quote" && dualCurrencyQuotes.isDualCurrencyMode && dualCurrencyQuotes.hasComparison && 
             dualCurrencyQuotes.selectedCurrencyQuote && dualCurrencyQuotes.compareSelectedCurrencyQuote && (
              <QuoteComparison
                primaryTitle={formData.country}
                comparisonTitle={formData.compareCountry}
                usdConversions={usdConversions}
                isConvertingPrimaryToUSD={isConvertingDeelToUsd}
                isConvertingComparisonToUSD={isConvertingCompareToUsd}
                usdConversionError={usdConversionError}
                dualCurrencyQuotes={dualCurrencyQuotes}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}