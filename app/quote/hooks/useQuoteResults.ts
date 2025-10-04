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
import { usePlayrollQuote } from "./usePlayrollQuote";
import { useOmnipresentQuote } from "./useOmnipresentQuote";
import { useEnhancementContext } from "@/hooks/enhancement/EnhancementContext";
import { transformRemoteResponseToQuote } from "@/lib/shared/utils/apiUtils";
import { clearRawQuotes } from "@/lib/shared/utils/rawQuoteStore";
import { isRemoteAPIResponse, validateQuoteWithDebugging, isValidQuote, normalizeQuoteForEnhancement, isValidNormalizedQuote } from "@/lib/shared/utils/quoteNormalizer";

export type Provider = 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity' | 'playroll' | 'omnipresent';

export type ProviderState = 'inactive' | 'loading-base' | 'loading-enhanced' | 'active' | 'failed' | 'enhancement-failed';

export interface ProviderStatus {
  status: ProviderState;
  hasData: boolean;
  error?: string;
  enhancementError?: string;
}

// Sequential loading queue (legacy). We'll run in parallel mode now.
const SEQUENTIAL_LOADING_QUEUE: Provider[] = ['remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent'];
const PARALLEL_MODE = true
const OTHER_PROVIDERS: Provider[] = ['remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent']

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
  // Comparison readiness helpers
  isComparisonReady: (provider: Provider, data: QuoteData) => boolean;
  isDualCurrencyComparisonReady: (provider: Provider, data: QuoteData) => boolean;
  hasComparisonData: (provider: Provider, data: QuoteData) => boolean;
  hasDualCurrencyData: (provider: Provider, data: QuoteData) => boolean;
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
    playroll: { status: 'inactive', hasData: false },
    omnipresent: { status: 'inactive', hasData: false },
  });
  
  // Sequential loading management (legacy base-quote flow)
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const isSequentialLoadingRef = useRef<boolean>(false);
  const sequentialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedSequentialRef = useRef<boolean>(false);

  // Enhancement hook (shared via context) for AI-powered enhanced quotes
  const { enhanceQuote, enhancing, enhancements, errors } = useEnhancementContext();
  
  // Helper: flexible provider-aware validation (handles different API formats)
  const isValidProviderQuote = useCallback((provider: Provider, quote: unknown): boolean => {
    if (!quote || typeof quote !== 'object') {
      return false;
    }

    // Provider-specific validation based on known API response formats
    switch (provider) {
      case 'remote':
        // Remote can return RemoteAPIResponse, DisplayQuote, or RemoteQuote formats
        return !!(
          // RemoteAPIResponse format
          (quote as any)?.employment?.employer_currency_costs?.monthly_total ||
          // RemoteQuote format  
          (typeof (quote as any)?.total === 'number' && typeof (quote as any)?.salary === 'number') ||
          // DisplayQuote format
          ((quote as any)?.total_costs && (quote as any)?.salary)
        );
        
      case 'rivermate':
        // RivermateQuote or DisplayQuote formats
        return !!(
          // RivermateQuote format
          (Array.isArray((quote as any)?.taxItems) && typeof (quote as any)?.total === 'number') ||
          // DisplayQuote format
          ((quote as any)?.total_costs && (quote as any)?.salary)
        );
        
      case 'oyster':
        // OysterQuote or DisplayQuote formats  
        return !!(
          // OysterQuote format
          (Array.isArray((quote as any)?.contributions) && typeof (quote as any)?.total === 'number') ||
          // DisplayQuote format
          ((quote as any)?.total_costs && (quote as any)?.salary)
        );
        
      case 'deel':
      case 'rippling':
      case 'skuad':
      case 'velocity':
      case 'playroll':
      case 'omnipresent':
        // These typically return DisplayQuote format
        return !!(
          (quote as any)?.salary && 
          (quote as any)?.currency && 
          ((quote as any)?.total_costs || (quote as any)?.total)
        );
        
      default:
        // Fallback: basic object structure check
        return Object.keys(quote).length > 0;
    }
  }, []);

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
      
      // Enhanced logging for state transitions
      // console.log(`🔄 ${provider} state: ${current.status} → ${next.status}${next.error ? ` (${next.error})` : ''}`, {
      //   hasData: next.hasData,
      //   enhancementError: next.enhancementError
      // });
      
      return { ...prev, [provider]: next };
    });
  }, []);

  // Helper: check if provider has VALID base quote (flexible validation for different API formats)
  const hasProviderData = useCallback((provider: Provider, data: QuoteData): boolean => {
    let providerQuote: unknown;

    switch (provider) {
      case 'deel': providerQuote = data.quotes.deel; break;
      case 'remote': providerQuote = data.quotes.remote; break;
      case 'rivermate': providerQuote = data.quotes.rivermate; break;
      case 'oyster': providerQuote = data.quotes.oyster; break;
      case 'rippling': providerQuote = data.quotes.rippling; break;
      case 'skuad': providerQuote = data.quotes.skuad; break;
      case 'velocity': providerQuote = data.quotes.velocity; break;
      case 'playroll': providerQuote = data.quotes.playroll; break;
      case 'omnipresent': providerQuote = data.quotes.omnipresent; break;
      default: return false;
    }

    // First check: does quote data exist at all?
    if (!providerQuote) {
      return false;
    }

    // Second check: is the quote structure valid for this provider? (flexible validation)
    const isValid = isValidProviderQuote(provider, providerQuote);
    if (!isValid) {
      console.warn(`❌ ${provider} quote structure invalid:`, {
        quote: providerQuote,
        keys: typeof providerQuote === 'object' ? Object.keys(providerQuote) : 'N/A'
      });
      return false;
    }

    // console.log(`✅ ${provider} has valid base quote data`);
    return true;
  }, [isValidProviderQuote]);

  // Helper: check if provider has VALID comparison quote data
  const hasComparisonData = useCallback((provider: Provider, data: QuoteData): boolean => {
    let comparisonQuote: unknown;

    switch (provider) {
      case 'deel': comparisonQuote = data.quotes.comparisonDeel; break;
      case 'remote': comparisonQuote = data.quotes.comparisonRemote; break;
      case 'rivermate': comparisonQuote = data.quotes.comparisonRivermate; break;
      case 'oyster': comparisonQuote = data.quotes.comparisonOyster; break;
      case 'rippling': comparisonQuote = data.quotes.comparisonRippling; break;
      case 'skuad': comparisonQuote = data.quotes.comparisonSkuad; break;
      case 'velocity': comparisonQuote = data.quotes.comparisonVelocity; break;
      case 'playroll': comparisonQuote = data.quotes.comparisonPlayroll; break;
      case 'omnipresent': comparisonQuote = data.quotes.comparisonOmnipresent; break;
      default: return false;
    }

    if (!comparisonQuote) {
      return false;
    }

    return isValidProviderQuote(provider, comparisonQuote);
  }, [isValidProviderQuote]);

  // Helper: check if provider has complete dual currency quotes
  const hasDualCurrencyData = useCallback((provider: Provider, data: QuoteData): boolean => {
    const dualQuotes = data.dualCurrencyQuotes;
    if (!dualQuotes) return false;

    let providerDual: any;
    switch (provider) {
      case 'deel': providerDual = dualQuotes.deel; break;
      case 'remote': providerDual = dualQuotes.remote; break;
      case 'rivermate': providerDual = dualQuotes.rivermate; break;
      case 'oyster': providerDual = dualQuotes.oyster; break;
      case 'rippling': providerDual = dualQuotes.rippling; break;
      case 'skuad': providerDual = dualQuotes.skuad; break;
      case 'velocity': providerDual = dualQuotes.velocity; break;
      case 'playroll': providerDual = dualQuotes.playroll; break;
      case 'omnipresent': providerDual = dualQuotes.omnipresent; break;
      default: return false;
    }

    if (!providerDual) return false;

    // Check if dual currency mode has complete data
    if (providerDual.isDualCurrencyMode) {
      return !!(providerDual.selectedCurrencyQuote && providerDual.localCurrencyQuote);
    }

    return false;
  }, []);

  // Helper: check if comparison mode is ready for a provider
  const isComparisonReady = useCallback((provider: Provider, data: QuoteData): boolean => {
    const form = data.formData as EORFormData;
    if (!form?.enableComparison) return true; // Not in comparison mode, so always ready

    const hasBase = hasProviderData(provider, data);
    const hasComparison = hasComparisonData(provider, data);
    const isBaseInFlight = baseInFlightRef.current[provider];
    const isCompareInFlight = compareInFlightRef.current[provider];

    // Debug logging for comparison readiness
    const isReady = hasBase && hasComparison && !isBaseInFlight && !isCompareInFlight;
    

    return isReady;
  }, [hasProviderData, hasComparisonData]);

  // Helper: check if dual currency comparison mode is ready for a provider
  const isDualCurrencyComparisonReady = useCallback((provider: Provider, data: QuoteData): boolean => {
    const form = data.formData as EORFormData;
    const needsDual = form.isCurrencyManuallySet && !!form.originalCurrency && form.originalCurrency !== form.currency;

    if (!needsDual) return true; // Not in dual currency mode, so always ready
    if (!form?.enableComparison) return hasDualCurrencyData(provider, data); // Dual but not comparison

    // Need both dual currency AND comparison data
    const dualQuotes = data.dualCurrencyQuotes;
    let providerDual: any;
    switch (provider) {
      case 'deel': providerDual = dualQuotes?.deel; break;
      case 'remote': providerDual = dualQuotes?.remote; break;
      case 'rivermate': providerDual = dualQuotes?.rivermate; break;
      case 'oyster': providerDual = dualQuotes?.oyster; break;
      case 'rippling': providerDual = dualQuotes?.rippling; break;
      case 'skuad': providerDual = dualQuotes?.skuad; break;
      case 'velocity': providerDual = dualQuotes?.velocity; break;
      case 'playroll': providerDual = dualQuotes?.playroll; break;
      case 'omnipresent': providerDual = dualQuotes?.omnipresent; break;
      default: return false;
    }

    if (!providerDual) return false;

    // Check if we have complete dual currency comparison data
    const hasSelectedAndLocal = !!(providerDual.selectedCurrencyQuote && providerDual.localCurrencyQuote);
    const hasComparisonData = !!(providerDual.compareSelectedCurrencyQuote && providerDual.compareLocalCurrencyQuote);
    const isDualMode = providerDual.isDualCurrencyMode;
    const hasComparison = providerDual.hasComparison;

    // Debug logging for dual currency comparison readiness
    const isReady = isDualMode && hasComparison && hasSelectedAndLocal && hasComparisonData;
    

    return isReady;
  }, [hasDualCurrencyData]);

  

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
    playroll: false,
    omnipresent: false,
  })
  const MAX_BACKGROUND_BASE_CONCURRENCY = 8
  const backgroundQueueRef = useRef<Provider[]>([])
  const backgroundActiveCountRef = useRef(0)
  const enhancementInFlightRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  // Track if a provider has been enqueued for enhancement to prevent re-enqueue storms
  const enhancementEnqueuedRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  const enhancementFailedRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  // Track comparison base fetch in-flight per provider to avoid premature 'inactive' state
  const compareInFlightRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  // Track when comparison quotes are fully loaded (both primary and comparison data)
  const comparisonCompleteRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  // Track when dual currency quotes are fully loaded for a provider
  const dualCurrencyCompleteRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  // Track base quote failures to preserve 'failed' status instead of reverting to 'inactive'
  const baseFailedRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })
  // Track normalization failures (base quote cannot be normalized for enhancement)
  const normalizationFailedRef = useRef<Record<Provider, boolean>>({
    deel: false,
    remote: false,
    rivermate: false,
    oyster: false,
    rippling: false,
    skuad: false,
    velocity: false,
    playroll: false,
    omnipresent: false,
  })

  // Enhancement Concurrency Control
  // Mounted flag for safe async operations/cleanup
  const isMountedRef = useRef<boolean>(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])
  // Track pending timeouts to allow cleanup on unmount
  const pendingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set())

  // Concurrency: no cap per user request. Semaphore removed.

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
    quote: unknown,
    formData: EORFormData,
    maxRetries = 3
  ): Promise<unknown> => {
    const quoteMode: 'all-inclusive' | 'statutory-only' =
      formData.quoteType === 'statutory-only' ? 'statutory-only' : 'all-inclusive'

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await enhanceQuote(provider, quote, formData, quoteMode)
      } catch (error: unknown) {
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

  // Direct enhancement scheduler: start as soon as base quote is available, capped by semaphore
  const scheduleEnhancement = useCallback(async (provider: Provider, quote: unknown, formData: EORFormData): Promise<void> => {
    if (enhancementEnqueuedRef.current[provider] || enhancementInFlightRef.current[provider]) return
    enhancementEnqueuedRef.current[provider] = true

    // NORMALIZATION CHECK: Test if quote can be normalized for enhancement
    const normalizedQuote = normalizeQuoteForEnhancement(provider as any, quote);
    if (!normalizedQuote || !isValidNormalizedQuote(normalizedQuote)) {
      console.warn(`🚫 ${provider} normalization failed - skipping enhancement but keeping base active`);
      updateProviderState(provider, {
        status: 'enhancement-failed',
        hasData: true,
        enhancementError: 'Base quote available, enhancement skipped (normalization failed)'
      });
      normalizationFailedRef.current[provider] = true;
      return;
    }
    
    try {
      if (enhancementInFlightRef.current[provider]) return
      enhancementInFlightRef.current[provider] = true
      updateProviderState(provider, { status: 'loading-enhanced', hasData: true })
      // console.log(`🚀 Starting enhancement for ${provider} with validated quote`);
      
      const providerQuoteForEnhancement = (provider === 'remote' && isRemoteAPIResponse(quote))
        ? transformRemoteResponseToQuote(quote)
        : quote
      const result = await retryEnhancementWithBackoff(provider, providerQuoteForEnhancement, formData)
      if (result) {
        updateProviderState(provider, { status: 'active', hasData: true, error: undefined })
      } else {
        updateProviderState(provider, { status: 'enhancement-failed', hasData: true, enhancementError: 'Enhanced quote failed' })
        enhancementFailedRef.current[provider] = true
      }
    } catch (err) {
      console.error(`❌ Enhancement failed for ${provider}:`, err)
      // Since normalization is checked upfront, any errors here are LLM service issues
      updateProviderState(provider, { 
        status: 'enhancement-failed', 
        hasData: true, 
        enhancementError: err instanceof Error ? err.message : 'Enhanced quote failed' 
      })
      enhancementFailedRef.current[provider] = true
    } finally {
      enhancementInFlightRef.current[provider] = false
    }
  }, [retryEnhancementWithBackoff, updateProviderState])

  // Legacy sequential enhancement trigger removed in favor of batched processing

  const { loading: deelLoading, calculateDeelQuote } = useDeelQuote();
  const { loading: remoteLoading, calculateRemoteQuote } = useRemoteQuote();
  const { loading: rivermateLoading, calculateRivermateQuote } = useRivermateQuote();
  const { loading: oysterLoading, calculateOysterQuote } = useOysterQuote();
  const { loading: ripplingLoading, calculateRipplingQuote } = useRipplingQuote();
  const { loading: skuadLoading, calculateSkuadQuote } = useSkuadQuote();
  const { loading: velocityLoading, calculateVelocityQuote } = useVelocityQuote();
  const { loading: playrollLoading, calculatePlayrollQuote } = usePlayrollQuote();
  const { loading: omnipresentLoading, calculateOmnipresentQuote } = useOmnipresentQuote();

  const providerLoading = useMemo(() => ({
    deel: deelLoading,
    remote: remoteLoading,
    rivermate: rivermateLoading,
    oyster: oysterLoading,
    rippling: ripplingLoading,
    skuad: skuadLoading,
    velocity: velocityLoading,
    playroll: playrollLoading,
    omnipresent: omnipresentLoading,
  }) as const, [deelLoading, remoteLoading, rivermateLoading, oysterLoading, ripplingLoading, skuadLoading, velocityLoading, playrollLoading, omnipresentLoading])

  // Note: Removed serial enhanced queue system - now processing sequentially inline

  // Sequential loading processor
  const processNextProvider = useCallback(async () => {
    // console.log('🔧 processNextProvider - START');
    // console.log('🔧 Current quoteData state:', {
    //   hasQuoteData: !!quoteData,
    //   status: quoteData?.status,
    //   hasFormData: !!quoteData?.formData,
    //   formDataType: typeof quoteData?.formData,
    //   formDataKeys: quoteData?.formData ? Object.keys(quoteData.formData) : 'N/A'
    // });
    
    const currentQuoteData = quoteData; // Capture current value to avoid stale closure
    
    if (!currentQuoteData || !isSequentialLoadingRef.current || currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length) {
      if (currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length) {
        // console.log('✅ Sequential loading queue completed');
      }
      // console.log('🔧 processNextProvider - EXIT (early conditions)');
      return;
    }
    
    // console.log('🔧 Full currentQuoteData object:', JSON.stringify(currentQuoteData, null, 2));
    
    // CRITICAL: Validate formData before processing any provider
    const form = currentQuoteData.formData as EORFormData;
    // console.log('🔧 Extracted form object:', JSON.stringify(form, null, 2));
    
    const hasValidFormData = form && 
                           form.country && form.country.trim() !== '' &&
                           form.baseSalary && form.baseSalary.trim() !== '' &&
                           form.clientCountry && form.clientCountry.trim() !== '' &&
                           (form.currency && form.currency.trim() !== '');
    
    // console.log(`🔍 ProcessNextProvider formData validation:`, {
    //   hasForm: !!form,
    //   country: form?.country,
    //   baseSalary: form?.baseSalary,
    //   clientCountry: form?.clientCountry,
    //   currency: form?.currency,
    //   hasValidFormData,
    //   formType: typeof form,
    //   formConstructor: form?.constructor?.name
    // });
    
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
    
    // console.log(`🔄 Processing provider ${currentQueueIndex + 1}/${SEQUENTIAL_LOADING_QUEUE.length}: ${nextProvider}`);
    
    try {
      // Update state to loading base quote
      updateProviderState(nextProvider, { status: 'loading-base' });
      
      // Check if we already have data for this provider
      const hasData = hasProviderData(nextProvider, currentQuoteData);
      if (hasData) {
        // console.log(`✅ ${nextProvider} already has base data, checking enhanced quote...`);

        // Check if enhanced quote exists
        const hasEnhancement = enhancements[nextProvider];
        if (hasEnhancement) {
          // console.log(`✅ ${nextProvider} already has enhanced quote, marking as active`);
          updateProviderState(nextProvider, { status: 'active', hasData: true });
        } else {
          // console.log(`🧠 ${nextProvider} has base quote but needs enhancement... (parallel scheduling)`);
        }

        // Move to next provider immediately after scheduling enhancement
        setCurrentQueueIndex(prev => prev + 1);
        return;
      }
      
      // console.log(`🔍 Calculating ${nextProvider} base quote...`);
      
      // Calculate quote for this provider
      const form = currentQuoteData.formData as EORFormData;
      
      // DEFENSIVE CHECK: Final validation before API call
      // console.log(`🛡️ Final formData check for ${nextProvider}:`, {
      //   country: form?.country,
      //   baseSalary: form?.baseSalary,
      //   clientCountry: form?.clientCountry,
      //   currency: form?.currency
      // });
      
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
          // console.log('📞 Calling Remote API...');
          try {
            calculatedQuote = await calculateRemoteQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Remote API call failed:`, apiError);
            throw apiError; // Re-throw to be handled by outer try-catch
          }
          break;
        case 'rivermate':
          // console.log('📞 Calling Rivermate API...');
          try {
            calculatedQuote = await calculateRivermateQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Rivermate API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'oyster':
          // console.log('📞 Calling Oyster API...');
          try {
            calculatedQuote = await calculateOysterQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Oyster API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'rippling':
          // console.log('📞 Calling Rippling API...');
          try {
            calculatedQuote = await calculateRipplingQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Rippling API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'skuad':
          // console.log('📞 Calling Skuad API...');
          try {
            calculatedQuote = await calculateSkuadQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Skuad API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'velocity':
          // console.log('📞 Calling Velocity API...');
          try {
            calculatedQuote = await calculateVelocityQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Velocity API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'playroll':
          try {
            calculatedQuote = await calculatePlayrollQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Playroll API call failed:`, apiError);
            throw apiError;
          }
          break;
        case 'omnipresent':
          try {
            calculatedQuote = await calculateOmnipresentQuote(form, currentQuoteData);
          } catch (apiError) {
            console.error(`❌ Omnipresent API call failed:`, apiError);
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
        // Validate the calculated quote before considering it successful (flexible check)
        const providerQuoteData = calculatedQuote.quotes[nextProvider as keyof typeof calculatedQuote.quotes];
        const isValid = isValidProviderQuote(nextProvider, providerQuoteData);
        
        if (isValid) {
          // console.log(`✅ ${nextProvider} base quote calculated and validated successfully`);
          // Update quote data and save to storage
          setQuoteData(calculatedQuote);
          if (quoteId) {
            setJsonInSessionStorage(quoteId, calculatedQuote);
          }

          // Enhancement handled by parallel scheduler

          // Move to next provider immediately after scheduling enhancement
          // console.log(`➡️ Moving to next provider after ${nextProvider} BASE COMPLETE (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
          setCurrentQueueIndex(prev => prev + 1);
        } else {
          console.warn(`❌ ${nextProvider} quote validation failed - invalid structure`);
          // Mark as failed due to invalid quote structure
          updateProviderState(nextProvider, { 
            status: 'failed', 
            error: `Quote validation failed: invalid structure` 
          });
          
          // No valid base quote, no enhancement possible, move to next provider
          // console.log(`➡️ Moving to next provider after ${nextProvider} quote validation failure (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
          setCurrentQueueIndex(prev => prev + 1);
        }
      } else {
        console.warn(`⚠️ ${nextProvider} returned no quote data`);
        // Mark as failed if no quote returned
        updateProviderState(nextProvider, { status: 'failed', error: 'No quote data returned' });
        
        // No base quote, no enhancement possible, move to next provider
        // console.log(`➡️ Moving to next provider after ${nextProvider} base quote failure (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
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
      // console.log(`➡️ Moving to next provider after ${nextProvider} base quote error (${currentQueueIndex + 1} → ${currentQueueIndex + 2})`);
      setCurrentQueueIndex(prev => prev + 1);
    }
  }, [currentQueueIndex, updateProviderState, hasProviderData, quoteId, quoteData,
      calculateRemoteQuote, calculateRivermateQuote, calculateOysterQuote, 
      calculateRipplingQuote, calculateSkuadQuote, calculateVelocityQuote, calculatePlayrollQuote, enhancements]);

  // Keep a stable ref to the latest processor to avoid effect rescheduling stalls
  const processNextProviderRef = useRef(processNextProvider);
  useEffect(() => {
    processNextProviderRef.current = processNextProvider;
  }, [processNextProvider]);
  

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
                  ? !!quoteData.dualCurrencyQuotes?.skuad?.isDualCurrencyMode
                  : newProvider === 'velocity'
                    ? !!quoteData.dualCurrencyQuotes?.velocity?.isDualCurrencyMode
                  : newProvider === 'playroll'
                    ? !!quoteData.dualCurrencyQuotes?.playroll?.isDualCurrencyMode
                    : newProvider === 'omnipresent'
                      ? !!quoteData.dualCurrencyQuotes?.omnipresent?.isDualCurrencyMode
                      : false;

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
        } else if (newProvider === 'playroll') {
          calculatedQuote = await calculatePlayrollQuote(form, quoteData);
        } else if (newProvider === 'omnipresent') {
          calculatedQuote = await calculateOmnipresentQuote(form, quoteData);
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
  }, [quoteData, currentProvider, providerStates, quoteId,
      calculateDeelQuote, calculateRemoteQuote, calculateRivermateQuote, 
      calculateOysterQuote, calculateRipplingQuote, calculateSkuadQuote, calculateVelocityQuote, calculatePlayrollQuote, calculateOmnipresentQuote, providerLoading]);

  const refreshQuote = useCallback(() => {
    // console.log("Refreshing quote...");
  }, []);
  
  // Effect to process next provider when queue index changes (legacy sequential; inactive in PARALLEL_MODE)
  useEffect(() => {
    if (!PARALLEL_MODE && isSequentialLoadingRef.current && currentQueueIndex >= 0 && currentQueueIndex < SEQUENTIAL_LOADING_QUEUE.length) {
      // console.log(`🕰️ Scheduling provider ${currentQueueIndex + 1}/${SEQUENTIAL_LOADING_QUEUE.length} in 2 seconds...`);
      
      // Longer delay to be more API-friendly
      sequentialTimeoutRef.current = setTimeout(() => {
        if (isSequentialLoadingRef.current) { // Double-check flag before processing
          processNextProviderRef.current();
        }
      }, 2000); // Increased from 500ms to 2s
    } else if (!PARALLEL_MODE && currentQueueIndex >= SEQUENTIAL_LOADING_QUEUE.length && currentQueueIndex > 0) {
      // Sequential loading complete
      isSequentialLoadingRef.current = false;
      // console.log('🎉 Sequential loading completed - all providers processed!');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup intentionally uses snapshot of ref
  useEffect(() => {
    const timeouts = pendingTimeoutsRef.current
    return () => {
      if (timeouts.size > 0) {
        for (const id of Array.from(timeouts)) {
          clearTimeout(id)
        }
        timeouts.clear()
      }
    }
  }, [])

  useEffect(() => {
    const processQuote = async () => {
      // console.log('🏁 useQuoteResults processQuote - START')
      // console.log('🆔 Quote ID:', quoteId)
      setLoading(true);

      const idValidation = validateQuoteId(quoteId);
      if (!idValidation.isValid) {
        console.error('❌ Invalid quote ID:', idValidation.error)
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: idValidation.error || 'Invalid quote ID' });
        setLoading(false);
        return;
      }

      // console.log('📂 Loading from session storage...')
      const storageResult = getJsonFromSessionStorage<QuoteData>(quoteId!);
      if (!storageResult.success || !storageResult.data) {
        console.error('❌ Failed to load from session storage:', storageResult.error)
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: storageResult.error || 'Failed to load quote data.' });
        setLoading(false);
        return;
      }

      // console.log('📦 Raw data loaded from session storage:', JSON.stringify(storageResult.data, null, 2))
      // console.log('🔍 FormData from session storage:', JSON.stringify(storageResult.data.formData, null, 2))

      const validationResult = safeValidateQuoteData(storageResult.data);
      if (!validationResult.isValid || !validationResult.data) {
        console.error('❌ Quote data validation failed:', validationResult.error)
        setQuoteData({ calculatorType: 'eor', formData: {}, quotes: {}, metadata: { timestamp: Date.now(), currency: 'USD' }, status: 'error', error: 'Quote data is corrupted or invalid.' });
        setLoading(false);
        return;
      }

      const data = validationResult.data;
      // console.log('✅ Validated quote data:', {
      //   status: data.status,
      //   hasFormData: !!data.formData,
      //   formDataKeys: data.formData ? Object.keys(data.formData) : []
      // })
      // console.log('🔍 Key formData fields after validation:', {
      //   country: data.formData?.country,
      //   baseSalary: data.formData?.baseSalary,
      //   currency: data.formData?.currency,
      //   clientCountry: data.formData?.clientCountry
      // })
      setQuoteData(data);

      if (data.status === 'calculating') {
        // console.log('⚡ Quote is in calculating status, starting Deel (then others in parallel)...')
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

          // Enhancement handled by parallel scheduler

        try {
          // 1) Start Deel first
          if (!hasProviderData('deel', (quoteData || data) as QuoteData)) {
            updateProviderState('deel', { status: 'loading-base' })
          }
          const deelPromise = (async () => {
            try {
              if (baseInFlightRef.current.deel || hasProviderData('deel', (quoteData || data) as QuoteData)) return
              baseInFlightRef.current.deel = true
              // console.log('📤 Starting Deel base quote...')
              const deelResult = await calculateDeelQuote({ ...form, enableComparison: false } as EORFormData, (quoteData || data) as QuoteData)
              
              // Validate the calculated Deel quote before considering it successful (flexible check)
              const isValid = isValidProviderQuote('deel', deelResult.quotes.deel);
              
              if (isValid) {
                // console.log(`✅ Deel parallel base quote calculated and validated successfully`);
                mergeAndPersist(deelResult)
                // Immediately schedule enhancement for Deel (parallel mode)
                if (!enhancementEnqueuedRef.current.deel && !enhancementInFlightRef.current.deel) {
                  void scheduleEnhancement('deel', deelResult.quotes.deel, deelResult.formData as EORFormData)
                }
                // Start Deel comparison base fetch in background
                compareInFlightRef.current.deel = true
                ;(async () => {
                  try {
                    const compRes = await calculateDeelQuote(form, (quoteData || data) as QuoteData)
                    if (compRes) {
                      mergeAndPersist(compRes)
                      // Check if comparison is now ready for Deel
                      setQuoteData(currentData => {
                        if (!currentData || !compRes) return currentData
                        const isReady = isComparisonReady('deel', compRes)
                        const isDualReady = isDualCurrencyComparisonReady('deel', compRes)
                        if (isReady && isDualReady) {
                          comparisonCompleteRef.current.deel = true
                          dualCurrencyCompleteRef.current.deel = true
                          // Update provider state to reflect comparison readiness
                          updateProviderState('deel', { status: 'loading-enhanced', hasData: true })
                        }
                        return currentData
                      })
                    }
                  } catch { /* noop */ }
                  finally {
                    compareInFlightRef.current.deel = false
                  }
                })()
              } else {
                console.warn(`❌ Deel parallel quote validation failed - invalid structure`);
                updateProviderState('deel', { 
                  status: 'failed', 
                  error: `Quote validation failed: invalid structure` 
                });
              }
            } catch (err) {
              console.error('❌ Deel base quote failed:', err)
              updateProviderState('deel', { status: 'failed', error: err instanceof Error ? err.message : 'Failed to calculate Deel quote' })
            } finally {
              baseInFlightRef.current.deel = false
            }
          })()

          // 2) As soon as Deel has started, kick off others with bounded concurrency
          const baseData = (quoteData || data) as QuoteData

          const runBackgroundProvider = async (provider: Provider) => {
            try {
              if (baseInFlightRef.current[provider] || hasProviderData(provider, baseData)) return
              baseInFlightRef.current[provider] = true

              let result: QuoteData | undefined
              switch (provider) {
                case 'remote':
                  result = await calculateRemoteQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'rivermate':
                  result = await calculateRivermateQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'oyster':
                  result = await calculateOysterQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'rippling':
                  result = await calculateRipplingQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'skuad':
                  result = await calculateSkuadQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'velocity':
                  result = await calculateVelocityQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'playroll':
                  result = await calculatePlayrollQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                case 'omnipresent':
                  result = await calculateOmnipresentQuote({ ...form, enableComparison: false } as EORFormData, baseData); break
                default:
                  return
              }

              if (result) {
                const providerQuoteData = (result.quotes as Record<string, unknown>)[provider]
                const isValid = isValidProviderQuote(provider, providerQuoteData)

                if (isValid) {
                  mergeAndPersist(result)

                  if (!enhancementEnqueuedRef.current[provider] && !enhancementInFlightRef.current[provider]) {
                    void scheduleEnhancement(provider, providerQuoteData, result.formData as EORFormData)
                  }

                  compareInFlightRef.current[provider] = true
                  ;(async () => {
                    try {
                      let compRes: QuoteData | undefined
                      switch (provider) {
                        case 'remote': compRes = await calculateRemoteQuote(form, (quoteData || data) as QuoteData); break
                        case 'rivermate': compRes = await calculateRivermateQuote(form, (quoteData || data) as QuoteData); break
                        case 'oyster': compRes = await calculateOysterQuote(form, (quoteData || data) as QuoteData); break
                        case 'rippling': compRes = await calculateRipplingQuote(form, (quoteData || data) as QuoteData); break
                        case 'skuad': compRes = await calculateSkuadQuote(form, (quoteData || data) as QuoteData); break
                        case 'velocity': compRes = await calculateVelocityQuote(form, (quoteData || data) as QuoteData); break
                        case 'playroll': compRes = await calculatePlayrollQuote(form, (quoteData || data) as QuoteData); break
                        case 'omnipresent': compRes = await calculateOmnipresentQuote(form, (quoteData || data) as QuoteData); break
                      }
                      if (compRes) {
                        mergeAndPersist(compRes)
                        setQuoteData(currentData => {
                          if (!currentData || !compRes) return currentData
                          const isReady = isComparisonReady(provider, compRes)
                          const isDualReady = isDualCurrencyComparisonReady(provider, compRes)
                          if (isReady && isDualReady) {
                            comparisonCompleteRef.current[provider] = true
                            dualCurrencyCompleteRef.current[provider] = true
                            updateProviderState(provider, { status: 'loading-enhanced', hasData: true })
                          }
                          return currentData
                        })
                      }
                    } catch { /* noop */ }
                    finally {
                      compareInFlightRef.current[provider] = false
                    }
                  })()
                } else {
                  console.warn(`❌ ${provider} parallel quote validation failed - invalid structure`)
                  updateProviderState(provider, {
                    status: 'failed',
                    error: `Quote validation failed: invalid structure`
                  })
                }
              } else {
                updateProviderState(provider, { status: 'failed', error: 'No quote data returned' })
              }
            } catch (e: unknown) {
              console.error(`❌ ${provider} base quote failed:`, e)
              const errorMessage = e instanceof Error ? e.message : 'Failed to calculate quote'
              updateProviderState(provider, { status: 'failed', error: errorMessage })
              baseFailedRef.current[provider] = true
            } finally {
              baseInFlightRef.current[provider] = false
            }
          }

          backgroundQueueRef.current = [...OTHER_PROVIDERS]
          backgroundActiveCountRef.current = 0

          OTHER_PROVIDERS.forEach(provider => {
            if (!hasProviderData(provider, (quoteData || data) as QuoteData)) {
              updateProviderState(provider, { status: 'loading-base' })
            }
          })

          const launchNextBackgroundProvider = () => {
            if (backgroundActiveCountRef.current >= MAX_BACKGROUND_BASE_CONCURRENCY) return
            const nextProvider = backgroundQueueRef.current.shift()
            if (!nextProvider) return

            backgroundActiveCountRef.current += 1
            void (async () => {
              try {
                await runBackgroundProvider(nextProvider)
              } finally {
                backgroundActiveCountRef.current = Math.max(0, backgroundActiveCountRef.current - 1)
                launchNextBackgroundProvider()
              }
            })()
          }

          for (let i = 0; i < MAX_BACKGROUND_BASE_CONCURRENCY; i += 1) {
            launchNextBackgroundProvider()
          }

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
        // Update provider states with comparison and dual currency readiness
        const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent'];
        providers.forEach(provider => {
          // If normalization failed earlier, keep provider inactive
          if (normalizationFailedRef.current[provider]) {
            updateProviderState(provider, { status: 'inactive', hasData: false });
            return;
          }

          const hasBase = hasProviderData(provider, data);
          if (!hasBase) {
            // Do not downgrade to inactive if a base or comparison call is still in-flight.
            if (baseInFlightRef.current[provider] || compareInFlightRef.current[provider]) {
              updateProviderState(provider, { status: 'loading-base', hasData: false });
            } else {
              // Preserve failed status if a base error was recorded
              if (baseFailedRef.current[provider]) {
                updateProviderState(provider, { status: 'failed', hasData: false });
              } else {
                updateProviderState(provider, { status: 'inactive', hasData: false });
              }
            }
            return;
          }

          // Check if comparison modes are ready
          const comparisonReady = isComparisonReady(provider, data);
          const dualCurrencyReady = isDualCurrencyComparisonReady(provider, data);

          // Debug logging for provider state transitions
          

          // Provider has base data, now check if all required modes are ready
          if (!comparisonReady || !dualCurrencyReady) {
            // Still loading comparison or dual currency data
            updateProviderState(provider, { status: 'loading-base', hasData: true });
            return;
          }

          // Mark comparison as complete for this provider
          comparisonCompleteRef.current[provider] = comparisonReady;
          dualCurrencyCompleteRef.current[provider] = dualCurrencyReady;

          const hasEnh = !!enhancements[provider];
          const hadEnhancementError = enhancementFailedRef.current[provider] || !!errors?.[provider];
          const isEnhancing = !!enhancing[provider];

          let nextStatus: ProviderState;
          if (hasEnh) {
            nextStatus = 'active';
          } else if (hadEnhancementError) {
            nextStatus = 'enhancement-failed';
          } else if (isEnhancing) {
            nextStatus = 'loading-enhanced';
          } else {
            nextStatus = 'loading-enhanced';
          }

          updateProviderState(provider, { status: nextStatus, hasData: true });
        });

        // In PARALLEL_MODE, kick any missing enhancements immediately in parallel
        if (PARALLEL_MODE) {
          providers.forEach((provider) => {
            if (normalizationFailedRef.current[provider]) {
              // Do not schedule enhancement for providers that failed normalization
              return
            }
            const hasBase = hasProviderData(provider, data)
            const hasEnh = !!enhancements[provider]
            const failed = enhancementFailedRef.current[provider]
            const enqueued = enhancementEnqueuedRef.current[provider]
            if (hasBase && !hasEnh && !failed && !enqueued && !enhancementInFlightRef.current[provider]) {
              const providerQuote = data.quotes[provider as keyof typeof data.quotes]
              void scheduleEnhancement(provider, providerQuote, data.formData as EORFormData)
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
      // console.log('🏁 useQuoteResults processQuote - END')
    };

    processQuote();
  }, [quoteId, calculateDeelQuote, calculateRemoteQuote, calculateRivermateQuote, calculateOysterQuote, calculateRipplingQuote, calculateSkuadQuote, calculateVelocityQuote, calculatePlayrollQuote, updateProviderState, hasProviderData, scheduleEnhancement]);
  
  // Separate useEffect for sequential loading trigger (prevents circular dependency)
  useEffect(() => {
    // console.log('🔍 Sequential trigger check:', {
    //   status: quoteData?.status,
    //   hasStarted: hasStartedSequentialRef.current,
    //   isLoading: isSequentialLoadingRef.current,
    //   quoteId
    // });
    
    if (quoteData?.status === 'completed') {
      // CRITICAL: Validate formData integrity before starting sequential loading
      const formData = quoteData.formData as EORFormData;
      const hasValidFormData = formData && 
                               formData.country && formData.country.trim() !== '' &&
                               formData.baseSalary && formData.baseSalary.trim() !== '' &&
                               formData.clientCountry && formData.clientCountry.trim() !== '' &&
                               (formData.currency && formData.currency.trim() !== '');
      
      // console.log('🔍 FormData validation:', {
      //   hasFormData: !!formData,
      //   country: formData?.country,
      //   baseSalary: formData?.baseSalary,
      //   clientCountry: formData?.clientCountry,
      //   currency: formData?.currency,
      //   hasValidFormData
      // });
      
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
          case 'skuad': return !quoteData.quotes?.skuad;
          case 'velocity': return !quoteData.quotes?.velocity;
      case 'playroll': return !quoteData.quotes?.playroll;
      case 'omnipresent': return !quoteData.quotes?.omnipresent;
          default: return true;
        }
      });
      
      // console.log('🔍 Sequential conditions:', {
      //   hasDeelData,
      //   missingCount: missingProviders.length,
      //   missingProviders,
      //   allQuotes: Object.keys(quoteData.quotes || {}),
      //   enhancementCount: Object.keys(enhancements || {}).length
      // });
      
      if (!PARALLEL_MODE && !hasStartedSequentialRef.current && !isSequentialLoadingRef.current) {
        if (hasDeelData && missingProviders.length > 0) {
          // console.log(`🚀 TRIGGERING sequential loading for ${missingProviders.length} providers: ${missingProviders.join(', ')}`);
          hasStartedSequentialRef.current = true;
          
          // Longer delay to ensure formData is completely stable
          setTimeout(() => {
            // console.log('⏰ Sequential loading timeout triggered');
            // console.log('⏰ QuoteData state during timeout:', {
            //   hasQuoteData: !!quoteData,
            //   status: quoteData?.status,
            //   hasFormData: !!quoteData?.formData,
            //   formDataType: typeof quoteData?.formData
            // });
            
            // Double-check formData is still valid before starting
            const currentData = quoteData;
            // console.log('⏰ CurrentData during timeout:', JSON.stringify(currentData, null, 2));
            
            const currentFormData = currentData?.formData as EORFormData;
            // console.log('⏰ CurrentFormData during timeout:', JSON.stringify(currentFormData, null, 2));
            
            const isStillValid = currentFormData && 
                                currentFormData.country && currentFormData.country.trim() !== '' &&
                                currentFormData.baseSalary && currentFormData.baseSalary.trim() !== '' &&
                                currentFormData.clientCountry && currentFormData.clientCountry.trim() !== '';
            
            // console.log('⏰ FormData validity check during timeout:', {
            //   hasCurrentFormData: !!currentFormData,
            //   country: currentFormData?.country,
            //   baseSalary: currentFormData?.baseSalary,
            //   clientCountry: currentFormData?.clientCountry,
            //   isStillValid
            // });
            
            if (!isStillValid) {
              console.error('❌ FormData became invalid during delay, aborting sequential loading');
              console.error('❌ Invalid formData during timeout:', JSON.stringify(currentFormData, null, 2));
              hasStartedSequentialRef.current = false;
              return;
            }
            
            if (!isSequentialLoadingRef.current) {
              // console.log('🎯 Starting sequential loading process...');
              isSequentialLoadingRef.current = true;
              setCurrentQueueIndex(0);
            } else {
              // console.log('⚠️ Sequential loading already in progress, skipping');
            }
          }, 2500); // Increased delay to ensure stability
        } else if (!PARALLEL_MODE) {
          // console.log('❌ Sequential loading conditions not met:', { hasDeelData, missingCount: missingProviders.length });
        }
      } else if (!PARALLEL_MODE) {
        // console.log('❌ Sequential loading already started or in progress:', {
        //   hasStarted: hasStartedSequentialRef.current,
        //   isLoading: isSequentialLoadingRef.current
        // });
      }
    } else {
      // console.log('❌ Quote not completed yet:', quoteData?.status);
    }
  }, [quoteData, enhancements, quoteId]); // include quoteData and enhancements for correctness
  
  // Debug logging for provider states (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // console.log('🗺️ Provider states updated:', Object.entries(providerStates).map(([provider, state]) => `${provider}: ${state?.status || 'unknown'}`).join(', '));
    }
  }, [providerStates]);

  // Sync provider states with enhancement progress/results; do not override error states
  useEffect(() => {
    if (!quoteData) return;
    const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent'];
    providers.forEach(provider => {
      const hasBase = hasProviderData(provider, quoteData);
      if (!hasBase) {
        // If comparison is in-flight for this provider, keep it in loading-base instead of inactive
        if (compareInFlightRef.current[provider] || baseInFlightRef.current[provider]) {
          updateProviderState(provider, { status: 'loading-base', hasData: false });
        }
        return;
      }

      const isEnhancing = !!enhancing[provider];
      const hasEnh = !!enhancements[provider];
      const hadEnhancementError = enhancementFailedRef.current[provider] || !!errors?.[provider];
      const hadNormalizationError = !!errors?.[provider]?.message?.toLowerCase?.().includes('failed to normalize quote data');

      // If normalization failed, keep base active but mark enhancement as failed
      if (normalizationFailedRef.current[provider] || hadNormalizationError) {
        normalizationFailedRef.current[provider] = true;
        updateProviderState(provider, { status: 'enhancement-failed', hasData: true, enhancementError: 'Enhancement unavailable (normalization failed)' });
      } else if (isEnhancing) {
        updateProviderState(provider, { status: 'loading-enhanced', hasData: true, error: undefined });
      } else if (hasEnh) {
        updateProviderState(provider, { status: 'active', hasData: true, error: undefined });
      }
    });
  }, [quoteData, enhancing, enhancements, errors, hasProviderData, updateProviderState]);
  
  // Reset sequential loading flags when quote changes (cleanup)
  useEffect(() => {
    // Reset flags when new quote starts
    // console.log('🔄 Resetting sequential flags for new quote:', quoteId);
    clearRawQuotes()
    hasStartedSequentialRef.current = false;
    isSequentialLoadingRef.current = false;
    enhancementFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
    normalizationFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
    baseFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
    comparisonCompleteRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
    dualCurrencyCompleteRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }

    return () => {
      // Cleanup on unmount or quote change
      // console.log('🧹 Cleaning up sequential loading for quote:', quoteId);
      if (sequentialTimeoutRef.current) {
        clearTimeout(sequentialTimeoutRef.current);
        sequentialTimeoutRef.current = null;
      }
      isSequentialLoadingRef.current = false;
      hasStartedSequentialRef.current = false;
      // Clear in-flight guards and schedulers on cleanup
      baseInFlightRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      enhancementInFlightRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      enhancementEnqueuedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      enhancementFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      normalizationFailedRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      compareInFlightRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      comparisonCompleteRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      dualCurrencyCompleteRef.current = { deel: false, remote: false, rivermate: false, oyster: false, rippling: false, skuad: false, velocity: false, playroll: false, omnipresent: false }
      clearRawQuotes()
    };
  }, [quoteId]);

  // Ensure enhancements are scheduled even when loading a persisted quote with status='completed'
  useEffect(() => {
    if (!quoteData || quoteData.status !== 'completed') return;

    const form = quoteData.formData as EORFormData;
    const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent'];
    providers.forEach((provider) => {
      try {
        // Skip if no base quote available for this provider
        if (!hasProviderData(provider, quoteData)) return;

        // Skip if already enhanced, in-flight, enqueued, or previously failed
        if (enhancements[provider] || enhancementInFlightRef.current[provider] || enhancementEnqueuedRef.current[provider] || enhancementFailedRef.current[provider]) {
          return;
        }

        const providerQuoteData = (quoteData.quotes as Record<string, unknown>)[provider];
        if (!providerQuoteData) return;

        // Schedule enhancement (same logic as calculating-path)
        void scheduleEnhancement(provider, providerQuoteData, form);
      } catch {
        /* noop */
      }
    });
  }, [quoteData, enhancements]);

  // Schedule comparison enhancements after primary enhancement completes (to limit API spikes)
  useEffect(() => {
    if (!quoteData || quoteData.status !== 'completed') return;
    const form = quoteData.formData as EORFormData;
    if (!form?.enableComparison) return;

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const providers: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent'];
    providers.forEach((provider) => {
      try {
        const primaryDone = !!enhancements[provider];
        if (!primaryDone) return;

        const compareKey = `${provider}::compare`;
        if (enhancements[compareKey] || enhancing[compareKey]) return;

        const compareProp = `comparison${cap(provider)}`;
        const compareQuote = (quoteData.quotes as any)?.[compareProp];
        if (!compareQuote) return;

        // Trigger comparison enhancement using comparison country
        const compareForm: EORFormData = { ...form, country: form.compareCountry || form.country } as EORFormData;
        void enhanceQuote(provider as any, compareQuote, compareForm, (form.quoteType as any) || 'all-inclusive', { key: compareKey });
      } catch { /* noop */ }
    });
  }, [quoteData, enhancements, enhancing, enhanceQuote]);

  // Calculate progress for reconciliation button (parallel mode): single batch view
  const enhancementBatchInfo = useMemo(() => {
    const allProviders: Provider[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent']
    const total = allProviders.length
    const completed = allProviders.filter(provider => {
      const status = providerStates[provider]?.status
      return status === 'active' || status === 'enhancement-failed' || status === 'failed'
    }).length
    const anyLoading = allProviders.some(p => providerStates[p]?.status === 'loading-enhanced')
    return {
      currentBatch: 1,
      totalBatches: 1,
      batchProgress: { completed, total },
      isProcessing: anyLoading
    }
  }, [providerStates])

  return {
    quoteData,
    loading,
    currentProvider,
    switchProvider,
    refreshQuote,
    providerLoading,
    providerStates,
    enhancementBatchInfo,
    // Comparison readiness helpers
    isComparisonReady,
    isDualCurrencyComparisonReady,
    hasComparisonData,
    hasDualCurrencyData,
  };
};
