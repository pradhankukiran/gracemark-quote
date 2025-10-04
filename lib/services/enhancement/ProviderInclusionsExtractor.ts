import {
  ProviderType,
  StandardizedBenefitData,
  RemoteAPIResponse,
  RivermateAPIResponse,
  OysterAPIResponse,
  GenericProviderResponse
} from "@/lib/types/enhancement"
import { identifyBenefitKey, normalizeBenefitAmount } from "@/lib/shared/utils/benefitNormalization"

interface NormalizedQuoteLike {
  provider: string
  baseCost: number
  currency: string
  country: string
  monthlyTotal: number
  breakdown?: Record<string, number | string | undefined>
  originalResponse: RemoteAPIResponse | RivermateAPIResponse | OysterAPIResponse | GenericProviderResponse
}

type BenefitsMap = StandardizedBenefitData["includedBenefits"]

type Extractor = (quote: NormalizedQuoteLike, included: BenefitsMap, referenceMonthly: number) => void

const nowIso = () => new Date().toISOString()

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "")
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const sanitizeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

const addBenefit = (map: BenefitsMap, key: string, amount: number, frequency: "monthly" | "yearly" = "monthly", description?: string) => {
  if (amount <= 0) return
  const normalizedKey = key as keyof BenefitsMap
  if (!map[normalizedKey]) {
    // @ts-expect-error runtime key assignment guarded by identifyBenefitKey where possible
    map[normalizedKey] = { amount: 0, frequency, description }
  }
  const current = map[normalizedKey]
  const existing = toNumber(current?.amount || 0)
  // @ts-expect-error dynamic assignment to standardized benefit map
  map[normalizedKey].amount = existing + amount
  if (description && !map[normalizedKey]?.description) {
    // @ts-expect-error dynamic assignment to standardized benefit map
    map[normalizedKey].description = description
  }
}

const addBenefitWithNormalization = (included: BenefitsMap, referenceMonthly: number, name: string, amount: number, opts: { frequency?: "monthly" | "yearly"; rawKey?: string } = {}) => {
  const { frequency = "monthly", rawKey } = opts
  if (amount <= 0) return
  const benefitKey = identifyBenefitKey(name)
  const normalized = normalizeBenefitAmount(amount, {
    benefitKey,
    rawName: name,
    frequency,
    referenceMonthly
  })
  if (normalized <= 0) return
  const key = benefitKey ? benefitKey : (rawKey ? sanitizeKey(rawKey) : sanitizeKey(name))
  addBenefit(included, key, normalized, "monthly", name)
}

const extractAccrualItems = (source: unknown, included: BenefitsMap, referenceMonthly: number) => {
  if (!source || typeof source !== "object") return
  const accruals = (source as Record<string, unknown>)?.accruals
  if (!accruals || typeof accruals !== "object") return
  const items = (accruals as Record<string, unknown>)?.items as Record<string, unknown> | undefined
  if (!items || typeof items !== "object") return

  const monthlyFields = [
    "monthly_provision",
    "monthlyProvision",
    "monthly_amount",
    "monthlyAmount",
    "employer_monthly",
    "employee_monthly",
    "employerContribution",
    "employer_contribution"
  ]
  const annualFields = ["annual_amount", "annualAmount", "yearly_amount", "yearlyAmount"]

  Object.entries(items).forEach(([rawKey, rawValue]) => {
    if (!rawValue || typeof rawValue !== "object") return
    const entry = rawValue as Record<string, unknown>
    const displayName = typeof entry.name === "string" && entry.name.trim() ? entry.name : rawKey
    const benefitKey = identifyBenefitKey(displayName) || identifyBenefitKey(rawKey.replace(/_/g, " "))

    let monthlyProvision = 0
    for (const field of monthlyFields) {
      if (field in entry) {
        monthlyProvision = toNumber(entry[field])
        if (monthlyProvision > 0) break
      }
    }

    let annualProvision = 0
    for (const field of annualFields) {
      if (field in entry) {
        annualProvision = toNumber(entry[field])
        if (annualProvision > 0) break
      }
    }

    let normalized = normalizeBenefitAmount(monthlyProvision, {
      benefitKey,
      rawName: displayName,
      referenceMonthly
    })

    if (normalized <= 0 && annualProvision > 0) {
      normalized = normalizeBenefitAmount(annualProvision, {
        benefitKey,
        rawName: displayName,
        referenceMonthly
      })
    }

    if (normalized <= 0) return
    const key = benefitKey ? benefitKey : sanitizeKey(rawKey)
    addBenefit(included, key, normalized, "monthly", displayName)
  })
}

