import { convertCurrency } from "@/lib/currency-converter"
import { getCountryByName, getCurrencyForCountry } from "@/lib/country-data"
import { LocalOfficeInfo, Quote } from "@/lib/shared/types"
import {
  getDefaultLocalOfficeInfo,
  getFieldCurrency,
  getLocalOfficeData,
  hasLocalOfficeData
} from "@/lib/shared/utils/localOfficeData"

const sanitizeAmount = (value?: string | null): number => {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A' || trimmed.toLowerCase() === 'no') return 0
  const normalized = trimmed.replace(/[^0-9,.-]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const resolveCountryCode = (countryName?: string | null): string | null => {
  if (!countryName) return null
  const byName = getCountryByName(countryName)
  if (byName?.code) return byName.code
  const direct = countryName.trim().toUpperCase()
  if (direct.length === 2) return direct
  return null
}

const FIELD_LABELS: Record<keyof LocalOfficeInfo, { label: string; frequency: 'monthly' | 'one_time' }> = {
  mealVoucher: { label: 'Meal Voucher (Local Office)', frequency: 'monthly' },
  transportation: { label: 'Transportation (Local Office)', frequency: 'monthly' },
  wfh: { label: 'Remote Work Allowance (Local Office)', frequency: 'monthly' },
  healthInsurance: { label: 'Health Insurance (Local Office)', frequency: 'monthly' },
  monthlyPaymentsToLocalOffice: { label: 'Local Office Monthly Payments', frequency: 'monthly' },
  vat: { label: 'VAT (Local Office)', frequency: 'monthly' },
  preEmploymentMedicalTest: { label: 'Pre-employment Medical Test (Local Office)', frequency: 'one_time' },
  drugTest: { label: 'Drug Test (Local Office)', frequency: 'one_time' },
  backgroundCheckViaDeel: { label: 'Background Check (Local Office)', frequency: 'one_time' }
}

const shouldIncludeField = (field: keyof LocalOfficeInfo, amount: number): boolean => {
  if (field === 'vat') return false
  if (!Number.isFinite(amount) || amount <= 0) return false
  return true
}

export interface LocalOfficeEnrichmentOptions {
  countryName?: string | null
  currency: string
  localOfficeInfo?: LocalOfficeInfo | null
}

export const enrichQuoteWithLocalOffice = async (
  quote: Quote | null | undefined,
  options: LocalOfficeEnrichmentOptions
): Promise<Quote | null> => {
  if (!quote) return quote ?? null

  const countryCode = resolveCountryCode(options.countryName) || resolveCountryCode(quote.country) || null
  if (!countryCode || !hasLocalOfficeData(countryCode)) {
    return quote
  }

  const userProvidedInfo = options.localOfficeInfo && Object.keys(options.localOfficeInfo).length > 0
  const baseInfo = (userProvidedInfo ? options.localOfficeInfo : getLocalOfficeData(countryCode)) || getDefaultLocalOfficeInfo()
  const baseLocalCurrency = (() => {
    try {
      return getCurrencyForCountry(countryCode)
    } catch {
      return null
    }
  })()

  const extras: { name: string; amount: number; frequency: 'monthly' | 'one_time' }[] = []

  for (const fieldKey of Object.keys(baseInfo) as (keyof LocalOfficeInfo)[]) {
    const meta = FIELD_LABELS[fieldKey]
    if (!meta) continue

    const rawAmount = sanitizeAmount(baseInfo[fieldKey])
    if (rawAmount <= 0) continue

    let resolvedAmount = rawAmount
    const fieldCurrency = getFieldCurrency(fieldKey, countryCode)

    if (!userProvidedInfo) {
      const needsConversion =
        (fieldCurrency === 'usd' && options.currency.toUpperCase() !== 'USD') ||
        (fieldCurrency === 'local' &&
          baseLocalCurrency &&
          baseLocalCurrency.toUpperCase() !== options.currency.toUpperCase())

      if (needsConversion) {
        const sourceCurrency = fieldCurrency === 'usd' ? 'USD' : baseLocalCurrency
        if (sourceCurrency) {
          const conversion = await convertCurrency(rawAmount, sourceCurrency, options.currency)
          if (!conversion.success || !conversion.data) continue
          resolvedAmount = Number(conversion.data.target_amount)
        }
      }
    }

    if (!shouldIncludeField(fieldKey, resolvedAmount)) continue

    extras.push({
      name: meta.label,
      amount: Number(resolvedAmount.toFixed(2)),
      frequency: meta.frequency
    })
  }

  if (extras.length === 0) return quote

  const existingCosts = Array.isArray(quote.costs) ? [...quote.costs] : []
  const appliedExtras: { name: string; amount: number; frequency: 'monthly' | 'one_time' }[] = []

  extras.forEach(extra => {
    const duplicate = existingCosts.some(cost => cost && cost.name === extra.name)
    if (duplicate) return
    appliedExtras.push(extra)
    existingCosts.push({
      name: extra.name,
      amount: extra.amount.toFixed(2),
      frequency: extra.frequency === 'one_time' ? 'one_time' : 'monthly',
      country: quote.country,
      country_code: quote.country_code
    })
  })

  if (appliedExtras.length === 0) {
    return {
      ...quote,
      costs: existingCosts
    }
  }

  const totalIncrement = appliedExtras.reduce((sum, item) => sum + (item.frequency === 'monthly' ? item.amount : item.amount / 12), 0)

  if (totalIncrement <= 0) {
    return {
      ...quote,
      costs: existingCosts
    }
  }
  const currentTotal = sanitizeAmount(quote.total_costs)
  const currentEmployer = sanitizeAmount(quote.employer_costs)
  const nextTotal = Number((currentTotal + totalIncrement).toFixed(2))
  const nextEmployer = Number((currentEmployer + totalIncrement).toFixed(2))

  return {
    ...quote,
    costs: existingCosts,
    total_costs: nextTotal.toFixed(2),
    employer_costs: nextEmployer.toFixed(2)
  }
}
