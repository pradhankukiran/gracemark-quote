"use client"

import { useEffect, Suspense, memo, useState, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle, Brain, Target, Zap, BarChart3, TrendingUp, Crown, Activity, FileText, Info, ChevronDown, ChevronUp } from "lucide-react"
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
import { EORFormData, RemoteAPIResponse, Quote, RivermateQuote, OysterQuote } from "@/lib/shared/types"
import { ProviderType, EnhancedQuote, TerminationComponentEnhancement } from "@/lib/types/enhancement"
import { convertCurrency } from "@/lib/currency-converter"
import { getRawQuote } from "@/lib/shared/utils/rawQuoteStore"

type AcidTestCategoryBuckets = {
  baseSalary: Record<string, number>
  statutoryMandatory: Record<string, number>
  allowancesBenefits: Record<string, number>
  terminationCosts: Record<string, number>
  oneTimeFees: Record<string, number>
}

type AcidTestAggregates = {
  baseSalaryMonthly: number
  statutoryMonthly: number
  allowancesMonthly: number
  terminationMonthly: number
  oneTimeTotal: number
}

type AcidTestCostData = {
  provider: string
  currency: string
  categories: AcidTestCategoryBuckets
} & AcidTestAggregates

type AcidTestBreakdown = {
  salaryTotal: number
  statutoryTotal: number
  allowancesTotal: number
  terminationTotal: number
  oneTimeTotal: number
  recurringMonthly: number
  recurringTotal: number
  // USD versions
  salaryTotalUSD?: number
  statutoryTotalUSD?: number
  allowancesTotalUSD?: number
  terminationTotalUSD?: number
  oneTimeTotalUSD?: number
  recurringMonthlyUSD?: number
  recurringTotalUSD?: number
}

type BillRateComposition = {
  salaryMonthly: number
  statutoryMonthly: number
  terminationMonthly: number
  allowancesMonthly: number
  gracemarkFeeMonthly: number
  providerFeeMonthly: number
  expectedBillRate: number
  actualBillRate: number
  rateDiscrepancy: number
  gracemarkFeePercentage: number
  // USD versions
  salaryMonthlyUSD?: number
  statutoryMonthlyUSD?: number
  terminationMonthlyUSD?: number
  allowancesMonthlyUSD?: number
  gracemarkFeeMonthlyUSD?: number
  providerFeeMonthlyUSD?: number
  expectedBillRateUSD?: number
  actualBillRateUSD?: number
  rateDiscrepancyUSD?: number
}

type AcidTestSummary = {
  currency: string
  billRateMonthly: number
  durationMonths: number
  revenueTotal: number
  totalCost: number
  profitLocal: number
  revenueUSD?: number
  totalCostUSD?: number
  profitUSD?: number
  marginMonthly: number
  marginTotal: number
  marginMonthlyUSD?: number
  marginTotalUSD?: number
  meetsPositive: boolean
  meetsMinimum: boolean
  minimumShortfallUSD?: number
}

type AcidTestCalculationResult = {
  summary: AcidTestSummary
  breakdown: AcidTestBreakdown
  billRateComposition: BillRateComposition
  thresholds: {
    minimumUSD: number
  }
  conversionError?: string | null
}

