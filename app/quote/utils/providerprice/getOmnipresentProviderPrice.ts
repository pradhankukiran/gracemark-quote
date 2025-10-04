import { EnhancedQuote } from "@/lib/types/enhancement"
import { safeNumber } from "@/lib/shared/utils/formatUtils"
import { pickPositive, computeEnhancementAddOns } from "./sharedUtils"

export function getOmnipresentProviderPrice(
  rawQuote: unknown,
  enhancement: EnhancedQuote | undefined,
  contractMonths: number
): number | null {
  // If no enhancement, extract base total from raw quote
  if (!enhancement) {
    const baseTotal = pickPositive(
      (rawQuote as any)?.total_costs,
      (rawQuote as any)?.totalCosts,
      (rawQuote as any)?.total
    )
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
      computeEnhancementAddOns('omnipresent', enhancement, contractMonths)
    )
  )

  return baseComponent + enhancementComponent
}
