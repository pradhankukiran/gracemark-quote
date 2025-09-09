import { useState, useCallback } from "react";
import { ensureFormDefaults, createQuoteRequestData, transformToRivermateQuote } from "@/lib/shared/utils/apiUtils";
import { EORFormData, QuoteData, Quote, RivermateQuote } from "@/lib/shared/types";
import { convertCurrency } from "@/lib/currency-converter";
import { transformRivermateResponseToQuote } from "@/lib/shared/utils/apiUtils";

export const useRivermateQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRivermateCost = useCallback(async (requestData: { salary: string; country: string; currency: string; state?: string; }) => {
    const response = await fetch("/api/rivermate-cost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    })
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to fetch Rivermate cost');
    }
    return response.json();
  }, [])

  const calculateRivermateQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true);
    setError(null);
    try {
      const formDataWithDefaults = ensureFormDefaults(formData);
      const requestData = createQuoteRequestData(formDataWithDefaults);

      const primaryResponse = await fetchRivermateCost(requestData);
      const rivermateQuote = transformToRivermateQuote(primaryResponse); // For USD conversion
      const primaryQuote: Quote = transformRivermateResponseToQuote(primaryResponse); // For display

      let comparisonQuote: Quote | undefined;
      let comparisonRivermateQuote: RivermateQuote | undefined;
      let compareSelectedCurrencyQuote: Quote | null = null;
      if (formData.enableComparison && formData.compareCountry) {
        try {
          const compareRequest = createQuoteRequestData(formDataWithDefaults, true);
          const compResp = await fetchRivermateCost(compareRequest);
          const comparisonRivermateQuoteOptimized = transformToRivermateQuote(compResp); // For USD conversion
          comparisonRivermateQuote = comparisonRivermateQuoteOptimized;
          comparisonQuote = transformRivermateResponseToQuote(compResp); // For display

          if (
            formDataWithDefaults.isCurrencyManuallySet &&
            formDataWithDefaults.currency &&
            formDataWithDefaults.currency !== formDataWithDefaults.compareCurrency &&
            formDataWithDefaults.compareSalary && formDataWithDefaults.compareCurrency
          ) {
            const compSalary = parseFloat(formDataWithDefaults.compareSalary.replace(/[\,\s]/g, ''));
            if (!isNaN(compSalary) && compSalary > 0) {
              try {
                const conv = await convertCurrency(compSalary, formDataWithDefaults.compareCurrency, formDataWithDefaults.currency);
                if (conv.success && conv.data) {
                  const compareChangedReq = {
                    ...compareRequest,
                    salary: conv.data.target_amount.toString(),
                    currency: formDataWithDefaults.currency,
                  };
                  const compChangedResp = await fetchRivermateCost(compareChangedReq);
                  compareSelectedCurrencyQuote = transformRivermateResponseToQuote(compChangedResp); // For display
                }
              } catch (err) {
                console.warn('Rivermate compare changed currency conversion failed:', err);
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch Rivermate comparison quote:', err);
        }
      }

      // Dual-currency primary local quote
      let localCurrencyQuote: Quote | null = null;
      if (
        formDataWithDefaults.isCurrencyManuallySet &&
        formDataWithDefaults.originalCurrency &&
        formDataWithDefaults.originalCurrency !== formDataWithDefaults.currency
      ) {
        const currentSalary = parseFloat((formDataWithDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''));
        if (!isNaN(currentSalary) && currentSalary > 0) {
          try {
            const conv = await convertCurrency(currentSalary, formDataWithDefaults.currency, formDataWithDefaults.originalCurrency);
            if (conv.success && conv.data) {
              const localReq = { ...requestData, salary: conv.data.target_amount.toString(), currency: formDataWithDefaults.originalCurrency };
              const localResp = await fetchRivermateCost(localReq);
              localCurrencyQuote = transformRivermateResponseToQuote(localResp); // For display
            }
          } catch (err) {
            console.warn('Rivermate dual-currency local conversion failed:', err);
          }
        }
      }

      const dualCurrencyQuotes = localCurrencyQuote ? {
        ...data.dualCurrencyQuotes,
        rivermate: {
          selectedCurrencyQuote: primaryQuote,
          localCurrencyQuote: localCurrencyQuote,
          compareSelectedCurrencyQuote: compareSelectedCurrencyQuote,
          compareLocalCurrencyQuote: comparisonQuote || null,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false,
          isDualCurrencyMode: true,
          hasComparison: Boolean(comparisonQuote && compareSelectedCurrencyQuote),
        }
      } : data.dualCurrencyQuotes;

      return {
        ...data,
        formData: formDataWithDefaults,
        quotes: { ...data.quotes, rivermate: rivermateQuote, comparisonRivermate: comparisonRivermateQuote },
        metadata: { ...data.metadata, currency: rivermateQuote.currency },
        dualCurrencyQuotes,
        status: 'completed',
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to calculate Rivermate quote';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchRivermateCost])

  return { loading, error, calculateRivermateQuote };
}
