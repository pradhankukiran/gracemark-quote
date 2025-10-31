import { EnhancedQuote } from "@/lib/types/enhancement"
import { RemoteAPIResponse } from "@/lib/shared/types"
import { safeNumber } from "@/lib/shared/utils/formatUtils"
import { transformRemoteResponseToQuote } from "@/lib/shared/utils/apiUtils"
import { pickPositive, computeEnhancementAddOns } from "./sharedUtils"

export function getRemoteProviderPrice(
  rawQuote: unknown,
  enhancement: EnhancedQuote | undefined,
  contractMonths: number
): number | null {
  // If no enhancement, extract base total from raw quote
  if (!enhancement) {
    let baseTotal: number | null = null

    if ((rawQuote as RemoteAPIResponse)?.employment?.employer_currency_costs) {
      const displayQuote = transformRemoteResponseToQuote(rawQuote as RemoteAPIResponse)
      baseTotal = pickPositive(displayQuote?.total_costs)
    } else {
      baseTotal = pickPositive(
        (rawQuote as any)?.monthly_total,
        (rawQuote as any)?.total,
        (rawQuote as any)?.total_costs,
        (rawQuote as any)?.totalCosts
      )
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
      computeEnhancementAddOns('remote', enhancement, contractMonths)
    )
  )

  return baseComponent + enhancementComponent
}
