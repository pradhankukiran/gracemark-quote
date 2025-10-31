import { useState, useCallback } from "react";
import { EORFormData, Quote, QuoteData } from "@/lib/shared/types";
import { ensureFormDefaults, createQuoteRequestData, fetchRipplingCost, transformRipplingResponseToQuote, QuoteRequestData } from "@/lib/shared/utils/apiUtils";
import { convertCurrency } from "@/lib/currency-converter";
import { getCountryByName } from "@/lib/country-data";
import { setRawQuote } from "@/lib/shared/utils/rawQuoteStore";

export const useRipplingQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRipplingQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true);
    setError(null);
    try {
      const withDefaults = ensureFormDefaults(formData);
      const request = createQuoteRequestData(withDefaults);

      let display: Quote | null = null;
      let primaryError: Error | null = null;
      try {
        const response = await fetchRipplingCost(request);
        setRawQuote('rippling', response);
        display = transformRipplingResponseToQuote(response);
        // Patch missing context fields (country, currency) from form
        display.country = withDefaults.country;
        display.country_code = getCountryByName(withDefaults.country)?.code || '';
        display.currency = withDefaults.currency;
      } catch (err) {
        primaryError = err instanceof Error ? err : new Error(String(err));
        console.error('Rippling primary quote failed:', primaryError);
      }

      // Comparison support
      let comparisonQuote: Quote | undefined;
      let compareSelectedCurrencyQuote: Quote | null = null;
      let comparisonError: Error | null = null;
      if (withDefaults.enableComparison && withDefaults.compareCountry) {
        try {
          const compareReq = createQuoteRequestData(withDefaults, true);
          const compResp = await fetchRipplingCost(compareReq);
          setRawQuote('rippling', compResp, 'comparison');
          let compDisplay: Quote = transformRipplingResponseToQuote(compResp);
          compDisplay.country = withDefaults.compareCountry;
          compDisplay.country_code = getCountryByName(withDefaults.compareCountry)?.code || '';
          compDisplay.currency = withDefaults.compareCurrency;
          comparisonQuote = compDisplay;

          // Build comparison quote in the selected (changed) currency as well
          if (
            withDefaults.isCurrencyManuallySet &&
            withDefaults.currency &&
            withDefaults.currency !== withDefaults.compareCurrency &&
            withDefaults.compareSalary && withDefaults.compareCurrency
          ) {
            const compSalary = parseFloat((withDefaults.compareSalary || '').toString().replace(/[\,\s]/g, ''));
            if (!isNaN(compSalary) && compSalary > 0) {
              try {
                const conv = await convertCurrency(
                  compSalary,
                  withDefaults.compareCurrency,
                  withDefaults.currency
                );
                const compareChangedReq = {
                  ...compareReq,
                  salary: conv.success && conv.data ? conv.data.target_amount.toString() : withDefaults.compareSalary,
                  currency: withDefaults.currency,
                } as QuoteRequestData;
                const compSelectedResp = await fetchRipplingCost(compareChangedReq);
                let compSelectedDisplay = transformRipplingResponseToQuote(compSelectedResp);
                compSelectedDisplay.country = withDefaults.compareCountry;
                compSelectedDisplay.country_code = getCountryByName(withDefaults.compareCountry)?.code || '';
                compSelectedDisplay.currency = withDefaults.currency;
                compareSelectedCurrencyQuote = compSelectedDisplay;
              } catch (err) {
                console.warn('Rippling comparison (selected currency) fetch failed', err)
              }
            }
          }
        } catch (e) {
          comparisonError = e instanceof Error ? e : new Error(String(e));
          console.warn('Rippling comparison fetch failed', comparisonError);
        }
      }

      // Dual-currency for primary: compute local currency quote if changed manually
      let localCurrencyQuote: Quote | null = null;
      if (withDefaults.isCurrencyManuallySet && withDefaults.originalCurrency && withDefaults.originalCurrency !== withDefaults.currency) {
        try {
          const base = parseFloat((withDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''))
          const conv = await convertCurrency(base, withDefaults.currency, withDefaults.originalCurrency)
          const localReq = { ...request, currency: withDefaults.originalCurrency, salary: conv.success && conv.data ? conv.data.target_amount.toString() : withDefaults.baseSalary }
          const localResp = await fetchRipplingCost(localReq as QuoteRequestData)
          let localDisplay = transformRipplingResponseToQuote(localResp)
          localDisplay.country = withDefaults.country;
          localDisplay.country_code = getCountryByName(withDefaults.country)?.code || '';
          localDisplay.currency = withDefaults.originalCurrency;
          localCurrencyQuote = localDisplay
        } catch (e) {
          console.warn('Rippling local currency fetch failed', e)
        }
      }

      const dualCurrencyQuotes = localCurrencyQuote && display ? {
        ...data.dualCurrencyQuotes,
        rippling: {
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

      if (!display && !comparisonQuote && !localCurrencyQuote && !(data.dualCurrencyQuotes?.rippling)) {
        const fatalError = primaryError || comparisonError || new Error('Rippling quote unavailable');
        setError(fatalError.message);
        throw fatalError;
      }

      if (comparisonQuote) {
        setError(null);
      } else if (primaryError && !display) {
        setError(primaryError.message);
      } else if (comparisonError && !comparisonQuote) {
        setError(comparisonError.message);
      } else {
        setError(null);
      }

      return {
        ...data,
        formData: withDefaults,
        quotes: {
          ...data.quotes,
          ...(display ? { rippling: display } : {}),
          ...(comparisonQuote ? { comparisonRippling: comparisonQuote } : {}),
        },
        dualCurrencyQuotes,
        status: 'completed',
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to calculate Rippling quote'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, calculateRipplingQuote }
}