const extractRemote: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as RemoteAPIResponse
  const costs = original?.employment?.employer_currency_costs
  if (costs) {
    if (typeof costs.monthly_contributions_total === "number" && costs.monthly_contributions_total > 0) {
      addBenefitWithNormalization(included, referenceMonthly, "Employer statutory contributions", costs.monthly_contributions_total, { rawKey: "socialSecurity" })
    }

    const benefitsBreakdown = Array.isArray(costs.monthly_benefits_breakdown) ? costs.monthly_benefits_breakdown : []
    benefitsBreakdown.forEach(item => {
      if (!item) return
      const amount = toNumber((item as any).amount)
      const name = ((item as any).name || "Provider benefit") as string
      addBenefitWithNormalization(included, referenceMonthly, name, amount)
    })

    const contributionBreakdown = Array.isArray(costs.monthly_contributions_breakdown) ? costs.monthly_contributions_breakdown : []
    contributionBreakdown.forEach(item => {
      if (!item) return
      const amount = toNumber((item as any).amount)
      const name = ((item as any).name || "Employer contribution") as string
      addBenefitWithNormalization(included, referenceMonthly, name, amount, { rawKey: "socialSecurity" })
    })
  }

  if (typeof original?.contributions === "number" && original.contributions > 0) {
    addBenefitWithNormalization(included, referenceMonthly, "Employer statutory contributions", original.contributions, { rawKey: "socialSecurity" })
  }

  extractAccrualItems(original, included, referenceMonthly)
  extractAccrualItems((original as any)?.employment, included, referenceMonthly)
}

const extractRivermate: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as RivermateAPIResponse
  const taxItems = Array.isArray(original?.taxItems) ? original.taxItems : []
  taxItems.forEach(item => {
    if (!item) return
    const name = (item as any).name as string
    const amount = toNumber((item as any).amount)
    addBenefitWithNormalization(included, referenceMonthly, name || "Employer contribution", amount)
  })

  extractAccrualItems(original, included, referenceMonthly)
}

const extractOyster: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as OysterAPIResponse
  const calculations = (original as any)?.data?.bulkSalaryCalculations
  if (!Array.isArray(calculations)) return

  calculations.forEach(calc => {
    if (!calc || typeof calc !== "object") return
    const employerContribs = (calc as any)?.taxes?.employer?.contributions
    if (Array.isArray(employerContribs)) {
      employerContribs.forEach((contribution: any) => {
        const name = (contribution?.name || contribution?.group || "Employer contribution") as string
        const amount = toNumber(contribution?.amount)
        addBenefitWithNormalization(included, referenceMonthly, name, amount, { rawKey: contribution?.group })
      })
    }

    const employerTotals = (calc as any)?.totals
    if (employerTotals && typeof employerTotals === "object") {
      const amount = toNumber((employerTotals as any).employerCosts)
      if (amount > 0) {
        addBenefitWithNormalization(included, referenceMonthly, "Employer statutory contributions", amount, { rawKey: "socialSecurity" })
      }
    }
  })

  extractAccrualItems(original, included, referenceMonthly)
}

const extractRippling: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as GenericProviderResponse & { costs?: Array<Record<string, unknown>> }
  const costs = Array.isArray(original?.costs) ? original.costs : []
  costs.forEach(cost => {
    const name = (cost?.title || cost?.name || "Cost item") as string
    const monthly = toNumber(cost?.monthly_value ?? cost?.monthlyValue ?? cost?.amount)
    const yearly = toNumber(cost?.yearly_value ?? cost?.yearlyValue)
    const amount = monthly > 0 ? monthly : yearly
    const frequency: "monthly" | "yearly" = monthly > 0 ? "monthly" : "yearly"
    addBenefitWithNormalization(included, referenceMonthly, name, amount, { frequency, rawKey: name })
  })

  extractAccrualItems(original, included, referenceMonthly)
}

const extractSkuad: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as GenericProviderResponse
  const monthly = (original as any)?.data?.monthly
  if (monthly && typeof monthly === "object") {
    const taxBreakdown = Array.isArray(monthly.employerEstTaxBreakup) ? monthly.employerEstTaxBreakup : []
    taxBreakdown.forEach((entry: any) => {
      if (!Array.isArray(entry)) return
      const [label, amount] = entry
      addBenefitWithNormalization(included, referenceMonthly, String(label), toNumber(amount), { rawKey: label })
    })

    const accrualBreakdown = Array.isArray(monthly.employerMandatoryAccrualsEstCostBreakup) ? monthly.employerMandatoryAccrualsEstCostBreakup : []
    accrualBreakdown.forEach((entry: any) => {
      if (!Array.isArray(entry)) return
      const [label, amount] = entry
      addBenefitWithNormalization(included, referenceMonthly, String(label), toNumber(amount), { rawKey: label })
    })

    const severanceBreakdown = Array.isArray(monthly.employerSeveranceAccrualsEstCostBreakup) ? monthly.employerSeveranceAccrualsEstCostBreakup : []
    severanceBreakdown.forEach((entry: any) => {
      if (!Array.isArray(entry)) return
      const [label, amount] = entry
      addBenefitWithNormalization(included, referenceMonthly, String(label), toNumber(amount), { rawKey: label })
    })
  }

  extractAccrualItems(original, included, referenceMonthly)
}

