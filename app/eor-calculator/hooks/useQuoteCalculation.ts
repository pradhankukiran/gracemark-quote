import { useState } from "react"
import { DeelAPIResponse, RemoteAPIResponse, EORFormData, ValidationAPIResponse, DualCurrencyQuotes, ValidationErrors } from "../types"
import { fetchEORCost, createQuoteRequestData } from "../utils/apiUtils"
import { convertCurrency } from "@/lib/currency-converter"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"
import {
  validateSalaryInput,
  validateHolidayInput, 
  validateProbationInput,
  validateHoursInput,
  validateDaysInput
} from "../utils/validationUtils"

interface UseQuoteCalculationProps {
  formData: EORFormData
  validationData: ValidationAPIResponse | null
  convertedValidation: {
    minSalary?: string
    maxSalary?: string
    currency?: string
  }
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const useQuoteCalculation = ({ 
  formData, 
  validationData, 
  convertedValidation,
  onValidationError,
  onFormUpdate 
}: UseQuoteCalculationProps) => {
  const [deelQuote, setDeelQuote] = useState<DeelAPIResponse | null>(null)
  const [remoteQuote, setRemoteQuote] = useState<RemoteAPIResponse | null>(null)
  const [compareQuote, setCompareQuote] = useState<DeelAPIResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Dual currency state
  const [dualCurrencyQuotes, setDualCurrencyQuotes] = useState<DualCurrencyQuotes>({
    selectedCurrencyQuote: null,
    localCurrencyQuote: null,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    isCalculatingSelected: false,
    isCalculatingLocal: false,
    isCalculatingCompareSelected: false,
    isCalculatingCompareLocal: false,
    isDualCurrencyMode: false,
    hasComparison: false
  })

  // Get effective validation data (original or converted)
  const getEffectiveValidationData = (): ValidationAPIResponse | null => {
    if (!validationData || !formData.isCurrencyManuallySet || !convertedValidation.currency) {
      return validationData
    }

    if (convertedValidation.currency !== formData.currency) {
      return validationData
    }

    // Create a deep copy to avoid mutating the original validationData state
    const newValidationData = JSON.parse(JSON.stringify(validationData))
    
    if (convertedValidation.minSalary) {
      newValidationData.data.salary.min = convertedValidation.minSalary.replace(/[\,\s]/g, '')
    }
    if (convertedValidation.maxSalary) {
      newValidationData.data.salary.max = convertedValidation.maxSalary.replace(/[\,\s]/g, '')
    }
    
    return newValidationData
  }

  const validateAllFields = (): boolean => {
    let hasValidationErrors = false
    
    // Use effective validation data (original or converted)
    const effectiveValidationData = getEffectiveValidationData()
    
    if (formData.baseSalary && !validateSalaryInput(formData.baseSalary, effectiveValidationData)) {
      onValidationError('salary', 'Invalid salary amount')
      hasValidationErrors = true
    }
    
    if (formData.holidayDays && !validateHolidayInput(formData.holidayDays, effectiveValidationData)) {
      onValidationError('holidays', 'Invalid holiday days')
      hasValidationErrors = true
    }
    
    if (formData.probationPeriod && !validateProbationInput(formData.probationPeriod, effectiveValidationData)) {
      onValidationError('probation', 'Invalid probation period')
      hasValidationErrors = true
    }
    
    if (formData.hoursPerDay && !validateHoursInput(formData.hoursPerDay, effectiveValidationData)) {
      onValidationError('hours', 'Invalid hours per day')
      hasValidationErrors = true
    }
    
    if (formData.daysPerWeek && !validateDaysInput(formData.daysPerWeek, effectiveValidationData)) {
      onValidationError('days', 'Invalid days per week')
      hasValidationErrors = true
    }
    
    return !hasValidationErrors
  }

  const calculateQuote = async () => {
    if (!validateAllFields()) {
      setError("Please fix the validation errors before submitting.")
      return
    }

    const isDualCurrencyMode = formData.isCurrencyManuallySet && formData.originalCurrency && formData.originalCurrency !== formData.currency

    if (isDualCurrencyMode) {
      // Dual currency mode: make 2 or 4 API calls depending on comparison
      const hasComparison = formData.enableComparison && formData.compareCountry
      
      setDualCurrencyQuotes(prev => ({
        ...prev,
        isDualCurrencyMode: true,
        hasComparison: !!hasComparison,
        isCalculatingSelected: true,
        isCalculatingLocal: true,
        isCalculatingCompareSelected: !!hasComparison,
        isCalculatingCompareLocal: !!hasComparison,
        selectedCurrencyQuote: null,
        localCurrencyQuote: null,
        compareSelectedCurrencyQuote: null,
        compareLocalCurrencyQuote: null
      }))
      setError(null)

      try {
        // Convert salary amount for local currency quotes
        const salaryAmount = parseFloat(formData.baseSalary.replace(/[,\s]/g, ''))
        const conversionResult = await convertCurrency(salaryAmount, formData.currency, formData.originalCurrency!)
        
        if (!conversionResult.success) {
          throw new Error("Failed to convert salary to local currency")
        }

        const convertedSalaryAmount = conversionResult.data!.target_amount.toString()

        // Prepare all quote requests
        const selectedCurrencyRequestData = createQuoteRequestData(formData)
        const localCurrencyRequestData = {
          ...selectedCurrencyRequestData,
          salary: convertedSalaryAmount,
          currency: formData.originalCurrency!
        }

        let apiCalls = [
          fetchEORCost(selectedCurrencyRequestData),
          fetchEORCost(localCurrencyRequestData)
        ]

        // Add comparison quotes if enabled
        if (hasComparison) {
          const compareCountryData = getCountryByName(formData.compareCountry!)
          const compareLocalCurrency = getCurrencyForCountry(compareCountryData!.code)
          const selectedCurrency = formData.currency

          const compareSalaryInLocal = parseFloat(formData.compareSalary?.replace(/[,\s]/g, '') || '0')

          // 1. Prepare the request for the LOCAL quote (e.g., ARS)
          const compareLocalCurrencyRequestData: QuoteRequestData = {
            salary: compareSalaryInLocal.toString(),
            country: formData.compareCountry!,
            currency: compareLocalCurrency,
            clientCountry: formData.clientCountry,
            age: 30,
            state: formData.compareState,
          }

          // 2. Convert local salary to the SELECTED currency (e.g., ARS -> EUR)
          const conversionResult = await convertCurrency(compareSalaryInLocal, compareLocalCurrency, selectedCurrency)
          if (!conversionResult.success || !conversionResult.data) {
            throw new Error(`Failed to convert comparison salary from ${compareLocalCurrency} to ${selectedCurrency}`)
          }
          const compareSalaryInSelected = conversionResult.data.target_amount

          // 3. Prepare the request for the SELECTED quote (e.g., EUR)
          const compareSelectedCurrencyRequestData: QuoteRequestData = {
            salary: compareSalaryInSelected.toString(),
            country: formData.compareCountry!,
            currency: selectedCurrency,
            clientCountry: formData.clientCountry,
            age: 30,
            state: formData.compareState,
          }

          apiCalls.push(
            fetchEORCost(compareSelectedCurrencyRequestData), // Selected (EUR)
            fetchEORCost(compareLocalCurrencyRequestData)   // Local (ARS)
          )
        }

        // Execute all API calls in parallel
        const results = await Promise.all(apiCalls)
        const [selectedCurrencyData, localCurrencyData, compareSelectedData, compareLocalData] = results

        setDualCurrencyQuotes(prev => ({
          ...prev,
          selectedCurrencyQuote: selectedCurrencyData,
          localCurrencyQuote: localCurrencyData,
          compareSelectedCurrencyQuote: compareSelectedData || null,
          compareLocalCurrencyQuote: compareLocalData || null,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false
        }))

        onFormUpdate({ currentStep: "primary-quote" })

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to calculate dual currency quotes")
        setDualCurrencyQuotes(prev => ({
          ...prev,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false
        }))
      }
    } else {
      // Single currency mode (existing behavior)
      setIsCalculating(true)
      setError(null)
      setDeelQuote(null)
      setRemoteQuote(null)
      setCompareQuote(null)
      setDualCurrencyQuotes(prev => ({
        ...prev,
        isDualCurrencyMode: false,
        hasComparison: false,
        selectedCurrencyQuote: null,
        localCurrencyQuote: null,
        compareSelectedCurrencyQuote: null,
        compareLocalCurrencyQuote: null
      }))

      try {
        // Fetch primary quote
        const baseRequestData = createQuoteRequestData(formData)
        const deelData = await fetchEORCost(baseRequestData)
        setDeelQuote(deelData)

        onFormUpdate({ currentStep: "primary-quote" })

        // Handle comparison quote if enabled
        if (formData.enableComparison && formData.compareCountry) {
          try {
            const compareRequestData = createQuoteRequestData(formData, true)
            const compareData = await fetchEORCost(compareRequestData)
            setCompareQuote(compareData)
          } catch (compareError) {
            console.error("Failed to fetch comparison quote:", compareError)
            // Don't fail the entire operation if comparison fails
          }
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to calculate quote")
      } finally {
        setIsCalculating(false)
      }
    }
  }

  const clearQuotes = () => {
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)
    setError(null)
    setDualCurrencyQuotes({
      selectedCurrencyQuote: null,
      localCurrencyQuote: null,
      compareSelectedCurrencyQuote: null,
      compareLocalCurrencyQuote: null,
      isCalculatingSelected: false,
      isCalculatingLocal: false,
      isCalculatingCompareSelected: false,
      isCalculatingCompareLocal: false,
      isDualCurrencyMode: false,
      hasComparison: false
    })
  }

  return {
    deelQuote,
    remoteQuote,
    compareQuote,
    isCalculating,
    error,
    calculateQuote,
    clearQuotes,
    dualCurrencyQuotes,
  }
}
