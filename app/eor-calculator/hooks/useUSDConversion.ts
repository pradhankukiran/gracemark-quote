import { useState, useEffect, useRef, useCallback } from "react"
import { DeelQuote, RemoteQuote, RivermateQuote, USDConversions, OysterQuote } from "@/lib/shared/types"
import { convertDeelQuoteToUsd, convertRivermateQuoteToUsd, convertRemoteQuoteToUsd, convertOysterQuoteToUsd } from "@/lib/shared/utils/currencyUtils"

export const useUSDConversion = () => {
  const [usdConversions, setUsdConversions] = useState<USDConversions>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [isConvertingRemoteToUsd, setIsConvertingRemoteToUsd] = useState(false)
  const [isConvertingCompareRemoteToUsd, setIsConvertingCompareRemoteToUsd] = useState(false)
  const [isConvertingRivermateToUsd, setIsConvertingRivermateToUsd] = useState(false)
  const [isConvertingCompareRivermateToUsd, setIsConvertingCompareRivermateToUsd] = useState(false)
  const [isConvertingOysterToUsd, setIsConvertingOysterToUsd] = useState(false)
  const [isConvertingCompareOysterToUsd, setIsConvertingCompareOysterToUsd] = useState(false)
  // Rippling is Deel-like in conversion shape
  // We reuse Deel conversion function but track separate flags
  const [isConvertingRipplingToUsd, setIsConvertingRipplingToUsd] = useState(false)
  const [isConvertingCompareRipplingToUsd, setIsConvertingCompareRipplingToUsd] = useState(false)
  const [isConvertingSkuadToUsd, setIsConvertingSkuadToUsd] = useState(false)
  const [isConvertingCompareSkuadToUsd, setIsConvertingCompareSkuadToUsd] = useState(false)
  const [isConvertingVelocityToUsd, setIsConvertingVelocityToUsd] = useState(false)
  const [isConvertingCompareVelocityToUsd, setIsConvertingCompareVelocityToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)
  
  const conversionAbortControllerRef = useRef<{
    deel: AbortController | null,
    compare: AbortController | null,
    rippling: AbortController | null,
    compareRippling: AbortController | null,
    skuad: AbortController | null,
    compareSkuad: AbortController | null,
    velocity: AbortController | null,
    compareVelocity: AbortController | null,
    remote: AbortController | null,
    compareRemote: AbortController | null,
    rivermate: AbortController | null,
    compareRivermate: AbortController | null,
    oyster: AbortController | null,
    compareOyster: AbortController | null,
  }>({ deel: null, compare: null, rippling: null, compareRippling: null, skuad: null, compareSkuad: null, velocity: null, compareVelocity: null, remote: null, compareRemote: null, rivermate: null, compareRivermate: null, oyster: null, compareOyster: null });
  
  const convertedQuotesRef = useRef<Set<string>>(new Set())

  const convertQuoteToUSD = useCallback(async (
    quote: DeelQuote | RivermateQuote, 
    quoteType: "deel" | "compare" | "rivermate" | "compareRivermate" | "rippling" | "compareRippling" | "skuad" | "compareSkuad" | "velocity" | "compareVelocity"
  ) => {
    if (!quote || quote.currency === "USD") return

    if (conversionAbortControllerRef.current[quoteType]) {
      conversionAbortControllerRef.current[quoteType]?.abort()
    }

    const abortController = new AbortController()
    conversionAbortControllerRef.current[quoteType] = abortController

      if (quoteType === "deel") setIsConvertingDeelToUsd(true)
      if (quoteType === "compare") setIsConvertingCompareToUsd(true)
      if (quoteType === "rippling") setIsConvertingRipplingToUsd(true)
      if (quoteType === "compareRippling") setIsConvertingCompareRipplingToUsd(true)
      if (quoteType === "skuad") setIsConvertingSkuadToUsd(true)
      if (quoteType === "compareSkuad") setIsConvertingCompareSkuadToUsd(true)
      if (quoteType === "velocity") setIsConvertingVelocityToUsd(true)
      if (quoteType === "compareVelocity") setIsConvertingCompareVelocityToUsd(true)
      if (quoteType === "rivermate") setIsConvertingRivermateToUsd(true)
      if (quoteType === "compareRivermate") setIsConvertingCompareRivermateToUsd(true)
    setUsdConversionError(null)

    try {
      const result = await (
        quoteType === 'deel' || quoteType === 'compare' || quoteType === 'rippling' || quoteType === 'compareRippling' || quoteType === 'skuad' || quoteType === 'compareSkuad' || quoteType === 'velocity' || quoteType === 'compareVelocity'
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
        if (quoteType === "rippling") setIsConvertingRipplingToUsd(false)
        if (quoteType === "compareRippling") setIsConvertingCompareRipplingToUsd(false)
        if (quoteType === "skuad") setIsConvertingSkuadToUsd(false)
        if (quoteType === "compareSkuad") setIsConvertingCompareSkuadToUsd(false)
        if (quoteType === "velocity") setIsConvertingVelocityToUsd(false)
        if (quoteType === "compareVelocity") setIsConvertingCompareVelocityToUsd(false)
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
    conversionAbortControllerRef.current = { deel: null, compare: null, rippling: null, compareRippling: null, skuad: null, compareSkuad: null, velocity: null, compareVelocity: null, remote: null, compareRemote: null, rivermate: null, compareRivermate: null, oyster: null, compareOyster: null };
    
    convertedQuotesRef.current.clear()
    
    setUsdConversions({})
    setUsdConversionError(null)
    setIsConvertingDeelToUsd(false)
    setIsConvertingCompareToUsd(false)
    setIsConvertingRemoteToUsd(false)
    setIsConvertingCompareRemoteToUsd(false)
    setIsConvertingRivermateToUsd(false)
    setIsConvertingCompareRivermateToUsd(false)
    setIsConvertingOysterToUsd(false)
    setIsConvertingCompareOysterToUsd(false)
    setIsConvertingRipplingToUsd(false)
    setIsConvertingCompareRipplingToUsd(false)
    setIsConvertingSkuadToUsd(false)
    setIsConvertingCompareSkuadToUsd(false)
    setIsConvertingVelocityToUsd(false)
    setIsConvertingCompareVelocityToUsd(false)
  }, [])

  const autoConvertQuote = useCallback((quote: DeelQuote | RivermateQuote | OysterQuote | null, quoteType: "deel" | "compare" | "rivermate" | "compareRivermate" | "oyster" | "compareOyster" | "rippling" | "compareRippling" | "skuad" | "compareSkuad" | "velocity" | "compareVelocity") => {
    if (!quote || quote.currency === "USD") return
    
    const totalCosts = 'total_costs' in quote ? quote.total_costs : quote.total.toString()
    const quoteId = `${quoteType}-${quote.country}-${quote.currency}-${totalCosts}`
    if (convertedQuotesRef.current.has(quoteId)) return
    
    convertedQuotesRef.current.add(quoteId)
    
    if (quoteType === 'oyster' || quoteType === 'compareOyster') {
      // Inline conversion for Oyster to reuse Remote path is separate helper below
      // We keep same API by piggybacking convertQuoteToUSD with type cast
      // but conversion function is handled in dedicated helper below
      ;(async () => {
        const abortController = new AbortController()
        conversionAbortControllerRef.current[quoteType] = abortController
        if (quoteType === 'oyster') setIsConvertingOysterToUsd(true)
        else setIsConvertingCompareOysterToUsd(true)
        try {
          const res = await convertOysterQuoteToUsd(quote as unknown as OysterQuote, abortController.signal)
          if (!abortController.signal.aborted && res.success && res.data) {
            setUsdConversions(prev => ({ ...prev, [quoteType]: res.data }))
          }
        } catch {
          if (!abortController.signal.aborted) setUsdConversionError('Failed to convert Oyster quote to USD')
        } finally {
          if (conversionAbortControllerRef.current[quoteType] === abortController) {
            if (quoteType === 'oyster') setIsConvertingOysterToUsd(false)
            else setIsConvertingCompareOysterToUsd(false)
            conversionAbortControllerRef.current[quoteType] = null
          }
        }
      })()
    } else {
      convertQuoteToUSD(quote as DeelQuote | RivermateQuote, quoteType as 'deel' | 'compare' | 'rivermate' | 'compareRivermate')
    }

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
    isConvertingOysterToUsd,
    isConvertingCompareOysterToUsd,
    isConvertingRipplingToUsd,
    isConvertingCompareRipplingToUsd,
    isConvertingSkuadToUsd,
    isConvertingCompareSkuadToUsd,
    isConvertingVelocityToUsd,
    isConvertingCompareVelocityToUsd,
    usdConversionError,
    convertQuoteToUSD,
    convertRemoteQuoteToUSD,
    clearUSDConversions,
    autoConvertQuote,
    autoConvertRemoteQuote,
  }
}
