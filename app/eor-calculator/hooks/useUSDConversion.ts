import { useState, useEffect, useRef, useCallback } from "react"
import { DeelQuote, RemoteQuote, RivermateQuote, USDConversions } from "@/lib/shared/types"
import { convertDeelQuoteToUsd, convertRivermateQuoteToUsd, convertRemoteQuoteToUsd } from "@/lib/shared/utils/currencyUtils"

export const useUSDConversion = () => {
  const [usdConversions, setUsdConversions] = useState<USDConversions>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [isConvertingRemoteToUsd, setIsConvertingRemoteToUsd] = useState(false)
  const [isConvertingCompareRemoteToUsd, setIsConvertingCompareRemoteToUsd] = useState(false)
  const [isConvertingRivermateToUsd, setIsConvertingRivermateToUsd] = useState(false)
  const [isConvertingCompareRivermateToUsd, setIsConvertingCompareRivermateToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)
  
  const conversionAbortControllerRef = useRef<{
    deel: AbortController | null,
    compare: AbortController | null,
    remote: AbortController | null,
    compareRemote: AbortController | null,
    rivermate: AbortController | null,
    compareRivermate: AbortController | null
  }>({ deel: null, compare: null, remote: null, compareRemote: null, rivermate: null, compareRivermate: null });
  
  const convertedQuotesRef = useRef<Set<string>>(new Set())

  const convertQuoteToUSD = useCallback(async (
    quote: DeelQuote | RivermateQuote, 
    quoteType: "deel" | "compare" | "rivermate" | "compareRivermate"
  ) => {
    if (!quote || quote.currency === "USD") return

    if (conversionAbortControllerRef.current[quoteType]) {
      conversionAbortControllerRef.current[quoteType]?.abort()
    }

    const abortController = new AbortController()
    conversionAbortControllerRef.current[quoteType] = abortController

      if (quoteType === "deel") setIsConvertingDeelToUsd(true)
      if (quoteType === "compare") setIsConvertingCompareToUsd(true)
      if (quoteType === "rivermate") setIsConvertingRivermateToUsd(true)
      if (quoteType === "compareRivermate") setIsConvertingCompareRivermateToUsd(true)
    setUsdConversionError(null)

    try {
      const result = await (
        quoteType === 'deel' || quoteType === 'compare'
          ? convertDeelQuoteToUsd(quote as DeelQuote, abortController.signal)
          : convertRivermateQuoteToUsd(quote as RivermateQuote, abortController.signal)
      )
      
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
        if (quoteType === "deel") setIsConvertingDeelToUsd(false)
        if (quoteType === "compare") setIsConvertingCompareToUsd(false)
        if (quoteType === "rivermate") setIsConvertingRivermateToUsd(false)
        if (quoteType === "compareRivermate") setIsConvertingCompareRivermateToUsd(false)
        conversionAbortControllerRef.current[quoteType] = null
      }
    }
  }, [])

  const convertRemoteQuoteToUSD = useCallback(async (
    quote: RemoteQuote, 
    quoteType: "remote" | "compareRemote"
  ) => {
    if (!quote || quote.currency === "USD") return

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
    conversionAbortControllerRef.current = { deel: null, compare: null, remote: null, compareRemote: null, rivermate: null, compareRivermate: null };
    
    convertedQuotesRef.current.clear()
    
    setUsdConversions({})
    setUsdConversionError(null)
    setIsConvertingDeelToUsd(false)
    setIsConvertingCompareToUsd(false)
    setIsConvertingRemoteToUsd(false)
    setIsConvertingCompareRemoteToUsd(false)
    setIsConvertingRivermateToUsd(false)
    setIsConvertingCompareRivermateToUsd(false)
  }, [])

  const autoConvertQuote = useCallback((quote: DeelQuote | RivermateQuote | null, quoteType: "deel" | "compare" | "rivermate" | "compareRivermate") => {
    if (!quote || quote.currency === "USD") return
    
    const totalCosts = 'total_costs' in quote ? quote.total_costs : quote.total.toString()
    const quoteId = `${quoteType}-${quote.country}-${quote.currency}-${totalCosts}`
    if (convertedQuotesRef.current.has(quoteId)) return
    
    convertedQuotesRef.current.add(quoteId)
    
    convertQuoteToUSD(quote, quoteType)

    return () => {}
  }, [convertQuoteToUSD])

  const autoConvertRemoteQuote = useCallback((quote: RemoteQuote | null, quoteType: "remote" | "compareRemote") => {
    if (!quote || quote.currency === "USD") return

    const quoteId = `${quoteType}-${quote.country}-${quote.currency}-${quote.total}`
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
    isConvertingRivermateToUsd,
    isConvertingCompareRivermateToUsd,
    usdConversionError,
    convertQuoteToUSD,
    convertRemoteQuoteToUSD,
    clearUSDConversions,
    autoConvertQuote,
    autoConvertRemoteQuote,
  }
}
