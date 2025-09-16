"use client"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { useICForm } from "./hooks/useICForm"
import { useICQuoteCalculation } from "./hooks/useICQuoteCalculation"

import { ContractorInfoForm } from "./components/ContractorInfoForm"
import { RateConfigurationForm } from "./components/RateConfigurationForm"
import { LocationForm } from "./components/LocationForm"
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
    serviceTypes,
    paymentFrequencies,
    contractDurations,
    complianceLevels,
    updateFormData,
    updateValidationError,
    clearValidationErrors,
    clearAllData,
    clearStoredData,
    isFormValid,
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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleClearAll = () => {
    clearAllData()
    clearQuote()
    clearError()
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
                  serviceType={formData.serviceType}
                  serviceTypes={serviceTypes}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <RateConfigurationForm
                  rateType={formData.rateType}
                  rateAmount={formData.rateAmount}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <LocationForm
                  country={formData.country}
                  state={formData.state}
                  currency={currency}
                  countries={countries}
                  availableStates={availableStates}
                  showStateDropdown={showStateDropdown}
                  onFormUpdate={updateFormData}
                  onCountryChange={handleCountryChange}
                />

                <Separator />

                <ContractDetailsForm
                  contractDuration={formData.contractDuration}
                  paymentFrequency={formData.paymentFrequency}
                  complianceLevel={formData.complianceLevel}
                  backgroundCheckRequired={formData.backgroundCheckRequired}
                  contractDurations={contractDurations}
                  paymentFrequencies={paymentFrequencies}
                  complianceLevels={complianceLevels}
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
          <QuoteResults
            quote={quote}
            formData={formData}
            currency={currency}
          />
        </div>
      </main>
    </div>
  )
}
