import { memo, useMemo } from "react"
import { DeelAPIResponse, DualCurrencyQuotes, USDConversions } from "@/lib/shared/types"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"
import { useEnhancementContext } from "@/hooks/enhancement/EnhancementContext"

type CompatibleUsdConversions = USDConversions | {
  deel?: USDConversions['deel'] | USDConversions['oyster']
  compare?: USDConversions['compare'] | USDConversions['compareOyster']
  remote?: USDConversions['remote']
  compareRemote?: USDConversions['compareRemote']
  rippling?: USDConversions['deel']
  compareRippling?: USDConversions['deel']
  skuad?: USDConversions['deel']
  compareSkuad?: USDConversions['deel']
  velocity?: USDConversions['deel']
  compareVelocity?: USDConversions['deel']
}

interface QuoteComparisonProps {
  primaryQuote?: DeelAPIResponse
  comparisonQuote?: DeelAPIResponse
  primaryTitle: string
  comparisonTitle: string
  usdConversions: CompatibleUsdConversions
  onConvertPrimaryToUSD?: () => void
  onConvertComparisonToUSD?: () => void
  isConvertingPrimaryToUSD: boolean
  isConvertingComparisonToUSD: boolean
  usdConversionError?: string | null
  dualCurrencyQuotes?: DualCurrencyQuotes
  provider?: 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity'
  // Comparison readiness state
  isComparisonReady?: boolean
  isDualCurrencyReady?: boolean
  isLoadingComparison?: boolean
}

const getProviderUsdConversion = (
  usdConversions: CompatibleUsdConversions,
  provider: string,
  isComparison: boolean = false
): USDConversions['deel'] | undefined => {
  const conversions = usdConversions as Record<string, unknown>
  if (isComparison) {
    switch (provider) {
      case 'remote': return conversions.compareRemote as USDConversions['deel']
      case 'rivermate':
      case 'oyster': return conversions.compare as USDConversions['deel']
      case 'rippling': return conversions.compareRippling as USDConversions['deel']
      case 'skuad': return conversions.compareSkuad as USDConversions['deel']
      case 'velocity': return conversions.compareVelocity as USDConversions['deel']
      default: return conversions.compare as USDConversions['deel']
    }
  } else {
    switch (provider) {
      case 'remote': return conversions.remote as USDConversions['deel']
      case 'rivermate':
      case 'oyster': return conversions.deel as USDConversions['deel']
      case 'rippling': return conversions.rippling as USDConversions['deel']
      case 'skuad': return conversions.skuad as USDConversions['deel']
      case 'velocity': return conversions.velocity as USDConversions['deel']
      default: return conversions.deel as USDConversions['deel']
    }
  }
}

