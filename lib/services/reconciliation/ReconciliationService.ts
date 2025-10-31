import { ProviderType, EnhancedQuote } from "@/lib/types/enhancement"
import {
  ReconciliationInput,
  ReconciliationProviderInput,
  ReconciliationSettings,
  ReconciliationItemResult,
  ReconciliationResult,
  ReconciliationLLMResponse,
  ReconciliationSummary,
  ReconciliationExcluded,
} from "@/lib/types/reconciliation"
import { GroqService } from "@/lib/services/llm/GroqService"
import { 
  round2, 
  round4, 
  mean, 
  median, 
  stdDev, 
  argMin, 
  argMax, 
  clamp01, 
  hasCriticalMissing, 
  buildNotes 
} from "@/lib/shared/utils/reconciliationUtils"

type CurrencyConverter = (amount: number, from: string, to: string) => Promise<number> | number

export class ReconciliationService {
  private static instance: ReconciliationService
  private groq: GroqService

  private constructor(groq?: GroqService) {
    this.groq = groq || GroqService.getInstance()
  }

  static getInstance(): ReconciliationService {
    if (!ReconciliationService.instance) {
      ReconciliationService.instance = new ReconciliationService()
    }
    return ReconciliationService.instance
  }

  // Build ReconciliationInput from EnhancedQuote map and converter
  async buildInputFromEnhancements(params: {
    enhancements: Record<ProviderType, EnhancedQuote>
    targetCurrency: string
    threshold?: number
    riskMode?: boolean
    converter: CurrencyConverter
  }): Promise<ReconciliationInput> {
    const { enhancements, targetCurrency, converter } = params
    const threshold = params.threshold ?? 0.04
    const riskMode = params.riskMode ?? false

    const providers: ReconciliationProviderInput[] = []
    for (const provider of Object.keys(enhancements) as ProviderType[]) {
      const enh = enhancements[provider]
      if (!enh?.monthlyCostBreakdown?.total) continue
      const originalMonthly = enh.monthlyCostBreakdown.total
      const sourceCurrency = (enh.displayCurrency || enh.baseCurrency || enh.baseQuote.currency)
      const normalized = await converter(originalMonthly, sourceCurrency, targetCurrency)
      providers.push({
        provider,
        normalizedMonthlyTotal: Number(normalized || 0),
        originalMonthlyTotal: originalMonthly,
        originalCurrency: sourceCurrency,
        confidence: enh.overallConfidence ?? 0.5,
        coverage: {
          includes: enh.overlapAnalysis?.providerIncludes || [],
          missing: enh.overlapAnalysis?.providerMissing || [],
          doubleCountingRisk: enh.overlapAnalysis?.doubleCountingRisk || []
        },
        quoteType: enh.quoteType
      })
    }

    return {
      settings: { currency: targetCurrency, threshold, riskMode },
      providers
    }
  }

  // Local deterministic computation
  computeLocal(input: ReconciliationInput): {
    items: ReconciliationItemResult[]
    summary: ReconciliationSummary
    excluded: ReconciliationExcluded[]
  } {
    const { providers, settings } = input
    const valid = providers.filter(p => Number.isFinite(p.normalizedMonthlyTotal))
    const excluded: ReconciliationExcluded[] = []

    if (valid.length === 0) {
      return {
        items: [],
        summary: {
          currency: settings.currency,
          cheapest: 'none',
          mostExpensive: 'none',
          average: 0,
          median: 0,
          stdDev: 0,
          within4Count: 0
        },
        excluded
      }
    }

    const totals = valid.map(v => v.normalizedMonthlyTotal)
    const min = Math.min(...totals)
    const items: ReconciliationItemResult[] = valid.map(v => {
      const total = round2(v.normalizedMonthlyTotal)
      const delta = round2(total - min)
      const pct = min > 0 ? round4(delta / min) : 0
      const within4 = pct <= settings.threshold && !hasCriticalMissing(v.coverage.missing)
      return {
        provider: v.provider,
        total,
        delta,
        pct,
        within4,
        confidence: clamp01(v.confidence ?? 0.5),
        notes: buildNotes(v.coverage)
      }
    })

    // Risk-adjusted view: compute but do not change raw ranking
    if (settings.riskMode) {
      for (const it of items) {
        const penalty = clamp01((1 - it.confidence) * 0.10)
        it.riskAdjustedTotal = round2(it.total * (1 + penalty))
      }
    }

    // Summary stats
    const cheapestIdx = argMin(items.map(i => i.total))
    const mostExpIdx = argMax(items.map(i => i.total))
    const avg = mean(items.map(i => i.total))
    const med = median(items.map(i => i.total))
    const sd = stdDev(items.map(i => i.total))
    const within4Count = items.filter(i => i.within4).length

    const summary: ReconciliationSummary = {
      currency: settings.currency,
      cheapest: cheapestIdx >= 0 ? items[cheapestIdx].provider : 'none',
      mostExpensive: mostExpIdx >= 0 ? items[mostExpIdx].provider : 'none',
      average: round2(avg),
      median: round2(med),
      stdDev: round2(sd),
      within4Count
    }

    return { items, summary, excluded }
  }

