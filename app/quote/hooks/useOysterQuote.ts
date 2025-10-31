import { useState, useCallback } from "react";
import { EORFormData, Quote, QuoteData, OysterQuote } from "@/lib/shared/types";
import { ensureFormDefaults, createQuoteRequestData, fetchOysterCost, transformOysterResponseToQuote, transformToOysterQuote } from "@/lib/shared/utils/apiUtils";
import { convertCurrency } from "@/lib/currency-converter";
import { setRawQuote } from "@/lib/shared/utils/rawQuoteStore";

export const useOysterQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateOysterQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true)
    setError(null)
    try {
      const withDefaults = ensureFormDefaults(formData)
      const request = createQuoteRequestData(withDefaults)
      let optimized: OysterQuote | null = null
      let display: Quote | null = null
      let primaryError: Error | null = null
      try {
        const response = await fetchOysterCost(request)
        setRawQuote('oyster', response)
        optimized = transformToOysterQuote(response)
        display = transformOysterResponseToQuote(response)
      } catch (err) {
        primaryError = err instanceof Error ? err : new Error(String(err))
        console.error('Oyster primary quote failed:', primaryError)
      }

      // Dual currency handling
      let localCurrencyQuote: Quote | null = null
      let compareSelectedCurrencyQuote: Quote | null = null
      let comparisonQuote: Quote | null = null
      let comparisonOptimized: OysterQuote | null = null
      let comparisonError: Error | null = null

      if (withDefaults.enableComparison && withDefaults.compareCountry) {
        try {
          const compareReq = createQuoteRequestData(withDefaults, true)
          const compResp = await fetchOysterCost(compareReq)
          setRawQuote('oyster', compResp, 'comparison')
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
          comparisonError = e instanceof Error ? e : new Error(String(e))
          console.warn('Oyster comparison fetch failed', comparisonError)
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

      const dualCurrencyQuotes = localCurrencyQuote && display ? {
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

      if (!optimized && !comparisonOptimized && !localCurrencyQuote && !(data.dualCurrencyQuotes?.oyster)) {
        const fatalError = primaryError || comparisonError || new Error('Oyster quote unavailable')
        setError(fatalError.message)
        throw fatalError
      }

      if (comparisonOptimized) {
        setError(null)
      } else if (primaryError && !optimized) {
        setError(primaryError.message)
      } else if (comparisonError && !comparisonOptimized) {
        setError(comparisonError.message)
      } else {
        setError(null)
      }

      return {
        ...data,
        formData: withDefaults,
        quotes: {
          ...data.quotes,
          ...(optimized ? { oyster: optimized } : {}),
          ...(comparisonOptimized ? { comparisonOyster: comparisonOptimized } : {}),
        },
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
