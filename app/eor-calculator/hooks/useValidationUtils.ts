import { useRef, useEffect, useState } from "react"
import { ValidationAPIResponse, ValidationErrors } from "@/lib/shared/types"

// Type definitions for validation functions
type ValidationFunctions = {
  validateSalaryInput: (value: string, validationData: ValidationAPIResponse | null) => boolean
  validateHolidayInput: (value: string, validationData: ValidationAPIResponse | null) => boolean
  validateProbationInput: (value: string, validationData: ValidationAPIResponse | null) => boolean
  validateHoursInput: (value: string, validationData: ValidationAPIResponse | null) => boolean
  validateDaysInput: (value: string, validationData: ValidationAPIResponse | null) => boolean
  generateValidationErrorMessage: (
    field: 'salary' | 'holiday' | 'probation' | 'hours' | 'days',
    validationData: ValidationAPIResponse | null,
    currency?: string
  ) => string
}

/**
 * Hook that preloads validation utilities to avoid dynamic import delays
 * during form interactions
 */
export const useValidationUtils = () => {
  const validationFunctionsRef = useRef<ValidationFunctions | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Preload validation utilities on mount
    const loadValidationUtils = async () => {
      try {
        const validationUtils = await import("@/lib/shared/utils/validationUtils")
        
        validationFunctionsRef.current = {
          validateSalaryInput: validationUtils.validateSalaryInput,
          validateHolidayInput: validationUtils.validateHolidayInput,
          validateProbationInput: validationUtils.validateProbationInput,
          validateHoursInput: validationUtils.validateHoursInput,
          validateDaysInput: validationUtils.validateDaysInput,
          generateValidationErrorMessage: validationUtils.generateValidationErrorMessage
        }
        
        setIsLoaded(true)
      } catch (error) {
        console.error("Failed to preload validation utilities:", error)
        setIsLoaded(false)
      }
    }

    loadValidationUtils()
  }, [])

  /**
   * Validate a field using preloaded validation functions
   */
  const validateField = (
    field: keyof ValidationErrors,
    value: string,
    validatorType: 'salary' | 'holiday' | 'probation' | 'hours' | 'days',
    validationData: ValidationAPIResponse | null,
    currency: string,
    onValidationError?: (field: keyof ValidationErrors, error: string | null) => void
  ): { isValid: boolean; errorMessage?: string } => {
    if (!isLoaded || !validationFunctionsRef.current || !value) {
      onValidationError?.(field, null)
      return { isValid: true }
    }

    const functions = validationFunctionsRef.current
    let isValid = false

    switch (validatorType) {
      case 'salary':
        isValid = functions.validateSalaryInput(value, validationData)
        break
      case 'holiday':
        isValid = functions.validateHolidayInput(value, validationData)
        break
      case 'probation':
        isValid = functions.validateProbationInput(value, validationData)
        break
      case 'hours':
        isValid = functions.validateHoursInput(value, validationData)
        break
      case 'days':
        isValid = functions.validateDaysInput(value, validationData)
        break
    }

    if (!isValid && functions.generateValidationErrorMessage) {
      const errorMessage = functions.generateValidationErrorMessage(
        validatorType, 
        validationData, 
        currency
      )
      onValidationError?.(field, errorMessage || `Invalid ${validatorType}`)
      return { isValid, errorMessage }
    }

    onValidationError?.(field, null)
    return { isValid }
  }

  /**
   * Check if validation utilities are loaded and ready to use
   */
  const isValidationReady = () => {
    return isLoaded && validationFunctionsRef.current !== null
  }

  return {
    validateField,
    isValidationReady,
    isLoaded
  }
}
