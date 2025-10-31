import { EnhancedQuote } from "@/lib/types/enhancement"
import { RivermateQuote } from "@/lib/shared/types"
import { safeNumber } from "@/lib/shared/utils/formatUtils"
import { transformRivermateQuoteToDisplayQuote } from "@/lib/shared/utils/apiUtils"
import { pickPositive, parseNumericValue, computeEnhancementAddOns } from "./sharedUtils"

export function getRivermateProviderPrice(
  rawQuote: unknown,
  enhancement: EnhancedQuote | undefined,
  contractMonths: number
): number | null {
  // If no enhancement, extract base total from raw quote
  if (!enhancement) {
    const rq = rawQuote as RivermateQuote
    let baseTotal: number | null = pickPositive(rq?.total)

    if (baseTotal === null) {
      // Manual calculation: salary + tax items + accruals
      const salary = parseNumericValue(rq?.salary) ?? 0
      const taxSum = (rq?.taxItems || []).reduce((sum, item) => {
        const amount = parseNumericValue(item?.amount)
        return sum + (amount ?? 0)
      }, 0)
      const accruals = parseNumericValue(rq?.accrualsProvision) ?? 0
      const combined = salary + taxSum + accruals

      if (combined > 0) {
        baseTotal = combined
      } else {
        // Fallback to transformed quote
        const displayQuote = transformRivermateQuoteToDisplayQuote(rq)
        baseTotal = pickPositive(displayQuote?.total_costs)
      }
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
      computeEnhancementAddOns('rivermate', enhancement, contractMonths)
    )
  )

  return baseComponent + enhancementComponent
}
