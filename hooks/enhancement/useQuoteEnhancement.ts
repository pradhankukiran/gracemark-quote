// React Hook: Quote Enhancement
// Provides interface for enhancing individual provider quotes with Groq LLM

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { 
  EnhancedQuote, 
  ProviderType, 
  EnhancementError,
  MultiProviderResult 
} from '@/lib/types/enhancement'
import { EORFormData } from '@/lib/shared/types'
import { normalizeQuoteForEnhancement, isValidNormalizedQuote } from '@/lib/shared/utils/quoteNormalizer'
import { safeNumber } from '@/lib/shared/utils/formatUtils'

interface EnhancementState {
  [provider: string]: {
    loading: boolean
    data: EnhancedQuote | null
    error: EnhancementError | null
  }
}

interface UseQuoteEnhancementReturn {
  // State
  enhancing: Record<string, boolean>
  enhancements: Record<string, EnhancedQuote>
  errors: Record<string, EnhancementError>
  
  // Single quote enhancement
  enhanceQuote: (
    provider: ProviderType,
    providerQuote: any,
    formData: EORFormData,
    quoteType?: 'all-inclusive' | 'statutory-only'
  ) => Promise<EnhancedQuote | null>
  
  // Batch enhancement
  enhanceAllQuotes: (
    providerQuotes: Record<string, any>,
    formData: EORFormData,
    quoteType?: 'all-inclusive' | 'statutory-only'
  ) => Promise<MultiProviderResult | null>
  
  // Utilities
  clearEnhancement: (provider: string) => void
  clearAllEnhancements: () => void
  getEnhancementStatus: (provider: string) => 'idle' | 'loading' | 'success' | 'error'
  retryEnhancement: (provider: string) => Promise<void>
}

