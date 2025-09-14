import { useState } from "react"
import { EORFormData, QuoteData } from "@/lib/shared/types"
import { setJsonInSessionStorage } from "@/lib/shared/utils/storageUtils"

interface UseQuoteCalculationProps {
  formData: EORFormData
  currency: string
  clientCurrency: string
  compareCurrency: string
}

export const useQuoteCalculation = ({ 
  formData, 
  currency,
  clientCurrency,
  compareCurrency
}: UseQuoteCalculationProps) => {
  const [error, setError] = useState<string | null>(null)


  const calculateQuote = async () => {
    // console.log('🚀 calculateQuote - START')
    // console.log('📥 Incoming formData from useQuoteCalculation:', JSON.stringify(formData, null, 2))
    // console.log('💰 Currency values:', { currency, clientCurrency, compareCurrency })

    // Clear any existing errors
    setError(null)

    // Create a unique quote ID
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    // console.log('🆔 Generated quote ID:', quoteId)
    
    // Prepare quote data to store in sessionStorage
    const quoteData: QuoteData = {
      calculatorType: 'eor' as const,
      formData: { 
        ...formData, 
        currency: currency,
        clientCurrency: clientCurrency,
        compareCurrency: compareCurrency
      },
      quotes: {},
      metadata: {
        timestamp: Date.now(),
        currency: currency
      },
      status: 'calculating' as const
    }

    // console.log('📦 QuoteData being stored in session storage:', JSON.stringify(quoteData, null, 2))
    // console.log('🔍 QuoteData.formData key fields:', {
    //   baseSalary: quoteData.formData.baseSalary,
    //   country: quoteData.formData.country,
    //   currency: quoteData.formData.currency,
    //   clientCountry: quoteData.formData.clientCountry
    // })

    // Store quote data safely in sessionStorage
    const storageResult = setJsonInSessionStorage(quoteId, quoteData)
    if (!storageResult.success) {
      console.error('❌ Failed to store in session storage:', storageResult.error)
      setError(storageResult.error || "Failed to save quote data. Please try again.")
      return
    }
    // console.log('✅ Successfully stored in session storage')
    
    try {
      // Open new tab with quote page
      const url = `/quote?id=${quoteId}`
      // console.log('🔗 Opening quote page URL:', url)
      const quoteWindow = window.open(url, '_blank')

      if (!quoteWindow) {
        // console.log('⚠️ Popup blocked, falling back to same-tab navigation')
        // Popup blocked: fallback to same-tab navigation
        window.location.href = url
      } else {
        // console.log('✅ Quote page opened in new tab')
      }
      // The actual calculation will be handled by the quote page using useQuoteResults hook
      // console.log('🚀 calculateQuote - END (success)')

    } catch (error) {
      console.error('❌ Error opening quote page:', error)
      setError(error instanceof Error ? error.message : "Failed to open quote page. Please try again.")
      // console.log('🚀 calculateQuote - END (error)')
    }
  }

  const clearQuotes = () => {
    setError(null)
  }

  return {
    error,
    calculateQuote,
    clearQuotes,
  }
}
