import { memo, useMemo } from "react"
import { DeelAPIResponse, DualCurrencyQuotes, USDConversions } from "@/lib/shared/types"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"
import { useEnhancementContext } from "@/hooks/enhancement/EnhancementContext"

type CompatibleUsdConversions = USDConversions | {
  deel?: USDConversions['deel'] | USDConversions['oyster']
  compare?: USDConversions['compare'] | USDConversions['compareOyster']
  remote?: USDConversions['remote']
  compareRemote?: USDConversions['compareRemote']
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
}

// Helper function to safely access USD conversion data
const getProviderUsdConversion = (
  usdConversions: CompatibleUsdConversions, 
  provider: string, 
  isComparison: boolean = false
): USDConversions['deel'] | undefined => {
  const conversions = usdConversions as Record<string, unknown>
  
  if (isComparison) {
    switch (provider) {
      case 'remote': return conversions.compareRemote as USDConversions['deel'] | undefined
      case 'rivermate': 
      case 'oyster': return conversions.compare as USDConversions['deel'] | undefined
      case 'rippling': return conversions.compareRippling as USDConversions['deel'] | undefined
      case 'skuad': return conversions.compareSkuad as USDConversions['deel'] | undefined
      case 'velocity': return conversions.compareVelocity as USDConversions['deel'] | undefined
      default: return conversions.compare as USDConversions['deel'] | undefined
    }
  } else {
    switch (provider) {
      case 'remote': return conversions.remote as USDConversions['deel'] | undefined
      case 'rivermate':
      case 'oyster': return conversions.deel as USDConversions['deel'] | undefined
      case 'rippling': return conversions.rippling as USDConversions['deel'] | undefined
      case 'skuad': return conversions.skuad as USDConversions['deel'] | undefined
      case 'velocity': return conversions.velocity as USDConversions['deel'] | undefined
      default: return conversions.deel as USDConversions['deel'] | undefined
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
}: QuoteComparisonProps) => {
  const { enhancements } = useEnhancementContext()
  const isDualMode = dualCurrencyQuotes?.isDualCurrencyMode && dualCurrencyQuotes?.hasComparison;

  const primaryCardDualQuotes = isDualMode ? {
    ...dualCurrencyQuotes,
    selectedCurrencyQuote: dualCurrencyQuotes.selectedCurrencyQuote,
    localCurrencyQuote: dualCurrencyQuotes.localCurrencyQuote,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    hasComparison: false,
  } : undefined;

  const comparisonCardDualQuotes = isDualMode ? {
    ...dualCurrencyQuotes,
    selectedCurrencyQuote: dualCurrencyQuotes.compareSelectedCurrencyQuote,
    localCurrencyQuote: dualCurrencyQuotes.compareLocalCurrencyQuote,
    compareSelectedCurrencyQuote: null,
    compareLocalCurrencyQuote: null,
    hasComparison: false,
  } : undefined;

  // Build merged quote with enhancement extras injected (primary side only)
  const {
    mergedPrimaryQuote,
    extendedPrimaryConversions,
    isPrimaryEnhPending,
    recalcBaseItems,
    primaryExtras,
    mergedCurrency
  } = useMemo(() => {
    const result = {
      mergedPrimaryQuote: primaryQuote as DeelAPIResponse | undefined,
      extendedPrimaryConversions: getProviderUsdConversion(usdConversions, provider, false) as any,
      isPrimaryEnhPending: false,
      recalcBaseItems: [] as string[],
      primaryExtras: [] as Array<{ name: string; amount: number }>,
      mergedCurrency: primaryQuote?.currency as string | undefined
    }

    try {
      const enh = (enhancements as any)?.[provider]
      if (!enh) {
        result.isPrimaryEnhPending = true
        return result
      }

      result.recalcBaseItems = Array.isArray(enh.recalcBaseItems) ? enh.recalcBaseItems : []

      // Build extras from enhancement object
      const extras: Array<{ name: string; amount: number; guards?: string[] }> = []
      if (primaryQuote && Array.isArray((primaryQuote as any).costs)) {
        let merged: any = { ...(primaryQuote as any) }
        const conversions = getProviderUsdConversion(usdConversions, provider, false) as any
        const costs = Array.isArray(merged.costs) ? [...merged.costs] : []

        const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const hasItemLike = (needle: string) => costs.some((c: any) => norm(c?.name).includes(norm(needle)))
        const addExtraRow = (name: string, amount: number) => {
          const amt = Number(amount)
          if (!isFinite(amt) || amt <= 0) return
          costs.push({
            name,
            amount: amt.toFixed(2),
            frequency: 'monthly',
            country: (primaryQuote as any)?.country,
            country_code: (primaryQuote as any)?.country_code,
          })
        }

        const addExtra = (name: string, amount: number, guards: string[] = []) => {
          const amt = Number(amount)
          if (!isFinite(amt) || amt <= 0) return
          const dup = guards.some(g => hasItemLike(g))
          if (!dup) extras.push({ name, amount: amt, guards })
        }

        // Build extras from enhancement object
        const tc = enh.enhancements?.terminationCosts
        if (tc && typeof tc.totalTerminationCost === 'number' && tc.totalTerminationCost > 0) {
          const months = Math.max(1, Number(tc.basedOnContractMonths || 12))
          addExtra('Termination Provision', tc.totalTerminationCost / months, ['termination', 'severance', 'notice', 'provision'])
        }
        const th13 = enh.enhancements?.thirteenthSalary
        if (th13 && th13.isAlreadyIncluded !== true) {
          const m = Number(th13.monthlyAmount || 0) || (Number(th13.yearlyAmount || 0) / 12)
          addExtra('13th Salary', m, ['13th', 'thirteenth'])
        }
        const th14 = enh.enhancements?.fourteenthSalary
        if (th14 && th14.isAlreadyIncluded !== true) {
          const m = Number(th14.monthlyAmount || 0) || (Number(th14.yearlyAmount || 0) / 12)
          addExtra('14th Salary', m, ['14th', 'fourteenth'])
        }
        const ta = enh.enhancements?.transportationAllowance
        if (ta && ta.isAlreadyIncluded !== true) addExtra('Transportation Allowance', Number(ta.monthlyAmount || 0), ['transportation'])
        const rwa = enh.enhancements?.remoteWorkAllowance
        if (rwa && rwa.isAlreadyIncluded !== true) addExtra('Remote Work Allowance', Number(rwa.monthlyAmount || 0), ['remote work', 'wfh'])
        const mv = enh.enhancements?.mealVouchers
        if (mv && mv.isAlreadyIncluded !== true) addExtra('Meal Vouchers', Number(mv.monthlyAmount || 0), ['meal voucher'])
        const addc = enh.enhancements?.additionalContributions || {}
        Object.entries(addc).forEach(([k, v]) => {
          const n = Number(v)
          if (!isFinite(n) || n <= 0) return
          const key = String(k || '').toLowerCase()
          const label = key.includes('baseline') && key.includes('employer')
            ? 'Employer Contributions (baseline)'
            : key.includes('employer') && key.includes('contribution')
              ? 'Employer Contributions'
              : key.includes('local_meal_voucher')
                ? 'Meal Voucher (Local Office)'
                : key.includes('local_transportation')
                  ? 'Transportation (Local Office)'
                  : key.includes('local_wfh')
                    ? 'WFH (Local Office)'
                    : key.includes('local_health_insurance')
                      ? 'Health Insurance (Local Office)'
                      : key.includes('local_office_monthly_payments')
                        ? 'Local Office Monthly Payments'
                        : key.includes('local_office_vat')
                          ? 'VAT on Local Office Payments'
                          : String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          addExtra(label, n)
        })

        // In dual mode: only expose extras via props; non-dual inject rows and totals
        if (extras.length > 0 && isDualMode) {
          result.primaryExtras = extras.map(e => ({ name: e.name, amount: e.amount }))
        }

        // Append new rows and update conversions (non-dual only)
        if (extras.length > 0 && !isDualMode) {
          // derive simple exchange rate from first aligned pair
          let exchangeRate: number | null = null
          try {
            const conv = conversions as any
            if (conv?.costs && Array.isArray(conv.costs) && costs.length > 0) {
              for (let i = 0; i < Math.min(costs.length, conv.costs.length); i++) {
                const localAmount = Number.parseFloat(costs[i].amount)
                const usdAmount = conv.costs[i]
                if (localAmount > 0 && usdAmount > 0) {
                  exchangeRate = usdAmount / localAmount
                  break
                }
              }
            }
          } catch { /* noop */ }

          const newUsdConversions: number[] = []
          extras.forEach(ex => {
            addExtraRow(ex.name, ex.amount)
            if (exchangeRate !== null) newUsdConversions.push(ex.amount * exchangeRate)
          })

          if ((conversions as any)?.costs && newUsdConversions.length > 0) {
            result.extendedPrimaryConversions = {
              ...(conversions as any),
              costs: [ ...(conversions as any).costs, ...newUsdConversions ]
            }
          }

          merged.costs = costs
          // Update total
          const parseNum = (v?: string | number) => typeof v === 'number' ? v : Number.parseFloat((v || '0') as string)
          const baseTotal = parseNum((primaryQuote as any)?.total_costs)
          const extraSum = extras.reduce((s, it) => s + (it.amount || 0), 0)
          const newTotal = baseTotal + extraSum
          merged.total_costs = isFinite(newTotal) ? newTotal.toFixed(2) : (primaryQuote as any)?.total_costs
          merged.employer_costs = merged.total_costs
          result.mergedPrimaryQuote = merged
        }
      }
    } catch { /* noop */ }

    return result
  }, [primaryQuote, usdConversions, enhancements, provider, isDualMode])

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <GenericQuoteCard
          provider={provider}
          quote={isDualMode ? undefined : mergedPrimaryQuote}
          title={primaryTitle}
          badgeText="Main Quote"
          badgeColor="bg-green-100 text-green-800"
          usdConversions={extendedPrimaryConversions}
          isConvertingToUSD={isConvertingPrimaryToUSD}
          usdConversionError={usdConversionError}
          compact={true}
          dualCurrencyQuotes={primaryCardDualQuotes}
          recalcBaseItems={recalcBaseItems}
          {...(isDualMode ? { mergedExtras: primaryExtras, mergedCurrency } : {})}
          enhancementPending={isPrimaryEnhPending}
          shimmerExtrasCount={3}
        />

        <GenericQuoteCard
          provider={provider}
          quote={isDualMode ? undefined : comparisonQuote}
          title={comparisonTitle}
          badgeText="Compare Quote"
          badgeColor="bg-blue-100 text-blue-800"
          usdConversions={getProviderUsdConversion(usdConversions, provider, true)}
          isConvertingToUSD={isConvertingComparisonToUSD}
          usdConversionError={usdConversionError}
          compact={true}
          dualCurrencyQuotes={comparisonCardDualQuotes}
        />
      </div>
    </div>
  )
});

QuoteComparison.displayName = 'QuoteComparison';
