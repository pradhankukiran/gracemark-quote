"use client"

import { useEffect, Suspense, memo, useState, useCallback, useMemo, startTransition } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calculator, Clock, CheckCircle, XCircle, Brain, Target, Zap, BarChart3, TrendingUp, TrendingDown, Crown, Activity, FileText, Info, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useQuoteResults } from "./hooks/useQuoteResults"
import { useUSDConversion } from "../eor-calculator/hooks/useUSDConversion"
import { GenericQuoteCard } from "@/lib/shared/components/GenericQuoteCard"
import { QuoteComparison } from "../eor-calculator/components/QuoteComparison"
import { ErrorBoundary } from "@/lib/shared/components/ErrorBoundary"
import { ProviderSelector } from "./components/ProviderSelector"
import { ProviderLogo } from "./components/ProviderLogo"
import { VarianceSummaryCards } from "./components/VarianceSummaryCards"
import { ProviderComparisonCard } from "./components/ProviderComparisonCard"
import { VarianceChart } from "./components/VarianceChart"
import { EnhancementProvider, useEnhancementContext } from "@/hooks/enhancement/EnhancementContext"
import { transformRemoteResponseToQuote, transformRivermateQuoteToDisplayQuote, transformToRemoteQuote, transformOysterQuoteToDisplayQuote } from "@/lib/shared/utils/apiUtils"
import { identifyBenefitKey } from "@/lib/shared/utils/benefitNormalization"
import { EORFormData, LocalOfficeInfo, RemoteAPIResponse, Quote, RivermateQuote, OysterQuote } from "@/lib/shared/types"
import { ProviderType, EnhancedQuote, TerminationComponentEnhancement } from "@/lib/types/enhancement"
import { convertCurrency } from "@/lib/currency-converter"
import { exportAcidTestCostBreakdownPdf } from "@/lib/pdf/exportAcidTestCostBreakdown"
import type { AcidTestPdfCategory, AcidTestPdfItem } from "@/lib/pdf/AcidTestCostBreakdownDocument"
import { getRawQuote } from "@/lib/shared/utils/rawQuoteStore"
import {
  getDeelProviderPrice,
  getRemoteProviderPrice,
  getRivermateProviderPrice,
  getOysterProviderPrice,
  getRipplingProviderPrice,
  getSkuadProviderPrice,
  getVelocityProviderPrice,
  getPlayrollProviderPrice,
  getOmnipresentProviderPrice,
  parseNumericValue,
  baseQuoteContainsPattern
} from "./utils/providerprice"
import { hasLocalOfficeData, getOriginalLocalOfficeData, getFieldCurrency } from "@/lib/shared/utils/localOfficeData"

const PROVIDER_LIST: ProviderType[] = ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity', 'playroll', 'omnipresent']

const splitIntoBalancedRows = <T,>(items: T[]) => {
  if (items.length === 0) {
    return {
      firstRow: [] as T[],
      secondRow: [] as T[]
    }
  }

  const firstRowCount = Math.min(5, Math.ceil(items.length / 2))
  return {
    firstRow: items.slice(0, firstRowCount),
    secondRow: items.slice(firstRowCount)
  }
}

const resolveMonthlyValue = (...candidates: Array<unknown>): number => {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate !== 0) {
      return candidate
    }
    if (typeof candidate === 'string') {
      const parsed = parseNumericValue(candidate)
      if (parsed !== null && parsed !== 0) return parsed
    }
  }
  return 0
}

const computeProviderPriceFromSource = (
  provider: ProviderType,
  quoteData: { quotes?: Record<string, unknown> } | null | undefined,
  enhancements: Partial<Record<ProviderType, EnhancedQuote>>,
  contractMonths: number
): number | null => {
  if (!quoteData?.quotes) return null
  const rawQuote = quoteData.quotes[provider]
  if (!rawQuote) return null

  const enhancement = enhancements[provider]

  switch (provider) {
    case 'deel':
      return getDeelProviderPrice(rawQuote, enhancement, contractMonths)
    case 'remote':
      return getRemoteProviderPrice(rawQuote, enhancement, contractMonths)
    case 'rivermate':
      return getRivermateProviderPrice(rawQuote, enhancement, contractMonths)
    case 'oyster':
      return getOysterProviderPrice(rawQuote, enhancement, contractMonths)
    case 'rippling':
      return getRipplingProviderPrice(rawQuote, enhancement, contractMonths)
    case 'skuad':
      return getSkuadProviderPrice(rawQuote, enhancement, contractMonths)
    case 'velocity':
      return getVelocityProviderPrice(rawQuote, enhancement, contractMonths)
    case 'playroll':
      return getPlayrollProviderPrice(rawQuote, enhancement, contractMonths)
    case 'omnipresent':
      return getOmnipresentProviderPrice(rawQuote, enhancement, contractMonths)
    default:
      return null
  }
}

const resolveMonthlyAmount = (value: unknown): number => {
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

const normalizeAllowanceLabel = (value: string): string =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const TRANSPORT_ALLOWANCE_KEYWORDS = ['transportation', 'transport', 'commuting', 'travel allowance', 'bus', 'mobility']
const REMOTE_ALLOWANCE_KEYWORDS = ['remote work', 'work from home', 'wfh', 'home office', 'telework']

const filterAllowancesByContractType = <T extends { name: string | null | undefined }>(
  items: T[],
  contractType?: EORFormData['contractType']
): T[] => {
  if (!contractType || contractType === 'hybrid' || !Array.isArray(items) || items.length === 0) {
    return items
  }

  const keywords =
    contractType === 'remote'
      ? TRANSPORT_ALLOWANCE_KEYWORDS
      : REMOTE_ALLOWANCE_KEYWORDS

  const shouldExclude = (name?: string | null): boolean => {
    if (!name) return false
    const normalized = normalizeAllowanceLabel(name)
    if (!normalized) return false
    return keywords.some(keyword => normalized.includes(keyword))
  }

  const filtered = items.filter(item => !shouldExclude(item?.name ?? ''))
  return filtered.length === items.length ? items : filtered
}

const formatKeyName = (raw: string) => raw
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, letter => letter.toUpperCase())

const canonicalizeKey = (normalizedKeyInput: string, name: string): string => {
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

const shouldDropEmployeeEntry = (item: { key: string; name: string }) => {
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
    'employee pension'
  ]
  return exclusionPatterns.some(pattern =>
    lowerName.includes(pattern) || lowerKey.includes(pattern.replace(/\s+/g, '_'))
  )
}

const roundToCents = (value: number) => Math.round(value * 100) / 100
const readNumericValue = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const readOptionalNumericValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const ONBOARDING_FEE_FIELDS: Array<{ field: keyof LocalOfficeInfo; key: string }> = [
  { field: 'preEmploymentMedicalTest', key: 'pre_employment_medical_test' },
  { field: 'drugTest', key: 'drug_test' },
  { field: 'backgroundCheckViaDeel', key: 'background_check_via_deel' },
]

const ISO3_TO_LOCAL_OFFICE_CODE: Record<string, string> = {
  COL: 'CO',
  BRA: 'BR',
  ARG: 'AR',
  MEX: 'MX',
  CHL: 'CL',
  PER: 'PE',
}
const COUNTRY_NAME_TO_LOCAL_OFFICE_CODE: Record<string, string> = {
  COLOMBIA: 'CO',
  COL: 'CO',
  BRAZIL: 'BR',
  BRASIL: 'BR',
  ARGENTINA: 'AR',
  MEXICO: 'MX',
  CHILE: 'CL',
  PERU: 'PE',
}

const normalizeCountryIdentifier = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withoutDiacritics = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const upper = withoutDiacritics.toUpperCase()

  if (hasLocalOfficeData(upper)) {
    return upper
  }

  if (upper.length === 3 && ISO3_TO_LOCAL_OFFICE_CODE[upper]) {
    return ISO3_TO_LOCAL_OFFICE_CODE[upper]
  }

  const alphaOnly = upper.replace(/[^A-Z]/g, '')
  if (COUNTRY_NAME_TO_LOCAL_OFFICE_CODE[alphaOnly]) {
    return COUNTRY_NAME_TO_LOCAL_OFFICE_CODE[alphaOnly]
  }

  return null
}

const sanitizeLocalOfficeAmount = (value?: string): number => {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed) return 0

  const normalized = trimmed.toLowerCase()
  if (normalized === 'n/a' || normalized === 'no' || normalized === 'none') {
    return 0
  }

  const parsed = parseNumericValue(trimmed)
  if (parsed === null || !Number.isFinite(parsed)) {
    return 0
  }

  return parsed > 0 ? parsed : 0
}

const LOCAL_OFFICE_DUPLICATE_LABELS: Record<keyof LocalOfficeInfo, string[]> = {
  mealVoucher: ['Meal Voucher (Local Office)', 'Meal Vouchers (Local Office)'],
  transportation: ['Transportation (Local Office)', 'Transportation Allowance (Local Office)'],
  wfh: ['WFH (Local Office)', 'Remote Work Allowance (Local Office)'],
  healthInsurance: ['Health Insurance (Local Office)'],
  monthlyPaymentsToLocalOffice: ['Local Office Monthly Payments'],
  vat: ['VAT on Local Office Payments', 'Local Office VAT', 'VAT'],
  preEmploymentMedicalTest: ['Pre-employment Medical Test (Local Office)'],
  drugTest: ['Drug Test (Local Office)'],
  backgroundCheckViaDeel: ['Background Check (Local Office)']
}

const buildLocalOfficeDuplicateChecker = (
  localOfficeInfo: LocalOfficeInfo | undefined | null,
  normalize: (value: string) => string
): ((needle: string) => boolean) => {
  if (!localOfficeInfo) return () => false

  const normalizedLabels: string[] = []

  for (const fieldKey of Object.keys(LOCAL_OFFICE_DUPLICATE_LABELS) as (keyof LocalOfficeInfo)[]) {
    const amount = sanitizeLocalOfficeAmount(localOfficeInfo[fieldKey])
    if (amount <= 0) continue

    const labels = LOCAL_OFFICE_DUPLICATE_LABELS[fieldKey]
    if (!labels || labels.length === 0) continue

    for (const label of labels) {
      const normalized = normalize(label)
      if (!normalized) continue
      normalizedLabels.push(normalized)

      const trimmed = normalized.replace(/\blocal office\b/g, '').trim()
      if (trimmed && trimmed !== normalized) {
        normalizedLabels.push(trimmed)
      }
    }
  }

  if (normalizedLabels.length === 0) return () => false

  return (needle: string) => {
    const candidate = normalize(needle)
    if (!candidate) return false
    return normalizedLabels.some(label => label && (label.includes(candidate) || candidate.includes(label)))
  }
}

