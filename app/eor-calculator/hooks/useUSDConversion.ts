import { useState } from "react"
import { DeelAPIResponse, USDConversions } from "../types"
import { convertQuoteToUsd } from "../utils/currencyUtils"

export const useUSDConversion = () => {
  const [usdConversions, setUsdConversions] = useState<USDConversions>({})
  const [isConvertingDeelToUsd, setIsConvertingDeelToUsd] = useState(false)
  const [isConvertingCompareToUsd, setIsConvertingCompareToUsd] = useState(false)
  const [usdConversionError, setUsdConversionError] = useState<string | null>(null)

  const convertQuoteToUSD = async (
    quote: DeelAPIResponse, 
    quoteType: "deel" | "compare"
  ) => {
    if (!quote) return

    const sourceCurrency = quote.currency
    if (sourceCurrency === "USD") return // Already in USD

    // Set appropriate loading state based on quote type
    if (quoteType === "deel") {
      setIsConvertingDeelToUsd(true)
    } else if (quoteType === "compare") {
      setIsConvertingCompareToUsd(true)
    }
    setUsdConversionError(null)

    try {
      const result = await convertQuoteToUsd(quote, quoteType)
      
      if (result.success && result.data) {
        setUsdConversions(prev => ({
          ...prev,
          [quoteType]: result.data
        }))
      } else {
        throw new Error(result.error || "Conversion failed")
      }
    } catch (error) {
      setUsdConversionError(
        "Failed to convert to USD - " + (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      // Clear appropriate loading state based on quote type
      if (quoteType === "deel") {
        setIsConvertingDeelToUsd(false)
      } else if (quoteType === "compare") {
        setIsConvertingCompareToUsd(false)
      }
    }
  }

  const clearUSDConversions = () => {
    setUsdConversions({})
    setUsdConversionError(null)
  }

  return {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    usdConversionError,
    convertQuoteToUSD,
    clearUSDConversions,
  }
}