// Pure provider-line-item normalization primitives. No React state, no I/O,
// no DOM. Safe to call from anywhere — Server Actions, route handlers, hooks,
// or client components. These helpers were extracted from the inline closure
// inside `extractSelectedQuoteData` in `app/quote/page.tsx` so the same
// deterministic shaping can be reused/tested without booting the full UI.
//
// The LLM `categorize-costs` request and the closure-bound aggregator
// (`addCostEntry` / `pushCostArray` / `scanRawValue` / `pushBreakdownObject`)
// intentionally remain in `page.tsx`: they depend on local accumulator state
// that does not belong here.
//
// Imports are limited to other pure utilities (no `'use client'`,
// no `'server-only'`, no React, no Next.js).
import { identifyBenefitKey } from "@/lib/shared/utils/benefitNormalization"

/**
 * Coarse semantic classification used for fallback dedupe and bucketing
 * when the LLM categorizer is unavailable. Mirrors `classifyEntryName`
 * from the original closure.
 */
export type EntryClassification =
  | 'base_salary'
  | 'statutory'
  | 'termination'
  | 'gracemark'
  | 'provider_fee'
  | 'allowance'
  | 'one_time'
  | 'other'

/**
 * Canonicalized cost item ready for downstream aggregation. Amounts are in
 * the provider's native currency and already normalized to a monthly cadence
 * via {@link convertFrequencyToMonthly}.
 */
export interface NormalizedCostItem {
  key: string
  name: string
  monthly_amount: number
}

/**
 * Bucketed monthly costs grouped by their semantic role. Matches the
 * `AcidTestCategoryBuckets` shape consumed by `buildAggregates`.
 */
export interface CategoryBuckets {
  baseSalary: Record<string, number>
  statutoryMandatory: Record<string, number>
  allowancesBenefits: Record<string, number>
  terminationCosts: Record<string, number>
  oneTimeFees: Record<string, number>
  onboardingFees: Record<string, number>
}

/**
 * Aggregated monthly totals derived from a {@link CategoryBuckets}. Matches
 * the `AcidTestAggregates` shape used by the acid-test flow.
 */
export interface CategoryAggregates {
  baseSalaryMonthly: number
  statutoryMonthly: number
  allowancesMonthly: number
  terminationMonthly: number
  oneTimeTotal: number
  onboardingTotal: number
}

/**
 * Parse a raw provider amount (number, locale-formatted string, or bigint)
 * into a finite number. Returns `0` when the value cannot be parsed.
 *
 * Mirrors the top-level `resolveMonthlyAmount` in `app/quote/page.tsx`. We
 * duplicate the implementation here so this module has no client-only
 * dependencies; the two implementations must stay in sync.
 */
export function resolveMonthlyAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const sanitized = value
      .trim()
      .replace(/[\s\u00A0]/g, '')
      .replace(/[^0-9,.-]/g, '')

    if (!sanitized) return 0

    const lastComma = sanitized.lastIndexOf(',')
    const lastDot = sanitized.lastIndexOf('.')

    let normalised = sanitized
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        normalised = sanitized.replace(/\./g, '').replace(',', '.')
      } else {
        normalised = sanitized.replace(/,/g, '')
      }
    } else if (lastComma > -1) {
      if (sanitized.indexOf(',') === lastComma && sanitized.length - lastComma <= 3) {
        normalised = sanitized.replace(',', '.')
      } else {
        normalised = sanitized.replace(/,/g, '')
      }
    } else if (lastDot > -1) {
      if (sanitized.indexOf('.') === lastDot && sanitized.length - lastDot <= 3) {
        normalised = sanitized
      } else {
        normalised = sanitized.replace(/\./g, '')
      }
    }

    const parsed = Number(normalised)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === 'bigint') {
    const asNumber = Number(value)
    return Number.isFinite(asNumber) ? asNumber : 0
  }
  return 0
}

/**
 * Convert a provider-stated amount into its monthly equivalent based on the
 * declared frequency string. Unknown / missing frequencies pass the amount
 * through unchanged (treated as already-monthly). One-time payments are
 * also passed through — the caller decides how to bucket them.
 *
 * Conversion rules (case-insensitive substring match):
 *   - `year` / `annual`             -> amount / 12
 *   - `quarter`                     -> amount / 3
 *   - `semiannual` / `biannual`     -> amount / 6
 *   - `biweek`                      -> amount * 26 / 12
 *   - `week`                        -> amount * 52 / 12
 *   - `day`                         -> amount * 21.75 (avg working days)
 *   - `one_time` / `one-time`       -> amount (unchanged)
 */
export function convertFrequencyToMonthly(amount: number, frequency?: string): number {
  if (!frequency || !Number.isFinite(amount)) return amount
  const freq = frequency.toLowerCase()
  if (freq.includes('one_time') || freq.includes('one-time')) return amount
  if (freq.includes('semiannual') || freq.includes('semi-annual') || freq.includes('biannual')) return amount / 6
  if (freq.includes('year')) return amount / 12
  if (freq.includes('annual')) return amount / 12
  if (freq.includes('quarter')) return amount / 3
  if (freq.includes('biweek')) return amount * (26 / 12)
  if (freq.includes('week')) return amount * (52 / 12)
  if (freq.includes('day')) return amount * 21.75
  return amount
}

