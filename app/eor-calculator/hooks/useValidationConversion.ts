import { useState, useEffect, useRef, useMemo } from "react"
import { ValidationAPIResponse } from "@/lib/shared/types"
import { convertCurrency } from "@/lib/currency-converter"

interface ConvertedValidation {
  minSalary?: string
  maxSalary?: string
  currency?: string
}

interface UseValidationConversionResult {
  convertedValidation: ConvertedValidation
  isConvertingValidation: boolean
  isValidationReady: boolean
}

export const useValidationConversion = (
  validationData: ValidationAPIResponse | null,
  formCurrency: string,
  isCurrencyManuallySet: boolean,
  originalCurrency?: string | null
): UseValidationConversionResult => {
  const [convertedValidation, setConvertedValidation] = useState<ConvertedValidation>({})
  const [isConvertingValidation, setIsConvertingValidation] = useState(false)
  const conversionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Create stable empty object reference to prevent unnecessary rerenders
  const stableEmptyValidation = useMemo(() => ({}), [])

  // Convert validation data when currency is overridden
  useEffect(() => {
    const convertValidationData = async () => {
      if (!validationData || !isCurrencyManuallySet || !originalCurrency) {
        setConvertedValidation(stableEmptyValidation)
        return
      }

      const originalCur = validationData.data.currency
      const targetCurrency = formCurrency
      
      if (originalCur === targetCurrency) {
        setConvertedValidation(stableEmptyValidation)
        return
      }

      setIsConvertingValidation(true)
      
      // Clear any existing timeout
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }

      // Set a timeout to prevent indefinite waiting
      conversionTimeoutRef.current = setTimeout(() => {
        console.warn('Validation conversion timeout - falling back to original data')
        setIsConvertingValidation(false)
        setConvertedValidation(stableEmptyValidation)
      }, 10000) // 10 second timeout
      
      try {
        const conversions: { minSalary?: string; maxSalary?: string } = {}
        
        // Convert minimum salary
        if (validationData.data.salary.min) {
          const minAmount = parseFloat(validationData.data.salary.min.replace(/[,\s]/g, ''))
          if (!isNaN(minAmount)) {
            const result = await convertCurrency(minAmount, originalCur, targetCurrency)
            if (result.success && result.data) {
              conversions.minSalary = result.data.target_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }
          }
        }
        
        // Convert maximum salary
        if (validationData.data.salary.max) {
          const maxAmount = parseFloat(validationData.data.salary.max.replace(/[,\s]/g, ''))
          if (!isNaN(maxAmount)) {
            const result = await convertCurrency(maxAmount, originalCur, targetCurrency)
            if (result.success && result.data) {
              conversions.maxSalary = result.data.target_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }
          }
        }
        
        setConvertedValidation({
          ...conversions,
          currency: targetCurrency,
        })
      } catch (error) {
        console.warn('Failed to convert validation data:', error)
        setConvertedValidation(stableEmptyValidation)
      } finally {
        if (conversionTimeoutRef.current) {
          clearTimeout(conversionTimeoutRef.current)
        }
        setIsConvertingValidation(false)
      }
    }

    convertValidationData()
    
    return () => {
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }
    }
  }, [validationData, isCurrencyManuallySet, formCurrency, originalCurrency, stableEmptyValidation])

  const isValidationReady = !isConvertingValidation
  
  // Memoize the returned convertedValidation to prevent unnecessary rerenders
  const memoizedConvertedValidation = useMemo(() => {
    // If it's the stable empty validation, return it directly
    if (convertedValidation === stableEmptyValidation) {
      return stableEmptyValidation
    }
    // Return the actual converted validation data
    return convertedValidation
  }, [convertedValidation, stableEmptyValidation])

  return {
    convertedValidation: memoizedConvertedValidation,
    isConvertingValidation,
    isValidationReady,
  }
}
