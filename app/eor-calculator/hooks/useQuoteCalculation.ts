import { useState } from "react"
import { DeelAPIResponse, RemoteAPIResponse, EORFormData, ValidationAPIResponse } from "../types"
import { fetchEORCost, createQuoteRequestData } from "../utils/apiUtils"
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
  onValidationError: (field: string, error: string | null) => void
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const useQuoteCalculation = ({ 
  formData, 
  validationData, 
  onValidationError,
  onFormUpdate 
}: UseQuoteCalculationProps) => {
  const [deelQuote, setDeelQuote] = useState<DeelAPIResponse | null>(null)
  const [remoteQuote, setRemoteQuote] = useState<RemoteAPIResponse | null>(null)
  const [compareQuote, setCompareQuote] = useState<DeelAPIResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateAllFields = (): boolean => {
    let hasValidationErrors = false
    
    if (formData.baseSalary && !validateSalaryInput(formData.baseSalary, validationData)) {
      onValidationError('salary', 'Invalid salary amount')
      hasValidationErrors = true
    }
    
    if (formData.holidayDays && !validateHolidayInput(formData.holidayDays, validationData)) {
      onValidationError('holidays', 'Invalid holiday days')
      hasValidationErrors = true
    }
    
    if (formData.probationPeriod && !validateProbationInput(formData.probationPeriod, validationData)) {
      onValidationError('probation', 'Invalid probation period')
      hasValidationErrors = true
    }
    
    if (formData.hoursPerDay && !validateHoursInput(formData.hoursPerDay, validationData)) {
      onValidationError('hours', 'Invalid hours per day')
      hasValidationErrors = true
    }
    
    if (formData.daysPerWeek && !validateDaysInput(formData.daysPerWeek, validationData)) {
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

    setIsCalculating(true)
    setError(null)
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)

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

  const clearQuotes = () => {
    setDeelQuote(null)
    setRemoteQuote(null)
    setCompareQuote(null)
    setError(null)
  }

  return {
    deelQuote,
    remoteQuote,
    compareQuote,
    isCalculating,
    error,
    calculateQuote,
    clearQuotes,
  }
}