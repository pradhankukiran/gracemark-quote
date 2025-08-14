"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Calculator, User, MapPin, DollarSign } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import {
  getAvailableCountries,
  getCountryByName,
  getStatesForCountry,
  getCurrencyForCountry,
  getStateTypeLabel,
  hasStates,
} from "@/lib/country-data"

interface ICFormData {
  contractorName: string
  serviceType: string
  country: string
  state: string
  currency: string
  rateType: "pay-rate" | "bill-rate"
  rateAmount: string
  paymentFrequency: string
  contractDuration: string
  complianceLevel: string
  backgroundCheckRequired: boolean
}

interface ICQuoteResult {
  payRate: number
  billRate: number
  platformFee: number
  paymentProcessing: number
  complianceFee: number
  backgroundCheck: number
  systemProviderCost: number
  netMargin: number
  totalMonthlyCost: number
  contractorReceives: number
  workedHours: number
}

export default function ICCalculatorPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [formData, setFormData] = useState<ICFormData>({
    contractorName: "",
    serviceType: "",
    country: "",
    state: "",
    currency: "USD",
    rateType: "pay-rate",
    rateAmount: "",
    paymentFrequency: "monthly",
    contractDuration: "12",
    complianceLevel: "standard",
    backgroundCheckRequired: false,
  })

  const [quote, setQuote] = useState<ICQuoteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const countries = getAvailableCountries()
  const selectedCountryData = formData.country ? getCountryByName(formData.country) : null
  const availableStates = selectedCountryData ? getStatesForCountry(selectedCountryData.code) : []
  const showStateDropdown = selectedCountryData && hasStates(selectedCountryData.code)

  useEffect(() => {
    if (formData.country && selectedCountryData) {
      const newCurrency = getCurrencyForCountry(selectedCountryData.code)
      if (formData.currency !== newCurrency) {
        setFormData((prev) => ({
          ...prev,
          currency: newCurrency,
          state: "",
        }))
      }
    }
  }, [formData.country, selectedCountryData])

  const serviceTypes = [
    "Software Development",
    "Design & Creative",
    "Marketing & Sales",
    "Writing & Content",
    "Consulting",
    "Data & Analytics",
    "Customer Support",
    "Other",
  ]

  const calculateQuote = async () => {
    setIsCalculating(true)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const rateAmount = Number.parseFloat(formData.rateAmount) || 0
    const workedHours = 160 // Standard 160 hours per month
    const targetNetMargin = 1000 // $1,000 USD net monthly margin

    // Fixed costs
    const platformFeeRate = 0.049 // 4.9%
    const paymentProcessingRate = 0.029 // 2.9%
    const complianceFeeRate = formData.complianceLevel === "premium" ? 0.02 : 0.01
    const systemProviderCost = 150 // Monthly system provider cost
    const backgroundCheckCost = formData.backgroundCheckRequired ? 200 : 0 // One-time cost amortized over contract
    const contractMonths = Number.parseInt(formData.contractDuration) || 12
    const monthlyBackgroundCheck = backgroundCheckCost / contractMonths

    let payRate: number
    let billRate: number

    if (formData.rateType === "pay-rate") {
      payRate = rateAmount
      const monthlyPayRate = payRate * workedHours

      // Bill Rate = Pay Rate + System Provider + Background Check + Net Margin + Platform Fees
      const baseCosts = monthlyPayRate + systemProviderCost + monthlyBackgroundCheck + targetNetMargin
      // Account for platform fees in the bill rate calculation
      billRate = baseCosts / (1 - platformFeeRate - paymentProcessingRate - complianceFeeRate) / workedHours
    } else {
      billRate = rateAmount
      const monthlyBillRate = billRate * workedHours

      // Calculate all fees first
      const platformFee = monthlyBillRate * platformFeeRate
      const paymentProcessing = monthlyBillRate * paymentProcessingRate
      const complianceFee = monthlyBillRate * complianceFeeRate
      const totalFees = platformFee + paymentProcessing + complianceFee

      // Pay Rate = Bill Rate - All Costs - Net Margin
      const availableForPayRate =
        monthlyBillRate - totalFees - systemProviderCost - monthlyBackgroundCheck - targetNetMargin
      payRate = Math.max(0, availableForPayRate / workedHours)
    }

    // Calculate final values based on the determined rates
    const monthlyPayRate = payRate * workedHours
    const monthlyBillRate = billRate * workedHours

    const platformFee = monthlyBillRate * platformFeeRate
    const paymentProcessing = monthlyBillRate * paymentProcessingRate
    const complianceFee = monthlyBillRate * complianceFeeRate

    const netMargin =
      monthlyBillRate -
      monthlyPayRate -
      platformFee -
      paymentProcessing -
      complianceFee -
      systemProviderCost -
      monthlyBackgroundCheck

    setQuote({
      payRate,
      billRate,
      platformFee,
      paymentProcessing,
      complianceFee,
      backgroundCheck: monthlyBackgroundCheck,
      systemProviderCost,
      netMargin,
      totalMonthlyCost: monthlyBillRate,
      contractorReceives: monthlyPayRate,
      workedHours,
    })

    setIsCalculating(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-accent transition-all duration-200 hover:gap-3 font-medium"
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
                Get an accurate cost estimate for your Independent Contractor services
              </p>
            </div>

            {/* Consolidated Form Fields */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                {/* Contractor Information */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <User className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Contractor Information</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="contractorName"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Contractor Name
                      </Label>
                      <Input
                        id="contractorName"
                        value={formData.contractorName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contractorName: e.target.value }))}
                        placeholder="Enter contractor name"
                        className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="serviceType"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Service Type
                      </Label>
                      <Select
                        value={formData.serviceType}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceType: value }))}
                      >
                        <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <Calculator className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Rate Configuration</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="rateType"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Rate Type
                      </Label>
                      <Select
                        value={formData.rateType}
                        onValueChange={(value: "pay-rate" | "bill-rate") =>
                          setFormData((prev) => ({ ...prev, rateType: value }))
                        }
                      >
                        <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pay-rate">Pay Rate (What contractor receives)</SelectItem>
                          <SelectItem value="bill-rate">Bill Rate (What client pays)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="rateAmount"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        {formData.rateType === "pay-rate" ? "Pay Rate" : "Bill Rate"} (per hour)
                      </Label>
                      <Input
                        id="rateAmount"
                        type="number"
                        value={formData.rateAmount}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rateAmount: e.target.value }))}
                        placeholder={formData.rateType === "pay-rate" ? "50" : "75"}
                        className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Location & Currency */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Location & Currency</h3>
                  </div>
                  <div className={`grid gap-4 ${showStateDropdown ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                        Country
                      </Label>
                      <Select
                        value={formData.country}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, country: value }))}
                      >
                        <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {showStateDropdown && (
                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          {getStateTypeLabel(selectedCountryData?.code || "")}
                        </Label>
                        <Select
                          value={formData.state}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, state: value }))}
                        >
                          <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                            <SelectValue
                              placeholder={`Select ${getStateTypeLabel(selectedCountryData?.code || "").toLowerCase()}`}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableStates.map((state) => (
                              <SelectItem key={state.code} value={state.code}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label
                        htmlFor="currency"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Currency
                      </Label>
                      <div className="h-11 border-2 border-slate-200 rounded-md px-3 py-2 bg-slate-50 flex items-center">
                        <span className="text-slate-700 font-medium">{formData.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contract Details */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Contract Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="contractDuration"
                          className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                        >
                          Contract Duration (Months)
                        </Label>
                        <Select
                          value={formData.contractDuration}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, contractDuration: value }))}
                        >
                          <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 Months</SelectItem>
                            <SelectItem value="6">6 Months</SelectItem>
                            <SelectItem value="12">12 Months</SelectItem>
                            <SelectItem value="24">24 Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="paymentFrequency"
                          className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                        >
                          Payment Frequency
                        </Label>
                        <Select
                          value={formData.paymentFrequency}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentFrequency: value }))}
                        >
                          <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="milestone">Milestone-based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="complianceLevel"
                          className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                        >
                          Compliance Level
                        </Label>
                        <Select
                          value={formData.complianceLevel}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, complianceLevel: value }))}
                        >
                          <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard (1%)</SelectItem>
                            <SelectItem value="premium">Premium (2%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="backgroundCheck"
                        checked={formData.backgroundCheckRequired}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, backgroundCheckRequired: e.target.checked }))
                        }
                        className="h-4 w-4 text-accent focus:ring-accent border-gray-300 rounded"
                      />
                      <Label htmlFor="backgroundCheck" className="text-sm font-medium text-slate-700">
                        Background Check Required ($200 one-time fee)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={calculateQuote}
                    disabled={!formData.rateAmount || !formData.country || isCalculating}
                    size="lg"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 px-10 text-base shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
                  >
                    {isCalculating ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Calculating Quote...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Calculate IC Quote
                      </div>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quote Results Section */}
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Quote Breakdown
              </h2>
              <p className="text-lg text-slate-600">
                {quote
                  ? "Your comprehensive IC contract cost breakdown"
                  : "Complete the form above to see your personalized quote"}
              </p>
            </div>

            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardContent className="p-6">
                {quote ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-primary/10 p-4 rounded-xl text-center border-2 border-primary/20">
                        <div className="text-sm text-slate-600 font-semibold mb-2 uppercase tracking-wide">
                          Pay Rate (Contractor)
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {formData.currency} {quote.payRate.toFixed(2)}/hr
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          {formData.currency} {quote.contractorReceives.toLocaleString()}/month
                        </div>
                      </div>
                      <div className="bg-accent/10 p-4 rounded-xl text-center border-2 border-accent/20">
                        <div className="text-sm text-slate-600 font-semibold mb-2 uppercase tracking-wide">
                          Bill Rate (Client)
                        </div>
                        <div className="text-2xl font-bold text-accent">
                          {formData.currency} {quote.billRate.toFixed(2)}/hr
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          {formData.currency} {quote.totalMonthlyCost.toLocaleString()}/month
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                      Based on {quote.workedHours} hours per month
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-medium">Platform Fee (4.9%)</span>
                        <span className="font-bold text-lg text-slate-900">
                          {formData.currency} {quote.platformFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-medium">Payment Processing (2.9%)</span>
                        <span className="font-bold text-lg text-slate-900">
                          {formData.currency} {quote.paymentProcessing.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-medium">
                          Compliance Fee ({formData.complianceLevel === "premium" ? "2%" : "1%"})
                        </span>
                        <span className="font-bold text-lg text-slate-900">
                          {formData.currency} {quote.complianceFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-medium">System Provider Cost</span>
                        <span className="font-bold text-lg text-slate-900">
                          {formData.currency} {quote.systemProviderCost.toLocaleString()}
                        </span>
                      </div>

                      {quote.backgroundCheck > 0 && (
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-slate-600 font-medium">Background Check (Amortized)</span>
                          <span className="font-bold text-lg text-slate-900">
                            {formData.currency} {quote.backgroundCheck.toLocaleString()}
                          </span>
                        </div>
                      )}

                      <Separator className="my-6" />

                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-bold text-slate-900">Net Monthly Margin</span>
                          <span className="text-green-600 text-3xl font-bold">
                            {formData.currency} {quote.netMargin.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-center mt-2 text-sm text-slate-600">
                          Target: $1,000 USD per month (160 hours)
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="p-4 bg-slate-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Calculator className="h-10 w-10 text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-base font-medium">
                      Fill out the form above to generate your personalized quote
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
