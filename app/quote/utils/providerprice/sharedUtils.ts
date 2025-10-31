import { EnhancedQuote, ProviderType, TerminationComponentEnhancement, BonusEnhancement, SalaryEnhancement, AllowanceEnhancement } from "@/lib/types/enhancement"

export const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    // Remove currency symbols and whitespace characters
    let cleaned = trimmed.replace(/[\s$€£¥₱₹₩₦₭₮₰₲₳₴₵₺₽₡₢₣₤₥₧₨₫฿₠₣]+/g, '')

    const hasComma = cleaned.includes(',')
    const hasDot = cleaned.includes('.')

    if (hasComma && hasDot) {
      // Assume the character appearing later is the decimal separator
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // Comma is decimal separator -> remove thousands dots, flip comma to dot
        cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.')
      } else {
        // Dot is decimal separator -> remove thousands commas
        cleaned = cleaned.replace(/,/g, '')
      }
    } else if (hasComma && !hasDot) {
      // Only commas present -> treat as decimal separator
      cleaned = cleaned.replace(/,/g, '.')
    }

    // Remove any characters that are not part of a number
    cleaned = cleaned.replace(/[^0-9eE+\-\.]/g, '')

    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const pickPositive = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = parseNumericValue(value)
    if (parsed !== null && parsed > 0) {
      return parsed
    }
  }
  return null
}

export const baseQuoteContainsPattern = (enhancement: EnhancedQuote | undefined, pattern: RegExp): boolean => {
  const original = enhancement?.baseQuote?.originalResponse as Record<string, unknown> | undefined
  if (!original) return false

  const names: string[] = []

  function addName(value: string | undefined | null) {
    if (!value) return
    const trimmed = value.trim()
    if (!trimmed) return
    names.push(trimmed)
    const normalized = trimmed.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (normalized && normalized !== trimmed) {
      names.push(normalized)
    }
  }

  function scanObject(obj: Record<string, unknown>) {
    Object.entries(obj).forEach(([key, val]) => {
      addName(key)
      if (typeof val === 'string') {
        addName(val)
      } else {
        scanValue(val)
      }
    })
  }

  function scanValue(value: unknown): void {
    if (!value) return
    if (typeof value === 'string') {
      addName(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(entry => {
        if (entry == null) return
        if (typeof entry === 'string') {
          addName(entry)
          return
        }
        if (Array.isArray(entry)) {
          if (entry.length > 0 && typeof entry[0] === 'string') {
            addName(entry[0])
          }
          scanValue(entry)
          return
        }
        if (typeof entry === 'object') {
          scanObject(entry as Record<string, unknown>)
        }
      })
      return
    }
    if (typeof value === 'object') {
      scanObject(value as Record<string, unknown>)
    }
  }

  scanObject(original)

  return names.some(name => pattern.test(name))
}

export const resolveEnhancementMonthly = (
  totalValue: unknown,
  monthlyValue: unknown,
  months: number
): number => {
  const parsedMonthly = parseNumericValue(monthlyValue)
  if (parsedMonthly !== null && parsedMonthly > 0) {
    return parsedMonthly
  }

  const parsedTotal = parseNumericValue(totalValue)
  if (parsedTotal !== null && parsedTotal > 0 && months > 0) {
    return parsedTotal / months
  }

  return 0
}

export const computeEnhancementAddOns = (
  provider: ProviderType,
  enhancement: EnhancedQuote | undefined,
  contractMonths: number
): number => {
  if (!enhancement) return 0

  const months = Math.max(1, Number.isFinite(contractMonths) ? contractMonths : 12)

  let total = 0
  const add = (value: unknown) => {
    const parsed = parseNumericValue(value)
    if (parsed !== null && parsed > 0) {
      total += parsed
    }
  }

  const enh = enhancement.enhancements || {}

  const terminationItems: Array<TerminationComponentEnhancement | undefined> = []
  if (provider !== 'deel') {
    terminationItems.push(enh.severanceProvision)
  }
  terminationItems.push(enh.noticePeriodCost)
  terminationItems.forEach(item => {
    if (!item || item.isAlreadyIncluded) return
    const amount = resolveEnhancementMonthly(item.totalAmount, item.monthlyAmount, months)
    add(amount)
  })

  const salaryEnhancements: Array<SalaryEnhancement | undefined> = [
    enh.thirteenthSalary,
    enh.fourteenthSalary,
  ]
  const baseIncludesThirteenth = baseQuoteContainsPattern(enhancement, /13(?:th)?|thirteenth|aguinaldo/i)
  const baseIncludesFourteenth = baseQuoteContainsPattern(enhancement, /14(?:th)?|fourteenth/i)
  salaryEnhancements.forEach(item => {
    if (!item || item.isAlreadyIncluded) return
    if (item === enh.thirteenthSalary && baseIncludesThirteenth) return
    if (item === enh.fourteenthSalary && baseIncludesFourteenth) return
    const amount = resolveEnhancementMonthly(item.yearlyAmount, item.monthlyAmount, months)
    add(amount)
  })

  const bonusItems: Array<BonusEnhancement | undefined> = [
    enh.vacationBonus,
  ]
  bonusItems.forEach(item => {
    if (!item || item.isAlreadyIncluded) return
    const parsed = parseNumericValue(item.amount)
    if (parsed === null || parsed <= 0) return
    const amount = item.frequency === 'monthly'
      ? parsed
      : parsed / (months > 0 ? months : 1)
    add(amount)
  })

  const allowanceItems: Array<AllowanceEnhancement | undefined> = [
    enh.transportationAllowance,
    enh.remoteWorkAllowance,
    enh.mealVouchers,
  ]
  allowanceItems.forEach(item => {
    if (!item || item.isAlreadyIncluded) return
    add(item.monthlyAmount)
  })

  if (enh.additionalContributions) {
    Object.values(enh.additionalContributions).forEach(add)
  }

  if (enh.medicalExam?.required) {
    add(enh.medicalExam.estimatedCost)
  }

  return total
}