  // LLM-assisted reconcile with local validation
  async reconcile(input: ReconciliationInput): Promise<ReconciliationResult> {
    const local = this.computeLocal(input)
    let llm: ReconciliationLLMResponse | null = null
    try {
      // Prepare LLM payload (only normalized totals; no currencies to convert)
      const payload = {
        settings: {
          currency: input.settings.currency,
          threshold: input.settings.threshold,
          riskMode: input.settings.riskMode,
        },
        providers: input.providers.map(p => ({
          provider: p.provider,
          total: round2(p.normalizedMonthlyTotal),
          confidence: clamp01(p.confidence ?? 0.5),
          coverage: p.coverage,
          quoteType: p.quoteType
        }))
      }
      const raw = await this.groq.reconcile(payload)
      llm = raw as ReconciliationLLMResponse
    } catch {
      // LLM failed; continue with local-only
      llm = null
    }

    const merged = this.mergeWithLocal(local, llm, input.settings)
    return merged
  }

  private mergeWithLocal(local: ReturnType<ReconciliationService['computeLocal']>, llm: ReconciliationLLMResponse | null, settings: ReconciliationSettings): ReconciliationResult {
    const now = new Date().toISOString()
    const itemsMap = new Map(local.items.map(i => [i.provider, i]))

    let items: ReconciliationItemResult[] = local.items
    let recommendations: string[] = []
    let excluded: ReconciliationExcluded[] = local.excluded

    if (llm?.items?.length) {
      // Validate llm items; replace numeric fields with local if mismatch exceeds tolerance
      const tolAmount = 0.01
      const tolPct = 0.001
      items = llm.items.map(li => {
        const base = itemsMap.get(li.provider)
        if (!base) return {
          provider: li.provider,
          total: round2(li.total),
          delta: round2(li.delta),
          pct: round4(li.pct),
          within4: !!li.within4,
          confidence: clamp01(li.confidence ?? 0.5),
          notes: li.notes || []
        }
        const total = Math.abs(li.total - base.total) <= tolAmount ? base.total : base.total
        const delta = Math.abs(li.delta - base.delta) <= tolAmount ? base.delta : base.delta
        const pct = Math.abs(li.pct - base.pct) <= tolPct ? base.pct : base.pct
        const within4 = li.within4 === base.within4 ? base.within4 : base.within4
        return {
          provider: base.provider,
          total,
          delta,
          pct,
          within4,
          confidence: base.confidence,
          notes: uniqueNotes([...(base.notes || []), ...((li.notes || []))])
        }
      })
      if (Array.isArray(llm.recommendations)) recommendations = llm.recommendations
      if (Array.isArray(llm.excluded)) {
        // Merge excluded (LLM may flag missing data); prefer local if duplicates
        const mergedEx: ReconciliationExcluded[] = [...excluded]
        for (const ex of llm.excluded) {
          if (!mergedEx.find(e => e.provider === ex.provider)) mergedEx.push(ex)
        }
        excluded = mergedEx
      }
    }

    // Recompute summary from final items (local truth)
    const cheapestIdx = argMin(items.map(i => i.total))
    const mostExpIdx = argMax(items.map(i => i.total))
    const avg = mean(items.map(i => i.total))
    const med = median(items.map(i => i.total))
    const sd = stdDev(items.map(i => i.total))
    const within4Count = items.filter(i => i.within4).length

    const summary: ReconciliationSummary = {
      currency: settings.currency,
      cheapest: cheapestIdx >= 0 ? items[cheapestIdx].provider : 'none',
      mostExpensive: mostExpIdx >= 0 ? items[mostExpIdx].provider : 'none',
      average: round2(avg),
      median: round2(med),
      stdDev: round2(sd),
      within4Count
    }

    return {
      items,
      summary,
      recommendations,
      excluded,
      metadata: {
        threshold: settings.threshold,
        riskMode: settings.riskMode,
        currency: settings.currency,
        generatedAt: now,
        engine: llm ? 'local+llm' : 'local-only'
      }
    }
  }
}

// Helper function for merging notes
function uniqueNotes(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of arr) { const k=(n||'').trim(); if (!k) continue; if (!seen.has(k)) { seen.add(k); out.push(k) } }
  return out
}
