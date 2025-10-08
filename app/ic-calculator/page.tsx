"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { useICForm } from "./hooks/useICForm"
import { useICQuoteCalculation } from "./hooks/useICQuoteCalculation"

import { ContractorInfoForm } from "./components/ContractorInfoForm"
import { RateConfigurationForm } from "./components/RateConfigurationForm"
import { ContractDetailsForm } from "./components/ContractDetailsForm"
import { FormActions } from "./components/FormActions"
import { QuoteResults } from "./components/QuoteResults"

export default function ICCalculatorPage() {
  // Initialize hooks
  const {
    formData,
    currency,
    validationErrors,
    countries,
    selectedCountryData,
    availableStates,
    showStateDropdown,
    paymentFrequencies,
    updateFormData,
    updateValidationError,
    clearValidationErrors,
    clearAllData,
    clearStoredData,
    isFormValid,
    rateConversionMessage,
    handleCountryChange,
  } = useICForm()

  const {
    quote,
    isCalculating,
    error,
    calculateQuote,
    clearQuote,
    clearError,
  } = useICQuoteCalculation({
    formData,
    currency,
  })

  const resultsRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(false)
  const formInitializedRef = useRef(false)
  const lastFormDataRef = useRef(formData)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (isCalculating) {
      shouldAutoScrollRef.current = true
    }
  }, [isCalculating])

  useEffect(() => {
    if (!isCalculating && quote && shouldAutoScrollRef.current) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      shouldAutoScrollRef.current = false
    }
  }, [isCalculating, quote])

  useEffect(() => {
    if (!formInitializedRef.current) {
      formInitializedRef.current = true
      lastFormDataRef.current = formData
      return
    }

    if (lastFormDataRef.current === formData) {
      return
    }

    lastFormDataRef.current = formData

    if (quote || error) {
      clearQuote()
      clearError()
    }
  }, [formData, quote, error, clearQuote, clearError])

  const handleClearAll = () => {
    clearAllData()
    clearQuote()
    clearError()
    shouldAutoScrollRef.current = false
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
                IC Quote Calculator
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Get accurate cost estimates for your Independent Contractor services
              </p>
            </div>

            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <ContractorInfoForm
                  contractorName={formData.contractorName}
                  country={formData.country}
                  currency={currency}
                  countries={countries}
                  onFormUpdate={updateFormData}
                  onCountryChange={handleCountryChange}
                />

                <Separator />

                <RateConfigurationForm
                  rateBasis={formData.rateBasis}
                  rateAmount={formData.rateAmount}
                  rateConversionMessage={rateConversionMessage}
                  currency={currency}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <ContractDetailsForm
                  contractDuration={formData.contractDuration}
                  contractDurationUnit={formData.contractDurationUnit}
                  paymentFrequency={formData.paymentFrequency}
                  backgroundCheckRequired={formData.backgroundCheckRequired}
                  mspFee={formData.mspFee}
                  backgroundCheckMonthlyFee={formData.backgroundCheckMonthlyFee}
                  currency={currency}
                  paymentFrequencies={paymentFrequencies}
                  onFormUpdate={updateFormData}
                />

                <FormActions
                  isCalculating={isCalculating}
                  isFormValid={isFormValid()}
                  error={error}
                  onCalculate={calculateQuote}
                  onClear={handleClearAll}
                />
              </CardContent>
            </Card>
          </div>

          {/* Quote Results Section */}
          <div ref={resultsRef}>
            <QuoteResults
              quote={quote}
              formData={formData}
              currency={currency}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
