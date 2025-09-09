"use client"

import { useEffect, Suspense, memo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle, Loader2, Brain } from "lucide-react"
import Link from "next/link"
import { useQuoteResults } from "./hooks/useQuoteResults"
import { useUSDConversion } from "../eor-calculator/hooks/useUSDConversion"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"
import { QuoteComparison } from "../eor-calculator/components/QuoteComparison"
import { ErrorBoundary } from "@/lib/shared/components/ErrorBoundary"
import { ProviderSelector } from "./components/ProviderSelector"
import { EnhancementProvider, useEnhancementContext } from "@/hooks/enhancement/EnhancementContext"
import type { ReconciliationResult } from "@/lib/types/reconciliation"
import { transformRemoteResponseToQuote, transformRivermateQuoteToDisplayQuote, transformToRemoteQuote, transformOysterQuoteToDisplayQuote } from "@/lib/shared/utils/apiUtils"
import { EORFormData, RemoteAPIResponse } from "@/lib/shared/types"
import { EnhancedQuoteCard } from "@/components/enhancement/EnhancedQuoteCard"
import { ProviderType, EnhancedQuote } from "@/lib/types/enhancement"

const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
)

const QuotePageContent = memo(() => {
  const searchParams = useSearchParams()
  const quoteId = searchParams.get('id')
  
  const { 
    quoteData, 
    loading, 
    currentProvider, 
    switchProvider, 
    providerLoading,
    providerStates,
    enhancementBatchInfo
  } = useQuoteResults(quoteId)
  
  const {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    isConvertingRemoteToUsd,
    isConvertingCompareRemoteToUsd,
    isConvertingRivermateToUsd,
    isConvertingCompareRivermateToUsd,
    isConvertingOysterToUsd,
    isConvertingCompareOysterToUsd,
    isConvertingRipplingToUsd,
    isConvertingCompareRipplingToUsd,
    isConvertingSkuadToUsd,
    isConvertingCompareSkuadToUsd,
    isConvertingVelocityToUsd,
    isConvertingCompareVelocityToUsd,
    usdConversionError,
    autoConvertQuote,
    autoConvertRemoteQuote,
  } = useUSDConversion()

  // Reconciliation hooks must be declared before any early returns
  const { enhancements } = useEnhancementContext()
  const [reconOpen, setReconOpen] = useState(false)
  const [reconLoading, setReconLoading] = useState(false)
  const [reconError, setReconError] = useState<string | null>(null)
  const [reconResult, setReconResult] = useState<ReconciliationResult | null>(null)
  const [reconCurrency, setReconCurrency] = useState<string>('')
  const [currencyInput, setCurrencyInput] = useState<string>('')
  const [reconThreshold, setReconThreshold] = useState<number>(0.04)
  const [reconRiskMode, setReconRiskMode] = useState<boolean>(false)
  const [reconLLMMode, setReconLLMMode] = useState<boolean>(false)

  // Auto-convert primary Deel quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.deel) {
      const cleanup = autoConvertQuote(quoteData.quotes.deel, "deel")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.deel, currentProvider, autoConvertQuote])

  // Auto-convert comparison Deel quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.comparisonDeel) {
      const cleanup = autoConvertQuote(quoteData.quotes.comparisonDeel, "compare")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonDeel, currentProvider, autoConvertQuote])

  // Auto-convert primary Rivermate quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.rivermate) {
      const cleanup = autoConvertQuote(quoteData.quotes.rivermate, "rivermate")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.rivermate, currentProvider, autoConvertQuote])

  // Auto-convert comparison Rivermate quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.comparisonRivermate) {
      const cleanup = autoConvertQuote(quoteData.quotes.comparisonRivermate, "compareRivermate")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRivermate, currentProvider, autoConvertQuote])

  // Auto-convert primary Remote quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.remote) {
      // quotes.remote is RemoteAPIResponse; convert to optimized RemoteQuote for USD conversion
      // Guard in case of legacy shape
      const isRaw = !!(quoteData.quotes.remote as any)?.employment;
      const remoteForConversion = isRaw 
        ? transformToRemoteQuote(quoteData.quotes.remote as any)
        : (quoteData.quotes.remote as any);
      const cleanup = autoConvertRemoteQuote(remoteForConversion, "remote")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.remote, currentProvider, autoConvertRemoteQuote])

  // Auto-convert comparison Remote quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.comparisonRemote) {
      // quotes.comparisonRemote is RemoteAPIResponse; convert to optimized for USD conversion
      // Guard in case of legacy shape
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment;
      const remoteForConversion = isRaw 
        ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any)
        : (quoteData.quotes.comparisonRemote as any);
      const cleanup = autoConvertRemoteQuote(remoteForConversion, "compareRemote")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRemote, currentProvider, autoConvertRemoteQuote])

  // Auto-convert primary Oyster quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.oyster) {
      const cleanup = autoConvertQuote(quoteData.quotes.oyster as any, "oyster")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.oyster, currentProvider, autoConvertQuote])

  // Auto-convert primary Rippling quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rippling' && quoteData.quotes.rippling) {
      const cleanup = autoConvertQuote(quoteData.quotes.rippling as any, "rippling")
      return cleanup
    }
  }, [quoteData?.status, quoteData?.quotes.rippling, currentProvider, autoConvertQuote])

  // Auto-convert comparison Rippling quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rippling' && (quoteData.quotes as any).comparisonRippling) {
      const cleanup = autoConvertQuote((quoteData.quotes as any).comparisonRippling as any, "compareRippling")
      return cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- limit deps to avoid redundant conversions; internal dedupe handles repeats
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonRippling, currentProvider, autoConvertQuote])

  // Auto-convert primary Skuad quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'skuad' && (quoteData.quotes as any).skuad) {
      const cleanup = autoConvertQuote((quoteData.quotes as any).skuad as any, "skuad")
      return cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- limit deps to avoid redundant conversions; internal dedupe handles repeats
  }, [quoteData?.status, (quoteData?.quotes as any)?.skuad, currentProvider, autoConvertQuote])

  // Auto-convert comparison Skuad quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'skuad' && (quoteData.quotes as any).comparisonSkuad) {
      const cleanup = autoConvertQuote((quoteData.quotes as any).comparisonSkuad as any, "compareSkuad")
      return cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- limit deps to avoid redundant conversions; internal dedupe handles repeats
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonSkuad, currentProvider, autoConvertQuote])

  // Auto-convert primary Velocity quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'velocity' && (quoteData.quotes as any).velocity) {
      const cleanup = autoConvertQuote((quoteData.quotes as any).velocity as any, "velocity")
      return cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- limit deps to avoid redundant conversions; internal dedupe handles repeats
  }, [quoteData?.status, (quoteData?.quotes as any)?.velocity, currentProvider, autoConvertQuote])

  // Auto-convert comparison Velocity quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'velocity' && (quoteData.quotes as any).comparisonVelocity) {
      const cleanup = autoConvertQuote((quoteData.quotes as any).comparisonVelocity as any, "compareVelocity")
      return cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- limit deps to avoid redundant conversions; internal dedupe handles repeats
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonVelocity, currentProvider, autoConvertQuote])

  // Auto-convert comparison Oyster quote to USD
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.comparisonOyster) {
      const cleanup = autoConvertQuote(quoteData.quotes.comparisonOyster as any, "compareOyster")
      return cleanup
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- limit deps to avoid redundant conversions; internal dedupe handles repeats
  }, [quoteData?.status, quoteData?.quotes.comparisonOyster, currentProvider, autoConvertQuote])

  // Background conversions for all providers once base quotes are present (deduped internally)
  useEffect(() => {
    if (quoteData?.status !== 'completed') return

    // Deel
    if (quoteData.quotes.deel) {
      autoConvertQuote(quoteData.quotes.deel as any, 'deel')
    }
    if (quoteData.quotes.comparisonDeel) {
      autoConvertQuote(quoteData.quotes.comparisonDeel as any, 'compare')
    }

    // Remote (transform to RemoteQuote for conversion API)
    if (quoteData.quotes.remote) {
      const isRaw = !!(quoteData.quotes.remote as any)?.employment
      const remoteForConversion = isRaw
        ? transformToRemoteQuote(quoteData.quotes.remote as any)
        : (quoteData.quotes.remote as any)
      autoConvertRemoteQuote(remoteForConversion as any, 'remote')
    }
    if (quoteData.quotes.comparisonRemote) {
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment
      const remoteForConversion = isRaw
        ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any)
        : (quoteData.quotes.comparisonRemote as any)
      autoConvertRemoteQuote(remoteForConversion as any, 'compareRemote')
    }

    // Rivermate
    if (quoteData.quotes.rivermate) {
      autoConvertQuote(quoteData.quotes.rivermate as any, 'rivermate')
    }
    if (quoteData.quotes.comparisonRivermate) {
      autoConvertQuote(quoteData.quotes.comparisonRivermate as any, 'compareRivermate')
    }

    // Oyster
    if (quoteData.quotes.oyster) {
      autoConvertQuote(quoteData.quotes.oyster as any, 'oyster')
    }
    if (quoteData.quotes.comparisonOyster) {
      autoConvertQuote(quoteData.quotes.comparisonOyster as any, 'compareOyster')
    }

    // Rippling
    if (quoteData.quotes.rippling) {
      autoConvertQuote(quoteData.quotes.rippling as any, 'rippling')
    }
    if (quoteData.quotes.comparisonRippling) {
      autoConvertQuote(quoteData.quotes.comparisonRippling as any, 'compareRippling')
    }

    // Skuad
    if ((quoteData.quotes as any).skuad) {
      autoConvertQuote((quoteData.quotes as any).skuad as any, 'skuad')
    }
    if ((quoteData.quotes as any).comparisonSkuad) {
      autoConvertQuote((quoteData.quotes as any).comparisonSkuad as any, 'compareSkuad')
    }

    // Velocity
    if ((quoteData.quotes as any).velocity) {
      autoConvertQuote((quoteData.quotes as any).velocity as any, 'velocity')
    }
    if ((quoteData.quotes as any).comparisonVelocity) {
      autoConvertQuote((quoteData.quotes as any).comparisonVelocity as any, 'compareVelocity')
    }
  }, [quoteData?.status, quoteData?.quotes, autoConvertQuote, autoConvertRemoteQuote])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6 flex flex-col items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Loading Quote...
            </h1>
            <LoadingSpinner />
          </div>
        </div>
      </div>
    )
  }

  if (!quoteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-red-600">No Quote Data</h1>
            <Button asChild>
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Back to Calculator
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (quoteData.status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="mb-6">
            <Link
              href="/eor-calculator"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-primary transition-all duration-200 hover:gap-3 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Calculator</span>
            </Link>
          </div>

          <div className="text-center space-y-6">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-red-600">Quote Generation Failed</h1>
              <p className="text-lg text-slate-600">{quoteData.error}</p>
            </div>
            <Button asChild>
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Try Again
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (quoteData.status === 'calculating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Generating Your Quote
              </h1>
              <p className="text-lg text-slate-600">
                Please wait while we calculate your EOR costs for {(quoteData.formData as EORFormData).country}...
              </p>
            </div>

            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm max-w-2xl mx-auto">
              <CardContent className="p-12">
                <div className="flex flex-col items-center space-y-6">
                  <LoadingSpinner />
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="h-4 w-4" />
                    <span>Estimated time: 5-10 seconds</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Reconciliation provider list
  const allProviders: Array<'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity'> = ['deel','remote','rivermate','oyster','rippling','skuad','velocity']

  // Calculate detailed loading state with batch awareness for better UX
  const getReconciliationStatus = () => {
    const loadingBase = allProviders.filter(p => providerStates[p]?.status === 'loading-base').length
    const loadingEnhanced = allProviders.filter(p => providerStates[p]?.status === 'loading-enhanced').length
    const completed = allProviders.filter(p => {
      const s = providerStates[p]?.status
      return s === 'active' || s === 'enhancement-failed' || s === 'failed'
    }).length

    // Base quote loading phase (before enhancement batching)
    if (loadingBase > 0) {
      return {
        ready: false,
        phase: 'base-loading',
        progress: { completed: allProviders.length - loadingBase, total: allProviders.length },
        message: `Loading provider quotes (${allProviders.length - loadingBase}/${allProviders.length})...`
      }
    }
    
    // Enhancement batch processing phase
    if (enhancementBatchInfo.isProcessing) {
      return {
        ready: false,
        phase: 'enhancement-loading', 
        progress: enhancementBatchInfo.batchProgress,
        message: `Enhancing batch ${enhancementBatchInfo.currentBatch}/${enhancementBatchInfo.totalBatches} (${enhancementBatchInfo.batchProgress.completed}/${enhancementBatchInfo.batchProgress.total})...`
      }
    }

    // Legacy individual enhancement loading (fallback)
    if (loadingEnhanced > 0) {
      return {
        ready: false,
        phase: 'enhancement-loading', 
        progress: { completed: allProviders.length - loadingEnhanced, total: allProviders.length },
        message: `Enhancing with AI (${allProviders.length - loadingEnhanced}/${allProviders.length})...`
      }
    }

    // Finalizing phase
    if (completed < allProviders.length) {
      return {
        ready: false,
        phase: 'finalizing',
        progress: { completed, total: allProviders.length },
        message: 'Finalizing reconciliation...'
      }
    }

    // Ready phase
    return {
      ready: true,
      phase: 'ready',
      progress: { completed: allProviders.length, total: allProviders.length },
      message: 'Start Reconciliation'
    }
  }

  const reconStatus = getReconciliationStatus()

  // Render dynamic button content based on loading phase
  const renderReconciliationButtonContent = () => {
    switch (reconStatus.phase) {
      case 'base-loading':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{reconStatus.message}</span>
          </>
        )
      
      case 'enhancement-loading':
        return (
          <>
            <Brain className="h-4 w-4 animate-pulse text-purple-600" />
            <span>{reconStatus.message}</span>
          </>
        )
      
      case 'finalizing':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{reconStatus.message}</span>
          </>
        )
      
      case 'ready':
      default:
        return <span>{reconStatus.message}</span>
    }
  }

  const formatMoney = (value: number, currency: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value) } catch { return `${value.toFixed(2)} ${currency}` }
  }


  const performReconciliation = async (targetCurrency: string, threshold: number, riskMode: boolean, useLLM: boolean): Promise<ReconciliationResult> => {
    const response = await fetch('/api/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enhancements: enhancements as Record<ProviderType, EnhancedQuote>,
        targetCurrency,
        threshold,
        riskMode,
        useLLM
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Reconciliation failed')
    }

    return await response.json()
  }

  const startReconciliation = async () => {
    try {
      setReconError(null)
      const formCurrency = (quoteData?.formData as EORFormData)?.currency || quoteData?.metadata?.currency || 'USD'
      setReconCurrency(formCurrency)
      setCurrencyInput(formCurrency)
      setReconOpen(true)
      setReconLoading(true)
      const result = await performReconciliation(formCurrency, reconThreshold, reconRiskMode, reconLLMMode)
      setReconResult(result)
    } catch (e: any) {
      setReconError(e?.message || 'Reconciliation failed')
    } finally {
      setReconLoading(false)
    }
  }

  const rerunReconciliation = async (opts?: { currency?: string; threshold?: number; risk?: boolean; llm?: boolean }) => {
    const currency = opts?.currency ?? reconCurrency
    const threshold = opts?.threshold ?? reconThreshold
    const risk = opts?.risk ?? reconRiskMode
    const llm = opts?.llm ?? reconLLMMode
    setReconCurrency(currency)
    setReconThreshold(threshold)
    setReconRiskMode(risk)
    setReconLLMMode(llm)
    setReconLoading(true)
    try {
      const result = await performReconciliation(currency, threshold, risk, llm)
      setReconResult(result)
      setReconError(null)
    } catch (e: any) {
      setReconError(e?.message || 'Reconciliation failed')
    } finally {
      setReconLoading(false)
    }
  }

  const exportRecon = () => {
    if (!reconResult) return
    const blob = new Blob([JSON.stringify(reconResult, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reconciliation_${quoteId || 'quote'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderQuote = () => {
    if (providerLoading[currentProvider]) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-slate-600">Loading {currentProvider === 'deel' ? 'Deel' : currentProvider === 'remote' ? 'Remote' : currentProvider === 'rivermate' ? 'Rivermate' : currentProvider === 'oyster' ? 'Oyster' : currentProvider === 'rippling' ? 'Rippling' : currentProvider === 'skuad' ? 'Skuad' : 'Velocity Global'} quote...</p>
          </div>
        </div>
      );
    }

    const quote = currentProvider === 'deel'
      ? (quoteData.quotes.deel ? { ...quoteData.quotes.deel, provider: 'deel' } : quoteData.quotes.deel)
      : currentProvider === 'remote'
        ? (quoteData.quotes.remote 
            // If raw RemoteAPIResponse present, transform for display; if legacy optimized present, we cannot build full breakdown
            ? (('employment' in (quoteData.quotes.remote as any)) 
                ? transformRemoteResponseToQuote(quoteData.quotes.remote as any)
                : undefined)
            : undefined)
        : currentProvider === 'rivermate' ? (
            // Rivermate: stored optimized quote for conversion; build display-friendly quote here
            quoteData.quotes.rivermate && ('taxItems' in (quoteData.quotes.rivermate as any))
              ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any)
              : (quoteData.quotes.rivermate as any)
          ) : currentProvider === 'oyster' ? (
            // Oyster: stored optimized quote for conversion; build display-friendly quote here
            quoteData.quotes.oyster && ('contributions' in (quoteData.quotes.oyster as any))
              ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any)
              : (quoteData.quotes.oyster as any)
          ) : currentProvider === 'rippling' ? (
            // Rippling: stored as display Quote
            quoteData.quotes.rippling ? { ...quoteData.quotes.rippling, provider: 'rippling' } : quoteData.quotes.rippling
          ) : currentProvider === 'skuad' ? (
            (quoteData.quotes as any).skuad ? { ...(quoteData.quotes as any).skuad, provider: 'skuad' } : (quoteData.quotes as any).skuad
          ) : (
            (quoteData.quotes as any).velocity ? { ...(quoteData.quotes as any).velocity, provider: 'velocity' } : (quoteData.quotes as any).velocity
          );

    // Debug logging for quote data issues
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Quote Debug] Provider: ${currentProvider}`, {
        rawQuoteData: currentProvider === 'deel' ? quoteData.quotes.deel : 'N/A',
        processedQuote: quote,
        quoteKeys: quote ? Object.keys(quote) : 'null/undefined',
        isEmpty: quote && typeof quote === 'object' && Object.keys(quote).length === 0
      })
    }

    const dualCurrencyQuotes = currentProvider === 'deel'
      ? quoteData.dualCurrencyQuotes?.deel
      : currentProvider === 'remote'
        ? quoteData.dualCurrencyQuotes?.remote
        : currentProvider === 'rivermate'
          ? quoteData.dualCurrencyQuotes?.rivermate
          : currentProvider === 'oyster' 
            ? quoteData.dualCurrencyQuotes?.oyster 
            : currentProvider === 'rippling'
              ? quoteData.dualCurrencyQuotes?.rippling
              : currentProvider === 'skuad'
                ? (quoteData.dualCurrencyQuotes as any)?.skuad
                : (quoteData.dualCurrencyQuotes as any)?.velocity;
    const isConvertingToUSD = currentProvider === 'deel'
      ? isConvertingDeelToUsd
      : currentProvider === 'remote'
        ? isConvertingRemoteToUsd
        : currentProvider === 'rivermate'
          ? isConvertingRivermateToUsd
          : currentProvider === 'oyster' 
            ? isConvertingOysterToUsd 
            : currentProvider === 'rippling' 
              ? isConvertingRipplingToUsd 
              : currentProvider === 'skuad' 
                ? isConvertingSkuadToUsd 
                : isConvertingVelocityToUsd;
    const conversions = currentProvider === 'deel'
      ? usdConversions.deel
      : currentProvider === 'remote'
        ? usdConversions.remote
        : currentProvider === 'rivermate'
          ? usdConversions.rivermate
          : currentProvider === 'oyster' 
            ? usdConversions.oyster 
            : currentProvider === 'rippling'
              ? (usdConversions as any).rippling
              : currentProvider === 'skuad'
                ? (usdConversions as any).skuad
                : (usdConversions as any).velocity;
    const eorForm = quoteData.formData as EORFormData;

    if (!quote && !dualCurrencyQuotes) return null;

    // Use enhanced quote card for single currency mode, fallback to generic for dual currency
    // Show both: Base (Generic) first, then Enhanced (if we have a base quote)
    return (
      <div className="space-y-6">
        <GenericQuoteCard
          quote={dualCurrencyQuotes?.isDualCurrencyMode ? undefined : quote}
          title={`${quote?.country || eorForm.country}`}
          provider={currentProvider}
          usdConversions={conversions}
          isConvertingToUSD={isConvertingToUSD}
          usdConversionError={usdConversionError}
          dualCurrencyQuotes={dualCurrencyQuotes}
          originalCurrency={eorForm.originalCurrency || undefined}
          selectedCurrency={eorForm.currency}
        />

        {quote && (
          <EnhancedQuoteCard
            provider={currentProvider as ProviderType}
            baseQuote={quote}
            formData={eorForm}
            quoteType={eorForm.quoteType}
            showRetry={true}
          />
        )}
      </div>
    );
  };

  const renderComparison = () => {
    const eorForm = quoteData.formData as EORFormData;
    if (providerLoading[currentProvider] || !eorForm.enableComparison) return null;

    if (currentProvider === 'deel') {
      if (!quoteData.quotes.deel || !quoteData.quotes.comparisonDeel) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="deel"
            primaryQuote={quoteData.quotes.deel}
            comparisonQuote={quoteData.quotes.comparisonDeel}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingDeelToUsd}
            isConvertingComparisonToUSD={isConvertingCompareToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.deel}
          />

          {/* Enhanced comparison (primary + compare) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="deel"
              baseQuote={{ ...quoteData.quotes.deel, provider: 'deel' } as any}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="deel"
              baseQuote={{ ...quoteData.quotes.comparisonDeel, provider: 'deel' } as any}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    if (currentProvider === 'rivermate') {
      if (!quoteData.quotes.rivermate || !quoteData.quotes.comparisonRivermate) return null;

      // Transform optimized rivermate quotes to display quotes when not in dual mode
      const primaryIsOptimized = 'taxItems' in (quoteData.quotes.rivermate as any);
      const compareIsOptimized = 'taxItems' in (quoteData.quotes.comparisonRivermate as any);

      const primaryDisplay = primaryIsOptimized
        ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any)
        : (quoteData.quotes.rivermate as any);
      const compareDisplay = compareIsOptimized
        ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.comparisonRivermate as any)
        : (quoteData.quotes.comparisonRivermate as any);

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="rivermate"
            primaryQuote={primaryDisplay}
            comparisonQuote={compareDisplay}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={{ deel: usdConversions.rivermate, compare: usdConversions.compareRivermate }}
            isConvertingPrimaryToUSD={isConvertingRivermateToUsd}
            isConvertingComparisonToUSD={isConvertingCompareRivermateToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.rivermate}
          />

          {/* Enhanced comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="rivermate"
              baseQuote={primaryDisplay}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="rivermate"
              baseQuote={compareDisplay}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    if (currentProvider === 'oyster') {
      if (!quoteData.quotes.oyster || !quoteData.quotes.comparisonOyster) return null;

      const oysterPrimaryDisplay = ('contributions' in (quoteData.quotes.oyster as any))
        ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any)
        : (quoteData.quotes.oyster as any);
      const oysterCompareDisplay = ('contributions' in (quoteData.quotes.comparisonOyster as any))
        ? transformOysterQuoteToDisplayQuote(quoteData.quotes.comparisonOyster as any)
        : (quoteData.quotes.comparisonOyster as any);

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="oyster"
            primaryQuote={oysterPrimaryDisplay}
            comparisonQuote={oysterCompareDisplay}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={{ deel: usdConversions.oyster, compare: usdConversions.compareOyster }}
            isConvertingPrimaryToUSD={isConvertingOysterToUsd}
            isConvertingComparisonToUSD={isConvertingCompareOysterToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.oyster}
          />

          {/* Enhanced comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="oyster"
              baseQuote={oysterPrimaryDisplay}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="oyster"
              baseQuote={oysterCompareDisplay}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    if (currentProvider === 'remote') {
      if (!quoteData.quotes.remote || !quoteData.quotes.comparisonRemote) return null;

      const providerDual = quoteData.dualCurrencyQuotes?.remote;
      const hasDualCompare = providerDual?.isDualCurrencyMode && providerDual?.hasComparison;

      // Build flattened dual objects for each card (like QuoteComparison does)
      const primaryCardDualQuotes = hasDualCompare ? {
        ...providerDual,
        selectedCurrencyQuote: providerDual.selectedCurrencyQuote,
        localCurrencyQuote: providerDual.localCurrencyQuote,
        compareSelectedCurrencyQuote: null,
        compareLocalCurrencyQuote: null,
        hasComparison: false,
      } : undefined;

      const comparisonCardDualQuotes = hasDualCompare ? {
        ...providerDual,
        selectedCurrencyQuote: providerDual.compareSelectedCurrencyQuote,
        localCurrencyQuote: providerDual.compareLocalCurrencyQuote,
        compareSelectedCurrencyQuote: null,
        compareLocalCurrencyQuote: null,
        hasComparison: false,
      } : undefined;

      // Show both Generic (base) and Enhanced for remote comparisons
      if (hasDualCompare) {
        return (
          <div className="space-y-6">
            {/* Original Generic cards with dual-currency details (Base first) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GenericQuoteCard
                quote={undefined}
                title={`${(quoteData.formData as EORFormData).country}`}
                provider="remote"
                badgeText="Main Quote"
                badgeColor="bg-blue-100 text-blue-800"
                usdConversions={usdConversions.remote}
                isConvertingToUSD={isConvertingRemoteToUsd}
                usdConversionError={usdConversionError}
                compact={true}
                originalCurrency={(quoteData.formData as EORFormData).originalCurrency || undefined}
                selectedCurrency={(quoteData.formData as EORFormData).currency}
                dualCurrencyQuotes={primaryCardDualQuotes}
              />
              <GenericQuoteCard
                quote={undefined}
                title={`${quoteData.formData.compareCountry}`}
                provider="remote"
                badgeText="Compare Quote"
                badgeColor="bg-green-100 text-green-800"
                usdConversions={usdConversions.compareRemote}
                isConvertingToUSD={isConvertingCompareRemoteToUsd}
                usdConversionError={usdConversionError}
                compact={true}
                dualCurrencyQuotes={comparisonCardDualQuotes}
              />
            </div>

            {/* Enhanced (based on transformed display quotes) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EnhancedQuoteCard
                provider="remote"
                baseQuote={('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined}
                formData={{ ...eorForm, country: eorForm.country }}
                quoteType="all-inclusive"
                compact={true}
                showRetry={true}
              />
              <EnhancedQuoteCard
                provider="remote"
                baseQuote={('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined}
                formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
                quoteType="all-inclusive"
                compact={true}
                showRetry={true}
              />
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          {/* Base (Generic) first */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GenericQuoteCard
              quote={transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse)}
              title={`${(quoteData.formData as EORFormData).country}`}
              provider="remote"
              badgeText="Main Quote"
              badgeColor="bg-blue-100 text-blue-800"
              usdConversions={usdConversions.remote}
              isConvertingToUSD={isConvertingRemoteToUsd}
              usdConversionError={usdConversionError}
              compact={true}
            />
            <GenericQuoteCard
              quote={transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse)}
              title={`${quoteData.formData.compareCountry}`}
              provider="remote"
              badgeText="Compare Quote"
              badgeColor="bg-green-100 text-green-800"
              usdConversions={usdConversions.compareRemote}
              isConvertingToUSD={isConvertingCompareRemoteToUsd}
              usdConversionError={usdConversionError}
              compact={true}
            />
          </div>

          {/* Enhanced after base */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="remote"
              baseQuote={('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="remote"
              baseQuote={('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    if (currentProvider === 'rippling') {
      if (!quoteData.quotes.rippling || !(quoteData.quotes as any).comparisonRippling) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="rippling"
            primaryQuote={quoteData.quotes.rippling as any}
            comparisonQuote={(quoteData.quotes as any).comparisonRippling as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingRipplingToUsd}
            isConvertingComparisonToUSD={isConvertingCompareRipplingToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.rippling}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="rippling"
              baseQuote={{ ...(quoteData.quotes.rippling as any), provider: 'rippling' }}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="rippling"
              baseQuote={{ ...((quoteData.quotes as any).comparisonRippling as any), provider: 'rippling' }}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    if (currentProvider === 'skuad') {
      if (!((quoteData.quotes as any).skuad) || !((quoteData.quotes as any).comparisonSkuad)) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="skuad"
            primaryQuote={(quoteData.quotes as any).skuad as any}
            comparisonQuote={(quoteData.quotes as any).comparisonSkuad as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingSkuadToUsd}
            isConvertingComparisonToUSD={isConvertingCompareSkuadToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.skuad}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="skuad"
              baseQuote={{ ...((quoteData.quotes as any).skuad as any), provider: 'skuad' }}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="skuad"
              baseQuote={{ ...((quoteData.quotes as any).comparisonSkuad as any), provider: 'skuad' }}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    if (currentProvider === 'velocity') {
      if (!((quoteData.quotes as any).velocity) || !((quoteData.quotes as any).comparisonVelocity)) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="velocity"
            primaryQuote={(quoteData.quotes as any).velocity as any}
            comparisonQuote={(quoteData.quotes as any).comparisonVelocity as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingVelocityToUsd}
            isConvertingComparisonToUSD={isConvertingCompareVelocityToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.velocity}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard
              provider="velocity"
              baseQuote={{ ...((quoteData.quotes as any).velocity as any), provider: 'velocity' }}
              formData={{ ...eorForm, country: eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="velocity"
              baseQuote={{ ...((quoteData.quotes as any).comparisonVelocity as any), provider: 'velocity' }}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={true}
              showRetry={true}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  // Completed state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Fixed Action: Start Reconciliation */}
      <div className="fixed top-5 right-5 z-50">
        <Button
          onClick={startReconciliation}
          disabled={!reconStatus.ready}
          className="bg-yellow-400 text-black hover:bg-yellow-500 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200"
        >
          {renderReconciliationButtonContent()}
        </Button>
      </div>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Your EOR Quote
              </h1>
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <ProviderSelector
              currentProvider={currentProvider}
              onProviderChange={switchProvider}
              loading={providerLoading}
              disabled={loading || quoteData?.status !== 'completed'}
              providerStates={providerStates}
            />
          </div>

          {(() => {
            const eorForm = quoteData.formData as EORFormData;
            if (eorForm.enableComparison) {
              return (
                <div className="max-w-7xl mx-auto">
                  {renderComparison()}
                </div>
              );
            } else {
              return (
                <div className="max-w-4xl mx-auto">
                  {renderQuote()}
                </div>
              );
            }
          })()}

        </div>
      </div>

      {/* Reconciliation Modal */}
      {reconOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-slate-50/95 to-white/95 backdrop-blur-sm animate-in fade-in-0 duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-black/50" onClick={() => setReconOpen(false)} />
          <Card className="relative border-0 shadow-2xl bg-white/90 backdrop-blur-md w-[92vw] max-w-6xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-slate-50/50 to-white/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Reconciliation
                  </span>
                  <span className="text-slate-400 text-sm font-normal">{reconResult ? `as of ${new Date(reconResult.metadata.generatedAt).toLocaleString()}` : ''}</span>
                </CardTitle>
                <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    className="text-sm w-28 h-8"
                    value={currencyInput || reconCurrency || ((quoteData?.formData as EORFormData)?.currency || 'USD')}
                    onChange={(e) => setCurrencyInput((e.target.value || '').toUpperCase())}
                    onBlur={() => rerunReconciliation({ currency: (currencyInput || reconCurrency || '').toUpperCase() })}
                    onKeyDown={(e) => { if (e.key === 'Enter') rerunReconciliation({ currency: (currencyInput || reconCurrency || '').toUpperCase() }) }}
                    placeholder="Currency"
                    title="Reconciliation currency (e.g., USD, EUR)"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      const def = (quoteData?.formData as EORFormData)?.currency || 'USD'
                      setCurrencyInput(def.toUpperCase())
                      rerunReconciliation({ currency: def.toUpperCase() })
                    }}
                  >Reset</Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-slate-600 font-medium">Threshold %</label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    className="w-24 h-8 text-sm"
                    value={(reconThreshold * 100).toString()}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(10, Number(e.target.value) || 0)) / 100
                      rerunReconciliation({ threshold: v })
                    }}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                  <Checkbox
                    checked={reconRiskMode}
                    onCheckedChange={(checked) => rerunReconciliation({ risk: !!checked })}
                  />
                  Risk-adjusted
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                  <Checkbox
                    checked={reconLLMMode}
                    onCheckedChange={(checked) => rerunReconciliation({ llm: !!checked })}
                  />
                  AI Enhanced
                </label>
                  <Button variant="secondary" size="sm" onClick={exportRecon}>Export</Button>
                  <Button variant="ghost" size="sm" onClick={() => setReconOpen(false)}>Close</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-auto max-h-[70vh] bg-gradient-to-br from-white to-slate-50/30">
              {reconLoading && (
                <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <div className="text-lg font-medium text-blue-800">Reconciling Providers…</div>
                      <div className="text-sm text-blue-600">Analyzing pricing data across all providers</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {reconError && (
                <Card className="border-0 shadow-lg bg-gradient-to-r from-red-50/50 to-rose-50/50 border border-red-200/30">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-red-800 mb-1">Error</div>
                    <div className="text-sm text-red-700">{reconError}</div>
                  </CardContent>
                </Card>
              )}
              {!reconLoading && reconResult && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{reconResult.summary.currency}</div>
                        <div className="text-xs text-blue-600 font-medium">Currency</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-green-700 capitalize">{reconResult.summary.cheapest}</div>
                        <div className="text-xs text-green-600 font-medium">Cheapest</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-700">{reconResult.summary.within4Count}</div>
                        <div className="text-xs text-purple-600 font-medium">Within 4%</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-amber-700">{formatMoney(reconResult.summary.average, reconResult.summary.currency)}</div>
                        <div className="text-xs text-amber-600 font-medium">Average</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-slate-700">{formatMoney(reconResult.summary.median, reconResult.summary.currency)}</div>
                        <div className="text-xs text-slate-600 font-medium">Median</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Provider Details Table */}
                  <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        Provider Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/50">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">Provider</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-700">Total</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-700">Delta</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-700">% Over Min</th>
                              <th className="text-center px-4 py-3 font-semibold text-slate-700">Within 4%</th>
                              <th className="text-center px-4 py-3 font-semibold text-slate-700">Confidence</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reconResult.items.sort((a,b)=>a.total-b.total).map((it) => (
                              <tr key={it.provider} className="hover:bg-slate-50/50 transition-colors duration-150">
                                <td className="px-4 py-3 font-semibold text-slate-800 capitalize">{it.provider}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-700">{formatMoney(it.total, reconResult.summary.currency)}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{formatMoney(it.delta, reconResult.summary.currency)}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{(it.pct*100).toFixed(2)}%</td>
                                <td className="px-4 py-3 text-center">
                                  {it.within4 ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200/50">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-600 border border-slate-200">
                                      No
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="font-medium text-slate-700">{Math.round((it.confidence||0)*100)}%</span>
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-sm">{(it.notes||[]).join(' · ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {reconResult.excluded?.length > 0 && (
                    <Card className="border-0 shadow-sm bg-gradient-to-r from-amber-50/50 to-orange-50/50 border border-amber-200/30">
                      <CardContent className="p-4">
                        <div className="text-sm text-amber-800 font-medium mb-2">Excluded Providers</div>
                        <div className="text-xs text-amber-700">
                          {reconResult.excluded.map(e => `${e.provider} (${e.reason})`).join(', ')}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
});
QuotePageContent.displayName = 'QuotePageContent';

export default function QuotePage() {
  return (
    <ErrorBoundary
      fallbackTitle="Quote Loading Error"
      fallbackMessage="There was a problem loading your quote. This might be due to corrupted data or a temporary issue."
      onError={(error, errorInfo) => {
        console.error('Quote page error:', error, errorInfo)
      }}
    >
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
          <div className="container mx-auto px-6 py-8 max-w-7xl">
            <div className="text-center space-y-6 flex flex-col items-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Loading Quote...
              </h1>
              <LoadingSpinner />
            </div>
          </div>
        </div>
      }>
        <EnhancementProvider>
          <QuotePageContent />
        </EnhancementProvider>
      </Suspense>
    </ErrorBoundary>
  )
}