const LoadingSpinner = () => (
  <div role="status" aria-label="Loading quotes" className="flex items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
    <span className="sr-only">Loading...</span>
  </div>
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
    enhancementBatchInfo,
    isComparisonReady,
    isDualCurrencyComparisonReady
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

  // Acid Test state
  const [acidTestError, setAcidTestError] = useState<string | null>(null)

  // Acid Test Form state
  const [showAcidTestForm, setShowAcidTestForm] = useState(false)
  const [monthlyBillRate, setMonthlyBillRate] = useState<number>(0)
  const [projectDuration, setProjectDuration] = useState<number>(6)
  const [isAllInclusiveQuote, setIsAllInclusiveQuote] = useState<boolean>(true)
  const [acidTestDisplayCurrency, setAcidTestDisplayCurrency] = useState<"local" | "usd">("local")
  const [acidTestResults, setAcidTestResults] = useState<AcidTestCalculationResult | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const acidTestHasUSDData = useMemo(() => {
    if (!acidTestResults) return false
    if (acidTestResults.summary.currency === 'USD') return false

    const { summary, breakdown, billRateComposition } = acidTestResults
    const summaryUSD = [
      summary.revenueUSD,
      summary.totalCostUSD,
      summary.profitUSD,
      summary.marginMonthlyUSD,
      summary.marginTotalUSD,
    ]
    const breakdownUSD = [
      breakdown.salaryTotalUSD,
      breakdown.statutoryTotalUSD,
      breakdown.allowancesTotalUSD,
      breakdown.terminationTotalUSD,
      breakdown.oneTimeTotalUSD,
      breakdown.recurringMonthlyUSD,
      breakdown.recurringTotalUSD,
    ]
    const compositionUSD = [
      billRateComposition.salaryMonthlyUSD,
      billRateComposition.statutoryMonthlyUSD,
      billRateComposition.allowancesMonthlyUSD,
      billRateComposition.terminationMonthlyUSD,
      billRateComposition.gracemarkFeeMonthlyUSD,
      billRateComposition.providerFeeMonthlyUSD,
      billRateComposition.expectedBillRateUSD,
      billRateComposition.actualBillRateUSD,
      billRateComposition.rateDiscrepancyUSD,
    ]

    return [...summaryUSD, ...breakdownUSD, ...compositionUSD].some(value => typeof value === 'number')
  }, [acidTestResults])
  const [acidTestValidation, setAcidTestValidation] = useState<{
    billRateError?: string;
    durationError?: string;
  }>({})
  const [acidTestCostData, setAcidTestCostData] = useState<AcidTestCostData | null>(null)
  const [isCategorizingCosts, setIsCategorizingCosts] = useState(false)
  const [isComputingAcidTest, setIsComputingAcidTest] = useState(false)

  const MIN_PROFIT_THRESHOLD_USD = 1000

  useEffect(() => {
    if (!acidTestResults) {
      if (acidTestDisplayCurrency !== 'local') {
        setAcidTestDisplayCurrency('local')
      }
      return
    }

    if (acidTestResults.summary.currency === 'USD') {
      if (acidTestDisplayCurrency !== 'local') {
        setAcidTestDisplayCurrency('local')
      }
      return
    }

    if (!acidTestHasUSDData && acidTestDisplayCurrency === 'usd') {
      setAcidTestDisplayCurrency('local')
    }
  }, [acidTestResults, acidTestHasUSDData, acidTestDisplayCurrency])

  const buildAcidTestCalculation = useCallback(async (
    costData: AcidTestCostData,
    billRate: number,
    duration: number,
    isAllInclusive: boolean
  ): Promise<AcidTestCalculationResult> => {
    // Calculate component totals for full assignment
    const salaryTotal = costData.baseSalaryMonthly * duration
    const statutoryTotal = costData.statutoryMonthly * duration
    const allowancesTotal = costData.allowancesMonthly * duration
    // Only include termination costs if it's an all-inclusive quote
    const terminationTotal = isAllInclusive ? (costData.terminationMonthly * duration) : 0
    const oneTimeTotal = costData.oneTimeTotal

    const coreMonthlyCost = costData.baseSalaryMonthly + costData.statutoryMonthly + costData.allowancesMonthly
    const terminationMonthlyFull = costData.terminationMonthly
    const totalMonthlyQuoteCost = coreMonthlyCost + terminationMonthlyFull
    const actualMonthlyQuote = billRate

    // Calculate monthly recurring costs (what goes into bill rate)
    const recurringMonthly = isAllInclusive ? totalMonthlyQuoteCost : coreMonthlyCost

    // Calculate expected Gracemark fee (45% of total monthly cost of the selected quote)
    const GRACEMARK_FEE_PERCENTAGE = 0.45
    const expectedGracemarkFeeMonthly = actualMonthlyQuote * GRACEMARK_FEE_PERCENTAGE

    // Provider fee is included within Gracemark fee (typically 30% of Gracemark fee)
    const PROVIDER_FEE_RATIO = 0.30
    const providerFeeMonthly = expectedGracemarkFeeMonthly * PROVIDER_FEE_RATIO

    // Expected bill rate composition (what we should charge monthly)
    const expectedBillRateMonthly = actualMonthlyQuote

    // Total costs for full assignment (for cash flow check)
    const recurringTotal = recurringMonthly * duration
    const totalCostsGracemark = recurringTotal + oneTimeTotal // Everything Gracemark pays out

    // Actual values from input
    const actualRevenueTotal = billRate * duration
    const rateDiscrepancy = billRate - expectedBillRateMonthly

    // Cash flow calculation: Revenue vs what we pay out
    const profitLocal = actualRevenueTotal - totalCostsGracemark

    const marginMonthly = billRate - recurringMonthly
    const marginTotal = marginMonthly * duration - oneTimeTotal

    // Comprehensive USD conversion
    let revenueUSD: number | undefined
    let totalCostUSD: number | undefined
    let profitUSD: number | undefined
    let conversionError: string | null = null

    // USD versions for breakdown
    let salaryTotalUSD: number | undefined
    let statutoryTotalUSD: number | undefined
    let allowancesTotalUSD: number | undefined
    let terminationTotalUSD: number | undefined
    let oneTimeTotalUSD: number | undefined
    let recurringMonthlyUSD: number | undefined
    let recurringTotalUSD: number | undefined

    // USD versions for bill rate composition
    let salaryMonthlyUSD: number | undefined
    let statutoryMonthlyUSD: number | undefined
    let allowancesMonthlyUSD: number | undefined
    let terminationMonthlyUSD: number | undefined
    let gracemarkFeeMonthlyUSD: number | undefined
    let providerFeeMonthlyUSD: number | undefined
    let expectedBillRateUSD: number | undefined
    let actualBillRateUSD: number | undefined
    let rateDiscrepancyUSD: number | undefined
    let marginMonthlyUSD: number | undefined
    let marginTotalUSD: number | undefined

    if (costData.currency === 'USD') {
      // Direct assignment for USD currency
      revenueUSD = actualRevenueTotal
      totalCostUSD = totalCostsGracemark
      profitUSD = profitLocal

      // Breakdown USD values
      salaryTotalUSD = salaryTotal
      statutoryTotalUSD = statutoryTotal
      allowancesTotalUSD = allowancesTotal
      terminationTotalUSD = terminationTotal
      oneTimeTotalUSD = oneTimeTotal
      recurringMonthlyUSD = recurringMonthly
      recurringTotalUSD = recurringTotal

      // Bill rate composition USD values
      salaryMonthlyUSD = costData.baseSalaryMonthly
      statutoryMonthlyUSD = costData.statutoryMonthly
      allowancesMonthlyUSD = costData.allowancesMonthly
      terminationMonthlyUSD = isAllInclusive ? costData.terminationMonthly : 0
      gracemarkFeeMonthlyUSD = expectedGracemarkFeeMonthly
      providerFeeMonthlyUSD = providerFeeMonthly
      expectedBillRateUSD = expectedBillRateMonthly
      actualBillRateUSD = billRate
      rateDiscrepancyUSD = rateDiscrepancy
      marginMonthlyUSD = marginMonthly
      marginTotalUSD = marginTotal
    } else {
      try {
        // Convert all values to USD in parallel
        const conversions = await Promise.all([
          convertCurrency(actualRevenueTotal, costData.currency, 'USD'),
          convertCurrency(totalCostsGracemark, costData.currency, 'USD'),
          convertCurrency(salaryTotal, costData.currency, 'USD'),
          convertCurrency(statutoryTotal, costData.currency, 'USD'),
          convertCurrency(allowancesTotal, costData.currency, 'USD'),
          convertCurrency(terminationTotal, costData.currency, 'USD'),
          convertCurrency(oneTimeTotal, costData.currency, 'USD'),
          convertCurrency(recurringMonthly, costData.currency, 'USD'),
          convertCurrency(recurringTotal, costData.currency, 'USD'),
          convertCurrency(costData.baseSalaryMonthly, costData.currency, 'USD'),
          convertCurrency(costData.statutoryMonthly, costData.currency, 'USD'),
          convertCurrency(costData.allowancesMonthly, costData.currency, 'USD'),
          convertCurrency(isAllInclusive ? costData.terminationMonthly : 0, costData.currency, 'USD'),
          convertCurrency(expectedGracemarkFeeMonthly, costData.currency, 'USD'),
          convertCurrency(providerFeeMonthly, costData.currency, 'USD'),
          convertCurrency(expectedBillRateMonthly, costData.currency, 'USD'),
          convertCurrency(billRate, costData.currency, 'USD'),
          convertCurrency(rateDiscrepancy, costData.currency, 'USD')
        ])

        const [
          revenueConv, totalCostConv, salaryTotalConv, statutoryTotalConv, allowancesTotalConv,
          terminationTotalConv, oneTimeTotalConv, recurringMonthlyConv, recurringTotalConv,
          salaryMonthlyConv, statutoryMonthlyConv, allowancesMonthlyConv, terminationMonthlyConv,
          gracemarkFeeMonthlyConv, providerFeeMonthlyConv, expectedBillRateConv, actualBillRateConv,
          rateDiscrepancyConv
        ] = conversions

        // Extract successful conversions
        if (revenueConv.success && revenueConv.data) revenueUSD = revenueConv.data.target_amount
        if (totalCostConv.success && totalCostConv.data) totalCostUSD = totalCostConv.data.target_amount
        if (salaryTotalConv.success && salaryTotalConv.data) salaryTotalUSD = salaryTotalConv.data.target_amount
        if (statutoryTotalConv.success && statutoryTotalConv.data) statutoryTotalUSD = statutoryTotalConv.data.target_amount
        if (allowancesTotalConv.success && allowancesTotalConv.data) allowancesTotalUSD = allowancesTotalConv.data.target_amount
        if (terminationTotalConv.success && terminationTotalConv.data) terminationTotalUSD = terminationTotalConv.data.target_amount
        if (oneTimeTotalConv.success && oneTimeTotalConv.data) oneTimeTotalUSD = oneTimeTotalConv.data.target_amount
        if (recurringMonthlyConv.success && recurringMonthlyConv.data) recurringMonthlyUSD = recurringMonthlyConv.data.target_amount
        if (recurringTotalConv.success && recurringTotalConv.data) recurringTotalUSD = recurringTotalConv.data.target_amount
        if (salaryMonthlyConv.success && salaryMonthlyConv.data) salaryMonthlyUSD = salaryMonthlyConv.data.target_amount
        if (statutoryMonthlyConv.success && statutoryMonthlyConv.data) statutoryMonthlyUSD = statutoryMonthlyConv.data.target_amount
        if (allowancesMonthlyConv.success && allowancesMonthlyConv.data) allowancesMonthlyUSD = allowancesMonthlyConv.data.target_amount
        if (terminationMonthlyConv.success && terminationMonthlyConv.data) terminationMonthlyUSD = terminationMonthlyConv.data.target_amount
        if (gracemarkFeeMonthlyConv.success && gracemarkFeeMonthlyConv.data) gracemarkFeeMonthlyUSD = gracemarkFeeMonthlyConv.data.target_amount
        if (providerFeeMonthlyConv.success && providerFeeMonthlyConv.data) providerFeeMonthlyUSD = providerFeeMonthlyConv.data.target_amount
        if (expectedBillRateConv.success && expectedBillRateConv.data) expectedBillRateUSD = expectedBillRateConv.data.target_amount
        if (actualBillRateConv.success && actualBillRateConv.data) actualBillRateUSD = actualBillRateConv.data.target_amount
        if (rateDiscrepancyConv.success && rateDiscrepancyConv.data) rateDiscrepancyUSD = rateDiscrepancyConv.data.target_amount

        if (typeof actualBillRateUSD === 'number' && typeof recurringMonthlyUSD === 'number') {
          marginMonthlyUSD = actualBillRateUSD - recurringMonthlyUSD
        }
        if (typeof marginMonthlyUSD === 'number' && typeof oneTimeTotalUSD === 'number') {
          marginTotalUSD = marginMonthlyUSD * duration - oneTimeTotalUSD
        }

        // Calculate USD profit if we have both values
        if (revenueUSD !== undefined && totalCostUSD !== undefined) {
          profitUSD = revenueUSD - totalCostUSD
        }

        // Collect any conversion errors
        const errors = conversions.filter(c => !c.success).map(c => c.error).filter(Boolean)
        if (errors.length > 0) {
          conversionError = `Currency conversion errors: ${errors.join('; ')}`
        }
      } catch (err) {
        conversionError = err instanceof Error ? err.message : 'Unable to convert currency to USD'
      }
    }

    const meetsPositive = profitLocal > 0
    const profitForMinimum = typeof profitUSD === 'number'
      ? profitUSD
      : (costData.currency === 'USD' ? profitLocal : undefined)
    const meetsMinimum = typeof profitForMinimum === 'number'
      ? profitForMinimum >= MIN_PROFIT_THRESHOLD_USD
      : false
    const minimumShortfallUSD = typeof profitForMinimum === 'number'
      ? Math.max(0, MIN_PROFIT_THRESHOLD_USD - profitForMinimum)
      : undefined

    return {
      summary: {
        currency: costData.currency,
        billRateMonthly: billRate,
        durationMonths: duration,
        revenueTotal: actualRevenueTotal,
        totalCost: totalCostsGracemark,
        profitLocal,
        revenueUSD,
        totalCostUSD,
        profitUSD,
        marginMonthly,
        marginTotal,
        marginMonthlyUSD,
        marginTotalUSD,
        meetsPositive,
        meetsMinimum,
        minimumShortfallUSD,
      },
      breakdown: {
        salaryTotal,
        statutoryTotal,
        allowancesTotal,
        terminationTotal,
        oneTimeTotal,
        recurringMonthly,
        recurringTotal,
        // USD versions
        salaryTotalUSD,
        statutoryTotalUSD,
        allowancesTotalUSD,
        terminationTotalUSD,
        oneTimeTotalUSD,
        recurringMonthlyUSD,
        recurringTotalUSD,
      },
      billRateComposition: {
        salaryMonthly: costData.baseSalaryMonthly,
        statutoryMonthly: costData.statutoryMonthly,
        terminationMonthly: isAllInclusive ? costData.terminationMonthly : 0,
        allowancesMonthly: costData.allowancesMonthly,
        gracemarkFeeMonthly: expectedGracemarkFeeMonthly,
        providerFeeMonthly: providerFeeMonthly,
        expectedBillRate: expectedBillRateMonthly,
        actualBillRate: billRate,
        rateDiscrepancy: rateDiscrepancy,
        gracemarkFeePercentage: GRACEMARK_FEE_PERCENTAGE,
        // USD versions
        salaryMonthlyUSD,
        statutoryMonthlyUSD,
        terminationMonthlyUSD,
        allowancesMonthlyUSD,
        gracemarkFeeMonthlyUSD,
        providerFeeMonthlyUSD,
        expectedBillRateUSD,
        actualBillRateUSD,
        rateDiscrepancyUSD,
      },
      thresholds: {
        minimumUSD: MIN_PROFIT_THRESHOLD_USD,
      },
      conversionError,
    }
  }, [])

  useEffect(() => {
    if (!showAcidTestForm) {
      setIsComputingAcidTest(false)
      return
    }

    if (!acidTestCostData || !finalChoice || !quoteData?.formData) {
      setIsComputingAcidTest(false)
      setAcidTestResults(null)
      return
    }

    // Use automatic values instead of user inputs
    const automaticBillRate = finalChoice.price
    const automaticDuration = Number((quoteData.formData as EORFormData)?.contractDuration) || 6
    const automaticIsAllInclusive = true // Most quotes are all-inclusive

    if (automaticBillRate <= 0 || automaticDuration <= 0) {
      setIsComputingAcidTest(false)
      setAcidTestResults(null)
      return
    }

    let cancelled = false
    setIsComputingAcidTest(true)

    buildAcidTestCalculation(acidTestCostData, automaticBillRate, automaticDuration, automaticIsAllInclusive)
      .then(result => {
        if (!cancelled) {
          setAcidTestError(null)
          setAcidTestResults(result)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to compute acid test results', err)
          setAcidTestError('Failed to compute acid test results. Please try again.')
          setAcidTestResults(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsComputingAcidTest(false)
      })

    return () => {
      cancelled = true
    }
  }, [showAcidTestForm, acidTestCostData, finalChoice, quoteData?.formData, buildAcidTestCalculation])

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
    const hasCompletedBefore = completedPhases.has('analyzing') || completedPhases.has('complete')

    let message = 'Enhancing quotes...'
    if (isReady) {
      message = hasCompletedBefore ? 'View Analysis Results' : 'Start Reconciliation'
    }

    return {
      ready: isReady,
      message
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

  // Simple progress update function
  const smoothProgressUpdate = (targetProgress: number) => {
    return new Promise<void>((resolve) => {
      setProgressPercent(targetProgress)
      setTimeout(resolve, 200)
    })
  }

  // Simple auto-scroll
  const scrollToPhase = (phaseId: string) => {
    setTimeout(() => {
      // For analyzing phase, scroll to the results content instead of the phase container
      const targetId = phaseId === 'analyzing' ? 'analyzing-results' : `phase-${phaseId}`
      let element = document.getElementById(targetId)

      // Fallback to phase container if results element doesn't exist
      if (!element && phaseId === 'analyzing') {
        element = document.getElementById('phase-analyzing')
      }

      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: phaseId === 'complete' ? 'end' : 'start',
          inline: 'nearest'
        })
      }
    }, phaseId === 'analyzing' ? 800 : 400) // Longer delay for analyzing phase to ensure content is rendered
  }

  // Scroll to bottom of modal container with proper timing
  const scrollToBottom = () => {
    return new Promise<void>((resolve) => {
      // Use requestAnimationFrame to ensure DOM layout is complete
      requestAnimationFrame(() => {
        setTimeout(() => {
          const scrollContainer = document.querySelector('.overflow-y-auto.scroll-smooth')
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            })
          }
          resolve()
        }, 500) // Wait for CSS transitions to complete
      })
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

    return (
      <div className="space-y-8 p-6">
        {/* Phase 1: Gathering Data */}
        <div
          id="phase-gathering"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('gathering') ? 'border-slate-900 shadow-lg' :
              isPhaseCompleted('gathering') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('gathering') ? 'bg-slate-100' :
                isPhaseCompleted('gathering') ? 'bg-green-100' :
                'bg-slate-50'}
            `}>
              {isPhaseCompleted('gathering') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('gathering') ? (
                <Activity className="h-6 w-6 text-slate-900 animate-pulse" />
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
              isPhaseStarted('gathering') ? 'opacity-100 stagger-children' : 'opacity-0'
            }`}>
              {providerData.map((provider, idx) => (
                <div
                  key={provider.provider}
                  className="bg-white border border-slate-200 p-3 text-center transition-all duration-300 hover:shadow-md"
                >
                  <div className="w-24 h-6 mx-auto mb-2 border border-slate-200 flex items-center justify-center bg-white">
                    <ProviderLogo provider={provider.provider as ProviderType} maxWidth={120} maxHeight={24} />
                  </div>
                  <div className="text-xs font-semibold text-slate-700 capitalize mb-1">
                    {provider.provider}
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {formatMoney(provider.price, currency)}
                  </div>
                </div>
              ))}
              
              {/* Enhanced placeholder cards */}
              {isPhaseActive('gathering') && Array.from({ length: Math.max(0, 7 - providerData.length) }).map((_, idx) => (
                <div 
                  key={`placeholder-${idx}`}
                  className="bg-slate-100 border border-slate-200 p-3 text-center animate-pulse"
                >
                  <div className="w-10 h-10 mx-auto mb-2 bg-slate-200" />
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
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('analyzing') ? 'border-slate-900 shadow-lg' :
              isPhaseCompleted('analyzing') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('analyzing') ? 'bg-slate-100' :
                isPhaseCompleted('analyzing') ? 'bg-green-100' :
                'bg-slate-50'}
            `}>
              {isPhaseCompleted('analyzing') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('analyzing') ? (
                <BarChart3 className="h-6 w-6 text-slate-900 animate-pulse" />
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
            <div id="analyzing-results" className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 border border-slate-200 shadow-lg p-8">
              {/* <div className="mb-8">
                <div className="text-center bg-white shadow-sm border border-slate-200 p-6 mb-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
                      <BarChart3 className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h4 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        4% Variance Analysis
                      </h4>
                      <p className="text-slate-600 mt-2 text-base">
                        Comprehensive price compliance validation against Deel baseline standards
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm p-6">
                  <h5 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-100">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    Provider Compliance Assessment
                  </h5>
                  <p className="text-slate-600 mb-2">
                    Each provider quote is evaluated against our standard ±4% variance tolerance from the Deel baseline price.
                    This ensures pricing consistency and helps identify potential outliers in the market.
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-green-600"></div>
                      <span className="font-medium">Compliant (Within ±4%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gradient-to-r from-red-500 to-red-600"></div>
                      <span className="font-medium">Non-Compliant (Outside ±4%)</span>
                    </div>
                  </div>
                </div>
              </div> */}

              {/* Provider Variance Analysis Table */}
              <div className="bg-white border border-slate-200 shadow-lg mb-8">
                <div className="bg-slate-800 text-white p-4">
                  <h5 className="text-xl font-bold">Provider Quote Analysis</h5>
                  <p className="text-slate-300 text-sm mt-1">Detailed comparison against Deel baseline with 4% tolerance</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-slate-800">Provider</th>
                        <th className="text-right py-4 px-6 font-semibold text-slate-800">Quote Price</th>
                        <th className="text-center py-4 px-6 font-semibold text-slate-800">Variance from Deel</th>
                        <th className="text-center py-4 px-6 font-semibold text-slate-800">Compliance</th>
                        <th className="text-center py-4 px-6 font-semibold text-slate-800">Price Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(() => {
                        const deelProvider = providerData.find(p => p.provider === 'deel')
                        const deelPrice = deelProvider?.price || 0
                        const maxPrice = Math.max(...providerData.map(p => p.price))

                        return providerData.map((provider, index) => {
                          const percentage = deelPrice > 0 ? ((provider.price - deelPrice) / deelPrice * 100) : 0
                          const isDeelBaseline = provider.provider === 'deel'
                          const barWidth = Math.min(100, Math.max(10, (provider.price / maxPrice) * 100))

                          return (
                            <tr key={provider.provider} className={`hover:bg-slate-50 transition-colors ${
                              isDeelBaseline ? 'bg-blue-50' : ''
                            }`}>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 shadow-sm">
                                    <ProviderLogo provider={provider.provider as ProviderType} maxWidth={40} maxHeight={40} />
                                  </div>
                                  <div>
                                    <h6 className="font-semibold text-slate-800 capitalize">
                                      {provider.provider}
                                      {isDeelBaseline && (
                                        <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                          Baseline
                                        </span>
                                      )}
                                    </h6>
                                    <p className="text-sm text-slate-500">EOR Provider</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="text-lg font-bold text-slate-900">
                                  {formatMoney(provider.price, currency)}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex flex-col items-center">
                                  <div className={`text-lg font-bold ${
                                    isDeelBaseline ? 'text-blue-600' :
                                    provider.inRange ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {isDeelBaseline ? '0.0%' : `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`}
                                  </div>
                                  <div className="w-32 h-2 bg-slate-200 mt-2 overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-1000 ease-out ${
                                        isDeelBaseline ? 'bg-blue-600' :
                                        provider.inRange ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                        'bg-gradient-to-r from-red-500 to-red-600'
                                      }`}
                                      style={{
                                        width: `${barWidth}%`,
                                        transitionDelay: `${index * 200}ms`
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    {isDeelBaseline ? (
                                      <div className="flex items-center gap-1 text-blue-600">
                                        <Target className="h-4 w-4" />
                                        <span className="text-sm font-medium">Reference</span>
                                      </div>
                                    ) : provider.inRange ? (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-sm font-medium">Pass</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-600">
                                        <XCircle className="h-4 w-4" />
                                        <span className="text-sm font-medium">Fail</span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge className={
                                    isDeelBaseline
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : provider.inRange
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : 'bg-red-100 text-red-800 border-red-200'
                                  }>
                                    {isDeelBaseline ? 'Baseline' : provider.inRange ? 'Compliant' : 'Non-Compliant'}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-center">
                                <div className="text-xs text-slate-600">
                                  <div className="font-medium">
                                    {formatMoney(deelPrice * 0.96, currency)} - {formatMoney(deelPrice * 1.04, currency)}
                                  </div>
                                  <div className="text-slate-500 mt-1">Acceptable Range</div>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enhanced Analysis Summary */}
              {/* <div className="grid gap-8 lg:grid-cols-2">
                <div className="bg-white border border-slate-200 shadow-sm p-6">
                  <div className="mb-6">
                    <h5 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                      <div className="p-2 bg-green-100">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      Compliance Summary
                    </h5>
                    <p className="text-slate-600">Overall variance analysis results</p>
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const compliantCount = providerData.filter(p => p.inRange).length
                      const totalCount = providerData.length
                      const complianceRate = (compliantCount / totalCount) * 100

                      return (
                        <>
                          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200">
                            <span className="font-medium text-slate-700">Total Providers Analyzed</span>
                            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200">
                            <span className="font-medium text-green-700">Compliant Providers</span>
                            <span className="text-2xl font-bold text-green-800">{compliantCount}</span>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200">
                            <span className="font-medium text-red-700">Non-Compliant Providers</span>
                            <span className="text-2xl font-bold text-red-800">{totalCount - compliantCount}</span>
                          </div>

                          <div className={`p-4 border-l-4 ${
                            complianceRate >= 80 ? 'bg-green-50 border-green-400' :
                            complianceRate >= 60 ? 'bg-yellow-50 border-yellow-400' :
                            'bg-red-50 border-red-400'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">Compliance Rate</span>
                              <span className={`text-3xl font-bold ${
                                complianceRate >= 80 ? 'text-green-700' :
                                complianceRate >= 60 ? 'text-yellow-700' :
                                'text-red-700'
                              }`}>
                                {complianceRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm p-6">
                  <div className="mb-6">
                    <h5 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                      <div className="p-2 bg-indigo-100">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                      </div>
                      Market Insights
                    </h5>
                    <p className="text-slate-600">Price distribution and variance patterns</p>
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const deelProvider = providerData.find(p => p.provider === 'deel')
                      const deelPrice = deelProvider?.price || 0
                      const prices = providerData.map(p => p.price)
                      const minPrice = Math.min(...prices)
                      const maxPrice = Math.max(...prices)
                      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length

                      const highestVariance = providerData
                        .filter(p => p.provider !== 'deel')
                        .reduce((max, provider) => {
                          const percentage = Math.abs(deelPrice > 0 ? ((provider.price - deelPrice) / deelPrice * 100) : 0)
                          return percentage > max.percentage ? { provider: provider.provider, percentage } : max
                        }, { provider: '', percentage: 0 })

                      return (
                        <>
                          <div className="bg-slate-50 border border-slate-200 p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-slate-600">Market Range</span>
                              <span className="font-semibold text-slate-800">
                                {formatMoney(minPrice, currency)} - {formatMoney(maxPrice, currency)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-slate-600">Average Price</span>
                              <span className="font-semibold text-slate-800">{formatMoney(avgPrice, currency)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-slate-600">Deel Baseline</span>
                              <span className="font-semibold text-blue-600">{formatMoney(deelPrice, currency)}</span>
                            </div>
                          </div>

                          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 p-4">
                            <div className="font-semibold text-orange-900 mb-2">Highest Variance</div>
                            <div className="text-sm text-orange-700">
                              <span className="font-medium capitalize">{highestVariance.provider}</span> deviates by{' '}
                              <span className="font-bold">{highestVariance.percentage.toFixed(1)}%</span> from baseline
                            </div>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 p-4">
                            <div className="font-medium text-blue-900 mb-1">Quality Assessment</div>
                            <p className="text-sm text-blue-800">
                              {(() => {
                                const complianceRate = (providerData.filter(p => p.inRange).length / providerData.length) * 100
                                if (complianceRate >= 80) {
                                  return 'Market shows excellent price consistency with high compliance rates.'
                                } else if (complianceRate >= 60) {
                                  return 'Market shows moderate variance. Review outliers for potential issues.'
                                } else {
                                  return 'High market variance detected. Consider additional price validation.'
                                }
                              })()}
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div> */}
            </div>
          )}
        </div>

        {/* Phase 3: Selecting Optimal */}
        <div
          id="phase-selecting"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('selecting') ? 'border-slate-900 shadow-lg' :
              isPhaseCompleted('selecting') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('selecting') ? 'bg-slate-100' :
                isPhaseCompleted('selecting') ? 'bg-green-100' :
                'bg-slate-50'}
            `}>
              {isPhaseCompleted('selecting') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('selecting') ? (
                <Target className="h-6 w-6 text-slate-900 animate-pulse" />
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
                    bg-white border p-3 text-center transition-all duration-300
                    ${provider.isWinner ? 'border-slate-900 shadow-md' :
                      provider.inRange ? 'border-green-500' :
                      'border-slate-200 opacity-50'}
                  `}
                >
                  {provider.isWinner && (
                    <Crown className="h-4 w-4 text-slate-900 mx-auto mb-1" />
                  )}
                  <div className="w-24 h-6 mx-auto mb-2 border flex items-center justify-center bg-white">
                    <ProviderLogo provider={provider.provider as ProviderType} maxWidth={120} maxHeight={24} />
                  </div>
                  <div className="text-xs font-medium text-slate-800 capitalize mb-1">
                    {provider.provider}
                  </div>
                  <div className={`text-sm font-bold ${
                    provider.isWinner ? 'text-slate-900' :
                    provider.inRange ? 'text-green-600' : 'text-slate-600'
                  }`}>
                    {formatMoney(provider.price, currency)}
                  </div>
                  {provider.isWinner && (
                    <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-xs mt-1">
                      Selected
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
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('complete') || isPhaseCompleted('complete') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseStarted('complete') ? 'bg-green-100' : 'bg-slate-50'}
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
            <>
              {!showAcidTestForm ? (
                <div className="bg-green-50 p-8 border border-green-200 shadow-sm transition-all duration-300">
                  <div className="text-center mb-8">
                    <div className="w-24 h-24 mx-auto mb-6 border border-green-300 flex items-center justify-center bg-white shadow-sm transition-transform duration-300 hover:scale-105">
                      <ProviderLogo provider={finalChoice.provider as ProviderType} />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 capitalize mb-3 tracking-tight">
                      {finalChoice.provider}
                    </div>
                    <div className="text-5xl font-bold text-green-600 mb-6 tracking-tight">
                      {formatMoney(finalChoice.price, finalChoice.currency)}
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2 text-sm font-semibold">
                      Recommended Provider
                    </Badge>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={handleStartAcidTest}
                      disabled={!finalChoice || !providerData.length}
                      size="lg"
                      className="bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 px-8 py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Zap className="h-5 w-5 mr-3" />
                      Start Acid Test
                    </Button>
                  </div>

                  {/* Acid Test Error Display */}
                  {acidTestError && (
                    <div className="mt-4 bg-red-50 border border-red-200 p-4">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-800">Acid Test Failed</p>
                          <p className="text-sm text-red-600 mt-1">{acidTestError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAcidTestError(null)}
                            className="mt-2 text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 border border-slate-200 shadow-lg p-6 md:p-8">
                  <div className="mx-auto flex max-w-5xl flex-col gap-8">
                    {/* Consolidated Acid Test Header */}
                    <div className="bg-white shadow-sm border border-slate-200 p-6">
                      <div className="flex items-center justify-between">
                        {/* Left: Acid Test Title & Icon */}
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 shadow-md rounded-lg">
                            <Zap className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                              Acid Test Calculator
                            </h3>
                            <p className="text-slate-600 text-sm">
                              Profitability analysis for <span className="font-semibold capitalize text-slate-800">{finalChoice.provider}</span>
                            </p>
                          </div>
                        </div>

                        {/* Center: Total Monthly Cost */}
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
                            <h5 className="text-base font-bold text-slate-800">Total Monthly Cost</h5>
                            <Badge className="bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 text-xs">Locked</Badge>
                          </div>
                          <div className="text-2xl font-bold text-slate-900 mb-1">
                            {(() => {
                              const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                              const recurringMonthlyUSD = acidTestResults?.breakdown?.recurringMonthlyUSD

                              if (showUSD && typeof recurringMonthlyUSD === 'number') {
                                return formatMoney(recurringMonthlyUSD, 'USD')
                              }
                              return formatMoney(finalChoice.price, finalChoice.currency)
                            })()}
                          </div>
                          {(() => {
                            const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                            const recurringMonthlyUSD = acidTestResults?.breakdown?.recurringMonthlyUSD
                            const localCurrency = acidTestResults?.summary?.currency || finalChoice.currency

                            if (showUSD && typeof recurringMonthlyUSD === 'number') {
                              return (
                                <p className="text-xs text-slate-500">
                                  ≈ {formatMoney(finalChoice.price, finalChoice.currency)} {localCurrency}
                                </p>
                              )
                            } else if (!showUSD && typeof recurringMonthlyUSD === 'number') {
                              return (
                                <p className="text-xs text-slate-500">
                                  Approx. {formatMoney(recurringMonthlyUSD, 'USD')} in USD
                                </p>
                              )
                            }
                            return null
                          })()}
                          <p className="text-xs text-slate-500">from {finalChoice.provider}</p>
                        </div>

                        {/* Right: Currency Toggle */}
                        <div className="flex flex-col items-end">
                          {acidTestResults && acidTestHasUSDData ? (
                            <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1 shadow-sm">
                              <button
                                type="button"
                                onClick={() => setAcidTestDisplayCurrency("local")}
                                className={`px-3 py-2 text-sm font-semibold rounded-md transition-all ${
                                  acidTestDisplayCurrency === "local"
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Local ({acidTestResults.summary.currency})
                              </button>
                              <button
                                type="button"
                                onClick={() => setAcidTestDisplayCurrency("usd")}
                                className={`px-3 py-2 text-sm font-semibold rounded-md transition-all ${
                                  acidTestDisplayCurrency === "usd"
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                USD
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">
                              Currency: {finalChoice.currency}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>


                    {isCategorizingCosts ? (
                      <div className="bg-white border border-slate-200 shadow-sm p-8">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <LoadingSpinner />
                            <div className="text-lg font-semibold text-slate-700">Categorizing costs...</div>
                          </div>
                          <p className="text-sm text-slate-500 max-w-md">
                            Analyzing cost structure from the selected provider to prepare your profitability assessment.
                          </p>
                        </div>
                      </div>
                    ) : (
                      !acidTestCostData && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm p-6">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 border border-amber-200 flex items-center justify-center">
                              <XCircle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <h5 className="text-lg font-semibold text-amber-800 mb-2">Cost Data Unavailable</h5>
                              <p className="text-sm text-amber-700 mb-3">
                                Unable to load the cost breakdown for this provider. This may be due to missing data or a temporary connectivity issue.
                              </p>
                              <p className="text-xs text-amber-600">
                                Try adjusting the project parameters above or refresh the page to retry.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {acidTestCostData && (
                      <div className="space-y-6">
                        {isComputingAcidTest ? (
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 shadow-sm p-10">
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <LoadingSpinner />
                                <div className="text-xl font-bold text-purple-700">Computing Acid Test...</div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm text-purple-600 max-w-lg">
                                  Running comprehensive profitability analysis including revenue projections, cost breakdowns, and margin calculations.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-purple-500">
                                  <Target className="h-4 w-4" />
                                  <span>This may take a few moments...</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : acidTestResults ? (
                          (() => {
                            const { summary, breakdown, billRateComposition, conversionError } = acidTestResults
                            const profitClass = summary.profitLocal >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                            const profitTextClass = summary.profitLocal >= 0 ? 'text-green-700' : 'text-red-700'
                            const statusBadgeClass = summary.meetsPositive && summary.meetsMinimum
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : summary.meetsPositive
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-red-100 text-red-800 border-red-200'
                            const statusLabel = summary.meetsPositive
                              ? (summary.meetsMinimum
                                  ? 'Pass - Profit clears the USD 1,000 minimum'
                                  : 'Warning - Profit below the USD 1,000 minimum')
                              : 'Fail - Project is not profitable'

                            const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                            let usedLocalFallback = false

                            const formatAmount = (localValue: number, usdValue?: number) => {
                              if (showUSD) {
                                if (typeof usdValue === 'number') {
                                  return formatMoney(usdValue, 'USD')
                                }
                                usedLocalFallback = true
                              }
                              return formatMoney(localValue, summary.currency)
                            }

                            const renderApproxLine = (localValue: number, usdValue?: number) => {
                              if (showUSD) {
                                if (typeof usdValue === 'number') {
                                  return (
                                    <p className="text-xs text-slate-500">
                                      ≈ {formatMoney(localValue, summary.currency)} {summary.currency}
                                    </p>
                                  )
                                }
                                return null
                              }

                              if (summary.currency !== 'USD' && typeof usdValue === 'number') {
                                return (
                                  <p className="text-xs text-slate-500">
                                    Approx. {formatMoney(usdValue, 'USD')} in USD
                                  </p>
                                )
                              }
                              return null
                            }

                            const renderDifferenceValue = (localValue: number, usdValue?: number) => {
                              const isPositive = localValue >= 0
                              const absLocal = Math.abs(localValue)
                              const absUsd = typeof usdValue === 'number' ? Math.abs(usdValue) : undefined
                              return (
                                <>
                                  {isPositive ? '+' : '-'}
                                  {formatAmount(absLocal, absUsd)}
                                </>
                              )
                            }

                            return (
                              <div className="space-y-6">
                                {showUSD && usedLocalFallback && (
                                  <p className="text-xs text-amber-600 text-center">
                                    Some USD conversions are unavailable; showing local currency where needed.
                                  </p>
                                )}
                                {/* <div className="grid gap-4 lg:grid-cols-3">
                                  <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-2 text-slate-700">
                                      <TrendingUp className="h-5 w-5 text-blue-600" />
                                      <h4 className="font-semibold">Total Project Revenue</h4>
                                    </div>
                                    <div className="text-3xl font-semibold text-blue-600">
                                      {formatAmount(summary.revenueTotal, summary.revenueUSD)}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      {formatAmount(summary.billRateMonthly, billRateComposition.actualBillRateUSD)} × {summary.durationMonths} months
                                    </p>
                                    {renderApproxLine(summary.revenueTotal, summary.revenueUSD)}
                                  </div>

                                  <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-2 text-slate-700">
                                      <BarChart3 className="h-5 w-5 text-rose-600" />
                                      <h4 className="font-semibold">Total Project Cost</h4>
                                    </div>
                                    <div className="text-3xl font-semibold text-rose-600">
                                      {formatAmount(summary.totalCost, summary.totalCostUSD)}
                                    </div>
                                    <p className="text-sm text-slate-500">Includes all costs across the full assignment.</p>
                                    <ul className="space-y-1 text-sm text-slate-600">
                                      <li>Salary: {formatAmount(breakdown.salaryTotal, breakdown.salaryTotalUSD)}</li>
                                      <li>Statutory: {formatAmount(breakdown.statutoryTotal, breakdown.statutoryTotalUSD)}</li>
                                      <li>Allowances & benefits: {formatAmount(breakdown.allowancesTotal, breakdown.allowancesTotalUSD)}</li>
                                      <li>Termination provision: {formatAmount(breakdown.terminationTotal, breakdown.terminationTotalUSD)}</li>
                                      <li>One-time costs: {formatAmount(breakdown.oneTimeTotal, breakdown.oneTimeTotalUSD)}</li>
                                      <li className="font-semibold">Recurring monthly cost: {formatAmount(breakdown.recurringMonthly, breakdown.recurringMonthlyUSD)}</li>
                                      <li className="font-semibold">Recurring project total: {formatAmount(breakdown.recurringTotal, breakdown.recurringTotalUSD)}</li>
                                    </ul>
                                  </div>

                                  <div className={`flex h-full flex-col items-center gap-4 rounded-xl border-2 p-6 text-center shadow-sm ${profitClass}`}>
                                    <Target className={`h-6 w-6 ${profitTextClass}`} />
                                    <div>
                                      <h3 className="text-xl font-semibold text-slate-900">Acid Test Result</h3>
                                      <div className={`text-4xl font-semibold ${profitTextClass}`}>
                                        {formatAmount(summary.profitLocal, summary.profitUSD)}
                                      </div>
                                      {renderApproxLine(summary.profitLocal, summary.profitUSD)}
                                    </div>
                                    <div className="space-y-1 text-sm text-slate-600">
                                      <div>Margin per month: {formatAmount(summary.marginMonthly, summary.marginMonthlyUSD)}</div>
                                      <div>Total margin (after one-time costs): {formatAmount(summary.marginTotal, summary.marginTotalUSD)}</div>
                                    </div>
                                    <Badge className={`${statusBadgeClass} mt-1`}>{statusLabel}</Badge>
                                    {!summary.meetsMinimum && summary.minimumShortfallUSD !== undefined && (
                                      <p className="text-xs text-slate-600">
                                        Needs {formatMoney(summary.minimumShortfallUSD, 'USD')} more profit to reach the USD {acidTestResults.thresholds.minimumUSD.toLocaleString()} minimum.
                                      </p>
                                    )}
                                    {conversionError && (
                                      <p className="text-xs text-red-600">{conversionError}</p>
                                    )}
                                  </div>
                                </div> */}

                                {/* Simplified Acid Test Summary */}
                                {/* <div className="bg-white border border-slate-200 shadow-lg p-8 mb-6">
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-3 mb-6">
                                      <div className="p-3 bg-purple-100 rounded-lg">
                                        <Zap className="h-8 w-8 text-purple-600" />
                                      </div>
                                      <h3 className="text-2xl font-bold text-slate-800">Acid Test Result</h3>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-5 mb-6">
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Assignment Duration</p>
                                        <p className="text-xl font-bold text-slate-800">{summary.durationMonths} months</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Monthly Bill Rate</p>
                                        <p className="text-xl font-bold text-blue-600">
                                          {(() => {
                                            const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                                            const monthlyUSD = billRateComposition.actualBillRateUSD
                                            if (showUSD && typeof monthlyUSD === 'number') {
                                              return formatMoney(monthlyUSD, 'USD')
                                            }
                                            return formatMoney(summary.billRateMonthly, summary.currency)
                                          })()}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                                        <p className="text-xl font-bold text-green-600">
                                          {(() => {
                                            const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                                            if (showUSD && typeof summary.revenueUSD === 'number') {
                                              return formatMoney(summary.revenueUSD, 'USD')
                                            }
                                            return formatMoney(summary.revenueTotal, summary.currency)
                                          })()}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Total Costs</p>
                                        <p className="text-xl font-bold text-red-600">
                                          {(() => {
                                            const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                                            if (showUSD && typeof summary.totalCostUSD === 'number') {
                                              return formatMoney(summary.totalCostUSD, 'USD')
                                            }
                                            return formatMoney(summary.totalCost, summary.currency)
                                          })()}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Profit</p>
                                        <p className={`text-xl font-bold ${summary.profitLocal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                          {(() => {
                                            const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                                            if (showUSD && typeof summary.profitUSD === 'number') {
                                              return formatMoney(summary.profitUSD, 'USD')
                                            }
                                            return formatMoney(summary.profitLocal, summary.currency)
                                          })()}
                                        </p>
                                      </div>
                                    </div>

                                    <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-lg border-2 ${
                                      summary.meetsPositive && summary.meetsMinimum
                                        ? 'bg-green-50 border-green-200'
                                        : summary.meetsPositive
                                          ? 'bg-amber-50 border-amber-200'
                                          : 'bg-red-50 border-red-200'
                                    }`}>
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                                        summary.meetsPositive && summary.meetsMinimum
                                          ? 'bg-green-600'
                                          : summary.meetsPositive
                                            ? 'bg-amber-600'
                                            : 'bg-red-600'
                                      }`}>
                                        {summary.meetsPositive && summary.meetsMinimum ? '✓' : summary.meetsPositive ? '!' : '✗'}
                                      </div>
                                      <div className="text-left">
                                        <p className={`font-bold text-lg ${
                                          summary.meetsPositive && summary.meetsMinimum
                                            ? 'text-green-800'
                                            : summary.meetsPositive
                                              ? 'text-amber-800'
                                              : 'text-red-800'
                                        }`}>
                                          {summary.meetsPositive && summary.meetsMinimum
                                            ? 'PASS'
                                            : summary.meetsPositive
                                              ? 'WARNING'
                                              : 'FAIL'
                                          }
                                        </p>
                                        <p className="text-sm text-slate-600">
                                          {summary.meetsPositive && summary.meetsMinimum
                                            ? 'Assignment meets profitability requirements'
                                            : summary.meetsPositive
                                              ? `Profitable but below USD ${acidTestResults.thresholds.minimumUSD.toLocaleString()} minimum`
                                              : 'Assignment is not profitable'
                                          }
                                        </p>
                                      </div>
                                    </div>

                                    {conversionError && (
                                      <p className="text-xs text-red-600 mt-4">{conversionError}</p>
                                    )}
                                  </div>
                                </div> */}

                                {/* Bill Rate Composition Breakdown */}
                                <div className="bg-white border border-slate-200 shadow-lg p-8">
                                  <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="p-2 bg-purple-100">
                                        <Calculator className="h-6 w-6 text-purple-600" />
                                      </div>
                                      <h4 className="text-2xl font-bold text-slate-800">Bill Rate Composition Analysis</h4>
                                    </div>
                                    <p className="text-slate-600">Detailed breakdown of expected costs vs. your actual billing rate</p>
                                  </div>

                                  {/* Main Comparison Table */}
                                  <div className="bg-slate-50 border border-slate-200 shadow-sm overflow-hidden mb-6">
                                    <div className="bg-slate-800 text-white p-4">
                                      <h5 className="text-lg font-bold">Cost Structure Breakdown</h5>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full">
                                        <thead className="bg-slate-100 border-b border-slate-200">
                                          <tr>
                                            <th className="text-left py-4 px-6 font-semibold text-slate-800">Cost Component</th>
                                            <th className="text-right py-4 px-6 font-semibold text-slate-800">Monthly Amount</th>
                                            <th className="text-center py-4 px-6 font-semibold text-slate-800">Category</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                          <tr
                                            className="group hover:bg-blue-50 hover:border-l-4 hover:border-l-blue-500 transition-all duration-200 cursor-pointer"
                                            onClick={() => toggleCategoryExpansion('baseSalary')}
                                          >
                                            <td className="py-4 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 bg-blue-500"></div>
                                                <span className="font-medium text-slate-800">Base Salary</span>
                                                {expandedCategories.has('baseSalary') ? (
                                                  <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                ) : (
                                                  <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                              {formatAmount(billRateComposition.salaryMonthly, billRateComposition.salaryMonthlyUSD)}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">Core</Badge>
                                            </td>
                                          </tr>
                                          {/* Base Salary Detail Rows */}
                                          {expandedCategories.has('baseSalary') && acidTestCostData && Object.entries(acidTestCostData.categories.baseSalary).map(([itemKey, amount]) => (
                                            <tr key={`baseSalary-${itemKey}`} className="bg-slate-25 border-l-4 border-l-blue-500 hover:bg-blue-25 transition-colors">
                                              <td className="py-3 px-6 pl-12">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                                                  <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                </div>
                                              </td>
                                              <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                {(() => {
                                                  const showUSD = acidTestDisplayCurrency === 'usd' && acidTestHasUSDData
                                                  // For detail items, we don't have individual USD conversions, so show local currency
                                                  return formatMoney(amount, acidTestCostData.currency)
                                                })()}
                                              </td>
                                              <td className="py-3 px-6 text-center">
                                                <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-xs">Detail</Badge>
                                              </td>
                                            </tr>
                                          ))}
                                          <tr
                                            className="group hover:bg-orange-50 hover:border-l-4 hover:border-l-orange-500 transition-all duration-200 cursor-pointer"
                                            onClick={() => toggleCategoryExpansion('statutoryMandatory')}
                                          >
                                            <td className="py-4 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 bg-orange-500"></div>
                                                <span className="font-medium text-slate-800">Statutory Costs</span>
                                                {expandedCategories.has('statutoryMandatory') ? (
                                                  <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-orange-600 transition-colors" />
                                                ) : (
                                                  <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-orange-600 transition-colors" />
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                              {formatAmount(billRateComposition.statutoryMonthly, billRateComposition.statutoryMonthlyUSD)}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-orange-100 text-orange-800 border-orange-200">Legal</Badge>
                                            </td>
                                          </tr>
                                          {/* Statutory Costs Detail Rows */}
                                          {expandedCategories.has('statutoryMandatory') && acidTestCostData && Object.entries(acidTestCostData.categories.statutoryMandatory).map(([itemKey, amount]) => (
                                            <tr key={`statutoryMandatory-${itemKey}`} className="bg-slate-25 border-l-4 border-l-orange-500 hover:bg-orange-25 transition-colors">
                                              <td className="py-3 px-6 pl-12">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-2 h-2 bg-orange-300 rounded-full"></div>
                                                  <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                </div>
                                              </td>
                                              <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                {formatMoney(amount, acidTestCostData.currency)}
                                              </td>
                                              <td className="py-3 px-6 text-center">
                                                <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-xs">Detail</Badge>
                                              </td>
                                            </tr>
                                          ))}
                                          {billRateComposition.allowancesMonthly > 0 && (
                                            <>
                                              <tr
                                                className="group hover:bg-green-50 hover:border-l-4 hover:border-l-green-500 transition-all duration-200 cursor-pointer"
                                                onClick={() => toggleCategoryExpansion('allowancesBenefits')}
                                              >
                                                <td className="py-4 px-6">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-green-500"></div>
                                                    <span className="font-medium text-slate-800">Allowances & Benefits</span>
                                                    {expandedCategories.has('allowancesBenefits') ? (
                                                      <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-green-600 transition-colors" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-green-600 transition-colors" />
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                                  {formatAmount(billRateComposition.allowancesMonthly, billRateComposition.allowancesMonthlyUSD)}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                  <Badge className="bg-green-100 text-green-800 border-green-200">Benefits</Badge>
                                                </td>
                                              </tr>
                                              {/* Allowances & Benefits Detail Rows */}
                                              {expandedCategories.has('allowancesBenefits') && acidTestCostData && Object.entries(acidTestCostData.categories.allowancesBenefits).map(([itemKey, amount]) => (
                                                <tr key={`allowancesBenefits-${itemKey}`} className="bg-slate-25 border-l-4 border-l-green-500 hover:bg-green-25 transition-colors">
                                                  <td className="py-3 px-6 pl-12">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 bg-green-300 rounded-full"></div>
                                                      <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                    {formatMoney(amount, acidTestCostData.currency)}
                                                  </td>
                                                  <td className="py-3 px-6 text-center">
                                                    <Badge className="bg-green-50 text-green-600 border-green-100 text-xs">Detail</Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </>
                                          )}
                                          {billRateComposition.terminationMonthly > 0 && (
                                            <>
                                              <tr
                                                className="group hover:bg-yellow-50 hover:border-l-4 hover:border-l-yellow-500 transition-all duration-200 cursor-pointer"
                                                onClick={() => toggleCategoryExpansion('terminationCosts')}
                                              >
                                                <td className="py-4 px-6">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-yellow-500"></div>
                                                    <span className="font-medium text-slate-800">Termination Provision</span>
                                                    {expandedCategories.has('terminationCosts') ? (
                                                      <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-yellow-600 transition-colors" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-yellow-600 transition-colors" />
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                                  {formatAmount(billRateComposition.terminationMonthly, billRateComposition.terminationMonthlyUSD)}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Risk</Badge>
                                                </td>
                                              </tr>
                                              {/* Termination Provision Detail Rows */}
                                              {expandedCategories.has('terminationCosts') && acidTestCostData && Object.entries(acidTestCostData.categories.terminationCosts).map(([itemKey, amount]) => (
                                                <tr key={`terminationCosts-${itemKey}`} className="bg-slate-25 border-l-4 border-l-yellow-500 hover:bg-yellow-25 transition-colors">
                                                  <td className="py-3 px-6 pl-12">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                                                      <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                    {formatMoney(amount, acidTestCostData.currency)}
                                                  </td>
                                                  <td className="py-3 px-6 text-center">
                                                    <Badge className="bg-yellow-50 text-yellow-600 border-yellow-100 text-xs">Detail</Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </>
                                          )}
                                          <tr className="hover:bg-slate-50 transition-colors bg-purple-50">
                                            <td className="py-4 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 bg-purple-600"></div>
                                                <span className="font-bold text-purple-800">
                                                  Gracemark Fee ({Math.round(billRateComposition.gracemarkFeePercentage * 100)}%)
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-purple-900">
                                              {formatAmount(billRateComposition.gracemarkFeeMonthly, billRateComposition.gracemarkFeeMonthlyUSD)}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-purple-100 text-purple-800 border-purple-200">Service</Badge>
                                            </td>
                                          </tr>
                                          <tr className="hover:bg-slate-50 transition-colors text-xs text-slate-500">
                                            <td className="py-3 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-slate-400"></div>
                                                <span className="italic">Provider fee (included in above)</span>
                                              </div>
                                            </td>
                                            <td className="py-3 px-6 text-right font-medium">
                                              {formatAmount(billRateComposition.providerFeeMonthly, billRateComposition.providerFeeMonthlyUSD)}
                                            </td>
                                            <td className="py-3 px-6 text-center">
                                              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Included</Badge>
                                            </td>
                                          </tr>
                                        </tbody>
                                        <tfoot className="bg-slate-800 text-white">
                                          <tr>
                                            <td className="py-4 px-6 font-bold text-lg">Expected Bill Rate</td>
                                            <td className="py-4 px-6 text-right font-bold text-xl">
                                              {formatAmount(billRateComposition.expectedBillRate, billRateComposition.expectedBillRateUSD)}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-white text-slate-800 border-slate-200">Total</Badge>
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Rate Comparison Section */}
                                  {/* <div className="grid gap-6 lg:grid-cols-2">
                                    {/* Your Rate vs Expected */}
                                    {/* <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-6 shadow-sm">
                                      <h5 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-slate-600" />
                                        Rate Comparison
                                      </h5>

                                      <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-white border border-slate-200 shadow-sm">
                                          <span className="font-medium text-slate-700">Your Bill Rate</span>
                                          <span className="text-lg font-bold text-slate-900">
                                            {formatAmount(billRateComposition.actualBillRate, billRateComposition.actualBillRateUSD)}
                                          </span>
                                        </div>

                                        <div className="flex justify-between items-center p-3 bg-white border border-slate-200 shadow-sm">
                                          <span className="font-medium text-slate-700">Expected Rate</span>
                                          <span className="text-lg font-bold text-slate-900">
                                            {formatAmount(billRateComposition.expectedBillRate, billRateComposition.expectedBillRateUSD)}
                                          </span>
                                        </div>

                                        <div className={`flex justify-between items-center p-4 border-2 shadow-md ${
                                          billRateComposition.rateDiscrepancy >= 0
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                        }`}>
                                          <span className="font-bold text-slate-800">Net Difference</span>
                                          <span className={`text-xl font-bold ${
                                            billRateComposition.rateDiscrepancy >= 0 ? 'text-green-700' : 'text-red-700'
                                          }`}>
                                            {renderDifferenceValue(billRateComposition.rateDiscrepancy, billRateComposition.rateDiscrepancyUSD)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Analysis & Recommendations */}
                                    {/* <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 p-6 shadow-sm">
                                      <h5 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Target className="h-5 w-5 text-blue-600" />
                                        Analysis & Insights
                                      </h5>

                                      {billRateComposition.rateDiscrepancy !== 0 && (
                                        <div className="space-y-4">
                                          <div className={`p-4 border-l-4 ${
                                            billRateComposition.rateDiscrepancy >= 0
                                              ? 'bg-green-50 border-green-400'
                                              : 'bg-red-50 border-red-400'
                                          }`}>
                                            <div className={`font-semibold mb-2 ${
                                              billRateComposition.rateDiscrepancy >= 0 ? 'text-green-800' : 'text-red-800'
                                            }`}>
                                              {billRateComposition.rateDiscrepancy >= 0 ? '✅ Above Expected Rate' : '⚠️ Below Expected Rate'}
                                            </div>
                                            <p className={`text-sm ${
                                              billRateComposition.rateDiscrepancy >= 0 ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                              {billRateComposition.rateDiscrepancy >= 0 ? (
                                                <>
                                                  Your rate is {formatAmount(
                                                    Math.abs(billRateComposition.rateDiscrepancy),
                                                    typeof billRateComposition.rateDiscrepancyUSD === 'number'
                                                      ? Math.abs(billRateComposition.rateDiscrepancyUSD)
                                                      : undefined
                                                  )} above the expected rate. This provides additional margin for unexpected costs or higher profitability.
                                                </>
                                              ) : (
                                                <>
                                                  Your rate is {formatAmount(
                                                    Math.abs(billRateComposition.rateDiscrepancy),
                                                    typeof billRateComposition.rateDiscrepancyUSD === 'number'
                                                      ? Math.abs(billRateComposition.rateDiscrepancyUSD)
                                                      : undefined
                                                  )} below the expected rate. Consider increasing to ensure proper {Math.round(billRateComposition.gracemarkFeePercentage * 100)}% Gracemark fee coverage.
                                                </>
                                              )}
                                            </p>
                                          </div>

                                          <div className="bg-blue-100 border border-blue-200 p-3">
                                            <div className="font-medium text-blue-900 mb-1">Recommended Action</div>
                                            <p className="text-sm text-blue-800">
                                              {billRateComposition.rateDiscrepancy >= 0
                                                ? 'Your current rate structure provides healthy margins. Monitor for any significant cost changes in future periods.'
                                                : 'Review your pricing strategy. Consider client negotiation or cost optimization to improve margins.'
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div> */}
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          <p className="text-sm text-slate-600">
                            Enter a monthly bill rate and project duration to see the acid test results.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Button variant="outline" onClick={handleCloseAcidTest} className="px-6">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Recommendation
                      </Button>
                      {acidTestResults && (
                        <Button
                          onClick={() => {
                            console.log('Acid test results:', acidTestResults)
                          }}
                          className="bg-purple-600 px-6 text-white hover:bg-purple-700"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Save Results
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Extract selected quote data after reconciliation
  const extractSelectedQuoteData = async (finalChoice: {
    provider: string
    price: number
    currency: string
    enhancedQuote?: EnhancedQuote
  }) => {
    if (!finalChoice?.enhancedQuote) {
      return null
    }

    const { enhancedQuote } = finalChoice

    const resolveMonthlyAmount = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const sanitized = value
          .trim()
          .replace(/[\s\u00A0]/g, '')
          .replace(/[^0-9,.-]/g, '')

        if (!sanitized) return 0

        const lastComma = sanitized.lastIndexOf(',')
        const lastDot = sanitized.lastIndexOf('.')

        let normalised = sanitized
        if (lastComma > -1 && lastDot > -1) {
          if (lastComma > lastDot) {
            normalised = sanitized.replace(/\./g, '').replace(',', '.')
          } else {
            normalised = sanitized.replace(/,/g, '')
          }
        } else if (lastComma > -1) {
          if (sanitized.indexOf(',') === lastComma && sanitized.length - lastComma <= 3) {
            normalised = sanitized.replace(',', '.')
          } else {
            normalised = sanitized.replace(/,/g, '')
          }
        } else if (lastDot > -1) {
          if (sanitized.indexOf('.') === lastDot && sanitized.length - lastDot <= 3) {
            normalised = sanitized
          } else {
            normalised = sanitized.replace(/\./g, '')
          }
        }

        const parsed = Number(normalised)
        return Number.isFinite(parsed) ? parsed : 0
      }
      if (typeof value === 'bigint') {
        const asNumber = Number(value)
        return Number.isFinite(asNumber) ? asNumber : 0
      }
      return 0
    }

    const normaliseItems = (source: any[]): Array<{ key: string; name: string; monthly_amount: number }> => {
      if (!Array.isArray(source)) return []
      return source
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null

          const rawKey = typeof (item as any).key === 'string' ? (item as any).key.trim() : ''
          const keyBase = rawKey.length
            ? rawKey
            : (typeof (item as any).name === 'string' && (item as any).name.trim().length
              ? (item as any).name.trim().toLowerCase().replace(/\s+/g, '_')
              : `item_${index}`)

          const friendlyName = typeof (item as any).name === 'string' && (item as any).name.trim().length
            ? (item as any).name.trim()
            : keyBase.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

          const amountCandidates = [
            (item as any).monthly_amount,
            (item as any).monthly_amount_local,
            (item as any).amount,
            (item as any).monthlyAmount,
            (item as any).value
          ]

          let resolvedAmount: number | null = null
          for (const candidate of amountCandidates) {
            const num = resolveMonthlyAmount(candidate)
            const candidateStr = String(candidate ?? '').trim()
            if (num !== 0 || candidateStr === '0') {
              resolvedAmount = num
              break
            }
          }

          const monthlyAmount = resolvedAmount ?? 0

          return {
            ...(item as Record<string, unknown>),
            key: keyBase,
            name: friendlyName,
            monthly_amount: monthlyAmount
          } as { key: string; name: string; monthly_amount: number }
        })
        .filter(Boolean) as Array<{ key: string; name: string; monthly_amount: number }>
    }

    let items: any[] = Array.isArray(enhancedQuote.fullQuote?.items)
      ? [...(enhancedQuote.fullQuote?.items as any[])]
      : []

    const convertFrequencyToMonthly = (amount: number, frequency?: string) => {
      if (!frequency || !Number.isFinite(amount)) return amount
      const freq = frequency.toLowerCase()
      if (freq.includes('one_time') || freq.includes('one-time')) return amount
      if (freq.includes('year')) return amount / 12
      if (freq.includes('annual')) return amount / 12
      if (freq.includes('quarter')) return amount / 3
      if (freq.includes('semiannual') || freq.includes('semi-annual') || freq.includes('biannual')) return amount / 6
      if (freq.includes('biweek')) return amount * (26 / 12)
      if (freq.includes('week')) return amount * (52 / 12)
      if (freq.includes('day')) return amount * 21.75
      return amount
    }

    const formatKeyName = (raw: string) => raw
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, letter => letter.toUpperCase())

    const addCostEntry = (keyCandidate: string | undefined, nameCandidate: string | undefined, amountInput: unknown, frequency?: string) => {
      const amount = resolveMonthlyAmount(amountInput)
      const monthly = convertFrequencyToMonthly(amount, frequency)
      if (!Number.isFinite(monthly) || monthly === 0) return
      const safeNameBase = nameCandidate && nameCandidate.trim().length > 0 ? nameCandidate.trim() : (keyCandidate && keyCandidate.trim().length > 0 ? keyCandidate.trim() : `Item ${items.length + 1}`)
      const safeName = formatKeyName(safeNameBase)
      const normalizedKeyBase = keyCandidate && keyCandidate.trim().length > 0 ? keyCandidate.trim() : safeName
      const normalizedKey = normalizedKeyBase.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `item_${items.length + 1}`
      items.push({
        key: normalizedKey,
        name: safeName,
        monthly_amount: Number(monthly.toFixed(2))
      })
    }

    const pushCostArray = (costs: any[], contextLabel: string) => {
      costs.forEach((entry, idx) => {
        if (!entry) return
        const entryName = typeof entry?.name === 'string' && entry.name.trim().length > 0
          ? entry.name.trim()
          : `${contextLabel} ${idx + 1}`
        const entryKey = typeof entry?.key === 'string' && entry.key.trim().length > 0 ? entry.key.trim() : entryName
        const frequency = typeof entry?.frequency === 'string' ? entry.frequency : undefined
        const amountCandidate = entry?.monthly_amount ?? entry?.monthlyAmount ?? entry?.monthly_amount_local ?? entry?.amount ?? entry?.value ?? entry?.usd_amount ?? entry?.local_amount
        addCostEntry(entryKey, entryName, amountCandidate, frequency)
      })
    }

    const visitedRaw = new WeakSet<object>()

    function scanRawValue(value: unknown, contextLabel: string): void {
      if (!value) return
      if (Array.isArray(value)) {
        pushCostArray(value, contextLabel)
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') scanRawValue(entry, contextLabel)
        })
        return
      }
      if (typeof value !== 'object') return
      const obj = value as Record<string, unknown>
      if (visitedRaw.has(obj)) return
      visitedRaw.add(obj as object)

      if (Array.isArray(obj.costs)) pushCostArray(obj.costs as any[], `${contextLabel} Costs`)
      if (Array.isArray((obj as any).items)) pushCostArray((obj as any).items as any[], `${contextLabel} Items`)
      if (Array.isArray((obj as any).line_items)) pushCostArray((obj as any).line_items as any[], `${contextLabel} Line`)
      if (Array.isArray((obj as any).components)) pushCostArray((obj as any).components as any[], `${contextLabel} Component`)
      if (Array.isArray((obj as any).monthly_contributions_breakdown)) pushCostArray((obj as any).monthly_contributions_breakdown as any[], `${contextLabel} Contribution`)
      if (Array.isArray((obj as any).monthly_benefits_breakdown)) pushCostArray((obj as any).monthly_benefits_breakdown as any[], `${contextLabel} Benefit`)
      if (Array.isArray((obj as any).allowances)) pushCostArray((obj as any).allowances as any[], `${contextLabel} Allowance`)
      if (Array.isArray((obj as any).fees)) pushCostArray((obj as any).fees as any[], `${contextLabel} Fee`)

      const breakdownKeys = [
        'breakdown',
        'monthly_costs_breakdown',
        'monthlyBreakdown',
        'employer_contributions_breakdown',
        'statutoryContributions',
        'statutory_contributions',
        'additionalFees',
        'additional_fees',
        'totals'
      ]
      breakdownKeys.forEach(key => {
        const entry = obj[key]
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          pushBreakdownObject(entry as Record<string, unknown>, formatKeyName(key))
        }
      })

      Object.entries(obj).forEach(([key, child]) => {
        if (!child) return
        if (Array.isArray(child) || typeof child === 'object') {
          scanRawValue(child, formatKeyName(key))
        }
      })
    }

    function pushBreakdownObject(record: Record<string, unknown>, contextLabel: string): void {
      Object.entries(record).forEach(([key, value]) => {
        if (key === 'baseCost') return
        if (value == null) return
        const combinedLabel = formatKeyName(`${contextLabel} ${key}`)
        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') {
          addCostEntry(key, combinedLabel, value)
          return
        }
        if (typeof value === 'object') {
          const frequency = typeof (value as any)?.frequency === 'string' ? (value as any).frequency : undefined
          const amountCandidate = (value as any)?.monthly_amount ?? (value as any)?.monthlyAmount ?? (value as any)?.amount ?? (value as any)?.value
          if (amountCandidate !== undefined) {
            addCostEntry(key, combinedLabel, amountCandidate, frequency)
          } else {
            scanRawValue(value, combinedLabel)
          }
        }
      })
    }

    const providerKey = finalChoice.provider as ProviderType

    const resolveDisplayQuote = (): Quote | undefined => {
      if (!quoteData?.quotes) return undefined
      const raw = (quoteData.quotes as Record<string, unknown>)[providerKey]
      if (!raw) return undefined

      const isDisplayQuote = (value: unknown): value is Quote => {
        return !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).costs)
      }

      if (providerKey === 'remote') {
        if (isDisplayQuote(raw)) return raw
        if (typeof raw === 'object' && raw !== null && 'employment' in raw) {
          return transformRemoteResponseToQuote(raw as RemoteAPIResponse)
        }
        return undefined
      }

      if (providerKey === 'rivermate') {
        if (isDisplayQuote(raw)) return raw
        if (typeof raw === 'object' && raw !== null && 'taxItems' in (raw as Record<string, unknown>)) {
          return transformRivermateQuoteToDisplayQuote(raw as RivermateQuote)
        }
        return undefined
      }

      if (providerKey === 'oyster') {
        if (isDisplayQuote(raw)) return raw
        if (typeof raw === 'object' && raw !== null && 'contributions' in (raw as Record<string, unknown>)) {
          return transformOysterQuoteToDisplayQuote(raw as OysterQuote)
        }
        return undefined
      }

      return isDisplayQuote(raw) ? raw : undefined
    }

    const displayQuote = resolveDisplayQuote()
    if (displayQuote) {
      if (Array.isArray(displayQuote.costs)) {
        pushCostArray(displayQuote.costs, `${finalChoice.provider} Cost`)
      }
      if (displayQuote && typeof (displayQuote as any).breakdown === 'object') {
        pushBreakdownObject((displayQuote as any).breakdown, `${finalChoice.provider} Breakdown`)
      }
    }

    const rawEntry = getRawQuote(providerKey)
    if (rawEntry?.primary) {
      scanRawValue(rawEntry.primary, `${finalChoice.provider} Raw`)
    }

    const hasBaseSalaryFromItems = items.some(
      entry => typeof entry?.name === 'string' && entry.name.toLowerCase() === 'base salary'
    )

    if (!hasBaseSalaryFromItems) {
      const baseSalaryCandidates = [
        enhancedQuote.fullQuote?.base_salary_monthly,
        enhancedQuote.baseQuote?.baseCost,
        enhancedQuote.monthlyCostBreakdown?.baseCost
      ]
      const baseSalary = baseSalaryCandidates
        .map(resolveMonthlyAmount)
        .find(amount => amount > 0) || 0

      if (baseSalary > 0) {
        addCostEntry('base_salary', 'Base Salary', baseSalary)
      }
    }

    if (enhancedQuote.enhancements) {
      const { severanceProvision, probationProvision } = enhancedQuote.enhancements

      const addTerminationComponentEntry = (
        key: string,
        label: string,
        component: TerminationComponentEnhancement | undefined
      ) => {
        if (!component) return
        if (component.isAlreadyIncluded) return
        const monthly = Number(component.monthlyAmount || 0)
        if (!Number.isFinite(monthly) || monthly <= 0) return
        addCostEntry(key, label, monthly)
      }

      // Termination notice removed - only severance and probation shown
      addTerminationComponentEntry('severance_provision', 'Severance Provision', severanceProvision)
      addTerminationComponentEntry('probation_provision', 'Probation Provision', probationProvision)

      if (enhancedQuote.enhancements.additionalContributions) {
        Object.entries(enhancedQuote.enhancements.additionalContributions).forEach(([key, value]) => {
          const sourceValue = (value && typeof value === 'object' && 'monthly_amount' in (value as Record<string, unknown>))
            ? (value as any).monthly_amount
            : value
          addCostEntry(key, key.replace(/_/g, ' '), sourceValue)
        })
      }

      Object.entries(enhancedQuote.enhancements).forEach(([key, value]) => {
        if (
          key === 'terminationCosts' ||
          key === 'terminationNotice' ||
          key === 'severanceProvision' ||
          key === 'probationProvision' ||
          key === 'additionalContributions'
        ) return
        if (!value || typeof value !== 'object') return

        const monthlyValue = resolveMonthlyAmount(
          (value as any).monthly_amount ??
          (value as any).monthlyAmount ??
          (value as any).amount ??
          (value as any).monthly_amount_local ??
          0
        )

        if (monthlyValue > 0) {
          addCostEntry(key, key.replace(/_/g, ' '), monthlyValue)
        }
      })
    }

    if (enhancedQuote.baseQuote?.breakdown) {
      pushBreakdownObject(enhancedQuote.baseQuote.breakdown, 'Base Quote')
    }

    const normalisedItems = normaliseItems(items)

    const mergedItemsMap = new Map<string, { key: string; name: string; monthly_amount: number }>()
    normalisedItems.forEach(item => {
      const normalizedKey = item.key.toLowerCase()
      const normalizedName = item.name.toLowerCase()
      const isTerminationEntry = normalizedKey.includes('termination') || normalizedName.includes('termination')
      const isSeveranceEntry = normalizedKey.includes('severance') || normalizedName.includes('severance')
      const isProbationEntry = normalizedKey.includes('probation') || normalizedName.includes('probation')
      if (isTerminationEntry && !isSeveranceEntry && !isProbationEntry) {
        return
      }
      const amount = Number(resolveMonthlyAmount(item.monthly_amount))
      if (!Number.isFinite(amount) || amount === 0) return
      const rounded = Number(amount.toFixed(2))
      const existing = mergedItemsMap.get(normalizedKey)
      if (existing) {
        existing.monthly_amount = Math.max(existing.monthly_amount, rounded)
        const formattedName = formatKeyName(item.name)
        if (existing.name.length < formattedName.length) {
          existing.name = formattedName
        }
      } else {
        mergedItemsMap.set(normalizedKey, {
          key: normalizedKey,
          name: formatKeyName(item.name),
          monthly_amount: rounded
        })
      }
    })

    const mergedItems = Array.from(mergedItemsMap.values())

    if (mergedItems.length === 0) {
      return null
    }

    const buildAggregates = (categories: AcidTestCategoryBuckets) => {
      const sumBucket = (bucket: Record<string, number>) =>
        Object.values(bucket || {}).reduce((sum, value) => sum + resolveMonthlyAmount(value), 0)

      return {
        baseSalaryMonthly: sumBucket(categories.baseSalary),
        statutoryMonthly: sumBucket(categories.statutoryMandatory),
        allowancesMonthly: sumBucket(categories.allowancesBenefits),
        terminationMonthly: sumBucket(categories.terminationCosts),
        oneTimeTotal: sumBucket(categories.oneTimeFees),
      }
    }

    const requestPayload = {
      provider: finalChoice.provider,
      country: (quoteData?.formData as EORFormData)?.country || 'Unknown',
      currency: finalChoice.currency,
      costItems: mergedItems.map(item => ({
        key: item.key,
        name: item.name,
        monthly_amount: item.monthly_amount
      }))
    }

    try {
      console.log('[Cerebras] Request payload:', requestPayload)

      const response = await fetch('/api/categorize-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const categorizedData: AcidTestCategoryBuckets = await response.json()
      console.log('[Cerebras] Response payload:', categorizedData)
      const aggregates = buildAggregates(categorizedData)
      return { categories: categorizedData, aggregates }
    } catch (error) {
      console.error('LLM categorization failed, falling back to simple categorization:', error)

      const baseSalary: Record<string, number> = {}
      const statutoryMandatory: Record<string, number> = {}
      const allowancesBenefits: Record<string, number> = {}
      const terminationCosts: Record<string, number> = {}
      const oneTimeFees: Record<string, number> = {}

      mergedItems.forEach(item => {
        const key = item.key.toLowerCase()
        const name = item.name.toLowerCase()
        const amount = item.monthly_amount || 0

        if (key.includes('base_salary') || name.includes('base salary')) {
          baseSalary[item.key] = amount
        } else if (
          key.includes('severance') ||
          name.includes('severance') ||
          key.includes('probation') ||
          name.includes('probation')
        ) {
          terminationCosts[item.key] = amount
        } else if (key.includes('setup') || key.includes('onboarding') || name.includes('background check')) {
          oneTimeFees[item.key] = amount
        } else if (key.includes('allowance') || key.includes('meal') || key.includes('transport')) {
          allowancesBenefits[item.key] = amount
        } else {
          statutoryMandatory[item.key] = amount
        }
      })

      const fallbackCategories: AcidTestCategoryBuckets = {
        baseSalary,
        statutoryMandatory,
        allowancesBenefits,
        terminationCosts,
        oneTimeFees,
      }

      return {
        categories: fallbackCategories,
        aggregates: buildAggregates(fallbackCategories),
      }
    }
  }

  const startReconciliation = async () => {
    setIsReconModalOpen(true)

    // Check if reconciliation has been completed before
    const hasCompletedBefore = completedPhases.has('analyzing') || completedPhases.has('complete')

    // Only reset state if this is a fresh reconciliation (not reopening)
    if (!hasCompletedBefore) {
      setFinalChoice(null)
      setCompletedPhases(new Set())
      setActivePhase('gathering')
      setProgressPercent(0)
      setProviderData([])
    } else {
      // Reconciliation was completed before - just reopen modal with existing state
      return
    }

    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'

    try {
      // Phase 1: Gathering Data (0-25%)
      startPhase('gathering')
      await smoothProgressUpdate(5)

      const prices: { provider: string; price: number }[] = allProviders
        .map(p => ({ provider: p, price: enhancements[p]?.finalTotal || 0 }))
        .filter(p => p.price !== undefined && p.price !== null && p.price > 0);

      if (prices.length === 0) {
        return;
      }

      // Optimized staggered provider cards
      for (let i = 0; i < prices.length; i++) {
        setProviderData(prev => [...prev, prices[i]])
        const targetProgress = 5 + ((i + 1) / prices.length) * 20
        await smoothProgressUpdate(targetProgress)
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
        return;
      }

      await sleep(500) // Reduced from 800ms
      const lowerBound = deel.price * 0.96;
      const upperBound = deel.price * 1.04;
      await smoothProgressUpdate(45);

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

      if (candidates.length === 0) {
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
      await smoothProgressUpdate(90);
      completePhase('selecting')

      // Reduced delay before final phase
      await sleep(1500) // Reduced from 2500ms to 1500ms

      // Phase 4: Complete (90-100%)
      await smoothProgressUpdate(100)
      await sleep(200) // Reduced fade-in delay from 400ms to 200ms

      // Get the enhanced quote data for the selected provider
      const selectedEnhancement = enhancements[choice.provider as ProviderType]
      const finalChoiceData = {
        ...choice,
        currency,
        enhancedQuote: selectedEnhancement || undefined
      }
      setFinalChoice(finalChoiceData)

      completePhase('complete')

      // Start complete phase with auto-scroll
      startPhase('complete')

    } catch (error) {
      console.error("Reconciliation failed", error);
    }
  }

  const restartReconciliation = async () => {
    // Force reset all state for fresh reconciliation
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

      const prices = allProviders
        .map(provider => {
          const quote = (quoteData?.results as EORQuoteResults)?.[provider]
          if (!quote || typeof quote.total !== 'number') return null
          return { provider, price: quote.total }
        })
        .filter((item): item is { provider: string; price: number } => item !== null)

      if (prices.length === 0) {
        return;
      }

      for (let i = 0; i < prices.length; i++) {
        const targetProgress = 5 + (i + 1) * (20 / prices.length)
        await smoothProgressUpdate(targetProgress)
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
        return;
      }

      await sleep(500) // Reduced from 800ms
      const lowerBound = deel.price * 0.96;
      const upperBound = deel.price * 1.04;

      const analysis = prices.map(p => ({
        provider: p.provider,
        price: p.price,
        inRange: p.price >= lowerBound && p.price <= upperBound,
        isWinner: false
      }));

      for (let i = 0; i < analysis.length; i++) {
        const targetProgress = 30 + (i + 1) * (30 / analysis.length)
        await smoothProgressUpdate(targetProgress)
        await sleep(120) // Reduced from 200ms
      }

      setProviderData(analysis);
      completePhase('analyzing')
      await sleep(1200) // Reduced from 2000ms

      // Phase 3: Selecting Optimal (60-100%)
      startPhase('selecting')
      await smoothProgressUpdate(70)

      const inRangeProviders = analysis.filter(p => p.inRange);
      let winner;

      if (inRangeProviders.length > 0) {
        const cheapest = inRangeProviders.reduce((min, p) => p.price < min.price ? p : min);
        winner = cheapest;
      } else {
        const closest = analysis.reduce((closest, p) => {
          const currentDistance = Math.abs(p.price - deel.price);
          const closestDistance = Math.abs(closest.price - deel.price);
          return currentDistance < closestDistance ? p : closest;
        });
        winner = closest;
      }

      winner.isWinner = true;

      const updatedAnalysis = analysis.map(p =>
        p.provider === winner.provider ? { ...p, isWinner: true } : p
      );
      setProviderData(updatedAnalysis);

      await smoothProgressUpdate(85);
      await sleep(800); // Reduced from 1500ms

      await smoothProgressUpdate(100);
      await sleep(500); // Reduced from 1000ms

      // Find enhanced quote if available
      const selectedEnhancement = enhancements.find(
        e => e.provider === winner.provider && e.status === 'active'
      );

      const finalChoiceData = {
        ...winner,
        currency,
        enhancedQuote: selectedEnhancement || undefined
      }
      setFinalChoice(finalChoiceData)

      completePhase('complete')

      // Start complete phase with auto-scroll
      startPhase('complete')

    } catch (error) {
      console.error("Reconciliation failed", error);
    }
  }

  // Acid Test Handler
  const handleStartAcidTest = () => {
    // Pre-validation
    if (!finalChoice || !providerData.length) {
      setAcidTestError('Cannot start acid test: Missing provider data');
      return;
    }

    // Reset any previous state and show the form
    setAcidTestError(null);
    setAcidTestResults(null);
    setAcidTestCostData(null);
    setIsCategorizingCosts(true);
    setIsComputingAcidTest(false);
    setAcidTestValidation({});
    setShowAcidTestForm(true);

    void extractSelectedQuoteData(finalChoice)
      .then(result => {
        if (!result) {
          setAcidTestError('Unable to categorize cost items for the acid test.');
          setAcidTestCostData(null);
          return;
        }

        const { aggregates, categories } = result;
        setAcidTestCostData({
          provider: finalChoice.provider,
          currency: finalChoice.currency,
          categories,
          ...aggregates,
        });
      })
      .catch(err => {
        console.error('Failed to categorize cost items with Cerebras:', err);
        setAcidTestError('Unable to categorize cost items. Please try again later.');
        setAcidTestCostData(null);
      })
      .finally(() => {
        setIsCategorizingCosts(false);
      })
  };

  // Handle form input changes and update calculations
  const handleBillRateChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    setMonthlyBillRate(rate);

    // Validation
    const validation = { ...acidTestValidation };
    if (value === '' || rate <= 0) {
      validation.billRateError = 'Monthly bill rate must be greater than 0';
    } else if (rate > 1000000) {
      validation.billRateError = 'Monthly bill rate seems unusually high';
    } else {
      delete validation.billRateError;
    }
    setAcidTestValidation(validation);
    if (rate <= 0) {
      setAcidTestResults(null);
    }
  };

  const handleDurationChange = (value: string) => {
    const duration = parseInt(value) || 0;
    setProjectDuration(duration);

    // Validation
    const validation = { ...acidTestValidation };
    if (value === '' || duration <= 0) {
      validation.durationError = 'Project duration must be at least 1 month';
    } else if (duration > 120) {
      validation.durationError = 'Project duration seems unusually long (max 120 months)';
    } else {
      delete validation.durationError;
    }
    setAcidTestValidation(validation);
    if (duration <= 0) {
      setAcidTestResults(null);
    }
  };

  const handleCloseAcidTest = () => {
    setShowAcidTestForm(false);
    setAcidTestResults(null);
    setAcidTestCostData(null);
    setMonthlyBillRate(0);
    setProjectDuration(6);
    setAcidTestError(null);
    setAcidTestValidation({});
    setIsCategorizingCosts(false);
    setIsComputingAcidTest(false);
    setExpandedCategories(new Set());
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // --- RENDER LOGIC (UNCHANGED) ---
  const renderQuote = () => {
    if (providerLoading[currentProvider]) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
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
        const terminationComponentExtras: Array<{ label: string; amount: number; guards: string[] }> = []

        const pushTerminationComponent = (
          label: string,
          value: TerminationComponentEnhancement | undefined,
          guards: string[]
        ) => {
          if (!value || value.isAlreadyIncluded) return
          const monthly = Number(value.monthlyAmount || 0)
          if (!Number.isFinite(monthly) || monthly <= 0) return
          terminationComponentExtras.push({ label, amount: monthly, guards })
        }

        pushTerminationComponent('Severance Provision', enh.enhancements.severanceProvision, ['severance provision'])
        pushTerminationComponent('Probation Provision', enh.enhancements.probationProvision, ['probation provision'])

        if (terminationComponentExtras.length > 0) {
          terminationComponentExtras.forEach(entry => addExtra(entry.label, entry.amount, entry.guards))
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

        // Main employer contributions
        const ec = enh.enhancements.employer_contributions_total
        if (ec && ec.isAlreadyIncluded !== true && typeof ec.monthly_amount === 'number' && ec.monthly_amount > 0) {
          addExtra('Employer Contributions', Number(ec.monthly_amount), ['employer contributions', 'employer contribution', 'statutory contributions', 'statutory contribution'])
        }

        // Additional contributions and local office
        const addc = enh.enhancements.additionalContributions || {}
        let contribAgg = 0
        let contribPerItem = 0
        let contribAggPresent = false
        const localExtras: Array<{ name: string; amount: number; guards?: string[] }> = []

        // Check if main enhancements already have employer contributions to prevent duplication
        const hasMainEmployerContrib = !!(enh.enhancements?.employer_contributions_total)
        if (hasMainEmployerContrib && addc.employer_contributions_total) {
          console.warn('[Quote Processing] Skipping employer_contributions_total from additionalContributions - already present in main enhancements', {
            main: enh.enhancements.employer_contributions_total,
            additional: addc.employer_contributions_total
          })
        }

        Object.entries(addc).forEach(([k, v]) => {
          const n = Number(v)
          if (!isFinite(n) || n <= 0) return
          const key = String(k || '').toLowerCase()

          // Skip employer contributions from additionalContributions if already in main enhancements
          if ((key === 'employer_contributions_total' || (key.includes('baseline') && key.includes('employer') && key.includes('contribution'))) && hasMainEmployerContrib) {
            return // Skip this item to prevent duplication
          }

          if (key === 'employer_contributions_total' || (key.includes('baseline') && key.includes('employer') && key.includes('contribution'))) {
            contribAgg += n
            contribAggPresent = true
            return
          }
          if (key.startsWith('employer_contrib_') || (key.includes('employer') && key.includes('contribution'))) {
            // Also check individual employer contribution items to prevent semantic duplicates
            if (hasMainEmployerContrib) {
              const mainAmount = Number(enh.enhancements.employer_contributions_total?.monthly_amount || 0)
              // If individual items might sum to similar amount as main, skip them to prevent double-counting
              console.warn(`[Quote Processing] Skipping individual employer contribution '${k}' (${n}) - main employer contribution already exists (${mainAmount})`)
              return
            }
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
        if (contribTotal > 0) addExtra('Employer Contributions', contribTotal, ['employer contributions', 'employer contribution', 'statutory contributions', 'statutory contribution'])
        localExtras.forEach(le => addExtra(le.name, le.amount))
      }
    } catch { /* noop */ }

    // Do not inject extras here to avoid double-counting.
    // Extras are passed to GenericQuoteCard via mergedExtras for inline injection.

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
      const comparisonReady = quoteData ? isComparisonReady('deel', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('deel', quoteData) : false;
      const isLoadingComparison = providerLoading.deel ||
        (eorForm.enableComparison && (!quoteData.quotes.deel || !quoteData.quotes.comparisonDeel));

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
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'rivermate') {
      const comparisonReady = quoteData ? isComparisonReady('rivermate', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('rivermate', quoteData) : false;
      const isLoadingComparison = providerLoading.rivermate ||
        (eorForm.enableComparison && (!quoteData.quotes.rivermate || !quoteData.quotes.comparisonRivermate));

      const primaryIsOptimized = quoteData.quotes.rivermate && 'taxItems' in (quoteData.quotes.rivermate as any);
      const compareIsOptimized = quoteData.quotes.comparisonRivermate && 'taxItems' in (quoteData.quotes.comparisonRivermate as any);

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
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'oyster') {
      const comparisonReady = quoteData ? isComparisonReady('oyster', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('oyster', quoteData) : false;
      const isLoadingComparison = providerLoading.oyster ||
        (eorForm.enableComparison && (!quoteData.quotes.oyster || !quoteData.quotes.comparisonOyster));

      const oysterPrimaryDisplay = quoteData.quotes.oyster && ('contributions' in (quoteData.quotes.oyster as any)) ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any) : (quoteData.quotes.oyster as any);
      const oysterCompareDisplay = quoteData.quotes.comparisonOyster && ('contributions' in (quoteData.quotes.comparisonOyster as any)) ? transformOysterQuoteToDisplayQuote(quoteData.quotes.comparisonOyster as any) : (quoteData.quotes.comparisonOyster as any);

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
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'remote') {
      const comparisonReady = quoteData ? isComparisonReady('remote', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('remote', quoteData) : false;
      const isLoadingComparison = providerLoading.remote ||
        (eorForm.enableComparison && (!quoteData.quotes.remote || !quoteData.quotes.comparisonRemote));

      const providerDual = quoteData.dualCurrencyQuotes?.remote;
      const hasDualCompare = providerDual?.isDualCurrencyMode && providerDual?.hasComparison;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="remote"
            primaryQuote={hasDualCompare ? undefined : transformRemoteResponseToQuote(quoteData.quotes.remote as RemoteAPIResponse)}
            comparisonQuote={hasDualCompare ? undefined : transformRemoteResponseToQuote(quoteData.quotes.comparisonRemote as RemoteAPIResponse)}
            primaryTitle={(quoteData.formData as EORFormData).country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingRemoteToUsd}
            isConvertingComparisonToUSD={isConvertingCompareRemoteToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.remote}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'rippling') {
      const comparisonReady = quoteData ? isComparisonReady('rippling', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('rippling', quoteData) : false;
      const isLoadingComparison = providerLoading.rippling ||
        (eorForm.enableComparison && (!quoteData.quotes.rippling || !(quoteData.quotes as any).comparisonRippling));

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
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'skuad') {
      const comparisonReady = quoteData ? isComparisonReady('skuad', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('skuad', quoteData) : false;
      const isLoadingComparison = providerLoading.skuad ||
        (eorForm.enableComparison && (!((quoteData.quotes as any).skuad) || !((quoteData.quotes as any).comparisonSkuad)));

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
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'velocity') {
      const comparisonReady = quoteData ? isComparisonReady('velocity', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('velocity', quoteData) : false;
      const isLoadingComparison = providerLoading.velocity ||
        (eorForm.enableComparison && (!((quoteData.quotes as any).velocity) || !((quoteData.quotes as any).comparisonVelocity)));

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
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="absolute inset-0" onClick={() => setIsReconModalOpen(false)} />
          <Card className="relative w-screen h-screen border-0 shadow-none bg-white overflow-hidden rounded-none">
            
            {/* Top Banner: Progress Bar + Phase */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-900 shadow-sm">
                    <Activity className="h-5 w-5 text-white" />
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
                  <Button variant="outline" size="sm" onClick={() => setIsReconModalOpen(false)} className="ml-4 rounded-none">
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Close
                  </Button>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4 bg-slate-200 h-2.5 overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Main Timeline Area */}
            <div className="flex-1 overflow-y-auto">
              {renderTimelinePhases()}
            </div>
          </Card>
        </div>
      )}

      {/* Enhanced CSS animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }

        .stagger-children > * {
          opacity: 0;
          animation: fadeInUp 0.4s ease-out forwards;
        }

        .stagger-children > *:nth-child(1) { animation-delay: 0ms; }
        .stagger-children > *:nth-child(2) { animation-delay: 50ms; }
        .stagger-children > *:nth-child(3) { animation-delay: 100ms; }
        .stagger-children > *:nth-child(4) { animation-delay: 150ms; }
        .stagger-children > *:nth-child(5) { animation-delay: 200ms; }
        .stagger-children > *:nth-child(6) { animation-delay: 250ms; }
        .stagger-children > *:nth-child(7) { animation-delay: 300ms; }
        .stagger-children > *:nth-child(n+8) { animation-delay: 350ms; }
      `}</style>
    </div>
  )
});

QuotePageContent.displayName = 'QuotePageContent';

export default function QuotePage() {
  return (
    <ErrorBoundary
      fallbackTitle="Quote Loading Error"
      fallbackMessage="There was a problem loading your quote. This might be due to corrupted data or a temporary issue."
      onError={() => {
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
