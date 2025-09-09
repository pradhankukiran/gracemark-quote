"use client"

import { useEffect, Suspense, memo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle, Loader2, Brain, FileText, Filter, Target, Trophy, ListChecks } from "lucide-react"
import Link from "next/link"
import { useQuoteResults } from "./hooks/useQuoteResults"
import { useUSDConversion } from "../eor-calculator/hooks/useUSDConversion"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"
import { QuoteComparison } from "../eor-calculator/components/QuoteComparison"
import { ErrorBoundary } from "@/lib/shared/components/ErrorBoundary"
import { ProviderSelector } from "./components/ProviderSelector"
import { ProviderLogo } from "./components/ProviderLogo"
import { EnhancementProvider, useEnhancementContext } from "@/hooks/enhancement/EnhancementContext"
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

  // --- RECONCILIATION STATE ---
  const { enhancements } = useEnhancementContext()
  const [isReconModalOpen, setIsReconModalOpen] = useState(false)
  const [reconSteps, setReconSteps] = useState<{type: string, title: string, description?: string}[]>([])
  const [finalChoice, setFinalChoice] = useState<{ provider: string; price: number; currency: string } | null>(null)

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isReconModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isReconModalOpen])

  // --- AUTO USD CONVERSIONS (UNCHANGED) ---
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.deel) {
      autoConvertQuote(quoteData.quotes.deel, "deel")
    }
  }, [quoteData?.status, quoteData?.quotes.deel, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.comparisonDeel) {
      autoConvertQuote(quoteData.quotes.comparisonDeel, "compare")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonDeel, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.rivermate) {
      autoConvertQuote(quoteData.quotes.rivermate, "rivermate")
    }
  }, [quoteData?.status, quoteData?.quotes.rivermate, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.comparisonRivermate) {
      autoConvertQuote(quoteData.quotes.comparisonRivermate, "compareRivermate")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRivermate, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.remote) {
      const isRaw = !!(quoteData.quotes.remote as any)?.employment;
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.remote as any) : (quoteData.quotes.remote as any);
      autoConvertRemoteQuote(remoteForConversion, "remote")
    }
  }, [quoteData?.status, quoteData?.quotes.remote, currentProvider, autoConvertRemoteQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.comparisonRemote) {
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment;
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any) : (quoteData.quotes.comparisonRemote as any);
      autoConvertRemoteQuote(remoteForConversion, "compareRemote")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRemote, currentProvider, autoConvertRemoteQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.oyster) {
      autoConvertQuote(quoteData.quotes.oyster as any, "oyster")
    }
  }, [quoteData?.status, quoteData?.quotes.oyster, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rippling' && quoteData.quotes.rippling) {
      autoConvertQuote(quoteData.quotes.rippling as any, "rippling")
    }
  }, [quoteData?.status, quoteData?.quotes.rippling, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rippling' && (quoteData.quotes as any).comparisonRippling) {
      autoConvertQuote((quoteData.quotes as any).comparisonRippling as any, "compareRippling")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonRippling, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'skuad' && (quoteData.quotes as any).skuad) {
      autoConvertQuote((quoteData.quotes as any).skuad as any, "skuad")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.skuad, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'skuad' && (quoteData.quotes as any).comparisonSkuad) {
      autoConvertQuote((quoteData.quotes as any).comparisonSkuad as any, "compareSkuad")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonSkuad, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'velocity' && (quoteData.quotes as any).velocity) {
      autoConvertQuote((quoteData.quotes as any).velocity as any, "velocity")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.velocity, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'velocity' && (quoteData.quotes as any).comparisonVelocity) {
      autoConvertQuote((quoteData.quotes as any).comparisonVelocity as any, "compareVelocity")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonVelocity, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.comparisonOyster) {
      autoConvertQuote(quoteData.quotes.comparisonOyster as any, "compareOyster")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonOyster, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status !== 'completed') return
    if (quoteData.quotes.deel) autoConvertQuote(quoteData.quotes.deel as any, 'deel')
    if (quoteData.quotes.comparisonDeel) autoConvertQuote(quoteData.quotes.comparisonDeel as any, 'compare')
    if (quoteData.quotes.remote) {
      const isRaw = !!(quoteData.quotes.remote as any)?.employment
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.remote as any) : (quoteData.quotes.remote as any)
      autoConvertRemoteQuote(remoteForConversion as any, 'remote')
    }
    if (quoteData.quotes.comparisonRemote) {
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any) : (quoteData.quotes.comparisonRemote as any)
      autoConvertRemoteQuote(remoteForConversion as any, 'compareRemote')
    }
    if (quoteData.quotes.rivermate) autoConvertQuote(quoteData.quotes.rivermate as any, 'rivermate')
    if (quoteData.quotes.comparisonRivermate) autoConvertQuote(quoteData.quotes.comparisonRivermate as any, 'compareRivermate')
    if (quoteData.quotes.oyster) autoConvertQuote(quoteData.quotes.oyster as any, 'oyster')
    if (quoteData.quotes.comparisonOyster) autoConvertQuote(quoteData.quotes.comparisonOyster as any, 'compareOyster')
    if (quoteData.quotes.rippling) autoConvertQuote(quoteData.quotes.rippling as any, 'rippling')
    if (quoteData.quotes.comparisonRippling) autoConvertQuote(quoteData.quotes.comparisonRippling as any, 'compareRippling')
    if ((quoteData.quotes as any).skuad) autoConvertQuote((quoteData.quotes as any).skuad as any, 'skuad')
    if ((quoteData.quotes as any).comparisonSkuad) autoConvertQuote((quoteData.quotes as any).comparisonSkuad as any, 'compareSkuad')
    if ((quoteData.quotes as any).velocity) autoConvertQuote((quoteData.quotes as any).velocity as any, 'velocity')
    if ((quoteData.quotes as any).comparisonVelocity) autoConvertQuote((quoteData.quotes as any).comparisonVelocity as any, 'compareVelocity')
  }, [quoteData?.status, quoteData?.quotes, autoConvertQuote, autoConvertRemoteQuote])

  // --- LOADING & ERROR STATES (UNCHANGED) ---
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

  // --- REFRESHED RECONCILIATION LOGIC ---
  const allProviders: Array<ProviderType> = ['deel','remote','rivermate','oyster','rippling','skuad','velocity']

  const getReconciliationStatus = () => {
    const completed = allProviders.filter(p => {
      const s = providerStates[p]?.status
      return s === 'active' || s === 'enhancement-failed' || s === 'failed'
    }).length
    const isReady = completed >= allProviders.length && !enhancementBatchInfo.isProcessing
    return {
      ready: isReady,
      message: isReady ? 'Start Reconciliation' : 'Enhancing quotes...'
    }
  }
  
  const reconStatus = getReconciliationStatus()

  const renderReconciliationButtonContent = () => {
    if (reconStatus.ready) return <span>{reconStatus.message}</span>
    return <><Brain className="h-4 w-4 animate-pulse text-purple-600" /><span>{reconStatus.message}</span></>
  }

  const formatMoney = (value: number, currency: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value) } catch { return `${value.toFixed(2)} ${currency}` }
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const startReconciliation = async () => {
    setIsReconModalOpen(true)
    setReconSteps([])
    setFinalChoice(null)

    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'

    try {
      await sleep(500)
      setReconSteps(prev => [...prev, { type: 'start', title: 'Starting Reconciliation' }])

      const prices: { provider: string; price: number }[] = allProviders
        .map(p => ({ provider: p, price: enhancements[p]?.finalTotal! }))
        .filter(p => p.price !== undefined && p.price !== null);

      if (prices.length === 0) {
        setReconSteps(prev => [...prev, { type: 'error', title: 'Error: No provider prices available.'}]);
        return;
      }
      
      await sleep(500)
      setReconSteps(prev => [...prev, { type: 'data', title: 'Fetched Final Prices', description: `Found ${prices.length} enhanced quotes.` }])

      const deel = prices.find(p => p.provider === 'deel');
      if (!deel) {
        setReconSteps(prev => [...prev, { type: 'error', title: 'Deel Price Not Available', description: 'Cannot proceed without Deel price as a reference.' }]);
        return;
      }

      await sleep(500)
      setReconSteps(prev => [...prev, { type: 'target', title: 'Set Deel as Reference', description: `Using Deel's price of ${formatMoney(deel.price, currency)} as the baseline.` }]);

      const lowerBound = deel.price * 0.96;
      const upperBound = deel.price * 1.04;
      await sleep(500)
      setReconSteps(prev => [...prev, { type: 'calculate', title: 'Calculated 4% Range', description: `[${formatMoney(lowerBound, currency)}, ${formatMoney(upperBound, currency)}]` }]);

      const candidates: { provider: string; price: number }[] = [];
      setReconSteps(prev => [...prev, { type: 'filter', title: 'Filtering Providers'}]);
      
      for (const p of prices) {
        await sleep(500);
        const inRange = p.price >= lowerBound && p.price <= upperBound;
        if (inRange) candidates.push(p);
        const step = {
          type: 'check' as const,
          title: `Checked ${p.provider}`,
          description: `${formatMoney(p.price, currency)} -> ${inRange ? '✅ Within range' : '❌ Outside range'}`
        }
        setReconSteps(prev => [...prev, step]);
      }

      if (candidates.length === 0) {
        setReconSteps(prev => [...prev, { type: 'error', title: 'No providers found within the 4% range.'}]);
        return;
      }

      await sleep(500);
      setReconSteps(prev => [...prev, { type: 'list', title: 'Identified Candidates', description: `${candidates.map(c => c.provider).join(', ')}` }]);

      await sleep(500);
      setReconSteps(prev => [...prev, { type: 'select', title: 'Selecting Highest Price from Candidates' }]);
      
      const choice = candidates.reduce((max, current) => (current.price > max.price ? current : max), candidates[0]);

      await sleep(800);
      setFinalChoice({ ...choice, currency });
      setReconSteps(prev => [...prev, { type: 'trophy', title: `Provider of Choice: ${choice.provider}` }]);

    } catch (error) {
      console.error("Reconciliation failed", error);
      setReconSteps(prev => [...prev, { type: 'error', title: 'An unexpected error occurred during reconciliation.'}]);
    }
  }

  // --- RENDER LOGIC (UNCHANGED) ---
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
            ? (('employment' in (quoteData.quotes.remote as any)) 
                ? transformRemoteResponseToQuote(quoteData.quotes.remote as any)
                : undefined)
            : undefined)
        : currentProvider === 'rivermate' ? (
            quoteData.quotes.rivermate && ('taxItems' in (quoteData.quotes.rivermate as any))
              ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any)
              : (quoteData.quotes.rivermate as any)
          ) : currentProvider === 'oyster' ? (
            quoteData.quotes.oyster && ('contributions' in (quoteData.quotes.oyster as any))
              ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any)
              : (quoteData.quotes.oyster as any)
          ) : currentProvider === 'rippling' ? (
            quoteData.quotes.rippling ? { ...quoteData.quotes.rippling, provider: 'rippling' } : quoteData.quotes.rippling
          ) : currentProvider === 'skuad' ? (
            (quoteData.quotes as any).skuad ? { ...(quoteData.quotes as any).skuad, provider: 'skuad' } : (quoteData.quotes as any).skuad
          ) : (
            (quoteData.quotes as any).velocity ? { ...(quoteData.quotes as any).velocity, provider: 'velocity' } : (quoteData.quotes as any).velocity
          );

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

      const primaryIsOptimized = 'taxItems' in (quoteData.quotes.rivermate as any);
      const compareIsOptimized = 'taxItems' in (quoteData.quotes.comparisonRivermate as any);

      const primaryDisplay = primaryIsOptimized ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any) : (quoteData.quotes.rivermate as any);
      const compareDisplay = compareIsOptimized ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.comparisonRivermate as any) : (quoteData.quotes.comparisonRivermate as any);

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard provider="rivermate" baseQuote={primaryDisplay} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            <EnhancedQuoteCard provider="rivermate" baseQuote={compareDisplay} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
          </div>
        </div>
      );
    }

    if (currentProvider === 'oyster') {
      if (!quoteData.quotes.oyster || !quoteData.quotes.comparisonOyster) return null;

      const oysterPrimaryDisplay = ('contributions' in (quoteData.quotes.oyster as any)) ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any) : (quoteData.quotes.oyster as any);
      const oysterCompareDisplay = ('contributions' in (quoteData.quotes.comparisonOyster as any)) ? transformOysterQuoteToDisplayQuote(quoteData.quotes.comparisonOyster as any) : (quoteData.quotes.comparisonOyster as any);

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard provider="oyster" baseQuote={oysterPrimaryDisplay} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            <EnhancedQuoteCard provider="oyster" baseQuote={oysterCompareDisplay} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
          </div>
        </div>
      );
    }

    if (currentProvider === 'remote') {
      if (!quoteData.quotes.remote || !quoteData.quotes.comparisonRemote) return null;

      const providerDual = quoteData.dualCurrencyQuotes?.remote;
      const hasDualCompare = providerDual?.isDualCurrencyMode && providerDual?.hasComparison;

      const primaryCardDualQuotes = hasDualCompare ? { ...providerDual, selectedCurrencyQuote: providerDual.selectedCurrencyQuote, localCurrencyQuote: providerDual.localCurrencyQuote, compareSelectedCurrencyQuote: null, compareLocalCurrencyQuote: null, hasComparison: false } : undefined;
      const comparisonCardDualQuotes = hasDualCompare ? { ...providerDual, selectedCurrencyQuote: providerDual.compareSelectedCurrencyQuote, localCurrencyQuote: providerDual.compareLocalCurrencyQuote, compareSelectedCurrencyQuote: null, compareLocalCurrencyQuote: null, hasComparison: false } : undefined;

      if (hasDualCompare) {
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GenericQuoteCard quote={undefined} title={`${(quoteData.formData as EORFormData).country}`} provider="remote" badgeText="Main Quote" badgeColor="bg-blue-100 text-blue-800" usdConversions={usdConversions.remote} isConvertingToUSD={isConvertingRemoteToUsd} usdConversionError={usdConversionError} compact={true} originalCurrency={(quoteData.formData as EORFormData).originalCurrency || undefined} selectedCurrency={(quoteData.formData as EORFormData).currency} dualCurrencyQuotes={primaryCardDualQuotes} />
              <GenericQuoteCard quote={undefined} title={`${quoteData.formData.compareCountry}`} provider="remote" badgeText="Compare Quote" badgeColor="bg-green-100 text-green-800" usdConversions={usdConversions.compareRemote} isConvertingToUSD={isConvertingCompareRemoteToUsd} usdConversionError={usdConversionError} compact={true} dualCurrencyQuotes={comparisonCardDualQuotes} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
              <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GenericQuoteCard quote={transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse)} title={`${(quoteData.formData as EORFormData).country}`} provider="remote" badgeText="Main Quote" badgeColor="bg-blue-100 text-blue-800" usdConversions={usdConversions.remote} isConvertingToUSD={isConvertingRemoteToUsd} usdConversionError={usdConversionError} compact={true} />
            <GenericQuoteCard quote={transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse)} title={`${quoteData.formData.compareCountry}`} provider="remote" badgeText="Compare Quote" badgeColor="bg-green-100 text-green-800" usdConversions={usdConversions.compareRemote} isConvertingToUSD={isConvertingCompareRemoteToUsd} usdConversionError={usdConversionError} compact={true} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
          </div>
        </div>
      );
    }

    if (currentProvider === 'rippling') {
      if (!quoteData.quotes.rippling || !(quoteData.quotes as any).comparisonRippling) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison provider="rippling" primaryQuote={quoteData.quotes.rippling as any} comparisonQuote={(quoteData.quotes as any).comparisonRippling as any} primaryTitle={eorForm.country} comparisonTitle={eorForm.compareCountry} usdConversions={usdConversions} isConvertingPrimaryToUSD={isConvertingRipplingToUsd} isConvertingComparisonToUSD={isConvertingCompareRipplingToUsd} usdConversionError={usdConversionError} dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.rippling} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard provider="rippling" baseQuote={{ ...(quoteData.quotes.rippling as any), provider: 'rippling' }} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            <EnhancedQuoteCard provider="rippling" baseQuote={{ ...((quoteData.quotes as any).comparisonRippling as any), provider: 'rippling' }} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
          </div>
        </div>
      );
    }

    if (currentProvider === 'skuad') {
      if (!((quoteData.quotes as any).skuad) || !((quoteData.quotes as any).comparisonSkuad)) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison provider="skuad" primaryQuote={(quoteData.quotes as any).skuad as any} comparisonQuote={(quoteData.quotes as any).comparisonSkuad as any} primaryTitle={eorForm.country} comparisonTitle={eorForm.compareCountry} usdConversions={usdConversions} isConvertingPrimaryToUSD={isConvertingSkuadToUsd} isConvertingComparisonToUSD={isConvertingCompareSkuadToUsd} usdConversionError={usdConversionError} dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.skuad} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard provider="skuad" baseQuote={{ ...((quoteData.quotes as any).skuad as any), provider: 'skuad' }} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            <EnhancedQuoteCard provider="skuad" baseQuote={{ ...((quoteData.quotes as any).comparisonSkuad as any), provider: 'skuad' }} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
          </div>
        </div>
      );
    }

    if (currentProvider === 'velocity') {
      if (!((quoteData.quotes as any).velocity) || !((quoteData.quotes as any).comparisonVelocity)) return null;
      return (
        <div className="space-y-6">
          <QuoteComparison provider="velocity" primaryQuote={(quoteData.quotes as any).velocity as any} comparisonQuote={(quoteData.quotes as any).comparisonVelocity as any} primaryTitle={eorForm.country} comparisonTitle={eorForm.compareCountry} usdConversions={usdConversions} isConvertingPrimaryToUSD={isConvertingVelocityToUsd} isConvertingComparisonToUSD={isConvertingCompareVelocityToUsd} usdConversionError={usdConversionError} dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.velocity} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedQuoteCard provider="velocity" baseQuote={{ ...((quoteData.quotes as any).velocity as any), provider: 'velocity' }} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
            <EnhancedQuoteCard provider="velocity" baseQuote={{ ...((quoteData.quotes as any).comparisonVelocity as any), provider: 'velocity' }} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={true} showRetry={true} />
          </div>
        </div>
      );
    }

    return null;
  };

  // --- MAIN RENDER ---
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

      {/* --- REFRESHED RECONCILIATION MODAL --- */}
      {isReconModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-300">
          <div className="absolute inset-0" onClick={() => setIsReconModalOpen(false)} />
          <Card className="relative border-0 shadow-2xl bg-slate-50 w-[96vw] max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col">
            <CardHeader className="border-b bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <Brain className="h-6 w-6 text-purple-600" />
                  <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Reconciliation Analysis
                  </span>
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsReconModalOpen(false)}><XCircle className="h-5 w-5"/></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {reconSteps.map((step, index) => {
                  const Icon = getStepIcon(step.type)
                  return (
                    <div key={index} className="flex items-start gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStepIconBg(step.type)}`}>
                        <Icon className={`h-5 w-5 ${getStepIconColor(step.type)}`} />
                      </div>
                      <div className="pt-1">
                        <p className="font-semibold text-slate-800">{step.title}</p>
                        {step.description && <p className="text-sm text-slate-600">{step.description}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {finalChoice && (
                <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-2xl animate-in fade-in-0 duration-1000">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white/20 rounded-full mb-4">
                      <Trophy className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">Provider of Choice</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1">
                        <ProviderLogo provider={finalChoice.provider as ProviderType} />
                      </div>
                      <p className="text-4xl font-bold capitalize">{finalChoice.provider}</p>
                    </div>
                    <p className="text-5xl font-light mt-4 tracking-tight">{formatMoney(finalChoice.price, finalChoice.currency)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
});

const getStepIcon = (type: string) => {
  switch (type) {
    case 'start': return Brain;
    case 'data': return FileText;
    case 'target': return Target;
    case 'calculate': return Calculator;
    case 'filter': return Filter;
    case 'check': return CheckCircle;
    case 'list': return ListChecks;
    case 'select': return Trophy;
    case 'trophy': return Trophy;
    case 'error': return XCircle;
    default: return CheckCircle;
  }
}

const getStepIconBg = (type: string) => {
  switch (type) {
    case 'error': return 'bg-red-100';
    case 'trophy': return 'bg-yellow-100';
    default: return 'bg-slate-100';
  }
}

const getStepIconColor = (type: string) => {
  switch (type) {
    case 'error': return 'text-red-600';
    case 'trophy': return 'text-yellow-600';
    default: return 'text-slate-600';
  }
}
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
