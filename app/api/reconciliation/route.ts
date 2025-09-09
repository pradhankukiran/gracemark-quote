import { NextRequest, NextResponse } from 'next/server'
import { ReconciliationService } from '@/lib/services/reconciliation/ReconciliationService'
import type { ReconciliationResult } from '@/lib/types/reconciliation'
import { convertCurrencyServerSide } from '@/lib/shared/utils/currencyAdapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      enhancements, 
      targetCurrency, 
      threshold, 
      riskMode, 
      useLLM 
    } = body

    if (!enhancements || !targetCurrency) {
      return NextResponse.json(
        { error: 'Missing required parameters' }, 
        { status: 400 }
      )
    }

    const reconService = ReconciliationService.getInstance()
    
    // Build input from enhancements
    const input = await reconService.buildInputFromEnhancements({
      enhancements,
      targetCurrency,
      threshold: threshold ?? 0.04,
      riskMode: riskMode ?? false,
      converter: convertCurrencyServerSide
    })

    let result: ReconciliationResult

    // Choose between LLM-enhanced or local-only reconciliation
    if (useLLM) {
      result = await reconService.reconcile(input)
    } else {
      const localResult = reconService.computeLocal(input)
      result = {
        ...localResult,
        recommendations: [],
        metadata: {
          threshold: threshold ?? 0.04,
          riskMode: riskMode ?? false,
          currency: targetCurrency,
          generatedAt: new Date().toISOString(),
          engine: 'local-only'
        }
      }
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Reconciliation API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reconciliation failed' },
      { status: 500 }
    )
  }
}