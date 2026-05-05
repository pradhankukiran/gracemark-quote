'use server'

import { CerebrasService } from '@/lib/services/llm/CerebrasService'

export interface CategorizeCostsInput {
  provider: string
  country: string
  currency: string
  costItems: Array<{ key: string; name: string; monthly_amount: number }>
}

export interface CategorizeCostsResult {
  baseSalary: Record<string, number>
  statutoryMandatory: Record<string, number>
  allowancesBenefits: Record<string, number>
  terminationCosts: Record<string, number>
  oneTimeFees: Record<string, number>
}

export async function categorizeCostsAction(
  input: CategorizeCostsInput
): Promise<CategorizeCostsResult> {
  const { provider, country, currency, costItems } = input || ({} as CategorizeCostsInput)

  if (!provider || !country || !currency || !Array.isArray(costItems)) {
    throw new Error('Missing required fields: provider, country, currency, costItems')
  }

  if (costItems.length === 0) {
    return {
      baseSalary: {},
      statutoryMandatory: {},
      allowancesBenefits: {},
      terminationCosts: {},
      oneTimeFees: {},
    }
  }

  try {
    console.log('[categorize-costs action] Starting categorization', {
      provider,
      country,
      currency,
      itemCount: costItems.length,
    })

    const categorizedData = await CerebrasService.getInstance().categorizeCostItems({
      provider,
      country,
      currency,
      costItems,
    })

    console.log('[categorize-costs action] Categorization complete')
    return categorizedData
  } catch (error) {
    console.error('[categorize-costs action] Error:', error)
    console.error(
      '[categorize-costs action] Error stack:',
      error instanceof Error ? error.stack : 'No stack'
    )
    if (error instanceof Error) throw error
    throw new Error(`Failed to categorize costs: ${String(error)}`)
  }
}
