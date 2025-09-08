import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { transformRemoteResponseToQuote } from "@/lib/shared/utils/apiUtils";

export type Provider = 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity';

export type ProviderState = 'inactive' | 'loading-base' | 'loading-enhanced' | 'active' | 'failed' | 'enhancement-failed';

export interface ProviderStatus {
  status: ProviderState;
  hasData: boolean;
  error?: string;
  enhancementError?: string;
}

// Sequential loading queue (legacy). We'll run in parallel mode now.
const SEQUENTIAL_LOADING_QUEUE: Provider[] = ['remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'];
const PARALLEL_MODE = true
const OTHER_PROVIDERS: Provider[] = ['remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity']

interface UseQuoteResultsReturn {
  quoteData: QuoteData | null;
  loading: boolean;
  currentProvider: Provider;
  switchProvider: (provider: Provider) => void;
  refreshQuote: () => void;
  providerLoading: { [K in Provider]: boolean };
  providerStates: { [K in Provider]: ProviderStatus };
  enhancementBatchInfo: {
    currentBatch: number;
    totalBatches: number;
    batchProgress: { completed: number; total: number };
    isProcessing: boolean;
  };
}

type BatchProcessingState = {
  currentBatch: number;
  isProcessing: boolean;
  activeConcurrency: number;
}

type EnhancementQueueItem = {
  provider: Provider;
  quote: unknown;
  formData: EORFormData;
}

