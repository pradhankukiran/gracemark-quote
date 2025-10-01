import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Loader2, Calculator } from "lucide-react";
import { Quote, USDConversions, DualCurrencyQuotes } from "@/lib/shared/types";
import { formatCurrency } from "@/lib/shared/utils/currencyUtils";
import { ProviderLogo } from "@/app/quote/components/ProviderLogo";

interface ProviderTheme {
  logo: React.ReactNode;
  brandColor: string;
  gradientFrom: string;
  gradientTo: string;
}

interface GenericQuoteCardProps {
  quote?: Quote;
  title: string;
  provider: 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity' | 'playroll' | 'omnipresent';
  badgeText?: string;
  badgeColor?: string;
  usdConversions?: USDConversions[keyof USDConversions];
  isConvertingToUSD?: boolean;
  compact?: boolean;
  usdConversionError?: string | null;
  dualCurrencyQuotes?: DualCurrencyQuotes;
  originalCurrency?: string;
  selectedCurrency?: string;
  // Merged full-quote support (local currency)
  mergedTotalMonthly?: number;
  mergedCurrency?: string;
  mergedExtras?: Array<{ name: string; amount: number }>;
  recalcBaseItems?: string[];
  // Shimmer placeholders for pending enhanced extras
  enhancementPending?: boolean;
  shimmerExtrasCount?: number;
}

