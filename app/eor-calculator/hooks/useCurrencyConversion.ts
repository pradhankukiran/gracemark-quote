import { useState, useEffect, useRef, useCallback } from "react"
import { convertCurrency, formatConversionDisplay } from "@/lib/currency-converter"
import { EORFormData } from "@/lib/shared/types"

interface UseCurrencyConversionProps {
  baseSalary: string
  enableComparison: boolean
  compareCountry: string
  currency: string
  compareCurrency: string
  onFormUpdate: (updates: Partial<EORFormData>) => void
}

export const useCurrencyConversion = ({
  baseSalary,
  enableComparison,
  compareCountry,
  currency,
  compareCurrency,
  onFormUpdate,
}: UseCurrencyConversionProps) => {
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
      baseSalary &&
      enableComparison &&
      compareCountry &&
      compareCurrency &&
      currency &&
      currency !== compareCurrency &&
      !isComparisonManuallyEdited
    ) {
      const amount = Number.parseFloat(baseSalary)
      debouncedCurrencyConversion(amount, currency, compareCurrency)
    }
  }, [
    baseSalary, 
    compareCountry, 
    compareCurrency, 
    currency, 
    enableComparison, 
    isComparisonManuallyEdited,
    debouncedCurrencyConversion
  ])

  // Clear conversion info and reset manual edit flag when comparison country changes
  useEffect(() => {
    if (compareCountry) {
      setConversionInfo(null)
      setIsComparisonManuallyEdited(false)
    }
  }, [compareCountry])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }
    }
  }, [])

  const triggerManualConversion = () => {
    if (baseSalary && currency && compareCurrency) {
      const amount = Number.parseFloat(baseSalary)
      if (!isNaN(amount) && amount > 0) {
        setIsComparisonManuallyEdited(false)
        handleCurrencyConversion(amount, currency, compareCurrency)
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