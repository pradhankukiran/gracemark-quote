import { NextRequest, NextResponse } from 'next/server'
import { CerebrasService } from '@/lib/services/llm/CerebrasService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, country, currency, costItems } = body

    if (!provider || !country || !currency || !Array.isArray(costItems)) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, country, currency, costItems' },
        { status: 400 }
      )
    }

    if (costItems.length === 0) {
      return NextResponse.json({
        baseSalary: {},
        statutoryMandatory: {},
        allowancesBenefits: {},
        terminationCosts: {},
        oneTimeFees: {}
      });
    }

    // Use CerebrasService to categorize costs
    console.log('[categorize-costs API] Starting categorization', {
      provider,
      country,
      currency,
      itemCount: costItems.length
    })

    const categorizedData = await CerebrasService.getInstance().categorizeCostItems({
      provider,
      country,
      currency,
      costItems
    })

    console.log('[categorize-costs API] Categorization complete')
    return NextResponse.json(categorizedData)
  } catch (error) {
    console.error('[categorize-costs API] Error:', error)
    console.error('[categorize-costs API] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Failed to categorize costs',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
