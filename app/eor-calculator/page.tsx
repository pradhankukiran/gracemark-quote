"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { RotateCcw } from "lucide-react"
import { ArrowLeft, Calculator, User, MapPin, DollarSign, AlertCircle, Loader2 } from "lucide-react"
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
  startDate: string
  employmentType: string
  quoteType: "all-inclusive" | "statutory-only"
  contractDuration: string
  enableComparison: boolean
  compareCountry: string
  compareState: string
  compareCurrency: string
  compareSalary: string
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

  const STORAGE_KEYS = {
    FORM_DATA: "eor-calculator-form-data",
    QUOTES_DATA: "eor-calculator-quotes-data",
  }

  const saveToLocalStorage = (key: string, data: any) => {
    try {
      const dataWithTimestamp = {
        data,
        timestamp: Date.now(),
        version: "1.0", // For future compatibility
      }
      localStorage.setItem(key, JSON.stringify(dataWithTimestamp))
    } catch (error) {
      console.error("Failed to save to localStorage:", error)
    }
  }

  const loadFromLocalStorage = (key: string, maxAge: number = 24 * 60 * 60 * 1000) => {
    try {
      const stored = localStorage.getItem(key)
      if (!stored) return null

      const parsed = JSON.parse(stored)
      const now = Date.now()

      // Check if data is expired (default: 24 hours)
      if (parsed.timestamp && now - parsed.timestamp > maxAge) {
        localStorage.removeItem(key)
        return null
      }

      return parsed.data
    } catch (error) {
      console.error("Failed to load from localStorage:", error)
      // Clear corrupted data
      localStorage.removeItem(key)
      return null
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0)

    const savedFormData = loadFromLocalStorage(STORAGE_KEYS.FORM_DATA)
    if (savedFormData) {
      setFormData((prev) => ({
        ...prev,
        ...savedFormData,
        // Reset step to form to avoid showing stale quotes
        currentStep: "form",
        showProviderComparison: false,
      }))
    }

    const savedQuotesData = loadFromLocalStorage(STORAGE_KEYS.QUOTES_DATA)
    if (savedQuotesData) {
      if (savedQuotesData.deelQuote) setDeelQuote(savedQuotesData.deelQuote)
      if (savedQuotesData.remoteQuote) setRemoteQuote(savedQuotesData.remoteQuote)
      if (savedQuotesData.compareQuote) setCompareQuote(savedQuotesData.compareQuote)
    }
  }, [])

  const [formData, setFormData] = useState<EORFormData>({
    employeeName: "",
    jobTitle: "",
    country: "",
    state: "",
    currency: "",
    clientCountry: "",
    clientCurrency: "",
    baseSalary: "",
    startDate: "",
    employmentType: "full-time",
    quoteType: "all-inclusive",
    contractDuration: "12",
    enableComparison: false,
    compareCountry: "",
    compareState: "",
    compareCurrency: "",
    compareSalary: "",
    currentStep: "form",
    showProviderComparison: false,
  })

  useEffect(() => {
    // Don't save initial empty state
    if (formData.employeeName || formData.country || formData.baseSalary) {
      saveToLocalStorage(STORAGE_KEYS.FORM_DATA, formData)
    }
  }, [formData])

  const [deelQuote, setDeelQuote] = useState<DeelAPIResponse | null>(null)
  const [remoteQuote, setRemoteQuote] = useState<RemoteAPIResponse | null>(null)
  const [compareQuote, setCompareQuote] = useState<DeelAPIResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const quotesData = {
      deelQuote,
      remoteQuote,
      compareQuote,
      lastUpdated: Date.now(),
    }

    // Only save if we have at least one quote
    if (deelQuote || remoteQuote || compareQuote) {
      saveToLocalStorage(STORAGE_KEYS.QUOTES_DATA, quotesData)
    }
  }, [deelQuote, remoteQuote, compareQuote])

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

  const clearAllData = () => {
    // Reset form data to initial state
    setFormData({
      employeeName: "",
      jobTitle: "",
      country: "",
      state: "",
      currency: "",
      clientCountry: "",
      clientCurrency: "",
      baseSalary: "",
      startDate: "",
      employmentType: "full-time",
      quoteType: "all-inclusive",
      contractDuration: "12",
      enableComparison: false,
      compareCountry: "",
      compareState: "",
      compareCurrency: "",
      compareSalary: "",
      currentStep: "form",
    })

    // Clear all quotes
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)
    setError(null)

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.FORM_DATA)
    localStorage.removeItem(STORAGE_KEYS.QUOTES_DATA)
  }

  const calculateQuote = async () => {
    setIsCalculating(true)
    setError(null)
    localStorage.removeItem(STORAGE_KEYS.QUOTES_DATA)
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)

    try {
      const baseRequestData = {
        salary: formData.baseSalary,
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
          salary: formData.compareSalary,
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
      const baseRequestData = {
        salary: formData.baseSalary,
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2">
                      <Label
                        htmlFor="baseSalary"
                        className="text-sm font-semibold text-slate-700 uppercase tracking-wide block"
                      >
                        Base Salary ({formData.currency})
                      </Label>
                      <Input
                        id="baseSalary"
                        type="number"
                        placeholder={`Enter salary amount in ${formData.currency}`}
                        value={formData.baseSalary}
                        onChange={(e) => setFormData((prev) => ({ ...prev, baseSalary: e.target.value }))}
                        className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
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

                <Separator />

                {/* Country Comparison */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Country Comparison</h3>
                  </div>

                  <div className="space-y-4">
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
                            compareCurrency: "",
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
                            <Input
                              id="compareCurrency"
                              value={formData.compareCurrency}
                              readOnly
                              className="h-11 border-2 border-slate-200 bg-slate-50 text-slate-600"
                            />
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <h5 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                            Comparison Salary
                          </h5>
                          <div className="space-y-2">
                            <Label
                              htmlFor="compareSalary"
                              className="text-sm font-semibold text-slate-700 uppercase tracking-wide block"
                            >
                              Base Salary ({formData.compareCurrency})
                            </Label>
                            <Input
                              id="compareSalary"
                              type="number"
                              placeholder={`Enter salary amount in ${formData.compareCurrency}`}
                              value={formData.compareSalary}
                              onChange={(e) => setFormData((prev) => ({ ...prev, compareSalary: e.target.value }))}
                              className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}
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

                <div className="flex items-end justify-start gap-80">
                  <Button
                    onClick={clearAllData}
                    variant="outline"
                    className="w-auto h-12 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl transition-all duration-200 px-8 bg-transparent cursor-pointer"
                  >
                    <RotateCcw className="mr-2 h-5 w-5" />
                    Clear
                  </Button>
                  <Button
                    onClick={calculateQuote}
                    disabled={isCalculating || !formData.country || !formData.baseSalary || !formData.clientCountry}
                    className="w-auto h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 cursor-pointer"
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

          {/* Quote Results Section */}
          <div className="space-y-6" ref={quoteRef}>
            {/* Primary Deel Quote - only show when NOT comparing countries */}
            {formData.currentStep === "primary-quote" && deelQuote && !formData.enableComparison && (
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
              </>
            )}

            {formData.currentStep === "primary-quote" && deelQuote && formData.enableComparison && compareQuote && (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Country Comparison
                  </h2>
                  <p className="text-lg text-slate-600">
                    Compare EOR costs between {formData.country} and {formData.compareCountry}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Main Country Quote */}
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">{deelQuote.country}</h3>
                        <p className="text-sm text-slate-600">Primary Location</p>
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full mt-2">
                          Main Quote
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

                  {/* Comparison Country Quote */}
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">{compareQuote.country}</h3>
                        <p className="text-sm text-slate-600">Comparison Location</p>
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mt-2">
                          Compare Quote
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Base Salary</span>
                          <span className="font-bold text-lg text-slate-900">
                            {compareQuote.currency} {Number.parseFloat(compareQuote.salary).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-3 px-4 bg-slate-50">
                          <span className="text-slate-600 font-medium">Platform Fee</span>
                          <span className="font-bold text-lg text-slate-900">
                            {compareQuote.currency} {Number.parseFloat(compareQuote.deel_fee).toLocaleString()}
                          </span>
                        </div>

                        {compareQuote.costs.map((cost, index) => (
                          <div key={index} className="flex justify-between items-center py-3 px-4 bg-slate-50">
                            <span className="text-slate-600 font-medium">{cost.name}</span>
                            <span className="font-bold text-lg text-slate-900">
                              {compareQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
                          <div className="text-center">
                            <span className="text-lg font-bold text-slate-900">Total Monthly Cost</span>
                            <div className="text-primary text-2xl font-bold mt-1">
                              {compareQuote.currency} {Number.parseFloat(compareQuote.total_costs).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* Phase 3: Provider Comparison */}
            {/* country comparison section */}
          </div>
        </div>
      </main>
    </div>
  )
}
