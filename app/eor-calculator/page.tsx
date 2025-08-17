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
import { convertCurrency, formatConversionDisplay } from "@/lib/currency-converter"

interface EORFormData {
  employeeName: string
  jobTitle: string
  workVisaRequired: boolean
  country: string
  state: string
  currency: string
  clientCountry: string
  clientCurrency: string // Added client currency field
  baseSalary: string
  holidayDays: string
  probationPeriod: string
  hoursPerDay: string
  daysPerWeek: string
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

interface ValidationAPIResponse {
  data: {
    holiday: {
      min: string
      max: string | null
      mostCommon: string
    }
    part_time_holiday: {
      type: string
      min: string
    }
    sick_days: {
      min: string | null
      max: string | null
    }
    salary: {
      min: string
      max: string
      frequency: string
    }
    probation: {
      min: string | null
      max: string | null
      probationRulesForJobCategorisation: any[]
    }
    part_time_probation: {
      min: string | null
      max: string | null
    }
    work_schedule: {
      days: {
        max: string
        min: string
      }
      hours: {
        max: string
        min: string
      }
    }
    currency: string
    hiring_guide_country_name: string
    start_date_buffer: number
    definite_contract: {
      type: string
      maximum_limitation: string | null
    }
    adjustments_information_box: string
    health_insurance: {
      status: string
      providers: Array<{
        id: string
        name: string
        is_unisure: boolean
        home_page_url: string
        currency: string
        attachments: any[]
        plans: Array<{
          name: string
          price: string
          currency: string
          is_enabled: boolean
          id: string
        }>
      }>
    }
    pension: {
      status: string
      providers: Array<{
        id: string
        name: string
        home_page_url: string
        contribution: {
          type: string
          minimum: string
          maximum: string
        }
      }>
    }
    mandatory_fields: any[]
  }
}

export default function EORCalculatorPage() {
  const quoteRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    window.scrollTo(0, 0)

    // Cleanup timeouts on unmount
    return () => {
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }
    }
  }, [])

  const [formData, setFormData] = useState<EORFormData>({
    employeeName: "",
    jobTitle: "",
    workVisaRequired: false,
    country: "",
    state: "",
    currency: "",
    clientCountry: "",
    clientCurrency: "",
    baseSalary: "",
    holidayDays: "",
    probationPeriod: "",
    hoursPerDay: "",
    daysPerWeek: "",
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


  const [deelQuote, setDeelQuote] = useState<DeelAPIResponse | null>(null)
  const [remoteQuote, setRemoteQuote] = useState<RemoteAPIResponse | null>(null)
  const [compareQuote, setCompareQuote] = useState<DeelAPIResponse | null>(null)
  const [validationData, setValidationData] = useState<ValidationAPIResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isLoadingValidations, setIsLoadingValidations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Currency conversion state
  const [isConverting, setIsConverting] = useState(false)
  const [conversionInfo, setConversionInfo] = useState<string | null>(null)
  const [isComparisonManuallyEdited, setIsComparisonManuallyEdited] = useState(false)

  // USD conversion state
  const [usdConversions, setUsdConversions] = useState<{
    deel?: {
      salary: number
      deelFee: number
      costs: number[]
      totalCosts: number
    }
    compare?: {
      salary: number
      deelFee: number
      costs: number[]
      totalCosts: number
    }
    remote?: {
      monthlySalary: number
      monthlyContributions: number
      monthlyTotal: number
      monthlyTce: number
    }
  }>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)

  // Validation error states
  const [salaryError, setSalaryError] = useState<string | null>(null)
  const [holidaysError, setHolidaysError] = useState<string | null>(null)
  const [probationError, setProbationError] = useState<string | null>(null)
  const [hoursError, setHoursError] = useState<string | null>(null)
  const [daysError, setDaysError] = useState<string | null>(null)

  // Refs
  const baseSalaryInputRef = useRef<HTMLInputElement>(null)
  const conversionTimeoutRef = useRef<NodeJS.Timeout | null>(null)



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
          compareSalary: "", // Clear comparison salary when changing country
        }))

        // Clear conversion info when changing country
        setConversionInfo(null)
        // Reset manual edit flag when country changes
        setIsComparisonManuallyEdited(false)

        // Auto-convert salary if base salary exists and currencies are different
        if (formData.baseSalary && formData.currency && formData.currency !== newCurrency) {
          handleCurrencyConversion(Number.parseFloat(formData.baseSalary), formData.currency, newCurrency)
        }
      }
    }
  }, [formData.compareCountry, compareCountryData])

  const handleCurrencyConversion = async (amount: number, sourceCurrency: string, targetCurrency: string) => {
    if (!amount || sourceCurrency === targetCurrency) return

    setIsConverting(true)
    setConversionInfo(null)

    try {
      const result = await convertCurrency(amount, sourceCurrency, targetCurrency)

      if (result.success && result.data) {
        setFormData((prev) => ({
          ...prev,
          compareSalary: result.data!.target_amount.toString(),
        }))
        setConversionInfo(formatConversionDisplay(result.data))
      } else {
        setConversionInfo("Conversion failed - please enter amount manually")
      }
    } catch (error) {
      setConversionInfo("Conversion failed - please enter amount manually")
    } finally {
      setIsConverting(false)
    }
  }

  // USD conversion helper function  
  const convertQuoteToUsd = async (quote: DeelAPIResponse | RemoteAPIResponse, quoteType: "deel" | "compare" | "remote") => {
    if (!quote) return

    const sourceCurrency = quote.currency
    if (sourceCurrency === "USD") return // Already in USD

    // Set appropriate loading state based on quote type
    if (quoteType === "deel") {
      setIsConvertingDeelToUsd(true)
    } else if (quoteType === "compare") {
      setIsConvertingCompareToUsd(true)
    }
    setUsdConversionError(null)

    try {
      if (quoteType === "deel" || quoteType === "compare") {
        const deelQuote = quote as DeelAPIResponse
        
        // Convert the exact values displayed in the UI
        const salaryAmount = Number.parseFloat(deelQuote.salary)
        const feeAmount = Number.parseFloat(deelQuote.deel_fee) 
        const totalAmount = Number.parseFloat(deelQuote.total_costs)

        // Convert main amounts serially
        const salaryResult = await convertCurrency(salaryAmount, sourceCurrency, "USD")
        if (!salaryResult.success) {
          throw new Error("Failed to convert salary")
        }

        const feeResult = await convertCurrency(feeAmount, sourceCurrency, "USD")
        if (!feeResult.success) {
          throw new Error("Failed to convert platform fee")
        }

        const totalResult = await convertCurrency(totalAmount, sourceCurrency, "USD")
        if (!totalResult.success) {
          throw new Error("Failed to convert total costs")
        }

        // Convert cost items serially
        const convertedCosts: number[] = []
        for (const cost of deelQuote.costs) {
          const costAmount = Number.parseFloat(cost.amount)
          const costResult = await convertCurrency(costAmount, sourceCurrency, "USD")
          if (!costResult.success) {
            throw new Error(`Failed to convert ${cost.name}`)
          }
          // Handle negative amounts - use -1 as indicator to show "---"
          convertedCosts.push(costResult.data!.target_amount)
        }

        setUsdConversions(prev => ({
          ...prev,
          [quoteType]: {
            salary: salaryResult.data!.target_amount,
            deelFee: feeResult.data!.target_amount,
            costs: convertedCosts,
            totalCosts: totalResult.data!.target_amount
          }
        }))
      }
    } catch (error) {
      setUsdConversionError("Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      // Clear appropriate loading state based on quote type
      if (quoteType === "deel") {
        setIsConvertingDeelToUsd(false)
      } else if (quoteType === "compare") {
        setIsConvertingCompareToUsd(false)
      }
    }
  }

  // Debounced conversion function
  const debouncedCurrencyConversion = (amount: number, sourceCurrency: string, targetCurrency: string) => {
    // Clear any existing timeout
    if (conversionTimeoutRef.current) {
      clearTimeout(conversionTimeoutRef.current)
    }

    // Set new timeout for debounced conversion
    conversionTimeoutRef.current = setTimeout(() => {
      if (!isNaN(amount) && amount > 0 && sourceCurrency !== targetCurrency) {
        handleCurrencyConversion(amount, sourceCurrency, targetCurrency)
      }
    }, 800) // 800ms delay after user stops typing
  }

  // Debounced conversion when base salary changes
  useEffect(() => {
    if (
      formData.baseSalary &&
      formData.enableComparison &&
      formData.compareCountry &&
      formData.compareCurrency &&
      formData.currency &&
      formData.currency !== formData.compareCurrency &&
      !isComparisonManuallyEdited
    ) {
      const amount = Number.parseFloat(formData.baseSalary)
      debouncedCurrencyConversion(amount, formData.currency, formData.compareCurrency)
    }
  }, [formData.baseSalary])

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

  // Validation helper functions
  const isValidNumericFormat = (value: string): boolean => {
    // Allow empty values
    if (value === "") return true
    
    // Allow valid number formats (including decimals, but not negative for these fields)
    const numericRegex = /^\d*\.?\d*$/
    return numericRegex.test(value)
  }

  const validateFinalNumericInput = (value: string, min?: number, max?: number): boolean => {
    // Always allow empty values for optional fields
    if (value === "") return true
    
    // Check if it's a valid number format first
    if (!isValidNumericFormat(value)) return false
    
    const numValue = Number(value)
    
    // Check if it's a valid number
    if (isNaN(numValue)) return false
    
    // If no min/max constraints, allow any valid number
    if (min === undefined && max === undefined) return true
    
    // Apply constraints only if they exist
    if (min !== undefined && numValue < min) return false
    if (max !== undefined && numValue > max) return false
    
    return true
  }

  const validateSalaryInput = (value: string): boolean => {
    // If no validation data is loaded, allow all input
    if (!validationData?.data?.salary) return true
    
    const min = validationData.data.salary.min ? Number(validationData.data.salary.min) : undefined
    const max = validationData.data.salary.max ? Number(validationData.data.salary.max) : undefined
    return validateFinalNumericInput(value, min, max)
  }

  const validateHolidayInput = (value: string): boolean => {
    // If no validation data is loaded, allow all input
    if (!validationData?.data?.holiday) return true
    
    const min = validationData.data.holiday.min ? Number(validationData.data.holiday.min) : undefined
    const max = validationData.data.holiday.max ? Number(validationData.data.holiday.max) : undefined
    return validateFinalNumericInput(value, min, max)
  }

  const validateProbationInput = (value: string): boolean => {
    // If no validation data is loaded, allow all input
    if (!validationData?.data?.probation) return true
    
    const min = validationData.data.probation.min ? Number(validationData.data.probation.min) : undefined
    const max = validationData.data.probation.max ? Number(validationData.data.probation.max) : undefined
    return validateFinalNumericInput(value, min, max)
  }

  const validateHoursInput = (value: string): boolean => {
    // If no validation data is loaded, allow all input
    if (!validationData?.data?.work_schedule) return true
    
    const min = validationData.data.work_schedule.hours.min ? Number(validationData.data.work_schedule.hours.min) : undefined
    const max = validationData.data.work_schedule.hours.max ? Number(validationData.data.work_schedule.hours.max) : undefined
    return validateFinalNumericInput(value, min, max)
  }

  const validateDaysInput = (value: string): boolean => {
    // If no validation data is loaded, allow all input
    if (!validationData?.data?.work_schedule) return true
    
    const min = validationData.data.work_schedule.days.min ? Number(validationData.data.work_schedule.days.min) : undefined
    const max = validationData.data.work_schedule.days.max ? Number(validationData.data.work_schedule.days.max) : undefined
    return validateFinalNumericInput(value, min, max)
  }

  // Validation functions for onBlur events
  const validateSalaryOnBlur = () => {
    if (!formData.baseSalary) {
      setSalaryError(null)
      return
    }
    
    if (!validateSalaryInput(formData.baseSalary)) {
      const min = validationData?.data?.salary?.min ? Number(validationData.data.salary.min) : undefined
      const max = validationData?.data?.salary?.max ? Number(validationData.data.salary.max) : undefined
      const currency = validationData?.data?.currency || formData.currency
      
      let errorMsg = "Invalid salary amount."
      if (min !== undefined && max !== undefined) {
        errorMsg = `Salary must be between ${currency} ${min.toLocaleString()} and ${currency} ${max.toLocaleString()}`
      } else if (min !== undefined) {
        errorMsg = `Salary must be at least ${currency} ${min.toLocaleString()}`
      } else if (max !== undefined) {
        errorMsg = `Salary must not exceed ${currency} ${max.toLocaleString()}`
      }
      setSalaryError(errorMsg)
    } else {
      setSalaryError(null)
    }
  }

  const validateHolidaysOnBlur = () => {
    if (!formData.holidayDays) {
      setHolidaysError(null)
      return
    }
    
    if (!validateHolidayInput(formData.holidayDays)) {
      const min = validationData?.data?.holiday?.min ? Number(validationData.data.holiday.min) : undefined
      const max = validationData?.data?.holiday?.max ? Number(validationData.data.holiday.max) : undefined
      
      let errorMsg = "Invalid holiday days."
      if (min !== undefined && max !== undefined) {
        errorMsg = `Holiday days must be between ${min} and ${max}`
      } else if (min !== undefined) {
        errorMsg = `Holiday days must be at least ${min}`
      } else if (max !== undefined) {
        errorMsg = `Holiday days must not exceed ${max}`
      }
      setHolidaysError(errorMsg)
    } else {
      setHolidaysError(null)
    }
  }

  const validateProbationOnBlur = () => {
    if (!formData.probationPeriod) {
      setProbationError(null)
      return
    }
    
    if (!validateProbationInput(formData.probationPeriod)) {
      const min = validationData?.data?.probation?.min ? Number(validationData.data.probation.min) : undefined
      const max = validationData?.data?.probation?.max ? Number(validationData.data.probation.max) : undefined
      
      let errorMsg = "Invalid probation period."
      if (min !== undefined && max !== undefined) {
        errorMsg = `Probation period must be between ${min} and ${max} days`
      } else if (min !== undefined) {
        errorMsg = `Probation period must be at least ${min} days`
      } else if (max !== undefined) {
        errorMsg = `Probation period must not exceed ${max} days`
      }
      setProbationError(errorMsg)
    } else {
      setProbationError(null)
    }
  }

  const validateHoursOnBlur = () => {
    if (!formData.hoursPerDay) {
      setHoursError(null)
      return
    }
    
    if (!validateHoursInput(formData.hoursPerDay)) {
      const min = validationData?.data?.work_schedule?.hours?.min ? Number(validationData.data.work_schedule.hours.min) : undefined
      const max = validationData?.data?.work_schedule?.hours?.max ? Number(validationData.data.work_schedule.hours.max) : undefined
      
      let errorMsg = "Invalid hours per day."
      if (min !== undefined && max !== undefined) {
        errorMsg = `Hours per day must be between ${min} and ${max}`
      } else if (min !== undefined) {
        errorMsg = `Hours per day must be at least ${min}`
      } else if (max !== undefined) {
        errorMsg = `Hours per day must not exceed ${max}`
      }
      setHoursError(errorMsg)
    } else {
      setHoursError(null)
    }
  }

  const validateDaysOnBlur = () => {
    if (!formData.daysPerWeek) {
      setDaysError(null)
      return
    }
    
    if (!validateDaysInput(formData.daysPerWeek)) {
      const min = validationData?.data?.work_schedule?.days?.min ? Number(validationData.data.work_schedule.days.min) : undefined
      const max = validationData?.data?.work_schedule?.days?.max ? Number(validationData.data.work_schedule.days.max) : undefined
      
      let errorMsg = "Invalid days per week."
      if (min !== undefined && max !== undefined) {
        errorMsg = `Days per week must be between ${min} and ${max}`
      } else if (min !== undefined) {
        errorMsg = `Days per week must be at least ${min}`
      } else if (max !== undefined) {
        errorMsg = `Days per week must not exceed ${max}`
      }
      setDaysError(errorMsg)
    } else {
      setDaysError(null)
    }
  }

  // Fetch validation data when country changes
  const fetchValidationData = async (countryCode: string) => {
    setIsLoadingValidations(true)
    setValidationError(null)
    setValidationData(null)

    try {
      const response = await fetch(`/api/eor-validations/${countryCode}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Validation API error: ${errorData.error || "Failed to fetch validation data"}`)
      }

      const data: ValidationAPIResponse = await response.json()
      setValidationData(data)
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to fetch validation data")
    } finally {
      setIsLoadingValidations(false)
    }
  }

  // Fetch validation data when country is selected
  useEffect(() => {
    if (formData.country && selectedCountryData) {
      const countryCode = selectedCountryData.code
      if (countryCode) {
        fetchValidationData(countryCode)
      }
    } else {
      // Clear validation data when no country is selected
      setValidationData(null)
      setValidationError(null)
    }
    
    // Clear validation errors when country changes (rules may have changed)
    setSalaryError(null)
    setHolidaysError(null)
    setProbationError(null)
    setHoursError(null)
    setDaysError(null)
  }, [formData.country, selectedCountryData])

  const clearAllData = () => {
    // Reset form data to initial state
    setFormData({
      employeeName: "",
      jobTitle: "",
      workVisaRequired: false,
      country: "",
      state: "",
      currency: "",
      clientCountry: "",
      clientCurrency: "",
      baseSalary: "",
      holidayDays: "",
      probationPeriod: "",
      hoursPerDay: "",
      daysPerWeek: "",
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

    // Clear all quotes
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)
    setValidationData(null)
    setError(null)
    setValidationError(null)
    setUsdConversionError(null)
    setUsdConversions({})
    
    // Clear validation errors
    setSalaryError(null)
    setHolidaysError(null)
    setProbationError(null)
    setHoursError(null)
    setDaysError(null)

  }

  const calculateQuote = async () => {
    // Perform form-level validation before submission
    let hasValidationErrors = false
    
    // Validate all fields and set error states
    if (formData.baseSalary && !validateSalaryInput(formData.baseSalary)) {
      validateSalaryOnBlur()
      hasValidationErrors = true
    }
    
    if (formData.holidayDays && !validateHolidayInput(formData.holidayDays)) {
      validateHolidaysOnBlur()
      hasValidationErrors = true
    }
    
    if (formData.probationPeriod && !validateProbationInput(formData.probationPeriod)) {
      validateProbationOnBlur()
      hasValidationErrors = true
    }
    
    if (formData.hoursPerDay && !validateHoursInput(formData.hoursPerDay)) {
      validateHoursOnBlur()
      hasValidationErrors = true
    }
    
    if (formData.daysPerWeek && !validateDaysInput(formData.daysPerWeek)) {
      validateDaysOnBlur()
      hasValidationErrors = true
    }
    
    // If there are validation errors, don't proceed
    if (hasValidationErrors) {
      setError("Please fix the validation errors before submitting.")
      return
    }

    setIsCalculating(true)
    setError(null)
    setUsdConversionError(null)
    setUsdConversions({}) // Clear previous USD conversions
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
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                EOR Quote Calculator
              </h1>
              {/* <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Get accurate EOR cost estimates starting with Deel's comprehensive data
              </p> */}
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
                    <h3 className="text-lg font-semibold text-slate-900">Client Information</h3>
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
                  
                  {/* Employee Name and Job Title */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
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

                  {/* Work Visa Required */}
                  <div className="mb-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="workVisaRequired"
                        checked={formData.workVisaRequired}
                        onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, workVisaRequired: checked as boolean }))}
                      />
                      <Label htmlFor="workVisaRequired" className="text-sm font-medium text-slate-700">
                        Work Visa Required?
                      </Label>
                    </div>
                  </div>

                  {/* Location & Currency */}
                  <div className="mb-6">
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

                  {/* Validation Loading/Error States */}
                  {isLoadingValidations && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                      <span className="text-slate-600">Loading country validation data...</span>
                    </div>
                  )}

                  {validationError && (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="text-yellow-800 font-medium">Validation data unavailable</h5>
                          <p className="text-yellow-700 text-sm mt-1">{validationError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Salary Limits (Read-only) */}
                  {validationData && !isLoadingValidations && (
                    <div className="mb-6">
                      <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">
                        Salary Limits ({validationData.data.currency})
                      </h5>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Minimum</Label>
                          <Input
                            value={validationData.data.salary.min ? 
                              `${validationData.data.currency} ${Number(validationData.data.salary.min).toLocaleString()}` : 
                              "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Maximum</Label>
                          <Input
                            value={validationData.data.salary.max ? 
                              `${validationData.data.currency} ${Number(validationData.data.salary.max).toLocaleString()}` : 
                              "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Frequency</Label>
                          <Input
                            value={validationData.data.salary.frequency || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Annual Base Salary + Employment Type */}
                  <div className="mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                      <div className="space-y-2">
                        <Label
                          htmlFor="baseSalary"
                          className="text-sm font-semibold text-slate-700 uppercase tracking-wide block"
                        >
                          Annual Base Salary ({formData.currency})
                        </Label>
                        <Input
                          ref={baseSalaryInputRef}
                          id="baseSalary"
                          type="text"
                          placeholder={`Enter annual salary amount in ${formData.currency}`}
                          value={formData.baseSalary}
                          onChange={(e) => {
                            const value = e.target.value
                            // Allow only valid numeric input (digits and decimal point)
                            if (isValidNumericFormat(value)) {
                              setFormData((prev) => ({ ...prev, baseSalary: value }))
                              setSalaryError(null) // Clear error while typing
                            }
                          }}
                          onBlur={validateSalaryOnBlur}
                          className={`h-11 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                            salaryError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                          }`}
                        />
                        {salaryError && (
                          <p className="text-red-500 text-xs mt-1">{salaryError}</p>
                        )}
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

                  {/* Holiday Information */}
                  {validationData && !isLoadingValidations && (
                    <div className="mb-6">
                      <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">Holiday Days</h5>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Minimum</Label>
                          <Input
                            value={validationData.data.holiday.min || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Maximum</Label>
                          <Input
                            value={validationData.data.holiday.max || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Most Common</Label>
                          <Input
                            value={validationData.data.holiday.mostCommon || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="holidayDays"
                            className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                          >
                            Holiday Days
                          </Label>
                          <Input
                            id="holidayDays"
                            type="text"
                            placeholder={validationData.data.holiday.mostCommon || "Enter number of holidays"}
                            value={formData.holidayDays}
                            onChange={(e) => {
                              const value = e.target.value
                              // Allow only valid numeric input (digits and decimal point)
                              if (isValidNumericFormat(value)) {
                                setFormData((prev) => ({ ...prev, holidayDays: value }))
                                setHolidaysError(null) // Clear error while typing
                              }
                            }}
                            onBlur={validateHolidaysOnBlur}
                            className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                              holidaysError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                            }`}
                          />
                          {holidaysError && (
                            <p className="text-red-500 text-xs mt-1">{holidaysError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Probation Period */}
                  {validationData && !isLoadingValidations && (validationData.data.probation.min || validationData.data.probation.max) && (
                    <div className="mb-6">
                      <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">Probation Period</h5>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Minimum</Label>
                          <Input
                            value={validationData.data.probation.min || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Maximum</Label>
                          <Input
                            value={validationData.data.probation.max || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="probationPeriod"
                            className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                          >
                            Probation Period
                          </Label>
                          <Input
                            id="probationPeriod"
                            type="text"
                            placeholder="Enter probation period in days"
                            value={formData.probationPeriod}
                            onChange={(e) => {
                              const value = e.target.value
                              // Allow only valid numeric input (digits and decimal point)
                              if (isValidNumericFormat(value)) {
                                setFormData((prev) => ({ ...prev, probationPeriod: value }))
                                setProbationError(null) // Clear error while typing
                              }
                            }}
                            onBlur={validateProbationOnBlur}
                            className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                              probationError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                            }`}
                          />
                          {probationError && (
                            <p className="text-red-500 text-xs mt-1">{probationError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Work Schedule */}
                  {validationData && !isLoadingValidations && (
                    <div>
                      <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">Work Schedule</h5>
                      <div className="grid md:grid-cols-6 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Min Hours/Day</Label>
                          <Input
                            value={validationData.data.work_schedule.hours.min || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Max Hours/Day</Label>
                          <Input
                            value={validationData.data.work_schedule.hours.max || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="hoursPerDay"
                            className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                          >
                            Hours per Day
                          </Label>
                          <Input
                            id="hoursPerDay"
                            type="text"
                            placeholder="Enter hours per day"
                            value={formData.hoursPerDay}
                            onChange={(e) => {
                              const value = e.target.value
                              // Allow only valid numeric input (digits and decimal point)
                              if (isValidNumericFormat(value)) {
                                setFormData((prev) => ({ ...prev, hoursPerDay: value }))
                                setHoursError(null) // Clear error while typing
                              }
                            }}
                            onBlur={validateHoursOnBlur}
                            className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                              hoursError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                            }`}
                          />
                          {hoursError && (
                            <p className="text-red-500 text-xs mt-1">{hoursError}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Min Days/Week</Label>
                          <Input
                            value={validationData.data.work_schedule.days.min || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Max Days/Week</Label>
                          <Input
                            value={validationData.data.work_schedule.days.max || "Not specified"}
                            disabled
                            className="h-10 bg-slate-50 border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="daysPerWeek"
                            className="text-sm font-semibold text-slate-700 uppercase tracking-wide"
                          >
                            Days per Week
                          </Label>
                          <Input
                            id="daysPerWeek"
                            type="text"
                            placeholder="Enter days per week"
                            value={formData.daysPerWeek}
                            onChange={(e) => {
                              const value = e.target.value
                              // Allow only valid numeric input (digits and decimal point)
                              if (isValidNumericFormat(value)) {
                                setFormData((prev) => ({ ...prev, daysPerWeek: value }))
                                setDaysError(null) // Clear error while typing
                              }
                            }}
                            onBlur={validateDaysOnBlur}
                            className={`h-10 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
                              daysError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                            }`}
                          />
                          {daysError && (
                            <p className="text-red-500 text-xs mt-1">{daysError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            enableComparison: checked as boolean,
                            compareCountry: "",
                            compareState: "",
                            compareCurrency: "",
                            compareSalary: "",
                          }))
                          // Clear conversion info when disabling comparison
                          setConversionInfo(null)
                          // Reset manual edit flag when disabling comparison
                          setIsComparisonManuallyEdited(false)
                        }}
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
                              Annual Base Salary ({formData.compareCurrency})
                            </Label>
                            <div className="relative">
                              <Input
                                id="compareSalary"
                                type="number"
                                placeholder={`Enter annual salary amount in ${formData.compareCurrency}`}
                                value={formData.compareSalary}
                                onChange={(e) => {
                                  setFormData((prev) => ({ ...prev, compareSalary: e.target.value }))
                                  // Mark as manually edited and clear conversion info
                                  setIsComparisonManuallyEdited(true)
                                  setConversionInfo(null)
                                }}
                                className="h-11 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                                disabled={isConverting}
                              />
                              {isConverting && (
                                <div className="absolute right-3 top-3">
                                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                              )}
                            </div>
                            {conversionInfo && (
                              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border">
                                ℹ️ {conversionInfo}
                              </p>
                            )}
                            {formData.baseSalary &&
                              formData.currency &&
                              formData.compareCurrency &&
                              formData.currency !== formData.compareCurrency &&
                              !conversionInfo &&
                              !formData.compareSalary &&
                              !isConverting && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const amount = Number.parseFloat(formData.baseSalary)
                                    if (!isNaN(amount) && amount > 0) {
                                      setIsComparisonManuallyEdited(false) // Reset manual edit flag
                                      handleCurrencyConversion(amount, formData.currency, formData.compareCurrency)
                                    }
                                  }}
                                  className="text-xs h-8"
                                >
                                  Convert from {formData.currency}
                                </Button>
                              )}
                            {formData.baseSalary &&
                              formData.currency &&
                              formData.compareCurrency &&
                              formData.currency !== formData.compareCurrency &&
                              !conversionInfo &&
                              formData.compareSalary &&
                              !isConverting && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const amount = Number.parseFloat(formData.baseSalary)
                                    if (!isNaN(amount) && amount > 0) {
                                      setIsComparisonManuallyEdited(false) // Reset manual edit flag
                                      handleCurrencyConversion(amount, formData.currency, formData.compareCurrency)
                                    }
                                  }}
                                  className="text-xs h-8 text-slate-500"
                                >
                                  Re-convert from {formData.currency}
                                </Button>
                              )}
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

                {usdConversionError && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-yellow-800 font-medium">USD conversion warning</h4>
                      <p className="text-yellow-700 text-sm mt-1">{usdConversionError}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 pt-4">
                  <div className="hidden sm:block"></div>
                  <Button
                    onClick={calculateQuote}
                    disabled={isCalculating || !formData.country || !formData.baseSalary || !formData.clientCountry}
                    className="w-full sm:w-auto h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 cursor-pointer"
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
                  <Button
                    onClick={clearAllData}
                    variant="outline"
                    className="w-full sm:w-auto h-12 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl transition-all duration-200 px-8 bg-transparent cursor-pointer"
                  >
                    <RotateCcw className="mr-2 h-5 w-5" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quote Results Section */}
          <div className="space-y-6" ref={quoteRef}>
            {/* Primary Deel Quote - show when not comparing OR when comparing but no comparison quote yet */}
            {formData.currentStep === "primary-quote" && deelQuote && (!formData.enableComparison || (formData.enableComparison && !compareQuote)) && (
              <>
                {/* <div className="text-center space-y-3">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Primary Quote - Deel
                  </h2>
                  <p className="text-lg text-slate-600">Your comprehensive EOR cost breakdown from Deel</p>
                </div> */}

                <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="text-center flex-1">
                        <h3 className="text-xl font-bold text-slate-900">Deel Quote - {deelQuote.country}</h3>
                        <p className="text-sm text-slate-600">Reliable EOR provider with comprehensive legal coverage</p>
                      </div>
                      {deelQuote.currency !== "USD" && (
                        <Button
                          onClick={() => convertQuoteToUsd(deelQuote, "deel")}
                          disabled={isConvertingDeelToUsd}
                          variant="outline"
                          size="sm"
                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 ml-4"
                        >
                          {isConvertingDeelToUsd ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Converting...
                            </>
                          ) : (
                            <>
                              <DollarSign className="mr-2 h-3 w-3" />
                              USD prices
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Header row for columns */}
                      {deelQuote.currency !== "USD" && usdConversions.deel && (
                        <div className="grid grid-cols-3 gap-4 py-2 px-4 bg-slate-100 border-b border-slate-200">
                          <span className="text-slate-700 font-semibold text-sm">Cost Item</span>
                          <span className="text-slate-700 font-semibold text-sm text-right">Local Currency</span>
                          <span className="text-slate-700 font-semibold text-sm text-right">USD Equivalent</span>
                        </div>
                      )}
                      
                      {/* Base Salary */}
                      <div className={`py-3 px-4 bg-slate-50 ${deelQuote.currency !== "USD" && usdConversions.deel ? "grid grid-cols-3 gap-4 items-center" : "flex justify-between items-center"}`}>
                        <span className="text-slate-600 font-medium">Base Salary</span>
                        <span className="font-bold text-lg text-slate-900 text-right">
                          {deelQuote.currency} {Number.parseFloat(deelQuote.salary).toLocaleString()}
                        </span>
                        {deelQuote.currency !== "USD" && usdConversions.deel && (
                          <span className="font-bold text-lg text-slate-700 text-right">
                            ${usdConversions.deel.salary.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Platform Fee */}
                      <div className={`py-3 px-4 bg-slate-50 ${deelQuote.currency !== "USD" && usdConversions.deel ? "grid grid-cols-3 gap-4 items-center" : "flex justify-between items-center"}`}>
                        <span className="text-slate-600 font-medium">Platform Fee</span>
                        <span className="font-bold text-lg text-slate-900 text-right">
                          {deelQuote.currency} {Number.parseFloat(deelQuote.deel_fee).toLocaleString()}
                        </span>
                        {deelQuote.currency !== "USD" && usdConversions.deel && (
                          <span className="font-bold text-lg text-slate-700 text-right">
                            ${usdConversions.deel.deelFee.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Cost items */}
                      {deelQuote.costs.map((cost, index) => (
                        <div key={index} className={`py-3 px-4 bg-slate-50 ${deelQuote.currency !== "USD" && usdConversions.deel ? "grid grid-cols-3 gap-4 items-center" : "flex justify-between items-center"}`}>
                          <span className="text-slate-600 font-medium">{cost.name}</span>
                          <span className="font-bold text-lg text-slate-900 text-right">
                            {deelQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                          </span>
                          {deelQuote.currency !== "USD" && usdConversions.deel && usdConversions.deel.costs[index] !== undefined && (
                            <span className="font-bold text-lg text-slate-700 text-right">
                              {usdConversions.deel.costs[index] === -1 ? "---" : `$${usdConversions.deel.costs[index].toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      ))}

                      <Separator className="my-4" />

                      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
                        {deelQuote.currency !== "USD" && usdConversions.deel ? (
                          <div className="grid grid-cols-3 gap-4 items-center">
                            <span className="text-lg font-bold text-slate-900">Total Monthly Cost</span>
                            <span className="text-primary text-2xl font-bold text-right">
                              {deelQuote.currency} {Number.parseFloat(deelQuote.total_costs).toLocaleString()}
                            </span>
                            <span className="text-slate-700 text-xl font-semibold text-right">
                              ${usdConversions.deel.totalCosts.toLocaleString()} USD
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-900">Total Monthly Cost</span>
                            <span className="text-primary text-2xl font-bold">
                              {deelQuote.currency} {Number.parseFloat(deelQuote.total_costs).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {isConvertingDeelToUsd && (
                          <div className="text-slate-500 text-sm mt-2 flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Converting to USD...
                          </div>
                        )}
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
                      <div className="flex justify-between items-start mb-6">
                        <div className="text-center flex-1">
                          <h3 className="text-xl font-bold text-slate-900">{deelQuote.country}</h3>
                          <p className="text-sm text-slate-600">Primary Location</p>
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full mt-2">
                            Main Quote
                          </span>
                        </div>
                        {deelQuote.currency !== "USD" && (
                          <Button
                            onClick={() => convertQuoteToUsd(deelQuote, "deel")}
                            disabled={isConvertingDeelToUsd}
                            variant="outline"
                            size="sm"
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 ml-4"
                          >
                            {isConvertingDeelToUsd ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Converting...
                              </>
                            ) : (
                              <>
                                <DollarSign className="mr-2 h-3 w-3" />
                                USD prices
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* Header row for columns - main quote */}
                        {deelQuote.currency !== "USD" && usdConversions.deel && (
                          <div className="grid grid-cols-3 gap-2 py-1 px-2 bg-slate-100 border-b border-slate-200">
                            <span className="text-slate-700 font-semibold text-xs">Cost Item</span>
                            <span className="text-slate-700 font-semibold text-xs text-right">Local</span>
                            <span className="text-slate-700 font-semibold text-xs text-right">USD</span>
                          </div>
                        )}
                        
                        {/* Base Salary */}
                        <div className={`py-2 px-2 bg-slate-50 ${deelQuote.currency !== "USD" && usdConversions.deel ? "grid grid-cols-3 gap-2 items-center" : "flex justify-between items-center"}`}>
                          <span className="text-slate-600 font-medium text-sm">Base Salary</span>
                          <span className="font-bold text-sm text-slate-900 text-right">
                            {deelQuote.currency} {Number.parseFloat(deelQuote.salary).toLocaleString()}
                          </span>
                          {deelQuote.currency !== "USD" && usdConversions.deel && (
                            <span className="font-bold text-sm text-slate-700 text-right">
                              ${usdConversions.deel.salary.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Platform Fee */}
                        <div className={`py-2 px-2 bg-slate-50 ${deelQuote.currency !== "USD" && usdConversions.deel ? "grid grid-cols-3 gap-2 items-center" : "flex justify-between items-center"}`}>
                          <span className="text-slate-600 font-medium text-sm">Platform Fee</span>
                          <span className="font-bold text-sm text-slate-900 text-right">
                            {deelQuote.currency} {Number.parseFloat(deelQuote.deel_fee).toLocaleString()}
                          </span>
                          {deelQuote.currency !== "USD" && usdConversions.deel && (
                            <span className="font-bold text-sm text-slate-700 text-right">
                              ${usdConversions.deel.deelFee.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Cost items */}
                        {deelQuote.costs.map((cost, index) => (
                          <div key={index} className={`py-2 px-2 bg-slate-50 ${deelQuote.currency !== "USD" && usdConversions.deel ? "grid grid-cols-3 gap-2 items-center" : "flex justify-between items-center"}`}>
                            <span className="text-slate-600 font-medium text-sm">{cost.name}</span>
                            <span className="font-bold text-sm text-slate-900 text-right">
                              {deelQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                            </span>
                            {deelQuote.currency !== "USD" && usdConversions.deel && usdConversions.deel.costs[index] !== undefined && (
                              <span className="font-bold text-sm text-slate-700 text-right">
                                {usdConversions.deel.costs[index] === -1 ? "---" : `$${usdConversions.deel.costs[index].toLocaleString()}`}
                              </span>
                            )}
                          </div>
                        ))}

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
                          {deelQuote.currency !== "USD" && usdConversions.deel ? (
                            <div className="grid grid-cols-3 gap-2 items-center">
                              <span className="text-sm font-bold text-slate-900">Total Monthly Cost</span>
                              <span className="text-primary text-lg font-bold text-right">
                                {deelQuote.currency} {Number.parseFloat(deelQuote.total_costs).toLocaleString()}
                              </span>
                              <span className="text-slate-700 text-sm font-semibold text-right">
                                ${usdConversions.deel.totalCosts.toLocaleString()} USD
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-900">Total Monthly Cost</span>
                              <span className="text-primary text-lg font-bold">
                                {deelQuote.currency} {Number.parseFloat(deelQuote.total_costs).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Comparison Country Quote */}
                  <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div className="text-center flex-1">
                          <h3 className="text-xl font-bold text-slate-900">{compareQuote.country}</h3>
                          <p className="text-sm text-slate-600">Comparison Location</p>
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mt-2">
                            Compare Quote
                          </span>
                        </div>
                        {compareQuote.currency !== "USD" && (
                          <Button
                            onClick={() => convertQuoteToUsd(compareQuote, "compare")}
                            disabled={isConvertingCompareToUsd}
                            variant="outline"
                            size="sm"
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 ml-4"
                          >
                            {isConvertingCompareToUsd ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Converting...
                              </>
                            ) : (
                              <>
                                <DollarSign className="mr-2 h-3 w-3" />
                                USD prices
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* Header row for columns - compare quote */}
                        {compareQuote.currency !== "USD" && usdConversions.compare && (
                          <div className="grid grid-cols-3 gap-2 py-1 px-2 bg-slate-100 border-b border-slate-200">
                            <span className="text-slate-700 font-semibold text-xs">Cost Item</span>
                            <span className="text-slate-700 font-semibold text-xs text-right">Local</span>
                            <span className="text-slate-700 font-semibold text-xs text-right">USD</span>
                          </div>
                        )}
                        
                        {/* Base Salary */}
                        <div className={`py-2 px-2 bg-slate-50 ${compareQuote.currency !== "USD" && usdConversions.compare ? "grid grid-cols-3 gap-2 items-center" : "flex justify-between items-center"}`}>
                          <span className="text-slate-600 font-medium text-sm">Base Salary</span>
                          <span className="font-bold text-sm text-slate-900 text-right">
                            {compareQuote.currency} {Number.parseFloat(compareQuote.salary).toLocaleString()}
                          </span>
                          {compareQuote.currency !== "USD" && usdConversions.compare && (
                            <span className="font-bold text-sm text-slate-700 text-right">
                              ${usdConversions.compare.salary.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Platform Fee */}
                        <div className={`py-2 px-2 bg-slate-50 ${compareQuote.currency !== "USD" && usdConversions.compare ? "grid grid-cols-3 gap-2 items-center" : "flex justify-between items-center"}`}>
                          <span className="text-slate-600 font-medium text-sm">Platform Fee</span>
                          <span className="font-bold text-sm text-slate-900 text-right">
                            {compareQuote.currency} {Number.parseFloat(compareQuote.deel_fee).toLocaleString()}
                          </span>
                          {compareQuote.currency !== "USD" && usdConversions.compare && (
                            <span className="font-bold text-sm text-slate-700 text-right">
                              ${usdConversions.compare.deelFee.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Cost items */}
                        {compareQuote.costs.map((cost, index) => (
                          <div key={index} className={`py-2 px-2 bg-slate-50 ${compareQuote.currency !== "USD" && usdConversions.compare ? "grid grid-cols-3 gap-2 items-center" : "flex justify-between items-center"}`}>
                            <span className="text-slate-600 font-medium text-sm">{cost.name}</span>
                            <span className="font-bold text-sm text-slate-900 text-right">
                              {compareQuote.currency} {Number.parseFloat(cost.amount).toLocaleString()}
                            </span>
                            {compareQuote.currency !== "USD" && usdConversions.compare && usdConversions.compare.costs[index] !== undefined && (
                              <span className="font-bold text-sm text-slate-700 text-right">
                                {usdConversions.compare.costs[index] === -1 ? "---" : `$${usdConversions.compare.costs[index].toLocaleString()}`}
                              </span>
                            )}
                          </div>
                        ))}

                        <Separator className="my-4" />

                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-2 border-primary/20">
                          {compareQuote.currency !== "USD" && usdConversions.compare ? (
                            <div className="grid grid-cols-3 gap-2 items-center">
                              <span className="text-sm font-bold text-slate-900">Total Monthly Cost</span>
                              <span className="text-primary text-lg font-bold text-right">
                                {compareQuote.currency} {Number.parseFloat(compareQuote.total_costs).toLocaleString()}
                              </span>
                              <span className="text-slate-700 text-sm font-semibold text-right">
                                ${usdConversions.compare.totalCosts.toLocaleString()} USD
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-900">Total Monthly Cost</span>
                              <span className="text-primary text-lg font-bold">
                                {compareQuote.currency} {Number.parseFloat(compareQuote.total_costs).toLocaleString()}
                              </span>
                            </div>
                          )}
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
