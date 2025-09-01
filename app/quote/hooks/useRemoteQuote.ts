import { useState, useCallback } from "react";
import { fetchRemoteCost, createQuoteRequestData, ensureFormDefaults, transformRemoteResponseToQuote, transformToRemoteQuote } from "@/lib/shared/utils/apiUtils";
import { RemoteAPIResponse, EORFormData, QuoteData, RemoteQuote } from "@/lib/shared/types";
import { convertCurrency } from "@/lib/currency-converter";

export const useRemoteQuote = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRemoteQuote = useCallback(async (formData: EORFormData, data: QuoteData): Promise<QuoteData> => {
    setLoading(true);
    setError(null);

    try {
      const formDataWithDefaults = ensureFormDefaults(formData);
      const requestData = createQuoteRequestData(formDataWithDefaults);

      const remoteQuoteResponse = await fetchRemoteCost(requestData);
      const remoteQuote = transformToRemoteQuote(remoteQuoteResponse); // For USD conversion
      const remoteDisplayQuote = transformRemoteResponseToQuote(remoteQuoteResponse); // For display

      // If user changed currency, also compute a local currency quote
      let localRemoteQuote: RemoteQuote | null = null;
      let localRemoteQuoteResponse: RemoteAPIResponse | null = null;
      if (formDataWithDefaults.isCurrencyManuallySet && formDataWithDefaults.originalCurrency && formDataWithDefaults.originalCurrency !== formDataWithDefaults.currency) {
        const currentSalary = parseFloat((formDataWithDefaults.baseSalary || '').toString().replace(/[\,\s]/g, ''));
        if (!isNaN(currentSalary) && currentSalary > 0) {
          try {
            const conv = await convertCurrency(currentSalary, formDataWithDefaults.currency, formDataWithDefaults.originalCurrency);
            if (conv.success && conv.data) {
              const localRequest = { ...requestData, salary: conv.data.target_amount.toString(), currency: formDataWithDefaults.originalCurrency };
              localRemoteQuoteResponse = await fetchRemoteCost(localRequest);
              localRemoteQuote = transformToRemoteQuote(localRemoteQuoteResponse);
            }
          } catch (err) {
            console.warn('Dual-currency local quote conversion failed (Remote):', err);
          }
        }
      }

      let comparisonQuote: RemoteQuote | undefined;
      let comparisonQuoteResponse: RemoteAPIResponse | undefined;
      let compareSelectedCurrencyQuote: RemoteQuote | null = null;
      let compareSelectedCurrencyQuoteResponse: RemoteAPIResponse | null = null;
      if (formData.enableComparison && formData.compareCountry) {
        try {
          const compareRequestData = createQuoteRequestData(formDataWithDefaults, true);
          comparisonQuoteResponse = await fetchRemoteCost(compareRequestData);
          comparisonQuote = transformToRemoteQuote(comparisonQuoteResponse);

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
                  compareSelectedCurrencyQuoteResponse = await fetchRemoteCost(compareChangedReq);
                  compareSelectedCurrencyQuote = transformToRemoteQuote(compareSelectedCurrencyQuoteResponse);
                }
              } catch (err) {
                console.warn('Dual-currency comparison changed quote conversion failed (Remote):', err);
              }
            }
          }
        } catch (compareError) {
          console.error('Failed to fetch Remote comparison quote:', compareError);
        }
      }

      const dualCurrencyQuotes = localRemoteQuoteResponse ? {
        ...data.dualCurrencyQuotes,
        remote: {
          selectedCurrencyQuote: remoteDisplayQuote,
          localCurrencyQuote: localRemoteQuoteResponse ? transformRemoteResponseToQuote(localRemoteQuoteResponse) : null,
          compareSelectedCurrencyQuote: compareSelectedCurrencyQuoteResponse ? transformRemoteResponseToQuote(compareSelectedCurrencyQuoteResponse) : null,
          compareLocalCurrencyQuote: comparisonQuoteResponse ? transformRemoteResponseToQuote(comparisonQuoteResponse) : null,
          isCalculatingSelected: false,
          isCalculatingLocal: false,
          isCalculatingCompareSelected: false,
          isCalculatingCompareLocal: false,
          isDualCurrencyMode: true,
          hasComparison: Boolean(comparisonQuoteResponse && compareSelectedCurrencyQuoteResponse),
        }
      } : data.dualCurrencyQuotes;

      return {
        ...data,
        formData: formDataWithDefaults,
        quotes: { ...data.quotes, remote: remoteQuoteResponse, comparisonRemote: comparisonQuoteResponse },
        metadata: { ...data.metadata, currency: remoteQuote.currency },
        dualCurrencyQuotes,
        status: 'completed',
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to calculate Remote quote';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, calculateRemoteQuote };
};