/**
 * Map a normalized key + display name onto a canonical key used for dedupe
 * and bucketing. Recognized canonical keys (in priority order):
 *   `base_salary`, `social_security_contributions`, `thirteenth_salary`,
 *   `fourteenth_salary`, `vacation_bonus`, `transportation_allowance`,
 *   `remote_work_allowance`, `meal_vouchers`, `health_insurance`.
 *
 * Falls back to the supplied normalized key when no canonical match
 * applies. Mirrors the top-level `canonicalizeKey` in `app/quote/page.tsx`.
 */
export function canonicalizeKey(normalizedKeyInput: string, name: string): string {
  const normalizedKey = normalizedKeyInput.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const lowerName = name.toLowerCase()

  if (lowerName.includes('base salary') || normalizedKey.includes('base_salary')) {
    return 'base_salary'
  }

  const benefitKey = identifyBenefitKey(name) || identifyBenefitKey(normalizedKey.replace(/_/g, ' '))
  if (benefitKey === 'socialSecurity') return 'social_security_contributions'
  if (benefitKey === 'thirteenthSalary') return 'thirteenth_salary'
  if (benefitKey === 'fourteenthSalary') return 'fourteenth_salary'
  if (benefitKey === 'vacationBonus') return 'vacation_bonus'
  if (benefitKey === 'transportationAllowance') return 'transportation_allowance'
  if (benefitKey === 'remoteWorkAllowance') return 'remote_work_allowance'
  if (benefitKey === 'mealVouchers') return 'meal_vouchers'
  if (benefitKey === 'healthInsurance') return 'health_insurance'

  if (normalizedKey.includes('statutory') && normalizedKey.includes('contribution')) {
    return 'social_security_contributions'
  }
  if (normalizedKey.includes('social_security')) {
    return 'social_security_contributions'
  }
  if (normalizedKey.includes('thirteenthsalary')) {
    return 'thirteenth_salary'
  }
  if (normalizedKey.includes('fourteenthsalary')) {
    return 'fourteenth_salary'
  }

  return normalizedKey
}

/**
 * Convert a `snake_case` / `camelCase` / mixed key into a Title-Case display
 * label. Mirrors the top-level `formatKeyName` in `app/quote/page.tsx`.
 */
