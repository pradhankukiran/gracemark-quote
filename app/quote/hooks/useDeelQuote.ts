import { useState, useCallback } from "react";
import { fetchEORCost, createQuoteRequestData, ensureFormDefaults, transformToDeelQuote } from "@/lib/shared/utils/apiUtils";
import { EORFormData, QuoteData, DeelQuote } from "@/lib/shared/types";
import { convertCurrency } from "@/lib/currency-converter";
import { setRawQuote } from "@/lib/shared/utils/rawQuoteStore";

export const useDeelQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDeelQuote = useCallback(async (formData: EORFormData, data: QuoteData, options?: { fetchPrimary?: boolean; fetchComparison?: boolean }): Promise<QuoteData> => {
    setLoading(true);
    setError(null);

    try {
      const formDataWithDefaults = ensureFormDefaults(formData);
      const requestData = createQuoteRequestData(formDataWithDefaults);
      const fetchPrimary = options?.fetchPrimary !== false;
      const fetchComparison = options?.fetchComparison !== false;

      let deelQuote: DeelQuote | undefined;
      let primaryError: Error | null = null;
      if (fetchPrimary) {
        try {
          const rawDeelResponse = await fetchEORCost(requestData);
          setRawQuote('deel', rawDeelResponse);
          deelQuote = transformToDeelQuote(rawDeelResponse);
        } catch (err) {
          primaryError = err instanceof Error ? err : new Error(String(err));
          console.error('Failed to fetch Deel primary quote:', primaryError);
        }
      }

      // If user changed currency, also compute a local currency quote
      let localCurrencyQuote: DeelQuote | null = null;
      if (fetchPrimary && formDataWithDefaults.isCurrencyManuallySet && formDataWithDefaults.originalCurrency && formDataWithDefaults.originalCurrency !== formDataWithDefaults.currency) {
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
      let comparisonError: Error | null = null;
      if (fetchComparison && formData.enableComparison && formData.compareCountry) {
        try {
          const compareRequestData = createQuoteRequestData(formDataWithDefaults, true);
          const rawComparisonResponse = await fetchEORCost(compareRequestData);
          setRawQuote('deel', rawComparisonResponse, 'comparison');
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
          comparisonError = compareError instanceof Error ? compareError : new Error(String(compareError));
          console.error('Failed to fetch Deel comparison quote:', comparisonError);
        }
      }

      const prev = data.dualCurrencyQuotes?.deel;

      // Build dual currency state in a coordinated way to prevent intermediate renders
      const hasSelectedQuote = !!(deelQuote || prev?.selectedCurrencyQuote);
      const hasLocalQuote = !!(localCurrencyQuote || prev?.localCurrencyQuote);
      const hasCompareSelectedQuote = !!(comparisonSelectedCurrencyQuote || prev?.compareSelectedCurrencyQuote);
      const hasCompareLocalQuote = !!(comparisonQuote || prev?.compareLocalCurrencyQuote);

      // Only mark as dual currency mode if we have both selected and local quotes
      const isDualCurrencyMode = hasSelectedQuote && hasLocalQuote;
      // Only mark as having comparison if we have both comparison quotes in dual mode
      const hasComparison = isDualCurrencyMode && hasCompareSelectedQuote && hasCompareLocalQuote;

      const mergedDual = {
        selectedCurrencyQuote: deelQuote ?? prev?.selectedCurrencyQuote ?? null,
        localCurrencyQuote: localCurrencyQuote ?? prev?.localCurrencyQuote ?? null,
        compareSelectedCurrencyQuote: comparisonSelectedCurrencyQuote ?? prev?.compareSelectedCurrencyQuote ?? null,
        compareLocalCurrencyQuote: (comparisonQuote || null) ?? prev?.compareLocalCurrencyQuote ?? null,
        isCalculatingSelected: false,
        isCalculatingLocal: false,
        isCalculatingCompareSelected: false,
        isCalculatingCompareLocal: false,
        isDualCurrencyMode,
        hasComparison
      };

      // Only include dual currency quotes if we have meaningful data
      const shouldIncludeDualQuotes = isDualCurrencyMode || hasComparison ||
        mergedDual.selectedCurrencyQuote || mergedDual.localCurrencyQuote ||
        mergedDual.compareSelectedCurrencyQuote || mergedDual.compareLocalCurrencyQuote;

      const dualCurrencyQuotes = shouldIncludeDualQuotes
        ? { ...data.dualCurrencyQuotes, deel: mergedDual }
        : data.dualCurrencyQuotes;

      const updatedQuotes = {
        ...data.quotes,
        ...(deelQuote ? { deel: deelQuote } : {}),
        ...(comparisonQuote ? { comparisonDeel: comparisonQuote } : {}),
      };

      if (!deelQuote && !comparisonQuote && !localCurrencyQuote && !prev) {
        const fatalError = primaryError || comparisonError || new Error('Deel quote unavailable');
        setError(fatalError.message);
        throw fatalError;
      }

      if (comparisonQuote) {
        setError(null);
      } else if (primaryError && !deelQuote) {
        setError(primaryError.message);
      } else if (comparisonError && !comparisonQuote) {
        setError(comparisonError.message);
      } else {
        setError(null);
      }

      return {
        ...data,
        formData: formDataWithDefaults,
        quotes: updatedQuotes,
        metadata: { ...data.metadata, currency: deelQuote?.currency || data.metadata.currency },
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
