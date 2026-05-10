"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  Crown,
  Target,
  XCircle,
  Zap,
, Star } from "lucide-react"
import type { EnhancedQuote, ProviderType } from "@/lib/types/enhancement"
import {
  selectVarianceWinner,
  type PricedProvider,
} from "@/lib/domain/reconciliation"
import { ProviderLogo } from "./ProviderLogo"
import { VarianceChart } from "./VarianceChart"

// Final-choice payload that the modal hands back to the parent page once the
// four-phase reconciliation finishes.
export interface FinalChoiceData {
  provider: string
  price: number
  currency: string
  enhancedQuote?: EnhancedQuote
  isOverride?: boolean
}

// Provider entry shown in the gathering / analyzing / selecting phases.
interface ReconciliationProviderEntry {
  provider: string
  price: number
  inRange?: boolean
  isWinner?: boolean
}

export interface ReconciliationModalProps {
  isOpen: boolean
  onClose: () => void
  prices: PricedProvider<ProviderType>[]
  enhancements: Partial<Record<ProviderType, EnhancedQuote>>
  currency: string
  onComplete: (finalChoice: FinalChoiceData) => void
  // The reconciliation modal hosts the Phase 4 acid-test form inline. The page
  // owns the heavy acid-test state machine, so it injects the form via a slot
  // and a click handler. These props are optional to keep the modal usable in
  // simpler contexts (e.g. tests, isolated stories).
  showAcidTestForm?: boolean
  onStartAcidTest?: () => void
  acidTestError?: string | null
  onDismissAcidTestError?: () => void
  acidTestFormSlot?: ReactNode
}

// Tiny helper duplicated from page.tsx — it is a leaf utility used only inside
// the modal phases. Page.tsx keeps its own copy for now; dedupe is a follow-up.
const splitIntoBalancedRows = <T,>(items: T[]) => {
  if (items.length === 0) {
    return {
      firstRow: [] as T[],
      secondRow: [] as T[],
    }
  }

  const firstRowCount = Math.min(5, Math.ceil(items.length / 2))
  return {
    firstRow: items.slice(0, firstRowCount),
    secondRow: items.slice(firstRowCount),
  }
}

const formatMoney = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

// Duplicated from page.tsx for the same leaf-utility reason.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Auto-scroll the next phase into view inside the modal scroll container.
const scrollToPhase = (phaseId: string) => {
  setTimeout(
    () => {
      const targetId = phaseId === "analyzing" ? "analyzing-results" : `phase-${phaseId}`
      let element = document.getElementById(targetId)
      if (!element && phaseId === "analyzing") {
        element = document.getElementById("phase-analyzing")
      }
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: phaseId === "complete" ? "end" : "start",
          inline: "nearest",
        })
      }
    },
    phaseId === "analyzing" ? 800 : 400,
  )
}

