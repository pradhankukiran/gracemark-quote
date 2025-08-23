import { useState, useEffect, useRef, useCallback } from "react"
import { DeelAPIResponse, USDConversions } from "@/lib/shared/types"
import { convertQuoteToUsd } from "@/lib/shared/utils/currencyUtils"

export const useUSDConversion = () => {
  const [usdConversions, setUsdConversions] = useState<USDConversions>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)
  
  const conversionAbortControllerRef = useRef<{
    deel: AbortController | null,
    compare: AbortController | null
  }>({ deel: null, compare: null });
  
  const convertedQuotesRef = useRef<Set<string>>(new Set())

  const convertQuoteToUSD = useCallback(async (
    quote: DeelAPIResponse, 
    quoteType: "deel" | "compare"
  ) => {
    if (!quote || quote.currency === "USD") return

    if (conversionAbortControllerRef.current[quoteType]) {
      conversionAbortControllerRef.current[quoteType]?.abort()
    }

    const abortController = new AbortController()
    conversionAbortControllerRef.current[quoteType] = abortController

    if (quoteType === "deel") {
      setIsConvertingDeelToUsd(true)
    } else {
      setIsConvertingCompareToUsd(true)
    }
    setUsdConversionError(null)

    try {
      const progressCallback = {
        onSalaryConverted: (amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => ({ ...prev, [quoteType]: { ...prev[quoteType], salary: amount } }))
          }
        },
        onFeeConverted: (amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => ({ ...prev, [quoteType]: { ...prev[quoteType], deelFee: amount } }))
          }
        },
        onCostConverted: (costIndex: number, amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => {
              const currentData = prev[quoteType] || { costs: [] }
              const updatedCosts = [...(currentData.costs || [])]
              updatedCosts[costIndex] = amount
              return { ...prev, [quoteType]: { ...currentData, costs: updatedCosts } }
            })
          }
        },
        onTotalConverted: (amount: number) => {
          if (!abortController.signal.aborted) {
            setUsdConversions(prev => ({ ...prev, [quoteType]: { ...prev[quoteType], totalCosts: amount } }))
          }
        }
      }

      const result = await convertQuoteToUsd(quote, progressCallback)
      
      if (abortController.signal.aborted) return
      
      if (!result.success) {
        throw new Error(result.error || "Conversion failed")
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        setUsdConversionError(
          "Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error")
        )
      }
    } finally {
      if (conversionAbortControllerRef.current[quoteType] === abortController) {
        if (quoteType === "deel") {
          setIsConvertingDeelToUsd(false)
        } else {
          setIsConvertingCompareToUsd(false)
        }
        conversionAbortControllerRef.current[quoteType] = null
      }
    }
  }, [])

  const clearUSDConversions = useCallback(() => {
    conversionAbortControllerRef.current.deel?.abort()
    conversionAbortControllerRef.current.compare?.abort()
    conversionAbortControllerRef.current = { deel: null, compare: null }
    
    convertedQuotesRef.current.clear()
    
    setUsdConversions({})
    setUsdConversionError(null)
    setIsConvertingDeelToUsd(false)
    setIsConvertingCompareToUsd(false)
  }, [])

  const autoConvertQuote = useCallback((quote: DeelAPIResponse | null, quoteType: "deel" | "compare") => {
    if (!quote || quote.currency === "USD") return
    
    const quoteId = `${quoteType}-${quote.country}-${quote.currency}-${quote.total_costs}`
    if (convertedQuotesRef.current.has(quoteId)) return
    
    convertedQuotesRef.current.add(quoteId)
    
    const timeoutId = setTimeout(() => {
      convertQuoteToUSD(quote, quoteType)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [convertQuoteToUSD])

  useEffect(() => {
    return () => {
      conversionAbortControllerRef.current.deel?.abort()
      conversionAbortControllerRef.current.compare?.abort()
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
