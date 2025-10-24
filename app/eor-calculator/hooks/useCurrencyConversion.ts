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
  const conversionRequestTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const conversionAbortRef = useRef<AbortController | null>(null)
  const latestRequestIdRef = useRef<symbol | null>(null)

  const handleCurrencyConversion = useCallback(async (
    amount: number, 
    sourceCurrency: string, 
    targetCurrency: string
  ) => {
    if (!amount || sourceCurrency === targetCurrency) return

    // Cancel any in-flight conversion before starting a new one
    if (conversionAbortRef.current) {
      conversionAbortRef.current.abort()
      conversionAbortRef.current = null
    }
    if (conversionRequestTimeoutRef.current) {
      clearTimeout(conversionRequestTimeoutRef.current)
      conversionRequestTimeoutRef.current = null
    }

    setIsConverting(true)
    setConversionInfo(null)

    const requestId = Symbol('currency-conversion')
    latestRequestIdRef.current = requestId
    const abortController = new AbortController()
    conversionAbortRef.current = abortController

    conversionRequestTimeoutRef.current = setTimeout(() => {
      if (!abortController.signal.aborted) {
        abortController.abort()
        setConversionInfo("Conversion timed out - please enter amount manually")
      }
    }, 10000)

    try {
      const result = await convertCurrency(amount, sourceCurrency, targetCurrency, abortController.signal)

      if (abortController.signal.aborted) {
        return
      }

      if (result.success && result.data) {
        onFormUpdate({
          compareSalary: result.data.target_amount.toString(),
        })
        setConversionInfo(formatConversionDisplay(result.data))
      } else {
        setConversionInfo("Conversion failed - please enter amount manually")
      }
    } catch {
      if (!abortController.signal.aborted) {
        setConversionInfo("Conversion failed - please enter amount manually")
      }
    } finally {
      if (conversionRequestTimeoutRef.current) {
        clearTimeout(conversionRequestTimeoutRef.current)
        conversionRequestTimeoutRef.current = null
      }
      if (conversionAbortRef.current === abortController) {
        conversionAbortRef.current = null
      }
      if (latestRequestIdRef.current === requestId) {
        latestRequestIdRef.current = null
        setIsConverting(false)
      }
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
      if (baseSalary && currency && compareCurrency) {
        const amount = Number.parseFloat(baseSalary)
        if (!isNaN(amount) && amount > 0 && currency !== compareCurrency) {
          handleCurrencyConversion(amount, currency, compareCurrency)
        } else {
          onFormUpdate({ compareSalary: baseSalary })
        }
      } else {
        onFormUpdate({ compareSalary: "" })
      }
    } else {
      onFormUpdate({ compareSalary: "" })
    }
  }, [compareCountry, baseSalary, currency, compareCurrency, handleCurrencyConversion, onFormUpdate])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (conversionTimeoutRef.current) {
        clearTimeout(conversionTimeoutRef.current)
      }
      if (conversionRequestTimeoutRef.current) {
        clearTimeout(conversionRequestTimeoutRef.current)
      }
      if (conversionAbortRef.current) {
        conversionAbortRef.current.abort()
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
