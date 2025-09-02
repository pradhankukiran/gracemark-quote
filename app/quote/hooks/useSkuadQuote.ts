import { useState, useCallback } from "react";
import { EORFormData, Quote, QuoteData } from "@/lib/shared/types";
import { ensureFormDefaults, createQuoteRequestData, fetchSkuadCost, transformSkuadResponseToQuote } from "@/lib/shared/utils/apiUtils";
import { convertCurrency } from "@/lib/currency-converter";

export const useSkuadQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateSkuadQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true)
    setError(null)
    try {
      const withDefaults = ensureFormDefaults(formData)
      const request = createQuoteRequestData(withDefaults)
      const response = await fetchSkuadCost(request)
      const display: Quote = transformSkuadResponseToQuote(response)
      // Fill context
      display.currency = withDefaults.currency
      display.country = withDefaults.country

      let comparisonQuote: Quote | undefined
      let compareSelectedCurrencyQuote: Quote | null = null
      if (withDefaults.enableComparison && withDefaults.compareCountry) {
        try {
          const compareReq = createQuoteRequestData(withDefaults, true)
          const compResp = await fetchSkuadCost(compareReq)
          const compDisplay = transformSkuadResponseToQuote(compResp)
          compDisplay.currency = withDefaults.compareCurrency
          compDisplay.country = withDefaults.compareCountry
          comparisonQuote = compDisplay

          if (
            withDefaults.isCurrencyManuallySet &&
            withDefaults.currency &&
            withDefaults.currency !== withDefaults.compareCurrency &&
            withDefaults.compareSalary && withDefaults.compareCurrency
          ) {
            const compSalary = parseFloat((withDefaults.compareSalary || '').toString().replace(/[\,\s]/g, ''))
            if (!isNaN(compSalary) && compSalary > 0) {
              try {
                const conv = await convertCurrency(compSalary, withDefaults.compareCurrency, withDefaults.currency)
                const compareChangedReq = {
                  ...compareReq,
                  salary: conv.success && conv.data ? conv.data.target_amount.toString() : withDefaults.compareSalary,
                  currency: withDefaults.currency,
                } as any
                const compSelectedResp = await fetchSkuadCost(compareChangedReq)
                const compSelectedDisplay = transformSkuadResponseToQuote(compSelectedResp)
                compSelectedDisplay.currency = withDefaults.currency
                compSelectedDisplay.country = withDefaults.compareCountry
                compareSelectedCurrencyQuote = compSelectedDisplay
              } catch (err) {
                console.warn('Skuad comparison (selected currency) fetch failed', err)
              }
            }
          }
        } catch (e) {
          console.warn('Skuad comparison fetch failed', e)
        }
      }

      // Dual-currency primary local
      let localCurrencyQuote: Quote | null = null
      if (withDefaults.isCurrencyManuallySet && withDefaults.originalCurrency && withDefaults.originalCurrency !== withDefaults.currency) {
        try {
          const base = parseFloat((withDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''))
          const conv = await convertCurrency(base, withDefaults.currency, withDefaults.originalCurrency)
          const localReq = { ...request, currency: withDefaults.originalCurrency, salary: conv.success && conv.data ? conv.data.target_amount.toString() : withDefaults.baseSalary }
          const localResp = await fetchSkuadCost(localReq as any)
          const localDisplay = transformSkuadResponseToQuote(localResp)
          localDisplay.country = withDefaults.country
          localDisplay.currency = withDefaults.originalCurrency
          localCurrencyQuote = localDisplay
        } catch (e) {
          console.warn('Skuad local currency fetch failed', e)
        }
      }

      const dualCurrencyQuotes = localCurrencyQuote ? {
        ...data.dualCurrencyQuotes,
        skuad: {
          selectedCurrencyQuote: display,
          localCurrencyQuote,
          compareSelectedCurrencyQuote,
          compareLocalCurrencyQuote: comparisonQuote || null,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false,
          isDualCurrencyMode: true,
          hasComparison: Boolean(comparisonQuote && compareSelectedCurrencyQuote),
        }
      } : data.dualCurrencyQuotes

      return {
        ...data,
        formData: withDefaults,
        quotes: { ...data.quotes, skuad: display, comparisonSkuad: comparisonQuote },
        dualCurrencyQuotes,
        status: 'completed',
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to calculate Skuad quote'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, calculateSkuadQuote }
}

