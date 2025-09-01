import { useState, useEffect, useRef, useCallback } from "react"
import { DeelAPIResponse, RemoteAPIResponse, USDConversions } from "@/lib/shared/types"
import { convertQuoteToUsd, convertRemoteQuoteToUsd } from "@/lib/shared/utils/currencyUtils"

export const useUSDConversion = () => {
  const [usdConversions, setUsdConversions] = useState<USDConversions>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [isConvertingRemoteToUsd, setIsConvertingRemoteToUsd] = useState(false)
  const [isConvertingCompareRemoteToUsd, setIsConvertingCompareRemoteToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)
  
  const conversionAbortControllerRef = useRef<{
    deel: AbortController | null,
    compare: AbortController | null,
    remote: AbortController | null,
    compareRemote: AbortController | null
  }>({ deel: null, compare: null, remote: null, compareRemote: null });
  
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
      const result = await convertQuoteToUsd(quote, abortController.signal)
      
      if (abortController.signal.aborted) return
      
      if (result.success && result.data) {
        setUsdConversions(prev => ({ ...prev, [quoteType]: result.data }))
      } else {
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

  const convertRemoteQuoteToUSD = useCallback(async (
    quote: RemoteAPIResponse, 
    quoteType: "remote" | "compareRemote"
  ) => {
    if (!quote || quote.employment.employer_currency_costs.currency.code === "USD") return

    if (conversionAbortControllerRef.current[quoteType]) {
      conversionAbortControllerRef.current[quoteType]?.abort()
    }

    const abortController = new AbortController()
    conversionAbortControllerRef.current[quoteType] = abortController

    if (quoteType === "remote") {
      setIsConvertingRemoteToUsd(true)
    } else {
      setIsConvertingCompareRemoteToUsd(true)
    }
    setUsdConversionError(null)

    try {
      const result = await convertRemoteQuoteToUsd(quote, abortController.signal)
      
      if (abortController.signal.aborted) return
      
      if (result.success && result.data) {
        setUsdConversions(prev => ({ ...prev, [quoteType]: result.data }))
      } else {
        throw new Error(result.error || "Conversion failed")
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        setUsdConversionError(
          "Failed to convert Remote quote to USD - " + (error instanceof Error ? error.message : "Unknown error")
        )
      }
    } finally {
      if (conversionAbortControllerRef.current[quoteType] === abortController) {
        if (quoteType === "remote") {
          setIsConvertingRemoteToUsd(false)
        } else {
          setIsConvertingCompareRemoteToUsd(false)
        }
        conversionAbortControllerRef.current[quoteType] = null
      }
    }
  }, [])

  const clearUSDConversions = useCallback(() => {
    Object.values(conversionAbortControllerRef.current).forEach(controller => controller?.abort());
    conversionAbortControllerRef.current = { deel: null, compare: null, remote: null, compareRemote: null };
    
    convertedQuotesRef.current.clear()
    
    setUsdConversions({})
    setUsdConversionError(null)
    setIsConvertingDeelToUsd(false)
    setIsConvertingCompareToUsd(false)
    setIsConvertingRemoteToUsd(false)
    setIsConvertingCompareRemoteToUsd(false)
  }, [])

  const autoConvertQuote = useCallback((quote: DeelAPIResponse | null, quoteType: "deel" | "compare") => {
    if (!quote || quote.currency === "USD") return
    
    const quoteId = `${quoteType}-${quote.country}-${quote.currency}-${quote.total_costs}`
    if (convertedQuotesRef.current.has(quoteId)) return
    
    convertedQuotesRef.current.add(quoteId)
    
    convertQuoteToUSD(quote, quoteType)

    return () => {}
  }, [convertQuoteToUSD])

  const autoConvertRemoteQuote = useCallback((quote: RemoteAPIResponse | null, quoteType: "remote" | "compareRemote") => {
    if (!quote || quote.employment.employer_currency_costs.currency.code === "USD") return

    const quoteId = `${quoteType}-${quote.employment.country.name}-${quote.employment.employer_currency_costs.currency.code}-${quote.employment.employer_currency_costs.monthly_total}`
    if (convertedQuotesRef.current.has(quoteId)) return

    convertedQuotesRef.current.add(quoteId)

    convertRemoteQuoteToUSD(quote, quoteType)

    return () => {}
  }, [convertRemoteQuoteToUSD])

  useEffect(() => {
    return () => {
      Object.values(conversionAbortControllerRef.current).forEach(controller => controller?.abort());
    }
  }, [])

  return {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    isConvertingRemoteToUsd,
    isConvertingCompareRemoteToUsd,
    usdConversionError,
    convertQuoteToUSD,
    convertRemoteQuoteToUSD,
    clearUSDConversions,
    autoConvertQuote,
    autoConvertRemoteQuote,
  }
}
