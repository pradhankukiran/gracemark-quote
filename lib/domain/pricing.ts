// Pure pricing / TCE composition primitives. No React, no DOM, no I/O.
// Safe to call from Server Actions, route handlers, hooks, or tests.

import type { CurrencyConversionResult } from "@/lib/currency-converter"
import { identifyBenefitKey } from "@/lib/shared/utils/benefitNormalization"
import { hasLocalOfficeData } from "@/lib/shared/utils/localOfficeData"
import type { EORFormData, LocalOfficeCustomCost, LocalOfficeInfo } from "@/lib/shared/types"
import type { EnhancedQuote, ProviderType } from "@/lib/types/enhancement"
import {
  getDeelProviderPrice,
  getOmnipresentProviderPrice,
  getOysterProviderPrice,
  getPlayrollProviderPrice,
  getRemoteProviderPrice,
  getRipplingProviderPrice,
  getRivermateProviderPrice,
  getSkuadProviderPrice,
  getVelocityProviderPrice,
  parseNumericValue,
} from "@/app/quote/utils/providerprice"

// === Numeric helpers ===

/** Round to 2 decimal places (cents). */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

/** Read a finite number, falling back when input isn't a finite number. */
export function readNumericValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/** Read a finite number, returning null when input isn't a finite number. */
export function readOptionalNumericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/**
 * Robustly coerce mixed inputs (numbers, locale-formatted strings, bigints) to
 * a monthly numeric amount. Handles `1.234,56`, `1,234.56`, and trailing
 * thousand separators without confusing them for decimals.
 */
export function resolveMonthlyAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const sanitized = value
      .trim()
      .replace(/[\s\u00A0]/g, "")
      .replace(/[^0-9,.-]/g, "")

    if (!sanitized) return 0

    const lastComma = sanitized.lastIndexOf(",")
    const lastDot = sanitized.lastIndexOf(".")

    let normalised = sanitized
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        normalised = sanitized.replace(/\./g, "").replace(",", ".")
      } else {
        normalised = sanitized.replace(/,/g, "")
      }
    } else if (lastComma > -1) {
      if (sanitized.indexOf(",") === lastComma && sanitized.length - lastComma <= 3) {
        normalised = sanitized.replace(",", ".")
      } else {
        normalised = sanitized.replace(/,/g, "")
      }
    } else if (lastDot > -1) {
      if (sanitized.indexOf(".") === lastDot && sanitized.length - lastDot <= 3) {
        normalised = sanitized
      } else {
        normalised = sanitized.replace(/\./g, "")
      }
    }

    const parsed = Number(normalised)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value)
    return Number.isFinite(asNumber) ? asNumber : 0
  }
  return 0
}

/**
 * Pick the first non-zero, finite numeric candidate. Strings are routed
 * through `parseNumericValue` (the lighter-weight provider-price parser).
 */
export function resolveMonthlyValue(...candidates: Array<unknown>): number {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate !== 0) {
      return candidate
    }
    if (typeof candidate === "string") {
      const parsed = parseNumericValue(candidate)
      if (parsed !== null && parsed !== 0) return parsed
    }
  }
  return 0
}

// === Display formatters (no I18n / no DOM) ===

/** Format a 0-1 ratio as a percentage string with up to 2 decimals, trimmed. */
export function formatPercentageInput(value: number): string {
  if (!Number.isFinite(value)) return ""
  const percent = value * 100
  const fixed = percent % 1 === 0 ? percent.toString() : percent.toFixed(2)
  // Only remove trailing zeros after decimal point, not in whole numbers
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed
}

/** Pull a finite `target_amount` out of a `convertCurrency` payload. */
export function extractConvertedAmount(conversion: CurrencyConversionResult | null | undefined): number | undefined {
  if (!conversion || !conversion.success || !conversion.data) return undefined
  const amount = Number(conversion.data.target_amount)
  return Number.isFinite(amount) ? amount : undefined
}

// === Key + label normalization ===

/**
 * Map free-form provider keys/names to a stable internal key
 * (e.g. `base_salary`, `social_security_contributions`, `thirteenth_salary`).
 */
export function canonicalizeKey(normalizedKeyInput: string, name: string): string {
  const normalizedKey = normalizedKeyInput.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  const lowerName = name.toLowerCase()

  if (lowerName.includes("base salary") || normalizedKey.includes("base_salary")) {
    return "base_salary"
  }

  const benefitKey = identifyBenefitKey(name) || identifyBenefitKey(normalizedKey.replace(/_/g, " "))
  if (benefitKey === "socialSecurity") return "social_security_contributions"
  if (benefitKey === "thirteenthSalary") return "thirteenth_salary"
  if (benefitKey === "fourteenthSalary") return "fourteenth_salary"
  if (benefitKey === "vacationBonus") return "vacation_bonus"
  if (benefitKey === "transportationAllowance") return "transportation_allowance"
  if (benefitKey === "remoteWorkAllowance") return "remote_work_allowance"
  if (benefitKey === "mealVouchers") return "meal_vouchers"
  if (benefitKey === "healthInsurance") return "health_insurance"

  if (normalizedKey.includes("statutory") && normalizedKey.includes("contribution")) {
    return "social_security_contributions"
  }
  if (normalizedKey.includes("social_security")) {
    return "social_security_contributions"
  }
  if (normalizedKey.includes("thirteenthsalary")) {
    return "thirteenth_salary"
  }
  if (normalizedKey.includes("fourteenthsalary")) {
    return "fourteenth_salary"
  }

  return normalizedKey
}