export const useQuoteResults = (quoteId: string | null): UseQuoteResultsReturn => {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProvider, setCurrentProvider] = useState<Provider>('deel');

  // Batch processing state for proper re-renders
  const [batchProcessingState, setBatchProcessingState] = useState<BatchProcessingState>({
    currentBatch: 0,
    isProcessing: false,
    activeConcurrency: 0
  });
  
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
  
  // Sequential loading management (legacy base-quote flow)
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

  

  // Legacy enhancement queue controls removed; batched processing is authoritative

  // In-flight guards to prevent duplicate requests per provider
  const baseInFlightRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
  })
  const enhancementInFlightRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
  })
  const enhancementFailedRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
  })

  // Batched Enhancement Queue System - Concurrency Control
  const ENHANCEMENT_BATCHES: Provider[][] = [
    ['deel', 'remote', 'rivermate'],      // Batch 1 - Priority providers
    ['oyster', 'rippling', 'skuad'],      // Batch 2 - Standard providers  
    ['velocity']                          // Batch 3 - Remaining providers
  ]
  const MAX_CONCURRENT_ENHANCEMENTS = 3
  
  const enhancementQueueRef = useRef<EnhancementQueueItem[]>([])
  // Mounted flag for safe async operations/cleanup
  const isMountedRef = useRef<boolean>(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])
  // Track pending timeouts to allow cleanup on unmount
  const pendingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set())

  // Lightweight semaphore to avoid concurrency race conditions
  class Semaphore {
    private available: number
    private queue: Array<() => void>
    constructor(max: number) {
      this.available = Math.max(1, max)
      this.queue = []
    }
    async acquire(): Promise<void> {
      if (this.available > 0) {
        this.available -= 1
        return
      }
      await new Promise<void>(resolve => this.queue.push(resolve))
    }
    release(): void {
      if (this.queue.length > 0) {
        const resolve = this.queue.shift()!
        resolve()
        return
      }
      this.available += 1
    }
  }
  const semaphoreRef = useRef<Semaphore>(new Semaphore(MAX_CONCURRENT_ENHANCEMENTS))

  // Safe sleep helper with cleanup tracking
  const sleep: (ms: number) => Promise<void> = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        pendingTimeoutsRef.current.delete(id)
        resolve()
      }, ms)
      pendingTimeoutsRef.current.add(id)
      if (!isMountedRef.current) {
        clearTimeout(id)
        pendingTimeoutsRef.current.delete(id)
        resolve()
      }
    })
  }, [])

  // Retry logic for enhancement API calls
  const retryEnhancementWithBackoff = useCallback(async (
    provider: Provider, 
    quote: any, 
    formData: EORFormData, 
    maxRetries = 3
  ): Promise<any> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await enhanceQuote(provider as any, quote, formData)
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries
        
        // Check if this is a rate limiting error (429) or timeout
        const isRetryable = 
          error?.status === 429 || 
          error?.status === 503 ||
          error?.status === 504 ||
          error?.message?.toLowerCase().includes('rate limit') ||
          error?.message?.toLowerCase().includes('timeout') ||
          error?.message?.toLowerCase().includes('too many requests')
        
        if (!isRetryable || isLastAttempt) {
          throw error // Re-throw non-retryable errors or final attempt
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const backoffDelay = Math.pow(2, attempt) * 1000
        console.warn(`❌ Enhancement rate limited for ${provider}, retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries + 1})`)
        // Abort early if unmounted; otherwise wait with cleanup tracking
        if (!isMountedRef.current) {
          throw new Error('Component unmounted during retry backoff')
        }
        await sleep(backoffDelay)
      }
    }
  }, [enhanceQuote, sleep])

  // Batched Enhancement Queue Processing

  const processBatchedEnhancementQueue = useCallback(async (): Promise<void> => {
    if (batchProcessingState.isProcessing) return
    
    setBatchProcessingState(prev => ({ ...prev, isProcessing: true }))

    try {
      // Process batches sequentially, items within batch concurrently
      for (let batchIndex = 0; batchIndex < ENHANCEMENT_BATCHES.length; batchIndex++) {
        setBatchProcessingState(prev => ({ ...prev, currentBatch: batchIndex }))
        const currentBatch = ENHANCEMENT_BATCHES[batchIndex]
        
        // Get queue items for this batch
        const batchItems = enhancementQueueRef.current.filter(item => 
          currentBatch.includes(item.provider)
        )
        
        if (batchItems.length === 0) continue

        // Process this batch with concurrency control via semaphore
        const batchPromises = batchItems.map(async (item) => {
          await semaphoreRef.current.acquire()
          
          try {
            // Prevent duplicate requests
            if (enhancementInFlightRef.current[item.provider]) return
            enhancementInFlightRef.current[item.provider] = true
            
            updateProviderState(item.provider, { status: 'loading-enhanced', hasData: true })
            
            const providerQuoteForEnhancement = (item.provider === 'remote' && (item.quote as any)?.employment)
              ? transformRemoteResponseToQuote(item.quote as any)
              : item.quote
            
            const result = await retryEnhancementWithBackoff(item.provider, providerQuoteForEnhancement, item.formData)
            
            if (result) {
              updateProviderState(item.provider, { status: 'active', hasData: true, error: undefined })
            } else {
              updateProviderState(item.provider, { 
                status: 'enhancement-failed', 
                hasData: true, 
                enhancementError: 'Enhanced quote failed' 
              })
            }
          } catch (err) {
            console.error(`❌ Enhancement failed for ${item.provider}:`, err)
            updateProviderState(item.provider, { 
              status: 'enhancement-failed', 
              hasData: true, 
              enhancementError: err instanceof Error ? err.message : 'Enhanced quote failed' 
            })
            enhancementFailedRef.current[item.provider] = true
          } finally {
            enhancementInFlightRef.current[item.provider] = false
            
            // Remove processed item from queue
            const index = enhancementQueueRef.current.findIndex(q => q.provider === item.provider)
            if (index >= 0) {
              enhancementQueueRef.current.splice(index, 1)
            }
            semaphoreRef.current.release()
          }
        })

        // Wait for current batch to complete before starting next batch
        await Promise.allSettled(batchPromises)
        
        // Small delay between batches to prevent API hammering
        if (batchIndex < ENHANCEMENT_BATCHES.length - 1) {
          await sleep(500)
        }
      }
    } finally {
      setBatchProcessingState(prev => ({ ...prev, isProcessing: false, currentBatch: 0 }))
    }
  }, [batchProcessingState.isProcessing, updateProviderState, retryEnhancementWithBackoff, sleep])

  // Enqueue providers for batched enhancement processing
  const addToEnhancementQueue = useCallback((provider: Provider, quote: unknown, formData: EORFormData): void => {
    // Avoid duplicates by provider key
    const existingIndex = enhancementQueueRef.current.findIndex(item => item.provider === provider)
    if (existingIndex >= 0) {
      enhancementQueueRef.current[existingIndex] = { provider, quote, formData }
    } else {
      enhancementQueueRef.current.push({ provider, quote, formData })
    }
    
    // Start processing if not already running
    if (!batchProcessingState.isProcessing) {
      processBatchedEnhancementQueue()
    }
  }, [batchProcessingState.isProcessing, processBatchedEnhancementQueue])

  // Legacy sequential enhancement trigger removed in favor of batched processing

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
          // Enhancement now handled by batched queue system
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

        // Enhancement now handled by batched queue system

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
    
    // Allow switching when provider is enhanced, enhancement is in progress, or enhancement failed (base quote available)
    const providerState = providerStates[newProvider];
    if (providerState.status !== 'active' && providerState.status !== 'loading-enhanced' && providerState.status !== 'enhancement-failed') {
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
        // Guard against overlapping base/dual requests for the same provider
        if (baseInFlightRef.current[newProvider] || providerLoading[newProvider]) return
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
  
  // Effect to process next provider when queue index changes (legacy sequential; inactive in PARALLEL_MODE)
  useEffect(() => {
    if (!PARALLEL_MODE && isSequentialLoadingRef.current && currentQueueIndex >= 0 && currentQueueIndex < SEQUENTIAL_LOADING_QUEUE.length) {
      console.log(`🕰️ Scheduling provider ${currentQueueIndex + 1}/${SEQUENTIAL_LOADING_QUEUE.length} in 2 seconds...`);
      
      // Longer delay to be more API-friendly
      sequentialTimeoutRef.current = setTimeout(() => {
        if (isSequentialLoadingRef.current) { // Double-check flag before processing
          processNextProviderRef.current();
        }
      }, 2000); // Increased from 500ms to 2s
    } else if (!PARALLEL_MODE && currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length && currentQueueIndex > 0) {
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

  // Cleanup any enhancement/batch timers (backoff, inter-batch delays) on unmount
  useEffect(() => {
    return () => {
      if (pendingTimeoutsRef.current.size > 0) {
        for (const id of Array.from(pendingTimeoutsRef.current)) {
          clearTimeout(id)
        }
        pendingTimeoutsRef.current.clear()
      }
    }
  }, [])

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
        console.log('⚡ Quote is in calculating status, starting Deel (then others in parallel)...')
        const form = data.formData as EORFormData

        // Helper to merge provider-specific results safely
        const mergeAndPersist = (calculated: QuoteData) => {
          setQuoteData(prev => {
            const base = prev || data
            const next: QuoteData = {
              ...base,
              // Prefer the calculator's normalized formData
              formData: calculated.formData || base.formData,
              quotes: { ...base.quotes, ...calculated.quotes },
              dualCurrencyQuotes: { ...(base.dualCurrencyQuotes || {}), ...(calculated.dualCurrencyQuotes || {}) },
              metadata: { ...(base.metadata || {}), ...(calculated.metadata || {}) },
              status: calculated.status || base.status,
              error: calculated.error
            }
            if (quoteId) {
              setJsonInSessionStorage(quoteId, next)
            }
            return next
          })
        }

        // Enhancement now handled by batched queue system (see addToEnhancementQueue)

        try {
          // 1) Start Deel first
          if (!hasProviderData('deel', (quoteData || data) as QuoteData)) {
            updateProviderState('deel', { status: 'loading-base' })
          }
          const deelPromise = (async () => {
            try {
              if (baseInFlightRef.current.deel || hasProviderData('deel', (quoteData || data) as QuoteData)) return
              baseInFlightRef.current.deel = true
              console.log('📤 Starting Deel base quote...')
              const deelResult = await calculateDeelQuote(form, (quoteData || data) as QuoteData)
              mergeAndPersist(deelResult)
              // Add Deel to enhancement queue (batched processing)
              addToEnhancementQueue('deel', (deelResult.quotes as any).deel, deelResult.formData as EORFormData)
            } catch (err) {
              console.error('❌ Deel base quote failed:', err)
              updateProviderState('deel', { status: 'failed', error: err instanceof Error ? err.message : 'Failed to calculate Deel quote' })
            } finally {
              baseInFlightRef.current.deel = false
            }
          })()

          // 2) As soon as Deel has started, kick off others in parallel
          OTHER_PROVIDERS.forEach((provider) => {
            if (!hasProviderData(provider, (quoteData || data) as QuoteData)) {
              updateProviderState(provider, { status: 'loading-base' })
            }
            const run = async () => {
              try {
                if (baseInFlightRef.current[provider] || hasProviderData(provider, (quoteData || data) as QuoteData)) return
                baseInFlightRef.current[provider] = true
                const baseData = (quoteData || data) as QuoteData
                let result: QuoteData | undefined
                switch (provider) {
                  case 'remote':
                    result = await calculateRemoteQuote(form, baseData); break
                  case 'rivermate':
                    result = await calculateRivermateQuote(form, baseData); break
                  case 'oyster':
                    result = await calculateOysterQuote(form, baseData); break
                  case 'rippling':
                    result = await calculateRipplingQuote(form, baseData); break
                  case 'skuad':
                    result = await calculateSkuadQuote(form, baseData); break
                  case 'velocity':
                    result = await calculateVelocityQuote(form, baseData); break
                  default:
                    return
                }
                  if (result) {
                    mergeAndPersist(result)
                    // Add provider to enhancement queue (batched processing)
                    addToEnhancementQueue(provider, (result.quotes as any)[provider], result.formData as EORFormData)
                  } else {
                  updateProviderState(provider, { status: 'failed', error: 'No quote data returned' })
                }
              } catch (e: any) {
                console.error(`❌ ${provider} base quote failed:`, e)
                updateProviderState(provider, { status: 'failed', error: e?.message || 'Failed to calculate quote' })
              } finally {
                baseInFlightRef.current[provider] = false
              }
            }
            void run()
          })

          // 3) Unlock UI early: mark overall status as completed to allow tab navigation
          setQuoteData(prev => {
            const base = prev || data
            if (base.status === 'completed') return base
            const next: QuoteData = { ...base, status: 'completed' }
            if (quoteId) setJsonInSessionStorage(quoteId, next)
            return next
          })

          // UI no longer in global loading state
          setLoading(false)

          // Wait for Deel to finish (without blocking UI)
          await deelPromise
        } catch (error) {
          console.error('❌ Error during parallel base/enhancement kickoff:', error)
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

        // In PARALLEL_MODE, kick any missing enhancements immediately in parallel
        if (PARALLEL_MODE) {
          providers.forEach((provider) => {
            const hasBase = hasProviderData(provider, data)
            const hasEnh = !!enhancements[provider]
            const failed = enhancementFailedRef.current[provider]
            if (hasBase && !hasEnh && !failed) {
              // Add to batched enhancement queue instead of firing immediately
              const providerQuote = (data.quotes as any)[provider]
              addToEnhancementQueue(provider, providerQuote, data.formData as EORFormData)
            }
          })
        }

        // Provider base quote loading: legacy sequential path is disabled in PARALLEL_MODE
        
        // Ensure dual-currency quotes are present when currency is manually changed
        try {
          const form = data.formData as EORFormData;
          const needsDual = form.isCurrencyManuallySet && !!form.originalCurrency && form.originalCurrency !== form.currency;

          if (needsDual) {
            if (!data.dualCurrencyQuotes?.deel && !data.dualCurrencyQuotes?.remote) {
              // Default provider is Deel; compute dual-currency if missing
              const updated = await calculateDeelQuote(form, data);
              setQuoteData(prev => ({ ...(prev || data), ...updated, quotes: { ...(prev?.quotes || {}), ...updated.quotes }, dualCurrencyQuotes: { ...(prev?.dualCurrencyQuotes || {}), ...(updated.dualCurrencyQuotes || {}) } }))
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
      
      // Check for missing providers that need sequential processing (disabled in PARALLEL_MODE)
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
      
      if (!PARALLEL_MODE && !hasStartedSequentialRef.current && !isSequentialLoadingRef.current) {
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
        } else if (!PARALLEL_MODE) {
          console.log('❌ Sequential loading conditions not met:', { hasDeelData, missingCount: missingProviders.length });
        }
      } else if (!PARALLEL_MODE) {
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
      const isEnhancing = !!(enhancing as any)[provider];
      const hasEnh = !!(enhancements as any)[provider];
      if (isEnhancing) {
        updateProviderState(provider, { status: 'loading-enhanced', hasData: true, error: undefined });
      } else if (hasEnh) {
        updateProviderState(provider, { status: 'active', hasData: true, error: undefined });
      }
    });
  }, [quoteData, enhancing, enhancements, hasProviderData, updateProviderState]);
  
  // Reset sequential loading flags when quote changes (cleanup)
  useEffect(() => {
    // Reset flags when new quote starts
    console.log('🔄 Resetting sequential flags for new quote:', quoteId);
    hasStartedSequentialRef.current = false;
    isSequentialLoadingRef.current = false;
    enhancementFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false }
    
    return () => {
      // Cleanup on unmount or quote change
      console.log('🧹 Cleaning up sequential loading for quote:', quoteId);
      if (sequentialTimeoutRef.current) {
        clearTimeout(sequentialTimeoutRef.current);
        sequentialTimeoutRef.current = null;
      }
      isSequentialLoadingRef.current = false;
      hasStartedSequentialRef.current = false;
      // Clear in-flight guards and schedulers on cleanup
      baseInFlightRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false }
      enhancementInFlightRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false }
      enhancementFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false }
    };
  }, [quoteId]);

  // Calculate batch progress for reconciliation button
  const enhancementBatchInfo = useMemo(() => {
    const { currentBatch, isProcessing } = batchProcessingState
    const totalBatches = ENHANCEMENT_BATCHES.length
    
    // Calculate progress within current batch
    let completed = 0
    let total = 0
    
    if (isProcessing && currentBatch < ENHANCEMENT_BATCHES.length) {
      const batchProviders = ENHANCEMENT_BATCHES[currentBatch]
      total = batchProviders.length
      
      // Count completed providers in current batch
      completed = batchProviders.filter(provider => {
        const status = providerStates[provider]?.status
        return status === 'active' || status === 'enhancement-failed' || status === 'failed'
      }).length
    } else if (!isProcessing) {
      // When not processing, show overall completion
      const allProviders: Provider[] = ENHANCEMENT_BATCHES.flat()
      total = allProviders.length
      completed = allProviders.filter(provider => {
        const status = providerStates[provider]?.status
        return status === 'active' || status === 'enhancement-failed' || status === 'failed'
      }).length
    }
    
    return {
      currentBatch: currentBatch + 1, // 1-indexed for display
      totalBatches,
      batchProgress: { completed, total },
      isProcessing
    }
  }, [providerStates, batchProcessingState])

  return {
    quoteData,
    loading,
    currentProvider,
    switchProvider,
    refreshQuote,
    providerLoading,
    providerStates,
    enhancementBatchInfo,
  };
};