export default function ReconciliationModal({
  isOpen,
  onClose,
  prices,
  enhancements,
  currency,
  onComplete,
  showAcidTestForm = false,
  onStartAcidTest,
  acidTestError,
  onDismissAcidTestError,
  acidTestFormSlot,
}: ReconciliationModalProps) {
  // Animation state owned by the modal.
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set())
  const [activePhase, setActivePhase] =
    useState<"gathering" | "analyzing" | "selecting" | "complete" | null>("gathering")
  const [progressPercent, setProgressPercent] = useState(0)
  const [providerData, setProviderData] = useState<ReconciliationProviderEntry[]>([])
  const [finalChoice, setFinalChoice] = useState<FinalChoiceData | null>(null)
  const [hasStarted, setHasStarted] = useState(false)

  // Body scroll lock while open.
  useEffect(() => {
    if (!isOpen) return
    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [isOpen])

  // Drive the four-phase animation when the modal opens. If the user
  // re-opens the modal after a previous successful reconciliation, the
  // existing finalChoice + completed phases are preserved so the user can
  // simply review the result.
  useEffect(() => {
    if (!isOpen) {
      // Reset only the "started" guard — keep state so reopening replays the result.
      setHasStarted(false)
      return
    }
    if (hasStarted) return
    setHasStarted(true)

    const hasCompletedBefore =
      completedPhases.has("analyzing") || completedPhases.has("complete")
    if (hasCompletedBefore) {
      // Reopen with existing state — no replay.
      return
    }

    // Fresh run: reset and animate.
    let cancelled = false

    const completePhase = (phase: string) => {
      if (cancelled) return
      setCompletedPhases((prev) => new Set([...prev, phase]))
    }

    const startPhase = (
      phase: "gathering" | "analyzing" | "selecting" | "complete",
    ) => {
      if (cancelled) return
      setActivePhase(phase)
      scrollToPhase(phase)
    }

    const smoothProgressUpdate = (targetProgress: number) =>
      new Promise<void>((resolve) => {
        if (cancelled) {
          resolve()
          return
        }
        setProgressPercent(targetProgress)
        setTimeout(resolve, 200)
      })

    const run = async () => {
      // Reset for fresh run.
      setFinalChoice(null)
      setCompletedPhases(new Set())
      setActivePhase("gathering")
      setProgressPercent(0)
      setProviderData([])

      try {
        // Phase 1: Gathering Data (0-25%)
        startPhase("gathering")
        await smoothProgressUpdate(5)

        if (prices.length === 0) {
          return
        }

        for (let i = 0; i < prices.length; i++) {
          if (cancelled) return
          setProviderData((prev) => [
            ...prev,
            { provider: prices[i].provider, price: prices[i].price },
          ])
          const targetProgress = 5 + ((i + 1) / prices.length) * 20
          await smoothProgressUpdate(targetProgress)
          await sleep(80)
        }

        completePhase("gathering")
        await sleep(1500)

        // Phase 2: Analyzing Variance (25-60%)
        startPhase("analyzing")
        await smoothProgressUpdate(30)

        const deel = prices.find((p) => p.provider === "deel")
        if (!deel) return

        await sleep(500)
        const variance = selectVarianceWinner(prices, deel.price)
        await smoothProgressUpdate(45)

        await sleep(500)
        if (cancelled) return
        setProviderData(variance.analyzed)
        await smoothProgressUpdate(60)
        completePhase("analyzing")

        await sleep(1500)

        // Phase 3: Selecting Optimal (60-90%)
        startPhase("selecting")
        await smoothProgressUpdate(65)

        if (!variance.winner) return

        await sleep(600)
        await smoothProgressUpdate(80)
        const choice = variance.winner

        await sleep(400)
        const finalProviders = variance.analyzed.map((p) => ({
          ...p,
          isWinner: p.provider === choice.provider,
        }))
        if (cancelled) return
        setProviderData(finalProviders)
        await smoothProgressUpdate(90)
        completePhase("selecting")

        await sleep(1500)

        // Phase 4: Complete (90-100%)
        await smoothProgressUpdate(100)
        await sleep(200)

        const selectedEnhancement = enhancements[choice.provider as ProviderType]
        const finalChoiceData: FinalChoiceData = {
          provider: choice.provider,
          price: choice.price,
          currency,
          enhancedQuote: selectedEnhancement || undefined,
        }
        if (cancelled) return
        setFinalChoice(finalChoiceData)
        onComplete(finalChoiceData)

        completePhase("complete")
        startPhase("complete")
      } catch (error) {
        console.error("Reconciliation failed", error)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
    // We intentionally exclude `hasStarted`, `completedPhases`, etc. from deps —
    // this effect must fire exactly once per open. Re-runs would replay the
    // animation against fresh inputs, which is not the original behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const isPhaseActive = (phase: string) => activePhase === phase
  const isPhaseCompleted = (phase: string) => completedPhases.has(phase)
  const isPhaseStarted = (phase: string) => isPhaseActive(phase) || isPhaseCompleted(phase)

  const renderTimelinePhases = () => {
    return (
      <div className="space-y-8 p-6">
        {/* Phase 1: Gathering Data */}
        <div
          id="phase-gathering"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('gathering') ? 'border-primary shadow-sm ring-1 ring-primary' :
              isPhaseCompleted('gathering') ? 'border-primary/50 shadow-sm' :
              'border-border opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('gathering') ? 'bg-primary/10' :
                isPhaseCompleted('gathering') ? 'bg-primary/10' :
                'bg-muted'}
            `}>
              {isPhaseCompleted('gathering') ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : isPhaseActive('gathering') ? (
                <Activity className="h-6 w-6 text-primary animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-muted-foreground" />
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
            <div className="space-y-6">

              {/* Provider Grid */}
              <div className="bg-white border border-slate-200 shadow-md p-6">
                {(() => {
                  const expectedTotal = prices.length
                  const placeholdersNeeded = isPhaseActive('gathering') && providerData.length < expectedTotal
                    ? Math.min(3, expectedTotal - providerData.length)
                    : 0

                  const items = [
                    ...providerData.map((provider) => ({ type: 'provider' as const, provider })),
                    ...Array.from({ length: placeholdersNeeded }, (_, idx) => ({ type: 'placeholder' as const, id: idx }))
                  ]

                  const { firstRow, secondRow } = splitIntoBalancedRows(items)
                  const rows = [firstRow, secondRow].filter(row => row.length > 0)

                  return (
                    <div className={`flex flex-col items-center gap-4 transition-opacity duration-500 ${isPhaseStarted('gathering') ? 'opacity-100' : 'opacity-0'}`}>
                      {rows.map((row, rowIdx) => (
                        <div
                          key={`provider-row-${rowIdx}`}
                          className="flex flex-wrap justify-center gap-4"
                        >
                          {row.map((entry, entryIdx) => {
                            if (entry.type === 'provider') {
                              const { provider } = entry
                              return (
                                <div
                                  key={provider.provider}
                                  className="w-48 sm:w-56 md:w-60 bg-card border border-border px-6 py-5 text-center transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm transition-all"
                                >
                                  <div className="w-28 h-8 mx-auto mb-3 border-2 border-slate-200 flex items-center justify-center bg-white">
                                    <ProviderLogo provider={provider.provider as ProviderType} maxWidth={140} maxHeight={28} />
                                  </div>
                                  <div className="text-sm font-bold text-slate-800 capitalize mb-1 tracking-wide">
                                    {provider.provider}
                                  </div>
                                  <div className="text-base font-bold text-foreground">
                                    {formatMoney(provider.price, currency)}
                                  </div>
                                  <Badge className="mt-2 bg-primary/10 text-primary border-primary/20 text-[11px] px-3 py-1">
                                    Collected
                                  </Badge>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={`placeholder-${entry.id}-${rowIdx}-${entryIdx}`}
                                className="w-48 sm:w-56 md:w-60 bg-slate-50 border-2 border-slate-200 border-dashed px-6 py-5 text-center animate-pulse"
                              >
                                <div className="w-12 h-12 mx-auto mb-3 bg-slate-200 rounded" />
                                <div className="h-3 bg-slate-200 rounded mb-2 mx-auto w-20" />
                                <div className="h-4 bg-slate-200 rounded mx-auto w-24" />
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2: Analyzing Variance */}
        <div
          id="phase-analyzing"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('analyzing') ? 'border-primary shadow-sm ring-1 ring-primary' :
              isPhaseCompleted('analyzing') ? 'border-primary/50 shadow-sm' :
              'border-border opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('analyzing') ? 'bg-primary/10' :
                isPhaseCompleted('analyzing') ? 'bg-primary/10' :
                'bg-muted'}
            `}>
              {isPhaseCompleted('analyzing') ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : isPhaseActive('analyzing') ? (
                <BarChart3 className="h-6 w-6 text-primary animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-muted-foreground" />
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
            <div id="analyzing-results" className="bg-card border border-border shadow-sm p-8">
              {/* Visual Chart */}
              {(() => {
                const deelProvider = providerData.find(p => p.provider === 'deel')
                const deelPrice = deelProvider?.price || 0

                return (
                  <VarianceChart
                    providers={providerData}
                    deelPrice={deelPrice}
                    currency={currency}
                  />
                )
              })()}

            </div>
          )}
        </div>

        {/* Phase 3: Selecting Optimal */}
        <div
          id="phase-selecting"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('selecting') ? 'border-primary shadow-sm ring-1 ring-primary' :
              isPhaseCompleted('selecting') ? 'border-primary/50 shadow-sm' :
              'border-border opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('selecting') ? 'bg-primary/10' :
                isPhaseCompleted('selecting') ? 'bg-primary/10' :
                'bg-muted'}
            `}>
              {isPhaseCompleted('selecting') ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : isPhaseActive('selecting') ? (
                <Target className="h-6 w-6 text-primary animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-muted-foreground" />
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
            <div>
              {/* Provider Grid */}
              <div className="bg-white border border-slate-200 shadow-md p-6">
                {(() => {
                  const { firstRow, secondRow } = splitIntoBalancedRows(providerData)
                  const rows = [firstRow, secondRow].filter(row => row.length > 0)

                  return (
                    <div className="flex flex-col items-center gap-4">
                      {rows.map((row, rowIdx) => (
                        <div
                          key={`selection-row-${rowIdx}`}
                          className="flex flex-wrap justify-center gap-4"
                        >
                          {row.map((provider) => (
                            <div
                              key={provider.provider}
                              className={`
                                w-48 sm:w-56 md:w-60 border px-6 py-5 text-center transition-all duration-300
                                ${provider.isWinner ? 'bg-primary/5 border-primary shadow-sm scale-105' :
                                  provider.inRange ? 'bg-card border-border shadow-sm hover:border-primary/30 hover:bg-primary/5' :
                                  'bg-muted border-border opacity-50'}
                              `}
                            >
                              {provider.isWinner && (
                                <Crown className="h-5 w-5 text-primary mx-auto mb-2" />
                              )}
                              <div className="w-28 h-8 mx-auto mb-3 border-2 border-slate-200 flex items-center justify-center bg-white">
                                <ProviderLogo provider={provider.provider as ProviderType} maxWidth={140} maxHeight={28} />
                              </div>
                              <div className="text-sm font-bold text-slate-800 capitalize mb-1 tracking-wide">
                                {provider.provider}
                              </div>
                              <div className={`text-base font-bold ${
                                provider.isWinner ? 'text-foreground' :
                                provider.inRange ? 'text-foreground' : 'text-slate-600'
                              }`}>
                                {formatMoney(provider.price, currency)}
                              </div>
                              {provider.isWinner && (
                                <Badge className="mt-2 bg-yellow-400 text-foreground border-yellow-500 text-[11px] font-bold px-3 py-1">
                                  WINNER
                                </Badge>
                              )}
                              {!provider.isWinner && provider.inRange && (
                                <Badge className="mt-2 bg-green-100 text-foreground border-green-200 text-[11px] px-3 py-1">
                                  Qualified
                                </Badge>
                              )}
                              {!provider.inRange && (
                                <Badge className="mt-2 bg-slate-100 text-slate-500 border-slate-200 text-[11px] px-3 py-1">
                                  Out of Range
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Phase 4: Analysis Complete */}
        <div
          id="phase-complete"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('complete') || isPhaseCompleted('complete') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseStarted('complete') ? 'bg-primary/10' : 'bg-muted'}
            `}>
              {isPhaseStarted('complete') ? (
                <Crown className="h-6 w-6 text-primary" />
              ) : (
                <Clock className="h-6 w-6 text-muted-foreground" />
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
            <>
              {!showAcidTestForm ? (
                <div className="space-y-6">
                  {/* Winner Announcement Card */}
                  <div className="bg-card border border-primary shadow-sm p-8 transition-all duration-300">
                    <div className="text-center">
                      <h4 className="text-2xl font-bold text-slate-800 mb-2">{finalChoice.isOverride ? 'Selected Provider (Override)' : 'Recommended Provider'}</h4>
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="w-32 h-16 flex items-center justify-center bg-white border border-border shadow-sm p-3">
                          <ProviderLogo provider={finalChoice.provider as ProviderType} />
                        </div>
                      </div>
                      <div className="text-6xl font-bold text-primary mb-6 tracking-tight">
                        {formatMoney(finalChoice.price, finalChoice.currency)}
                      </div>
                      <div className="text-center">
                      <Button
                        onClick={() => onStartAcidTest?.()}
                        disabled={!finalChoice || !providerData.length || !onStartAcidTest}
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 px-10 py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className="h-6 w-6 mr-3" />
                        Start Acid Test
                      </Button>
                    </div>
                    </div>

                    {/* Override Section */}
                    {providerData.length > 1 && (
                      <div className="mt-8 pt-8 border-t border-border">
                        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 text-center">
                          Or Proceed With Alternative Provider
                        </h5>
                        <div className="flex flex-wrap justify-center gap-3">
                          {providerData
                            .filter((p) => p.provider !== finalChoice.provider)
                            .map((p) => (
                              <Button
                                key={p.provider}
                                variant="outline"
                                className="relative h-auto min-w-[140px] py-4 px-6 flex flex-col items-center justify-center gap-3 border-border hover:border-primary/30 hover:bg-primary/5 shadow-sm transition-all hover:shadow-md"
                                onClick={() => {
                                  const selectedEnhancement = enhancements[p.provider as ProviderType];
                                  const choiceData = {
                                    provider: p.provider,
                                    price: p.price,
                                    currency: finalChoice.currency,
                                    enhancedQuote: selectedEnhancement || undefined,
                                    isOverride: !p.isWinner
                                  };
                                  setFinalChoice(choiceData);
                                }}
                              >
                                {p.isWinner && (
                                  <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-slate-200" title="Original Recommendation">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  </div>
                                )}
                                <div className="h-8 flex items-center justify-center">
                                  <ProviderLogo provider={p.provider as ProviderType} maxWidth={80} maxHeight={24} />
                                </div>
                                <span className="font-bold text-slate-800 text-lg">
                                  {formatMoney(p.price, finalChoice.currency)}
                                </span>
                              </Button>
                            ))}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* CTA Button */}
                  <div>
                    {/* Acid Test Error Display */}
                    {acidTestError && (
                      <div className="mt-6 bg-red-50 border-2 border-red-200 shadow-sm p-4">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-bold text-red-800">Acid Test Failed</p>
                            <p className="text-sm text-red-600 mt-1">{acidTestError}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDismissAcidTestError?.()}
                              className="mt-3 text-red-600 border-red-300 hover:bg-red-50 font-semibold"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                acidTestFormSlot ?? null
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="relative w-screen h-screen border-0 shadow-none bg-white overflow-hidden rounded-none">

        {/* Top Banner: Progress Bar + Phase */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary shadow-sm">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
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
              <Button variant="outline" size="sm" onClick={onClose} className="ml-4 rounded-none">
                <XCircle className="h-4 w-4 mr-1.5" />
                Close
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 bg-slate-200 h-2.5 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Main Timeline Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {renderTimelinePhases()}
        </div>
      </Card>
    </div>
  )
}