/** Convert snake_case / camelCase keys to a Title Case display name. */
export function formatKeyName(raw: string): string {
  return raw
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

/** Lower-case + alphanum-only label normalizer for fuzzy allowance matching. */
export function normalizeAllowanceLabel(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

const TRANSPORT_ALLOWANCE_KEYWORDS = ["transportation", "transport", "commuting", "travel allowance", "bus", "mobility"]
const REMOTE_ALLOWANCE_KEYWORDS = ["remote work", "work from home", "wfh", "home office", "telework"]

/** True for line items that represent employee deductions (not employer cost). */
export function shouldDropEmployeeEntry(item: { key: string; name: string }): boolean {
  const lowerName = item.name.toLowerCase()
  const lowerKey = item.key.toLowerCase()
  const exclusionPatterns = [
    "employee contribution",
    "employee_contribution",
    "employee tax",
    "employee_tax",
    "income tax",
    "income_tax",
    "withholding",
    "net salary",
    "net pay",
    "take home",
    "employee social",
    "employee pension",
  ]
  return exclusionPatterns.some(pattern =>
    lowerName.includes(pattern) || lowerKey.includes(pattern.replace(/\s+/g, "_"))
  )
}

/**
 * Drop allowances incompatible with the contract type:
 * - `remote` contracts strip transportation/commuting allowances.
 * - `on-site` contracts strip remote-work / WFH allowances.
 * - `hybrid` (or missing) keeps everything.
 *
 * Returns the original array reference when nothing was filtered.
 */
export function filterAllowancesByContractType<T extends { name: string | null | undefined }>(
  items: T[],
  contractType?: EORFormData["contractType"]
): T[] {
  if (!contractType || contractType === "hybrid" || !Array.isArray(items) || items.length === 0) {
    return items
  }

  const keywords =
    contractType === "remote"
      ? TRANSPORT_ALLOWANCE_KEYWORDS
      : REMOTE_ALLOWANCE_KEYWORDS

  const shouldExclude = (name?: string | null): boolean => {
    if (!name) return false
    const normalized = normalizeAllowanceLabel(name)
    if (!normalized) return false
    return keywords.some(keyword => normalized.includes(keyword))
  }

  const filtered = items.filter(item => !shouldExclude(item?.name ?? ""))
  return filtered.length === items.length ? items : filtered
}

// === Local-office helpers ===

const ISO3_TO_LOCAL_OFFICE_CODE: Record<string, string> = {
  COL: "CO",
  BRA: "BR",
  ARG: "AR",
  MEX: "MX",
  CHL: "CL",
  PER: "PE",
}

const COUNTRY_NAME_TO_LOCAL_OFFICE_CODE: Record<string, string> = {
  COLOMBIA: "CO",
  COL: "CO",
  BRAZIL: "BR",
  BRASIL: "BR",
  ARGENTINA: "AR",
  MEXICO: "MX",
  CHILE: "CL",
  PERU: "PE",
}

const LOCAL_OFFICE_DUPLICATE_LABELS: Record<keyof LocalOfficeInfo, string[]> = {
  mealVoucher: ["Meal Voucher (Local Office)", "Meal Vouchers (Local Office)"],
  transportation: ["Transportation (Local Office)", "Transportation Allowance (Local Office)"],
  wfh: ["WFH (Local Office)", "Remote Work Allowance (Local Office)"],
  healthInsurance: ["Health Insurance (Local Office)"],
  monthlyPaymentsToLocalOffice: ["Local Office Monthly Payments"],
  vat: ["VAT on Local Office Payments", "Local Office VAT", "VAT"],
  preEmploymentMedicalTest: ["Pre-employment Medical Test (Local Office)"],
  drugTest: ["Drug Test (Local Office)"],
  backgroundCheckViaDeel: ["Background Check (Local Office)"],
}

/** Coerce a free-form local-office amount string to a non-negative number. */
export function sanitizeLocalOfficeAmount(value?: string): number {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed) return 0

  const normalized = trimmed.toLowerCase()
  if (normalized === "n/a" || normalized === "no" || normalized === "none") {
    return 0
  }

  const parsed = parseNumericValue(trimmed)
  if (parsed === null || !Number.isFinite(parsed)) {
    return 0
  }

  return parsed > 0 ? parsed : 0
}

/**
 * Normalize a country identifier (ISO2, ISO3, or country name) to a 2-letter
 * local-office code. Returns null when no mapping is known.
 */
export function normalizeCountryIdentifier(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withoutDiacritics = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const upper = withoutDiacritics.toUpperCase()

  if (hasLocalOfficeData(upper)) {
    return upper
  }

  if (upper.length === 3 && ISO3_TO_LOCAL_OFFICE_CODE[upper]) {
    return ISO3_TO_LOCAL_OFFICE_CODE[upper]
  }

  const alphaOnly = upper.replace(/[^A-Z]/g, "")
  if (COUNTRY_NAME_TO_LOCAL_OFFICE_CODE[alphaOnly]) {
    return COUNTRY_NAME_TO_LOCAL_OFFICE_CODE[alphaOnly]
  }

  return null
}

/**
 * Recursively walk an unknown object/array looking for a known country
 * identifier. Bounded depth = 6 to guard against pathological inputs.
 */
export function findLocalOfficeCountryCodeInObject(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null

  if (typeof value === "string") {
    return normalizeCountryIdentifier(value)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLocalOfficeCountryCodeInObject(item, depth + 1)
      if (found) return found
    }
    return null
  }

  if (typeof value === "object") {
    const candidateKeys = [
      "country",
      "country_code",
      "countryCode",
      "countryCodeAlpha2",
      "countryName",
      "countryISO",
      "countryIso",
      "country_iso",
      "employment_country",
      "employmentCountry",
    ]
    for (const key of candidateKeys) {
      if (key in (value as Record<string, unknown>)) {
        const found = findLocalOfficeCountryCodeInObject((value as Record<string, unknown>)[key], depth + 1)
        if (found) return found
      }
    }

    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findLocalOfficeCountryCodeInObject(child, depth + 1)
      if (found) return found
    }
  }

  return null
}

