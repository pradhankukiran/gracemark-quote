import { EnhancedQuote } from "@/lib/types/enhancement"
import { OysterQuote } from "@/lib/shared/types"
import { safeNumber } from "@/lib/shared/utils/formatUtils"
import { transformOysterQuoteToDisplayQuote } from "@/lib/shared/utils/apiUtils"
import { pickPositive, computeEnhancementAddOns, baseQuoteContainsPattern, resolveEnhancementMonthly } from "./sharedUtils"

export function getOysterProviderPrice(
  rawQuote: unknown,
  enhancement: EnhancedQuote | undefined,
  contractMonths: number
): number | null {
  // If no enhancement, extract base total from raw quote
  if (!enhancement) {
    let baseTotal: number | null = pickPositive((rawQuote as any)?.total)

    if (baseTotal === null) {
      const displayQuote = transformOysterQuoteToDisplayQuote(rawQuote as OysterQuote)
      baseTotal = pickPositive(displayQuote?.total_costs)
    }

    return baseTotal !== null && baseTotal > 0 ? baseTotal : null
  }

  // Use the base from enhancement (same value used in enhancement calculation)
  const baseComponent = safeNumber(
    enhancement.monthlyCostBreakdown?.baseCost,
    enhancement.baseQuote?.monthlyTotal ?? 0
  )

  const enhancementComponent = safeNumber(
    enhancement.monthlyCostBreakdown?.enhancements,
    safeNumber(
      enhancement.totalEnhancement,
      computeEnhancementAddOns('oyster', enhancement, contractMonths)
    )
  )

  return baseComponent + enhancementComponent
}
