"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Calculator, User, MapPin, DollarSign, AlertCircle, ExternalLink } from "lucide-react"
import Link from "next/link"
import {
  getAvailableCountries,
  getCountryByName,
  getStatesForCountry,
  getCurrencyForCountry,
  getStateTypeLabel,
  hasStates,
} from "@/lib/country-data"

interface EORFormData {
  employeeName: string
  jobTitle: string
  country: string
  state: string
  currency: string
  clientCountry: string
  baseSalary: string
  salaryFrequency: "monthly" | "yearly"
  startDate: string
  employmentType: string
  quoteType: "all-inclusive" | "statutory-only"
  contractDuration: string
  provider: "deel" | "remote" | "compare"
  enableComparison: boolean
  compareCountry: string
  compareState: string
  compareCurrency: string
}

interface DeelAPIResponse {
  provider: string
  salary: string
  currency: string
  country: string
  state?: {
    label: string
    value: string
  }
  country_code: string
  deel_fee: string
  severance_accural: string
  total_costs: string
  employer_costs: string
  costs: Array<{
    name: string
    amount: string
    frequency: string
    country: string
    country_code: string
  }>
  benefits_data: any[]
  additional_data: {
    additional_notes: string[]
  }
}

interface RemoteAPIResponse {
  provider: string
  country: string
  currency: string
  salary: {
    annual: number
    monthly: number
  }
  costs: {
    annual_contributions: number
    monthly_contributions: number
    annual_total: number
    monthly_total: number
    monthly_tce: number
    extra_statutory_payments_total: number
    extra_statutory_payments_monthly: number
  }
  regional_costs: {
    currency: string
    annual_gross_salary: number
    monthly_gross_salary: number
    annual_contributions: number
    monthly_contributions: number
    annual_total: number
    monthly_total: number
    monthly_tce: number
    extra_statutory_payments_total: number
    extra_statutory_payments_monthly: number
  }
  details: {
    minimum_onboarding_time: number
    has_extra_statutory_payment: boolean
    country_benefits_url: string
    country_guide_url: string | null
  }
}