/**
 * Build a predicate that returns true when a candidate label conflicts with an
 * existing local-office field or custom cost. The caller supplies a `normalize`
 * function so we don't lock in any particular label-comparison style.
 */
export function buildLocalOfficeDuplicateChecker(
  localOfficeInfo: LocalOfficeInfo | undefined | null,
  customCosts: LocalOfficeCustomCost[] | undefined | null,
  normalize: (value: string) => string
): (needle: string) => boolean {
  const normalizedLabels: string[] = []

  if (localOfficeInfo) {
    for (const fieldKey of Object.keys(LOCAL_OFFICE_DUPLICATE_LABELS) as (keyof LocalOfficeInfo)[]) {
      const amount = sanitizeLocalOfficeAmount(localOfficeInfo[fieldKey])
      if (amount <= 0) continue

      const labels = LOCAL_OFFICE_DUPLICATE_LABELS[fieldKey]
      if (!labels || labels.length === 0) continue

      for (const label of labels) {
        const normalized = normalize(label)
        if (!normalized) continue
        normalizedLabels.push(normalized)

        const trimmed = normalized.replace(/\blocal office\b/g, "").trim()
        if (trimmed && trimmed !== normalized) {
          normalizedLabels.push(trimmed)
        }
      }
    }
  }

  if (Array.isArray(customCosts)) {
    for (const cost of customCosts) {
      const amount = sanitizeLocalOfficeAmount(cost?.amount)
      const label = typeof cost?.label === "string" ? cost.label : ""
      if (amount <= 0 || !label.trim()) continue
      const normalized = normalize(label)
      if (!normalized) continue
      normalizedLabels.push(normalized)
    }
  }

  if (normalizedLabels.length === 0) return () => false

  return (needle: string) => {
    const candidate = normalize(needle)
    if (!candidate) return false
    return normalizedLabels.some(label => label && (label.includes(candidate) || candidate.includes(label)))
  }
}

// === Provider price dispatch ===

/**
 * Dispatch to the per-provider price calculator. Returns null when the source
 * doesn't carry a quote for the given provider. The underlying per-provider
 * implementations live in `app/quote/utils/providerprice/*`.
 */
export function computeProviderPriceFromSource(
  provider: ProviderType,
  quoteData: { quotes?: Record<string, unknown> } | null | undefined,
  enhancements: Partial<Record<ProviderType, EnhancedQuote>>,
  contractMonths: number
): number | null {
  if (!quoteData?.quotes) return null
  const rawQuote = quoteData.quotes[provider]
  if (!rawQuote) return null

  const enhancement = enhancements[provider]

  switch (provider) {
    case "deel":
      return getDeelProviderPrice(rawQuote, enhancement, contractMonths)
    case "remote":
      return getRemoteProviderPrice(rawQuote, enhancement, contractMonths)
    case "rivermate":
      return getRivermateProviderPrice(rawQuote, enhancement, contractMonths)
    case "oyster":
      return getOysterProviderPrice(rawQuote, enhancement, contractMonths)
    case "rippling":
      return getRipplingProviderPrice(rawQuote, enhancement, contractMonths)
    case "skuad":
      return getSkuadProviderPrice(rawQuote, enhancement, contractMonths)
    case "velocity":
      return getVelocityProviderPrice(rawQuote, enhancement, contractMonths)
    case "playroll":
      return getPlayrollProviderPrice(rawQuote, enhancement, contractMonths)
    case "omnipresent":
      return getOmnipresentProviderPrice(rawQuote, enhancement, contractMonths)
    default:
      return null
  }
}