export const QuoteComparison = memo(({
  primaryQuote,
  comparisonQuote,
  primaryTitle,
  comparisonTitle,
  usdConversions,
  isConvertingPrimaryToUSD,
  isConvertingComparisonToUSD,
  usdConversionError,
  dualCurrencyQuotes,
  provider = 'deel',
  isComparisonReady = true,
  isDualCurrencyReady = true,
  isLoadingComparison = false,
}: QuoteComparisonProps) => {
  const { enhancements } = useEnhancementContext()
  const isDualMode = dualCurrencyQuotes?.isDualCurrencyMode && dualCurrencyQuotes?.hasComparison

  // Check if we should show loading state
  const shouldShowLoading = isLoadingComparison || !isComparisonReady || (isDualMode && isDualCurrencyReady === false)

  // If comparison data is not ready, show loading state
  if (shouldShowLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Loading placeholders for both quotes */}
          <div className="bg-white border shadow-sm p-6 animate-pulse">
            <div className="flex justify-center mb-4">
              <div className="h-8 w-32 bg-slate-200 rounded"></div>
            </div>
            <div className="text-center mb-6">
              <div className="h-6 w-24 bg-slate-200 rounded mx-auto mb-2"></div>
              <div className="h-4 w-16 bg-slate-200 rounded mx-auto"></div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                  <div className="h-4 w-20 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between">
                <div className="h-6 w-40 bg-slate-200 rounded"></div>
                <div className="h-6 w-24 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>

          <div className="bg-white border shadow-sm p-6 animate-pulse">
            <div className="flex justify-center mb-4">
              <div className="h-8 w-32 bg-slate-200 rounded"></div>
            </div>
            <div className="text-center mb-6">
              <div className="h-6 w-24 bg-slate-200 rounded mx-auto mb-2"></div>
              <div className="h-4 w-16 bg-slate-200 rounded mx-auto"></div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                  <div className="h-4 w-20 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between">
                <div className="h-6 w-40 bg-slate-200 rounded"></div>
                <div className="h-6 w-24 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-slate-600">
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
            <span>Loading comparison data...</span>
          </div>
        </div>
      </div>
    )
  }

  const primaryCardDualQuotes = isDualMode ? {
    ...dualCurrencyQuotes,
    selectedCurrencyQuote: dualCurrencyQuotes.selectedCurrencyQuote,
    localCurrencyQuote: dualCurrencyQuotes.localCurrencyQuote,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    hasComparison: false,
  } : undefined

  const comparisonCardDualQuotes = isDualMode ? {
    ...dualCurrencyQuotes,
    selectedCurrencyQuote: dualCurrencyQuotes.compareSelectedCurrencyQuote,
    localCurrencyQuote: dualCurrencyQuotes.compareLocalCurrencyQuote,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    hasComparison: false,
  } : undefined

  const mergeWithEnhancements = (
    quote: DeelAPIResponse | undefined,
    enh: any | undefined,
    conversions: any,
    dualMode: boolean
  ) => {
    const result = {
      mergedQuote: quote as DeelAPIResponse | undefined,
      extendedConversions: conversions as any,
      isPending: false,
      recalcItems: [] as string[],
      extras: [] as Array<{ name: string; amount: number; tag?: 'yearly_bonus' | 'one_time_fee' }>,
      currency: (quote as any)?.currency as string | undefined
    }

    if (!enh) {
      result.isPending = true
      return result
    }

    result.recalcItems = Array.isArray(enh.recalcBaseItems) ? enh.recalcBaseItems : []

    if (quote && Array.isArray((quote as any).costs)) {
      const merged: any = { ...(quote as any) }
      const costs: any[] = Array.isArray(merged.costs) ? [...merged.costs] : []
      const collected: Array<{ name: string; amount: number; guards?: string[]; tag?: 'yearly_bonus' | 'one_time_fee' }> = []

      const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const hasItemLike = (needle: string) => costs.some((c: any) => norm(c?.name).includes(norm(needle)))
      const addExtraRow = (name: string, amount: number, tag?: 'yearly_bonus' | 'one_time_fee') => {
        const amt = Number(amount)
        if (!isFinite(amt) || amt <= 0) return
        const frequency = tag === 'one_time_fee' ? 'one_time' : tag === 'yearly_bonus' ? 'annual' : 'monthly'
        const displayAmount = tag === 'yearly_bonus' ? amt / 12 : amt
        costs.push({
          name,
          amount: displayAmount.toFixed(2),
          frequency,
          country: (quote as any)?.country,
          country_code: (quote as any)?.country_code,
          tag
        })
      }
      const addExtra = (name: string, amount: number, guards: string[] = [], tag?: 'yearly_bonus' | 'one_time_fee') => {
        const amt = Number(amount)
        if (!isFinite(amt) || amt <= 0) return
        const dup = guards.some(g => hasItemLike(g))
        if (!dup) collected.push({ name, amount: amt, guards, tag })
      }

      const tc = enh?.enhancements?.terminationCosts
      if (tc && typeof tc.totalTerminationCost === 'number' && tc.totalTerminationCost > 0) {
        addExtra('Termination Provision', tc.totalTerminationCost, ['termination', 'severance', 'notice', 'provision'], 'one_time_fee')
      }
      const th13 = enh?.enhancements?.thirteenthSalary
      if (th13 && th13.isAlreadyIncluded !== true) {
        const yearly = Number(th13.yearlyAmount || 0) || (Number(th13.monthlyAmount || 0) * 12)
        addExtra('13th Salary', yearly, ['13th', 'thirteenth'], 'yearly_bonus')
      }
      const th14 = enh?.enhancements?.fourteenthSalary
      if (th14 && th14.isAlreadyIncluded !== true) {
        const yearly = Number(th14.yearlyAmount || 0) || (Number(th14.monthlyAmount || 0) * 12)
        addExtra('14th Salary', yearly, ['14th', 'fourteenth'], 'yearly_bonus')
      }
      const ta = enh?.enhancements?.transportationAllowance
      if (ta && ta.isAlreadyIncluded !== true) addExtra('Transportation Allowance', Number(ta.monthlyAmount || 0), ['transportation'])
      const rwa = enh?.enhancements?.remoteWorkAllowance
      if (rwa && rwa.isAlreadyIncluded !== true) addExtra('Remote Work Allowance', Number(rwa.monthlyAmount || 0), ['remote work', 'wfh'])
      const mv = enh?.enhancements?.mealVouchers
      if (mv && mv.isAlreadyIncluded !== true) addExtra('Meal Vouchers', Number(mv.monthlyAmount || 0), ['meal voucher'])
      const addc = enh?.enhancements?.additionalContributions || {}
      Object.entries(addc).forEach(([k, v]) => {
        const n = Number(v)
        if (!isFinite(n) || n <= 0) return
        const key = String(k || '').toLowerCase()
        const label = key.includes('baseline') && key.includes('employer') ? 'Employer Contributions (baseline)'
          : key.includes('employer') && key.includes('contribution') ? 'Employer Contributions'
          : key.includes('local_meal_voucher') ? 'Meal Voucher (Local Office)'
          : key.includes('local_transportation') ? 'Transportation (Local Office)'
          : key.includes('local_wfh') ? 'WFH (Local Office)'
          : key.includes('local_health_insurance') ? 'Health Insurance (Local Office)'
          : key.includes('local_office_monthly_payments') ? 'Local Office Monthly Payments'
          : key.includes('local_office_vat') ? 'VAT on Local Office Payments'
          : String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        addExtra(label, n)
      })

      if (collected.length > 0 && dualMode) {
        result.extras = collected.map(e => ({ name: e.name, amount: e.amount, tag: e.tag }))
      }
      if (collected.length > 0 && !dualMode) {
        let exchangeRate: number | null = null
        try {
          const conv = conversions as any
          if (conv?.costs && Array.isArray(conv.costs) && costs.length > 0) {
            for (let i = 0; i < Math.min(costs.length, conv.costs.length); i++) {
              const localAmount = Number.parseFloat(costs[i].amount)
              const usdAmount = conv.costs[i]
              if (localAmount > 0 && usdAmount > 0) { exchangeRate = usdAmount / localAmount; break }
            }
          }
        } catch { /* noop */ }
        const newUsdConversions: number[] = []
        collected.forEach(ex => {
          addExtraRow(ex.name, ex.amount, ex.tag)
          if (exchangeRate !== null) {
            const converted = ex.tag === 'yearly_bonus' ? (ex.amount / 12) : ex.amount
            newUsdConversions.push(converted * exchangeRate)
          }
        })
        if ((conversions as any)?.costs && newUsdConversions.length > 0) {
          result.extendedConversions = { ...(conversions as any), costs: [ ...(conversions as any).costs, ...newUsdConversions ] }
        }
        merged.costs = costs
        const parseNum = (v?: string | number) => typeof v === 'number' ? v : Number.parseFloat((v || '0') as string)
        const baseTotal = parseNum((quote as any)?.total_costs)
        const extraSum = collected.reduce((s, it) => {
          if (!it || !isFinite(it.amount)) return s
          if (it.tag === 'one_time_fee') return s
          if (it.tag === 'yearly_bonus') return s + (it.amount / 12)
          return s + it.amount
        }, 0)
        const newTotal = baseTotal + extraSum
        merged.total_costs = isFinite(newTotal) ? newTotal.toFixed(2) : (quote as any)?.total_costs
        merged.employer_costs = merged.total_costs
        result.mergedQuote = merged
      }
    }

    return result
  }

  const primaryMerged = useMemo(() => mergeWithEnhancements(
    primaryQuote,
    (enhancements as any)?.[provider],
    getProviderUsdConversion(usdConversions, provider, false),
    isDualMode
  ), [primaryQuote, enhancements, provider, usdConversions, isDualMode])

  const comparisonMerged = useMemo(() => mergeWithEnhancements(
    comparisonQuote,
    (enhancements as any)?.[`${provider}::compare`],
    getProviderUsdConversion(usdConversions, provider, true),
    isDualMode
  ), [comparisonQuote, enhancements, provider, usdConversions, isDualMode])

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <GenericQuoteCard
          provider={provider}
          quote={isDualMode ? undefined : primaryMerged.mergedQuote}
          title={primaryTitle}
          badgeText="Main Quote"
          badgeColor="bg-green-100 text-green-800"
          usdConversions={primaryMerged.extendedConversions}
          isConvertingToUSD={isConvertingPrimaryToUSD}
          usdConversionError={usdConversionError}
          compact={true}
          dualCurrencyQuotes={primaryCardDualQuotes}
          recalcBaseItems={primaryMerged.recalcItems}
          {...(isDualMode ? { mergedExtras: primaryMerged.extras, mergedCurrency: primaryMerged.currency } : {})}
          enhancementPending={primaryMerged.isPending}
          totalPending={primaryMerged.isPending}
          shimmerExtrasCount={3}
        />

        <GenericQuoteCard
          provider={provider}
          quote={isDualMode ? undefined : comparisonMerged.mergedQuote}
          title={comparisonTitle}
          badgeText="Compare Quote"
          badgeColor="bg-blue-100 text-blue-800"
          usdConversions={comparisonMerged.extendedConversions}
          isConvertingToUSD={isConvertingComparisonToUSD}
          usdConversionError={usdConversionError}
          compact={true}
          dualCurrencyQuotes={comparisonCardDualQuotes}
          recalcBaseItems={comparisonMerged.recalcItems}
          {...(isDualMode ? { mergedExtras: comparisonMerged.extras, mergedCurrency: comparisonMerged.currency } : {})}
          enhancementPending={comparisonMerged.isPending}
          totalPending={comparisonMerged.isPending}
          shimmerExtrasCount={3}
        />
      </div>
    </div>
  )
})

QuoteComparison.displayName = 'QuoteComparison'
