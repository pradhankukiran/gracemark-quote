import { useState, useEffect, useCallback, useRef } from "react";
import { QuoteData, EORFormData } from "@/lib/shared/types";
import { getJsonFromSessionStorage, setJsonInSessionStorage } from "@/lib/shared/utils/storageUtils";
import { safeValidateQuoteData, validateQuoteId } from "@/lib/shared/utils/dataValidation";
import { useDeelQuote } from "./useDeelQuote";
import { useRemoteQuote } from "./useRemoteQuote";
import { useRivermateQuote } from "./useRivermateQuote";
import { useOysterQuote } from "./useOysterQuote";
import { useRipplingQuote } from "./useRipplingQuote";
import { useSkuadQuote } from "./useSkuadQuote";
import { useVelocityQuote } from "./useVelocityQuote";
import { useEnhancementContext } from "@/hooks/enhancement/EnhancementContext";

export type Provider = 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity';

export type ProviderState = 'inactive' | 'loading-base' | 'loading-enhanced' | 'active' | 'failed';

export interface ProviderStatus {
  status: ProviderState;
  hasData: boolean;
  error?: string;
}

// Sequential loading queue (Deel loads first by default, others follow)
const SEQUENTIAL_LOADING_QUEUE: Provider[] = ['remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'];

interface UseQuoteResultsReturn {
  quoteData: QuoteData | null;
  loading: boolean;
  currentProvider: Provider;
  switchProvider: (provider: Provider) => void;
  refreshQuote: () => void;
  providerLoading: { [K in Provider]: boolean };
  providerStates: { [K in Provider]: ProviderStatus };
}

