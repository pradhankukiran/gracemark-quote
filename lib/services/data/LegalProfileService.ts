// LegalProfileService - Builds a compact, cached legal profile from Papaya + form data

import { PapayaService } from './PapayaService'
import { EORFormData } from '@/lib/shared/types'
import { LegalRequirements } from '@/lib/types/enhancement'

export interface LegalProfile {
  id: string
  countryCode: string
  countryName: string
  quoteType: 'all-inclusive' | 'statutory-only'
  employmentType: string
  contractMonths: number
  requirements: LegalRequirements
  summary: string
  formulas: string
}

class LegalProfileCache {
  private cache = new Map<string, LegalProfile>()

  private makeKey(countryCode: string, employmentType: string, contractMonths: number, quoteType: string) {
    return `${countryCode}|${employmentType}|${contractMonths}|${quoteType}`.toLowerCase()
  }

  get(countryCode: string, employmentType: string, contractMonths: number, quoteType: string) {
    return this.cache.get(this.makeKey(countryCode, employmentType, contractMonths, quoteType)) || null
  }

  set(profile: LegalProfile) {
    const key = this.makeKey(profile.countryCode, profile.employmentType, profile.contractMonths, profile.quoteType)
    this.cache.set(key, profile)
  }
}

const legalProfileCache = new LegalProfileCache()

export class LegalProfileService {
  /**
   * Build or retrieve a compact LegalProfile for a given form + country
   */
  static getProfile(params: { countryCode: string; countryName: string; formData: EORFormData }): LegalProfile | null {
    const contractMonths = Math.max(1, parseInt(params.formData.contractDuration || '12') || 12)
    const quoteType = (params.formData.quoteType || 'all-inclusive') as 'all-inclusive' | 'statutory-only'
    const employmentType = params.formData.employmentType || 'full-time'

    const cached = legalProfileCache.get(params.countryCode, employmentType, contractMonths, quoteType)
    if (cached) return cached

    // Prefer the core Papaya data (results[0].data); fall back to legacy path
    const core = PapayaService.getCountryCoreData(params.countryCode)
    let requirements: LegalRequirements
    if (core) {
      requirements = PapayaService.extractLegalRequirementsFromCore(core)
    } else {
      const papaya = PapayaService.getCountryData(params.countryCode)
      if (!papaya) return null
      requirements = PapayaService.extractLegalRequirements(papaya)
    }

    const summary = this.buildSummary({
      country: params.countryName,
      quoteType,
      contractMonths,
      employmentType,
      requirements
    })

    const formulas = this.buildFormulas()

    const id = this.hashKey(params.countryCode, employmentType, contractMonths, quoteType, summary)

    const profile: LegalProfile = {
      id,
      countryCode: params.countryCode,
      countryName: params.countryName,
      quoteType,
      employmentType,
      contractMonths,
      requirements,
      summary,
      formulas
    }

    legalProfileCache.set(profile)
    return profile
  }

  private static buildSummary(input: {
    country: string
    quoteType: string
    contractMonths: number
    employmentType: string
    requirements: LegalRequirements
  }) {
    const r = input.requirements
    const parts: string[] = []
    parts.push(`COUNTRY: ${input.country}`)
    parts.push(`MODE: ${input.quoteType}`)
    parts.push(`CONTRACT_MONTHS: ${input.contractMonths}`)
    parts.push(`EMPLOYMENT_TYPE: ${input.employmentType}`)

    // Termination numeric summary
    if (r.terminationCosts) {
      parts.push(`TERMINATION_NUMERIC: notice_days=${r.terminationCosts.noticePeriodDays}; severance_months=${r.terminationCosts.severanceMonths}`)
    }

    // Include raw text hints from Papaya where available
    try {
      // Best-effort access to raw Papaya text via global service again (no perf issue; cached)
      // This ensures LLM can infer rates when numeric extraction is ambiguous
      void (global as any).__papaya_raw__ // likely undefined; ignore if not set
      // intentionally not implemented; summary remains numeric + below hints
    } catch {}

    if (r.mandatorySalaries) {
      parts.push(`MANDATORY_SALARIES: 13th=${r.mandatorySalaries.has13thSalary}; 14th=${r.mandatorySalaries.has14thSalary}`)
      if (r.mandatorySalaries.monthlyMultiplier13th) {
        parts.push(`13TH_MULTIPLIER_MONTHLY: ${r.mandatorySalaries.monthlyMultiplier13th}`)
      }
      if (r.mandatorySalaries.monthlyMultiplier14th) {
        parts.push(`14TH_MULTIPLIER_MONTHLY: ${r.mandatorySalaries.monthlyMultiplier14th}`)
      }
    }

    if (typeof r.bonuses?.vacationBonusPercentage === 'number') {
      parts.push(`VACATION_BONUS_PERCENT: ${r.bonuses.vacationBonusPercentage}`)
    }

    // Allowances with amounts if present (LLM can infer mandatory vs optional)
    const allowanceLines: string[] = []
    if (typeof r.allowances?.transportationAmount === 'number') {
      allowanceLines.push(`transportation=${r.allowances.transportationAmount}`)
    }
    if (typeof r.allowances?.remoteWorkAmount === 'number') {
      allowanceLines.push(`remote_work=${r.allowances.remoteWorkAmount}`)
    }
    if (typeof r.allowances?.mealVoucherAmount === 'number') {
      allowanceLines.push(`meal_vouchers=${r.allowances.mealVoucherAmount}`)
    }
    parts.push(`ALLOWANCES_AMOUNTS: ${allowanceLines.join('; ') || 'none'}`)

    parts.push(`MANDATORY_INTERPRETATION_GUIDANCE: Determine whether allowances are legally mandatory based on country law; in statutory-only mode include ONLY mandatory items.`)

    return parts.join('\n')
  }

  private static buildFormulas() {
    // Keep formulas readable so the LLM can follow them deterministically
    return `FORMULAS (all monthly, round to 2 decimals, half-up):
1) thirteenth_salary_monthly = BASE_SALARY (13th salary accrual equals one month of base salary)
2) fourteenth_salary_monthly = BASE_SALARY (14th salary accrual equals one month of base salary)
3) vacation_bonus_monthly = (BASE_SALARY * (VACATION_BONUS_PERCENT/100)) / 12
4) transportation_allowance_monthly = LEGALLY_DEFINED_AMOUNT (if applicable)
5) remote_work_allowance_monthly = LEGALLY_DEFINED_AMOUNT (if applicable)
6) meal_vouchers_monthly = LEGALLY_DEFINED_AMOUNT (if applicable)
7) termination_monthly_provision = ((NOTICE_DAYS/30) * BASE_SALARY + SEVERANCE_MONTHS * BASE_SALARY) / CONTRACT_MONTHS
TOTAL_ENHANCEMENTS = SUM(all enhancement items except items already_included)
FINAL_MONTHLY_TOTAL = BASE_MONTHLY + TOTAL_ENHANCEMENTS`
  }

  private static hashKey(...parts: unknown[]) {
    try {
      const crypto = require('crypto') as typeof import('crypto')
      const json = JSON.stringify(parts)
      return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
    } catch {
      return Buffer.from(parts.join('|')).toString('base64').slice(0, 16)
    }
  }
}
