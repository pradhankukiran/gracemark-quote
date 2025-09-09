import { useState, useCallback } from "react";
import { EORFormData, Quote, QuoteData, OysterQuote } from "@/lib/shared/types";
import { ensureFormDefaults, createQuoteRequestData, fetchOysterCost, transformOysterResponseToQuote, transformToOysterQuote } from "@/lib/shared/utils/apiUtils";
import { convertCurrency } from "@/lib/currency-converter";

export const useOysterQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateOysterQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true)
    setError(null)
    try {
      const withDefaults = ensureFormDefaults(formData)
      const request = createQuoteRequestData(withDefaults)
      const response = await fetchOysterCost(request)

      const optimized: OysterQuote = transformToOysterQuote(response)
      const display: Quote = transformOysterResponseToQuote(response)

      // Dual currency handling
      let localCurrencyQuote: Quote | null = null
      let compareSelectedCurrencyQuote: Quote | null = null
      let comparisonQuote: Quote | null = null
      let comparisonOptimized: OysterQuote | null = null

      if (withDefaults.enableComparison && withDefaults.compareCountry) {
        try {
          const compareReq = createQuoteRequestData(withDefaults, true)
          const compResp = await fetchOysterCost(compareReq)
          comparisonOptimized = transformToOysterQuote(compResp)
          comparisonQuote = transformOysterResponseToQuote(compResp)

          // Build comparison quote in the selected (changed) currency as well
          if (
            withDefaults.isCurrencyManuallySet &&
            withDefaults.currency &&
            withDefaults.currency !== withDefaults.compareCurrency &&
            withDefaults.compareSalary && withDefaults.compareCurrency
          ) {
            const compSalary = parseFloat((withDefaults.compareSalary || '').toString().replace(/[\,\s]/g, ''))
            if (!isNaN(compSalary) && compSalary > 0) {
              try {
                const conv = await convertCurrency(
                  compSalary,
                  withDefaults.compareCurrency,
                  withDefaults.currency
                )
                const compareChangedReq = {
                  ...compareReq,
                  salary: conv.success && conv.data ? conv.data.target_amount.toString() : withDefaults.compareSalary,
                  currency: withDefaults.currency,
                } as typeof compareReq
                const compSelectedResp = await fetchOysterCost(compareChangedReq)
                compareSelectedCurrencyQuote = transformOysterResponseToQuote(compSelectedResp)
              } catch (err) {
                console.warn('Oyster comparison (selected currency) fetch failed', err)
              }
            }
          }
        } catch (e) {
          console.warn('Oyster comparison fetch failed', e)
        }
      }

      if (withDefaults.isCurrencyManuallySet && withDefaults.originalCurrency && withDefaults.originalCurrency !== withDefaults.currency) {
        try {
          const base = parseFloat((withDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''))
          const conv = await convertCurrency(base, withDefaults.currency, withDefaults.originalCurrency)
          const localReq = { ...request, currency: withDefaults.originalCurrency, salary: conv.success && conv.data ? conv.data.target_amount.toString() : withDefaults.baseSalary }
          const localResp = await fetchOysterCost(localReq as typeof request)
          localCurrencyQuote = transformOysterResponseToQuote(localResp)
        } catch (e) {
          console.warn('Oyster local currency fetch failed', e)
        }
      }

      const dualCurrencyQuotes = localCurrencyQuote ? {
        ...data.dualCurrencyQuotes,
        oyster: {
          selectedCurrencyQuote: display,
          localCurrencyQuote,
          compareSelectedCurrencyQuote,
          compareLocalCurrencyQuote: comparisonQuote,
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
        quotes: { ...data.quotes, oyster: optimized, comparisonOyster: comparisonOptimized || undefined },
        dualCurrencyQuotes,
        status: 'completed',
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to calculate Oyster quote'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, calculateOysterQuote }
}
