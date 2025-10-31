import { ProviderType } from "@/lib/types/enhancement"

export type ReconciliationCurrency = string

export interface ReconciliationSettings {
  currency: ReconciliationCurrency
  threshold: number // e.g., 0.04 for 4%
  riskMode: boolean
}

export interface ReconciliationProviderInput {
  provider: ProviderType
  // Totals (normalized to `settings.currency`)
  normalizedMonthlyTotal: number
  // Original totals + currency (for transparency)
  originalMonthlyTotal: number
  originalCurrency: string
  // Confidence and coverage (from enhancement)
  confidence: number
  coverage: {
    includes: string[]
    missing: string[]
    doubleCountingRisk: string[]
  }
  quoteType: 'all-inclusive' | 'statutory-only'
}

export interface ReconciliationInput {
  settings: ReconciliationSettings
  providers: ReconciliationProviderInput[]
}

export interface ReconciliationItemResult {
  provider: ProviderType
  total: number
  delta: number
  pct: number
  within4: boolean
  confidence: number
  notes: string[]
  // Optional secondary view
  riskAdjustedTotal?: number
}

export interface ReconciliationSummary {
  currency: ReconciliationCurrency
  cheapest: ProviderType | 'none'
  mostExpensive: ProviderType | 'none'
  average: number
  median: number
  stdDev: number
  within4Count: number
}

export interface ReconciliationExcluded {
  provider: ProviderType
  reason: string
}

export interface ReconciliationResult {
  items: ReconciliationItemResult[]
  summary: ReconciliationSummary
  recommendations: string[]
  excluded: ReconciliationExcluded[]
  metadata: {
    threshold: number
    riskMode: boolean
    currency: ReconciliationCurrency
    generatedAt: string
    engine: 'local+llm' | 'local-only'
  }
}

// LLM response shape (must be validated & reconciled with local compute)
export interface ReconciliationLLMResponse {
  version?: string
  params?: { currency?: string; threshold?: number; riskMode?: boolean }
  items: Array<{
    provider: ProviderType
    total: number
    delta: number
    pct: number
    within4: boolean
    confidence?: number
    notes?: string[]
  }>
  summary?: Partial<ReconciliationSummary>
  recommendations?: string[]
  excluded?: Array<{ provider: ProviderType; reason: string }>
}

