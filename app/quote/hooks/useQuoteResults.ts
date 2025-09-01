import { useState, useEffect, useCallback } from "react";
import { QuoteData, EORFormData } from "@/lib/shared/types";
import { getJsonFromSessionStorage, setJsonInSessionStorage } from "@/lib/shared/utils/storageUtils";
import { safeValidateQuoteData, validateQuoteId } from "@/lib/shared/utils/dataValidation";
import { useDeelQuote } from "./useDeelQuote";
import { useRemoteQuote } from "./useRemoteQuote";

export type Provider = 'deel' | 'remote';

interface UseQuoteResultsReturn {
  quoteData: QuoteData | null;
  loading: boolean;
  currentProvider: Provider;
  switchProvider: (provider: Provider) => void;
  refreshQuote: () => void;
  providerLoading: { [K in Provider]: boolean };
}

export const useQuoteResults = (quoteId: string | null): UseQuoteResultsReturn => {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProvider, setCurrentProvider] = useState<Provider>('deel');

  const { loading: deelLoading, error: deelError, calculateDeelQuote } = useDeelQuote();
  const { loading: remoteLoading, error: remoteError, calculateRemoteQuote } = useRemoteQuote();

  const providerLoading = { deel: deelLoading, remote: remoteLoading };

  const switchProvider = useCallback(async (newProvider: Provider) => {
    if (!quoteData || newProvider === currentProvider) {
      return;
    }

    setCurrentProvider(newProvider);

    const hasExistingQuote = (newProvider === 'deel' && quoteData.quotes.deel) || (newProvider === 'remote' && quoteData.quotes.remote);
    const form = quoteData.formData as EORFormData;
    const needsDual = form.isCurrencyManuallySet && !!form.originalCurrency && form.originalCurrency !== form.currency;
    const hasDualForProvider = newProvider === 'deel'
      ? !!quoteData.dualCurrencyQuotes?.deel?.isDualCurrencyMode
      : !!quoteData.dualCurrencyQuotes?.remote?.isDualCurrencyMode;

    if (quoteData.status === 'completed') {
      try {
        let calculatedQuote: QuoteData | undefined;
        if (!hasExistingQuote || (needsDual && !hasDualForProvider)) {
          if (newProvider === 'deel') {
            calculatedQuote = await calculateDeelQuote(form, quoteData);
          } else {
            calculatedQuote = await calculateRemoteQuote(form, quoteData);
          }
          setQuoteData(calculatedQuote);
          if (quoteId) {
            setJsonInSessionStorage(quoteId, calculatedQuote);
          }
        }
      } catch (error) {
        console.error(`Error calculating ${newProvider} quote:`, error);
        setCurrentProvider(currentProvider); // Revert provider switch on error
      }
    }
  }, [quoteData, currentProvider, quoteId, calculateDeelQuote, calculateRemoteQuote]);

  const refreshQuote = useCallback(() => {
    console.log("Refreshing quote...");
  }, []);

  useEffect(() => {
    const processQuote = async () => {
      setLoading(true);

      const idValidation = validateQuoteId(quoteId);
      if (!idValidation.isValid) {
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: idValidation.error || 'Invalid quote ID' });
        setLoading(false);
        return;
      }

      const storageResult = getJsonFromSessionStorage<QuoteData>(quoteId!);
      if (!storageResult.success || !storageResult.data) {
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: storageResult.error || 'Failed to load quote data.' });
        setLoading(false);
        return;
      }

      const validationResult = safeValidateQuoteData(storageResult.data);
      if (!validationResult.isValid || !validationResult.data) {
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: 'Quote data is corrupted or invalid.' });
        setLoading(false);
        return;
      }

      const data = validationResult.data;
      setQuoteData(data);

      if (data.status === 'calculating') {
        try {
          const finalQuoteData = await calculateDeelQuote(data.formData as EORFormData, data);
          setQuoteData(finalQuoteData);
          if (quoteId) {
            setJsonInSessionStorage(quoteId, finalQuoteData);
          }
        } catch (error) {
          console.error('Error calculating initial quote:', error);
          const errorQuoteData: QuoteData = { ...data, status: 'error', error: error instanceof Error ? error.message : 'Failed to calculate quote' };
          setQuoteData(errorQuoteData);
          if (quoteId) {
            setJsonInSessionStorage(quoteId, errorQuoteData);
          }
        }
      } else if (data.status === 'completed') {
        // Ensure dual-currency quotes are present when currency is manually changed
        try {
          const form = data.formData as EORFormData;
          const needsDual = form.isCurrencyManuallySet && !!form.originalCurrency && form.originalCurrency !== form.currency;

          if (needsDual) {
            if (!data.dualCurrencyQuotes?.deel && !data.dualCurrencyQuotes?.remote) {
              // Default provider is Deel; compute dual-currency if missing
              const updated = await calculateDeelQuote(form, data);
              setQuoteData(updated);
              if (quoteId) setJsonInSessionStorage(quoteId, updated);
            }
          }
        } catch (error) {
          console.warn('Optional dual-currency enrichment failed:', error);
        }
      }
      setLoading(false);
    };

    processQuote();
  }, [quoteId, calculateDeelQuote]);

  return {
    quoteData,
    loading,
    currentProvider,
    switchProvider,
    refreshQuote,
    providerLoading,
  };
};
