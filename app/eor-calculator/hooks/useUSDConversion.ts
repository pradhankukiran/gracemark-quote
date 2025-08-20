import { useState, useEffect, useRef, useCallback } from "react"
import { DeelAPIResponse, USDConversions } from "../types"
import { convertQuoteToUsd } from "../utils/currencyUtils"

export const useUSDConversion = () => {
  const [usdConversions, setUsdConversions] = useState<USDConversions>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)
  
  // Track conversion cancellation
  const conversionAbortControllerRef = useRef<AbortController | null>(null)
  
  // Track which quotes have been converted to prevent duplicates
  const convertedQuotesRef = useRef<Set<string>>(new Set())

  const convertQuoteToUSD = async (
    quote: DeelAPIResponse, 
    quoteType: "deel" | "compare",
    isAutomatic = false
  ) => {
    if (!quote) return

    const sourceCurrency = quote.currency
    if (sourceCurrency === "USD") return // Already in USD

    // Cancel any ongoing conversion
    if (conversionAbortControllerRef.current) {
      conversionAbortControllerRef.current.abort()
    }

    // Create new abort controller for this conversion
    const abortController = new AbortController()
    conversionAbortControllerRef.current = abortController

    // Set appropriate loading state based on quote type
    if (quoteType === "deel") {
      setIsConvertingDeelToUsd(true)
    } else if (quoteType === "compare") {
      setIsConvertingCompareToUsd(true)
    }
    setUsdConversionError(null)

    try {
      // Create progressive callbacks to update UI as each conversion completes
      const progressCallback = {
        onSalaryConverted: (amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => ({
              ...prev,
              [quoteType]: {
                ...prev[quoteType],
                salary: amount
              }
            }))
          }
        },
        onFeeConverted: (amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => ({
              ...prev,
              [quoteType]: {
                ...prev[quoteType],
                deelFee: amount
              }
            }))
          }
        },
        onCostConverted: (costIndex: number, amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => {
              const currentData = prev[quoteType] || { costs: [] }
              const updatedCosts = [...(currentData.costs || [])]
              updatedCosts[costIndex] = amount
              return {
                ...prev,
                [quoteType]: {
                  ...currentData,
                  costs: updatedCosts
                }
              }
            })
          }
        },
        onTotalConverted: (amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => ({
              ...prev,
              [quoteType]: {
                ...prev[quoteType],
                totalCosts: amount
              }
            }))
          }
        }
      }

      const result = await convertQuoteToUsd(quote, progressCallback)
      
      // Check if conversion was aborted
      if (abortController.signal.aborted) {
        return
      }
      
      if (!result.success) {
        throw new Error(result.error || "Conversion failed")
      }
    } catch (error) {
      // Don't set error if conversion was aborted
      if (!abortController.signal.aborted) {
        setUsdConversionError(
          "Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error")
        )
      }
    } finally {
      // Clear appropriate loading state based on quote type (only if not aborted)
      if (!abortController.signal.aborted) {
        if (quoteType === "deel") {
          setIsConvertingDeelToUsd(false)
        } else if (quoteType === "compare") {
          setIsConvertingCompareToUsd(false)
        }
      }
      
      // Clear abort controller reference if this was the active one
      if (conversionAbortControllerRef.current === abortController) {
        conversionAbortControllerRef.current = null
      }
    }
  }

  const clearUSDConversions = () => {
    // Cancel any ongoing conversions
    if (conversionAbortControllerRef.current) {
      conversionAbortControllerRef.current.abort()
      conversionAbortControllerRef.current = null
    }
    
    // Clear conversion tracking
    convertedQuotesRef.current.clear()
    
    setUsdConversions({})
    setUsdConversionError(null)
    setIsConvertingDeelToUsd(false)
    setIsConvertingCompareToUsd(false)
  }

  // Auto-convert quotes when they arrive - memoized to prevent infinite loops
  const autoConvertQuote = useCallback((quote: DeelAPIResponse | null, quoteType: "deel" | "compare") => {
    if (!quote || quote.currency === "USD") return
    
    // Create unique identifier for this quote
    const quoteId = `${quoteType}-${quote.country}-${quote.currency}-${quote.total_costs}`
    
    // Skip if already converted
    if (convertedQuotesRef.current.has(quoteId)) {
      return
    }
    
    // Mark as being converted
    convertedQuotesRef.current.add(quoteId)
    
    // Debounce automatic conversions (wait 500ms before converting)
    const timeoutId = setTimeout(() => {
      convertQuoteToUSD(quote, quoteType, true)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [convertQuoteToUSD])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversionAbortControllerRef.current) {
        conversionAbortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    usdConversionError,
    convertQuoteToUSD,
    clearUSDConversions,
    autoConvertQuote,
  }
}