export function formatKeyName(raw: string): string {
  return raw
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

/**
 * Normalize an arbitrary list of provider line items into
 * {@link NormalizedCostItem}s. Resolves keys, names, and monthly amounts
 * from a wide assortment of field name shapes (`monthly_amount`,
 * `monthlyAmount`, `amount`, `value`, …).
 *
 * Items that cannot be coerced into an object are dropped. Items with a
 * resolvable amount of `0` are kept (matches the upstream behaviour where
 * a candidate explicitly equal to `'0'` is preserved).
 */
export function normalizeItems(rawItems: unknown[]): NormalizedCostItem[] {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .map((item, index): NormalizedCostItem | null => {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>

      const rawKeyRaw = rec.key
      const rawKey = typeof rawKeyRaw === 'string' ? rawKeyRaw.trim() : ''
      const rawNameField = rec.name
      const rawNameTrimmed = typeof rawNameField === 'string' ? rawNameField.trim() : ''
      const keyBase = rawKey.length
        ? rawKey
        : (rawNameTrimmed.length ? rawNameTrimmed : `item_${index}`)

      const friendlyName = rawNameTrimmed.length
        ? rawNameTrimmed
        : keyBase.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

      const normalizedKeyBase = keyBase.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `item_${index}`
      const canonicalKey = canonicalizeKey(normalizedKeyBase, friendlyName)

      const amountCandidates = [
        rec.monthly_amount,
        rec.monthly_amount_local,
        rec.amount,
        rec.monthlyAmount,
        rec.value,
      ]

      let resolvedAmount: number | null = null
      for (const candidate of amountCandidates) {
        const num = resolveMonthlyAmount(candidate)
        const candidateStr = String(candidate ?? '').trim()
        if (num !== 0 || candidateStr === '0') {
          resolvedAmount = num
          break
        }
      }

      const monthlyAmount = resolvedAmount ?? 0

      return {
        key: canonicalKey,
        name: friendlyName,
        monthly_amount: monthlyAmount,
      }
    })
    .filter((item): item is NormalizedCostItem => item !== null)
}

/**
 * Normalize a single fullQuote line item, returning `null` when the entry
 * is missing, has zero/non-finite amount, or is flagged `already_included`.
 *
 * This is the strict counterpart to {@link normalizeItems}: it discards
 * entries instead of falling back to a `0` amount.
 */
export function normalizeFullQuoteItem(entry: unknown, index: number): NormalizedCostItem | null {
  if (!entry || typeof entry !== 'object') return null
  const rec = entry as Record<string, unknown>

  const amount = resolveMonthlyAmount(
    rec.monthly_amount ??
    rec.monthlyAmount ??
    rec.amount ??
    rec.monthly_amount_local ??
    rec.value
  )
  if (!Number.isFinite(amount) || amount === 0) return null
  if (rec.already_included === true || rec.alreadyIncluded === true) return null

  const rawKeyField = rec.key
  const rawKey = typeof rawKeyField === 'string' && rawKeyField.trim().length > 0
    ? rawKeyField.trim()
    : `item_${index}`
  const rawNameField = rec.name
  const safeName = typeof rawNameField === 'string' && rawNameField.trim().length > 0
    ? rawNameField.trim()
    : formatKeyName(rawKey)

  const normalizedKey = rawKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || `item_${index}`

  const canonicalKey = canonicalizeKey(normalizedKey, safeName)

  return {
    key: canonicalKey,
    name: safeName,
    monthly_amount: Number(amount.toFixed(2)),
  }
}

/**
 * Coarse name-based classification used by the deterministic fallback
 * categorizer. Returns `'other'` for anything we cannot place. Mirrors
 * the inline `classifyEntryName` from `extractSelectedQuoteData`.
 */
export function classifyEntryName(name: string): EntryClassification {
  const lower = name.toLowerCase()
  if (/(base|gross|net).*salary/.test(lower) || lower.includes('base cost') || lower.includes('gross pay')) {
    return 'base_salary'
  }
  if (lower.includes('statutory') || lower.includes('employer contribution') || lower.includes('social security') || lower.includes('insurance') || lower.includes('tax')) {
    return 'statutory'
  }
  if (lower.includes('termination') || lower.includes('severance') || lower.includes('probation') || lower.includes('notice')) {
    return 'termination'
  }
  if (lower.includes('gracemark')) {
    return 'gracemark'
  }
  if (lower.includes('provider fee') || lower.includes('platform fee')) {
    return 'provider_fee'
  }
  if (lower.includes('allowance') || lower.includes('benefit') || lower.includes('voucher')) {
    return 'allowance'
  }
  if (lower.includes('one-time') || lower.includes('one time') || lower.includes('setup') || lower.includes('onboarding')) {
    return 'one_time'
  }
  return 'other'
}

/**
 * Predicate returning `true` for items that represent an employee-side
 * deduction (income tax, withholding, employee contribution, take-home pay,
 * etc.) and therefore should not be summed into employer cost.
 *
 * Note the polarity is inverted compared to the historical inline helper:
 * the original returned `true` to mean "drop this entry". This implementation
 * keeps the same semantics so callers can still write
 * `items.filter(i => !isEmployeeSideEntry(i))`.
 */
export function isEmployeeSideEntry(item: { key: string; name: string }): boolean {
  const lowerName = item.name.toLowerCase()
  const lowerKey = item.key.toLowerCase()
  const exclusionPatterns = [
    'employee contribution',
    'employee_contribution',
    'employee tax',
    'employee_tax',
    'income tax',
    'income_tax',
    'withholding',
    'net salary',
    'net pay',
    'take home',
    'employee social',
    'employee pension',
  ]
  return exclusionPatterns.some(pattern =>
    lowerName.includes(pattern) || lowerKey.includes(pattern.replace(/\s+/g, '_'))
  )
}

/**
 * Convenience wrapper: drop every employee-side entry from a list while
 * preserving element order. Equivalent to
 * `items.filter(i => !isEmployeeSideEntry(i))`.
 */
export function dropEmployeeSideEntries<T extends { key: string; name: string }>(items: T[]): T[] {
  return items.filter(item => !isEmployeeSideEntry(item))
}

/**
 * Sum the `monthly_amount` field across a list of items. Returns `0` for
 * an empty list.
 */
export function sumItems(list: ReadonlyArray<{ monthly_amount: number }>): number {
  return list.reduce((total, current) => total + current.monthly_amount, 0)
}

/**
 * Build aggregate monthly totals from a {@link CategoryBuckets}. Onboarding
 * fees are rolled into both `onboardingTotal` and `oneTimeTotal` so the
 * caller does not have to re-add them. Mirrors the inline `buildAggregates`
 * from `extractSelectedQuoteData`.
 */
export function buildAggregates(categories: CategoryBuckets): CategoryAggregates {
  const sumBucket = (bucket: Record<string, number> | undefined | null): number =>
    Object.values(bucket || {}).reduce((sum, value) => sum + resolveMonthlyAmount(value), 0)

  const onboardingTotal = sumBucket(categories.onboardingFees)

  return {
    baseSalaryMonthly: sumBucket(categories.baseSalary),
    statutoryMonthly: sumBucket(categories.statutoryMandatory),
    allowancesMonthly: sumBucket(categories.allowancesBenefits),
    terminationMonthly: sumBucket(categories.terminationCosts),
    oneTimeTotal: sumBucket(categories.oneTimeFees) + onboardingTotal,
    onboardingTotal,
  }
}