const findLocalOfficeCountryCodeInObject = (value: unknown, depth = 0): string | null => {
  if (depth > 6 || value == null) return null

  if (typeof value === 'string') {
    return normalizeCountryIdentifier(value)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLocalOfficeCountryCodeInObject(item, depth + 1)
      if (found) return found
    }
    return null
  }

  if (typeof value === 'object') {
    const candidateKeys = [
      'country',
      'country_code',
      'countryCode',
      'countryCodeAlpha2',
      'countryName',
      'countryISO',
      'countryIso',
      'country_iso',
      'employment_country',
      'employmentCountry',
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

// Build items exactly as displayed in UI: base costs + filtered enhancement extras
const buildDisplayedItems = (
  enhancement: EnhancedQuote | undefined,
  baseQuote: Quote | undefined,
  localOfficeInfo?: LocalOfficeInfo | null,
  contractType?: EORFormData['contractType']
): Array<{ key: string; name: string; monthly_amount: number }> => {
  if (!baseQuote) return []

  const items: Array<{ key: string; name: string; monthly_amount: number }> = []

  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const hasLocalOfficeItemLike = buildLocalOfficeDuplicateChecker(localOfficeInfo, norm)

  // Check if an item with similar name already exists in base costs
  const hasItemLike = (needle: string) => {
    const costs = Array.isArray(baseQuote.costs) ? baseQuote.costs : []
    return costs.some((c: any) => norm(c?.name).includes(norm(needle)))
  }

  // Add base salary
  const baseSalary = parseNumericValue(baseQuote.salary)
  if (baseSalary !== null && baseSalary > 0) {
    items.push({ key: 'base_salary', name: 'Base Salary', monthly_amount: baseSalary })
  }

  // Add all base costs
  if (Array.isArray(baseQuote.costs)) {
    baseQuote.costs.forEach((cost, index) => {
      const amount = parseNumericValue(cost.amount)
      if (amount !== null && amount > 0) {
        const name = String(cost.name || '').trim()
        const key = norm(name).replace(/\s+/g, '_') || `cost_${index}`
        items.push({ key, name, monthly_amount: amount })
      }
    })
  }

  // Add enhancement extras - same logic as UI (lines 4538-4621)
  if (enhancement?.enhancements) {
    const enh = enhancement.enhancements

    // Helper to add extra with duplicate checking (same as UI)
    const addExtra = (
      name: string,
      amount: number,
      guards: string[] = [],
      options?: { skipLocalOfficeCheck?: boolean; preferLocalOffice?: boolean }
    ) => {
      const amt = parseNumericValue(amount)
      if (amt === null || !Number.isFinite(amt) || amt <= 0) return

      // Check if duplicate exists in base costs (same as UI)
      const guardList = Array.isArray(guards) ? guards : []
      const duplicateFromBase = !options?.preferLocalOffice && guardList.some(g => hasItemLike(g))
      const duplicateFromLocalOffice = options?.skipLocalOfficeCheck
        ? false
        : hasLocalOfficeItemLike(name) || guardList.some(g => hasLocalOfficeItemLike(g))
      if (duplicateFromBase || duplicateFromLocalOffice) return

      if (options?.preferLocalOffice) {
        for (let i = items.length - 1; i >= 0; i--) {
          const existing = items[i]
          const existingNorm = norm(existing?.name)
          const matchesGuard = guardList.some(g => existingNorm.includes(norm(g)))
          const matchesName = existingNorm === norm(name)
          if (matchesGuard || matchesName) {
            items.splice(i, 1)
          }
        }
      }

      const key = norm(name).replace(/\s+/g, '_')
      items.push({ key, name, monthly_amount: amt })
    }

    // Termination provisions
    if (enh.severanceProvision && enh.severanceProvision.isAlreadyIncluded !== true) {
      const monthly = Number(enh.severanceProvision.monthlyAmount || 0)
      if (monthly > 0) addExtra('Severance Cost', monthly, ['severance cost', 'severance provision'])
    }

    if (enh.noticePeriodCost && enh.noticePeriodCost.isAlreadyIncluded !== true) {
      const monthly = Number(enh.noticePeriodCost.monthlyAmount || 0)
      if (monthly > 0) addExtra('Notice Period Cost', monthly, ['notice period', 'probation provision'])
    }

    // 13th salary
    if (enh.thirteenthSalary && enh.thirteenthSalary.isAlreadyIncluded !== true) {
      const monthly = parseNumericValue(enh.thirteenthSalary.monthlyAmount) ?? (() => {
        const yearly = parseNumericValue(enh.thirteenthSalary.yearlyAmount)
        return yearly !== null ? yearly / 12 : null
      })()
      if (monthly !== null) addExtra('13th Salary', monthly, ['13th', 'thirteenth'])
    }

    // 14th salary
    if (enh.fourteenthSalary && enh.fourteenthSalary.isAlreadyIncluded !== true) {
      const monthly = parseNumericValue(enh.fourteenthSalary.monthlyAmount) ?? (() => {
        const yearly = parseNumericValue(enh.fourteenthSalary.yearlyAmount)
        return yearly !== null ? yearly / 12 : null
      })()
      if (monthly !== null) addExtra('14th Salary', monthly, ['14th', 'fourteenth'])
    }

    // Allowances
    if (enh.transportationAllowance && enh.transportationAllowance.isAlreadyIncluded !== true) {
      addExtra('Transportation Allowance', Number(enh.transportationAllowance.monthlyAmount || 0), ['transportation'])
    }

    if (enh.remoteWorkAllowance && enh.remoteWorkAllowance.isAlreadyIncluded !== true) {
      addExtra('Remote Work Allowance', Number(enh.remoteWorkAllowance.monthlyAmount || 0), ['remote work', 'wfh'])
    }

    if (enh.mealVouchers && enh.mealVouchers.isAlreadyIncluded !== true) {
      addExtra('Meal Vouchers', Number(enh.mealVouchers.monthlyAmount || 0), ['meal voucher'])
    }

    // Additional contributions
    const addc = enh.additionalContributions || {}
    Object.entries(addc).forEach(([k, v]) => {
      const n = Number(v)
      if (!isFinite(n) || n <= 0) return

      const key = String(k || '').toLowerCase()
      // Skip employer contributions (same as UI line 4607)
      if (key.includes('employer') && key.includes('contribution')) return

      // Map labels with appropriate guards for duplicate checking
      if (key.includes('local_meal_voucher')) {
        addExtra('Meal Voucher (Local Office)', n, ['meal voucher', 'meal'], { skipLocalOfficeCheck: true, preferLocalOffice: true })
      } else if (key.includes('local_transportation')) {
        addExtra('Transportation (Local Office)', n, ['transportation'], { skipLocalOfficeCheck: true, preferLocalOffice: true })
      } else if (key.includes('local_wfh')) {
        addExtra('WFH (Local Office)', n, ['wfh', 'remote work', 'work from home'], { skipLocalOfficeCheck: true, preferLocalOffice: true })
      } else if (key.includes('local_health_insurance')) {
        addExtra('Health Insurance (Local Office)', n, ['health insurance'], { skipLocalOfficeCheck: true, preferLocalOffice: true })
      } else if (key.includes('local_office_monthly_payments')) {
        addExtra('Local Office Monthly Payments', n, ['local office monthly payments'], { skipLocalOfficeCheck: true, preferLocalOffice: true })
      } else if (key.includes('local_office_vat')) {
        addExtra('VAT on Local Office Payments', n, ['vat'], { skipLocalOfficeCheck: true, preferLocalOffice: true })
      } else {
        const label = String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        addExtra(label, n)
      }
    })
  }

  return filterAllowancesByContractType(items, contractType)
}

type QuoteExtra = { name: string; amount: number; guards?: string[]; replaceBaseGuards?: string[] }

const mergeExtrasIntoQuote = (
  quote: Quote | undefined,
  extras: QuoteExtra[],
  usdConversions: any
): { quote: Quote | undefined; usdConversions: any } => {
  if (!quote || !Array.isArray(extras) || extras.length === 0) {
    return { quote, usdConversions }
  }

  const toAmountStr = (value: number) => {
    const n = Number(value)
    return Number.isFinite(n) ? n.toFixed(2) : '0'
  }
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const parseNum = (value?: string | number) => {
    if (typeof value === 'number') return value
    const parsed = Number.parseFloat((value || '0') as string)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const baseCosts = Array.isArray(quote.costs) ? quote.costs.map(cost => ({ ...cost })) : []
  let costs = [...baseCosts]
  let conversions = usdConversions ? { ...usdConversions } : undefined
  let conversionCosts = conversions && Array.isArray(conversions.costs) ? [...conversions.costs] : undefined

  const existingContains = (needle: string) => {
    const needleNorm = norm(needle)
    return costs.some(cost => norm(cost?.name).includes(needleNorm))
  }

  const removeMatchingBaseCosts = (guards: string[] | undefined): number => {
    if (!guards || guards.length === 0 || costs.length === 0) return 0
    const guardNorms = guards.map(norm).filter(Boolean)
    if (guardNorms.length === 0) return 0

    const indicesToRemove = new Set<number>()
    let removedTotal = 0

    costs.forEach((cost, index) => {
      if (indicesToRemove.has(index)) return
      const costName = norm(cost?.name)
      const isMatch = guardNorms.some(guard => guard && costName.includes(guard))
      if (isMatch) {
        removedTotal += parseNum(cost?.amount)
        indicesToRemove.add(index)
      }
    })

    if (indicesToRemove.size > 0) {
      costs = costs.filter((_, index) => !indicesToRemove.has(index))
      if (conversionCosts) {
        conversionCosts = conversionCosts.filter((_, index) => !indicesToRemove.has(index))
      }
    }

    return removedTotal
  }

  const removedTotal = extras.reduce((sum, extra) => {
    const guards = Array.isArray(extra.replaceBaseGuards) ? extra.replaceBaseGuards : []
    return sum + removeMatchingBaseCosts(guards)
  }, 0)

  const deriveExchangeRate = () => {
    if (!conversionCosts || !Array.isArray(conversionCosts) || conversionCosts.length === 0) return null
    for (let i = 0; i < Math.min(costs.length, conversionCosts.length); i++) {
      const localAmount = parseNum(costs[i]?.amount)
      const usdAmount = parseNum(conversionCosts[i])
      if (localAmount > 0 && usdAmount > 0) {
        const rate = usdAmount / localAmount
        if (Number.isFinite(rate) && rate > 0) return rate
      }
    }
    return null
  }

  const exchangeRate = deriveExchangeRate()
  let addedTotal = 0

  extras.forEach(extra => {
    const amount = Number(extra.amount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const guards = Array.isArray(extra.guards) ? extra.guards : []
    const isDuplicate = guards.some(guard => existingContains(guard))
    if (isDuplicate) return

    costs.push({
      name: extra.name,
      amount: toAmountStr(amount),
      frequency: 'monthly',
      country: quote.country,
      country_code: quote.country_code
    })
    if (conversionCosts && exchangeRate !== null) {
      conversionCosts.push(Number((amount * exchangeRate).toFixed(2)))
    }
    addedTotal += amount
  })

  const baseTotal = parseNum(quote.total_costs)
  const updatedTotal = Number((baseTotal - removedTotal + addedTotal).toFixed(2))

  const updatedQuote: Quote = {
    ...quote,
    costs,
    total_costs: toAmountStr(updatedTotal),
    employer_costs: toAmountStr(updatedTotal)
  }

  const updatedConversions =
    conversionCosts && conversions
      ? {
        ...conversions,
        costs: conversionCosts
      }
      : conversions

  return {
    quote: updatedQuote,
    usdConversions: updatedConversions
  }
}

type AcidTestCategoryBuckets = {
  baseSalary: Record<string, number>
  statutoryMandatory: Record<string, number>
  allowancesBenefits: Record<string, number>
  terminationCosts: Record<string, number>
  oneTimeFees: Record<string, number>
  onboardingFees: Record<string, number>
}

type AcidTestAggregates = {
  baseSalaryMonthly: number
  statutoryMonthly: number
  allowancesMonthly: number
  terminationMonthly: number
  oneTimeTotal: number
  onboardingTotal: number
}

type AcidTestCostData = {
  provider: string
  currency: string
  categories: AcidTestCategoryBuckets
} & AcidTestAggregates

type AcidTestBreakdown = {
  salaryTotal: number
  statutoryTotal: number
  allowancesTotal: number
  terminationTotal: number
  oneTimeTotal: number
  onboardingTotal: number
  recurringMonthly: number
  recurringTotal: number
  // USD versions
  salaryTotalUSD?: number
  statutoryTotalUSD?: number
  allowancesTotalUSD?: number
  terminationTotalUSD?: number
  oneTimeTotalUSD?: number
  onboardingTotalUSD?: number
  recurringMonthlyUSD?: number
  recurringTotalUSD?: number
}

type BillRateComposition = {
  salaryMonthly: number
  statutoryMonthly: number
  terminationMonthly: number
  allowancesMonthly: number
  gracemarkFeeMonthly: number
  providerFeeMonthly: number
  expectedBillRate: number
  actualBillRate: number
  rateDiscrepancy: number
  gracemarkFeePercentage: number
  targetGracemarkFeeMonthly: number
  targetGracemarkFeePercentage: number
  // USD versions
  salaryMonthlyUSD?: number
  statutoryMonthlyUSD?: number
  terminationMonthlyUSD?: number
  allowancesMonthlyUSD?: number
  gracemarkFeeMonthlyUSD?: number
  providerFeeMonthlyUSD?: number
  expectedBillRateUSD?: number
  actualBillRateUSD?: number
  rateDiscrepancyUSD?: number
}

type AcidTestSummary = {
  currency: string
  billRateMonthly: number
  durationMonths: number
  revenueTotal: number
  totalCost: number
  profitLocal: number
  revenueUSD?: number
  totalCostUSD?: number
  profitUSD?: number
  marginMonthly: number
  marginTotal: number
  marginMonthlyUSD?: number
  marginTotalUSD?: number
  meetsPositive: boolean
  meetsMinimum: boolean
  minimumShortfallUSD?: number
}

type AcidTestCalculationResult = {
  summary: AcidTestSummary
  breakdown: AcidTestBreakdown
  billRateComposition: BillRateComposition
  thresholds: {
    minimumUSD: number
  }
  conversionError?: string | null
}

const GRACEMARK_FEE_PERCENTAGE = 0.45
const PROVIDER_FEE_RATIO = 0.30
type ConversionPayload = Awaited<ReturnType<typeof convertCurrency>>

const extractConvertedAmount = (conversion: ConversionPayload): number | undefined => {
  if (!conversion || !conversion.success || !conversion.data) return undefined
  const amount = Number(conversion.data.target_amount)
  return Number.isFinite(amount) ? amount : undefined
}

const LoadingSpinner = () => (
  <div role="status" aria-label="Loading quotes" className="flex items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
    <span className="sr-only">Loading...</span>
  </div>
)

const QuotePageContent = memo(() => {
  const searchParams = useSearchParams()
  const quoteId = searchParams.get('id')
  
  const {
    quoteData,
    loading,
    currentProvider,
    switchProvider,
    providerLoading,
    providerStates,
    enhancementBatchInfo,
    isComparisonReady,
    isDualCurrencyComparisonReady
  } = useQuoteResults(quoteId)
  
  const {
    usdConversions,
    isConvertingDeelToUsd,
    isConvertingCompareToUsd,
    isConvertingRemoteToUsd,
    isConvertingCompareRemoteToUsd,
    isConvertingRivermateToUsd,
    isConvertingCompareRivermateToUsd,
    isConvertingOysterToUsd,
    isConvertingCompareOysterToUsd,
    isConvertingRipplingToUsd,
    isConvertingCompareRipplingToUsd,
    isConvertingSkuadToUsd,
    isConvertingCompareSkuadToUsd,
    isConvertingVelocityToUsd,
    isConvertingCompareVelocityToUsd,
    isConvertingPlayrollToUsd,
    isConvertingComparePlayrollToUsd,
    isConvertingOmnipresentToUsd,
    isConvertingCompareOmnipresentToUsd,
    usdConversionError,
    autoConvertQuote,
    autoConvertRemoteQuote,
  } = useUSDConversion()

  // --- RECONCILIATION STATE ---
  const { enhancements } = useEnhancementContext()
  const [isReconModalOpen, setIsReconModalOpen] = useState(false)
  const [finalChoice, setFinalChoice] = useState<{
    provider: string;
    price: number;
    currency: string;
    enhancedQuote?: EnhancedQuote;
  } | null>(null)

  // Timeline-style reconciliation state
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set())
  const [activePhase, setActivePhase] = useState<'gathering' | 'analyzing' | 'selecting' | 'complete' | null>('gathering')
  const [progressPercent, setProgressPercent] = useState(0)
  const [providerData, setProviderData] = useState<{ provider: string; price: number; inRange?: boolean; isWinner?: boolean }[]>([])

  // Acid Test state
  const [acidTestError, setAcidTestError] = useState<string | null>(null)

  // Acid Test Form state
  const [showAcidTestForm, setShowAcidTestForm] = useState(false)
  const [monthlyBillRate, setMonthlyBillRate] = useState<number>(0)
  const [projectDuration, setProjectDuration] = useState<number>(6)
  const [isAllInclusiveQuote, setIsAllInclusiveQuote] = useState<boolean>(true)
  const [acidTestResults, setAcidTestResults] = useState<AcidTestCalculationResult | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [cachedCostItems, setCachedCostItems] = useState<Partial<Record<ProviderType, Array<{ key: string; name: string; monthly_amount: number }>>>>({})
  const [providerTotals, setProviderTotals] = useState<Partial<Record<ProviderType, { amount: number | null; currency?: string; ready: boolean }>>>({})

  // New Bill Rate Calculator state
  const [billRateInput, setBillRateInput] = useState<number>(0)
  const [billRateCurrency, setBillRateCurrency] = useState<'local' | 'USD'>('local')
  const [durationInput, setDurationInput] = useState<number>(6)
  const [profitabilityResults, setProfitabilityResults] = useState<{
    totalRevenue: number
    totalCosts: number
    profit: number
    profitUSD?: number
    isProfit: boolean
    meetsMinimum: boolean
    currency: string
    totalRevenueOther?: number
    totalCostsOther?: number
    otherCurrency?: string
  } | null>(null)
  const [isCalculatingProfitability, setIsCalculatingProfitability] = useState(false)

  const allProviders = PROVIDER_LIST

  const acidTestHasUSDData = useMemo(() => {
    if (!acidTestResults) return false
    if (acidTestResults.summary.currency === 'USD') return false

    const { summary, breakdown, billRateComposition } = acidTestResults
    const summaryUSD = [
      summary.revenueUSD,
      summary.totalCostUSD,
      summary.profitUSD,
      summary.marginMonthlyUSD,
      summary.marginTotalUSD,
    ]
    const breakdownUSD = [
      breakdown.salaryTotalUSD,
      breakdown.statutoryTotalUSD,
      breakdown.allowancesTotalUSD,
      breakdown.terminationTotalUSD,
      breakdown.oneTimeTotalUSD,
      breakdown.recurringMonthlyUSD,
      breakdown.recurringTotalUSD,
    ]
    const compositionUSD = [
      billRateComposition.salaryMonthlyUSD,
      billRateComposition.statutoryMonthlyUSD,
      billRateComposition.allowancesMonthlyUSD,
      billRateComposition.terminationMonthlyUSD,
      billRateComposition.gracemarkFeeMonthlyUSD,
      billRateComposition.providerFeeMonthlyUSD,
      billRateComposition.expectedBillRateUSD,
      billRateComposition.actualBillRateUSD,
      billRateComposition.rateDiscrepancyUSD,
    ]

    return [...summaryUSD, ...breakdownUSD, ...compositionUSD].some(value => typeof value === 'number')
  }, [acidTestResults])

  const contractMonths = useMemo(() => {
    const form = quoteData?.formData as EORFormData | undefined
    const durationRaw = form?.contractDuration
    const parsed = Number.parseInt(typeof durationRaw === 'string' ? durationRaw : String(durationRaw ?? ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
    return 12
  }, [quoteData?.formData])

  useEffect(() => {
    setCachedCostItems({})
  }, [enhancements, quoteData])

  useEffect(() => {
    if (!quoteData?.quotes) return
    const formData = quoteData.formData as EORFormData | undefined
    const defaultCurrency = formData?.currency || 'USD'
    const localOfficeInfo = formData?.localOfficeInfo

    const totalsByProvider = new Map<ProviderType, { amount: number; currency?: string }>()
    const itemsByProvider = new Map<ProviderType, Array<{ key: string; name: string; monthly_amount: number }>>()

    allProviders.forEach(provider => {
      const enhancedQuote = enhancements[provider]
      const providerState = providerStates[provider]

      // Check if provider failed or is inactive
      const hasFailed = providerState?.status === 'failed' || providerState?.status === 'inactive' || providerState?.status === 'enhancement-failed'

      if (hasFailed) {
        // Mark failed providers as ready with null amount so they don't block reconciliation
        totalsByProvider.set(provider, { amount: null as any, currency: defaultCurrency })
        return
      }

      // Get the base quote from the provider's API response
      let baseQuote: Quote | undefined = undefined
      const rawQuote = quoteData.quotes[provider]

      if (rawQuote) {
        // Transform provider-specific responses to Quote format
        if (provider === 'remote') {
          baseQuote = transformRemoteResponseToQuote(rawQuote as RemoteAPIResponse)
        } else if (provider === 'rivermate') {
          baseQuote = transformRivermateQuoteToDisplayQuote(rawQuote as RivermateQuote)
        } else if (provider === 'oyster') {
          baseQuote = transformOysterQuoteToDisplayQuote(rawQuote as OysterQuote)
        } else {
          // For other providers (deel, rippling, skuad, velocity, playroll, omnipresent)
          baseQuote = rawQuote as Quote
        }
      }

      // Build items exactly as displayed in UI: base costs + filtered enhancement extras
      const builtItems = buildDisplayedItems(enhancedQuote, baseQuote, localOfficeInfo, formData?.contractType)

      if (builtItems.length > 0) {
        // Sum the items - this matches what's displayed in UI
        const sum = Number(builtItems.reduce((acc, item) => acc + item.monthly_amount, 0).toFixed(2))
        const currency = enhancedQuote?.displayCurrency || baseQuote?.currency || defaultCurrency

        totalsByProvider.set(provider, { amount: sum, currency })
        itemsByProvider.set(provider, builtItems)
      } else {
        // No items but provider hasn't failed - mark as ready with 0
        totalsByProvider.set(provider, { amount: 0, currency: defaultCurrency })
      }
    })

    if (itemsByProvider.size > 0) {
      setCachedCostItems(prev => {
        let changed = false
        const next = { ...prev }
        itemsByProvider.forEach((items, provider) => {
          const existing = prev[provider]
          const sameLength = existing?.length === items.length
          const isSame = sameLength && existing ? existing.every((entry, idx) => {
            const target = items[idx]
            return entry.key === target.key && entry.name === target.name && entry.monthly_amount === target.monthly_amount
          }) : false
          if (!isSame) {
            next[provider] = items
            changed = true
          }
        })
        return changed ? next : prev
      })
    }

    if (totalsByProvider.size > 0) {
      setProviderTotals(prev => {
        let changed = false
        const next = { ...prev }
        totalsByProvider.forEach((info, provider) => {
          const existing = prev[provider]
          if (!existing || existing.amount !== info.amount || existing.currency !== info.currency || !existing.ready) {
            next[provider] = { amount: info.amount, currency: info.currency, ready: true }
            changed = true
          }
        })
        return changed ? next : prev
      })
    }
  }, [allProviders, enhancements, quoteData?.formData, quoteData?.quotes, contractMonths, providerStates])

  const [acidTestValidation, setAcidTestValidation] = useState<{
    billRateError?: string;
    durationError?: string;
  }>({})
  const [acidTestCostData, setAcidTestCostData] = useState<AcidTestCostData | null>(null)
  const [isCategorizingCosts, setIsCategorizingCosts] = useState(false)
  const [isComputingAcidTest, setIsComputingAcidTest] = useState(false)

  const MIN_PROFIT_THRESHOLD_USD = 1000

  const acidTestKpiMetrics = useMemo(() => {
    if (!acidTestResults || !acidTestCostData) return null

    const localCurrency = acidTestCostData.currency || acidTestResults.summary.currency || 'USD'
    const { billRateComposition, breakdown, summary } = acidTestResults

    const baseLocal = roundToCents(readNumericValue(billRateComposition.salaryMonthly))
    const statutoryLocal = roundToCents(readNumericValue(billRateComposition.statutoryMonthly))
    const allowancesLocal = roundToCents(readNumericValue(billRateComposition.allowancesMonthly))
    const terminationLocal = roundToCents(readNumericValue(billRateComposition.terminationMonthly))
    const onboardingLocal = roundToCents(readNumericValue(acidTestCostData.onboardingTotal))
    const gracemarkLocal = roundToCents(readNumericValue(billRateComposition.gracemarkFeeMonthly))

    const resolvedDuration = projectDuration > 0
      ? projectDuration
      : (summary?.durationMonths && summary.durationMonths > 0 ? summary.durationMonths : 0)

    // Monthly costs
    const monthlyAssignmentCost = roundToCents(
      baseLocal + statutoryLocal + allowancesLocal + terminationLocal
    )
    const monthlyBillRate = roundToCents(monthlyAssignmentCost + gracemarkLocal)

    // Total costs over contract duration
    const totalAssignmentLocal = resolvedDuration > 0
      ? roundToCents(monthlyAssignmentCost * resolvedDuration)
      : monthlyAssignmentCost

    const billRateLocal = resolvedDuration > 0
      ? roundToCents((monthlyAssignmentCost + gracemarkLocal) * resolvedDuration + onboardingLocal)
      : roundToCents(monthlyAssignmentCost + onboardingLocal + gracemarkLocal)

    const totalProfitLocal = roundToCents(billRateLocal - totalAssignmentLocal)

    const monthlyMarkupLocal = resolvedDuration > 0
      ? roundToCents(totalProfitLocal / resolvedDuration)
      : null

    const baseUSD = readOptionalNumericValue(billRateComposition.salaryMonthlyUSD)
    const statutoryUSD = readOptionalNumericValue(billRateComposition.statutoryMonthlyUSD)
    const allowancesUSD = readOptionalNumericValue(billRateComposition.allowancesMonthlyUSD)
    const terminationUSD = readOptionalNumericValue(billRateComposition.terminationMonthlyUSD)
    const onboardingUSD = readOptionalNumericValue(breakdown.onboardingTotalUSD)
    const gracemarkUSD = readOptionalNumericValue(billRateComposition.gracemarkFeeMonthlyUSD)

    let totalAssignmentUSD: number | null = null
    if (
      baseUSD !== null &&
      statutoryUSD !== null &&
      allowancesUSD !== null &&
      terminationUSD !== null
    ) {
      const monthlyAssignmentUSD = roundToCents(
        baseUSD + statutoryUSD + allowancesUSD + terminationUSD
      )
      totalAssignmentUSD = resolvedDuration > 0
        ? roundToCents(monthlyAssignmentUSD * resolvedDuration)
        : monthlyAssignmentUSD
    } else if (localCurrency === 'USD') {
      totalAssignmentUSD = totalAssignmentLocal
    }

    let billRateUSD: number | null = null
    if (
      baseUSD !== null &&
      statutoryUSD !== null &&
      allowancesUSD !== null &&
      terminationUSD !== null &&
      onboardingUSD !== null &&
      gracemarkUSD !== null
    ) {
      const monthlyBillRateUSD = roundToCents(
        baseUSD + statutoryUSD + allowancesUSD + terminationUSD + gracemarkUSD
      )
      billRateUSD = resolvedDuration > 0
        ? roundToCents(monthlyBillRateUSD * resolvedDuration + onboardingUSD)
        : roundToCents(monthlyBillRateUSD + onboardingUSD)
    } else if (localCurrency === 'USD') {
      billRateUSD = billRateLocal
    }

    const totalProfitUSD =
      billRateUSD !== null && totalAssignmentUSD !== null
        ? roundToCents(billRateUSD - totalAssignmentUSD)
        : (localCurrency === 'USD' ? totalProfitLocal : null)

    const monthlyMarkupUSD =
      totalProfitUSD !== null && resolvedDuration > 0
        ? roundToCents(totalProfitUSD / resolvedDuration)
        : null

    const markupStyle = (() => {
      if (monthlyMarkupUSD === null) {
        return {
          container: 'bg-slate-50 border-slate-200',
          value: 'text-slate-800',
          accent: 'text-slate-600'
        }
      }
      if (monthlyMarkupUSD >= 1000) {
        return {
          container: 'bg-emerald-50 border-emerald-200',
          value: 'text-emerald-700',
          accent: 'text-emerald-600'
        }
      }
      if (monthlyMarkupUSD >= 900) {
        return {
          container: 'bg-lime-50 border-lime-200',
          value: 'text-lime-700',
          accent: 'text-lime-600'
        }
      }
      if (monthlyMarkupUSD >= 800) {
        return {
          container: 'bg-amber-50 border-amber-200',
          value: 'text-amber-700',
          accent: 'text-amber-600'
        }
      }
      if (monthlyMarkupUSD >= 600) {
        return {
          container: 'bg-orange-50 border-orange-200',
          value: 'text-orange-700',
          accent: 'text-orange-600'
        }
      }
      return {
        container: 'bg-rose-50 border-rose-200',
        value: 'text-rose-700',
        accent: 'text-rose-600'
      }
    })()

    // Calculate monthly bill rate
    const monthlyBillRateLocal = resolvedDuration > 0
      ? roundToCents((billRateLocal - onboardingLocal) / resolvedDuration)
      : roundToCents(billRateLocal - onboardingLocal)

    const monthlyBillRateUSD =
      billRateUSD !== null && onboardingUSD !== null
        ? (resolvedDuration > 0
            ? roundToCents((billRateUSD - onboardingUSD) / resolvedDuration)
            : roundToCents(billRateUSD - onboardingUSD))
        : (localCurrency === 'USD' ? monthlyBillRateLocal : null)

    return {
      localCurrency,
      duration: resolvedDuration,
      totals: {
        assignment: { local: totalAssignmentLocal, usd: totalAssignmentUSD },
        billRate: { local: billRateLocal, usd: billRateUSD },
        monthlyBillRate: { local: monthlyBillRateLocal, usd: monthlyBillRateUSD },
        profit: { local: totalProfitLocal, usd: totalProfitUSD },
        markup: { local: monthlyMarkupLocal, usd: monthlyMarkupUSD }
      },
      markupStyle
    }
  }, [acidTestResults, acidTestCostData, projectDuration])

  const providerHasCostItems = useCallback((provider: ProviderType) => {
    const items = cachedCostItems[provider]
    return Array.isArray(items) && items.length > 0
  }, [cachedCostItems])

  const getProviderPrice = (provider: ProviderType): number | null => {
    const items = cachedCostItems[provider]
    if (!Array.isArray(items) || items.length === 0) {
      return null
    }
    const sum = items.reduce((acc, item) => acc + Number(item.monthly_amount || 0), 0)
    return Number(sum.toFixed(2))
  }

  const updateProviderTotalsFromItems = useCallback((
    provider: ProviderType,
    items: Array<{ monthly_amount: number }>,
    currency?: string
  ) => {
    const total = Number(items.reduce((sum, item) => sum + Number(item.monthly_amount || 0), 0).toFixed(2))

    setProviderTotals(prev => {
      const existing = prev[provider]
      const displayCurrency = currency || existing?.currency
      if (existing && existing.ready && existing.amount === total && existing.currency === displayCurrency) {
        return prev
      }
      return {
        ...prev,
        [provider]: {
          amount: total,
          currency: displayCurrency,
          ready: true
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!quoteData?.quotes) return
    const defaultCurrency = (quoteData.formData as EORFormData)?.currency || 'USD'
    setProviderTotals(prev => {
      const next = { ...prev }
      let changed = false
      allProviders.forEach(provider => {
        if (!next[provider]) {
          next[provider] = { amount: null, currency: defaultCurrency, ready: false }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [allProviders, quoteData?.formData?.currency, quoteData?.quotes])

  useEffect(() => {
    if (!quoteData?.quotes) return
    const defaultCurrency = (quoteData.formData as EORFormData)?.currency || 'USD'
    setProviderTotals(prev => {
      let changed = false
      const next = { ...prev }
      allProviders.forEach(provider => {
        const existing = next[provider]
        if (existing?.ready) return
        const status = providerStates[provider]?.status
        if (status && ['enhancement-failed', 'failed', 'inactive'].includes(status)) {
          const fallbackTotal = computeProviderPriceFromSource(provider, quoteData, enhancements, contractMonths)
          if (fallbackTotal !== null) {
            const quoteEntry = (quoteData.quotes as Record<string, any>)[provider]
            const currency = existing?.currency || quoteEntry?.currency || defaultCurrency
            next[provider] = {
              amount: fallbackTotal,
              currency,
              ready: true
            }
            changed = true
          }
        }
      })
      return changed ? next : prev
    })
  }, [allProviders, providerStates, quoteData, enhancements, contractMonths])


  const buildAcidTestCalculation = useCallback(async (
    costData: AcidTestCostData,
    billRate: number,
    duration: number,
    isAllInclusive: boolean
  ): Promise<AcidTestCalculationResult> => {
    // Calculate component totals for full assignment (for breakdown display)
    const salaryTotal = costData.baseSalaryMonthly * duration
    const statutoryTotal = costData.statutoryMonthly * duration
    const allowancesTotal = costData.allowancesMonthly * duration
    // Only include termination costs if it's an all-inclusive quote
    const terminationTotal = isAllInclusive ? (costData.terminationMonthly * duration) : 0
    const oneTimeTotal = costData.oneTimeTotal
    const onboardingTotal = costData.onboardingTotal
    const nonPassThroughOneTimeLocal = Math.max(0, oneTimeTotal - onboardingTotal)

    // For display purposes only - these are not used in the main calculation
    const coreMonthlyCost = costData.baseSalaryMonthly + costData.statutoryMonthly + costData.allowancesMonthly
    const terminationMonthlyFull = costData.terminationMonthly
    const actualMonthlyQuote = billRate

    // Calculate monthly recurring costs from actual categorized components
    const recurringMonthly = costData.baseSalaryMonthly + costData.statutoryMonthly +
                            costData.allowancesMonthly +
                            (isAllInclusive ? costData.terminationMonthly : 0)

    // Target Gracemark fee (_policy_) and expected bill rate
    const targetGracemarkFeeMonthly = recurringMonthly * GRACEMARK_FEE_PERCENTAGE
    const expectedBillRateMonthly = recurringMonthly + targetGracemarkFeeMonthly

    // Actual Gracemark fee based on current bill rate
    const actualGracemarkFeeMonthly = billRate - recurringMonthly
    const gracemarkFeePercentage = recurringMonthly !== 0 ? actualGracemarkFeeMonthly / recurringMonthly : 0

    // Provider fee share from the actual Gracemark fee (never negative)
    const providerFeeMonthly = Math.max(actualGracemarkFeeMonthly, 0) * PROVIDER_FEE_RATIO

    // Total costs for full assignment (for cash flow check)
    const recurringTotal = recurringMonthly * duration
    const totalCostsGracemark = recurringTotal + oneTimeTotal // Everything Gracemark pays out

    // Actual values from input
    const actualRevenueTotal = billRate * duration + onboardingTotal
    const rateDiscrepancy = billRate - expectedBillRateMonthly

    // Cash flow calculation: Revenue vs what we pay out
    const profitLocal = actualRevenueTotal - totalCostsGracemark

    const marginMonthly = actualGracemarkFeeMonthly
    const marginTotal = marginMonthly * duration - nonPassThroughOneTimeLocal

    // Comprehensive USD conversion
    let revenueUSD: number | undefined
    let totalCostUSD: number | undefined
    let profitUSD: number | undefined
    let conversionError: string | null = null

    // USD versions for breakdown
    let salaryTotalUSD: number | undefined
    let statutoryTotalUSD: number | undefined
    let allowancesTotalUSD: number | undefined
    let terminationTotalUSD: number | undefined
    let oneTimeTotalUSD: number | undefined
    let onboardingTotalUSD: number | undefined
    let recurringMonthlyUSD: number | undefined
    let recurringTotalUSD: number | undefined

    // USD versions for bill rate composition
    let salaryMonthlyUSD: number | undefined
    let statutoryMonthlyUSD: number | undefined
    let allowancesMonthlyUSD: number | undefined
    let terminationMonthlyUSD: number | undefined
    let gracemarkFeeMonthlyUSD: number | undefined
    let providerFeeMonthlyUSD: number | undefined
    let expectedBillRateUSD: number | undefined
    let actualBillRateUSD: number | undefined
    let rateDiscrepancyUSD: number | undefined
    let marginMonthlyUSD: number | undefined
    let marginTotalUSD: number | undefined

    if (costData.currency === 'USD') {
      // Direct assignment for USD currency
      revenueUSD = actualRevenueTotal
      totalCostUSD = totalCostsGracemark
      profitUSD = profitLocal

      // Breakdown USD values
      salaryTotalUSD = salaryTotal
      statutoryTotalUSD = statutoryTotal
      allowancesTotalUSD = allowancesTotal
      terminationTotalUSD = terminationTotal
      oneTimeTotalUSD = oneTimeTotal
      onboardingTotalUSD = onboardingTotal
      recurringMonthlyUSD = recurringMonthly
      recurringTotalUSD = recurringTotal

      // Bill rate composition USD values
      salaryMonthlyUSD = costData.baseSalaryMonthly
      statutoryMonthlyUSD = costData.statutoryMonthly
      allowancesMonthlyUSD = costData.allowancesMonthly
      terminationMonthlyUSD = isAllInclusive ? costData.terminationMonthly : 0
      gracemarkFeeMonthlyUSD = actualGracemarkFeeMonthly
      providerFeeMonthlyUSD = providerFeeMonthly
      expectedBillRateUSD = expectedBillRateMonthly
      actualBillRateUSD = billRate
      rateDiscrepancyUSD = rateDiscrepancy
      marginMonthlyUSD = marginMonthly
      marginTotalUSD = marginTotal
    } else {
      try {
        // Convert all values to USD in parallel
        const conversions = await Promise.all([
          convertCurrency(actualRevenueTotal, costData.currency, 'USD'),
          convertCurrency(totalCostsGracemark, costData.currency, 'USD'),
          convertCurrency(salaryTotal, costData.currency, 'USD'),
          convertCurrency(statutoryTotal, costData.currency, 'USD'),
          convertCurrency(allowancesTotal, costData.currency, 'USD'),
          convertCurrency(terminationTotal, costData.currency, 'USD'),
          convertCurrency(oneTimeTotal, costData.currency, 'USD'),
          convertCurrency(onboardingTotal, costData.currency, 'USD'),
          convertCurrency(recurringMonthly, costData.currency, 'USD'),
          convertCurrency(recurringTotal, costData.currency, 'USD'),
          convertCurrency(costData.baseSalaryMonthly, costData.currency, 'USD'),
          convertCurrency(costData.statutoryMonthly, costData.currency, 'USD'),
          convertCurrency(costData.allowancesMonthly, costData.currency, 'USD'),
          convertCurrency(isAllInclusive ? costData.terminationMonthly : 0, costData.currency, 'USD'),
          convertCurrency(actualGracemarkFeeMonthly, costData.currency, 'USD'),
          convertCurrency(providerFeeMonthly, costData.currency, 'USD'),
          convertCurrency(expectedBillRateMonthly, costData.currency, 'USD'),
          convertCurrency(billRate, costData.currency, 'USD'),
          convertCurrency(rateDiscrepancy, costData.currency, 'USD')
        ])

        const [
          revenueConv, totalCostConv, salaryTotalConv, statutoryTotalConv, allowancesTotalConv,
          terminationTotalConv, oneTimeTotalConv, onboardingTotalConv, recurringMonthlyConv, recurringTotalConv,
          salaryMonthlyConv, statutoryMonthlyConv, allowancesMonthlyConv, terminationMonthlyConv,
          gracemarkFeeMonthlyConv, providerFeeMonthlyConv, expectedBillRateConv, actualBillRateConv,
          rateDiscrepancyConv
        ] = conversions

        // Extract successful conversions
        if (revenueConv.success && revenueConv.data) revenueUSD = revenueConv.data.target_amount
        if (totalCostConv.success && totalCostConv.data) totalCostUSD = totalCostConv.data.target_amount
        if (salaryTotalConv.success && salaryTotalConv.data) salaryTotalUSD = salaryTotalConv.data.target_amount
        if (statutoryTotalConv.success && statutoryTotalConv.data) statutoryTotalUSD = statutoryTotalConv.data.target_amount
        if (allowancesTotalConv.success && allowancesTotalConv.data) allowancesTotalUSD = allowancesTotalConv.data.target_amount
        if (terminationTotalConv.success && terminationTotalConv.data) terminationTotalUSD = terminationTotalConv.data.target_amount
        if (oneTimeTotalConv.success && oneTimeTotalConv.data) oneTimeTotalUSD = oneTimeTotalConv.data.target_amount
        if (onboardingTotalConv.success && onboardingTotalConv.data) onboardingTotalUSD = onboardingTotalConv.data.target_amount
        if (recurringMonthlyConv.success && recurringMonthlyConv.data) recurringMonthlyUSD = recurringMonthlyConv.data.target_amount
        if (recurringTotalConv.success && recurringTotalConv.data) recurringTotalUSD = recurringTotalConv.data.target_amount
        if (salaryMonthlyConv.success && salaryMonthlyConv.data) salaryMonthlyUSD = salaryMonthlyConv.data.target_amount
        if (statutoryMonthlyConv.success && statutoryMonthlyConv.data) statutoryMonthlyUSD = statutoryMonthlyConv.data.target_amount
        if (allowancesMonthlyConv.success && allowancesMonthlyConv.data) allowancesMonthlyUSD = allowancesMonthlyConv.data.target_amount
        if (terminationMonthlyConv.success && terminationMonthlyConv.data) terminationMonthlyUSD = terminationMonthlyConv.data.target_amount
        if (gracemarkFeeMonthlyConv.success && gracemarkFeeMonthlyConv.data) gracemarkFeeMonthlyUSD = gracemarkFeeMonthlyConv.data.target_amount
        if (providerFeeMonthlyConv.success && providerFeeMonthlyConv.data) providerFeeMonthlyUSD = providerFeeMonthlyConv.data.target_amount
        if (expectedBillRateConv.success && expectedBillRateConv.data) expectedBillRateUSD = expectedBillRateConv.data.target_amount
        if (actualBillRateConv.success && actualBillRateConv.data) actualBillRateUSD = actualBillRateConv.data.target_amount
        if (rateDiscrepancyConv.success && rateDiscrepancyConv.data) rateDiscrepancyUSD = rateDiscrepancyConv.data.target_amount

        if (typeof actualBillRateUSD === 'number' && typeof recurringMonthlyUSD === 'number') {
          marginMonthlyUSD = actualBillRateUSD - recurringMonthlyUSD
        }
        if (typeof marginMonthlyUSD === 'number') {
          const nonPassThroughOneTimeUSD = Math.max(0, (oneTimeTotalUSD ?? 0) - (onboardingTotalUSD ?? 0))
          marginTotalUSD = marginMonthlyUSD * duration - nonPassThroughOneTimeUSD
        }

        // Calculate USD profit if we have both values
        if (revenueUSD !== undefined && totalCostUSD !== undefined) {
          profitUSD = revenueUSD - totalCostUSD
        }

        // Collect any conversion errors
        const errors = conversions.filter(c => !c.success).map(c => c.error).filter(Boolean)
        if (errors.length > 0) {
          conversionError = `Currency conversion errors: ${errors.join('; ')}`
        }
      } catch (err) {
        conversionError = err instanceof Error ? err.message : 'Unable to convert currency to USD'
      }
    }

    const meetsPositive = profitLocal > 0
    const profitForMinimum = typeof profitUSD === 'number'
      ? profitUSD
      : (costData.currency === 'USD' ? profitLocal : undefined)
    const meetsMinimum = typeof profitForMinimum === 'number'
      ? profitForMinimum >= MIN_PROFIT_THRESHOLD_USD
      : false
    const minimumShortfallUSD = typeof profitForMinimum === 'number'
      ? Math.max(0, MIN_PROFIT_THRESHOLD_USD - profitForMinimum)
      : undefined

    return {
      summary: {
        currency: costData.currency,
        billRateMonthly: billRate,
        durationMonths: duration,
        revenueTotal: actualRevenueTotal,
        totalCost: totalCostsGracemark,
        profitLocal,
        revenueUSD,
        totalCostUSD,
        profitUSD,
        marginMonthly,
        marginTotal,
        marginMonthlyUSD,
        marginTotalUSD,
        meetsPositive,
        meetsMinimum,
        minimumShortfallUSD,
      },
      breakdown: {
        salaryTotal,
        statutoryTotal,
        allowancesTotal,
        terminationTotal,
        oneTimeTotal,
        onboardingTotal,
        recurringMonthly,
        recurringTotal,
        // USD versions
        salaryTotalUSD,
        statutoryTotalUSD,
        allowancesTotalUSD,
        terminationTotalUSD,
        oneTimeTotalUSD,
        onboardingTotalUSD,
        recurringMonthlyUSD,
        recurringTotalUSD,
      },
      billRateComposition: {
        salaryMonthly: costData.baseSalaryMonthly,
        statutoryMonthly: costData.statutoryMonthly,
        terminationMonthly: isAllInclusive ? costData.terminationMonthly : 0,
        allowancesMonthly: costData.allowancesMonthly,
        gracemarkFeeMonthly: actualGracemarkFeeMonthly,
        providerFeeMonthly: providerFeeMonthly,
        expectedBillRate: expectedBillRateMonthly,
        actualBillRate: billRate,
        rateDiscrepancy: rateDiscrepancy,
        gracemarkFeePercentage: gracemarkFeePercentage,
        targetGracemarkFeeMonthly,
        targetGracemarkFeePercentage: GRACEMARK_FEE_PERCENTAGE,
        // USD versions
        salaryMonthlyUSD,
        statutoryMonthlyUSD,
        terminationMonthlyUSD,
        allowancesMonthlyUSD,
        gracemarkFeeMonthlyUSD,
        providerFeeMonthlyUSD,
        expectedBillRateUSD,
        actualBillRateUSD,
        rateDiscrepancyUSD,
      },
      thresholds: {
        minimumUSD: MIN_PROFIT_THRESHOLD_USD,
      },
      conversionError,
    }
  }, [finalChoice])

  const calculateProfitability = useCallback(async (
    billRate: number,
    duration: number
  ) => {
    if (!acidTestCostData || billRate <= 0 || duration <= 0) {
      setProfitabilityResults(null)
      return
    }

    setIsCalculatingProfitability(true)

    try {

    const localCurrency = acidTestCostData.currency
    const billCurrency = billRateCurrency === 'local' ? localCurrency : 'USD'

    // Get expected bill rate from cost structure breakdown (includes all monthly costs + Gracemark fee)
    const expectedBillRateLocal = acidTestResults?.billRateComposition.expectedBillRate ?? 0

    if (expectedBillRateLocal <= 0) {
      throw new Error('Expected bill rate not available from cost structure breakdown')
    }

    // Calculate total costs using expected bill rate (what we charge per month)
    const totalRecurringCostsLocal = expectedBillRateLocal * duration
    const totalCostsLocal = totalRecurringCostsLocal + acidTestCostData.oneTimeTotal
    const onboardingTotal = acidTestCostData.onboardingTotal

    // Calculate total revenue and costs in the same currency for comparison
    let totalRevenue: number
    let totalCosts: number
    let revenueInOtherCurrency: number | undefined
    let costsInOtherCurrency: number | undefined

    try {
      if (billCurrency === localCurrency) {
        // Both in local currency
        totalRevenue = billRate * duration + onboardingTotal
        totalCosts = totalCostsLocal

        // Convert to USD for display
        if (localCurrency !== 'USD') {
          const revenueConversion = await convertCurrency(totalRevenue, localCurrency, 'USD')
          const costsConversion = await convertCurrency(totalCosts, localCurrency, 'USD')

          revenueInOtherCurrency = extractConvertedAmount(revenueConversion)
          costsInOtherCurrency = extractConvertedAmount(costsConversion)
        }
      } else {
        // Bill rate in USD, costs in local currency
        totalRevenue = billRate * duration // in USD
        const onboardingConversion = await convertCurrency(onboardingTotal, localCurrency, 'USD')
        const onboardingUSD = extractConvertedAmount(onboardingConversion)

        if (onboardingUSD === null || onboardingUSD === undefined) {
          throw new Error(`Failed to convert onboarding fees from ${localCurrency} to USD`)
        }

        totalRevenue += onboardingUSD
        const costsConversion = await convertCurrency(totalCostsLocal, localCurrency, 'USD')
        const convertedCostsUSD = extractConvertedAmount(costsConversion)

        if (convertedCostsUSD === null || convertedCostsUSD === undefined) {
          throw new Error(`Failed to convert costs from ${localCurrency} to USD`)
        }

        totalCosts = convertedCostsUSD

        const revenueLocalConversion = await convertCurrency(totalRevenue, 'USD', localCurrency)
        revenueInOtherCurrency = extractConvertedAmount(revenueLocalConversion)
        costsInOtherCurrency = totalCostsLocal
      }
    } catch (error) {
      console.error('Currency conversion failed:', error)
      // Don't proceed with mixed currencies - let the error bubble up
      throw new Error(`Cannot calculate profitability: Currency conversion failed for ${localCurrency} to USD`)
    }

    // Calculate profit in the primary currency
    const profit = totalRevenue - totalCosts
    const isProfit = profit > 0

    // Convert to USD for minimum check
    let profitUSD: number | undefined
    let meetsMinimum = false

    try {
      if (billCurrency === 'USD') {
        profitUSD = profit
      } else {
        const profitConversion = await convertCurrency(profit, localCurrency, 'USD')
        profitUSD = extractConvertedAmount(profitConversion)
      }

      meetsMinimum = profitUSD !== undefined && profitUSD >= MIN_PROFIT_THRESHOLD_USD
    } catch (error) {
      console.error('Currency conversion failed:', error)
      profitUSD = undefined
    }

      setProfitabilityResults({
        totalRevenue,
        totalCosts,
        profit,
        profitUSD,
        isProfit,
        meetsMinimum,
        currency: billCurrency,
        // Additional data for dual currency display
        totalRevenueOther: revenueInOtherCurrency,
        totalCostsOther: costsInOtherCurrency,
        otherCurrency: billCurrency === 'USD' ? localCurrency : 'USD'
      })
    } catch (error) {
      console.error('Profitability calculation failed:', error)
      setProfitabilityResults(null)
    } finally {
      setIsCalculatingProfitability(false)
    }
  }, [acidTestCostData, acidTestResults, billRateCurrency, convertCurrency, isAllInclusiveQuote])

  useEffect(() => {
    if (!showAcidTestForm) {
      setIsComputingAcidTest(false)
      return
    }

    if (!acidTestCostData || !finalChoice) {
      setIsComputingAcidTest(false)
      setAcidTestResults(null)
      return
    }

    const resolvedBillRate = monthlyBillRate > 0 ? monthlyBillRate : (finalChoice.price || 0)
    const resolvedDuration = projectDuration

    if (resolvedBillRate <= 0 || resolvedDuration <= 0) {
      setIsComputingAcidTest(false)
      setAcidTestResults(null)
      return
    }

    let cancelled = false
    setIsComputingAcidTest(true)

    buildAcidTestCalculation(acidTestCostData, resolvedBillRate, resolvedDuration, isAllInclusiveQuote)
      .then(result => {
        if (!cancelled) {
          setAcidTestError(null)
          setAcidTestResults(result)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to compute acid test results', err)
          setAcidTestError('Failed to compute acid test results. Please try again.')
          setAcidTestResults(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsComputingAcidTest(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    showAcidTestForm,
    acidTestCostData,
    finalChoice,
    monthlyBillRate,
    projectDuration,
    isAllInclusiveQuote,
    buildAcidTestCalculation
  ])

  // Auto-populate profitability calculator when acid test results are ready
  useEffect(() => {
    const populateProfitabilityInputs = async () => {
      // console.log('[Profitability Auto-fill] Starting...', {
      //   hasAcidTestCostData: !!acidTestCostData,
      //   hasAcidTestResults: !!acidTestResults
      // })

      if (!acidTestCostData || !acidTestResults) {
        // console.log('[Profitability Auto-fill] Missing data, skipping')
        return
      }

      // 1. Pre-fill duration from contract duration
      const contractDuration = Number((quoteData?.formData as EORFormData)?.contractDuration) || 6
      // console.log('[Profitability Auto-fill] Setting duration:', contractDuration)
      setDurationInput(contractDuration)

      // 2. Calculate minimum bill rate for $1,000 USD profit
      const localCurrency = acidTestCostData.currency

      // Use the expectedBillRate from the breakdown table (already includes all costs + Gracemark fee)
      const expectedBillRate = acidTestResults.billRateComposition.expectedBillRate

      // console.log('[Profitability Auto-fill] Using expected bill rate', {
      //   localCurrency,
      //   expectedBillRate,
      //   billRateCurrency,
      //   contractDuration
      // })

      try {
        let minMonthlyBillRate = 0

        if (billRateCurrency === 'local') {
          // Convert $1,000 USD to local currency with 1% buffer to account for conversion volatility
          const targetProfitUSD = MIN_PROFIT_THRESHOLD_USD * 1.01
          // console.log('[Profitability Auto-fill] Converting $1k USD (with buffer) to', localCurrency)
          const minProfitInLocal = await convertCurrency(targetProfitUSD, 'USD', localCurrency)
          const minProfitLocalAmount = extractConvertedAmount(minProfitInLocal)

          // console.log('[Profitability Auto-fill] Converted amount:', minProfitLocalAmount)

          if (minProfitLocalAmount === null || minProfitLocalAmount === undefined) {
            throw new Error('Failed to convert minimum profit to local currency')
          }

          // Monthly bill rate = Expected Bill Rate + (Min Profit / Duration)
          minMonthlyBillRate = expectedBillRate + (minProfitLocalAmount / contractDuration)
        } else {
          // billRateCurrency === 'USD'
          // Convert expected bill rate to USD
          // console.log('[Profitability Auto-fill] Converting expected bill rate to USD')
          const expectedBillRateInUSD = await convertCurrency(expectedBillRate, localCurrency, 'USD')
          const expectedBillRateUSDAmount = extractConvertedAmount(expectedBillRateInUSD)

          // console.log('[Profitability Auto-fill] Converted expected bill rate:', expectedBillRateUSDAmount)

          if (expectedBillRateUSDAmount === null || expectedBillRateUSDAmount === undefined) {
            throw new Error('Failed to convert expected bill rate to USD')
          }

          // Monthly bill rate = Expected Bill Rate in USD + (Min Profit / Duration) with 1% buffer
          const targetProfitUSD = MIN_PROFIT_THRESHOLD_USD * 1.01
          minMonthlyBillRate = expectedBillRateUSDAmount + (targetProfitUSD / contractDuration)
        }

        // console.log('[Profitability Auto-fill] Calculated min bill rate:', minMonthlyBillRate)
        const finalBillRate = Number(minMonthlyBillRate.toFixed(2))
        setBillRateInput(finalBillRate)

        // Automatically trigger profitability calculation
        // console.log('[Profitability Auto-fill] Auto-triggering profitability calculation')
        await calculateProfitability(finalBillRate, contractDuration)
      } catch (error) {
        console.error('[Profitability Auto-fill] Failed to calculate minimum bill rate:', error)
        // Fallback: just use expected bill rate without profit buffer
        // console.log('[Profitability Auto-fill] Using fallback:', expectedBillRate)
        const fallbackRate = Number(expectedBillRate.toFixed(2))
        setBillRateInput(fallbackRate)

        // Automatically trigger profitability calculation with fallback
        // console.log('[Profitability Auto-fill] Auto-triggering profitability calculation (fallback)')
        await calculateProfitability(fallbackRate, contractDuration)
      }
    }

    void populateProfitabilityInputs()
  }, [acidTestCostData, acidTestResults, billRateCurrency, calculateProfitability, convertCurrency, isAllInclusiveQuote, quoteData?.formData])

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isReconModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isReconModalOpen])

  // Auto-scroll Phase 1: Scroll to cost breakdown table when ready
  useEffect(() => {
    if (acidTestResults && !isComputingAcidTest) {
      scrollToAcidTestSection('acid-test-categorizing', 500)
    }
  }, [acidTestResults, isComputingAcidTest])

  // Auto-scroll Phase 2: Scroll to profitability results when calculated
  useEffect(() => {
    if (profitabilityResults && !isCalculatingProfitability) {
      scrollToAcidTestSection('acid-test-profitability-results', 500)
    }
  }, [profitabilityResults, isCalculatingProfitability])

  // --- AUTO USD CONVERSIONS (UNCHANGED) ---
  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.deel) {
      autoConvertQuote(quoteData.quotes.deel, "deel")
    }
  }, [quoteData?.status, quoteData?.quotes.deel, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'deel' && quoteData.quotes.comparisonDeel) {
      autoConvertQuote(quoteData.quotes.comparisonDeel, "compare")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonDeel, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.rivermate) {
      autoConvertQuote(quoteData.quotes.rivermate, "rivermate")
    }
  }, [quoteData?.status, quoteData?.quotes.rivermate, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rivermate' && quoteData.quotes.comparisonRivermate) {
      autoConvertQuote(quoteData.quotes.comparisonRivermate, "compareRivermate")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRivermate, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.remote) {
      const isRaw = !!(quoteData.quotes.remote as any)?.employment;
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.remote as any) : (quoteData.quotes.remote as any);
      autoConvertRemoteQuote(remoteForConversion, "remote")
    }
  }, [quoteData?.status, quoteData?.quotes.remote, currentProvider, autoConvertRemoteQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'remote' && quoteData.quotes.comparisonRemote) {
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment;
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any) : (quoteData.quotes.comparisonRemote as any);
      autoConvertRemoteQuote(remoteForConversion, "compareRemote")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonRemote, currentProvider, autoConvertRemoteQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.oyster) {
      autoConvertQuote(quoteData.quotes.oyster as any, "oyster")
    }
  }, [quoteData?.status, quoteData?.quotes.oyster, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rippling' && quoteData.quotes.rippling) {
      autoConvertQuote(quoteData.quotes.rippling as any, "rippling")
    }
  }, [quoteData?.status, quoteData?.quotes.rippling, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'rippling' && (quoteData.quotes as any).comparisonRippling) {
      autoConvertQuote((quoteData.quotes as any).comparisonRippling as any, "compareRippling")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonRippling, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'skuad' && (quoteData.quotes as any).skuad) {
      autoConvertQuote((quoteData.quotes as any).skuad as any, "skuad")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.skuad, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'skuad' && (quoteData.quotes as any).comparisonSkuad) {
      autoConvertQuote((quoteData.quotes as any).comparisonSkuad as any, "compareSkuad")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonSkuad, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'velocity' && (quoteData.quotes as any).velocity) {
      autoConvertQuote((quoteData.quotes as any).velocity as any, "velocity")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.velocity, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'velocity' && (quoteData.quotes as any).comparisonVelocity) {
      autoConvertQuote((quoteData.quotes as any).comparisonVelocity as any, "compareVelocity")
    }
  }, [quoteData?.status, (quoteData?.quotes as any)?.comparisonVelocity, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status === 'completed' && currentProvider === 'oyster' && quoteData.quotes.comparisonOyster) {
      autoConvertQuote(quoteData.quotes.comparisonOyster as any, "compareOyster")
    }
  }, [quoteData?.status, quoteData?.quotes.comparisonOyster, currentProvider, autoConvertQuote])

  useEffect(() => {
    if (quoteData?.status !== 'completed') return
    if (quoteData.quotes.deel) autoConvertQuote(quoteData.quotes.deel as any, 'deel')
    if (quoteData.quotes.comparisonDeel) autoConvertQuote(quoteData.quotes.comparisonDeel as any, 'compare')
    if (quoteData.quotes.remote) {
      const isRaw = !!(quoteData.quotes.remote as any)?.employment
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.remote as any) : (quoteData.quotes.remote as any)
      autoConvertRemoteQuote(remoteForConversion as any, 'remote')
    }
    if (quoteData.quotes.comparisonRemote) {
      const isRaw = !!(quoteData.quotes.comparisonRemote as any)?.employment
      const remoteForConversion = isRaw ? transformToRemoteQuote(quoteData.quotes.comparisonRemote as any) : (quoteData.quotes.comparisonRemote as any)
      autoConvertRemoteQuote(remoteForConversion as any, 'compareRemote')
    }
    if (quoteData.quotes.rivermate) autoConvertQuote(quoteData.quotes.rivermate as any, 'rivermate')
    if (quoteData.quotes.comparisonRivermate) autoConvertQuote(quoteData.quotes.comparisonRivermate as any, 'compareRivermate')
    if (quoteData.quotes.oyster) autoConvertQuote(quoteData.quotes.oyster as any, 'oyster')
    if (quoteData.quotes.comparisonOyster) autoConvertQuote(quoteData.quotes.comparisonOyster as any, 'compareOyster')
    if (quoteData.quotes.rippling) autoConvertQuote(quoteData.quotes.rippling as any, 'rippling')
    if (quoteData.quotes.comparisonRippling) autoConvertQuote(quoteData.quotes.comparisonRippling as any, 'compareRippling')
    if ((quoteData.quotes as any).skuad) autoConvertQuote((quoteData.quotes as any).skuad as any, 'skuad')
    if ((quoteData.quotes as any).comparisonSkuad) autoConvertQuote((quoteData.quotes as any).comparisonSkuad as any, 'compareSkuad')
    if ((quoteData.quotes as any).velocity) autoConvertQuote((quoteData.quotes as any).velocity as any, 'velocity')
    if ((quoteData.quotes as any).comparisonVelocity) autoConvertQuote((quoteData.quotes as any).comparisonVelocity as any, 'compareVelocity')
    if ((quoteData.quotes as any).playroll) autoConvertQuote((quoteData.quotes as any).playroll as any, 'playroll')
    if ((quoteData.quotes as any).comparisonPlayroll) autoConvertQuote((quoteData.quotes as any).comparisonPlayroll as any, 'comparePlayroll')
    if ((quoteData.quotes as any).omnipresent) autoConvertQuote((quoteData.quotes as any).omnipresent as any, 'omnipresent')
    if ((quoteData.quotes as any).comparisonOmnipresent) autoConvertQuote((quoteData.quotes as any).comparisonOmnipresent as any, 'compareOmnipresent')
  }, [quoteData?.status, quoteData?.quotes, autoConvertQuote, autoConvertRemoteQuote])

  const handleExportAcidTestPdf = useCallback(async () => {
    if (!acidTestResults || !acidTestCostData || !acidTestKpiMetrics || !finalChoice) return

    setIsExportingPdf(true)

    try {
      const { categories } = acidTestCostData
      const providerCurrency = acidTestCostData.currency || finalChoice.currency || 'USD'

      let usdRate: number | null = providerCurrency === 'USD' ? 1 : null

      if (providerCurrency !== 'USD') {
        const rateResult = await convertCurrency(1, providerCurrency, 'USD')
        if (rateResult.success && rateResult.data) {
          usdRate = Number(rateResult.data.target_amount)
        } else {
          usdRate = null
        }
      }

      const showUSD = providerCurrency !== 'USD' && usdRate !== null

      const toUSD = (amount: number | undefined): number | undefined => {
        if (!Number.isFinite(amount ?? NaN)) return undefined
        if (providerCurrency === 'USD') return Number((amount ?? 0).toFixed(2))
        if (usdRate == null) return undefined
        return Number(((amount ?? 0) * usdRate).toFixed(2))
      }

      const formatAmount = (amount: number | undefined, currencyCode: string): string => {
        if (!Number.isFinite(amount ?? NaN)) return '—'
        const normalised = Number((amount ?? 0).toFixed(2))
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(normalised)
      }

      const formatLocal = (value: number | undefined) => formatAmount(value, providerCurrency)
      const formatUSDValue = (value: number | undefined): string | undefined => {
        if (!showUSD) return undefined
        if (!Number.isFinite(value ?? NaN)) return '—'
        return formatAmount(value, 'USD')
      }

      const excludedLabels = new Set(
        [
          'local office monthly payments',
          'vat on local office payments',
          'background check via deel',
        ]
      )

      const shouldSkipLabel = (label: string) => {
        const normalized = label.trim().toLowerCase()
        if (normalized.includes('gracemark fee')) return true
        return excludedLabels.has(normalized)
      }

      const categoriesData: AcidTestPdfCategory[] = []

      const pushCategory = (title: string, bucket?: Record<string, number>) => {
        if (!bucket) return

        let localSum = 0
        let usdSum = 0
        let hasUsdSum = false
        const items: AcidTestPdfItem[] = []

        Object.entries(bucket).forEach(([key, rawValue]) => {
          const amount = Number(rawValue)
          if (!Number.isFinite(amount)) return
          const label = formatKeyName(key)
          if (shouldSkipLabel(label)) return

          const usdAmount = toUSD(amount)

          items.push({
            label,
            local: formatLocal(amount),
            usd: formatUSDValue(usdAmount),
          })

          localSum += amount
          if (showUSD && Number.isFinite(usdAmount ?? NaN)) {
            usdSum += usdAmount as number
            hasUsdSum = true
          }
        })

        const hasData = items.length > 0 || Math.abs(localSum) > 0.0001
        if (!hasData) {
          return
        }

        categoriesData.push({
          title,
          localTotal: formatLocal(localSum),
          usdTotal: formatUSDValue(hasUsdSum ? usdSum : undefined),
          items,
        })
      }

      pushCategory('Base Salary', categories.baseSalary)
      pushCategory('Statutory & Mandatory Costs', categories.statutoryMandatory)
      pushCategory('Allowances & Benefits', categories.allowancesBenefits)
      pushCategory('Termination Provision', categories.terminationCosts)
      pushCategory('Onboarding Fees (One Time)', categories.onboardingFees)
      pushCategory('Additional One-Time Fees', categories.oneTimeFees)

      if (categoriesData.length === 0) {
        console.warn('No cost breakdown data available for export')
        return
      }

      const safeProvider = finalChoice.provider.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'provider'
      const filename = `gracemark-cost-breakdown-${safeProvider}-expanded.pdf`

      await exportAcidTestCostBreakdownPdf(
        {
          currency: providerCurrency,
          showUSD,
          categories: categoriesData,
          logoSrc: '/GraceMarklogo.png',
          monthlyCard: {
            title: 'Monthly Bill Rate',
            localValue: formatLocal(acidTestKpiMetrics.totals.monthlyBillRate.local ?? undefined),
            usdValue: showUSD ? formatUSDValue(acidTestKpiMetrics.totals.monthlyBillRate.usd ?? undefined) : undefined,
            duration: (() => {
              const durationValue = acidTestKpiMetrics.duration
              if (!Number.isFinite(durationValue ?? NaN) || (durationValue ?? 0) <= 0) {
                return 'Contract duration: —'
              }
              const numeric = Number(durationValue)
              const plural = numeric === 1 ? '' : 's'
              return `Based on ${numeric} month${plural} contract`
            })(),
            description: 'Recurring revenue excluding onboarding fees.',
          },
        },
        filename
      )
    } catch (error) {
      console.error('Failed to export acid test PDF:', error)
    } finally {
      setIsExportingPdf(false)
    }
  }, [acidTestCostData, acidTestResults, acidTestKpiMetrics, finalChoice, convertCurrency])

  // --- LOADING & ERROR STATES (Updated: show spinner until current provider base is ready) ---
  const showGlobalLoader = loading || providerLoading[currentProvider] || (quoteData?.status === 'calculating' && providerLoading[currentProvider])

  if (showGlobalLoader) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6 flex flex-col items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Loading Quotes...
            </h1>
            <LoadingSpinner />
          </div>
        </div>
      </div>
    )
  }

  if (!quoteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-red-600">No Quote Data</h1>
            <Button asChild>
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Back to Calculator
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (quoteData.status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="mb-6">
            <Link
              href="/eor-calculator"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-primary transition-all duration-200 hover:gap-3 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Calculator</span>
            </Link>
          </div>

          <div className="text-center space-y-6">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-red-600">Quote Generation Failed</h1>
              <p className="text-lg text-slate-600">{quoteData.error}</p>
            </div>
            <Button asChild>
              <Link href="/eor-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Try Again
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // calculating handled by the unified loading block above

  // --- REFRESHED RECONCILIATION LOGIC ---
  const getReconciliationStatus = () => {
    // Treat 'inactive' as a terminal state when no processing is in-flight,
    // so providers that failed base generation/normalization don't block reconciliation.
    const completed = allProviders.filter(p => {
      const s = providerStates[p]?.status
      return s === 'active' || s === 'enhancement-failed' || s === 'failed' || s === 'inactive'
    }).length

    // Only check cost items for providers that are fully active (base + enhancement succeeded)
    const providersWithData = allProviders.filter(p => {
      const s = providerStates[p]?.status
      return s === 'active'
    })
    const costItemsReady = providersWithData.length > 0 && providersWithData.every(providerHasCostItems)

    const isReady = completed >= allProviders.length && !enhancementBatchInfo.isProcessing && costItemsReady
    const hasCompletedBefore = completedPhases.has('analyzing') || completedPhases.has('complete')

    let message = 'Enhancing quotes...'
    if (isReady) {
      message = hasCompletedBefore ? 'View Analysis Results' : 'Start Reconciliation'
    }

    return {
      ready: isReady,
      message
    }
  }
  
  const reconStatus = getReconciliationStatus()

  const renderReconciliationButtonContent = () => {
    if (reconStatus.ready) return <span>{reconStatus.message}</span>
    return <><Brain className="h-4 w-4 animate-pulse text-purple-600" /><span>{reconStatus.message}</span></>
  }

  const formatMoney = (value: number, currency: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value) } catch { return `${value.toFixed(2)} ${currency}` }
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Simple progress update function
  const smoothProgressUpdate = (targetProgress: number) => {
    return new Promise<void>((resolve) => {
      setProgressPercent(targetProgress)
      setTimeout(resolve, 200)
    })
  }

  // Simple auto-scroll
  const scrollToPhase = (phaseId: string) => {
    setTimeout(() => {
      // For analyzing phase, scroll to the results content instead of the phase container
      const targetId = phaseId === 'analyzing' ? 'analyzing-results' : `phase-${phaseId}`
      let element = document.getElementById(targetId)

      // Fallback to phase container if results element doesn't exist
      if (!element && phaseId === 'analyzing') {
        element = document.getElementById('phase-analyzing')
      }

      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: phaseId === 'complete' ? 'end' : 'start',
          inline: 'nearest'
        })
      }
    }, phaseId === 'analyzing' ? 800 : 400) // Longer delay for analyzing phase to ensure content is rendered
  }

  // Scroll to bottom of modal container with proper timing
  const scrollToBottom = () => {
    return new Promise<void>((resolve) => {
      // Use requestAnimationFrame to ensure DOM layout is complete
      requestAnimationFrame(() => {
        setTimeout(() => {
          const scrollContainer = document.querySelector('.overflow-y-auto.scroll-smooth')
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            })
          }
          resolve()
        }, 500) // Wait for CSS transitions to complete
      })
    })
  }

  // Auto-scroll for acid test sections
  const scrollToAcidTestSection = (sectionId: string, delay = 500) => {
    setTimeout(() => {
      const element = document.getElementById(sectionId)
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        })
      }
    }, delay)
  }

  // Simplified phase completion (removed transition delays)
  const completePhase = (phase: string) => {
    setCompletedPhases(prev => new Set([...prev, phase]))
  }

  const startPhase = (phase: 'gathering' | 'analyzing' | 'selecting' | 'complete') => {
    setActivePhase(phase)
    scrollToPhase(phase) // Uses optimized scrolling with 400ms delay and performance optimization
  }

  // Timeline phase rendering
  const renderTimelinePhases = () => {
    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'
    
    const isPhaseActive = (phase: string) => activePhase === phase
    const isPhaseCompleted = (phase: string) => completedPhases.has(phase)
    const isPhaseStarted = (phase: string) => isPhaseActive(phase) || isPhaseCompleted(phase)

    return (
      <div className="space-y-8 p-6">
        {/* Phase 1: Gathering Data */}
        <div
          id="phase-gathering"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('gathering') ? 'border-slate-900 shadow-lg' :
              isPhaseCompleted('gathering') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('gathering') ? 'bg-slate-100' :
                isPhaseCompleted('gathering') ? 'bg-green-100' :
                'bg-slate-50'}
            `}>
              {isPhaseCompleted('gathering') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('gathering') ? (
                <Activity className="h-6 w-6 text-slate-900 animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Phase 1: Gathering Data</h3>
              <p className="text-slate-600">
                {isPhaseCompleted('gathering') ? 'Provider quotes collected successfully' :
                 isPhaseActive('gathering') ? 'Collecting provider quotes...' :
                 'Waiting to collect provider quotes'}
              </p>
            </div>
          </div>

          {isPhaseStarted('gathering') && (
            <div className="space-y-6">

              {/* Provider Grid */}
              <div className="bg-white border border-slate-200 shadow-md p-6">
                {/* <h5 className="text-lg font-bold text-slate-800 mb-4">Provider Quotes</h5> */}
                {(() => {
                  const placeholdersNeeded = isPhaseActive('gathering') && providerData.length < allProviders.length
                    ? Math.min(3, allProviders.length - providerData.length)
                    : 0

                  const items = [
                    ...providerData.map((provider) => ({ type: 'provider' as const, provider })),
                    ...Array.from({ length: placeholdersNeeded }, (_, idx) => ({ type: 'placeholder' as const, id: idx }))
                  ]

                  const { firstRow, secondRow } = splitIntoBalancedRows(items)
                  const rows = [firstRow, secondRow].filter(row => row.length > 0)

                  return (
                    <div className={`flex flex-col items-center gap-4 transition-opacity duration-500 ${isPhaseStarted('gathering') ? 'opacity-100' : 'opacity-0'}`}>
                      {rows.map((row, rowIdx) => (
                        <div
                          key={`provider-row-${rowIdx}`}
                          className="flex flex-wrap justify-center gap-4"
                        >
                          {row.map((entry, entryIdx) => {
                            if (entry.type === 'provider') {
                              const { provider } = entry
                              return (
                                <div
                                  key={provider.provider}
                                  className="w-48 sm:w-56 md:w-60 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 px-6 py-5 text-center transition-all duration-300 hover:shadow-lg hover:border-blue-400 hover:scale-105"
                                >
                                  <div className="w-28 h-8 mx-auto mb-3 border-2 border-slate-200 flex items-center justify-center bg-white">
                                    <ProviderLogo provider={provider.provider as ProviderType} maxWidth={140} maxHeight={28} />
                                  </div>
                                  <div className="text-sm font-bold text-slate-800 capitalize mb-1 tracking-wide">
                                    {provider.provider}
                                  </div>
                                  <div className="text-base font-bold text-blue-900">
                                    {formatMoney(provider.price, currency)}
                                  </div>
                                  <Badge className="mt-2 bg-blue-100 text-blue-700 border-blue-200 text-[11px] px-3 py-1">
                                    Collected
                                  </Badge>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={`placeholder-${entry.id}-${rowIdx}-${entryIdx}`}
                                className="w-48 sm:w-56 md:w-60 bg-slate-50 border-2 border-slate-200 border-dashed px-6 py-5 text-center animate-pulse"
                              >
                                <div className="w-12 h-12 mx-auto mb-3 bg-slate-200 rounded" />
                                <div className="h-3 bg-slate-200 rounded mb-2 mx-auto w-20" />
                                <div className="h-4 bg-slate-200 rounded mx-auto w-24" />
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2: Analyzing Variance */}
        <div
          id="phase-analyzing"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('analyzing') ? 'border-slate-900 shadow-lg' :
              isPhaseCompleted('analyzing') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('analyzing') ? 'bg-slate-100' :
                isPhaseCompleted('analyzing') ? 'bg-green-100' :
                'bg-slate-50'}
            `}>
              {isPhaseCompleted('analyzing') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('analyzing') ? (
                <BarChart3 className="h-6 w-6 text-slate-900 animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Phase 2: Analyzing Variance</h3>
              <p className="text-slate-600">
                {isPhaseCompleted('analyzing') ? 'Price variance analysis completed' :
                 isPhaseActive('analyzing') ? 'Analyzing price variance against Deel baseline...' :
                 'Waiting to analyze price variance'}
              </p>
            </div>
          </div>

          {isPhaseStarted('analyzing') && providerData.length > 0 && (
            <div id="analyzing-results" className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 border border-slate-200 shadow-lg p-8">
              {/* Modern Header */}
              {/* <div className="text-center bg-white shadow-sm border border-slate-200 p-8 mb-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
                    <BarChart3 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      4% Variance Analysis
                    </h4>
                    <p className="text-slate-600 mt-2 text-base max-w-2xl mx-auto">
                      Comprehensive price compliance validation against Deel baseline standards with detailed provider comparison
                    </p>
                  </div>
                </div>
              </div> */}

              {/* Visual Chart */}
              {(() => {
                const deelProvider = providerData.find(p => p.provider === 'deel')
                const deelPrice = deelProvider?.price || 0

                return (
                  <VarianceChart
                    providers={providerData}
                    deelPrice={deelPrice}
                    currency={currency}
                  />
                )
              })()}

            </div>
          )}
        </div>

        {/* Phase 3: Selecting Optimal */}
        <div
          id="phase-selecting"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('selecting') ? 'border-slate-900 shadow-lg' :
              isPhaseCompleted('selecting') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseActive('selecting') ? 'bg-slate-100' :
                isPhaseCompleted('selecting') ? 'bg-green-100' :
                'bg-slate-50'}
            `}>
              {isPhaseCompleted('selecting') ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPhaseActive('selecting') ? (
                <Target className="h-6 w-6 text-slate-900 animate-pulse" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Phase 3: Selecting Optimal Provider</h3>
              <p className="text-slate-600">
                {isPhaseCompleted('selecting') ? 'Optimal provider selected successfully' :
                 isPhaseActive('selecting') ? 'Selecting optimal provider from candidates...' :
                 'Waiting to select optimal provider'}
              </p>
            </div>
          </div>

          {isPhaseStarted('selecting') && (
            <div>
              {/* Provider Grid */}
              <div className="bg-white border border-slate-200 shadow-md p-6">
                {/* <h5 className="text-lg font-bold text-slate-800 mb-4">Provider Selection Pool</h5> */}
                {(() => {
                  const { firstRow, secondRow } = splitIntoBalancedRows(providerData)
                  const rows = [firstRow, secondRow].filter(row => row.length > 0)

                  return (
                    <div className="flex flex-col items-center gap-4">
                      {rows.map((row, rowIdx) => (
                        <div
                          key={`selection-row-${rowIdx}`}
                          className="flex flex-wrap justify-center gap-4"
                        >
                          {row.map((provider) => (
                            <div
                              key={provider.provider}
                              className={`
                                w-48 sm:w-56 md:w-60 border-2 px-6 py-5 text-center transition-all duration-300
                                ${provider.isWinner ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-400 shadow-lg scale-105' :
                                  provider.inRange ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-sm hover:shadow-md hover:border-green-400' :
                                  'bg-slate-50 border-slate-200 opacity-50'}
                              `}
                            >
                              {provider.isWinner && (
                                <Crown className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
                              )}
                              <div className="w-28 h-8 mx-auto mb-3 border-2 border-slate-200 flex items-center justify-center bg-white">
                                <ProviderLogo provider={provider.provider as ProviderType} maxWidth={140} maxHeight={28} />
                              </div>
                              <div className="text-sm font-bold text-slate-800 capitalize mb-1 tracking-wide">
                                {provider.provider}
                              </div>
                              <div className={`text-base font-bold ${
                                provider.isWinner ? 'text-yellow-900' :
                                provider.inRange ? 'text-green-700' : 'text-slate-600'
                              }`}>
                                {formatMoney(provider.price, currency)}
                              </div>
                              {provider.isWinner && (
                                <Badge className="mt-2 bg-yellow-400 text-yellow-900 border-yellow-500 text-[11px] font-bold px-3 py-1">
                                  WINNER
                                </Badge>
                              )}
                              {!provider.isWinner && provider.inRange && (
                                <Badge className="mt-2 bg-green-100 text-green-700 border-green-200 text-[11px] px-3 py-1">
                                  Qualified
                                </Badge>
                              )}
                              {!provider.inRange && (
                                <Badge className="mt-2 bg-slate-100 text-slate-500 border-slate-200 text-[11px] px-3 py-1">
                                  Out of Range
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Phase 4: Analysis Complete */}
        <div
          id="phase-complete"
          className={`
            bg-white border shadow-sm p-6 transition-all duration-300 ease-in-out
            ${isPhaseActive('complete') || isPhaseCompleted('complete') ? 'border-green-500 shadow-md' :
              'border-slate-200 opacity-60'}
          `}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3
              ${isPhaseStarted('complete') ? 'bg-green-100' : 'bg-slate-50'}
            `}>
              {isPhaseStarted('complete') ? (
                <Crown className="h-6 w-6 text-green-600" />
              ) : (
                <Clock className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Analysis Complete</h3>
              <p className="text-slate-600">
                {isPhaseStarted('complete') ? 'Provider recommendation ready' : 'Waiting for analysis to complete'}
              </p>
            </div>
          </div>

          {isPhaseStarted('complete') && finalChoice && (
            <>
              {!showAcidTestForm ? (
                <div className="space-y-6">
                  {/* Winner Announcement Card */}
                  <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 border-2 border-green-300 shadow-xl p-8 transition-all duration-300">
                    <div className="text-center">
                      <h4 className="text-2xl font-bold text-slate-800 mb-2">Recommended Provider</h4>
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="w-32 h-16 flex items-center justify-center bg-white border-2 border-green-300 shadow-md p-3">
                          <ProviderLogo provider={finalChoice.provider as ProviderType} />
                        </div>
                      </div>
                      <div className="text-6xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-6 tracking-tight">
                        {formatMoney(finalChoice.price, finalChoice.currency)}
                      </div>
                      <div className="text-center">
                      <Button
                        onClick={handleStartAcidTest}
                        disabled={!finalChoice || !providerData.length}
                        size="lg"
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-10 py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className="h-6 w-6 mr-3" />
                        Start Acid Test
                      </Button>
                    </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div>
                    {/* Acid Test Error Display */}
                    {acidTestError && (
                      <div className="mt-6 bg-red-50 border-2 border-red-200 shadow-sm p-4">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-bold text-red-800">Acid Test Failed</p>
                            <p className="text-sm text-red-600 mt-1">{acidTestError}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAcidTestError(null)}
                              className="mt-3 text-red-600 border-red-300 hover:bg-red-50 font-semibold"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 border border-slate-200 shadow-lg p-6 md:p-8">
                  <div className="mx-auto flex max-w-5xl flex-col gap-8">
                    {/* Consolidated Acid Test Header */}
                    <div className="bg-white shadow-sm border border-slate-200 p-6">
                      <div className="flex items-center justify-between">
                        {/* Left: Acid Test Title */}
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900 mb-1">
                            Acid Test Calculator
                          </h3>
                          <p className="text-slate-600 text-sm">
                            Profitability analysis for <span className="font-semibold capitalize text-slate-800">{finalChoice.provider}</span>
                          </p>
                        </div>

                        {/* Center: Total Monthly Cost */}
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
                            <h5 className="text-base font-bold text-slate-800">Total Monthly Cost</h5>
                            <Badge className="bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 text-xs">Locked</Badge>
                          </div>
                          <div className="text-2xl font-bold text-slate-900 mb-1">
                            {(() => {
                              const recurringMonthly = acidTestResults?.breakdown?.recurringMonthly
                              const localCurrency = acidTestResults?.summary?.currency || finalChoice.currency

                              if (typeof recurringMonthly === 'number') {
                                return formatMoney(recurringMonthly, localCurrency)
                              }
                              return formatMoney(finalChoice.price, finalChoice.currency)
                            })()}
                          </div>
                          {(() => {
                            const recurringMonthly = acidTestResults?.breakdown?.recurringMonthly
                            const recurringMonthlyUSD = acidTestResults?.breakdown?.recurringMonthlyUSD
                            const localCurrency = acidTestResults?.summary?.currency || finalChoice.currency

                            // Show USD equivalent if local currency is not USD and we have USD data
                            if (localCurrency !== 'USD' && typeof recurringMonthlyUSD === 'number') {
                              return (
                                <p className="text-xs text-slate-500">
                                  ≈ {formatMoney(recurringMonthlyUSD, 'USD')}
                                </p>
                              )
                            }
                            return null
                          })()}
                          <p className="text-xs text-slate-500">from {finalChoice.provider}</p>
                        </div>

                        {/* Right: Controls */}
                        <div className="flex flex-col items-end gap-3">
                          <Badge className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 text-xs">
                            Local: {finalChoice.currency}
                          </Badge>

                          {/* Old duration input - hidden since we now have the new calculator below */}
                          {false && (
                            <div className="flex flex-col items-end">
                              <label
                                htmlFor="acid-test-duration"
                                className="text-xs font-semibold text-slate-600 uppercase tracking-wide"
                              >
                                Project Duration (months)
                              </label>
                              <Input
                                id="acid-test-duration"
                                type="number"
                                min={1}
                                max={120}
                                value={projectDuration > 0 ? projectDuration : ''}
                                onChange={event => handleDurationChange(event.target.value)}
                                className="mt-1 w-28 text-right"
                              />
                              {acidTestValidation.durationError && (
                                <span className="mt-1 text-xs text-red-500">
                                  {acidTestValidation.durationError}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>


                    {(isCategorizingCosts || isComputingAcidTest) ? (
                      <div id="acid-test-categorizing" className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 shadow-sm p-10">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <LoadingSpinner />
                            <div className="text-xl font-bold text-purple-700">Categorizing Costs & Computing Acid Test...</div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-purple-600 max-w-lg">
                              Analyzing cost structure and running comprehensive profitability analysis.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-purple-500">
                              <Target className="h-4 w-4" />
                              <span>This may take a few moments...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : !acidTestCostData ? (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm p-6">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 border border-amber-200 flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <h5 className="text-lg font-semibold text-amber-800 mb-2">Cost Data Unavailable</h5>
                            <p className="text-sm text-amber-700 mb-3">
                              Unable to load the cost breakdown for this provider. This may be due to missing data or a temporary connectivity issue.
                            </p>
                            <p className="text-xs text-amber-600">
                              Try adjusting the project parameters above or refresh the page to retry.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {acidTestCostData && acidTestResults && !isComputingAcidTest && (
                      <div id="acid-test-categorizing" className="space-y-6">
                        {(() => {
                            const { summary, breakdown, billRateComposition, conversionError } = acidTestResults
                            const profitClass = summary.profitLocal >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                            const profitTextClass = summary.profitLocal >= 0 ? 'text-green-700' : 'text-red-700'
                            const statusBadgeClass = summary.meetsPositive && summary.meetsMinimum
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : summary.meetsPositive
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-red-100 text-red-800 border-red-200'
                            const statusLabel = summary.meetsPositive
                              ? (summary.meetsMinimum
                                  ? 'Pass - Profit clears the USD 1,000 minimum'
                                  : 'Warning - Profit below the USD 1,000 minimum')
                              : 'Fail - Project is not profitable'

                            // Always show local currency as primary, with USD as secondary when available
                            const formatAmount = (localValue: number, usdValue?: number) => {
                              return formatMoney(localValue, summary.currency)
                            }

                            const renderApproxLine = (localValue: number, usdValue?: number) => {
                              // Show USD equivalent if local currency is not USD and we have USD data
                              if (summary.currency !== 'USD' && typeof usdValue === 'number') {
                                return (
                                  <p className="text-xs text-slate-500">
                                    ≈ {formatMoney(usdValue, 'USD')}
                                  </p>
                                )
                              }
                              return null
                            }

                            const renderDifferenceValue = (localValue: number, usdValue?: number) => {
                              const isPositive = localValue >= 0
                              const absLocal = Math.abs(localValue)
                              const absUsd = typeof usdValue === 'number' ? Math.abs(usdValue) : undefined
                              return (
                                <>
                                  {isPositive ? '+' : '-'}
                                  {formatAmount(absLocal, absUsd)}
                                </>
                              )
                            }

                            return (
                              <div className="space-y-6">
                                {/* <div className="grid gap-4 lg:grid-cols-3">
                                  <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-2 text-slate-700">
                                      <TrendingUp className="h-5 w-5 text-blue-600" />
                                      <h4 className="font-semibold">Total Project Revenue</h4>
                                    </div>
                                    <div className="text-3xl font-semibold text-blue-600">
                                      {formatAmount(summary.revenueTotal, summary.revenueUSD)}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      {formatAmount(summary.billRateMonthly, billRateComposition.actualBillRateUSD)} × {summary.durationMonths} months
                                    </p>
                                    {renderApproxLine(summary.revenueTotal, summary.revenueUSD)}
                                  </div>

                                  <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-2 text-slate-700">
                                      <BarChart3 className="h-5 w-5 text-rose-600" />
                                      <h4 className="font-semibold">Total Project Cost</h4>
                                    </div>
                                    <div className="text-3xl font-semibold text-rose-600">
                                      {formatAmount(summary.totalCost, summary.totalCostUSD)}
                                    </div>
                                    <p className="text-sm text-slate-500">Includes all costs across the full assignment.</p>
                                    <ul className="space-y-1 text-sm text-slate-600">
                                      <li>Salary: {formatAmount(breakdown.salaryTotal, breakdown.salaryTotalUSD)}</li>
                                      <li>Statutory: {formatAmount(breakdown.statutoryTotal, breakdown.statutoryTotalUSD)}</li>
                                      <li>Allowances & benefits: {formatAmount(breakdown.allowancesTotal, breakdown.allowancesTotalUSD)}</li>
                                      <li>Termination provision: {formatAmount(breakdown.terminationTotal, breakdown.terminationTotalUSD)}</li>
                                      {breakdown.onboardingTotal > 0 && (
                                        <li>Onboarding fees (one time): {formatAmount(breakdown.onboardingTotal, breakdown.onboardingTotalUSD)}</li>
                                      )}
                                      <li>Total one-time costs: {formatAmount(breakdown.oneTimeTotal, breakdown.oneTimeTotalUSD)}</li>
                                      <li className="font-semibold">Recurring monthly cost: {formatAmount(breakdown.recurringMonthly, breakdown.recurringMonthlyUSD)}</li>
                                      <li className="font-semibold">Recurring project total: {formatAmount(breakdown.recurringTotal, breakdown.recurringTotalUSD)}</li>
                                    </ul>
                                  </div>

                                  <div className={`flex h-full flex-col items-center gap-4 rounded-xl border-2 p-6 text-center shadow-sm ${profitClass}`}>
                                    <Target className={`h-6 w-6 ${profitTextClass}`} />
                                    <div>
                                      <h3 className="text-xl font-semibold text-slate-900">Acid Test Result</h3>
                                      <div className={`text-4xl font-semibold ${profitTextClass}`}>
                                        {formatAmount(summary.profitLocal, summary.profitUSD)}
                                      </div>
                                      {renderApproxLine(summary.profitLocal, summary.profitUSD)}
                                    </div>
                                    <div className="space-y-1 text-sm text-slate-600">
                                      <div>Margin per month: {formatAmount(summary.marginMonthly, summary.marginMonthlyUSD)}</div>
                                      <div>Total margin (after one-time costs): {formatAmount(summary.marginTotal, summary.marginTotalUSD)}</div>
                                    </div>
                                    <Badge className={`${statusBadgeClass} mt-1`}>{statusLabel}</Badge>
                                    {!summary.meetsMinimum && summary.minimumShortfallUSD !== undefined && (
                                      <p className="text-xs text-slate-600">
                                        Needs {formatMoney(summary.minimumShortfallUSD, 'USD')} more profit to reach the USD {acidTestResults.thresholds.minimumUSD.toLocaleString()} minimum.
                                      </p>
                                    )}
                                    {conversionError && (
                                      <p className="text-xs text-red-600">{conversionError}</p>
                                    )}
                                  </div>
                                </div> */}

                                {/* Simplified Acid Test Summary */}
                                {/* <div className="bg-white border border-slate-200 shadow-lg p-8 mb-6">
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-3 mb-6">
                                      <div className="p-3 bg-purple-100 rounded-lg">
                                        <Zap className="h-8 w-8 text-purple-600" />
                                      </div>
                                      <h3 className="text-2xl font-bold text-slate-800">Acid Test Result</h3>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-5 mb-6">
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Assignment Duration</p>
                                        <p className="text-xl font-bold text-slate-800">{summary.durationMonths} months</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Monthly Bill Rate</p>
                                        <p className="text-xl font-bold text-blue-600">
                                          {formatMoney(summary.billRateMonthly, summary.currency)}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                                        <p className="text-xl font-bold text-green-600">
                                          {formatMoney(summary.revenueTotal, summary.currency)}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Total Costs</p>
                                        <p className="text-xl font-bold text-red-600">
                                          {formatMoney(summary.totalCost, summary.currency)}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-1">Profit</p>
                                        <p className={`text-xl font-bold ${summary.profitLocal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                          {formatMoney(summary.profitLocal, summary.currency)}
                                        </p>
                                      </div>
                                    </div>

                                    <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-lg border-2 ${
                                      summary.meetsPositive && summary.meetsMinimum
                                        ? 'bg-green-50 border-green-200'
                                        : summary.meetsPositive
                                          ? 'bg-amber-50 border-amber-200'
                                          : 'bg-red-50 border-red-200'
                                    }`}>
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                                        summary.meetsPositive && summary.meetsMinimum
                                          ? 'bg-green-600'
                                          : summary.meetsPositive
                                            ? 'bg-amber-600'
                                            : 'bg-red-600'
                                      }`}>
                                        {summary.meetsPositive && summary.meetsMinimum ? '✓' : summary.meetsPositive ? '!' : '✗'}
                                      </div>
                                      <div className="text-left">
                                        <p className={`font-bold text-lg ${
                                          summary.meetsPositive && summary.meetsMinimum
                                            ? 'text-green-800'
                                            : summary.meetsPositive
                                              ? 'text-amber-800'
                                              : 'text-red-800'
                                        }`}>
                                          {summary.meetsPositive && summary.meetsMinimum
                                            ? 'PASS'
                                            : summary.meetsPositive
                                              ? 'WARNING'
                                              : 'FAIL'
                                          }
                                        </p>
                                        <p className="text-sm text-slate-600">
                                          {summary.meetsPositive && summary.meetsMinimum
                                            ? 'Assignment meets profitability requirements'
                                            : summary.meetsPositive
                                              ? `Profitable but below USD ${acidTestResults.thresholds.minimumUSD.toLocaleString()} minimum`
                                              : 'Assignment is not profitable'
                                          }
                                        </p>
                                      </div>
                                    </div>

                                    {conversionError && (
                                      <p className="text-xs text-red-600 mt-4">{conversionError}</p>
                                    )}
                                  </div>
                                </div> */}

                                {/* Bill Rate Composition Breakdown */}
                                <div className="bg-white border border-slate-200 shadow-lg p-8">
                                  <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="p-2 bg-purple-100">
                                        <Calculator className="h-6 w-6 text-purple-600" />
                                      </div>
                                      <h4 className="text-2xl font-bold text-slate-800">Bill Rate Composition Analysis</h4>
                                    </div>
                                    <p className="text-slate-600">Detailed breakdown of expected costs vs. your actual billing rate</p>
                                  </div>

                                  {/* Main Comparison Table */}
                                  <div className="bg-slate-50 border border-slate-200 shadow-sm overflow-hidden mb-6">
                                    <div className="bg-slate-800 text-white p-4">
                                      <h5 className="text-lg font-bold">Cost Structure Breakdown</h5>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full">
                                        <thead className="bg-slate-100 border-b border-slate-200">
                                          <tr>
                                            <th className="text-left py-4 px-6 font-semibold text-slate-800">Cost Component</th>
                                            <th className="text-right py-4 px-6 font-semibold text-slate-800">Monthly Amount</th>
                                            {acidTestCostData?.currency !== 'USD' && (
                                              <th className="text-right py-4 px-6 font-semibold text-slate-800">USD Amount</th>
                                            )}
                                            <th className="text-center py-4 px-6 font-semibold text-slate-800">Category</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                          <tr
                                            className="group hover:bg-blue-50 hover:border-l-4 hover:border-l-blue-500 transition-all duration-200 cursor-pointer"
                                            onClick={() => toggleCategoryExpansion('baseSalary')}
                                          >
                                            <td className="py-4 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 bg-blue-500"></div>
                                                <span className="font-medium text-slate-800">Base Salary</span>
                                                {expandedCategories.has('baseSalary') ? (
                                                  <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                ) : (
                                                  <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                              {formatMoney(billRateComposition.salaryMonthly, acidTestCostData?.currency || 'EUR')}
                                            </td>
                                            {acidTestCostData?.currency !== 'USD' && (
                                              <td className="py-4 px-6 text-right font-semibold text-slate-700">
                                                {billRateComposition.salaryMonthlyUSD
                                                  ? formatMoney(billRateComposition.salaryMonthlyUSD, 'USD')
                                                  : '—'
                                                }
                                              </td>
                                            )}
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">Core</Badge>
                                            </td>
                                          </tr>
                                          {/* Base Salary Detail Rows */}
                                          {expandedCategories.has('baseSalary') && acidTestCostData && Object.entries(acidTestCostData.categories.baseSalary).map(([itemKey, amount]) => (
                                            <tr key={`baseSalary-${itemKey}`} className="bg-slate-25 border-l-4 border-l-blue-500 hover:bg-blue-25 transition-colors">
                                              <td className="py-3 px-6 pl-12">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                                                  <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                </div>
                                              </td>
                                              <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                {formatMoney(amount, acidTestCostData.currency)}
                                              </td>
                                              {acidTestCostData?.currency !== 'USD' && (
                                                <td className="py-3 px-6 text-right text-sm font-medium text-slate-500">
                                                  —
                                                </td>
                                              )}
                                              <td className="py-3 px-6 text-center">
                                                <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-xs">Detail</Badge>
                                              </td>
                                            </tr>
                                          ))}
                                          <tr
                                            className="group hover:bg-orange-50 hover:border-l-4 hover:border-l-orange-500 transition-all duration-200 cursor-pointer"
                                            onClick={() => toggleCategoryExpansion('statutoryMandatory')}
                                          >
                                            <td className="py-4 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 bg-orange-500"></div>
                                                <span className="font-medium text-slate-800">Statutory Costs</span>
                                                {expandedCategories.has('statutoryMandatory') ? (
                                                  <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-orange-600 transition-colors" />
                                                ) : (
                                                  <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-orange-600 transition-colors" />
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                              {formatMoney(billRateComposition.statutoryMonthly, acidTestCostData?.currency || 'EUR')}
                                            </td>
                                            {acidTestCostData?.currency !== 'USD' && (
                                              <td className="py-4 px-6 text-right font-semibold text-slate-700">
                                                {billRateComposition.statutoryMonthlyUSD
                                                  ? formatMoney(billRateComposition.statutoryMonthlyUSD, 'USD')
                                                  : '—'
                                                }
                                              </td>
                                            )}
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-orange-100 text-orange-800 border-orange-200">Legal</Badge>
                                            </td>
                                          </tr>
                                          {/* Statutory Costs Detail Rows */}
                                          {expandedCategories.has('statutoryMandatory') && acidTestCostData && Object.entries(acidTestCostData.categories.statutoryMandatory).map(([itemKey, amount]) => (
                                            <tr key={`statutoryMandatory-${itemKey}`} className="bg-slate-25 border-l-4 border-l-orange-500 hover:bg-orange-25 transition-colors">
                                              <td className="py-3 px-6 pl-12">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-2 h-2 bg-orange-300 rounded-full"></div>
                                                  <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                </div>
                                              </td>
                                              <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                {formatMoney(amount, acidTestCostData.currency)}
                                              </td>
                                              {acidTestCostData?.currency !== 'USD' && (
                                                <td className="py-3 px-6 text-right text-sm font-medium text-slate-500">
                                                  —
                                                </td>
                                              )}
                                              <td className="py-3 px-6 text-center">
                                                <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-xs">Detail</Badge>
                                              </td>
                                            </tr>
                                          ))}
                                          {billRateComposition.allowancesMonthly > 0 && (
                                            <>
                                              <tr
                                                className="group hover:bg-green-50 hover:border-l-4 hover:border-l-green-500 transition-all duration-200 cursor-pointer"
                                                onClick={() => toggleCategoryExpansion('allowancesBenefits')}
                                              >
                                                <td className="py-4 px-6">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-green-500"></div>
                                                    <span className="font-medium text-slate-800">Allowances & Benefits</span>
                                                    {expandedCategories.has('allowancesBenefits') ? (
                                                      <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-green-600 transition-colors" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-green-600 transition-colors" />
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                                  {formatMoney(billRateComposition.allowancesMonthly, acidTestCostData?.currency || 'EUR')}
                                                </td>
                                                {acidTestCostData?.currency !== 'USD' && (
                                                  <td className="py-4 px-6 text-right font-semibold text-slate-700">
                                                    {billRateComposition.allowancesMonthlyUSD
                                                      ? formatMoney(billRateComposition.allowancesMonthlyUSD, 'USD')
                                                      : '—'
                                                    }
                                                  </td>
                                                )}
                                                <td className="py-4 px-6 text-center">
                                                  <Badge className="bg-green-100 text-green-800 border-green-200">Benefits</Badge>
                                                </td>
                                              </tr>
                                              {/* Allowances & Benefits Detail Rows */}
                                              {expandedCategories.has('allowancesBenefits') && acidTestCostData && Object.entries(acidTestCostData.categories.allowancesBenefits).map(([itemKey, amount]) => (
                                                <tr key={`allowancesBenefits-${itemKey}`} className="bg-slate-25 border-l-4 border-l-green-500 hover:bg-green-25 transition-colors">
                                                  <td className="py-3 px-6 pl-12">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 bg-green-300 rounded-full"></div>
                                                      <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                    {formatMoney(amount, acidTestCostData.currency)}
                                                  </td>
                                                  {acidTestCostData?.currency !== 'USD' && (
                                                    <td className="py-3 px-6 text-right text-sm font-medium text-slate-500">
                                                      —
                                                    </td>
                                                  )}
                                                  <td className="py-3 px-6 text-center">
                                                    <Badge className="bg-green-50 text-green-600 border-green-100 text-xs">Detail</Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </>
                                          )}
                                          {acidTestCostData?.onboardingTotal > 0 && (
                                            <>
                                              <tr
                                                className="group hover:bg-rose-50 hover:border-l-4 hover:border-l-rose-500 transition-all duration-200 cursor-pointer"
                                                onClick={() => toggleCategoryExpansion('onboardingFees')}
                                              >
                                                <td className="py-4 px-6">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-rose-500"></div>
                                                    <span className="font-medium text-slate-800">Onboarding Fees (One Time)</span>
                                                    {expandedCategories.has('onboardingFees') ? (
                                                      <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-rose-600 transition-colors" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-rose-600 transition-colors" />
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                                  {formatMoney(acidTestCostData.onboardingTotal, acidTestCostData?.currency || 'EUR')}
                                                </td>
                                                {acidTestCostData?.currency !== 'USD' && (
                                                  <td className="py-4 px-6 text-right font-semibold text-slate-700">
                                                    {typeof breakdown.onboardingTotalUSD === 'number'
                                                      ? formatMoney(breakdown.onboardingTotalUSD, 'USD')
                                                      : '—'
                                                    }
                                                  </td>
                                                )}
                                                <td className="py-4 px-6 text-center">
                                                  <Badge className="bg-rose-100 text-rose-800 border-rose-200">One Time</Badge>
                                                </td>
                                              </tr>
                                              {expandedCategories.has('onboardingFees') && acidTestCostData && Object.entries(acidTestCostData.categories.onboardingFees).map(([itemKey, amount]) => (
                                                <tr key={`onboardingFees-${itemKey}`} className="bg-slate-25 border-l-4 border-l-rose-500 hover:bg-rose-25 transition-colors">
                                                  <td className="py-3 px-6 pl-12">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 bg-rose-300 rounded-full"></div>
                                                      <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                    {formatMoney(amount, acidTestCostData.currency)}
                                                  </td>
                                                  {acidTestCostData?.currency !== 'USD' && (
                                                    <td className="py-3 px-6 text-right text-sm font-medium text-slate-500">
                                                      —
                                                    </td>
                                                  )}
                                                  <td className="py-3 px-6 text-center">
                                                    <Badge className="bg-rose-50 text-rose-600 border-rose-100 text-xs">Detail</Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </>
                                          )}
                                          {billRateComposition.terminationMonthly > 0 && (
                                            <>
                                              <tr
                                                className="group hover:bg-yellow-50 hover:border-l-4 hover:border-l-yellow-500 transition-all duration-200 cursor-pointer"
                                                onClick={() => toggleCategoryExpansion('terminationCosts')}
                                              >
                                                <td className="py-4 px-6">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-yellow-500"></div>
                                                    <span className="font-medium text-slate-800">Termination Provision</span>
                                                    {expandedCategories.has('terminationCosts') ? (
                                                      <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-yellow-600 transition-colors" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-yellow-600 transition-colors" />
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-semibold text-slate-900">
                                                  {formatMoney(billRateComposition.terminationMonthly, acidTestCostData?.currency || 'EUR')}
                                                </td>
                                                {acidTestCostData?.currency !== 'USD' && (
                                                  <td className="py-4 px-6 text-right font-semibold text-slate-700">
                                                    {billRateComposition.terminationMonthlyUSD
                                                      ? formatMoney(billRateComposition.terminationMonthlyUSD, 'USD')
                                                      : '—'
                                                    }
                                                  </td>
                                                )}
                                                <td className="py-4 px-6 text-center">
                                                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Risk</Badge>
                                                </td>
                                              </tr>
                                              {/* Termination Provision Detail Rows */}
                                              {expandedCategories.has('terminationCosts') && acidTestCostData && Object.entries(acidTestCostData.categories.terminationCosts).map(([itemKey, amount]) => (
                                                <tr key={`terminationCosts-${itemKey}`} className="bg-slate-25 border-l-4 border-l-yellow-500 hover:bg-yellow-25 transition-colors">
                                                  <td className="py-3 px-6 pl-12">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                                                      <span className="text-sm text-slate-600">{itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-3 px-6 text-right text-sm font-medium text-slate-700">
                                                    {formatMoney(amount, acidTestCostData.currency)}
                                                  </td>
                                                  {acidTestCostData?.currency !== 'USD' && (
                                                    <td className="py-3 px-6 text-right text-sm font-medium text-slate-500">
                                                      —
                                                    </td>
                                                  )}
                                                  <td className="py-3 px-6 text-center">
                                                    <Badge className="bg-yellow-50 text-yellow-600 border-yellow-100 text-xs">Detail</Badge>
                                                  </td>
                                                </tr>
                                              ))}
                                            </>
                                          )}
                                          <tr className="hover:bg-slate-50 transition-colors bg-purple-50">
                                            <td className="py-4 px-6">
                                              <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 bg-purple-600"></div>
                                                <span className="font-bold text-purple-800">
                                                  {(() => {
                                                    const value = Number.isFinite(billRateComposition.gracemarkFeePercentage)
                                                      ? billRateComposition.gracemarkFeePercentage
                                                      : billRateComposition.targetGracemarkFeePercentage
                                                    return `Gracemark Fee (${(value * 100).toFixed(1)}%)`
                                                  })()}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-purple-900">
                                              {formatMoney(billRateComposition.gracemarkFeeMonthly, acidTestCostData?.currency || 'EUR')}
                                            </td>
                                            {acidTestCostData?.currency !== 'USD' && (
                                              <td className="py-4 px-6 text-right font-bold text-purple-700">
                                                {billRateComposition.gracemarkFeeMonthlyUSD
                                                  ? formatMoney(billRateComposition.gracemarkFeeMonthlyUSD, 'USD')
                                                  : '—'
                                                }
                                              </td>
                                            )}
                                            <td className="py-4 px-6 text-center">
                                              <Badge className="bg-purple-100 text-purple-800 border-purple-200">Service</Badge>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* KPI Metrics Section - Moved Below Cost Breakdown */}
                                  {acidTestKpiMetrics && (
                                    <div className="space-y-4 mt-8">
                                      {/* Row 1: Total Assignment Costs - Full Width Rectangular */}
                                      <div className="w-full">
                                        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-6">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Assignment Costs</p>
                                          <div className="mt-2">
                                            <div className="text-3xl font-bold text-slate-900">
                                              {formatMoney(acidTestKpiMetrics.totals.assignment.local, acidTestKpiMetrics.localCurrency)}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                              Over {acidTestKpiMetrics.duration} month{acidTestKpiMetrics.duration === 1 ? '' : 's'} contract
                                            </p>
                                          </div>
                                          <div className="mt-4 text-sm text-slate-600">
                                            <span className="font-medium text-slate-700">USD:</span>{' '}
                                            {acidTestKpiMetrics.totals.assignment.usd !== null
                                              ? formatMoney(acidTestKpiMetrics.totals.assignment.usd, 'USD')
                                              : '—'}
                                          </div>
                                          <p className="mt-3 text-xs text-slate-500">
                                            Recurring costs excluding Gracemark fee & onboarding.
                                          </p>
                                        </div>
                                      </div>

                                      {/* Row 2: Bill Rate (All-In) and Monthly Bill Rate */}
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-6">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill Rate (All-In)</p>
                                          <div className="mt-2">
                                            <div className="text-3xl font-bold text-slate-900">
                                              {formatMoney(acidTestKpiMetrics.totals.billRate.local, acidTestKpiMetrics.localCurrency)}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                              Over {acidTestKpiMetrics.duration} month{acidTestKpiMetrics.duration === 1 ? '' : 's'} contract
                                            </p>
                                          </div>
                                          <div className="mt-4 text-sm text-slate-600">
                                            <span className="font-medium text-slate-700">USD:</span>{' '}
                                            {acidTestKpiMetrics.totals.billRate.usd !== null
                                              ? formatMoney(acidTestKpiMetrics.totals.billRate.usd, 'USD')
                                              : '—'}
                                          </div>
                                          <p className="mt-3 text-xs text-slate-500">
                                            Total revenue including all costs & onboarding.
                                          </p>
                                        </div>

                                        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-6">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly Bill Rate</p>
                                          <div className="mt-2">
                                            <div className="text-3xl font-bold text-slate-900">
                                              {formatMoney(acidTestKpiMetrics.totals.monthlyBillRate.local, acidTestKpiMetrics.localCurrency)}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                              Per month recurring revenue
                                            </p>
                                          </div>
                                          <div className="mt-4 text-sm text-slate-600">
                                            <span className="font-medium text-slate-700">USD:</span>{' '}
                                            {acidTestKpiMetrics.totals.monthlyBillRate.usd !== null
                                              ? formatMoney(acidTestKpiMetrics.totals.monthlyBillRate.usd, 'USD')
                                              : '—'}
                                          </div>
                                          <p className="mt-3 text-xs text-slate-500">
                                            Monthly rate excluding onboarding fees.
                                          </p>
                                        </div>
                                      </div>

                                      {/* Row 3: Total Profit and Monthly Markup Fee */}
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-6">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Profit</p>
                                          <div className="mt-2">
                                            <div className="text-3xl font-bold text-slate-900">
                                              {formatMoney(acidTestKpiMetrics.totals.profit.local, acidTestKpiMetrics.localCurrency)}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                              Over {acidTestKpiMetrics.duration} month{acidTestKpiMetrics.duration === 1 ? '' : 's'} contract
                                            </p>
                                          </div>
                                          <div className="mt-4 text-sm text-slate-600">
                                            <span className="font-medium text-slate-700">USD:</span>{' '}
                                            {acidTestKpiMetrics.totals.profit.usd !== null
                                              ? formatMoney(acidTestKpiMetrics.totals.profit.usd, 'USD')
                                              : '—'}
                                          </div>
                                          <p className="mt-3 text-xs text-slate-500">
                                            Bill rate minus assignment costs.
                                          </p>
                                        </div>

                                        <div
                                          className={`border shadow-sm rounded-lg p-6 ${acidTestKpiMetrics.markupStyle.container}`}
                                        >
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Monthly Markup Fee
                                          </p>
                                          <div className="mt-3">
                                            <div className={`text-3xl font-bold ${acidTestKpiMetrics.markupStyle.value}`}>
                                              {acidTestKpiMetrics.totals.markup.local !== null
                                                ? formatMoney(acidTestKpiMetrics.totals.markup.local, acidTestKpiMetrics.localCurrency)
                                                : '—'}
                                            </div>
                                            <p className={`text-xs mt-1 ${acidTestKpiMetrics.markupStyle.accent}`}>
                                              {(() => {
                                                const durationValue = acidTestKpiMetrics.duration && acidTestKpiMetrics.duration > 0
                                                  ? acidTestKpiMetrics.duration
                                                  : null
                                                const durationLabel = durationValue ?? '—'
                                                const plural = durationValue === 1 ? '' : 's'
                                                return `Based on ${durationLabel} month${plural} contract.`
                                              })()}
                                            </p>
                                          </div>
                                          <div className="mt-4 text-sm text-slate-700">
                                            <span className="font-medium">USD:</span>{' '}
                                            {acidTestKpiMetrics.totals.markup.usd !== null
                                              ? formatMoney(acidTestKpiMetrics.totals.markup.usd, 'USD')
                                              : '—'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Rate Comparison Section */}
                                  {/* <div className="grid gap-6 lg:grid-cols-2">
                                    {/* Your Rate vs Expected */}
                                    {/* <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-6 shadow-sm">
                                      <h5 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-slate-600" />
                                        Rate Comparison
                                      </h5>

                                      <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-white border border-slate-200 shadow-sm">
                                          <span className="font-medium text-slate-700">Your Bill Rate</span>
                                          <span className="text-lg font-bold text-slate-900">
                                            {formatAmount(billRateComposition.actualBillRate, billRateComposition.actualBillRateUSD)}
                                          </span>
                                        </div>

                                        <div className="flex justify-between items-center p-3 bg-white border border-slate-200 shadow-sm">
                                          <span className="font-medium text-slate-700">Expected Rate</span>
                                          <span className="text-lg font-bold text-slate-900">
                                            {formatAmount(billRateComposition.expectedBillRate, billRateComposition.expectedBillRateUSD)}
                                          </span>
                                        </div>

                                        <div className={`flex justify-between items-center p-4 border-2 shadow-md ${
                                          billRateComposition.rateDiscrepancy >= 0
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                        }`}>
                                          <span className="font-bold text-slate-800">Net Difference</span>
                                          <span className={`text-xl font-bold ${
                                            billRateComposition.rateDiscrepancy >= 0 ? 'text-green-700' : 'text-red-700'
                                          }`}>
                                            {renderDifferenceValue(billRateComposition.rateDiscrepancy, billRateComposition.rateDiscrepancyUSD)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Analysis & Recommendations */}
                                    {/* <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 p-6 shadow-sm">
                                      <h5 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Target className="h-5 w-5 text-blue-600" />
                                        Analysis & Insights
                                      </h5>

                                      {billRateComposition.rateDiscrepancy !== 0 && (
                                        <div className="space-y-4">
                                          <div className={`p-4 border-l-4 ${
                                            billRateComposition.rateDiscrepancy >= 0
                                              ? 'bg-green-50 border-green-400'
                                              : 'bg-red-50 border-red-400'
                                          }`}>
                                            <div className={`font-semibold mb-2 ${
                                              billRateComposition.rateDiscrepancy >= 0 ? 'text-green-800' : 'text-red-800'
                                            }`}>
                                              {billRateComposition.rateDiscrepancy >= 0 ? '✅ Above Expected Rate' : '⚠️ Below Expected Rate'}
                                            </div>
                                            <p className={`text-sm ${
                                              billRateComposition.rateDiscrepancy >= 0 ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                              {billRateComposition.rateDiscrepancy >= 0 ? (
                                                <>
                                                  Your rate is {formatAmount(
                                                    Math.abs(billRateComposition.rateDiscrepancy),
                                                    typeof billRateComposition.rateDiscrepancyUSD === 'number'
                                                      ? Math.abs(billRateComposition.rateDiscrepancyUSD)
                                                      : undefined
                                                  )} above the expected rate. This provides additional margin for unexpected costs or higher profitability.
                                                </>
                                              ) : (
                                                <>
                                                  Your rate is {formatAmount(
                                                    Math.abs(billRateComposition.rateDiscrepancy),
                                                    typeof billRateComposition.rateDiscrepancyUSD === 'number'
                                                      ? Math.abs(billRateComposition.rateDiscrepancyUSD)
                                                      : undefined
                                                  )} below the expected rate. Consider increasing to ensure proper {Math.round(billRateComposition.targetGracemarkFeePercentage * 100)}% Gracemark fee coverage (current coverage {(Number.isFinite(billRateComposition.gracemarkFeePercentage)
                                                    ? (billRateComposition.gracemarkFeePercentage * 100).toFixed(1)
                                                    : (billRateComposition.targetGracemarkFeePercentage * 100).toFixed(1)
                                                  )}%).
                                                </>
                                              )}
                                            </p>
                                          </div>

                                          <div className="bg-blue-100 border border-blue-200 p-3">
                                            <div className="font-medium text-blue-900 mb-1">Recommended Action</div>
                                            <p className="text-sm text-blue-800">
                                              {billRateComposition.rateDiscrepancy >= 0
                                                ? 'Your current rate structure provides healthy margins. Monitor for any significant cost changes in future periods.'
                                                : 'Review your pricing strategy. Consider client negotiation or cost optimization to improve margins.'
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div> */}
                                </div>
                              </div>
                            )
                          })()}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Button variant="outline" onClick={handleCloseAcidTest} className="px-6">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Recommendation
                      </Button>
                      {acidTestResults && (
                        <Button
                          onClick={handleExportAcidTestPdf}
                          className="bg-purple-600 px-8 py-3 text-base font-medium text-white hover:bg-purple-700"
                          disabled={isExportingPdf}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {isExportingPdf ? 'Exporting...' : 'Export PDF'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Extract selected quote data after reconciliation
  const extractSelectedQuoteData = async (finalChoice: {
    provider: string
    price: number
    currency: string
    enhancedQuote?: EnhancedQuote
  }) => {
    if (!finalChoice?.enhancedQuote) {
      return null
    }

    const { enhancedQuote } = finalChoice
    const providerKey = finalChoice.provider as ProviderType

    const resolveMonthlyAmount = (value: unknown): number => {
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

    const categorizeSelectedItems = async (
      selectedItems: Array<{ key: string; name: string; monthly_amount: number }>
    ) => {
      if (!selectedItems.length) {
        return null
      }

      const normalizeCategories = (input: Partial<AcidTestCategoryBuckets>): AcidTestCategoryBuckets => ({
        baseSalary: input.baseSalary || {},
        statutoryMandatory: input.statutoryMandatory || {},
        allowancesBenefits: input.allowancesBenefits || {},
        terminationCosts: input.terminationCosts || {},
        oneTimeFees: input.oneTimeFees || {},
        onboardingFees: input.onboardingFees || {},
      })

      const addOnboardingFees = async (categories: AcidTestCategoryBuckets): Promise<AcidTestCategoryBuckets> => {
        const formData = quoteData?.formData as EORFormData | undefined

        const resolveCountryCode = (): string | null => {
          const candidates: Array<string | null | undefined> = [
            formData?.country,
            (formData as unknown as { countryCode?: string })?.countryCode,
            (formData as unknown as { country_code?: string })?.country_code,
            finalChoice.enhancedQuote?.baseQuote?.country,
          ]

          for (const candidate of candidates) {
            const normalized = normalizeCountryIdentifier(candidate ?? null)
            if (normalized) {
              return normalized
            }
          }

          const providerQuotes = quoteData?.quotes as Record<string, unknown> | undefined
          if (providerQuotes && providerKey && providerQuotes[providerKey]) {
            const found = findLocalOfficeCountryCodeInObject(providerQuotes[providerKey])
            const normalized = normalizeCountryIdentifier(found)
            if (normalized) {
              return normalized
            }
          }

          return null
        }

        const resolvedCountryCode = resolveCountryCode()
        if (!resolvedCountryCode || !hasLocalOfficeData(resolvedCountryCode)) {
          return {
            ...categories,
            onboardingFees: { ...categories.onboardingFees }
          }
        }

        const localOfficeInfo = formData?.localOfficeInfo as LocalOfficeInfo | undefined
        const originalLocalOfficeDefaults = getOriginalLocalOfficeData(resolvedCountryCode)

        const formCurrency = formData?.currency || null
        const targetCurrency = finalChoice.currency

        if (!targetCurrency) {
          return {
            ...categories,
            onboardingFees: { ...categories.onboardingFees }
          }
        }

        const updatedOnboardingFees: Record<string, number> = {
          ...(categories.onboardingFees || {})
        }

        await Promise.all(ONBOARDING_FEE_FIELDS.map(async ({ field, key }) => {
          let parsedAmount = sanitizeLocalOfficeAmount(localOfficeInfo?.[field])
          let amountSourceCurrency: string | null = null

          // Determine the source currency for the value from localOfficeInfo
          if (parsedAmount > 0 && originalLocalOfficeDefaults) {
            const originalAmount = sanitizeLocalOfficeAmount(originalLocalOfficeDefaults[field])
            const fieldCurrency = getFieldCurrency(field, resolvedCountryCode)

            // If this is a USD field, check if the value is still in USD or has been converted
            if (fieldCurrency === 'usd' && originalAmount > 0) {
              // If the parsed amount is close to the original USD amount (within 5% tolerance),
              // it's likely still in USD. Otherwise, it's been converted to form currency.
              const tolerance = originalAmount * 0.05
              const isStillUSD = Math.abs(parsedAmount - originalAmount) <= tolerance
              amountSourceCurrency = isStillUSD ? 'USD' : (formCurrency || targetCurrency)
            } else {
              // For local currency fields, the value is in form currency
              amountSourceCurrency = formCurrency || targetCurrency
            }
          } else if (parsedAmount > 0) {
            // No original defaults available, assume it's in form currency
            amountSourceCurrency = formCurrency || targetCurrency
          }

          // Fall back to original defaults if no value from form
          if (parsedAmount <= 0 && originalLocalOfficeDefaults) {
            const fallbackAmount = sanitizeLocalOfficeAmount(originalLocalOfficeDefaults[field])
            if (fallbackAmount > 0) {
              parsedAmount = fallbackAmount
              amountSourceCurrency = getFieldCurrency(field, resolvedCountryCode) === 'usd' ? 'USD' : targetCurrency
            }
          }

          if (parsedAmount <= 0) return

          let amount = parsedAmount
          if (amountSourceCurrency && amountSourceCurrency !== targetCurrency) {
            try {
              const conversion = await convertCurrency(parsedAmount, amountSourceCurrency, targetCurrency)
              if (!conversion.success || !conversion.data) {
                console.warn(`Failed to convert onboarding fee ${field} from ${amountSourceCurrency} to ${targetCurrency}:`, conversion.error)
                return
              }
              amount = conversion.data.target_amount
            } catch (err) {
              console.warn(`Error converting onboarding fee ${field}:`, err)
              return
            }
          }

          if (Number.isFinite(amount) && amount > 0) {
            updatedOnboardingFees[key] = Number(amount.toFixed(2))
          }
        }))

        return {
          ...categories,
          onboardingFees: updatedOnboardingFees
        }
      }

      const buildAggregates = (categories: AcidTestCategoryBuckets) => {
        const sumBucket = (bucket: Record<string, number>) =>
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

      const requestPayload = {
        provider: providerKey,
        country: (quoteData?.formData as EORFormData)?.country || 'Unknown',
        currency: finalChoice.currency,
        costItems: selectedItems.map(item => ({
          key: item.key,
          name: item.name,
          monthly_amount: item.monthly_amount
        }))
      }

      try {
        const response = await fetch('/api/categorize-costs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const categorizedData = normalizeCategories(await response.json() as Partial<AcidTestCategoryBuckets>)
        const enriched = await addOnboardingFees(categorizedData)
        const aggregates = buildAggregates(enriched)
        return { categories: enriched, aggregates }
      } catch (error) {
        console.error('LLM categorization failed, falling back to simple categorization:', error)

        const baseSalary: Record<string, number> = {}
        const statutoryMandatory: Record<string, number> = {}
        const allowancesBenefits: Record<string, number> = {}
        const terminationCosts: Record<string, number> = {}
        const oneTimeFees: Record<string, number> = {}
        const onboardingFees: Record<string, number> = {}

        selectedItems.forEach(item => {
          const key = item.key.toLowerCase()
          const name = item.name.toLowerCase()
          const amount = item.monthly_amount || 0

          if (key.includes('base_salary') || name.includes('base salary')) {
            baseSalary[item.key] = amount
          } else if (
            key.includes('severance') ||
            name.includes('severance') ||
            key.includes('probation') ||
            name.includes('probation')
          ) {
            terminationCosts[item.key] = amount
          } else if (
            key.includes('medical') ||
            name.includes('medical') ||
            key.includes('drug') ||
            name.includes('drug') ||
            key.includes('background') ||
            name.includes('background') ||
            key.includes('onboarding')
          ) {
            onboardingFees[item.key] = amount
          } else if (key.includes('setup')) {
            oneTimeFees[item.key] = amount
          } else if (key.includes('allowance') || key.includes('meal') || key.includes('transport')) {
            allowancesBenefits[item.key] = amount
          } else {
            allowancesBenefits[item.key] = amount
          }
        })

        const fallbackCategories = normalizeCategories({
          baseSalary,
          statutoryMandatory,
          allowancesBenefits,
          terminationCosts,
          oneTimeFees,
          onboardingFees,
        })

        const enrichedFallback = await addOnboardingFees(fallbackCategories)

        return {
          categories: enrichedFallback,
          aggregates: buildAggregates(enrichedFallback),
        }
      }
    }

    const cachedItems = cachedCostItems[providerKey]
    if (cachedItems && cachedItems.length > 0) {
      return categorizeSelectedItems(cachedItems)
    }

    const normaliseItems = (source: any[]): Array<{ key: string; name: string; monthly_amount: number }> => {
      if (!Array.isArray(source)) return []
      return source
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null

          const rawKey = typeof (item as any).key === 'string' ? (item as any).key.trim() : ''
          const keyBase = rawKey.length
            ? rawKey
            : (typeof (item as any).name === 'string' && (item as any).name.trim().length
              ? (item as any).name.trim()
              : `item_${index}`)

          const friendlyName = typeof (item as any).name === 'string' && (item as any).name.trim().length
            ? (item as any).name.trim()
            : keyBase.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

          const normalizedKeyBase = keyBase.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `item_${index}`
          const canonicalKey = canonicalizeKey(normalizedKeyBase, friendlyName)

          const amountCandidates = [
            (item as any).monthly_amount,
            (item as any).monthly_amount_local,
            (item as any).amount,
            (item as any).monthlyAmount,
            (item as any).value
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
            ...(item as Record<string, unknown>),
            key: canonicalKey,
            name: friendlyName,
            monthly_amount: monthlyAmount
          } as { key: string; name: string; monthly_amount: number }
        })
        .filter(Boolean) as Array<{ key: string; name: string; monthly_amount: number }>
    }

    const formatKeyName = (raw: string) => raw
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, letter => letter.toUpperCase())

    const canonicalizeKey = (normalizedKeyInput: string, name: string): string => {
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

    const normalizeFullQuoteItem = (
      entry: any,
      index: number
    ): { key: string; name: string; monthly_amount: number } | null => {
      if (!entry) return null

      const amount = resolveMonthlyAmount(
        (entry as any).monthly_amount ??
        (entry as any).monthlyAmount ??
        (entry as any).amount ??
        (entry as any).monthly_amount_local ??
        (entry as any).value
      )
      if (!Number.isFinite(amount) || amount === 0) return null
      if ((entry as any).already_included === true || (entry as any).alreadyIncluded === true) return null

      const rawKey = typeof entry?.key === 'string' && entry.key.trim().length > 0
        ? entry.key.trim()
        : `item_${index}`
      const safeName = typeof entry?.name === 'string' && entry.name.trim().length > 0
        ? entry.name.trim()
        : formatKeyName(rawKey)

      const normalizedKey = rawKey
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `item_${index}`

      const canonicalKey = canonicalizeKey(normalizedKey, safeName)

      return {
        key: canonicalKey,
        name: safeName,
        monthly_amount: Number(amount.toFixed(2))
      }
    }

    const sumItems = (list: Array<{ monthly_amount: number }>) =>
      list.reduce((total, current) => total + current.monthly_amount, 0)

    const dropEmployeeSideEntries = (item: { key: string; name: string }) => {
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
        'employee pension'
      ]
      return exclusionPatterns.some(pattern =>
        lowerName.includes(pattern) || lowerKey.includes(pattern.replace(/\s+/g, '_'))
      )
    }

    const structuredItemsCandidate: Array<{ key: string; name: string; monthly_amount: number }> = Array.isArray(enhancedQuote.fullQuote?.items)
      ? (enhancedQuote.fullQuote?.items as any[])
          .map((entry, index) => normalizeFullQuoteItem(entry, index))
          .filter((item): item is { key: string; name: string; monthly_amount: number } => !!item && !dropEmployeeSideEntries(item))
      : []

    const items: Array<{ key: string; name: string; monthly_amount: number }> = []

    const useFallbackAggregation = true
    let displayQuoteCurrency: string | undefined

    if (useFallbackAggregation) {
      const entryTypeDedup: Record<string, Set<string>> = {}
      const seenEntryFingerprints = new Set<string>()
      const seenFallbackEntries = new Set<string>()
      const canonicalDedupeKeys = new Set([
        'thirteenth_salary',
        'fourteenth_salary',
        'vacation_bonus'
      ])
      const canonicalDedupeSeen = new Set<string>()

      const classifyEntryName = (name: string):
        | 'base_salary'
        | 'statutory'
        | 'termination'
        | 'gracemark'
        | 'provider_fee'
        | 'allowance'
        | 'one_time'
        | 'other' => {
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

      const convertFrequencyToMonthly = (amount: number, frequency?: string) => {
        if (!frequency || !Number.isFinite(amount)) return amount
        const freq = frequency.toLowerCase()
        if (freq.includes('one_time') || freq.includes('one-time')) return amount
        if (freq.includes('year')) return amount / 12
        if (freq.includes('annual')) return amount / 12
        if (freq.includes('quarter')) return amount / 3
        if (freq.includes('semiannual') || freq.includes('semi-annual') || freq.includes('biannual')) return amount / 6
        if (freq.includes('biweek')) return amount * (26 / 12)
        if (freq.includes('week')) return amount * (52 / 12)
        if (freq.includes('day')) return amount * 21.75
        return amount
      }

      const addCostEntry = (keyCandidate: string | undefined, nameCandidate: string | undefined, amountInput: unknown, frequency?: string) => {
        const amount = resolveMonthlyAmount(amountInput)
        const monthly = convertFrequencyToMonthly(amount, frequency)
        if (!Number.isFinite(monthly) || monthly === 0) return

        const safeNameBase = nameCandidate && nameCandidate.trim().length > 0
          ? nameCandidate.trim()
          : (keyCandidate && keyCandidate.trim().length > 0
            ? keyCandidate.trim()
            : `Item ${items.length + 1}`)
        const safeName = formatKeyName(safeNameBase)

        const normalizedKeyBase = keyCandidate && keyCandidate.trim().length > 0 ? keyCandidate.trim() : safeName
        const sanitizedKey = normalizedKeyBase.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `item_${items.length + 1}`
        const canonicalKey = canonicalizeKey(sanitizedKey, safeName)
        const fingerprint = `${canonicalKey}:${monthly.toFixed(2)}`

        if (canonicalDedupeKeys.has(canonicalKey) && canonicalDedupeSeen.has(canonicalKey)) {
          return
        }

        if (seenEntryFingerprints.has(fingerprint)) return

        const normalizedNameLower = safeName.toLowerCase()
        const hashKey = `${normalizedNameLower}:${monthly.toFixed(2)}`
        if (seenFallbackEntries.has(hashKey)) return
        if (dropEmployeeSideEntries({ key: canonicalKey, name: safeName })) return
        if (normalizedNameLower.includes('total') && !/allowance|benefit|termination|gracemark|provider/.test(normalizedNameLower)) return

        const entryType = classifyEntryName(safeName)
        const dedupeSensitiveTypes: Partial<Record<ReturnType<typeof classifyEntryName>, true>> = {
          base_salary: true,
          gracemark: true,
          provider_fee: true,
        }
        if (dedupeSensitiveTypes[entryType]) {
          const amountKey = monthly.toFixed(2)
          if (!entryTypeDedup[entryType]) {
            entryTypeDedup[entryType] = new Set<string>()
          }
          const bucket = entryTypeDedup[entryType]!
          const compositeKey = `${entryType}:${amountKey}`
          if (bucket.has(compositeKey)) return
          bucket.add(compositeKey)
        }

        seenFallbackEntries.add(hashKey)
        if (canonicalDedupeKeys.has(canonicalKey)) {
          canonicalDedupeSeen.add(canonicalKey)
        }
        items.push({
          key: canonicalKey,
          name: safeName,
          monthly_amount: Number(monthly.toFixed(2))
        })
        seenEntryFingerprints.add(fingerprint)
      }

      const pushCostArray = (costs: any[], contextLabel: string) => {
        costs.forEach((entry, idx) => {
          if (!entry) return
          const entryName = typeof entry?.name === 'string' && entry.name.trim().length > 0
            ? entry.name.trim()
            : `${contextLabel} ${idx + 1}`
          const entryKey = typeof entry?.key === 'string' && entry.key.trim().length > 0 ? entry.key.trim() : entryName
          const frequency = typeof entry?.frequency === 'string' ? entry.frequency : undefined
          const amountCandidate = entry?.monthly_amount ?? entry?.monthlyAmount ?? entry?.monthly_amount_local ?? entry?.amount ?? entry?.value ?? entry?.usd_amount ?? entry?.local_amount
          addCostEntry(entryKey, entryName, amountCandidate, frequency)
        })
      }

      const visitedRaw = new WeakSet<object>()

      function scanRawValue(value: unknown, contextLabel: string): void {
        if (!value) return
        if (Array.isArray(value)) {
          pushCostArray(value, contextLabel)
          value.forEach((entry) => {
            if (entry && typeof entry === 'object') scanRawValue(entry, contextLabel)
          })
          return
        }
        if (typeof value !== 'object') return
        const obj = value as Record<string, unknown>
        if (visitedRaw.has(obj)) return
        visitedRaw.add(obj as object)

        if (Array.isArray(obj.costs)) pushCostArray(obj.costs as any[], `${contextLabel} Costs`)
        if (Array.isArray((obj as any).items)) pushCostArray((obj as any).items as any[], `${contextLabel} Items`)
        if (Array.isArray((obj as any).line_items)) pushCostArray((obj as any).line_items as any[], `${contextLabel} Line`)
        if (Array.isArray((obj as any).components)) pushCostArray((obj as any).components as any[], `${contextLabel} Component`)
        if (Array.isArray((obj as any).monthly_contributions_breakdown)) pushCostArray((obj as any).monthly_contributions_breakdown as any[], `${contextLabel} Contribution`)
        if (Array.isArray((obj as any).monthly_benefits_breakdown)) pushCostArray((obj as any).monthly_benefits_breakdown as any[], `${contextLabel} Benefit`)
        if (Array.isArray((obj as any).allowances)) pushCostArray((obj as any).allowances as any[], `${contextLabel} Allowance`)
        if (Array.isArray((obj as any).fees)) pushCostArray((obj as any).fees as any[], `${contextLabel} Fee`)

        const breakdownKeys = [
          'breakdown',
          'monthly_costs_breakdown',
          'monthlyBreakdown',
          'employer_contributions_breakdown',
          'statutoryContributions',
          'statutory_contributions',
          'additionalFees',
          'additional_fees',
          'totals'
        ]
        breakdownKeys.forEach(key => {
          const entry = obj[key]
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            pushBreakdownObject(entry as Record<string, unknown>, formatKeyName(key))
          }
        })

        Object.entries(obj).forEach(([key, child]) => {
          if (!child) return
          if (Array.isArray(child) || typeof child === 'object') {
            scanRawValue(child, formatKeyName(key))
          }
        })
      }

      function pushBreakdownObject(record: Record<string, unknown>, contextLabel: string): void {
        Object.entries(record).forEach(([key, value]) => {
          if (key === 'baseCost') return
          if (value == null) return
          const combinedLabel = formatKeyName(`${contextLabel} ${key}`)
          if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') {
            addCostEntry(key, combinedLabel, value)
            return
          }
          if (typeof value === 'object') {
            const frequency = typeof (value as any)?.frequency === 'string' ? (value as any).frequency : undefined
            const amountCandidate = (value as any)?.monthly_amount ?? (value as any)?.monthlyAmount ?? (value as any)?.amount ?? (value as any)?.value
            if (amountCandidate !== undefined) {
              addCostEntry(key, combinedLabel, amountCandidate, frequency)
            } else {
              scanRawValue(value, combinedLabel)
            }
          }
        })
      }
      const resolveDisplayQuote = (): Quote | undefined => {
        if (!quoteData?.quotes) return undefined
        const raw = (quoteData.quotes as Record<string, unknown>)[providerKey]
        if (!raw) return undefined

        const isDisplayQuote = (value: unknown): value is Quote => {
          return !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).costs)
        }

        if (providerKey === 'remote') {
          if (isDisplayQuote(raw)) return raw
          if (typeof raw === 'object' && raw !== null && 'employment' in raw) {
            return transformRemoteResponseToQuote(raw as RemoteAPIResponse)
          }
          return undefined
        }

        if (providerKey === 'rivermate') {
          if (isDisplayQuote(raw)) return raw
          if (typeof raw === 'object' && raw !== null && 'taxItems' in (raw as Record<string, unknown>)) {
            return transformRivermateQuoteToDisplayQuote(raw as RivermateQuote)
          }
          return undefined
        }

        if (providerKey === 'oyster') {
          if (isDisplayQuote(raw)) return raw
          if (typeof raw === 'object' && raw !== null && 'contributions' in (raw as Record<string, unknown>)) {
            return transformOysterQuoteToDisplayQuote(raw as OysterQuote)
          }
          return undefined
        }

        return isDisplayQuote(raw) ? raw : undefined
      }

      const displayQuote = resolveDisplayQuote()
      displayQuoteCurrency = displayQuote?.currency
      if (displayQuote) {
        if (Array.isArray(displayQuote.costs)) {
          pushCostArray(displayQuote.costs, `${finalChoice.provider} Cost`)
        }
        if (displayQuote && typeof (displayQuote as any).breakdown === 'object') {
          pushBreakdownObject((displayQuote as any).breakdown, `${finalChoice.provider} Breakdown`)
        }
      }

      const rawEntry = getRawQuote(providerKey)
      if (rawEntry?.primary) {
        scanRawValue(rawEntry.primary, `${finalChoice.provider} Raw`)
      }

      const hasBaseSalaryFromItems = items.some(
        entry => typeof entry?.name === 'string' && entry.name.toLowerCase() === 'base salary'
      )

      if (!hasBaseSalaryFromItems) {
        const baseSalaryCandidates = [
          enhancedQuote.fullQuote?.base_salary_monthly,
          enhancedQuote.baseQuote?.baseCost,
          enhancedQuote.monthlyCostBreakdown?.baseCost
        ]
        const baseSalary = baseSalaryCandidates
          .map(resolveMonthlyAmount)
          .find(amount => amount > 0) || 0

        if (baseSalary > 0) {
          addCostEntry('base_salary', 'Base Salary', baseSalary)
        }
      }

      if (enhancedQuote.enhancements) {
        const { severanceProvision, noticePeriodCost } = enhancedQuote.enhancements

        const addTerminationComponentEntry = (
          key: string,
          label: string,
          component: TerminationComponentEnhancement | undefined
        ) => {
          if (!component) return
          if (component.isAlreadyIncluded) return
          const monthly = Number(component.monthlyAmount || 0)
          if (!Number.isFinite(monthly) || monthly <= 0) return
          addCostEntry(key, label, monthly)
        }

        addTerminationComponentEntry('severance_cost', 'Severance Cost', severanceProvision)
        addTerminationComponentEntry('notice_period_cost', 'Notice Period Cost', noticePeriodCost)

        if (enhancedQuote.enhancements.additionalContributions) {
          Object.entries(enhancedQuote.enhancements.additionalContributions).forEach(([key, value]) => {
            const sourceValue = (value && typeof value === 'object' && 'monthly_amount' in (value as Record<string, unknown>))
              ? (value as any).monthly_amount
              : value

            // Map local office items to proper labels
            const lowerKey = key.toLowerCase()
            let label: string

            if (lowerKey.includes('local_meal_voucher')) {
              label = 'Meal Voucher (Local Office)'
            } else if (lowerKey.includes('local_transportation')) {
              label = 'Transportation (Local Office)'
            } else if (lowerKey.includes('local_wfh')) {
              label = 'WFH (Local Office)'
            } else if (lowerKey.includes('local_health_insurance')) {
              label = 'Health Insurance (Local Office)'
            } else if (lowerKey.includes('local_office_monthly_payments')) {
              label = 'Local Office Monthly Payments'
            } else if (lowerKey.includes('local_office_vat')) {
              label = 'VAT on Local Office Payments'
            } else {
              label = key.replace(/_/g, ' ')
            }

            addCostEntry(key, label, sourceValue)
          })
        }

        Object.entries(enhancedQuote.enhancements).forEach(([key, value]) => {
          if (
            key === 'terminationCosts' ||
            key === 'terminationNotice' ||
            key === 'severanceProvision' ||
            key === 'noticePeriodCost' ||
            key === 'additionalContributions'
          ) return
          if (!value || typeof value !== 'object') return
          
          // Skip if enhancement is already included in base quote
          if ((value as any).isAlreadyIncluded) return

          const monthlyValue = resolveMonthlyAmount(
            (value as any).monthly_amount ??
            (value as any).monthlyAmount ??
            (value as any).amount ??
            (value as any).monthly_amount_local ??
            0
          )

          if (monthlyValue > 0) {
            addCostEntry(key, key.replace(/_/g, ' '), monthlyValue)
          }
        })
      }

      if (enhancedQuote.baseQuote?.breakdown) {
        pushBreakdownObject(enhancedQuote.baseQuote.breakdown, 'Base Quote')
      }
    }

    const normalisedItems = normaliseItems(items)

    const mergedItemsMap = new Map<string, { key: string; name: string; monthly_amount: number }>()
    normalisedItems.forEach(item => {
      const canonicalKey = canonicalizeKey(item.key, item.name)
      const normalizedKey = canonicalKey.toLowerCase()
      const normalizedName = item.name.toLowerCase()
      const isTerminationEntry = normalizedKey.includes('termination') || normalizedName.includes('termination')
      const isSeveranceEntry = normalizedKey.includes('severance') || normalizedName.includes('severance')
      const isNoticeEntry = normalizedKey.includes('notice') || normalizedName.includes('notice') || normalizedKey.includes('probation') || normalizedName.includes('probation')
      if (isTerminationEntry && !isSeveranceEntry && !isNoticeEntry) {
        return
      }
      const amount = Number(resolveMonthlyAmount(item.monthly_amount))
      if (!Number.isFinite(amount) || amount === 0) return
      const rounded = Number(amount.toFixed(2))
      const existing = mergedItemsMap.get(canonicalKey)
      if (existing) {
        existing.monthly_amount = Math.max(existing.monthly_amount, rounded)
        const formattedName = formatKeyName(item.name)
        if (existing.name.length < formattedName.length) {
          existing.name = formattedName
        }
      } else {
        mergedItemsMap.set(canonicalKey, {
          key: canonicalKey,
          name: formatKeyName(item.name),
          monthly_amount: rounded
        })
      }
    })

    const mergedItems = Array.from(mergedItemsMap.values())

    const combinedItemsMap = new Map<string, { key: string; name: string; monthly_amount: number }>()

    const normaliseCombinedItem = (item: { key: string; name: string; monthly_amount: number }) => {
      const sanitizedKey = item.key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const canonicalKey = canonicalizeKey(sanitizedKey, item.name)
      return {
        key: canonicalKey,
        name: formatKeyName(item.name),
        monthly_amount: Number(item.monthly_amount.toFixed(2))
      }
    }

    const addItemsToCombined = (
      itemsToAdd: Array<{ key: string; name: string; monthly_amount: number }>,
      { overwrite }: { overwrite: boolean }
    ) => {
      itemsToAdd.forEach(item => {
        if (dropEmployeeSideEntries(item)) return
        if (!Number.isFinite(item.monthly_amount) || item.monthly_amount === 0) return

        const normalizedEntry = normaliseCombinedItem(item)
        if (!overwrite && combinedItemsMap.has(normalizedEntry.key)) {
          return
        }

        combinedItemsMap.set(normalizedEntry.key, normalizedEntry)
      })
    }

    addItemsToCombined(mergedItems, { overwrite: true })
    addItemsToCombined(structuredItemsCandidate, { overwrite: false })

    if (combinedItemsMap.size === 0) {
      return null
    }

    const selectedItems = Array.from(combinedItemsMap.values())

    if (selectedItems.length === 0) {
      return null
    }

    setCachedCostItems(prev => ({
      ...prev,
      [providerKey]: selectedItems.map(item => ({ ...item }))
    }))

    updateProviderTotalsFromItems(
      providerKey,
      selectedItems,
      displayQuoteCurrency || enhancedQuote.baseQuote?.currency || finalChoice.currency
    )

    return categorizeSelectedItems(selectedItems)
  }

  const startReconciliation = async () => {
    setIsReconModalOpen(true)

    // Check if reconciliation has been completed before
    const hasCompletedBefore = completedPhases.has('analyzing') || completedPhases.has('complete')

    // Only reset state if this is a fresh reconciliation (not reopening)
    if (!hasCompletedBefore) {
      setFinalChoice(null)
      setCompletedPhases(new Set())
      setActivePhase('gathering')
      setProgressPercent(0)
      setProviderData([])
    } else {
      // Reconciliation was completed before - just reopen modal with existing state
      return
    }

    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'

    try {
      // Phase 1: Gathering Data (0-25%)
      startPhase('gathering')
      await smoothProgressUpdate(5)

      const prices: { provider: ProviderType; price: number }[] = allProviders
        .map(provider => {
          const price = getProviderPrice(provider)
          return price ? { provider, price } : null
        })
        .filter((item): item is { provider: ProviderType; price: number } => item !== null)

      if (prices.length === 0) {
        return;
      }

      // Optimized staggered provider cards
      for (let i = 0; i < prices.length; i++) {
        setProviderData(prev => [...prev, prices[i]])
        const targetProgress = 5 + ((i + 1) / prices.length) * 20
        await smoothProgressUpdate(targetProgress)
        await sleep(80) // Reduced from 150ms to 80ms
      }

      completePhase('gathering')
      
      // Reduced delay before next phase
      await sleep(1500) // Reduced from 2500ms to 1500ms
      
      // Phase 2: Analyzing Variance (25-60%)
      startPhase('analyzing')
      await smoothProgressUpdate(30)

      const deel = prices.find(p => p.provider === 'deel');
      if (!deel) {
        return;
      }

      await sleep(500) // Reduced from 800ms
      const lowerBound = deel.price * 0.96;
      const upperBound = deel.price * 1.04;
      await smoothProgressUpdate(45);

      await sleep(500) // Reduced from 800ms
      // Update provider data with range analysis
      const analyzedProviders = prices.map(p => ({
        ...p,
        inRange: p.price >= lowerBound && p.price <= upperBound
      }))
      setProviderData(analyzedProviders)
      await smoothProgressUpdate(60)
      completePhase('analyzing')

      // Reduced delay before next phase
      await sleep(1500) // Reduced from 2500ms to 1500ms

      // Phase 3: Selecting Optimal (60-90%)
      startPhase('selecting')
      await smoothProgressUpdate(65)

      const candidates = analyzedProviders.filter(p => p.inRange);

      if (candidates.length === 0) {
        return;
      }

      await sleep(600) // Reduced from 1000ms
      await smoothProgressUpdate(80)
      const choice = candidates.reduce((max, current) => (current.price > max.price ? current : max), candidates[0]);

      await sleep(400) // Reduced from 700ms - quicker winner selection
      // Mark winner in provider data
      const finalProviders = analyzedProviders.map(p => ({
        ...p,
        isWinner: p.provider === choice.provider
      }))
      setProviderData(finalProviders)
      await smoothProgressUpdate(90);
      completePhase('selecting')

      // Reduced delay before final phase
      await sleep(1500) // Reduced from 2500ms to 1500ms

      // Phase 4: Complete (90-100%)
      await smoothProgressUpdate(100)
      await sleep(200) // Reduced fade-in delay from 400ms to 200ms

      // Get the enhanced quote data for the selected provider
      const selectedEnhancement = enhancements[choice.provider as ProviderType]
      const finalChoiceData = {
        ...choice,
        currency,
        enhancedQuote: selectedEnhancement || undefined
      }
      setFinalChoice(finalChoiceData)

      completePhase('complete')

      // Start complete phase with auto-scroll
      startPhase('complete')

    } catch (error) {
      console.error("Reconciliation failed", error);
    }
  }

  const restartReconciliation = async () => {
    // Force reset all state for fresh reconciliation
    setFinalChoice(null)
    setCompletedPhases(new Set())
    setActivePhase('gathering')
    setProgressPercent(0)
    setProviderData([])

    const currency = (quoteData?.formData as EORFormData)?.currency || 'USD'

    try {
      // Phase 1: Gathering Data (0-25%)
      startPhase('gathering')
      await smoothProgressUpdate(5)

      const prices: { provider: ProviderType; price: number }[] = allProviders
        .map(provider => {
          const price = getProviderPrice(provider)
          return price ? { provider, price } : null
        })
        .filter((item): item is { provider: ProviderType; price: number } => item !== null)

      if (prices.length === 0) {
        return;
      }

      for (let i = 0; i < prices.length; i++) {
        const targetProgress = 5 + (i + 1) * (20 / prices.length)
        await smoothProgressUpdate(targetProgress)
        await sleep(80) // Reduced from 150ms to 80ms
      }

      completePhase('gathering')

      // Reduced delay before next phase
      await sleep(1500) // Reduced from 2500ms to 1500ms

      // Phase 2: Analyzing Variance (25-60%)
      startPhase('analyzing')
      await smoothProgressUpdate(30)

      const deel = prices.find(p => p.provider === 'deel');
      if (!deel) {
        return;
      }

      await sleep(500) // Reduced from 800ms
      const lowerBound = deel.price * 0.96;
      const upperBound = deel.price * 1.04;

      const analysis = prices.map(p => ({
        provider: p.provider,
        price: p.price,
        inRange: p.price >= lowerBound && p.price <= upperBound,
        isWinner: false
      }));

      for (let i = 0; i < analysis.length; i++) {
        const targetProgress = 30 + (i + 1) * (30 / analysis.length)
        await smoothProgressUpdate(targetProgress)
        await sleep(120) // Reduced from 200ms
      }

      setProviderData(analysis);
      completePhase('analyzing')
      await sleep(1200) // Reduced from 2000ms

      // Phase 3: Selecting Optimal (60-100%)
      startPhase('selecting')
      await smoothProgressUpdate(70)

      const inRangeProviders = analysis.filter(p => p.inRange);
      let winner;

      if (inRangeProviders.length > 0) {
        const cheapest = inRangeProviders.reduce((min, p) => p.price < min.price ? p : min);
        winner = cheapest;
      } else {
        const closest = analysis.reduce((closest, p) => {
          const currentDistance = Math.abs(p.price - deel.price);
          const closestDistance = Math.abs(closest.price - deel.price);
          return currentDistance < closestDistance ? p : closest;
        });
        winner = closest;
      }

      winner.isWinner = true;

      const updatedAnalysis = analysis.map(p =>
        p.provider === winner.provider ? { ...p, isWinner: true } : p
      );
      setProviderData(updatedAnalysis);

      await smoothProgressUpdate(85);
      await sleep(800); // Reduced from 1500ms

      await smoothProgressUpdate(100);
      await sleep(500); // Reduced from 1000ms

      // Find enhanced quote if available
      const selectedEnhancement = enhancements[winner.provider as ProviderType];
      const finalChoiceData = {
        ...winner,
        currency,
        enhancedQuote: selectedEnhancement || undefined
      }
      setFinalChoice(finalChoiceData)

      completePhase('complete')

      // Start complete phase with auto-scroll
      startPhase('complete')

    } catch (error) {
      console.error("Reconciliation failed", error);
    }
  }

  // Acid Test Handler
  const handleStartAcidTest = () => {
    // Pre-validation
    if (!finalChoice || !providerData.length) {
      setAcidTestError('Cannot start acid test: Missing provider data');
      return;
    }

    // Batch all initial state updates to prevent flickering
    startTransition(() => {
      // Reset any previous state and show the form
      setAcidTestError(null);
      setAcidTestResults(null);
      setAcidTestCostData(null);
      setIsCategorizingCosts(true);
      setIsComputingAcidTest(false);
      setAcidTestValidation({});
      setShowAcidTestForm(true);

      const configuredDuration = Number((quoteData?.formData as EORFormData)?.contractDuration) || 6;
      setProjectDuration(configuredDuration);
    });

    void extractSelectedQuoteData(finalChoice)
      .then(result => {
        if (!result) {
          startTransition(() => {
            setAcidTestError('Unable to categorize cost items for the acid test.');
            setAcidTestCostData(null);
          });
          return;
        }

        const { aggregates, categories } = result;

        // Calculate default bill rate from actual categorized components
        const recurringMonthly = aggregates.baseSalaryMonthly + aggregates.statutoryMonthly +
                                 aggregates.allowancesMonthly +
                                 (isAllInclusiveQuote ? aggregates.terminationMonthly : 0);
        const defaultBillRate = recurringMonthly * (1 + GRACEMARK_FEE_PERCENTAGE);

        // Batch state updates after async operation completes
        startTransition(() => {
          setAcidTestCostData({
            provider: finalChoice.provider,
            currency: finalChoice.currency,
            categories,
            ...aggregates,
          });
          setMonthlyBillRate(Number(defaultBillRate.toFixed(2)));
        });
      })
      .catch(err => {
        console.error('Failed to categorize cost items with Cerebras:', err);
        startTransition(() => {
          setAcidTestError('Unable to categorize cost items. Please try again later.');
          setAcidTestCostData(null);
        });
      })
      .finally(() => {
        startTransition(() => {
          setIsCategorizingCosts(false);
        });
      })
  };

  // Handle form input changes and update calculations
  const handleBillRateChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    setMonthlyBillRate(rate);

    // Validation
    const validation = { ...acidTestValidation };
    if (value === '' || rate <= 0) {
      validation.billRateError = 'Monthly bill rate must be greater than 0';
    } else if (rate > 1000000) {
      validation.billRateError = 'Monthly bill rate seems unusually high';
    } else {
      delete validation.billRateError;
    }
    setAcidTestValidation(validation);
    if (rate <= 0) {
      setAcidTestResults(null);
    }
  };

  const handleDurationChange = (value: string) => {
    const duration = parseInt(value) || 0;
    setProjectDuration(duration);

    // Validation
    const validation = { ...acidTestValidation };
    if (value === '' || duration <= 0) {
      validation.durationError = 'Project duration must be at least 1 month';
    } else if (duration > 120) {
      validation.durationError = 'Project duration seems unusually long (max 120 months)';
    } else {
      delete validation.durationError;
    }
    setAcidTestValidation(validation);
    if (duration <= 0) {
      setAcidTestResults(null);
    }
  };

  const handleCloseAcidTest = () => {
    setShowAcidTestForm(false);
    setAcidTestResults(null);
    setAcidTestCostData(null);
    setMonthlyBillRate(0);
    setProjectDuration(6);
    setAcidTestError(null);
    setAcidTestValidation({});
    setIsCategorizingCosts(false);
    setIsComputingAcidTest(false);
    setExpandedCategories(new Set());
    setIsExportingPdf(false);
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // --- RENDER LOGIC (UNCHANGED) ---
  const renderQuote = () => {
    if (providerLoading[currentProvider]) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
            {/* <p className="text-slate-600">Loading {currentProvider === 'deel' ? 'Deel' : currentProvider === 'remote' ? 'Remote' : currentProvider === 'rivermate' ? 'Rivermate' : currentProvider === 'oyster' ? 'Oyster' : currentProvider === 'rippling' ? 'Rippling' : currentProvider === 'skuad' ? 'Skuad' : 'Velocity Global'} quote...</p> */}
          </div>
        </div>
      );
    }

    const quote = currentProvider === 'deel'
      ? (quoteData.quotes.deel ? { ...quoteData.quotes.deel, provider: 'deel' } : quoteData.quotes.deel)
      : currentProvider === 'remote'
        ? (quoteData.quotes.remote 
            ? (('employment' in (quoteData.quotes.remote as any)) 
                ? transformRemoteResponseToQuote(quoteData.quotes.remote as any)
                : undefined)
            : undefined)
        : currentProvider === 'rivermate' ? (
            quoteData.quotes.rivermate && ('taxItems' in (quoteData.quotes.rivermate as any))
              ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any)
              : (quoteData.quotes.rivermate as any)
          ) : currentProvider === 'oyster' ? (
            quoteData.quotes.oyster && ('contributions' in (quoteData.quotes.oyster as any))
              ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any)
              : (quoteData.quotes.oyster as any)
          ) : currentProvider === 'rippling' ? (
            quoteData.quotes.rippling ? { ...quoteData.quotes.rippling, provider: 'rippling' } : quoteData.quotes.rippling
          ) : currentProvider === 'skuad' ? (
            (quoteData.quotes as any).skuad ? { ...(quoteData.quotes as any).skuad, provider: 'skuad' } : (quoteData.quotes as any).skuad
          ) : currentProvider === 'velocity' ? (
            (quoteData.quotes as any).velocity ? { ...(quoteData.quotes as any).velocity, provider: 'velocity' } : (quoteData.quotes as any).velocity
          ) : currentProvider === 'playroll' ? (
            (quoteData.quotes as any).playroll ? { ...(quoteData.quotes as any).playroll, provider: 'playroll' } : (quoteData.quotes as any).playroll
          ) : (
            (quoteData.quotes as any).omnipresent ? { ...(quoteData.quotes as any).omnipresent, provider: 'omnipresent' } : (quoteData.quotes as any).omnipresent
          );

    if (process.env.NODE_ENV === 'development') {
      // console.log(`[Quote Debug] Provider: ${currentProvider}`, {
      //   rawQuoteData: currentProvider === 'deel' ? quoteData.quotes.deel : 'N/A',
      //   processedQuote: quote,
      //   quoteKeys: quote ? Object.keys(quote) : 'null/undefined',
      //   isEmpty: quote && typeof quote === 'object' && Object.keys(quote).length === 0
      // })
    }

    const dualCurrencyQuotes = currentProvider === 'deel'
      ? quoteData.dualCurrencyQuotes?.deel
      : currentProvider === 'remote'
        ? quoteData.dualCurrencyQuotes?.remote
        : currentProvider === 'rivermate'
          ? quoteData.dualCurrencyQuotes?.rivermate
          : currentProvider === 'oyster' 
            ? quoteData.dualCurrencyQuotes?.oyster 
            : currentProvider === 'rippling'
              ? quoteData.dualCurrencyQuotes?.rippling
              : currentProvider === 'skuad'
                ? (quoteData.dualCurrencyQuotes as any)?.skuad
                : currentProvider === 'velocity'
                  ? (quoteData.dualCurrencyQuotes as any)?.velocity
                  : currentProvider === 'playroll'
                    ? (quoteData.dualCurrencyQuotes as any)?.playroll
                    : (quoteData.dualCurrencyQuotes as any)?.omnipresent;
    const isConvertingToUSD = currentProvider === 'deel'
      ? isConvertingDeelToUsd
      : currentProvider === 'remote'
        ? isConvertingRemoteToUsd
        : currentProvider === 'rivermate'
          ? isConvertingRivermateToUsd
          : currentProvider === 'oyster' 
            ? isConvertingOysterToUsd 
            : currentProvider === 'rippling' 
              ? isConvertingRipplingToUsd 
              : currentProvider === 'skuad' 
                ? isConvertingSkuadToUsd 
                : currentProvider === 'velocity'
                  ? isConvertingVelocityToUsd
                  : currentProvider === 'playroll'
                    ? isConvertingPlayrollToUsd
                    : isConvertingOmnipresentToUsd;
    const conversions = currentProvider === 'deel'
      ? usdConversions.deel
      : currentProvider === 'remote'
        ? usdConversions.remote
        : currentProvider === 'rivermate'
          ? usdConversions.rivermate
          : currentProvider === 'oyster' 
            ? usdConversions.oyster 
            : currentProvider === 'rippling'
              ? (usdConversions as any).rippling
              : currentProvider === 'skuad'
                ? (usdConversions as any).skuad
                : currentProvider === 'velocity'
                  ? (usdConversions as any).velocity
                  : currentProvider === 'playroll'
                    ? (usdConversions as any).playroll
                    : (usdConversions as any).omnipresent;
    const eorForm = quoteData.formData as EORFormData;

    if (!quote && !dualCurrencyQuotes) return null;

    // Merge LLM full-quote items into base quote for a single, unified card
    let mergedQuote: any = quote
    let extendedConversions = conversions
    try {
      const enh = (enhancements as any)?.[currentProvider as string]
      const fq = enh?.fullQuote
      if (quote && fq && typeof fq.total_monthly === 'number' && Array.isArray(fq.items)) {
        const cloned = { ...(quote as any) }
        const existingCosts = Array.isArray(cloned.costs) ? [...cloned.costs] : []
        const toAmountStr = (n: number) => {
          const v = Number(n)
          return Number.isFinite(v) ? v.toFixed(2) : '0'
        }

        // Calculate exchange rate from existing conversions for new items
        let exchangeRate: number | null = null
        if (conversions?.costs && Array.isArray(conversions.costs) && existingCosts.length > 0) {
          // Find a non-zero base item to calculate exchange rate
          for (let i = 0; i < Math.min(existingCosts.length, conversions.costs.length); i++) {
            const localAmount = Number.parseFloat(existingCosts[i].amount)
            const usdAmount = conversions.costs[i]
            if (localAmount > 0 && usdAmount > 0) {
              exchangeRate = usdAmount / localAmount
              break
            }
          }
        }

        // Append extras as cost rows and calculate their USD conversions
        const newUsdConversions: number[] = []
        fq.items.forEach((it: any) => {
          const amt = Number(it?.monthly_amount) || 0
          if (amt <= 0) return
          existingCosts.push({
            name: String(it?.name || it?.key || 'Additional Benefit'),
            amount: toAmountStr(amt),
            frequency: 'monthly',
            country: cloned.country,
            country_code: cloned.country_code,
          })
          
          // Calculate USD conversion for this new item
          if (exchangeRate !== null) {
            newUsdConversions.push(amt * exchangeRate)
          } else {
            newUsdConversions.push(0) // Fallback to 0 if no exchange rate available
          }
        })

        // Extend USD conversions array with new item conversions
        if (conversions?.costs && newUsdConversions.length > 0) {
          extendedConversions = {
            ...conversions,
            costs: [...conversions.costs, ...newUsdConversions]
          }
        }

        cloned.costs = existingCosts
        // Compute non-decreasing merged total using base displayed total vs LLM total
        const parseNum = (v?: string | number) => {
          if (typeof v === 'number') return v
          const n = Number.parseFloat((v || '0') as string)
          return Number.isFinite(n) ? n : 0
        }
        const baseTotal = (() => {
          const t = parseNum((quote as any)?.total_costs)
          if (currentProvider === 'deel') {
            const fee = parseNum((quote as any)?.deel_fee)
            const accr = parseNum((quote as any)?.severance_accural)
            return Math.max(0, t - fee - accr)
          }
          return t
        })()
        const llmTotal = Number(fq.total_monthly) || 0
        const mergedTotal = Math.max(baseTotal, llmTotal)
        const totalStr = toAmountStr(mergedTotal)
        cloned.total_costs = totalStr
        cloned.employer_costs = totalStr
        if (currentProvider === 'deel') {
          cloned.deel_fee = '0'
          cloned.severance_accural = '0'
        }
        mergedQuote = cloned
      }
    } catch { /* noop */ }

    const totalInfo = providerTotals[currentProvider as ProviderType]
    const mergedTotalValue = totalInfo?.ready && typeof totalInfo.amount === 'number' ? totalInfo.amount : undefined
    const mergedTotalCurrency = totalInfo?.currency || quote?.currency
    const isTotalPending = !totalInfo?.ready

    const isEnhPending = (!((enhancements as any)?.[currentProvider as string])) && (providerStates[currentProvider]?.status === 'loading-enhanced')

    // Build additional extras (deduped) from deterministic/LLM enhancements
    const extras: Array<{ name: string; amount: number; guards?: string[]; replaceBaseGuards?: string[] }> = []
    const formDataForLocalOffice = quoteData?.formData as EORFormData | undefined
    try {
      const enh = (enhancements as any)?.[currentProvider as string]
      const costs = Array.isArray(mergedQuote?.costs) ? mergedQuote.costs : []
      const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const hasLocalOfficeItemLike = buildLocalOfficeDuplicateChecker(formDataForLocalOffice?.localOfficeInfo, norm)
      const hasItemLike = (needle: string) => costs.some((c: any) => norm(c?.name).includes(norm(needle)))
      const addExtra = (
        name: string,
        amount: number,
        guardNames: string[] = [],
        options?: { skipLocalOfficeCheck?: boolean; preferLocalOffice?: boolean }
      ) => {
        const amt = parseNumericValue(amount)
        if (amt === null || !Number.isFinite(amt) || amt <= 0) return
        const guardList = Array.isArray(guardNames) ? guardNames : []
        const duplicateFromBase = !options?.preferLocalOffice && guardList.some(g => hasItemLike(g))
        const duplicateFromLocalOffice = options?.skipLocalOfficeCheck
          ? false
          : hasLocalOfficeItemLike(name) || guardList.some(g => hasLocalOfficeItemLike(g))
        if (duplicateFromBase || duplicateFromLocalOffice) return

        extras.push({
          name,
          amount: amt,
          guards: guardList,
          replaceBaseGuards: options?.preferLocalOffice ? guardList : undefined
        })
      }

      if (enh && enh.enhancements) {
        // Termination (monthlyized)
        const terminationComponentExtras: Array<{ label: string; amount: number; guards: string[] }> = []

        const pushTerminationComponent = (
          label: string,
          value: TerminationComponentEnhancement | undefined,
          guards: string[]
        ) => {
          if (!value || value.isAlreadyIncluded) return
          const monthly = Number(value.monthlyAmount || 0)
          if (!Number.isFinite(monthly) || monthly <= 0) return
          terminationComponentExtras.push({ label, amount: monthly, guards })
        }

        pushTerminationComponent('Severance Cost', enh.enhancements.severanceProvision, ['severance cost', 'severance provision'])
        pushTerminationComponent('Notice Period Cost', enh.enhancements.noticePeriodCost, ['notice period', 'probation provision'])

        if (terminationComponentExtras.length > 0) {
          terminationComponentExtras.forEach(entry => addExtra(entry.label, entry.amount, entry.guards))
        }
        // 13th salary
        const th13 = enh.enhancements.thirteenthSalary
        if (th13 && th13.isAlreadyIncluded !== true) {
          const m = parseNumericValue(th13.monthlyAmount) ?? (() => {
            const yearly = parseNumericValue(th13.yearlyAmount)
            return yearly !== null ? yearly / 12 : null
          })()
          if (m !== null) addExtra('13th Salary', m, ['13th', 'thirteenth'])
        }
        // 14th salary
        const th14 = enh.enhancements.fourteenthSalary
        if (th14 && th14.isAlreadyIncluded !== true) {
          const m = parseNumericValue(th14.monthlyAmount) ?? (() => {
            const yearly = parseNumericValue(th14.yearlyAmount)
            return yearly !== null ? yearly / 12 : null
          })()
          if (m !== null) addExtra('14th Salary', m, ['14th', 'fourteenth'])
        }
        // Allowances
        const ta = enh.enhancements.transportationAllowance
        if (ta && ta.isAlreadyIncluded !== true) addExtra('Transportation Allowance', Number(ta.monthlyAmount || 0), ['transportation'])
        const rwa = enh.enhancements.remoteWorkAllowance
        if (rwa && rwa.isAlreadyIncluded !== true) addExtra('Remote Work Allowance', Number(rwa.monthlyAmount || 0), ['remote work', 'wfh'])
        const mv = enh.enhancements.mealVouchers
        if (mv && mv.isAlreadyIncluded !== true) addExtra('Meal Vouchers', Number(mv.monthlyAmount || 0), ['meal voucher'])

        // Additional contributions and local office
        const addc = enh.enhancements.additionalContributions || {}
        const localExtras: Array<{ name: string; amount: number; guards?: string[] }> = []

        Object.entries(addc).forEach(([k, v]) => {
          const n = Number(v)
          if (!isFinite(n) || n <= 0) return
          const key = String(k || '').toLowerCase()

          if (key.includes('employer') && key.includes('contribution')) return
          // Local office and other non-contribution extras
          const label = key.includes('local_meal_voucher') ? 'Meal Voucher (Local Office)'
            : key.includes('local_transportation') ? 'Transportation (Local Office)'
            : key.includes('local_wfh') ? 'WFH (Local Office)'
            : key.includes('local_health_insurance') ? 'Health Insurance (Local Office)'
            : key.includes('local_office_monthly_payments') ? 'Local Office Monthly Payments'
            : key.includes('local_office_vat') ? 'VAT on Local Office Payments'
            : String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          const guards =
            key.includes('local_meal_voucher') ? ['meal voucher', 'meal']
              : key.includes('local_transportation') ? ['transportation']
              : key.includes('local_wfh') ? ['wfh', 'remote work', 'work from home']
              : key.includes('local_health_insurance') ? ['health insurance']
              : key.includes('local_office_monthly_payments') ? ['local office monthly payments']
              : key.includes('local_office_vat') ? ['vat']
              : []
          localExtras.push({ name: label, amount: n, guards })
        })

        localExtras.forEach(le =>
          addExtra(le.name, le.amount, le.guards || [], { skipLocalOfficeCheck: true, preferLocalOffice: true })
        )
      }
    } catch { /* noop */ }

    // Do not inject extras here to avoid double-counting.
    // Extras are passed to GenericQuoteCard via mergedExtras for inline injection.

    const contractTypeForExtras = formDataForLocalOffice?.contractType
    const filteredExtras = filterAllowancesByContractType(extras, contractTypeForExtras)

    const isDualMode = Boolean(dualCurrencyQuotes?.isDualCurrencyMode)
    const mergedForSingle = !isDualMode
      ? mergeExtrasIntoQuote(mergedQuote, filteredExtras, extendedConversions)
      : { quote: mergedQuote, usdConversions: extendedConversions }

    const quoteForCard = mergedForSingle.quote
    const usdForCard = mergedForSingle.usdConversions
    const extrasForCard = isDualMode ? filteredExtras : []
    const resolvedTotalValue = !isDualMode && quoteForCard
      ? (() => {
        const parsed = parseFloat(String((quoteForCard as Quote).total_costs ?? 0))
        return Number.isFinite(parsed) ? parsed : mergedTotalValue
      })()
      : mergedTotalValue

    return (
      <div className="space-y-6">
        <GenericQuoteCard
          quote={isDualMode ? undefined : quoteForCard}
          title={`${quote?.country || eorForm.country}`}
          provider={currentProvider}
          usdConversions={usdForCard}
          isConvertingToUSD={isConvertingToUSD}
          usdConversionError={usdConversionError}
          dualCurrencyQuotes={dualCurrencyQuotes}
          originalCurrency={eorForm.originalCurrency || undefined}
          selectedCurrency={eorForm.currency}
          recalcBaseItems={(enhancements as any)?.[currentProvider as string]?.recalcBaseItems || []}
          mergedExtras={extrasForCard}
          mergedTotalMonthly={resolvedTotalValue}
          mergedCurrency={mergedTotalCurrency}
          isTotalPending={isTotalPending}
          enhancementPending={isEnhPending}
          shimmerExtrasCount={3}
        />

        {/* Merged into base card; hide separate enhanced card */}
      </div>
    );
  };

  const renderComparison = () => {
    const eorForm = quoteData.formData as EORFormData;
    if (providerLoading[currentProvider] || !eorForm.enableComparison) return null;

    if (currentProvider === 'deel') {
      const comparisonReady = quoteData ? isComparisonReady('deel', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('deel', quoteData) : false;
      const isLoadingComparison = providerLoading.deel ||
        (eorForm.enableComparison && (!quoteData.quotes.deel || !quoteData.quotes.comparisonDeel));

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="deel"
            primaryQuote={quoteData.quotes.deel}
            comparisonQuote={quoteData.quotes.comparisonDeel}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingDeelToUsd}
            isConvertingComparisonToUSD={isConvertingCompareToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.deel}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'rivermate') {
      const comparisonReady = quoteData ? isComparisonReady('rivermate', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('rivermate', quoteData) : false;
      const isLoadingComparison = providerLoading.rivermate ||
        (eorForm.enableComparison && (!quoteData.quotes.rivermate || !quoteData.quotes.comparisonRivermate));

      const primaryIsOptimized = quoteData.quotes.rivermate && 'taxItems' in (quoteData.quotes.rivermate as any);
      const compareIsOptimized = quoteData.quotes.comparisonRivermate && 'taxItems' in (quoteData.quotes.comparisonRivermate as any);

      const primaryDisplay = primaryIsOptimized ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.rivermate as any) : (quoteData.quotes.rivermate as any);
      const compareDisplay = compareIsOptimized ? transformRivermateQuoteToDisplayQuote(quoteData.quotes.comparisonRivermate as any) : (quoteData.quotes.comparisonRivermate as any);

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="rivermate"
            primaryQuote={primaryDisplay}
            comparisonQuote={compareDisplay}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={{ deel: usdConversions.rivermate, compare: usdConversions.compareRivermate }}
            isConvertingPrimaryToUSD={isConvertingRivermateToUsd}
            isConvertingComparisonToUSD={isConvertingCompareRivermateToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.rivermate}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'oyster') {
      const comparisonReady = quoteData ? isComparisonReady('oyster', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('oyster', quoteData) : false;
      const isLoadingComparison = providerLoading.oyster ||
        (eorForm.enableComparison && (!quoteData.quotes.oyster || !quoteData.quotes.comparisonOyster));

      const oysterPrimaryDisplay = quoteData.quotes.oyster && ('contributions' in (quoteData.quotes.oyster as any)) ? transformOysterQuoteToDisplayQuote(quoteData.quotes.oyster as any) : (quoteData.quotes.oyster as any);
      const oysterCompareDisplay = quoteData.quotes.comparisonOyster && ('contributions' in (quoteData.quotes.comparisonOyster as any)) ? transformOysterQuoteToDisplayQuote(quoteData.quotes.comparisonOyster as any) : (quoteData.quotes.comparisonOyster as any);

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="oyster"
            primaryQuote={oysterPrimaryDisplay}
            comparisonQuote={oysterCompareDisplay}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={{ deel: usdConversions.oyster, compare: usdConversions.compareOyster }}
            isConvertingPrimaryToUSD={isConvertingOysterToUsd}
            isConvertingComparisonToUSD={isConvertingCompareOysterToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.oyster}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'remote') {
      const comparisonReady = quoteData ? isComparisonReady('remote', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('remote', quoteData) : false;
      const providerDual = quoteData.dualCurrencyQuotes?.remote;
      const hasDualCompare = providerDual?.isDualCurrencyMode && providerDual?.hasComparison;
      const primaryRemoteResponse = quoteData.quotes.remote as RemoteAPIResponse | undefined;
      const comparisonRemoteResponse = quoteData.quotes.comparisonRemote as RemoteAPIResponse | undefined;
      const primaryRemoteQuote = primaryRemoteResponse ? transformRemoteResponseToQuote(primaryRemoteResponse) : undefined;
      const comparisonRemoteQuote = comparisonRemoteResponse ? transformRemoteResponseToQuote(comparisonRemoteResponse) : undefined;
      const isLoadingComparison = providerLoading.remote;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="remote"
            primaryQuote={hasDualCompare ? undefined : primaryRemoteQuote}
            comparisonQuote={hasDualCompare ? undefined : comparisonRemoteQuote}
            primaryTitle={(quoteData.formData as EORFormData).country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingRemoteToUsd}
            isConvertingComparisonToUSD={isConvertingCompareRemoteToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={quoteData.dualCurrencyQuotes?.remote}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'rippling') {
      const comparisonReady = quoteData ? isComparisonReady('rippling', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('rippling', quoteData) : false;
      const primaryRippling = quoteData.quotes.rippling as Quote | undefined;
      const comparisonRippling = (quoteData.quotes as any).comparisonRippling as Quote | undefined;
      const isLoadingComparison = providerLoading.rippling;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="rippling"
            primaryQuote={primaryRippling as any}
            comparisonQuote={comparisonRippling as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingRipplingToUsd}
            isConvertingComparisonToUSD={isConvertingCompareRipplingToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.rippling}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'skuad') {
      const comparisonReady = quoteData ? isComparisonReady('skuad', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('skuad', quoteData) : false;
      const primarySkuad = (quoteData.quotes as any).skuad as Quote | undefined;
      const comparisonSkuad = (quoteData.quotes as any).comparisonSkuad as Quote | undefined;
      const isLoadingComparison = providerLoading.skuad;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="skuad"
            primaryQuote={primarySkuad as any}
            comparisonQuote={comparisonSkuad as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingSkuadToUsd}
            isConvertingComparisonToUSD={isConvertingCompareSkuadToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.skuad}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'velocity') {
      const comparisonReady = quoteData ? isComparisonReady('velocity', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('velocity', quoteData) : false;
      const primaryVelocity = (quoteData.quotes as any).velocity as Quote | undefined;
      const comparisonVelocity = (quoteData.quotes as any).comparisonVelocity as Quote | undefined;
      const isLoadingComparison = providerLoading.velocity;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="velocity"
            primaryQuote={primaryVelocity as any}
            comparisonQuote={comparisonVelocity as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingVelocityToUsd}
            isConvertingComparisonToUSD={isConvertingCompareVelocityToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.velocity}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'playroll') {
      const comparisonReady = quoteData ? isComparisonReady('playroll', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('playroll', quoteData) : false;
      const primaryPlayroll = (quoteData.quotes as any).playroll as Quote | undefined;
      const comparisonPlayroll = (quoteData.quotes as any).comparisonPlayroll as Quote | undefined;
      const isLoadingComparison = providerLoading.playroll;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="playroll"
            primaryQuote={primaryPlayroll as any}
            comparisonQuote={comparisonPlayroll as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingPlayrollToUsd}
            isConvertingComparisonToUSD={isConvertingComparePlayrollToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.playroll}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    if (currentProvider === 'omnipresent') {
      const comparisonReady = quoteData ? isComparisonReady('omnipresent', quoteData) : false;
      const dualCurrencyReady = quoteData ? isDualCurrencyComparisonReady('omnipresent', quoteData) : false;
      const primaryOmnipresent = (quoteData.quotes as any).omnipresent as Quote | undefined;
      const comparisonOmnipresent = (quoteData.quotes as any).comparisonOmnipresent as Quote | undefined;
      const isLoadingComparison = providerLoading.omnipresent;

      return (
        <div className="space-y-6">
          <QuoteComparison
            provider="omnipresent"
            primaryQuote={primaryOmnipresent as any}
            comparisonQuote={comparisonOmnipresent as any}
            primaryTitle={eorForm.country}
            comparisonTitle={eorForm.compareCountry}
            usdConversions={usdConversions}
            isConvertingPrimaryToUSD={isConvertingOmnipresentToUsd}
            isConvertingComparisonToUSD={isConvertingCompareOmnipresentToUsd}
            usdConversionError={usdConversionError}
            dualCurrencyQuotes={(quoteData.dualCurrencyQuotes as any)?.omnipresent}
            isComparisonReady={comparisonReady}
            isDualCurrencyReady={dualCurrencyReady}
            isLoadingComparison={isLoadingComparison}
          />
        </div>
      );
    }

    return null;
  };

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Fixed Action: Start Reconciliation */}
      <div className="fixed top-5 right-5 z-50">
        <Button
          onClick={startReconciliation}
          disabled={!reconStatus.ready}
          className="bg-yellow-400 text-black hover:bg-yellow-500 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200"
        >
          {renderReconciliationButtonContent()}
        </Button>
      </div>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Your EOR Quote
              </h1>
            </div>
          </div>

          <div className="mb-10 -mx-4 sm:-mx-6 lg:-mx-10">
            <ProviderSelector
              currentProvider={currentProvider}
              onProviderChange={switchProvider}
              disabled={loading || quoteData?.status !== 'completed'}
              providerStates={providerStates}
            />
          </div>

          {(() => {
            const eorForm = quoteData.formData as EORFormData;
            if (eorForm.enableComparison) {
              return (
                <div className="max-w-7xl mx-auto">
                  {renderComparison()}
                </div>
              );
            } else {
              return (
                <div className="max-w-4xl mx-auto">
                  {renderQuote()}
                </div>
              );
            }
          })()}

        </div>
      </div>

      {/* --- DASHBOARD-STYLE RECONCILIATION MODAL --- */}
      {isReconModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="absolute inset-0" onClick={() => setIsReconModalOpen(false)} />
          <Card className="relative w-screen h-screen border-0 shadow-none bg-white overflow-hidden rounded-none">
            
            {/* Top Banner: Progress Bar + Phase */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-900 shadow-sm">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Provider Reconciliation Dashboard
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {activePhase === 'gathering' && 'Collecting provider data...'}
                      {activePhase === 'analyzing' && 'Analyzing price variance...'}
                      {activePhase === 'selecting' && 'Selecting optimal provider...'}
                      {activePhase === 'complete' && 'Analysis complete - Provider recommended'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-700">{progressPercent}%</div>
                    <div className="text-xs text-slate-500">Complete</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsReconModalOpen(false)} className="ml-4 rounded-none">
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Close
                  </Button>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4 bg-slate-200 h-2.5 overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Main Timeline Area */}
            <div className="flex-1 overflow-y-auto">
              {renderTimelinePhases()}
            </div>
          </Card>
        </div>
      )}

      {/* Enhanced CSS animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }

        .stagger-children > * {
          opacity: 0;
          animation: fadeInUp 0.4s ease-out forwards;
        }

        .stagger-children > *:nth-child(1) { animation-delay: 0ms; }
        .stagger-children > *:nth-child(2) { animation-delay: 50ms; }
        .stagger-children > *:nth-child(3) { animation-delay: 100ms; }
        .stagger-children > *:nth-child(4) { animation-delay: 150ms; }
        .stagger-children > *:nth-child(5) { animation-delay: 200ms; }
        .stagger-children > *:nth-child(6) { animation-delay: 250ms; }
        .stagger-children > *:nth-child(7) { animation-delay: 300ms; }
        .stagger-children > *:nth-child(n+8) { animation-delay: 350ms; }
      `}</style>
    </div>
  )
});

QuotePageContent.displayName = 'QuotePageContent';

export default function QuotePage() {
  return (
    <ErrorBoundary
      fallbackTitle="Quote Loading Error"
      fallbackMessage="There was a problem loading your quote. This might be due to corrupted data or a temporary issue."
      onError={() => {
        // console.error('Quote page error:', error, errorInfo)
      }}
    >
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
          <div className="container mx-auto px-6 py-8 max-w-7xl">
            <div className="text-center space-y-6 flex flex-col items-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Loading Quote...
              </h1>
              <LoadingSpinner />
            </div>
          </div>
        </div>
      }>
        <EnhancementProvider>
          <QuotePageContent />
        </EnhancementProvider>
      </Suspense>
    </ErrorBoundary>
  )
}
