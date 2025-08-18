"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { useEORForm } from "./hooks/useEORForm"
import { useQuoteCalculation } from "./hooks/useQuoteCalculation"
import { useCurrencyConversion } from "./hooks/useCurrencyConversion"
import { useCountryValidation } from "./hooks/useCountryValidation"
import { useUSDConversion } from "./hooks/useUSDConversion"
import { useBenefits } from "./hooks/useBenefits"

import { ClientInfoForm } from "./components/ClientInfoForm"
import { EmployeeInfoForm } from "./components/EmployeeInfoForm"
import { CountryComparisonForm } from "./components/CountryComparisonForm"
import { FormActions } from "./components/FormActions"
import { QuoteCard } from "./components/QuoteCard"
import { QuoteComparison } from "./components/QuoteComparison"
import { BenefitsSelection } from "./components/BenefitsSelection"


export default function EORCalculatorPage() {
  const quoteRef = useRef<HTMLDivElement>(null)

  // Initialize hooks
  const {
    formData,
    validationErrors,
    countries,
    selectedCountryData,
    availableStates,
    showStateDropdown,
    compareCountryData,
    compareAvailableStates,
    showCompareStateDropdown,
    updateFormData,
    updateValidationError,
    clearAllData,
    isFormValid,
    updateBenefitSelection,
    clearBenefitsSelection,
  } = useEORForm()

  const { validationData, isLoadingValidations, validationError } = useCountryValidation(
    selectedCountryData?.code || null
  )

  const {
    isConverting,
    conversionInfo,
    isComparisonManuallyEdited,
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
  } = useQuoteCalculation({
    formData,
    validationData,
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
  } = useUSDConversion()

  const {
    benefitsData,
    isLoadingBenefits,
    benefitsError,
  } = useBenefits({
    countryCode: selectedCountryData?.code || null,
    workVisa: formData.workVisaRequired,
    hoursPerDay: formData.hoursPerDay,
    daysPerWeek: formData.daysPerWeek,
    employmentType: formData.employmentType,
  })

  useEffect(() => {
    if (benefitsData?.data) {
      benefitsData.data.forEach(benefit => {
        if (benefit.is_mandatory && benefit.name.toLowerCase() === 'pension') {
          const benefitKey = benefit.name.toLowerCase().replace(/\s+/g, "_");
          if (!formData.selectedBenefits[benefitKey] && benefit.providers[0]?.plans[0]?.id) {
            updateBenefitSelection(benefitKey, benefit.providers[0].plans[0].id);
          }
        }
      });
    }
  }, [benefitsData, formData.selectedBenefits, updateBenefitSelection]);

  const isPageValid = () => {
    if (!isFormValid()) {
      return false;
    }

    if (benefitsData?.data) {
      const mandatoryBenefits = benefitsData.data.filter(b => b.is_mandatory);
      if (mandatoryBenefits.length > 0) {
        const allMandatorySelected = mandatoryBenefits.every(benefit => {
          const benefitKey = benefit.name.toLowerCase().replace(/\s+/g, "_");
          return !!formData.selectedBenefits[benefitKey];
        });
        if (!allMandatorySelected) return false;
      }
    }

    return true;
  };

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleClearAll = () => {
    clearAllData()
    clearQuotes()
    clearUSDConversions()
    clearBenefitsSelection()
  }

  // Scroll to results when quote is calculated
  useEffect(() => {
    if (formData.currentStep === "primary-quote" && deelQuote) {
      setTimeout(() => {
        quoteRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }, 100)
    }
  }, [formData.currentStep, deelQuote])


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
                  formData={formData}
                  countries={countries}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <EmployeeInfoForm
                  formData={formData}
                  countries={countries}
                  availableStates={availableStates}
                  showStateDropdown={showStateDropdown}
                  selectedCountryCode={selectedCountryData?.code}
                  validationData={validationData}
                  validationError={validationError}
                  isLoadingValidations={isLoadingValidations}
                  validationErrors={validationErrors}
                  onFormUpdate={updateFormData}
                  onValidationError={updateValidationError}
                />

                <Separator />

                <BenefitsSelection
                  benefitsData={benefitsData}
                  isLoadingBenefits={isLoadingBenefits}
                  benefitsError={benefitsError}
                  selectedBenefits={formData.selectedBenefits}
                  onBenefitChange={updateBenefitSelection}
                />

                <Separator />

                <CountryComparisonForm
                  formData={formData}
                  countries={countries}
                  compareAvailableStates={compareAvailableStates}
                  showCompareStateDropdown={showCompareStateDropdown}
                  compareCountryCode={compareCountryData?.code}
                  isConverting={isConverting}
                  conversionInfo={conversionInfo}
                  isComparisonManuallyEdited={isComparisonManuallyEdited}
                  onFormUpdate={updateFormData}
                  onTriggerConversion={triggerManualConversion}
                  onMarkAsManuallyEdited={markAsManuallyEdited}
                  onClearConversionData={clearConversionData}
                />

                <FormActions
                  isCalculating={isCalculating}
                  isFormValid={isPageValid()}
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
            {formData.currentStep === "primary-quote" && deelQuote && (!formData.enableComparison || (formData.enableComparison && !compareQuote)) && (
              <QuoteCard
                quote={deelQuote}
                title={`Deel Quote - ${deelQuote.country}`}
                subtitle="Reliable EOR provider with comprehensive legal coverage"
                usdConversions={usdConversions.deel}
                onConvertToUSD={() => convertQuoteToUSD(deelQuote, "deel")}
                isConvertingToUSD={isConvertingDeelToUsd}
              />
            )}

            {/* Country Comparison */}
            {formData.currentStep === "primary-quote" && deelQuote && formData.enableComparison && compareQuote && (
              <QuoteComparison
                primaryQuote={deelQuote}
                comparisonQuote={compareQuote}
                primaryTitle={formData.country}
                comparisonTitle={formData.compareCountry}
                usdConversions={usdConversions}
                onConvertPrimaryToUSD={() => convertQuoteToUSD(deelQuote, "deel")}
                onConvertComparisonToUSD={() => convertQuoteToUSD(compareQuote, "compare")}
                isConvertingPrimaryToUSD={isConvertingDeelToUsd}
                isConvertingComparisonToUSD={isConvertingCompareToUsd}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