export const useQuoteResults = (quoteId: string | null): UseQuoteResultsReturn => {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProvider, setCurrentProvider] = useState<Provider>('deel');
  
  // Provider states for sequential loading
  const [providerStates, setProviderStates] = useState<{ [K in Provider]: ProviderStatus }>({
    deel: { status: 'loading-base', hasData: false },
    remote: { status: 'inactive', hasData: false },
    rivermate: { status: 'inactive', hasData: false },
    oyster: { status: 'inactive', hasData: false },
    rippling: { status: 'inactive', hasData: false },
    skuad: { status: 'inactive', hasData: false },
    velocity: { status: 'inactive', hasData: false },
  });
  
  // Sequential loading management
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const isSequentialLoadingRef = useRef<boolean>(false);
  const sequentialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedSequentialRef = useRef<boolean>(false);

  // Enhancement hook (shared via context) for AI-powered enhanced quotes
  const { enhanceQuote, enhancing, enhancements, errors: enhancementErrors } = useEnhancementContext();
  
  // Helper: update provider state (declare before callbacks)
  const updateProviderState = useCallback((provider: Provider, updates: Partial<ProviderStatus>) => {
    setProviderStates(prev => {
      const current = prev[provider] || { status: 'inactive', hasData: false } as ProviderStatus;
      const next = { ...current, ...updates } as ProviderStatus;
      if (
        current.status === next.status &&
        current.hasData === next.hasData &&
        current.error === next.error
      ) {
        return prev;
      }
      return { ...prev, [provider]: next };
    });
  }, []);

  // Helper: check if provider has base quote (declare before callbacks)
  const hasProviderData = useCallback((provider: Provider, data: QuoteData): boolean => {
    switch (provider) {
      case 'deel': return !!data.quotes.deel;
      case 'remote': return !!data.quotes.remote;
      case 'rivermate': return !!data.quotes.rivermate;
      case 'oyster': return !!data.quotes.oyster;
      case 'rippling': return !!data.quotes.rippling;
      case 'skuad': return !!(data.quotes as any).skuad;
      case 'velocity': return !!(data.quotes as any).velocity;
      default: return false;
    }
  }, []);

  

  // Enhancement sequential queue controls
  const enhancementProcessingRef = useRef<boolean>(false);
  const enhancementRequestedRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
  });
  const ENHANCEMENT_ORDER: Provider[] = ['deel', ...SEQUENTIAL_LOADING_QUEUE];

  const triggerEnhancementSequential = useCallback(async () => {
    if (enhancementProcessingRef.current) return;
    if (!quoteData) return;

    const next = ENHANCEMENT_ORDER.find((p) => {
      const hasBase = hasProviderData(p, quoteData);
      const hasEnh = !!enhancements[p];
      const requested = enhancementRequestedRef.current[p];
      return hasBase && !hasEnh && requested;
    });
    if (!next) return;

    enhancementProcessingRef.current = true;
    try {
      updateProviderState(next, { status: 'loading-enhanced', hasData: true });
      const form = quoteData.formData as EORFormData;
      const providerQuote = quoteData.quotes[next];
      if (providerQuote) {
        const result = await enhanceQuote(next as any, providerQuote, form);
        if (result) {
          updateProviderState(next, { status: 'active', hasData: true, error: undefined });
        } else {
          updateProviderState(next, { status: 'active', hasData: true, error: 'Enhanced quote failed' });
        }
      } else {
        updateProviderState(next, { status: 'active', hasData: true });
      }
    } catch (err) {
      console.error(`❌ Enhancement failed for ${next}:`, err);
      updateProviderState(next, { status: 'active', hasData: true, error: 'Enhanced quote failed' });
    } finally {
      enhancementRequestedRef.current[next] = false;
      enhancementProcessingRef.current = false;
      // Continue with the next queued enhancement
      setTimeout(() => {
        void triggerEnhancementSequential();
      }, 0);
    }
  }, [quoteData, enhancements, updateProviderState, enhanceQuote, hasProviderData]);

  const { loading: deelLoading, error: deelError, calculateDeelQuote } = useDeelQuote();
  const { loading: remoteLoading, error: remoteError, calculateRemoteQuote } = useRemoteQuote();
  const { loading: rivermateLoading, error: rivermateError, calculateRivermateQuote } = useRivermateQuote();
  const { loading: oysterLoading, error: oysterError, calculateOysterQuote } = useOysterQuote();
  const { loading: ripplingLoading, error: ripplingError, calculateRipplingQuote } = useRipplingQuote();
  const { loading: skuadLoading, error: skuadError, calculateSkuadQuote } = useSkuadQuote();
  const { loading: velocityLoading, error: velocityError, calculateVelocityQuote } = useVelocityQuote();

  const providerLoading = { deel: deelLoading, remote: remoteLoading, rivermate: rivermateLoading, oyster: oysterLoading, rippling: ripplingLoading, skuad: skuadLoading, velocity: velocityLoading } as const;

  // Note: Removed serial enhanced queue system - now processing sequentially inline

  // Sequential loading processor
  const processNextProvider = useCallback(async () => {
    console.log('🔧 processNextProvider - START');
    console.log('🔧 Current quoteData state:', {
      hasQuoteData: !!quoteData,
      status: quoteData?.status,
      hasFormData: !!quoteData?.formData,
      formDataType: typeof quoteData?.formData,
      formDataKeys: quoteData?.formData ? Object.keys(quoteData.formData) : 'N/A'
    });
    
    const currentQuoteData = quoteData; // Capture current value to avoid stale closure
    
    if (!currentQuoteData || !isSequentialLoadingRef.current || currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length) {
      if (currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length) {
        console.log('✅ Sequential loading queue completed');
      }
      console.log('🔧 processNextProvider - EXIT (early conditions)');
      return;
    }
    
    console.log('🔧 Full currentQuoteData object:', JSON.stringify(currentQuoteData, null, 2));
    
    // CRITICAL: Validate formData before processing any provider
    const form = currentQuoteData.formData as EORFormData;
    console.log('🔧 Extracted form object:', JSON.stringify(form, null, 2));
    
    const hasValidFormData = form && 
                           form.country && form.country.trim() !== '' &&
                           form.baseSalary && form.baseSalary.trim() !== '' &&
                           form.clientCountry && form.clientCountry.trim() !== '' &&
                           (form.currency && form.currency.trim() !== '');
    
    console.log(`🔍 ProcessNextProvider formData validation:`, {
      hasForm: !!form,
      country: form?.country,
      baseSalary: form?.baseSalary,
      clientCountry: form?.clientCountry,
      currency: form?.currency,
      hasValidFormData,
      formType: typeof form,
      formConstructor: form?.constructor?.name
    });
    
    if (!hasValidFormData) {
      console.error(`❌ CRITICAL: FormData is invalid for provider processing, aborting`);
      console.error(`❌ Invalid formData in processNextProvider:`, JSON.stringify(form, null, 2));
      console.error(`❌ Full currentQuoteData when form invalid:`, JSON.stringify(currentQuoteData, null, 2));
      // Stop sequential loading due to corrupted data
      isSequentialLoadingRef.current = false;
      return;
    }
    
    const nextProvider = SEQUENTIAL_LOADING_QUEUE[currentQueueIndex];
    if (!nextProvider) {
      console.warn(`⚠️ No provider at index ${currentQueueIndex}, moving to next`);
      setCurrentQueueIndex(prev => prev + 1);
      return;
    }
    
    console.log(`🔄 Processing provider ${currentQueueIndex + 1}/${SEQUENTIAL_LOADING_QUEUE.length}: ${nextProvider}`);
    
    try {
      // Update state to loading base quote
      updateProviderState(nextProvider, { status: 'loading-base' });
      
      // Check if we already have data for this provider
      const hasData = hasProviderData(nextProvider, currentQuoteData);
      if (hasData) {
        console.log(`✅ ${nextProvider} already has base data, checking enhanced quote...`);

        // Check if enhanced quote exists
        const hasEnhancement = enhancements[nextProvider];
        if (hasEnhancement) {
          console.log(`✅ ${nextProvider} already has enhanced quote, marking as active`);
          updateProviderState(nextProvider, { status: 'active', hasData: true });
        } else {
          console.log(`🧠 ${nextProvider} has base quote but needs enhancement... (queued sequentially)`);
          updateProviderState(nextProvider, { status: 'loading-enhanced', hasData: true });
          enhancementRequestedRef.current[nextProvider] = true;
          void triggerEnhancementSequential();
        }

        // Move to next provider immediately after scheduling enhancement
        setCurrentQueueIndex(prev => prev + 1);
        return;
      }
      
      console.log(`🔍 Calculating ${nextProvider} base quote...`);
      
      // Calculate quote for this provider
      const form = currentQuoteData.formData as EORFormData;
      
      // DEFENSIVE CHECK: Final validation before API call
      console.log(`🛡️ Final formData check for ${nextProvider}:`, {
        country: form?.country,
        baseSalary: form?.baseSalary,  
        clientCountry: form?.clientCountry,
        currency: form?.currency
      });
      
      // Double-check form data integrity right before API call
      if (!form || !form.country || !form.baseSalary || !form.clientCountry || !form.currency) {
        console.error(`❌ CRITICAL: FormData failed final validation for ${nextProvider}`);
        console.error(`❌ Corrupted form data:`, JSON.stringify(form, null, 2));
        updateProviderState(nextProvider, { 
          status: 'failed', 
          error: `FormData corruption detected for ${nextProvider}. Required fields missing.` 
        });
        setCurrentQueueIndex(prev => prev + 1);
        return;
      }
      
      let calculatedQuote: QuoteData | undefined;
      
      switch (nextProvider) {
        case 'remote':
          console.log('📞 Calling Remote API...');
          try {
            calculatedQuote = await calculateRemoteQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Remote API call failed:`, apiError);
            throw apiError; // Re-throw to be handled by outer try-catch
          }
          break;
        case 'rivermate':
          console.log('📞 Calling Rivermate API...');
          try {
            calculatedQuote = await calculateRivermateQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Rivermate API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'oyster':
          console.log('📞 Calling Oyster API...');
          try {
            calculatedQuote = await calculateOysterQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Oyster API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'rippling':
          console.log('📞 Calling Rippling API...');
          try {
            calculatedQuote = await calculateRipplingQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Rippling API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'skuad':
          console.log('📞 Calling Skuad API...');
          try {
            calculatedQuote = await calculateSkuadQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Skuad API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'velocity':
          console.log('📞 Calling Velocity API...');
          try {
            calculatedQuote = await calculateVelocityQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Velocity API call failed:`, apiError);
            throw apiError;
          }
          break;
        default:
          console.error(`❌ Unknown provider: ${nextProvider}`);
          updateProviderState(nextProvider, { status: 'failed', error: `Unknown provider: ${nextProvider}` });
          setCurrentQueueIndex(prev => prev + 1);
          return;
      }
      
      if (calculatedQuote) {
        console.log(`✅ ${nextProvider} base quote calculated successfully`);
        // Update quote data and save to storage
        setQuoteData(calculatedQuote);
        if (quoteId) {
          setJsonInSessionStorage(quoteId, calculatedQuote);
        }

        // Queue enhanced quote for strict sequential processing
        console.log(`🧠 Queuing enhanced quote for ${nextProvider} (sequential)`);
        updateProviderState(nextProvider, { status: 'loading-enhanced', hasData: true });
        enhancementRequestedRef.current[nextProvider] = true;
        void triggerEnhancementSequential();

        // Move to next provider immediately after scheduling enhancement
        console.log(`➡️ Moving to next provider after ${nextProvider} BASE COMPLETE (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
        setCurrentQueueIndex(prev => prev + 1);
      } else {
        console.warn(`⚠️ ${nextProvider} returned no quote data`);
        // Mark as failed if no quote returned
        updateProviderState(nextProvider, { status: 'failed', error: 'No quote data returned' });
        
        // No base quote, no enhancement possible, move to next provider
        console.log(`➡️ Moving to next provider after ${nextProvider} base quote failure (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
        setCurrentQueueIndex(prev => prev + 1);
      }
      
    } catch (error) {
      console.error(`❌ Error calculating ${nextProvider} quote:`, error);
      
      // Check if it's a rate limit error
      const isRateLimit = error instanceof Error && error.message.toLowerCase().includes('too many requests');
      if (isRateLimit) {
        console.error('🛑 Rate limit detected! Stopping sequential loading.');
        isSequentialLoadingRef.current = false;
        updateProviderState(nextProvider, { 
          status: 'failed', 
          error: 'Rate limit exceeded. Please try again later.' 
        });
        return;
      }
      
      updateProviderState(nextProvider, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Failed to calculate quote' 
      });
      
      // Base quote failed, no enhancement possible, move to next provider
      console.log(`➡️ Moving to next provider after ${nextProvider} base quote error (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
      setCurrentQueueIndex(prev => prev + 1);
    }
  }, [currentQueueIndex, updateProviderState, hasProviderData, quoteId, quoteData,
      calculateRemoteQuote, calculateRivermateQuote, calculateOysterQuote, 
      calculateRipplingQuote, calculateSkuadQuote, calculateVelocityQuote, enhanceQuote]);

  // Keep a stable ref to the latest processor to avoid effect rescheduling stalls
  const processNextProviderRef = useRef(processNextProvider);
  useEffect(() => {
    processNextProviderRef.current = processNextProvider;
  }, [processNextProvider]);
  
  // Start sequential loading process
  const startSequentialLoading = useCallback(() => {
    if (!quoteData || quoteData.status !== 'completed') {
      console.log('⚠️ Cannot start sequential loading: quoteData not ready');
      return;
    }
    
    // Prevent multiple sequential loading processes
    if (isSequentialLoadingRef.current) {
      console.log('🚧 Sequential loading already in progress, skipping');
      return;
    }
    
    // Additional safety check
    if (hasStartedSequentialRef.current) {
      console.log('🚧 Sequential loading already started once, skipping');
      return;
    }
    
    console.log('🚀 Starting sequential provider loading...');
    console.log('📋 Queue:', SEQUENTIAL_LOADING_QUEUE);
    
    isSequentialLoadingRef.current = true;
    setCurrentQueueIndex(0);
  }, [quoteData]);

  const switchProvider = useCallback(async (newProvider: Provider) => {
    if (!quoteData || newProvider === currentProvider) {
      return;
    }
    
    // Allow switching when provider is enhanced or enhancement is in progress
    const providerState = providerStates[newProvider];
    if (providerState.status !== 'active' && providerState.status !== 'loading-enhanced') {
      console.warn(`Cannot switch to ${newProvider}: provider is ${providerState.status}`);
      return;
    }

    setCurrentProvider(newProvider);

    const hasExistingQuote = hasProviderData(newProvider, quoteData);
    const form = quoteData.formData as EORFormData;
    const needsDual = form.isCurrencyManuallySet && !!form.originalCurrency && form.originalCurrency !== form.currency;
    const hasDualForProvider = newProvider === 'deel'
      ? !!quoteData.dualCurrencyQuotes?.deel?.isDualCurrencyMode
      : newProvider === 'remote'
        ? !!quoteData.dualCurrencyQuotes?.remote?.isDualCurrencyMode
        : newProvider === 'rivermate'
          ? !!quoteData.dualCurrencyQuotes?.rivermate?.isDualCurrencyMode
          : newProvider === 'oyster'
            ? !!quoteData.dualCurrencyQuotes?.oyster?.isDualCurrencyMode
            : newProvider === 'rippling'
              ? !!quoteData.dualCurrencyQuotes?.rippling?.isDualCurrencyMode
              : newProvider === 'skuad'
                ? !!(quoteData.dualCurrencyQuotes as any)?.skuad?.isDualCurrencyMode
                : !!(quoteData.dualCurrencyQuotes as any)?.velocity?.isDualCurrencyMode;

    // If provider is active but missing dual currency data, calculate it
    if (quoteData.status === 'completed' && needsDual && !hasDualForProvider) {
      try {
        let calculatedQuote: QuoteData | undefined;
        if (newProvider === 'deel') {
          calculatedQuote = await calculateDeelQuote(form, quoteData);
        } else if (newProvider === 'remote') {
          calculatedQuote = await calculateRemoteQuote(form, quoteData);
        } else if (newProvider === 'rivermate') {
          calculatedQuote = await calculateRivermateQuote(form, quoteData);
        } else if (newProvider === 'oyster') {
          calculatedQuote = await calculateOysterQuote(form, quoteData);
        } else if (newProvider === 'rippling') {
          calculatedQuote = await calculateRipplingQuote(form, quoteData);
        } else if (newProvider === 'skuad') {
          calculatedQuote = await calculateSkuadQuote(form, quoteData);
        } else if (newProvider === 'velocity') {
          calculatedQuote = await calculateVelocityQuote(form, quoteData);
        }
        if (calculatedQuote) {
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
  }, [quoteData, currentProvider, providerStates, quoteId, hasProviderData,
      calculateDeelQuote, calculateRemoteQuote, calculateRivermateQuote, 
      calculateOysterQuote, calculateRipplingQuote, calculateSkuadQuote, calculateVelocityQuote]);

  const refreshQuote = useCallback(() => {
    console.log("Refreshing quote...");
  }, []);
  
  // Effect to process next provider when queue index changes
  useEffect(() => {
    if (isSequentialLoadingRef.current && currentQueueIndex >= 0 && currentQueueIndex < SEQUENTIAL_LOADING_QUEUE.length) {
      console.log(`🕰️ Scheduling provider ${currentQueueIndex + 1}/${SEQUENTIAL_LOADING_QUEUE.length} in 2 seconds...`);
      
      // Longer delay to be more API-friendly
      sequentialTimeoutRef.current = setTimeout(() => {
        if (isSequentialLoadingRef.current) { // Double-check flag before processing
          processNextProviderRef.current();
        }
      }, 2000); // Increased from 500ms to 2s
    } else if (currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length && currentQueueIndex > 0) {
      // Sequential loading complete
      isSequentialLoadingRef.current = false;
      console.log('🎉 Sequential loading completed - all providers processed!');
    }
    
    return () => {
      if (sequentialTimeoutRef.current) {
        clearTimeout(sequentialTimeoutRef.current);
        sequentialTimeoutRef.current = null;
      }
    };
  }, [currentQueueIndex]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any running timeouts and stop sequential loading on unmount
      if (sequentialTimeoutRef.current) {
        clearTimeout(sequentialTimeoutRef.current);
      }
      isSequentialLoadingRef.current = false;
    };
  }, []);

  useEffect(() => {
    const processQuote = async () => {
      console.log('🏁 useQuoteResults processQuote - START')
      console.log('🆔 Quote ID:', quoteId)
      setLoading(true);

      const idValidation = validateQuoteId(quoteId);
      if (!idValidation.isValid) {
        console.error('❌ Invalid quote ID:', idValidation.error)
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: idValidation.error || 'Invalid quote ID' });
        setLoading(false);
        return;
      }

      console.log('📂 Loading from session storage...')
      const storageResult = getJsonFromSessionStorage<QuoteData>(quoteId!);
      if (!storageResult.success || !storageResult.data) {
        console.error('❌ Failed to load from session storage:', storageResult.error)
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: storageResult.error || 'Failed to load quote data.' });
        setLoading(false);
        return;
      }

      console.log('📦 Raw data loaded from session storage:', JSON.stringify(storageResult.data, null, 2))
      console.log('🔍 FormData from session storage:', JSON.stringify(storageResult.data.formData, null, 2))

      const validationResult = safeValidateQuoteData(storageResult.data);
      if (!validationResult.isValid || !validationResult.data) {
        console.error('❌ Quote data validation failed:', validationResult.error)
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: 'Quote data is corrupted or invalid.' });
        setLoading(false);
        return;
      }

      const data = validationResult.data;
      console.log('✅ Validated quote data:', {
        status: data.status,
        hasFormData: !!data.formData,
        formDataKeys: data.formData ? Object.keys(data.formData) : []
      })
      console.log('🔍 Key formData fields after validation:', {
        country: data.formData?.country,
        baseSalary: data.formData?.baseSalary,
        currency: data.formData?.currency,
        clientCountry: data.formData?.clientCountry
      })
      setQuoteData(data);

      if (data.status === 'calculating') {
        console.log('⚡ Quote is in calculating status, starting Deel quote calculation...')
        console.log('📤 FormData being passed to calculateDeelQuote:', JSON.stringify(data.formData, null, 2))
        try {
          const finalQuoteData = await calculateDeelQuote(data.formData as EORFormData, data);
          console.log('✅ Deel quote calculation completed successfully')
          setQuoteData(finalQuoteData);
          if (quoteId) {
            setJsonInSessionStorage(quoteId, finalQuoteData);
          }
          
          // Process Deel enhancement in background immediately after base quote
          console.log('🧠 Queuing Deel enhanced quote (sequential)...');
          updateProviderState('deel', { hasData: true, status: 'loading-enhanced' });
          enhancementRequestedRef.current.deel = true;
          void triggerEnhancementSequential();
          
        } catch (error) {
          console.error('❌ Error calculating initial Deel quote:', error);
          console.error('❌ FormData that failed:', JSON.stringify(data.formData, null, 2))
          const errorQuoteData: QuoteData = { ...data, status: 'error', error: error instanceof Error ? error.message : 'Failed to calculate quote' };
          setQuoteData(errorQuoteData);
          if (quoteId) {
            setJsonInSessionStorage(quoteId, errorQuoteData);
          }
          // Mark Deel as failed
          updateProviderState('deel', { status: 'failed', error: error instanceof Error ? error.message : 'Failed to calculate quote' });
        }
      } else if (data.status === 'completed') {
        // Update provider states: active when both base and enhanced; loading-enhanced when base only
        const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'];
        providers.forEach(provider => {
          const hasBase = hasProviderData(provider, data);
          const hasEnh = !!enhancements[provider];
          const status: ProviderState = (hasBase && hasEnh)
            ? 'active'
            : (hasBase ? 'loading-enhanced' : 'inactive');
          updateProviderState(provider, { status, hasData: hasBase });
        });

        // Queue enhancements sequentially for any provider with base but no enhancement yet
        providers.forEach(provider => {
          const hasBase = hasProviderData(provider, data)
          const hasEnh = !!enhancements[provider]
          if (hasBase && !hasEnh) {
            enhancementRequestedRef.current[provider] = true
          }
        })
        // Start the enhancement queue
        triggerEnhancementSequential()

        // Note: Deel enhancement will be handled by sequential processing

        // Sequential loading will be handled by separate useEffect to prevent circular dependencies
        
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
      console.log('🏁 useQuoteResults processQuote - END')
    };

    processQuote();
  }, [quoteId, calculateDeelQuote, updateProviderState, hasProviderData, enhancements]);
  
  // Separate useEffect for sequential loading trigger (prevents circular dependency)
  useEffect(() => {
    console.log('🔍 Sequential trigger check:', {
      status: quoteData?.status,
      hasStarted: hasStartedSequentialRef.current,
      isLoading: isSequentialLoadingRef.current,
      quoteId
    });
    
    if (quoteData?.status === 'completed') {
      // CRITICAL: Validate formData integrity before starting sequential loading
      const formData = quoteData.formData as EORFormData;
      const hasValidFormData = formData && 
                               formData.country && formData.country.trim() !== '' &&
                               formData.baseSalary && formData.baseSalary.trim() !== '' &&
                               formData.clientCountry && formData.clientCountry.trim() !== '' &&
                               (formData.currency && formData.currency.trim() !== '');
      
      console.log('🔍 FormData validation:', {
        hasFormData: !!formData,
        country: formData?.country,
        baseSalary: formData?.baseSalary,
        clientCountry: formData?.clientCountry,
        currency: formData?.currency,
        hasValidFormData
      });
      
      if (!hasValidFormData) {
        console.error('❌ CRITICAL: FormData is invalid/incomplete, aborting sequential loading');
        console.error('❌ Invalid formData:', JSON.stringify(formData, null, 2));
        return;
      }
      
      // Check for missing providers that need sequential processing
      const hasDeelData = !!quoteData.quotes?.deel; // Deel triggers sequential processing
      const missingProviders = SEQUENTIAL_LOADING_QUEUE.filter(provider => {
        switch (provider) {
          case 'remote': return !quoteData.quotes?.remote;
          case 'rivermate': return !quoteData.quotes?.rivermate;
          case 'oyster': return !quoteData.quotes?.oyster;
          case 'rippling': return !quoteData.quotes?.rippling;
          case 'skuad': return !(quoteData.quotes as any)?.skuad;
          case 'velocity': return !(quoteData.quotes as any)?.velocity;
          default: return true;
        }
      });
      
      console.log('🔍 Sequential conditions:', {
        hasDeelData,
        missingCount: missingProviders.length,
        missingProviders,
        allQuotes: Object.keys(quoteData.quotes || {}),
        enhancementCount: Object.keys(enhancements || {}).length
      });
      
      if (!hasStartedSequentialRef.current && !isSequentialLoadingRef.current) {
        if (hasDeelData && missingProviders.length > 0) {
          console.log(`🚀 TRIGGERING sequential loading for ${missingProviders.length} providers: ${missingProviders.join(', ')}`);
          hasStartedSequentialRef.current = true;
          
          // Longer delay to ensure formData is completely stable
          setTimeout(() => {
            console.log('⏰ Sequential loading timeout triggered');
            console.log('⏰ QuoteData state during timeout:', {
              hasQuoteData: !!quoteData,
              status: quoteData?.status,
              hasFormData: !!quoteData?.formData,
              formDataType: typeof quoteData?.formData
            });
            
            // Double-check formData is still valid before starting
            const currentData = quoteData;
            console.log('⏰ CurrentData during timeout:', JSON.stringify(currentData, null, 2));
            
            const currentFormData = currentData?.formData as EORFormData;
            console.log('⏰ CurrentFormData during timeout:', JSON.stringify(currentFormData, null, 2));
            
            const isStillValid = currentFormData && 
                                currentFormData.country && currentFormData.country.trim() !== '' &&
                                currentFormData.baseSalary && currentFormData.baseSalary.trim() !== '' &&
                                currentFormData.clientCountry && currentFormData.clientCountry.trim() !== '';
            
            console.log('⏰ FormData validity check during timeout:', {
              hasCurrentFormData: !!currentFormData,
              country: currentFormData?.country,
              baseSalary: currentFormData?.baseSalary,
              clientCountry: currentFormData?.clientCountry,
              isStillValid
            });
            
            if (!isStillValid) {
              console.error('❌ FormData became invalid during delay, aborting sequential loading');
              console.error('❌ Invalid formData during timeout:', JSON.stringify(currentFormData, null, 2));
              hasStartedSequentialRef.current = false;
              return;
            }
            
            if (!isSequentialLoadingRef.current) {
              console.log('🎯 Starting sequential loading process...');
              isSequentialLoadingRef.current = true;
              setCurrentQueueIndex(0);
            } else {
              console.log('⚠️ Sequential loading already in progress, skipping');
            }
          }, 2500); // Increased delay to ensure stability
        } else {
          console.log('❌ Sequential loading conditions not met:', { hasDeelData, missingCount: missingProviders.length });
        }
      } else {
        console.log('❌ Sequential loading already started or in progress:', {
          hasStarted: hasStartedSequentialRef.current,
          isLoading: isSequentialLoadingRef.current
        });
      }
    } else {
      console.log('❌ Quote not completed yet:', quoteData?.status);
    }
  }, [quoteData?.status, quoteId]); // FIXED: Removed aggressive Object.keys dependency
  
  // Debug logging for provider states (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🗺️ Provider states updated:', Object.entries(providerStates).map(([provider, state]) => `${provider}: ${state?.status || 'unknown'}`).join(', '));
    }
  }, [providerStates]);

  // Sync provider states with enhancement progress/results to keep indicators accurate
  useEffect(() => {
    if (!quoteData) return;
    const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'];
    providers.forEach(provider => {
      const hasBase = hasProviderData(provider, quoteData);
      if (!hasBase) return;
      const hasEnh = !!(enhancements as any)[provider];
      if (hasEnh) {
        updateProviderState(provider, { status: 'active', hasData: true, error: undefined });
      }
    });
  }, [quoteData, enhancements, hasProviderData, updateProviderState]);
  
  // Reset sequential loading flags when quote changes (cleanup)
  useEffect(() => {
    // Reset flags when new quote starts
    console.log('🔄 Resetting sequential flags for new quote:', quoteId);
    hasStartedSequentialRef.current = false;
    isSequentialLoadingRef.current = false;
    
    return () => {
      // Cleanup on unmount or quote change
      console.log('🧹 Cleaning up sequential loading for quote:', quoteId);
      if (sequentialTimeoutRef.current) {
        clearTimeout(sequentialTimeoutRef.current);
        sequentialTimeoutRef.current = null;
      }
      isSequentialLoadingRef.current = false;
      hasStartedSequentialRef.current = false;
    };
  }, [quoteId]);

  return {
    quoteData,
    loading,
    currentProvider,
    switchProvider,
    refreshQuote,
    providerLoading,
    providerStates,
  };
};
