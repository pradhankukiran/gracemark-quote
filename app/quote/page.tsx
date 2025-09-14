"use client"

import { useEffect, Suspense, memo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle, Loader2, Brain, Filter, Target, Trophy, ListChecks, Zap, BarChart3, TrendingUp, Sparkles, Star, Crown, Rocket, ChevronRight, Play, Pause, RotateCcw, Activity, TrendingDown, FileText } from "lucide-react"
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
import { downloadQuotePDF, DownloadProgress, handleDownloadError, validatePDFData } from "@/lib/pdf/downloadHandler"

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
  const [finalChoice, setFinalChoice] = useState<{ 
    provider: string; 
    price: number; 
    currency: string;
    enhancedQuote?: EnhancedQuote;
  } | null>(null)
  
  // Timeline-style reconciliation state
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set())
  const [activePhase, setActivePhase] = useState<'gathering' | 'analyzing' | 'selecting' | 'complete' | null>('gathering')
  const [progressPercent, setProgressPercent] = useState(0)
  const [providerData, setProviderData] = useState<{ provider: string; price: number; inRange?: boolean; isWinner?: boolean }[]>([])
  const [timelineRef, setTimelineRef] = useState<HTMLDivElement | null>(null)

  // PDF Download state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

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

  // --- LOADING & ERROR STATES (Updated: show spinner until current provider base is ready) ---
  const showGlobalLoader = loading || providerLoading[currentProvider] || (quoteData?.status === 'calculating' && providerLoading[currentProvider])

  if (showGlobalLoader) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6 flex flex-col items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Loading Quotes...
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

  // calculating handled by the unified loading block above

  // --- REFRESHED RECONCILIATION LOGIC ---
  const allProviders: Array<ProviderType> = ['deel','remote','rivermate','oyster','rippling','skuad','velocity']

  const getReconciliationStatus = () => {
    // Treat 'inactive' as a terminal state when no processing is in-flight,
    // so providers that failed base generation/normalization don't block reconciliation.
    const completed = allProviders.filter(p => {
      const s = providerStates[p]?.status
      return s === 'active' || s === 'enhancement-failed' || s === 'failed' || s === 'inactive'
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

  // Optimized progress update function (400ms instead of 800ms)
  const smoothProgressUpdate = (targetProgress: number) => {
    return new Promise<void>((resolve) => {
      const startProgress = progressPercent
      const progressDiff = targetProgress - startProgress
      const duration = 400 // Reduced from 800ms to 400ms
      const startTime = Date.now()
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3) // Slightly snappier easing
        const currentProgress = startProgress + (progressDiff * easeOutCubic)
        
        setProgressPercent(Math.round(currentProgress))
        
        if (progress < 1) {
          requestAnimationFrame(updateProgress)
        } else {
          resolve()
        }
      }
      
      requestAnimationFrame(updateProgress)
    })
  }

  // Fixed auto-scroll with performance optimization
  const scrollToPhase = (phaseId: string) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.getElementById(`phase-${phaseId}`)
        if (element) {
          // Temporarily disable heavy animations during scroll
          element.style.willChange = 'scroll-position'
          
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          })
          
          // Re-enable animations after scroll
          setTimeout(() => {
            element.style.willChange = 'auto'
          }, 600)
        }
      }, 400) // Reduced from 800ms to 400ms
    })
  }

  // Simplified phase completion (removed transition delays)
  const completePhase = (phase: string) => {
    setCompletedPhases(prev => new Set([...prev, phase]))
  }

  const startPhase = (phase: 'gathering' | 'analyzing' | 'selecting' | 'complete') => {
    setActivePhase(phase)
    scrollToPhase(phase) // Uses optimized scrolling with 400ms delay and performance optimization
  }

  // Timeline phase rendering
  const renderTimelinePhases = () => {
    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'
    
    const isPhaseActive = (phase: string) => activePhase === phase
    const isPhaseCompleted = (phase: string) => completedPhases.has(phase)
    const isPhaseStarted = (phase: string) => isPhaseActive(phase) || isPhaseCompleted(phase)
    const isPhaseUpcoming = (phase: string) => !isPhaseStarted(phase)

    return (
      <div className="space-y-8 p-6">
        {/* Phase 1: Gathering Data */}
        <div 
          id="phase-gathering" 
          className={`
            bg-white rounded-xl border-2 shadow-lg p-6 transition-all duration-700 ease-in-out transform
            ${isPhaseActive('gathering') ? 'border-blue-500 shadow-blue-200 shadow-2xl scale-[1.02]' : 
              isPhaseCompleted('gathering') ? 'border-green-500 shadow-green-200 shadow-xl' : 
              'border-slate-200 opacity-60 shadow-md'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3 rounded-full 
              ${isPhaseActive('gathering') ? 'bg-blue-100' : 
                isPhaseCompleted('gathering') ? 'bg-green-100' : 
                'bg-slate-100'}
            `}>
              {isPhaseCompleted('gathering') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('gathering') ? (
                <Activity className="h-6 w-6 text-blue-600 animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Phase 1: Gathering Data</h3>
              <p className="text-slate-600">
                {isPhaseCompleted('gathering') ? 'Provider quotes collected successfully' :
                 isPhaseActive('gathering') ? 'Collecting provider quotes...' :
                 'Waiting to collect provider quotes'}
              </p>
            </div>
          </div>

          {isPhaseStarted('gathering') && (
            <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 transition-opacity duration-500 ${
              isPhaseStarted('gathering') ? 'opacity-100' : 'opacity-0'
            }`}>
              {providerData.map((provider, idx) => (
                <div 
                  key={provider.provider}
                  className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-3 text-center transform transition-all duration-500 hover:scale-105 hover:shadow-lg hover:border-blue-300"
                  style={{
                    animationDelay: `${idx * 80}ms`, // Reduced from 150ms to 80ms
                    animation: isPhaseActive('gathering') ? 'slideInUp 0.8s ease-out forwards' : 'none',
                    transform: 'translate3d(0, 0, 0)', // GPU acceleration
                    willChange: 'transform, opacity'
                  }}
                >
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg border border-slate-200 flex items-center justify-center bg-white shadow-sm">
                    <ProviderLogo provider={provider.provider as ProviderType} />
                  </div>
                  <div className="text-xs font-semibold text-slate-700 capitalize mb-1">
                    {provider.provider}
                  </div>
                  <div className="text-sm font-bold text-blue-600">
                    {formatMoney(provider.price, currency)}
                  </div>
                </div>
              ))}
              
              {/* Enhanced placeholder cards */}
              {isPhaseActive('gathering') && Array.from({ length: Math.max(0, 7 - providerData.length) }).map((_, idx) => (
                <div 
                  key={`placeholder-${idx}`}
                  className="bg-slate-100 rounded-xl border border-slate-200 p-3 text-center animate-pulse"
                >
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-200" />
                  <div className="h-3 bg-slate-200 rounded mb-1" />
                  <div className="h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phase 2: Analyzing Variance */}
        <div 
          id="phase-analyzing" 
          className={`
            bg-white rounded-xl border-2 shadow-lg p-6 transition-all duration-700 ease-in-out transform
            ${isPhaseActive('analyzing') ? 'border-purple-500 shadow-purple-200 shadow-2xl scale-[1.02]' : 
              isPhaseCompleted('analyzing') ? 'border-green-500 shadow-green-200 shadow-xl' : 
              'border-slate-200 opacity-60 shadow-md'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3 rounded-full 
              ${isPhaseActive('analyzing') ? 'bg-purple-100' : 
                isPhaseCompleted('analyzing') ? 'bg-green-100' : 
                'bg-slate-100'}
            `}>
              {isPhaseCompleted('analyzing') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('analyzing') ? (
                <BarChart3 className="h-6 w-6 text-purple-600 animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Phase 2: Analyzing Variance</h3>
              <p className="text-slate-600">
                {isPhaseCompleted('analyzing') ? 'Price variance analysis completed' :
                 isPhaseActive('analyzing') ? 'Analyzing price variance against Deel baseline...' :
                 'Waiting to analyze price variance'}
              </p>
            </div>
          </div>

          {isPhaseStarted('analyzing') && providerData.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="space-y-3">
                {providerData.map((provider) => {
                  const deelProvider = providerData.find(p => p.provider === 'deel')
                  const deelPrice = deelProvider?.price || 0
                  const percentage = deelPrice > 0 ? ((provider.price - deelPrice) / deelPrice * 100) : 0
                  const barWidth = Math.min(100, Math.max(10, (provider.price / Math.max(...providerData.map(p => p.price))) * 100))
                  
                  return (
                    <div key={provider.provider} className="flex items-center gap-3">
                      <div className="w-16 text-xs font-medium text-slate-700 capitalize">
                        {provider.provider}
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-6 bg-slate-200 rounded-lg overflow-hidden shadow-inner">
                          <div 
                            className={`h-full transition-all duration-700 ease-out transform-gpu ${
                              provider.inRange ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-600' : 
                              'bg-gradient-to-r from-red-400 via-red-500 to-red-600'
                            }`}
                            style={{ 
                              width: `${barWidth}%`,
                              transitionDelay: `${providerData.indexOf(provider) * 100}ms`,
                              transform: 'translate3d(0, 0, 0)', // GPU acceleration
                              willChange: 'width'
                            }}
                          />
                        </div>
                        <div className="absolute inset-y-0 left-2 flex items-center">
                          <span className="text-xs font-medium text-white">
                            {formatMoney(provider.price, currency)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {provider.inRange ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-xs font-medium ${
                          provider.inRange ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Phase 3: Selecting Optimal */}
        <div 
          id="phase-selecting" 
          className={`
            bg-white rounded-xl border-2 shadow-lg p-6 transition-all duration-700 ease-in-out transform
            ${isPhaseActive('selecting') ? 'border-yellow-500 shadow-yellow-200 shadow-2xl scale-[1.02]' : 
              isPhaseCompleted('selecting') ? 'border-green-500 shadow-green-200 shadow-xl' : 
              'border-slate-200 opacity-60 shadow-md'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3 rounded-full 
              ${isPhaseActive('selecting') ? 'bg-yellow-100' : 
                isPhaseCompleted('selecting') ? 'bg-green-100' : 
                'bg-slate-100'}
            `}>
              {isPhaseCompleted('selecting') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('selecting') ? (
                <Target className="h-6 w-6 text-yellow-600 animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Phase 3: Selecting Optimal Provider</h3>
              <p className="text-slate-600">
                {isPhaseCompleted('selecting') ? 'Optimal provider selected successfully' :
                 isPhaseActive('selecting') ? 'Selecting optimal provider from candidates...' :
                 'Waiting to select optimal provider'}
              </p>
            </div>
          </div>

          {isPhaseStarted('selecting') && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {providerData.map((provider) => (
                <div 
                  key={provider.provider}
                  className={`
                    bg-slate-50 rounded-lg border-2 p-3 text-center transition-all duration-700 transform
                    ${provider.isWinner ? 'border-yellow-400 shadow-lg scale-105 bg-gradient-to-br from-yellow-50 to-orange-50' :
                      provider.inRange ? 'border-green-200' : 
                      'border-slate-200 opacity-50'}
                  `}
                >
                  {provider.isWinner && (
                    <Crown className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                  )}
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg border flex items-center justify-center bg-white">
                    <ProviderLogo provider={provider.provider as ProviderType} />
                  </div>
                  <div className="text-xs font-medium text-slate-800 capitalize mb-1">
                    {provider.provider}
                  </div>
                  <div className={`text-sm font-bold ${
                    provider.isWinner ? 'text-yellow-600' : 
                    provider.inRange ? 'text-green-600' : 'text-slate-600'
                  }`}>
                    {formatMoney(provider.price, currency)}
                  </div>
                  {provider.isWinner && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs mt-1">
                      Winner
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phase 4: Analysis Complete */}
        <div 
          id="phase-complete" 
          className={`
            bg-white rounded-xl border-2 shadow-lg p-6 transition-all duration-700 ease-in-out transform
            ${isPhaseActive('complete') || isPhaseCompleted('complete') ? 'border-green-500 shadow-green-200 shadow-2xl scale-[1.02]' : 
              'border-slate-200 opacity-60 shadow-md'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3 rounded-full 
              ${isPhaseStarted('complete') ? 'bg-green-100' : 'bg-slate-100'}
            `}>
              {isPhaseStarted('complete') ? (
                <Crown className="h-6 w-6 text-green-600" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Analysis Complete</h3>
              <p className="text-slate-600">
                {isPhaseStarted('complete') ? 'Provider recommendation ready' : 'Waiting for analysis to complete'}
              </p>
            </div>
          </div>

          {isPhaseStarted('complete') && finalChoice && (
            <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 rounded-xl p-8 border-2 border-green-200 shadow-xl transition-all duration-500 smooth-appear">
              <div className="text-center mb-8">
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl border-3 border-green-300 flex items-center justify-center bg-white shadow-2xl transition-transform duration-300 hover:scale-110">
                  <ProviderLogo provider={finalChoice.provider as ProviderType} />
                </div>
                <div className="text-3xl font-bold text-slate-900 capitalize mb-3 tracking-tight">
                  {finalChoice.provider}
                </div>
                <div className="text-5xl font-bold text-green-600 mb-6 tracking-tight">
                  {formatMoney(finalChoice.price, finalChoice.currency)}
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2 text-sm font-semibold">
                  ✨ Recommended Provider
                </Badge>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPDF || !finalChoice || !providerData.length}
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 px-8 py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isDownloadingPDF ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      {downloadProgress?.message || 'Generating PDF...'}
                    </>
                  ) : (
                    <>
                      <Rocket className="h-5 w-5 mr-3" />
                      Download Quote
                    </>
                  )}
                </Button>
              </div>

              {/* Download Error Display */}
              {downloadError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-800">PDF Generation Failed</p>
                      <p className="text-sm text-red-600 mt-1">{downloadError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDownloadError(null)}
                        className="mt-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const startReconciliation = async () => {
    setIsReconModalOpen(true)
    setReconSteps([])
    setFinalChoice(null)
    setCompletedPhases(new Set())
    setActivePhase('gathering')
    setProgressPercent(0)
    setProviderData([])

    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'

    try {
      // Phase 1: Gathering Data (0-25%)
      startPhase('gathering')
      await smoothProgressUpdate(5)
      setReconSteps([{ type: 'start', title: 'Starting Reconciliation Analysis' }])

      const prices: { provider: string; price: number }[] = allProviders
        .map(p => ({ provider: p, price: enhancements[p]?.finalTotal || 0 }))
        .filter(p => p.price !== undefined && p.price !== null && p.price > 0);

      if (prices.length === 0) {
        setReconSteps(prev => [...prev, { type: 'error', title: 'Error: No provider prices available.'}]);
        return;
      }

      // Optimized staggered provider cards
      for (let i = 0; i < prices.length; i++) {
        setProviderData(prev => [...prev, prices[i]])
        const targetProgress = 5 + ((i + 1) / prices.length) * 20
        await smoothProgressUpdate(targetProgress)
        setReconSteps(prev => [...prev, { type: 'data', title: `Collected ${prices[i].provider} quote`, description: `${formatMoney(prices[i].price, currency)}` }])
        await sleep(80) // Reduced from 150ms to 80ms
      }

      completePhase('gathering')
      
      // Reduced delay before next phase
      await sleep(1500) // Reduced from 2500ms to 1500ms
      
      // Phase 2: Analyzing Variance (25-60%)
      startPhase('analyzing')
      await smoothProgressUpdate(30)

      const deel = prices.find(p => p.provider === 'deel');
      if (!deel) {
        setReconSteps(prev => [...prev, { type: 'error', title: 'Deel Price Not Available', description: 'Cannot proceed without Deel price as a reference.' }]);
        return;
      }

      setReconSteps(prev => [...prev, { type: 'target', title: 'Set Deel as Baseline', description: `Reference price: ${formatMoney(deel.price, currency)}` }]);

      await sleep(500) // Reduced from 800ms
      const lowerBound = deel.price * 0.96;
      const upperBound = deel.price * 1.04;
      await smoothProgressUpdate(45)
      setReconSteps(prev => [...prev, { type: 'calculate', title: 'Calculated 4% Variance Range', description: `Range: ${formatMoney(lowerBound, currency)} - ${formatMoney(upperBound, currency)}` }]);

      await sleep(500) // Reduced from 800ms
      // Update provider data with range analysis
      const analyzedProviders = prices.map(p => ({
        ...p,
        inRange: p.price >= lowerBound && p.price <= upperBound
      }))
      setProviderData(analyzedProviders)
      await smoothProgressUpdate(60)
      completePhase('analyzing')

      // Reduced delay before next phase
      await sleep(1500) // Reduced from 2500ms to 1500ms

      // Phase 3: Selecting Optimal (60-90%)
      startPhase('selecting')
      await smoothProgressUpdate(65)

      const candidates = analyzedProviders.filter(p => p.inRange);
      setReconSteps(prev => [...prev, { type: 'filter', title: 'Filtered Candidates', description: `${candidates.length} providers within range: ${candidates.map(c => c.provider).join(', ')}` }]);

      if (candidates.length === 0) {
        setReconSteps(prev => [...prev, { type: 'error', title: 'No providers found within the 4% range.'}]);
        return;
      }

      await sleep(600) // Reduced from 1000ms
      await smoothProgressUpdate(80)
      const choice = candidates.reduce((max, current) => (current.price > max.price ? current : max), candidates[0]);
      
      await sleep(400) // Reduced from 700ms - quicker winner selection
      // Mark winner in provider data
      const finalProviders = analyzedProviders.map(p => ({
        ...p,
        isWinner: p.provider === choice.provider
      }))
      setProviderData(finalProviders)
      await smoothProgressUpdate(90)
      
      setReconSteps(prev => [...prev, { type: 'select', title: 'Selected Optimal Provider', description: `${choice.provider} offers highest price within acceptable range` }]);
      completePhase('selecting')

      // Reduced delay before final phase
      await sleep(1500) // Reduced from 2500ms to 1500ms

      // Phase 4: Complete (90-100%)
      startPhase('complete')
      await smoothProgressUpdate(100)
      await sleep(200) // Reduced fade-in delay from 400ms to 200ms
      
      // Get the enhanced quote data for the selected provider
      const selectedEnhancement = enhancements[choice.provider as ProviderType];
      setFinalChoice({ 
        ...choice, 
        currency,
        enhancedQuote: selectedEnhancement || undefined
      });
      setReconSteps(prev => [...prev, { type: 'trophy', title: `Analysis Complete: ${choice.provider} Recommended` }]);
      completePhase('complete')

    } catch (error) {
      console.error("Reconciliation failed", error);
      setReconSteps(prev => [...prev, { type: 'error', title: 'An unexpected error occurred during reconciliation.'}]);
    }
  }

  // PDF Download Handler
  const handleDownloadPDF = async () => {
    // Pre-validation with user-friendly messages
    const validation = validatePDFData(finalChoice, providerData, quoteData);
    
    if (!validation.isValid) {
      setDownloadError(`Cannot generate PDF:\n${validation.errors.join('\n')}`);
      return;
    }

    // Show warnings if any (but continue with download)
    if (validation.warnings.length > 0) {
      // console.log('PDF Generation Warnings:', validation.warnings.join(', '));
    }

    setIsDownloadingPDF(true);
    setDownloadError(null);
    setDownloadProgress(null);

    try {
      await downloadQuotePDF(
        finalChoice,
        providerData,
        quoteData,
        enhancements,
        {
          onProgress: (progress) => {
            setDownloadProgress(progress);
          },
          onError: (error) => {
            const userFriendlyMessage = handleDownloadError(error);
            setDownloadError(userFriendlyMessage);
            setIsDownloadingPDF(false);
            setDownloadProgress(null);
          },
          onSuccess: (filename) => {
            setIsDownloadingPDF(false);
            setDownloadProgress(null);
            // Show success message
            // console.log(`✅ PDF downloaded successfully: ${filename}`);
            
            // Optionally show warnings that were resolved
            if (validation.warnings.length > 0) {
              // console.log('ℹ️ Note: Some optional data was missing but PDF was generated successfully');
            }
          },
          includeLogos: true
        }
      );
    } catch (error) {
      const userFriendlyMessage = handleDownloadError(error);
      setDownloadError(userFriendlyMessage);
      setIsDownloadingPDF(false);
      setDownloadProgress(null);
    }
  };

  // --- RENDER LOGIC (UNCHANGED) ---
  const renderQuote = () => {
    if (providerLoading[currentProvider]) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            {/* <p className="text-slate-600">Loading {currentProvider === 'deel' ? 'Deel' : currentProvider === 'remote' ? 'Remote' : currentProvider === 'rivermate' ? 'Rivermate' : currentProvider === 'oyster' ? 'Oyster' : currentProvider === 'rippling' ? 'Rippling' : currentProvider === 'skuad' ? 'Skuad' : 'Velocity Global'} quote...</p> */}
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
      // console.log(`[Quote Debug] Provider: ${currentProvider}`, {
      //   rawQuoteData: currentProvider === 'deel' ? quoteData.quotes.deel : 'N/A',
      //   processedQuote: quote,
      //   quoteKeys: quote ? Object.keys(quote) : 'null/undefined',
      //   isEmpty: quote && typeof quote === 'object' && Object.keys(quote).length === 0
      // })
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

    // Merge LLM full-quote items into base quote for a single, unified card
    let mergedQuote: any = quote
    let extendedConversions = conversions
    try {
      const enh = (enhancements as any)?.[currentProvider as string]
      const fq = enh?.fullQuote
      if (quote && fq && typeof fq.total_monthly === 'number' && Array.isArray(fq.items)) {
        const cloned = { ...(quote as any) }
        const existingCosts = Array.isArray(cloned.costs) ? [...cloned.costs] : []
        const originalCostsLength = existingCosts.length
        const toAmountStr = (n: number) => {
          const v = Number(n)
          return Number.isFinite(v) ? v.toFixed(2) : '0'
        }

        // Calculate exchange rate from existing conversions for new items
        let exchangeRate: number | null = null
        if (conversions?.costs && Array.isArray(conversions.costs) && existingCosts.length > 0) {
          // Find a non-zero base item to calculate exchange rate
          for (let i = 0; i < Math.min(existingCosts.length, conversions.costs.length); i++) {
            const localAmount = Number.parseFloat(existingCosts[i].amount)
            const usdAmount = conversions.costs[i]
            if (localAmount > 0 && usdAmount > 0) {
              exchangeRate = usdAmount / localAmount
              break
            }
          }
        }

        // Append extras as cost rows and calculate their USD conversions
        const newUsdConversions: number[] = []
        fq.items.forEach((it: any) => {
          const amt = Number(it?.monthly_amount) || 0
          if (amt <= 0) return
          existingCosts.push({
            name: String(it?.name || it?.key || 'Additional Benefit'),
            amount: toAmountStr(amt),
            frequency: 'monthly',
            country: cloned.country,
            country_code: cloned.country_code,
          })
          
          // Calculate USD conversion for this new item
          if (exchangeRate !== null) {
            newUsdConversions.push(amt * exchangeRate)
          } else {
            newUsdConversions.push(0) // Fallback to 0 if no exchange rate available
          }
        })

        // Extend USD conversions array with new item conversions
        if (conversions?.costs && newUsdConversions.length > 0) {
          extendedConversions = {
            ...conversions,
            costs: [...conversions.costs, ...newUsdConversions]
          }
        }

        cloned.costs = existingCosts
        // Compute non-decreasing merged total using base displayed total vs LLM total
        const parseNum = (v?: string | number) => {
          if (typeof v === 'number') return v
          const n = Number.parseFloat((v || '0') as string)
          return Number.isFinite(n) ? n : 0
        }
        const baseTotal = (() => {
          const t = parseNum((quote as any)?.total_costs)
          if (currentProvider === 'deel') {
            const fee = parseNum((quote as any)?.deel_fee)
            const accr = parseNum((quote as any)?.severance_accural)
            return Math.max(0, t - fee - accr)
          }
          return t
        })()
        const llmTotal = Number(fq.total_monthly) || 0
        const mergedTotal = Math.max(baseTotal, llmTotal)
        const totalStr = toAmountStr(mergedTotal)
        cloned.total_costs = totalStr
        cloned.employer_costs = totalStr
        if (currentProvider === 'deel') {
          cloned.deel_fee = '0'
          cloned.severance_accural = '0'
        }
        mergedQuote = cloned
      }
    } catch { /* noop */ }

    const isEnhPending = (!((enhancements as any)?.[currentProvider as string])) && (providerStates[currentProvider]?.status === 'loading-enhanced')

    // Build additional extras (deduped) from deterministic/LLM enhancements
    const extras: Array<{ name: string; amount: number; guards?: string[] }> = []
    try {
      const enh = (enhancements as any)?.[currentProvider as string]
      const costs = Array.isArray(mergedQuote?.costs) ? mergedQuote.costs : []
      const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const hasItemLike = (needle: string) => costs.some((c: any) => norm(c?.name).includes(norm(needle)))
      const addExtra = (name: string, amount: number, guardNames: string[] = []) => {
        const amt = Number(amount)
        if (!isFinite(amt) || amt <= 0) return
        const dup = guardNames.some(g => hasItemLike(g))
        if (!dup) extras.push({ name, amount: amt, guards: guardNames })
      }

      if (enh && enh.enhancements) {
        // Termination (monthlyized)
        const tc = enh.enhancements.terminationCosts
        if (tc && typeof tc.totalTerminationCost === 'number' && tc.totalTerminationCost > 0) {
          const months = Math.max(1, Number(tc.basedOnContractMonths || (enh?.contractDurationMonths || 12)))
          const monthly = tc.totalTerminationCost / months
          addExtra('Termination Provision', monthly, ['termination', 'severance', 'notice', 'accrual', 'provision'])
        }
        // 13th salary
        const th13 = enh.enhancements.thirteenthSalary
        if (th13 && th13.isAlreadyIncluded !== true) {
          const m = Number(th13.monthlyAmount || 0) || (Number(th13.yearlyAmount || 0) / 12)
          addExtra('13th Salary', m, ['13th', 'thirteenth'])
        }
        // 14th salary
        const th14 = enh.enhancements.fourteenthSalary
        if (th14 && th14.isAlreadyIncluded !== true) {
          const m = Number(th14.monthlyAmount || 0) || (Number(th14.yearlyAmount || 0) / 12)
          addExtra('14th Salary', m, ['14th', 'fourteenth'])
        }
        // Allowances
        const ta = enh.enhancements.transportationAllowance
        if (ta && ta.isAlreadyIncluded !== true) addExtra('Transportation Allowance', Number(ta.monthlyAmount || 0), ['transportation'])
        const rwa = enh.enhancements.remoteWorkAllowance
        if (rwa && rwa.isAlreadyIncluded !== true) addExtra('Remote Work Allowance', Number(rwa.monthlyAmount || 0), ['remote work', 'wfh'])
        const mv = enh.enhancements.mealVouchers
        if (mv && mv.isAlreadyIncluded !== true) addExtra('Meal Vouchers', Number(mv.monthlyAmount || 0), ['meal voucher'])
        // Additional contributions and local office
        const addc = enh.enhancements.additionalContributions || {}
        let contribAgg = 0
        let contribPerItem = 0
        let contribAggPresent = false
        const localExtras: Array<{ name: string; amount: number; guards?: string[] }> = []

        Object.entries(addc).forEach(([k, v]) => {
          const n = Number(v)
          if (!isFinite(n) || n <= 0) return
          const key = String(k || '').toLowerCase()
          if (key === 'employer_contributions_total' || (key.includes('baseline') && key.includes('employer') && key.includes('contribution'))) {
            contribAgg += n
            contribAggPresent = true
            return
          }
          if (key.startsWith('employer_contrib_') || (key.includes('employer') && key.includes('contribution'))) {
            contribPerItem += n
            return
          }
          // Local office and other non-contribution extras
          const label = key.includes('local_meal_voucher') ? 'Meal Voucher (Local Office)'
            : key.includes('local_transportation') ? 'Transportation (Local Office)'
            : key.includes('local_wfh') ? 'WFH (Local Office)'
            : key.includes('local_health_insurance') ? 'Health Insurance (Local Office)'
            : key.includes('local_office_monthly_payments') ? 'Local Office Monthly Payments'
            : key.includes('local_office_vat') ? 'VAT on Local Office Payments'
            : String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          localExtras.push({ name: label, amount: n })
        })

        const contribTotal = contribAggPresent ? contribAgg : contribPerItem
        if (contribTotal > 0) addExtra('Employer Contributions', contribTotal, ['employer', 'contribution', 'social security', 'statutory', 'indirect employment cost'])
        localExtras.forEach(le => addExtra(le.name, le.amount))
      }
    } catch { /* noop */ }

    // Do not inject extras here to avoid double-counting.
    // Extras are passed to GenericQuoteCard via mergedExtras for inline injection.

    const isDualMode = !!dualCurrencyQuotes?.isDualCurrencyMode
    return (
      <div className="space-y-6">
        <GenericQuoteCard
          quote={dualCurrencyQuotes?.isDualCurrencyMode ? undefined : mergedQuote}
          title={`${quote?.country || eorForm.country}`}
          provider={currentProvider}
          usdConversions={extendedConversions}
          isConvertingToUSD={isConvertingToUSD}
          usdConversionError={usdConversionError}
          dualCurrencyQuotes={dualCurrencyQuotes}
          originalCurrency={eorForm.originalCurrency || undefined}
          selectedCurrency={eorForm.currency}
          recalcBaseItems={(enhancements as any)?.[currentProvider as string]?.recalcBaseItems || []}
          mergedExtras={extras}
          mergedCurrency={quote?.currency}

          enhancementPending={isEnhPending}
          shimmerExtrasCount={3}
        />

        {/* Merged into base card; hide separate enhanced card */}
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
              compact={false}
              showRetry={true}
            />
            <EnhancedQuoteCard
              provider="deel"
              baseQuote={{ ...quoteData.quotes.comparisonDeel, provider: 'deel' } as any}
              formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }}
              quoteType="all-inclusive"
              compact={false}
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
            <EnhancedQuoteCard provider="rivermate" baseQuote={primaryDisplay} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
            <EnhancedQuoteCard provider="rivermate" baseQuote={compareDisplay} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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
            <EnhancedQuoteCard provider="oyster" baseQuote={oysterPrimaryDisplay} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
            <EnhancedQuoteCard provider="oyster" baseQuote={oysterCompareDisplay} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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
              <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
              <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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
            <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.remote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
            <EnhancedQuoteCard provider="remote" baseQuote={('employment' in (quoteData.quotes.comparisonRemote as any)) ? transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse) : undefined} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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
            <EnhancedQuoteCard provider="rippling" baseQuote={{ ...(quoteData.quotes.rippling as any), provider: 'rippling' }} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
            <EnhancedQuoteCard provider="rippling" baseQuote={{ ...((quoteData.quotes as any).comparisonRippling as any), provider: 'rippling' }} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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
            <EnhancedQuoteCard provider="skuad" baseQuote={{ ...((quoteData.quotes as any).skuad as any), provider: 'skuad' }} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
            <EnhancedQuoteCard provider="skuad" baseQuote={{ ...((quoteData.quotes as any).comparisonSkuad as any), provider: 'skuad' }} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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
            <EnhancedQuoteCard provider="velocity" baseQuote={{ ...((quoteData.quotes as any).velocity as any), provider: 'velocity' }} formData={{ ...eorForm, country: eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
            <EnhancedQuoteCard provider="velocity" baseQuote={{ ...((quoteData.quotes as any).comparisonVelocity as any), provider: 'velocity' }} formData={{ ...eorForm, country: eorForm.compareCountry || eorForm.country }} quoteType="all-inclusive" compact={false} showRetry={true} />
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

      {/* --- DASHBOARD-STYLE RECONCILIATION MODAL --- */}
      {isReconModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-black/60 to-slate-900/60 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setIsReconModalOpen(false)} />
          <Card className="relative w-[90vw] max-w-7xl max-h-[90vh] border-0 shadow-2xl bg-white/98 backdrop-blur-lg overflow-hidden">
            
            {/* Top Banner: Progress Bar + Phase */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      Provider Reconciliation Dashboard
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {activePhase === 'gathering' && 'Collecting provider data...'}
                      {activePhase === 'analyzing' && 'Analyzing price variance...'}
                      {activePhase === 'selecting' && 'Selecting optimal provider...'}
                      {activePhase === 'complete' && 'Analysis complete - Provider recommended'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-700">{progressPercent}%</div>
                    <div className="text-xs text-slate-500">Complete</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsReconModalOpen(false)} className="ml-4">
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Close
                  </Button>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4 bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Main Timeline Area */}
            <div className="flex-1 overflow-y-auto" style={{ scrollBehavior: 'smooth', transform: 'translate3d(0, 0, 0)' }}>
              {renderTimelinePhases()}
            </div>
          </Card>
        </div>
      )}

      {/* Enhanced CSS for premium dashboard animations with GPU acceleration */}
      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 40px, 0) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale3d(0.85, 0.85, 1);
          }
          to {
            opacity: 1;
            transform: scale3d(1, 1, 1);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.6);
          }
        }
        
        @keyframes shimmer {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: calc(200px + 100%) 0;
          }
        }
        
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translate3d(-20px, 0, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale3d(0.3, 0.3, 1);
          }
          50% {
            opacity: 1;
            transform: scale3d(1.05, 1.05, 1);
          }
          70% {
            transform: scale3d(0.98, 0.98, 1);
          }
          100% {
            opacity: 1;
            transform: scale3d(1, 1, 1);
          }
        }
        
        /* GPU-accelerated utility classes */
        .transform-gpu {
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
        }
        
        .smooth-appear {
          animation: fadeInScale 0.6s ease-out forwards;
          will-change: transform, opacity;
        }
        
        .stagger-appear {
          animation: slideInUp 0.8s ease-out forwards;
          will-change: transform, opacity;
        }
        
        /* Optimized scroll container */
        .scroll-smooth {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </div>
  )
});

// Enhanced Step Icon System
const getEnhancedStepIcon = (type: string) => {
  switch (type) {
    case 'start': return Rocket;
    case 'data': return FileText;
    case 'target': return Target;
    case 'calculate': return Calculator;
    case 'filter': return Filter;
    case 'check': return CheckCircle;
    case 'list': return ListChecks;
    case 'select': return Star;
    case 'trophy': return Crown;
    case 'error': return XCircle;
    default: return CheckCircle;
  }
}

const getEnhancedStepBg = (type: string) => {
  switch (type) {
    case 'start': return 'bg-gradient-to-br from-indigo-100 to-indigo-200 border-2 border-indigo-300';
    case 'data': return 'bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-300';
    case 'target': return 'bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300';
    case 'calculate': return 'bg-gradient-to-br from-teal-100 to-teal-200 border-2 border-teal-300';
    case 'filter': return 'bg-gradient-to-br from-cyan-100 to-cyan-200 border-2 border-cyan-300';
    case 'check': return 'bg-gradient-to-br from-emerald-100 to-emerald-200 border-2 border-emerald-300';
    case 'list': return 'bg-gradient-to-br from-violet-100 to-violet-200 border-2 border-violet-300';
    case 'select': return 'bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-300';
    case 'trophy': return 'bg-gradient-to-br from-yellow-100 to-orange-200 border-2 border-yellow-400 shadow-lg';
    case 'error': return 'bg-gradient-to-br from-red-100 to-red-200 border-2 border-red-300';
    default: return 'bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300';
  }
}

const getEnhancedStepBorder = (type: string) => {
  switch (type) {
    case 'trophy': return 'border-yellow-400 shadow-yellow-200/50';
    case 'error': return 'border-red-300 shadow-red-200/50';
    default: return '';
  }
}

const getEnhancedStepColor = (type: string) => {
  switch (type) {
    case 'start': return 'text-indigo-600';
    case 'data': return 'text-blue-600';
    case 'target': return 'text-purple-600';
    case 'calculate': return 'text-teal-600';
    case 'filter': return 'text-cyan-600';
    case 'check': return 'text-emerald-600';
    case 'list': return 'text-violet-600';
    case 'select': return 'text-amber-600';
    case 'trophy': return 'text-yellow-600';
    case 'error': return 'text-red-600';
    default: return 'text-slate-600';
  }
}

// Legacy functions for compatibility
const getStepIcon = getEnhancedStepIcon;
const getStepIconBg = (type: string) => {
  switch (type) {
    case 'error': return 'bg-red-100';
    case 'trophy': return 'bg-yellow-100';
    default: return 'bg-slate-100';
  }
}
const getStepIconColor = getEnhancedStepColor;
QuotePageContent.displayName = 'QuotePageContent';

export default function QuotePage() {
  return (
    <ErrorBoundary
      fallbackTitle="Quote Loading Error"
      fallbackMessage="There was a problem loading your quote. This might be due to corrupted data or a temporary issue."
      onError={(error, errorInfo) => {
        // console.error('Quote page error:', error, errorInfo)
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
