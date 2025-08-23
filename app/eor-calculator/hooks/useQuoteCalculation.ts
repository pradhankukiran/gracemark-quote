import { useState } from "react"
import { EORFormData, ValidationAPIResponse, ValidationErrors, QuoteData } from "@/lib/shared/types"
import {
  validateSalaryInput,
  validateHolidayInput, 
  validateProbationInput,
  validateHoursInput,
  validateDaysInput
} from "@/lib/shared/utils/validationUtils"
import { setJsonInSessionStorage } from "@/lib/shared/utils/storageUtils"

interface UseQuoteCalculationProps {
  formData: EORFormData
  currency: string
  clientCurrency: string
  compareCurrency: string
  validationData: ValidationAPIResponse | null
  convertedValidation: {
    minSalary?: string
    maxSalary?: string
    currency?: string
  }
  onValidationError: (field: keyof ValidationErrors, error: string | null) => void
}

export const useQuoteCalculation = ({ 
  formData, 
  currency,
  clientCurrency,
  compareCurrency,
  validationData, 
  convertedValidation,
  onValidationError
}: UseQuoteCalculationProps) => {
  const [error, setError] = useState<string | null>(null)

  // Get effective validation data (original or converted)
  const getEffectiveValidationData = (): ValidationAPIResponse | null => {
    if (!validationData || !formData.isCurrencyManuallySet || !convertedValidation.currency) {
      return validationData
    }

    if (convertedValidation.currency !== currency) {
      return validationData
    }

    // Efficiently create a copy with only modified salary values (no expensive deep copying)
    const newValidationData: ValidationAPIResponse = {
      ...validationData,
      data: {
        ...validationData.data,
        salary: {
          ...validationData.data.salary,
          min: convertedValidation.minSalary ? convertedValidation.minSalary.replace(/[\,\s]/g, '') : validationData.data.salary.min,
          max: convertedValidation.maxSalary ? convertedValidation.maxSalary.replace(/[\,\s]/g, '') : validationData.data.salary.max
        }
      }
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

    // Clear any existing errors
    setError(null)

    // Create a unique quote ID
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Prepare quote data to store in sessionStorage
    const quoteData: QuoteData = {
      calculatorType: 'eor' as const,
      formData: { 
        ...formData, 
        currency: currency,
        clientCurrency: clientCurrency,
        compareCurrency: compareCurrency
      },
      quotes: {},
      metadata: {
        timestamp: Date.now(),
        currency: currency
      },
      status: 'calculating' as const
    }

    // Store quote data safely in sessionStorage
    const storageResult = setJsonInSessionStorage(quoteId, quoteData)
    if (!storageResult.success) {
      setError(storageResult.error || "Failed to save quote data. Please try again.")
      return
    }
    
    try {
      // Open new tab with quote page
      const quoteWindow = window.open(`/quote?id=${quoteId}`, '_blank')
      
      if (!quoteWindow) {
        // Handle blocked popup
        setError("Please allow popups for this site to view your quote results.")
        return
      }
      
      // The actual calculation will be handled by the quote page using useQuoteResults hook
      
    } catch (error) {
      console.error('Error opening quote page:', error)
      setError(error instanceof Error ? error.message : "Failed to open quote page. Please try again.")
    }
  }

  const clearQuotes = () => {
    setError(null)
  }

  return {
    error,
    calculateQuote,
    clearQuotes,
  }
}