const extractVelocity: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as GenericProviderResponse
  const attributes = (original as any)?.data?.attributes
  if (!attributes || typeof attributes !== "object") return

  const timePeriod = ((original as any)?.meta?.timePeriod || "annual") as string
  const defaultFrequency: "monthly" | "yearly" = timePeriod === "monthly" ? "monthly" : "yearly"

  const lineItems = Array.isArray(attributes.lineItems) ? attributes.lineItems : []
  lineItems.forEach((item: any) => {
    const name = (item?.name || item?.title || "Employer contribution") as string
    const amount = toNumber(item?.amount)
    const frequency = name.toLowerCase().includes("monthly") ? "monthly" : defaultFrequency
    addBenefitWithNormalization(included, referenceMonthly, name, amount, { frequency, rawKey: item?.slug || name })
  })

  const remunerationItems = Array.isArray(attributes?.remuneration?.remunerationItems) ? attributes.remuneration.remunerationItems : []
  remunerationItems.forEach((item: any) => {
    const name = (item?.name || item?.title || "Remuneration accrual") as string
    const amount = toNumber(item?.amount)
    addBenefitWithNormalization(included, referenceMonthly, name, amount, { frequency: "yearly", rawKey: item?.slug || name })
  })
}

const extractPlayroll: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as GenericProviderResponse
  const outputs = Array.isArray((original as any)?.outputs) ? (original as any).outputs : []
  outputs.forEach((output: any) => {
    const category = String(output?.category || "")
    if (category.toLowerCase() !== "costtocompany") return
    const name = (output?.label || output?.name || "Employer cost") as string
    const amount = toNumber(output?.amount)
    const frequency = (output?.frequency || "monthly").toString().toLowerCase() === "yearly" ? "yearly" : "monthly"
    addBenefitWithNormalization(included, referenceMonthly, name, amount, { frequency, rawKey: output?.id || name })
  })
}

const extractOmnipresent: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as GenericProviderResponse
  const costs = Array.isArray((original as any)?.employerCosts?.costs) ? (original as any).employerCosts.costs : []
  costs.forEach((cost: any) => {
    const name = (cost?.name || "Employer cost") as string
    const amount = toNumber(cost?.USD ?? cost?.AED ?? cost?.amount)
    addBenefitWithNormalization(included, referenceMonthly, name, amount, { frequency: "monthly", rawKey: name })
  })
}

const extractGeneric: Extractor = (quote, included, referenceMonthly) => {
  const original = quote.originalResponse as GenericProviderResponse
  const costs = Array.isArray(original?.costs) ? original.costs : []
  costs.forEach(cost => {
    const name = (cost?.name || cost?.title || "Employer cost") as string
    const amount = toNumber(cost?.amount ?? cost?.monthlyAmount ?? cost?.monthly_amount)
    const freq = (cost?.frequency || "monthly").toString().toLowerCase().includes("year") ? "yearly" : "monthly"
    if (amount > 0) {
      addBenefitWithNormalization(included, referenceMonthly, name, amount, { frequency: freq, rawKey: name })
    }
  })

  extractAccrualItems(original, included, referenceMonthly)
}

const extractorMap: Record<ProviderType, Extractor> = {
  deel: extractGeneric,
  remote: extractRemote,
  rivermate: extractRivermate,
  oyster: extractOyster,
  rippling: extractRippling,
  skuad: extractSkuad,
  velocity: extractVelocity,
  playroll: extractPlayroll,
  omnipresent: extractOmnipresent
}

export class ProviderInclusionsExtractor {
  static extract(provider: ProviderType, quote: NormalizedQuoteLike): StandardizedBenefitData {
    const included: BenefitsMap = {}
    const baseMonthly = toNumber(quote.baseCost)

    if (quote.breakdown?.statutoryContributions) {
      addBenefitWithNormalization(included, baseMonthly, "Employer statutory contributions", toNumber(quote.breakdown.statutoryContributions), { rawKey: "socialSecurity" })
    }

    const extractor = extractorMap[provider] || extractGeneric

    try {
      extractor(quote, included, baseMonthly)
    } catch {
      // Swallow extraction errors for resilience; fallback totals still computed from available breakdowns
    }

    const totalMonthlyBenefits = Object.values(included).reduce((sum, benefit) => {
      const amount = toNumber(benefit?.amount)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)

    return {
      provider,
      baseSalary: baseMonthly,
      currency: quote.currency,
      country: quote.country,
      monthlyTotal: toNumber(quote.monthlyTotal),
      includedBenefits: included,
      totalMonthlyBenefits,
      extractionConfidence: estimateConfidence(provider, included),
      extractedAt: nowIso()
    }
  }
}

function estimateConfidence(provider: ProviderType, included: BenefitsMap): number {
  const keys = Object.keys(included)
  if (keys.length === 0) return 0.3

  const providerBase: Partial<Record<ProviderType, number>> = {
    remote: 0.7,
    rivermate: 0.65,
    oyster: 0.6,
    deel: 0.55,
    rippling: 0.55,
    skuad: 0.55,
    velocity: 0.55,
    playroll: 0.55,
    omnipresent: 0.55
  }

  const baseConfidence = providerBase[provider] ?? 0.5
  const benefitBonus = keys.length * 0.04
  const mandatoryBonus = keys.some(key => ["thirteenthSalary", "fourteenthSalary", "socialSecurity"].includes(key)) ? 0.1 : 0

  return Math.min(0.9, baseConfidence + benefitBonus + mandatoryBonus)
}
