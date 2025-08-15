"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  Calculator,
  User,
  MapPin,
  DollarSign,
  AlertCircle,
  ExternalLink,
  Loader2,
  BarChart3,
} from "lucide-react"
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
  clientCurrency: string // Added client currency field
  baseSalary: string
  salaryFrequency: "monthly" | "yearly"
  startDate: string
  employmentType: string
  quoteType: "all-inclusive" | "statutory-only"
  contractDuration: string
  enableComparison: boolean
  compareCountry: string
  compareState: string
  compareCurrency: string
  currentStep: "form" | "primary-quote" | "comparison"
  showProviderComparison: boolean
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
    clientCurrency: "USD", // Added client currency to initial state
    baseSalary: "",
    salaryFrequency: "monthly",
    startDate: "",
    employmentType: "full-time",
    quoteType: "all-inclusive",
    contractDuration: "12",
    enableComparison: false,
    compareCountry: "",
    compareState: "",
    compareCurrency: "USD",
    currentStep: "form",
    showProviderComparison: false,
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

  const clientCountryData = formData.clientCountry ? getCountryByName(formData.clientCountry) : null

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

  useEffect(() => {
    if (formData.clientCountry && clientCountryData) {
      const newClientCurrency = getCurrencyForCountry(clientCountryData.code)
      if (formData.clientCurrency !== newClientCurrency) {
        setFormData((prev) => ({
          ...prev,
          clientCurrency: newClientCurrency,
        }))
      }
    }
  }, [formData.clientCountry, clientCountryData])

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
        salaryFrequency: "yearly",
        country: formData.country,
        currency: formData.currency,
        clientCountry: formData.clientCountry,
        age: 30,
        ...(formData.state && { state: formData.state }),
      }

      const deelResponse = await fetch("/api/eor-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseRequestData),
      })

      if (!deelResponse.ok) {
        const errorData = await deelResponse.json()
        throw new Error(`Deel API error: ${errorData.error || "Failed to calculate quote"}`)
      }

      const deelData: DeelAPIResponse = await deelResponse.json()
      setDeelQuote(deelData)

      setFormData((prev) => ({ ...prev, currentStep: "primary-quote" }))

      // Handle comparison quote if enabled
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

        const compareResponse = await fetch("/api/eor-cost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(compareRequestData),
        })

        if (compareResponse.ok) {
          const compareData: DeelAPIResponse = await compareResponse.json()
          setCompareQuote(compareData)
        }
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

  const enableProviderComparison = async () => {
    if (!deelQuote) return

    setIsCalculating(true)
    setError(null)
    setRemoteQuote(null)

    try {
      const yearlySalary =
        formData.salaryFrequency === "monthly"
          ? (Number.parseFloat(formData.baseSalary) * 12).toString()
          : formData.baseSalary

      const baseRequestData = {
        salary: yearlySalary,
        salaryFrequency: "yearly",
        country: formData.country,
        currency: formData.currency,
        clientCountry: formData.clientCountry,
        age: 30,
        ...(formData.state && { state: formData.state }),
      }

      const remoteResponse = await fetch("/api/remote-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseRequestData),
      })

      if (!remoteResponse.ok) {
        const errorData = await remoteResponse.json()
        throw new Error(`Remote API error: ${errorData.error || "Failed to calculate quote"}`)
      }

      const remoteData: RemoteAPIResponse = await remoteResponse.json()
      setRemoteQuote(remoteData)

      setFormData((prev) => ({
        ...prev,
        currentStep: "comparison",
        showProviderComparison: true,
      }))
    } catch (err) {
      console.error("Provider comparison error:", err)
      setError(err instanceof Error ? err.message : "Failed to get comparison quote")
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
                Get accurate EOR cost estimates starting with Deel's comprehensive data
              </p>
            </div>

            {/* Consolidated Form Fields */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                {/* Client Location */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Client Location</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="clientCountry"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Client Country
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
                    <div className="space-y-2">
                      <Label
                        htmlFor="clientCurrency"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                      >
                        Client Currency
                      </Label>
                      <div className="h-11 border-2 border-slate-200 px-3 py-2 bg-slate-50 flex items-center">
                        <span className="text-slate-700 font-medium">{formData.clientCurrency}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Employee Information */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10">
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
                    <div className="p-2 bg-primary/10">
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
                      <div className="h-11 border-2 border-slate-200 px-3 py-2 bg-slate-50 flex items-center">
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
                      <div className="p-4 bg-slate-50 border-2 border-slate-200">
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
                            <div className="h-11 border-2 border-slate-200 px-3 py-2 bg-white flex items-center">
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
                    <div className="p-2 bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Salary Information</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div className="col-span-2 space-y-2">
                      <Label
                        htmlFor="baseSalary"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide block"
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
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide block"
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
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide block"
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
                  <div className="bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-red-800 font-medium">Error calculating quote</h4>
                      <p className="text-red-700 text-sm mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={calculateQuote}
                    disabled={isCalculating || !formData.country || !formData.baseSalary || !formData.clientCountry}
                    className="w-auto h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Calculating Quote...
                      </>
                    ) : (
                      <>
                        <Calculator className="mr-2 h-5 w-5" />
                        Get Quote
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6" ref={quoteRef}>
            {/* Phase 1: Primary Deel Quote */}
            {formData.currentStep === "primary-quote" && deelQuote && (
              <>
                <div className="text-center space-y-3">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Primary Quote - Deel
                  </h2>
                  <p className="text-lg text-slate-600">Your comprehensive EOR cost breakdown from Deel</p>
                </div>

                <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Deel Quote - {deelQuote.country}</h3>
                      <p className="text-sm text-slate-600">Reliable EOR provider with comprehensive legal coverage</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                        <span className="text-slate-600 font-medium">Base Salary</span>
                        <span className="font-bold text-lg text-slate-900">
                          {deelQuote.currency} {Number.parseFloat(deelQuote.salary).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                        <span className="text-slate-600 font-medium">Platform Fee</span>
                        <span className="font-bold text-lg text-slate-900">
                          {deelQuote.currency} {Number.parseFloat(deelQuote.deel_fee).toLocaleString()}
                        </span>
                      </div>

                      {deelQuote.costs.map((cost, index) => (
                        <div key={index} className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">{cost.name}</span>
                          <span className="font-bold text-lg text-slate-900">
                            {deelQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                          </span>
                        </div>
                      ))}

                      <Separator className="my-4" />

                      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
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

                {!formData.showProviderComparison && (
                  <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-slate-900">Want to compare with other providers?</h3>
                        <p className="text-slate-600">
                          Get quotes from Remote to compare costs and find the best option for your needs
                        </p>
                      </div>
                      <Button
                        onClick={enableProviderComparison}
                        disabled={isCalculating}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
                      >
                        {isCalculating ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Getting Comparison...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="mr-2 h-5 w-5" />
                            Compare with Remote
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Phase 3: Provider Comparison */}
            {formData.currentStep === "comparison" && formData.showProviderComparison && deelQuote && remoteQuote && (
              <>
                <div className="text-center space-y-3">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Provider Comparison
                  </h2>
                  <p className="text-lg text-slate-600">Compare EOR costs between Deel and Remote</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Deel Quote */}
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">Deel</h3>
                        <p className="text-sm text-slate-600">{deelQuote.country}</p>
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full mt-2">
                          Primary Provider
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Base Salary</span>
                          <span className="font-bold text-lg text-slate-900">
                            {deelQuote.currency} {Number.parseFloat(deelQuote.salary).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Platform Fee</span>
                          <span className="font-bold text-lg text-slate-900">
                            {deelQuote.currency} {Number.parseFloat(deelQuote.deel_fee).toLocaleString()}
                          </span>
                        </div>

                        {deelQuote.costs.map((cost, index) => (
                          <div key={index} className="flex justify-between items-center py-3 px-4 bg-slate-50">
                            <span className="text-slate-600 font-medium">{cost.name}</span>
                            <span className="font-bold text-lg text-slate-900">
                              {deelQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
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

                  {/* Remote Quote */}
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">Remote</h3>
                        <p className="text-sm text-slate-600">{remoteQuote.country}</p>
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mt-2">
                          Comparison Provider
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Base Salary</span>
                          <span className="font-bold text-lg text-slate-900">
                            {remoteQuote.currency} {remoteQuote.salary.monthly.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Monthly Contributions</span>
                          <span className="font-bold text-lg text-slate-900">
                            {remoteQuote.currency} {remoteQuote.costs.monthly_contributions.toLocaleString()}
                          </span>
                        </div>

                        {remoteQuote.details.has_extra_statutory_payment && (
                          <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
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
                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/50">
                              <span className="text-slate-600 text-sm">Monthly Salary</span>
                              <span className="font-semibold text-slate-900">
                                {remoteQuote.regional_costs.currency}{" "}
                                {remoteQuote.regional_costs.monthly_gross_salary.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/50">
                              <span className="text-slate-600 text-sm">Monthly Contributions</span>
                              <span className="font-semibold text-slate-900">
                                {remoteQuote.regional_costs.currency}{" "}
                                {remoteQuote.regional_costs.monthly_contributions.toLocaleString()}
                              </span>
                            </div>

                            {remoteQuote.details.has_extra_statutory_payment && (
                              <div className="flex justify-between items-center py-2 px-3 bg-slate-50/50">
                                <span className="text-slate-600 text-sm">Extra Statutory Payments</span>
                                <span className="font-semibold text-slate-900">
                                  {remoteQuote.regional_costs.currency}{" "}
                                  {Math.round(
                                    remoteQuote.regional_costs.extra_statutory_payments_monthly,
                                  ).toLocaleString()}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-center py-2 px-3 bg-primary/10 font-semibold">
                              <span className="text-slate-700 text-sm">Total Monthly Cost</span>
                              <span className="text-slate-900">
                                {remoteQuote.regional_costs.currency}{" "}
                                {remoteQuote.regional_costs.monthly_total.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Onboarding Time</span>
                          <span className="font-bold text-lg text-slate-900">
                            {remoteQuote.details.minimum_onboarding_time} days
                          </span>
                        </div>

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
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
                </div>
              </>
            )}

            {/* country comparison section */}
          </div>
        </div>
      </main>
    </div>
  )
}
