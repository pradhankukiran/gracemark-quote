import { useState, useCallback } from "react"
import { ICFormData, ICQuoteResult, ICQuoteRequest, ICQuoteResponse } from "@/lib/shared/types"

interface UseICQuoteCalculationProps {
  formData: ICFormData
  currency: string
}

const IC_QUOTE_STORAGE_KEY = "ic-calculator-quote-data"
const STORAGE_EXPIRY_HOURS = 24

const saveQuoteToStorage = (quote: ICQuoteResult) => {
  try {
    const item = {
      data: quote,
      timestamp: Date.now(),
      expiry: Date.now() + STORAGE_EXPIRY_HOURS * 60 * 60 * 1000,
    }
    localStorage.setItem(IC_QUOTE_STORAGE_KEY, JSON.stringify(item))
  } catch (error) {
    console.error("Failed to save quote to localStorage:", error)
  }
}

const loadQuoteFromStorage = (): ICQuoteResult | null => {
  try {
    const item = localStorage.getItem(IC_QUOTE_STORAGE_KEY)
    if (!item) return null

    const parsed = JSON.parse(item)
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(IC_QUOTE_STORAGE_KEY)
      return null
    }

    return parsed.data
  } catch (error) {
    console.error("Failed to load quote from localStorage:", error)
    localStorage.removeItem(IC_QUOTE_STORAGE_KEY)
    return null
  }
}

export const useICQuoteCalculation = ({ formData, currency }: UseICQuoteCalculationProps) => {
  const [quote, setQuote] = useState<ICQuoteResult | null>(() => {
    if (typeof window !== 'undefined') {
      return loadQuoteFromStorage()
    }
    return null
  })
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateQuote = useCallback(async () => {
    if (!formData.rateAmount || !formData.country) {
      setError("Please fill in all required fields")
      return
    }

    setIsCalculating(true)
    setError(null)

    try {
      const requestData: ICQuoteRequest = {
        formData,
        currency,
      }

      const response = await fetch("/api/ic-cost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })

      const result: ICQuoteResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to calculate quote")
      }

      if (result.success && result.data) {
        setQuote(result.data)
        saveQuoteToStorage(result.data)
        setError(null)
      } else {
        throw new Error(result.error || "Invalid response from server")
      }
    } catch (err) {
      console.error("Quote calculation failed:", err)
      setError(err instanceof Error ? err.message : "Failed to calculate quote")
      setQuote(null)
    } finally {
      setIsCalculating(false)
    }
  }, [formData, currency])

  const clearQuote = useCallback(() => {
    setQuote(null)
    setError(null)
    try {
      localStorage.removeItem(IC_QUOTE_STORAGE_KEY)
    } catch (error) {
      console.error("Failed to clear quote storage:", error)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Helper function to get formatted quote display data
  const getQuoteDisplayData = useCallback(() => {
    if (!quote) return null

    return {
      ...quote,
      formattedPayRate: `${currency} ${quote.payRate.toFixed(2)}`,
      formattedBillRate: `${currency} ${quote.billRate.toFixed(2)}`,
      formattedMonthlyPayRate: `${currency} ${quote.monthlyPayRate.toLocaleString()}`,
      formattedMonthlyBillRate: `${currency} ${quote.monthlyBillRate.toLocaleString()}`,
      formattedAgencyFee: `${currency} ${quote.agencyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedMonthlyAgencyFee: `${currency} ${quote.monthlyAgencyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedTransactionCost: `${currency} ${quote.transactionCost.toLocaleString()}`,
      formattedMspFee: `${currency} ${quote.mspFee.toLocaleString()}`,
      formattedBackgroundCheckMonthlyFee: `${currency} ${quote.backgroundCheckMonthlyFee.toLocaleString()}`,
      formattedMonthlyMarkup: `${currency} ${quote.monthlyMarkup.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedNetMargin: `USD ${quote.netMargin.toLocaleString()}`,
    }
  }, [quote, currency])

  return {
    quote,
    isCalculating,
    error,
    calculateQuote,
    clearQuote,
    clearError,
    getQuoteDisplayData,
  }
}
