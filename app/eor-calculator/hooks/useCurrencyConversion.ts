import { useState, useEffect, useRef, useCallback } from "react"
import { convertCurrency, formatConversionDisplay } from "@/lib/currency-converter"
import { EORFormData } from "../types"

interface UseCurrencyConversionProps {
  formData: EORFormData
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const useCurrencyConversion = ({ formData, onFormUpdate }: UseCurrencyConversionProps) => {
  const [isConverting, setIsConverting] = useState(false)
  const [conversionInfo, setConversionInfo] = useState<string | null>(null)
  const [isComparisonManuallyEdited, setIsComparisonManuallyEdited] = useState(false)
  const conversionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCurrencyConversion = useCallback(async (
    amount: number, 
    sourceCurrency: string, 
    targetCurrency: string
  ) => {
    if (!amount || sourceCurrency === targetCurrency) return

    setIsConverting(true)
    setConversionInfo(null)

    try {
      const result = await convertCurrency(amount, sourceCurrency, targetCurrency)

      if (result.success && result.data) {
        onFormUpdate({
          compareSalary: result.data.target_amount.toString(),
        })
        setConversionInfo(formatConversionDisplay(result.data))
      } else {
        setConversionInfo("Conversion failed - please enter amount manually")
      }
    } catch {
      setConversionInfo("Conversion failed - please enter amount manually")
    } finally {
      setIsConverting(false)
    }
  }, [onFormUpdate])

  const debouncedCurrencyConversion = useCallback((
    amount: number, 
    sourceCurrency: string, 
    targetCurrency: string
  ) => {
    if (conversionTimeoutRef.current) {
      clearTimeout(conversionTimeoutRef.current)
    }

    conversionTimeoutRef.current = setTimeout(() => {
      if (!isNaN(amount) && amount > 0 && sourceCurrency !== targetCurrency) {
        handleCurrencyConversion(amount, sourceCurrency, targetCurrency)
      }
    }, 300)
  }, [handleCurrencyConversion])

  // Auto-convert salary when base salary changes
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
  }, [
    formData.baseSalary, 
    formData.compareCountry, 
    formData.compareCurrency, 
    formData.currency, 
    formData.enableComparison, 
    isComparisonManuallyEdited
  ])

  // Clear conversion info and reset manual edit flag when comparison country changes
  useEffect(() => {
    if (formData.compareCountry) {
      setConversionInfo(null)
      setIsComparisonManuallyEdited(false)
    }
  }, [formData.compareCountry])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }
    }
  }, [])

  const triggerManualConversion = () => {
    if (formData.baseSalary && formData.currency && formData.compareCurrency) {
      const amount = Number.parseFloat(formData.baseSalary)
      if (!isNaN(amount) && amount > 0) {
        setIsComparisonManuallyEdited(false)
        handleCurrencyConversion(amount, formData.currency, formData.compareCurrency)
      }
    }
  }

  const markAsManuallyEdited = () => {
    setIsComparisonManuallyEdited(true)
    setConversionInfo(null)
  }

  const clearConversionData = () => {
    setConversionInfo(null)
    setIsComparisonManuallyEdited(false)
  }

  return {
    isConverting,
    conversionInfo,
    isComparisonManuallyEdited,
    handleCurrencyConversion,
    triggerManualConversion,
    markAsManuallyEdited,
    clearConversionData,
  }
}