export const useQuoteEnhancement = (): UseQuoteEnhancementReturn => {
  const [state, setState] = useState<EnhancementState>({})
  const abortControllersRef = useRef<Record<string, AbortController>>({})
  const enhancementTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})

  // Resolve per-quote storage key to avoid cross-quote contamination
  const getStorageKey = useCallback(() => {
    try {
      if (typeof window === 'undefined') return 'gmq_enhancements_v1';
      const id = new URLSearchParams(window.location.search).get('id') || 'global';
      return `gmq_enhancements_v1::${id}`;
    } catch {
      return 'gmq_enhancements_v1';
    }
  }, [])

  // Hydrate from sessionStorage on first mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = sessionStorage.getItem(getStorageKey())
      if (raw) {
        const parsed = JSON.parse(raw)
        // Basic shape validation and normalization
        if (parsed && typeof parsed === 'object') {
          const normalized: EnhancementState = {}
          Object.entries(parsed as EnhancementState).forEach(([provider, st]) => {
            normalized[provider] = {
              loading: false, // do not hydrate loading=true from previous sessions/hooks
              data: st?.data || null,
              error: st?.error || null
            }
          })
          setState(normalized)
        }
      }
    } catch {
      // ignore hydration errors
    }
  }, [getStorageKey])

  const persistState = useCallback((next: EnhancementState) => {
    try {
      if (typeof window === 'undefined') return
      sessionStorage.setItem(getStorageKey(), JSON.stringify(next))
    } catch {
      // ignore persistence errors
    }
  }, [getStorageKey])

  // Utility to update state for a specific provider with performance optimization
  const updateProviderState = useCallback((
    provider: string,
    updates: Partial<EnhancementState[string]>
  ) => {
    setState(prev => {
      const currentState = prev[provider]
      
      // Only update if there are actual changes (prevents unnecessary re-renders)
      const hasChanges = !currentState || 
        Object.keys(updates).some(key => 
          (updates as any)[key] !== (currentState as any)[key]
        )
      
      if (!hasChanges) return prev
      
      const next = {
        ...prev,
        [provider]: {
          ...currentState,
          ...updates
        }
      } as EnhancementState
      // Persist updated state map
      persistState(next)
      return next
    })
  }, [persistState])

  // Validate enhancement data for required numeric fields
  const validateEnhancementData = useCallback((enhancement: EnhancedQuote): EnhancedQuote => {
    return {
      ...enhancement,
      finalTotal: safeNumber(enhancement.finalTotal, 0),
      totalEnhancement: safeNumber(enhancement.totalEnhancement, 0),
      overallConfidence: safeNumber(enhancement.overallConfidence, 0),
      monthlyCostBreakdown: {
        baseCost: safeNumber(enhancement.monthlyCostBreakdown?.baseCost, 0),
        enhancements: safeNumber(enhancement.monthlyCostBreakdown?.enhancements, 0),
        total: safeNumber(enhancement.monthlyCostBreakdown?.total, 0)
      }
    }
  }, [])

  // Single quote enhancement
  const enhanceQuote = useCallback(async (
    provider: ProviderType,
    providerQuote: any,
    formData: EORFormData,
    quoteType: 'all-inclusive' | 'statutory-only' = 'all-inclusive'
  ): Promise<EnhancedQuote | null> => {
    // Cancel any existing request for this provider
    if (abortControllersRef.current[provider]) {
      abortControllersRef.current[provider].abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllersRef.current[provider] = abortController

    // Update state to loading
    updateProviderState(provider, {
      loading: true,
      error: null
    })

    try {
      // Normalize the provider quote data before sending to API
      const normalizedQuote = normalizeQuoteForEnhancement(provider, providerQuote)
      
      if (!isValidNormalizedQuote(normalizedQuote)) {
        throw new Error(`Failed to normalize quote data for provider: ${provider}. Please check quote format.`)
      }

      const response = await fetch('/api/enhancement/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          providerQuote: normalizedQuote,
          formData,
          quoteType
        }),
        signal: abortController.signal
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`)
      }

      if (!result.success) {
        const error: EnhancementError = {
          code: result.error || 'ENHANCEMENT_FAILED',
          message: result.message || 'Enhancement failed',
          provider
        }
        throw error
      }

      const enhancedQuote = validateEnhancementData(result.data as EnhancedQuote)

      // Update state with success
      updateProviderState(provider, {
        loading: false,
        data: enhancedQuote,
        error: null
      })

      return enhancedQuote

    } catch (error) {
      // Don't update state if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        return null
      }

      const enhancementError: EnhancementError = error instanceof Error && 'code' in error 
        ? error as EnhancementError
        : {
            code: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            provider
          }

      // Update state with error
      updateProviderState(provider, {
        loading: false,
        data: null,
        error: enhancementError
      })

      return null
    } finally {
      // Clean up abort controller
      delete abortControllersRef.current[provider]
    }
  }, [updateProviderState])

  // Batch enhancement for all providers
  const enhanceAllQuotes = useCallback(async (
    providerQuotes: Record<string, any>,
    formData: EORFormData,
    quoteType: 'all-inclusive' | 'statutory-only' = 'all-inclusive'
  ): Promise<MultiProviderResult | null> => {
    // Set loading state for all providers
    Object.keys(providerQuotes).forEach(provider => {
      updateProviderState(provider, {
        loading: true,
        error: null
      })
    })

    try {
      const response = await fetch('/api/enhancement/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerQuotes,
          formData,
          quoteType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`)
      }

      if (!result.success) {
        throw new Error(result.message || 'Batch enhancement failed')
      }

      const batchResult = result.data as MultiProviderResult

      // Update state for each provider
      Object.entries(batchResult.enhancements).forEach(([provider, enhancement]) => {
        updateProviderState(provider, {
          loading: false,
          data: validateEnhancementData(enhancement),
          error: null
        })
      })

      // Update state for providers with errors
      Object.entries(batchResult.errors).forEach(([provider, errors]) => {
        if (errors.length > 0) {
          updateProviderState(provider, {
            loading: false,
            data: null,
            error: errors[0] // Use first error
          })
        }
      })

      return batchResult

    } catch (error) {
      // Set error state for all providers
      Object.keys(providerQuotes).forEach(provider => {
        const enhancementError: EnhancementError = {
          code: 'BATCH_ENHANCEMENT_FAILED',
          message: error instanceof Error ? error.message : 'Batch enhancement failed',
          provider: provider as ProviderType
        }

        updateProviderState(provider, {
          loading: false,
          data: null,
          error: enhancementError
        })
      })

      return null
    }
  }, [updateProviderState])

  // Clear enhancement for specific provider
  const clearEnhancement = useCallback((provider: string) => {
    // Cancel any ongoing request
    if (abortControllersRef.current[provider]) {
      abortControllersRef.current[provider].abort()
      delete abortControllersRef.current[provider]
    }

    // Clear state
    setState(prev => {
      const newState = { ...prev }
      delete newState[provider]
      persistState(newState as EnhancementState)
      return newState
    })
  }, [])

  // Clear all enhancements
  const clearAllEnhancements = useCallback(() => {
    // Cancel all ongoing requests
    Object.values(abortControllersRef.current).forEach(controller => {
      controller.abort()
    })
    abortControllersRef.current = {}

    // Clear all state
    setState({})
    persistState({} as EnhancementState)
  }, [])

  // Get enhancement status for provider
  const getEnhancementStatus = useCallback((provider: string): 'idle' | 'loading' | 'success' | 'error' => {
    const providerState = state[provider]
    
    if (!providerState) return 'idle'
    if (providerState.loading) return 'loading'
    if (providerState.error) return 'error'
    if (providerState.data) return 'success'
    
    return 'idle'
  }, [state])

  // Retry enhancement for specific provider
  const retryEnhancement = useCallback(async (provider: string) => {
    const providerState = state[provider]
    if (!providerState || !providerState.error) return

    // We need to store the original request parameters to retry
    // This is a limitation - in a real implementation, you might want to store these
    console.warn(`Retry not implemented for provider ${provider}. Original request parameters not stored.`)
  }, [state])

  // Memoized computed values from state for better performance
  const enhancing = useMemo(() => 
    Object.fromEntries(
      Object.entries(state).map(([provider, providerState]) => [
        provider, 
        providerState.loading
      ])
    ), [state]
  )

  const enhancements = useMemo(() =>
    Object.fromEntries(
      Object.entries(state)
        .filter(([, providerState]) => providerState.data)
        .map(([provider, providerState]) => [provider, providerState.data!])
    ), [state]
  )

  const errors = useMemo(() =>
    Object.fromEntries(
      Object.entries(state)
        .filter(([, providerState]) => providerState.error)
        .map(([provider, providerState]) => [provider, providerState.error!])
    ), [state]
  )

  return {
    enhancing,
    enhancements,
    errors,
    enhanceQuote,
    enhanceAllQuotes,
    clearEnhancement,
    clearAllEnhancements,
    getEnhancementStatus,
    retryEnhancement
  }
}
