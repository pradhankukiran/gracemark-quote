import { useState, useEffect, useRef } from "react"
import { ValidationAPIResponse } from "../types"
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
  originalCurrency?: string
): UseValidationConversionResult => {
  const [convertedValidation, setConvertedValidation] = useState<ConvertedValidation>({})
  const [isConvertingValidation, setIsConvertingValidation] = useState(false)
  const conversionTimeoutRef = useRef<NodeJS.Timeout>()

  // Convert validation data when currency is overridden
  useEffect(() => {
    const convertValidationData = async () => {
      if (!validationData || !isCurrencyManuallySet || !originalCurrency) {
        setConvertedValidation({})
        return
      }

      const originalCur = validationData.data.currency
      const targetCurrency = formCurrency
      
      if (originalCur === targetCurrency) {
        setConvertedValidation({})
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
        setConvertedValidation({})
      }, 10000) // 10 second timeout
      
      try {
        const conversions: { minSalary?: string; maxSalary?: string } = {}
        
        // Convert minimum salary
        if (validationData.data.salary.min) {
          const minAmount = parseFloat(validationData.data.salary.min.replace(/[,\s]/g, ''))
          if (!isNaN(minAmount)) {
            const result = await convertCurrency(minAmount, originalCur, targetCurrency)
            if (result.success && result.data) {
              conversions.minSalary = result.data.target_amount.toLocaleString()
            }
          }
        }
        
        // Convert maximum salary
        if (validationData.data.salary.max) {
          const maxAmount = parseFloat(validationData.data.salary.max.replace(/[,\s]/g, ''))
          if (!isNaN(maxAmount)) {
            const result = await convertCurrency(maxAmount, originalCur, targetCurrency)
            if (result.success && result.data) {
              conversions.maxSalary = result.data.target_amount.toLocaleString()
            }
          }
        }
        
        setConvertedValidation({
          ...conversions,
          currency: targetCurrency,
        })
      } catch (error) {
        console.warn('Failed to convert validation data:', error)
        setConvertedValidation({})
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
  }, [validationData, isCurrencyManuallySet, formCurrency, originalCurrency])

  const isValidationReady = !isConvertingValidation

  return {
    convertedValidation,
    isConvertingValidation,
    isValidationReady,
  }
}