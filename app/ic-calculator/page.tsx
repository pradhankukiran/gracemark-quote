"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { exportICCostBreakdownPdf } from "@/lib/pdf/exportICCostBreakdown"
import type { ICPdfData, ICPdfCostItem } from "@/lib/pdf/ICCostBreakdownDocument"
import { imageToBase64 } from "@/lib/pdf/logoUtils"

export default function ICCalculatorPage() {
  // Initialize hooks
  const {
    formData,
    currency,
    displayCurrency,
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
    handleCurrencyToggle,
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
    currency: displayCurrency,
  })

  const [isExportingPdf, setIsExportingPdf] = useState(false)

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

  const handleExportPdf = useCallback(async () => {
    if (!quote) return

    setIsExportingPdf(true)

    try {
      // Format currency
      const formatCurrency = (amount: number) => {
        return `${displayCurrency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }

      // Determine rate display info
      const isHourlyBasis = formData.rateBasis === "hourly"
      const markupPercentageValue = Number(formData.markupPercentage)
      const resolvedMarkupPercentage = Number.isFinite(markupPercentageValue) ? markupPercentageValue : 40

      // Build cost breakdown items
      const costItems: ICPdfCostItem[] = [
        {
          label: "Contractor Pay Rate",
          value: formatCurrency(quote.monthlyPayRate),
        },
        {
          label: "Agency Fee (Markup)",
          value: formatCurrency(quote.monthlyAgencyFee),
          description: `${formatCurrency(quote.monthlyPayRate)} × ${resolvedMarkupPercentage.toFixed(2)}%`,
        },
        {
          label: "Platform Fee (per payout)",
          value: formatCurrency(quote.transactionCost),
          description: `${quote.transactionsPerMonth} × $55 USD`,
        },
      ]

      if (quote.mspFee > 0) {
        costItems.push({
          label: "MSP Fee",
          value: formatCurrency(quote.mspFee),
        })
      }

      if (quote.backgroundCheckMonthlyFee > 0) {
        costItems.push({
          label: "Background Check Fee (amortized)",
          value: formatCurrency(quote.backgroundCheckMonthlyFee),
        })
      }

      // Contract duration display
      const contractDurationDisplay = formData.contractDuration
        ? (() => {
            const numericValue = Number(formData.contractDuration)
            const isSingular = Math.abs(numericValue) === 1
            if (formData.contractDurationUnit === "years") {
              return `${formData.contractDuration} ${isSingular ? "year" : "years"}`
            }
            return `${formData.contractDuration} ${isSingular ? "month" : "months"}`
          })()
        : "Not specified"

      // Total client cost
      const totalClientCost = quote.monthlyBillRate + quote.transactionCost + quote.backgroundCheckMonthlyFee + quote.mspFee

      // Load logo
      const logoBase64 = await imageToBase64("/GraceMarklogo.png")

      const pdfData: ICPdfData = {
        contractorName: formData.contractorName || "Contractor",
        country: formData.country,
        currency: displayCurrency,
        showUSD: formData.displayInUSD,
        rateInfo: {
          payRateHourly: formatCurrency(quote.payRate),
          payRateMonthly: formatCurrency(quote.monthlyPayRate),
          billRateHourly: formatCurrency(quote.billRate),
          billRateMonthly: formatCurrency(quote.monthlyBillRate),
          agencyFeeHourly: formatCurrency(quote.agencyFee),
          agencyFeeMonthly: formatCurrency(quote.monthlyAgencyFee),
          markupPercentage: resolvedMarkupPercentage.toFixed(2),
          workedHours: quote.workedHours,
        },
        costBreakdown: costItems,
        totalClientCost: formatCurrency(totalClientCost),
        monthlyMarkup: formatCurrency(quote.monthlyMarkup),
        contractDuration: contractDurationDisplay,
        paymentFrequency: formData.paymentFrequency.charAt(0).toUpperCase() + formData.paymentFrequency.slice(1),
        logoSrc: logoBase64 || "/GraceMarklogo.png",
      }

      const safeContractorName = (formData.contractorName || "contractor")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      const filename = `gracemark-ic-breakdown-${safeContractorName}.pdf`

      await exportICCostBreakdownPdf(pdfData, filename)
    } catch (error) {
      console.error("Failed to export IC PDF:", error)
    } finally {
      setIsExportingPdf(false)
    }
  }, [quote, formData, displayCurrency])

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
                  displayInUSD={formData.displayInUSD}
                  countries={countries}
                  onFormUpdate={updateFormData}
                  onCountryChange={handleCountryChange}
                  onCurrencyToggle={handleCurrencyToggle}
                />

                <Separator />

                <RateConfigurationForm
                  rateBasis={formData.rateBasis}
                  rateAmount={formData.rateAmount}
                  totalMonthlyHours={formData.totalMonthlyHours}
                  markupPercentage={formData.markupPercentage}
                  rateConversionMessage={rateConversionMessage}
                  currency={displayCurrency}
                  onFormUpdate={updateFormData}
                />

                <Separator />

                <ContractDetailsForm
                  contractDuration={formData.contractDuration}
                  contractDurationUnit={formData.contractDurationUnit}
                  paymentFrequency={formData.paymentFrequency}
                  backgroundCheckRequired={formData.backgroundCheckRequired}
                  mspPercentage={formData.mspPercentage}
                  backgroundCheckMonthlyFee={formData.backgroundCheckMonthlyFee}
                  currency={displayCurrency}
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
              currency={displayCurrency}
              onExportPdf={handleExportPdf}
              isExportingPdf={isExportingPdf}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