const providerThemes: { [key in 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity' | 'playroll' | 'omnipresent']: ProviderTheme } = {
  deel: {
    logo: <ProviderLogo provider="deel" />,
    brandColor: "text-primary",
    gradientFrom: "from-primary/10",
    gradientTo: "to-primary/5",
  },
  remote: {
    logo: <ProviderLogo provider="remote" />,
    brandColor: "text-blue-600",
    gradientFrom: "from-blue-50",
    gradientTo: "to-blue-100",
  },
  rivermate: {
    logo: <ProviderLogo provider="rivermate" />,
    brandColor: "text-purple-700",
    gradientFrom: "from-purple-50",
    gradientTo: "to-purple-100",
  },
  oyster: {
    logo: <ProviderLogo provider="oyster" />,
    brandColor: "text-rose-700",
    gradientFrom: "from-rose-50",
    gradientTo: "to-rose-100",
  },
  rippling: {
    logo: <ProviderLogo provider="rippling" />,
    brandColor: "text-amber-700",
    gradientFrom: "from-amber-50",
    gradientTo: "to-amber-100",
  },
  skuad: {
    logo: <ProviderLogo provider="skuad" />,
    brandColor: "text-teal-700",
    gradientFrom: "from-teal-50",
    gradientTo: "to-teal-100",
  },
  velocity: {
    logo: <ProviderLogo provider="velocity" />,
    brandColor: "text-orange-700",
    gradientFrom: "from-orange-50",
    gradientTo: "to-orange-100",
  },
  playroll: {
    logo: <ProviderLogo provider="playroll" />,
    brandColor: "text-indigo-700",
    gradientFrom: "from-indigo-50",
    gradientTo: "to-indigo-100",
  },
  omnipresent: {
    logo: <ProviderLogo provider="omnipresent" />,
    brandColor: "text-emerald-700",
    gradientFrom: "from-emerald-50",
    gradientTo: "to-emerald-100",
  },
};

export const GenericQuoteCard = memo(({
  quote,
  title,
  provider,
  badgeText,
  badgeColor = "bg-green-100 text-green-800",
  usdConversions,
  isConvertingToUSD = false,
  compact = false,
  usdConversionError = null,
  dualCurrencyQuotes,
  originalCurrency,
  selectedCurrency,
  mergedTotalMonthly,
  mergedCurrency,
  mergedExtras,
  recalcBaseItems,
  enhancementPending = false,
  shimmerExtrasCount = 0,
}: GenericQuoteCardProps) => {
  const theme = providerThemes[provider];

  const isDualCurrencyMode =
    !!(dualCurrencyQuotes?.isDualCurrencyMode &&
    dualCurrencyQuotes?.selectedCurrencyQuote &&
    dualCurrencyQuotes?.localCurrencyQuote);

  // In dual-currency mode, trust the provided roles explicitly:
  const selectedQuote = dualCurrencyQuotes?.selectedCurrencyQuote;
  const localQuote = dualCurrencyQuotes?.localCurrencyQuote;
  const isCalculatingSelected = dualCurrencyQuotes?.isCalculatingSelected;
  const isCalculatingLocal = dualCurrencyQuotes?.isCalculatingLocal;

  // Always map Local -> localCurrencyQuote, Changed -> selectedCurrencyQuote
  let originalQuote = isDualCurrencyMode ? localQuote : quote;
  let changedQuote = isDualCurrencyMode ? selectedQuote : undefined;
  // Track an effective USD conversions object (may be extended)
  const effectiveUsdConv: any = usdConversions as any

  // Inject merged extras into quote rows (inline) and update totals/US conversions
  try {
    const extras = Array.isArray(mergedExtras) ? mergedExtras.filter(e => (e && typeof e.amount === 'number' && e.amount > 0)) : []
    if (extras.length > 0 && originalQuote) {
      const toAmountStr = (n: number) => {
        const v = Number(n)
        return Number.isFinite(v) ? v.toFixed(2) : '0'
      }
      const cloneWithExtras = (src: any, scale: number = 1) => {
        const q = { ...(src || {}) }
        const costs = Array.isArray(q.costs) ? [...q.costs] : []
        const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const hasItemLike = (needle: string) => {
          const needleNorm = norm(needle)
          return costs.some((c: any) => {
            const costName = norm(c?.name)
            // For employer contributions, require high semantic similarity to prevent false positives
            if (needleNorm.includes('employer') && needleNorm.includes('contribution')) {
              return costName.includes('employer') && costName.includes('contribution')
            }
            // For other items, use the original includes logic
            return costName.includes(needleNorm)
          })
        }
        const defaultGuardsFor = (name: string): string[] => {
          const n = name.toLowerCase()
          if (n.includes('termination')) return ['termination', 'severance', 'notice', 'provision', 'accrual']
          if (n.includes('13')) return ['13th', 'thirteenth', 'aguinaldo']
          if (n.includes('14')) return ['14th', 'fourteenth']
          if (n.includes('meal')) return ['meal', 'voucher', 'ticket', 'food']
          if (n.includes('transport')) return ['transport', 'commute', 'bus', 'metro']
          if (n.includes('employer') && n.includes('contrib')) return ['employer contributions', 'employer contribution', 'statutory contributions', 'statutory contribution']
          return [name]
        }
        // Derive USD exchange rate from existing conversions if available
        let exchangeRate: number | null = null
        const conv = usdConversions as any
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
        const newUsd: number[] = []
        extras.forEach(ex => {
          const amt = Math.max(0, Number(ex.amount) * (Number.isFinite(scale) && scale > 0 ? scale : 1))
          // Skip if a similar item already exists (avoid duplicates)
          const guards = Array.isArray((ex as any)?.guards) ? (ex as any).guards : defaultGuardsFor(String(ex.name || ''))
          const dup = guards.some(g => hasItemLike(g))
          if (dup) return
          costs.push({
            name: ex.name,
            amount: toAmountStr(amt),
            frequency: 'monthly',
            country: q.country,
            country_code: q.country_code,
          })
          if (exchangeRate !== null) newUsd.push(amt * exchangeRate)
        })
        // Extend conversions if possible
        if (conv?.costs && newUsd.length > 0) {
          conv.costs = [...conv.costs, ...newUsd]
        }
        // Update totals
        const parseNum = (v?: string | number) => typeof v === 'number' ? v : Number.parseFloat((v || '0') as string)
        const baseTotal = parseNum(q.total_costs)
        const sumExtras = extras.reduce((s, it) => s + (Number(it.amount) || 0) * (Number.isFinite(scale) && scale > 0 ? scale : 1), 0)
        const newTotal = baseTotal + sumExtras
        q.costs = costs
        q.total_costs = toAmountStr(newTotal)
        q.employer_costs = q.total_costs
        return q
      }

      // Always inject into original/local quote
      originalQuote = cloneWithExtras(originalQuote)

      // If dual mode, inject also into changed/selected quote by scaling extras to match totals ratio
      if (isDualCurrencyMode && changedQuote) {
        const parseNum = (v?: string | number) => typeof v === 'number' ? v : Number.parseFloat((v || '0') as string)
        const baseLocal = parseNum((localQuote as any)?.total_costs)
        const baseChanged = parseNum((selectedQuote as any)?.total_costs)
        const ratio = baseLocal > 0 ? (baseChanged / baseLocal) : 1
        changedQuote = cloneWithExtras(changedQuote, Number.isFinite(ratio) && ratio > 0 ? ratio : 1)
      }
    }
  } catch { /* noop extras injection */ }

  // Basic column logic
  const hasUSDData = usdConversions && Object.keys(usdConversions).length > 0;
  
  // Single currency mode: show currency + USD (if not USD)
  const showUSDInSingleMode = !isDualCurrencyMode && quote && quote.currency !== "USD";
  
  // Dual currency mode: show original + changed + USD (if neither is USD)
  // Show USD column in dual mode if either local or selected currency is non-USD
  const showUSDInDualMode = isDualCurrencyMode && (
    (originalQuote?.currency && originalQuote.currency !== "USD") ||
    (changedQuote?.currency && changedQuote.currency !== "USD")
  );
    
  const showMultipleColumns = isDualCurrencyMode || showUSDInSingleMode;
  const showUSDColumn = showUSDInSingleMode || showUSDInDualMode;
  
  // Calculate total columns for grid
  const totalDataColumns = isDualCurrencyMode 
    ? (2 + (showUSDInDualMode ? 1 : 0))  // Original + Changed + USD?
    : (1 + (showUSDInSingleMode ? 1 : 0)); // Currency + USD?

  const primaryQuote = isDualCurrencyMode ? originalQuote : quote;

  const textSizes = compact
    ? { title: "text-2xl", amount: "text-base", total: "text-xl" }
    : { title: "text-2xl", amount: "text-xl", total: "text-3xl" };

  const LoadingDots = () => (
    <span aria-hidden="true">
      <span className="inline-block animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
      <span className="inline-block animate-pulse" style={{ animationDelay: '150ms' }}>.</span>
      <span className="inline-block animate-pulse" style={{ animationDelay: '300ms' }}>.</span>
    </span>
  )

  const renderShimmerRow = (key: number) => {
    const gridCols = totalDataColumns === 3 ? "grid-cols-4" : totalDataColumns === 2 ? "grid-cols-3" : "grid-cols-2";
    const AmountSkeleton = () => (
      <span className={`font-bold ${textSizes.amount} text-slate-900 text-right w-full flex justify-end`}>
        <span className="h-4 bg-slate-200/70 rounded w-24 animate-pulse" />
      </span>
    )
    return (
      <div
        key={`shimmer-${key}`}
        className={`${compact ? "py-2 px-2" : "py-3 px-4"} bg-gray-50 ${
          showMultipleColumns
            ? `grid ${gridCols} ${compact ? "gap-2" : "gap-4"} items-center`
            : "flex justify-between items-center"
        }`}
      >
        <span className={`text-slate-600 font-medium text-base flex items-center`}>
          Loading extra benefits<LoadingDots />
        </span>
        {showMultipleColumns ? (
          <>
            <AmountSkeleton />
            <AmountSkeleton />
            {showUSDInDualMode && <AmountSkeleton />}
          </>
        ) : (
          <AmountSkeleton />
        )}
      </div>
    )
  }

  const renderCostRow = (
    label: string,
    primaryAmount: string | number,
    secondaryAmount?: string | number,
    thirdAmount?: string | number,
    isLoading = false
  ) => {
    const gridCols = totalDataColumns === 3 ? "grid-cols-4" : totalDataColumns === 2 ? "grid-cols-3" : "grid-cols-2";

    return (
      <div
        className={`${compact ? "py-2 px-2" : "py-3 px-4"} bg-gray-50 ${
          showMultipleColumns
            ? `grid ${gridCols} ${compact ? "gap-2" : "gap-4"} items-center`
            : "flex justify-between items-center"
        }`}
      >
        <span className={`text-slate-600 font-medium text-base`}>
          {label}
        </span>
        
        {/* Primary amount (always shown) */}
        <span className={`font-bold ${textSizes.amount} text-slate-900 text-right`}>
          {isLoading ? (
            <span className="text-blue-500 animate-pulse">Loading...</span>
          ) : typeof primaryAmount === "string" ? (
            primaryAmount
          ) : (
            formatCurrency(primaryAmount, primaryQuote?.currency || "")
          )}
        </span>

        {/* Secondary amount (dual mode: changed currency, single mode: USD) */}
        {showMultipleColumns && (
          <span className={`font-bold ${textSizes.amount} text-slate-700 text-right`}>
            {isLoading || (isDualCurrencyMode && isCalculatingSelected) ? (
              <span className="text-blue-500 animate-pulse">Loading...</span>
            ) : secondaryAmount !== undefined ? (
              typeof secondaryAmount === "string" ? (
                secondaryAmount
              ) : isDualCurrencyMode ? (
                formatCurrency(secondaryAmount, changedQuote?.currency || "")
              ) : (
                `${secondaryAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} USD`
              )
            ) : (
              <span className="text-slate-400">Pending...</span>
            )}
          </span>
        )}

        {/* Third amount (USD in dual mode when needed) */}
        {showUSDInDualMode && (
          <span className={`font-bold ${textSizes.amount} text-slate-600 text-right`}>
            {isConvertingToUSD ? (
              <span className="text-blue-500 animate-pulse">Converting...</span>
            ) : usdConversionError ? (
              <span className="text-red-400 text-sm">Failed</span>
            ) : thirdAmount !== undefined ? (
              typeof thirdAmount === "string" ? (
                thirdAmount
              ) : (
                `${thirdAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} USD`
              )
            ) : (
              <span className="text-slate-400">Pending...</span>
            )}
          </span>
        )}
      </div>
    );
  };

  if (!primaryQuote && !isDualCurrencyMode) {
    return (
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUSDCostAmount = (index: number) => {
    // Prefer per-line conversions when available
    const arr = (effectiveUsdConv as any)?.costs as number[] | undefined
    if (Array.isArray(arr) && typeof arr[index] === 'number') return arr[index]

    // Fallback: proportional distribution using totals
    const parseNum = (v?: string | number) => typeof v === 'number' ? v : Number.parseFloat((v || '0') as string)
    const localTotal = parseNum((originalQuote as any)?.total_costs)
    const lineLocal = originalQuote?.costs?.[index] ? parseNum(originalQuote.costs[index].amount) : 0
    if (localTotal > 0 && lineLocal > 0) {
      const usdTotal = provider === 'remote'
        ? (effectiveUsdConv as USDConversions['remote'])?.monthlyTotal
        : (effectiveUsdConv as USDConversions[keyof USDConversions])?.totalCosts
      if (usdTotal && usdTotal > 0) {
        return lineLocal * (usdTotal / localTotal)
      }
    }
    return undefined
  }

  const parseNumber = (v?: string | number) => {
    if (typeof v === 'number') return v;
    const n = Number.parseFloat(v || '0');
    return Number.isFinite(n) ? n : 0;
  }

  const computeDisplayTotal = (q?: Quote | null) => {
    if (!q) return undefined;
    const total = parseNumber(q.total_costs);
    if (provider === 'deel') {
      const fee = parseNumber(q.deel_fee);
      const accrual = parseNumber(q.severance_accural);
      return total - fee - accrual;
    }
    return total;
  }

  const hasMerged = typeof mergedTotalMonthly === 'number' && Number.isFinite(mergedTotalMonthly as number)
  const mergedTotal = hasMerged ? (mergedTotalMonthly as number) : undefined

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="grid grid-cols-3 items-center mb-6">
          <div className="flex justify-start">{theme.logo}</div>

          <div className="text-center">
            <h3 className={`${textSizes.title} font-bold text-slate-900`}>
              {title}
            </h3>
            {badgeText && (
              <span
                className={`inline-block px-3 py-1 ${badgeColor} text-sm font-semibold rounded-full mt-2`}
              >
                {badgeText}
              </span>
            )}
          </div>

          <div className="flex justify-end">
            {isDualCurrencyMode ? (
              isCalculatingSelected || isCalculatingLocal ? (
                <div className="flex items-center whitespace-nowrap text-blue-600 text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="flex items-center whitespace-nowrap text-green-600 text-sm">
                  <DollarSign className="mr-1 h-4 w-4" />
                  Dual currency
                </div>
              )
            ) : (
              showUSDColumn &&
              (isConvertingToUSD ? (
                <div className="flex items-center whitespace-nowrap text-blue-600 text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </div>
              ) : hasUSDData ? (
                <div className="flex items-center whitespace-nowrap text-green-600 text-sm">
                  <DollarSign className="mr-1 h-4 w-4" />
                  USD prices included
                </div>
              ) : usdConversionError ? (
                <div className="text-red-500 text-xs">
                  USD conversion failed
                </div>
              ) : null)
            )}
          </div>
        </div>

        <div className="space-y-4">
          {showMultipleColumns && (
            <div
              className={`grid ${
                totalDataColumns === 3 ? "grid-cols-4" : "grid-cols-3"
              } ${
                compact ? "gap-2 py-1 px-2" : "gap-4 py-2 px-4"
              } bg-slate-100 border-b border-slate-200`}
            >
              <span className="text-slate-700 font-semibold text-sm">
                Cost Item
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {isDualCurrencyMode ? (
                  compact
                    ? `${originalQuote?.currency || originalCurrency || "Local"}`
                    : `Local (${originalQuote?.currency || originalCurrency || "Local"})`
                ) : (
                  compact
                    ? `${quote?.currency || "Currency"}`
                    : `Local Currency`
                )}
              </span>
              <span className="text-slate-700 font-semibold text-sm text-right">
                {isDualCurrencyMode ? (
                  compact
                    ? `${changedQuote?.currency || selectedCurrency || "Changed"}`
                    : `Selected (${changedQuote?.currency || selectedCurrency || "Changed"})`
                ) : (
                  compact ? "USD" : "USD Equivalent"
                )}
              </span>
              {showUSDInDualMode && (
                <span className="text-slate-700 font-semibold text-sm text-right">
                  {compact ? "USD" : "USD Equivalent"}
                </span>
              )}
            </div>
          )}

          {primaryQuote &&
            renderCostRow(
              "Base Salary",
              Number.parseFloat(primaryQuote.salary), // Primary: original currency amount
              isDualCurrencyMode 
                ? (changedQuote ? Number.parseFloat(changedQuote.salary) : undefined) // Secondary: changed currency in dual mode
                : (showUSDInSingleMode 
                    ? (provider === 'remote' 
                        ? (usdConversions as USDConversions["remote"])?.monthlySalary 
                        : (usdConversions as USDConversions["deel"])?.salary)
                    : undefined), // Secondary: USD in single mode
              showUSDInDualMode 
                ? (provider === 'remote' 
                    ? (usdConversions as USDConversions["remote"])?.monthlySalary 
                    : (usdConversions as USDConversions[keyof USDConversions])?.salary)
                : undefined, // Third: USD in dual mode
              isCalculatingSelected || isCalculatingLocal
            )}

          {/* Platform/management fees are excluded from display */}

  {originalQuote?.costs?.map((cost, index) => {
            const primaryAmount = Number.parseFloat(cost.amount);
            const changedAmount = isDualCurrencyMode && changedQuote?.costs?.[index] 
              ? Number.parseFloat(changedQuote.costs[index].amount) 
              : undefined;
            const usdAmount = getUSDCostAmount(index);
            const rawName = String(cost.name || '').trim();
            const needsRecalcToken = /##RECALC##/i.test(rawName);
            const needsRecalcList = Array.isArray(recalcBaseItems) && recalcBaseItems.includes(rawName);
            const needsRecalc = needsRecalcToken || needsRecalcList;
            const cleanName = rawName.replace(/##RECALC##/gi, '').trim();
            const labelNode = (
              <span className="inline-flex items-center gap-1">
                <span>{cleanName}</span>
                {needsRecalc && <Calculator className="h-4 w-4 text-red-500" />}
              </span>
            );

            return (
              <div key={index}>
                {renderCostRow(
                  labelNode,
                  primaryAmount, // Primary: original currency amount
                  isDualCurrencyMode 
                    ? changedAmount // Secondary: changed currency in dual mode
                    : (showUSDInSingleMode ? usdAmount : undefined), // Secondary: USD in single mode
                  showUSDInDualMode ? usdAmount : undefined, // Third: USD in dual mode
                  isCalculatingSelected || isCalculatingLocal
                )}
              </div>
            );
  }) || []}

          {/* Shimmer placeholders for pending enhanced extras */}
          {enhancementPending && shimmerExtrasCount > 0 && (
            <>
              {Array.from({ length: shimmerExtrasCount }).map((_, idx) => renderShimmerRow(idx))}
            </>
          )}

          <Separator className="my-4" />

          <div className={`bg-gradient-to-r ${theme.gradientFrom} ${theme.gradientTo} p-4 border-2 border-primary/20`}>
            {showMultipleColumns ? (
              <div
                className={`grid ${
                  totalDataColumns === 3 ? "grid-cols-4" : "grid-cols-3"
                } ${
                  compact ? "gap-2" : "gap-4"
                } items-center`}
              >
                <span
                  className={`${
                    compact ? "text-base" : "text-xl"
                  } font-bold text-slate-900`}
                >
                  Total Monthly Cost
                </span>
                
                {/* Primary total */}
                <span
                  className={`${theme.brandColor} ${textSizes.total} font-bold text-right`}
                >
                  {isCalculatingLocal ? (
                    <span className="text-blue-500 animate-pulse">Loading...</span>
                  ) : hasMerged && mergedTotal !== undefined ? (
                    formatCurrency(mergedTotal, mergedCurrency || primaryQuote?.currency || '')
                  ) : primaryQuote ? (
                    (() => {
                      const val = computeDisplayTotal(primaryQuote)
                      return formatCurrency(val || 0, primaryQuote.currency)
                    })()
                  ) : (
                    <span className="text-slate-400">Pending...</span>
                  )}
                </span>

                {/* Secondary total (changed in dual mode, USD in single mode) */}
                <span
                  className={`text-slate-700 ${
                    compact ? "text-base" : "text-2xl"
                  } font-semibold text-right`}
                >
                  {isDualCurrencyMode ? (
                    isCalculatingSelected ? (
                      <span className="text-blue-500 animate-pulse">Loading...</span>
                    ) : changedQuote ? (
                      (() => {
                        const val = computeDisplayTotal(changedQuote)
                        return formatCurrency(val || 0, changedQuote.currency)
                      })()
                    ) : (
                      <span className="text-slate-400">Pending...</span>
                    )
                  ) : (
                    (() => {
                      const usdTotal = provider === 'remote'
                        ? (usdConversions as USDConversions["remote"])?.monthlyTotal
                        : (usdConversions as USDConversions[keyof USDConversions])?.totalCosts;
                      return usdTotal !== undefined
                        ? `${usdTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : isConvertingToUSD
                          ? <span className="text-blue-500 animate-pulse">Converting...</span>
                          : usdConversionError
                            ? <span className="text-red-400">Failed</span>
                            : <span className="text-slate-400">Pending...</span>;
                    })()
                  )}
                </span>

                {/* Third total (USD in dual mode when needed) */}
                {showUSDInDualMode && (
                  <span
                    className={`text-slate-600 ${
                      compact ? "text-base" : "text-2xl"
                    } font-semibold text-right`}
                  >
                    {(() => {
                      const usdTotal = provider === 'remote'
                        ? (usdConversions as USDConversions["remote"])?.monthlyTotal
                        : (usdConversions as USDConversions[keyof USDConversions])?.totalCosts;
                      return usdTotal !== undefined
                        ? `${usdTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                        : isConvertingToUSD
                          ? <span className="text-blue-500 animate-pulse">Converting...</span>
                          : usdConversionError
                            ? <span className="text-red-400">Failed</span>
                            : <span className="text-slate-400">Pending...</span>;
                    })()}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span
                  className={`${
                    compact ? "text-base" : "text-xl"
                  } font-bold text-slate-900`}
                >
                  Total Monthly Cost
                </span>
                <span className={`${theme.brandColor} ${textSizes.total} font-bold`}>
                  {hasMerged && mergedTotal !== undefined
                    ? formatCurrency(mergedTotal, mergedCurrency || primaryQuote?.currency || '')
                    : (primaryQuote
                      ? (() => {
                          const val = computeDisplayTotal(primaryQuote)
                          return formatCurrency(val || 0, primaryQuote.currency)
                        })()
                      : (<span className="text-slate-400">Pending...</span>)
                    )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Benefits block removed; extras are injected inline into rows */}
      </CardContent>
    </Card>
  );
});

GenericQuoteCard.displayName = "GenericQuoteCard";