export default function EORCalculatorPage() {
  const quoteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [formData, setFormData] = useState<EORFormData>({
    employeeName: "",
    jobTitle: "",
    country: "",
    state: "",
    currency: "USD",
    clientCountry: "",
    baseSalary: "",
    salaryFrequency: "monthly",
    startDate: "",
    employmentType: "full-time",
    quoteType: "all-inclusive",
    contractDuration: "12",
    provider: "compare",
    enableComparison: false,
    compareCountry: "",
    compareState: "",
    compareCurrency: "USD",
  })

  const [deelQuote, setDeelQuote] = useState<DeelAPIResponse | null>(null)
  const [remoteQuote, setRemoteQuote] = useState<RemoteAPIResponse | null>(null)
  const [compareQuote, setCompareQuote] = useState<DeelAPIResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countries = getAvailableCountries()
  const selectedCountryData = formData.country ? getCountryByName(formData.country) : null
  const availableStates = selectedCountryData ? getStatesForCountry(selectedCountryData.code) : []
  const showStateDropdown = selectedCountryData && hasStates(selectedCountryData.code)

  const compareCountryData = formData.compareCountry ? getCountryByName(formData.compareCountry) : null
  const compareAvailableStates = compareCountryData ? getStatesForCountry(compareCountryData.code) : []
  const showCompareStateDropdown = compareCountryData && hasStates(compareCountryData.code)

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

  useEffect(() => {
    if (formData.compareCountry && compareCountryData) {
      const newCurrency = getCurrencyForCountry(compareCountryData.code)
      if (formData.compareCurrency !== newCurrency) {
        setFormData((prev) => ({
          ...prev,
          compareCurrency: newCurrency,
          compareState: "",
        }))
      }
    }
  }, [formData.compareCountry, compareCountryData])

  const calculateQuote = async () => {
    setIsCalculating(true)
    setError(null)
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)

    try {
      const yearlySalary =
        formData.salaryFrequency === "monthly"
          ? (Number.parseFloat(formData.baseSalary) * 12).toString()
          : formData.baseSalary

      const baseRequestData = {
        salary: yearlySalary,
        salaryFrequency: "yearly", // Always send as yearly to APIs
        country: formData.country,
        currency: formData.currency,
        clientCountry: formData.clientCountry,
        age: 30, // Default age for Remote API
        ...(formData.state && { state: formData.state }),
      }

      const promises: Promise<Response>[] = []

      if (formData.provider === "deel" || formData.provider === "compare") {
        promises.push(
          fetch("/api/eor-cost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(baseRequestData),
          }),
        )
      }

      if (formData.provider === "remote" || formData.provider === "compare") {
        promises.push(
          fetch("/api/remote-cost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(baseRequestData),
          }),
        )
      }

      // Add comparison request if enabled
      if (formData.enableComparison && formData.compareCountry) {
        const compareRequestData = {
          salary: yearlySalary,
          salaryFrequency: "yearly",
          country: formData.compareCountry,
          currency: formData.compareCurrency,
          clientCountry: formData.clientCountry,
          age: 30,
          ...(formData.compareState && { state: formData.compareState }),
        }

        promises.push(
          fetch("/api/eor-cost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(compareRequestData),
          }),
        )
      }

      const responses = await Promise.all(promises)
      let responseIndex = 0

      if (formData.provider === "deel" || formData.provider === "compare") {
        if (!responses[responseIndex].ok) {
          const errorData = await responses[responseIndex].json()
          throw new Error(`Deel API error: ${errorData.error || "Failed to calculate quote"}`)
        }
        const deelData: DeelAPIResponse = await responses[responseIndex].json()
        setDeelQuote(deelData)
        responseIndex++
      }

      if (formData.provider === "remote" || formData.provider === "compare") {
        if (!responses[responseIndex].ok) {
          const errorData = await responses[responseIndex].json()
          throw new Error(`Remote API error: ${errorData.error || "Failed to calculate quote"}`)
        }
        const remoteData: RemoteAPIResponse = await responses[responseIndex].json()
        setRemoteQuote(remoteData)
        responseIndex++
      }

      // Handle comparison quote if enabled
      if (formData.enableComparison && responses[responseIndex]) {
        if (!responses[responseIndex].ok) {
          const errorData = await responses[responseIndex].json()
          throw new Error(`Comparison quote error: ${errorData.error || "Failed to calculate comparison quote"}`)
        }
        const compareData: DeelAPIResponse = await responses[responseIndex].json()
        setCompareQuote(compareData)
      }

      setTimeout(() => {
        quoteRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }, 100)
    } catch (err) {
      console.error("Quote calculation error:", err)
      setError(err instanceof Error ? err.message : "Failed to calculate quote")
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <main className="container mx-auto px-6 py-8 max-w-6xl">
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
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Get accurate cost estimates from multiple EOR providers
              </p>
            </div>

            {/* Consolidated Form Fields */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calculator className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Provider Selection</h3>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider" className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Choose Provider
                    </Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value: "deel" | "remote" | "compare") =>
                        setFormData((prev) => ({ ...prev, provider: value }))
                      }
                    >
                      <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deel">Deel Only</SelectItem>
                        <SelectItem value="remote">Remote Only</SelectItem>
                        <SelectItem value="compare">Compare Both Providers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Client Location */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Client Location</h3>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="clientCountry"
                      className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                    >
                      Client Country (Where your company is based)
                    </Label>
                    <Select
                      value={formData.clientCountry}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, clientCountry: value }))}
                    >
                      <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                        <SelectValue placeholder="Select client country" />
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
                </div>

                <Separator />

                {/* Employee Information */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Employee Information</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="employeeName"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Employee Name
                      </Label>
                      <Input
                        id="employeeName"
                        value={formData.employeeName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, employeeName: e.target.value }))}
                        placeholder="John Doe"
                        className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="jobTitle"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Job Title
                      </Label>
                      <Input
                        id="jobTitle"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Software Engineer"
                        className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Location & Currency */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Employee Location</h3>
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
                        <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
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
                          <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
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

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableComparison"
                        checked={formData.enableComparison}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            enableComparison: checked as boolean,
                            compareCountry: "",
                            compareState: "",
                            compareCurrency: "USD",
                          }))
                        }
                      />
                      <Label htmlFor="enableComparison" className="text-sm font-medium text-slate-700">
                        Compare with another country
                      </Label>
                    </div>

                    {formData.enableComparison && (
                      <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                          Comparison Country
                        </h4>
                        <div className={`grid gap-4 ${showCompareStateDropdown ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                          <div className="space-y-2">
                            <Label htmlFor="compareCountry" className="text-sm font-medium text-slate-600">
                              Country
                            </Label>
                            <Select
                              value={formData.compareCountry}
                              onValueChange={(value) => setFormData((prev) => ({ ...prev, compareCountry: value }))}
                            >
                              <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                                <SelectValue placeholder="Select country to compare" />
                              </SelectTrigger>
                              <SelectContent>
                                {countries
                                  .filter((country) => country !== formData.country)
                                  .map((country) => (
                                    <SelectItem key={country} value={country}>
                                      {country}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {showCompareStateDropdown && (
                            <div className="space-y-2">
                              <Label htmlFor="compareState" className="text-sm font-medium text-slate-600">
                                {getStateTypeLabel(compareCountryData?.code || "")}
                              </Label>
                              <Select
                                value={formData.compareState}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, compareState: value }))}
                              >
                                <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                                  <SelectValue
                                    placeholder={`Select ${getStateTypeLabel(compareCountryData?.code || "").toLowerCase()}`}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {compareAvailableStates.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="compareCurrency" className="text-sm font-medium text-slate-600">
                              Currency
                            </Label>
                            <div className="h-11 border-2 border-slate-200 rounded-md px-3 py-2 bg-white flex items-center">
                              <span className="text-slate-700 font-medium">{formData.compareCurrency}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Salary Information */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Salary Information</h3>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="baseSalary"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        {formData.salaryFrequency === "monthly" ? "Monthly" : "Yearly"} Base Salary ({formData.currency}
                        )
                      </Label>
                      <Input
                        id="baseSalary"
                        type="number"
                        value={formData.baseSalary}
                        onChange={(e) => setFormData((prev) => ({ ...prev, baseSalary: e.target.value }))}
                        placeholder={formData.salaryFrequency === "monthly" ? "5000" : "60000"}
                        className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="salaryFrequency"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Salary Frequency
                      </Label>
                      <Select
                        value={formData.salaryFrequency}
                        onValueChange={(value: "monthly" | "yearly") =>
                          setFormData((prev) => ({ ...prev, salaryFrequency: value, baseSalary: "" }))
                        }
                      >
                        <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="employmentType"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Employment Type
                      </Label>
                      <Select
                        value={formData.employmentType}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, employmentType: value }))}
                      >
                        <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-red-800 font-medium">Error calculating quote</h4>
                      <p className="text-red-700 text-sm mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={calculateQuote}
                    disabled={
                      !formData.baseSalary ||
                      !formData.country ||
                      (formData.provider !== "deel" && !formData.clientCountry) ||
                      (formData.enableComparison && !formData.compareCountry) ||
                      isCalculating
                    }
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-10 text-base shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
                  >
                    {isCalculating ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Calculating Quote...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        {formData.provider === "compare" ? "Compare Providers" : "Calculate Quote"}
                      </div>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6" ref={quoteRef}>
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {formData.provider === "compare" && (deelQuote || remoteQuote)
                  ? "Provider Comparison"
                  : "Quote Summary"}
              </h2>
              <p className="text-lg text-slate-600">
                {deelQuote || remoteQuote
                  ? formData.provider === "compare"
                    ? "Compare EOR costs between providers"
                    : "Your comprehensive EOR cost breakdown"
                  : "Complete the form above to see your personalized quote"}
              </p>
            </div>

            {formData.provider === "compare" && (deelQuote || remoteQuote) ? (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Deel Quote */}
                {deelQuote && (
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">Deel</h3>
                        <p className="text-sm text-slate-600">{deelQuote.country}</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-slate-600 font-medium">Base Salary</span>
                          <span className="font-bold text-lg text-slate-900">
                            {deelQuote.currency} {Number.parseFloat(deelQuote.salary).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-slate-600 font-medium">Platform Fee</span>
                          <span className="font-bold text-lg text-slate-900">
                            {deelQuote.currency} {Number.parseFloat(deelQuote.deel_fee).toLocaleString()}
                          </span>
                        </div>

                        {deelQuote.costs.map((cost, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg"
                          >
                            <span className="text-slate-600 font-medium">{cost.name}</span>
                            <span className="font-bold text-lg text-slate-900">
                              {deelQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-xl border-2 border-primary/20">
                          <div className="text-center">
                            <span className="text-lg font-bold text-slate-900">Total Monthly Cost</span>
                            <div className="text-primary text-2xl font-bold mt-1">
                              {deelQuote.currency} {Number.parseFloat(deelQuote.total_costs).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Remote Quote */}
                {remoteQuote && (
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">Remote</h3>
                        <p className="text-sm text-slate-600">{remoteQuote.country}</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-slate-600 font-medium">Base Salary</span>
                          <span className="font-bold text-lg text-slate-900">
                            {remoteQuote.currency} {remoteQuote.salary.monthly.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-slate-600 font-medium">Monthly Contributions</span>
                          <span className="font-bold text-lg text-slate-900">
                            {remoteQuote.currency} {remoteQuote.costs.monthly_contributions.toLocaleString()}
                          </span>
                        </div>

                        {remoteQuote.details.has_extra_statutory_payment && (
                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Extra Statutory Payments</span>
                            <span className="font-bold text-lg text-slate-900">
                              {remoteQuote.currency}{" "}
                              {Math.round(remoteQuote.costs.extra_statutory_payments_monthly).toLocaleString()}
                            </span>
                          </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                            Local Currency Costs ({remoteQuote.regional_costs.currency})
                          </h4>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/50 rounded">
                              <span className="text-slate-600 text-sm">Monthly Salary</span>
                              <span className="font-semibold text-slate-900">
                                {remoteQuote.regional_costs.currency}{" "}
                                {remoteQuote.regional_costs.monthly_gross_salary.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/50 rounded">
                              <span className="text-slate-600 text-sm">Monthly Contributions</span>
                              <span className="font-semibold text-slate-900">
                                {remoteQuote.regional_costs.currency}{" "}
                                {remoteQuote.regional_costs.monthly_contributions.toLocaleString()}
                              </span>
                            </div>

                            {remoteQuote.details.has_extra_statutory_payment && (
                              <div className="flex justify-between items-center py-2 px-3 bg-slate-50/50 rounded">
                                <span className="text-slate-600 text-sm">Extra Statutory Payments</span>
                                <span className="font-semibold text-slate-900">
                                  {remoteQuote.regional_costs.currency}{" "}
                                  {Math.round(
                                    remoteQuote.regional_costs.extra_statutory_payments_monthly,
                                  ).toLocaleString()}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded font-semibold">
                              <span className="text-slate-700 text-sm">Total Monthly Cost</span>
                              <span className="text-slate-900">
                                {remoteQuote.regional_costs.currency}{" "}
                                {remoteQuote.regional_costs.monthly_total.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-slate-600 font-medium">Onboarding Time</span>
                          <span className="font-bold text-lg text-slate-900">
                            {remoteQuote.details.minimum_onboarding_time} days
                          </span>
                        </div>

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-xl border-2 border-primary/20">
                          <div className="text-center">
                            <span className="text-lg font-bold text-slate-900">Total Monthly Cost</span>
                            <div className="text-primary text-2xl font-bold mt-1">
                              {remoteQuote.currency} {remoteQuote.costs.monthly_total.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {(remoteQuote.details.country_benefits_url || remoteQuote.details.country_guide_url) && (
                          <div className="pt-4 space-y-2">
                            {remoteQuote.details.country_benefits_url && (
                              <a
                                href={remoteQuote.details.country_benefits_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View Benefits Guide
                              </a>
                            )}
                            {remoteQuote.details.country_guide_url && (
                              <a
                                href={remoteQuote.details.country_guide_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View Country Guide
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              /* Single Provider Quote Display */
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  {deelQuote || remoteQuote ? (
                    <div className="space-y-6">
                      {deelQuote && (
                        <div className="space-y-4">
                          <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Deel Quote - {deelQuote.country}</h3>
                          </div>

                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Base Salary</span>
                            <span className="font-bold text-lg text-slate-900">
                              {deelQuote.currency} {Number.parseFloat(deelQuote.salary).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Deel Platform Fee</span>
                            <span className="font-bold text-lg text-slate-900">
                              {deelQuote.currency} {Number.parseFloat(deelQuote.deel_fee).toLocaleString()}
                            </span>
                          </div>

                          {deelQuote.costs.map((cost, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg"
                            >
                              <span className="text-slate-600 font-medium">{cost.name}</span>
                              <span className="font-bold text-lg text-slate-900">
                                {deelQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                              </span>
                            </div>
                          ))}

                          <Separator className="my-6" />

                          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-xl border-2 border-primary/20">
                            <div className="flex justify-between items-center">
                              <span className="text-xl font-bold text-slate-900">Total Monthly Cost</span>
                              <span className="text-primary text-3xl font-bold">
                                {deelQuote.currency} {Number.parseFloat(deelQuote.total_costs).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {remoteQuote && (
                        <div className="space-y-4">
                          <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Remote Quote - {remoteQuote.country}</h3>
                          </div>

                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Base Salary</span>
                            <span className="font-bold text-lg text-slate-900">
                              {remoteQuote.currency} {remoteQuote.salary.monthly.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Monthly Contributions</span>
                            <span className="font-bold text-lg text-slate-900">
                              {remoteQuote.currency} {remoteQuote.costs.monthly_contributions.toLocaleString()}
                            </span>
                          </div>

                          {remoteQuote.details.has_extra_statutory_payment && (
                            <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                              <span className="text-slate-600 font-medium">Extra Statutory Payments</span>
                              <span className="font-bold text-lg text-slate-900">
                                {remoteQuote.currency}{" "}
                                {Math.round(remoteQuote.costs.extra_statutory_payments_monthly).toLocaleString()}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Annual Total Cost</span>
                            <span className="font-bold text-lg text-slate-900">
                              {remoteQuote.currency} {remoteQuote.costs.annual_total.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 font-medium">Onboarding Time</span>
                            <span className="font-bold text-lg text-slate-900">
                              {remoteQuote.details.minimum_onboarding_time} days
                            </span>
                          </div>

                          <Separator className="my-6" />

                          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-xl border-2 border-primary/20">
                            <div className="flex justify-between items-center">
                              <span className="text-xl font-bold text-slate-900">Total Monthly Cost</span>
                              <span className="text-primary text-3xl font-bold">
                                {remoteQuote.currency} {remoteQuote.costs.monthly_total.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {(remoteQuote.details.country_benefits_url || remoteQuote.details.country_guide_url) && (
                            <div className="pt-4 space-y-2 border-t border-slate-200">
                              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                                Additional Resources
                              </h4>
                              <div className="space-y-2">
                                {remoteQuote.details.country_benefits_url && (
                                  <a
                                    href={remoteQuote.details.country_benefits_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    View Benefits Guide for {remoteQuote.country}
                                  </a>
                                )}
                                {remoteQuote.details.country_guide_url && (
                                  <a
                                    href={remoteQuote.details.country_guide_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    View Country Hiring Guide
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
