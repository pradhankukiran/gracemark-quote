import { useState, useCallback } from "react";
import { fetchEORCost, createQuoteRequestData, ensureFormDefaults, transformToDeelQuote } from "@/lib/shared/utils/apiUtils";
import { EORFormData, QuoteData, DeelQuote } from "@/lib/shared/types";
import { convertCurrency } from "@/lib/currency-converter";

export const useDeelQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDeelQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true);
    setError(null);

    try {
      const formDataWithDefaults = ensureFormDefaults(formData);
      const requestData = createQuoteRequestData(formDataWithDefaults);
      const rawDeelResponse = await fetchEORCost(requestData);
      const deelQuote = transformToDeelQuote(rawDeelResponse);

      // If user changed currency, also compute a local currency quote
      let localCurrencyQuote: DeelQuote | null = null;
      if (formDataWithDefaults.isCurrencyManuallySet && formDataWithDefaults.originalCurrency && formDataWithDefaults.originalCurrency !== formDataWithDefaults.currency) {
        const currentSalary = parseFloat((formDataWithDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''));
        if (!isNaN(currentSalary) && currentSalary > 0) {
          try {
            const conv = await convertCurrency(currentSalary, formDataWithDefaults.currency, formDataWithDefaults.originalCurrency);
            if (conv.success && conv.data) {
              const localRequest = { ...requestData, salary: conv.data.target_amount.toString(), currency: formDataWithDefaults.originalCurrency };
              const rawLocalResponse = await fetchEORCost(localRequest);
              localCurrencyQuote = transformToDeelQuote(rawLocalResponse);
            }
          } catch (err) {
            console.warn('Dual-currency local quote conversion failed (Deel):', err);
          }
        }
      }

      let comparisonQuote: DeelQuote | undefined;
      let comparisonSelectedCurrencyQuote: DeelQuote | null = null;
      if (formData.enableComparison && formData.compareCountry) {
        try {
          const compareRequestData = createQuoteRequestData(formDataWithDefaults, true);
          const rawComparisonResponse = await fetchEORCost(compareRequestData);
          comparisonQuote = transformToDeelQuote(rawComparisonResponse);

          // Build comparison quote in the selected (changed) currency as well
          if (
            formDataWithDefaults.isCurrencyManuallySet &&
            formDataWithDefaults.currency &&
            formDataWithDefaults.currency !== formDataWithDefaults.compareCurrency &&
            formDataWithDefaults.compareSalary && formDataWithDefaults.compareCurrency
          ) {
            const compSalary = parseFloat(formDataWithDefaults.compareSalary.replace(/[\,\s]/g, ''));
            if (!isNaN(compSalary) && compSalary > 0) {
              try {
                const compConv = await convertCurrency(
                  compSalary,
                  formDataWithDefaults.compareCurrency,
                  formDataWithDefaults.currency
                );
                if (compConv.success && compConv.data) {
                  const compareChangedReq = {
                    ...compareRequestData,
                    salary: compConv.data.target_amount.toString(),
                    currency: formDataWithDefaults.currency,
                  };
                  const rawCompSelectedResponse = await fetchEORCost(compareChangedReq);
                  comparisonSelectedCurrencyQuote = transformToDeelQuote(rawCompSelectedResponse);
                }
              } catch (err) {
                console.warn('Dual-currency comparison changed quote conversion failed (Deel):', err);
              }
            }
          }
        } catch (compareError) {
          console.error('Failed to fetch Deel comparison quote:', compareError);
        }
      }

      const dualCurrencyQuotes = localCurrencyQuote ? {
        ...data.dualCurrencyQuotes,
        deel: {
          selectedCurrencyQuote: deelQuote,
          localCurrencyQuote: localCurrencyQuote,
          compareSelectedCurrencyQuote: comparisonSelectedCurrencyQuote,
          compareLocalCurrencyQuote: comparisonQuote || null,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false,
          isDualCurrencyMode: true,
          hasComparison: Boolean(comparisonQuote && comparisonSelectedCurrencyQuote),
        }
      } : data.dualCurrencyQuotes;

      return {
        ...data,
        formData: formDataWithDefaults,
        quotes: { ...data.quotes, deel: deelQuote, comparisonDeel: comparisonQuote },
        metadata: { ...data.metadata, currency: deelQuote.currency },
        dualCurrencyQuotes,
        status: 'completed',
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to calculate Deel quote';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, calculateDeelQuote };
};
