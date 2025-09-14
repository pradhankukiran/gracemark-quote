// PapayaService - Parse and extract legal requirements from Papaya Global data

import { PapayaCountryData, LegalRequirements } from "@/lib/types/enhancement"
import fs from 'fs'
import path from 'path'

// Internal types for Papaya data parsing
interface PapayaTermination {
  termination_process?: string
  notice_period?: string
  severance_pay?: string
  probation_period?: string
}

interface PapayaContribution {
  rate: string
  description: string
}

interface PapayaContributionData {
  employer_contributions?: PapayaContribution[]
  employee_contributions?: PapayaContribution[]
}

interface PapayaDataStructure {
  contribution?: PapayaContributionData
  termination?: PapayaTermination
  payroll?: {
    payroll_cycle?: string
    '13th_salary'?: string
    '14th_salary'?: string
    [key: string]: string | undefined
  }
  common_benefits?: string[]
  remote_work?: string
  [key: string]: unknown
}

export class PapayaService {
  private static cache = new Map<string, PapayaCountryData>()
  private static coreCache = new Map<string, PapayaCountryData["data"]>()

  // Minimal alias map for non-standard/alternate codes seen in inputs
  // Keep this list intentionally short and data-driven per repo contents.
  // Example: Papaya stores United Kingdom under GB, but some inputs use UK.
  private static CODE_ALIASES: Record<string, string> = {
    UK: 'GB', // United Kingdom -> Great Britain ISO2
    EL: 'GR', // Greece (EU usage EL) -> GR
  }

  private static resolveCodeForPapaya(input: string): string {
    const raw = (input || '').trim().toUpperCase()
    // Apply known aliases first
    const aliased = this.CODE_ALIASES[raw] || raw
    return aliased
  }

  /**
   * Get country data from Papaya Global JSON files
   */
  static getCountryData(countryCode: string): PapayaCountryData | null {
    try {
      // Check cache first
      if (this.cache.has(countryCode)) {
        return this.cache.get(countryCode)!
      }

      // Resolve with minimal aliasing for non-standard codes (e.g., UK -> GB)
      const resolved = this.resolveCodeForPapaya(countryCode)
      const directPath = path.join(process.cwd(), 'lib', 'country_data', `papaya_global_data_${resolved}.json`)
      const fallbackPath = resolved === countryCode.toUpperCase()
        ? null
        : path.join(process.cwd(), 'lib', 'country_data', `papaya_global_data_${countryCode.toUpperCase()}.json`)

      const filePath = fs.existsSync(directPath)
        ? directPath
        : (fallbackPath && fs.existsSync(fallbackPath) ? fallbackPath : '')

      if (!filePath) {
        console.warn(`Papaya data not found for country: ${countryCode} (resolved: ${resolved})`)
        return null
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const jsonData = JSON.parse(fileContent)
      // Extract the first result (Papaya data structure has results array)
      const countryData: PapayaCountryData = jsonData.results?.[0] || jsonData

      // Cache the result
      this.cache.set(countryCode, countryData)
      
      return countryData

    } catch (error) {
      console.error(`Error loading Papaya data for ${countryCode}:`, error)
      return null
    }
  }

  /**
   * Get only the core Papaya data object (results[0].data)
   */
  static getCountryCoreData(countryCode: string): PapayaCountryData["data"] | null {
    try {
      // Check core cache first
      if (this.coreCache.has(countryCode)) return this.coreCache.get(countryCode)!

      // Resolve with minimal aliasing for non-standard codes (e.g., UK -> GB)
      const resolved = this.resolveCodeForPapaya(countryCode)
      const directPath = path.join(process.cwd(), 'lib', 'country_data', `papaya_global_data_${resolved}.json`)
      const fallbackPath = resolved === countryCode.toUpperCase()
        ? null
        : path.join(process.cwd(), 'lib', 'country_data', `papaya_global_data_${countryCode.toUpperCase()}.json`)

      const filePath = fs.existsSync(directPath)
        ? directPath
        : (fallbackPath && fs.existsSync(fallbackPath) ? fallbackPath : '')
      if (!filePath) return null

      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const jsonData = JSON.parse(fileContent)
      const core = (jsonData?.results?.[0]?.data) || jsonData?.data
      if (!core) return null

      this.coreCache.set(countryCode, core)
      return core
    } catch (error) {
      console.error(`Error loading Papaya core data for ${countryCode}:`, error)
      return null
    }
  }

  /**
   * Extract structured legal requirements from Papaya data
   */
  static extractLegalRequirements(papayaData: PapayaCountryData): LegalRequirements {
    const requirements: LegalRequirements = {
      terminationCosts: {
        noticePeriodDays: 0,
        severanceMonths: 0,
        probationPeriodDays: 0
      },
      mandatorySalaries: {
        has13thSalary: false,
        has14thSalary: false
      },
      bonuses: {},
      allowances: {},
      contributions: {
        employerRates: {},
        employeeRates: {}
      }
    }

    if (!papayaData?.data) return requirements

    // Extract termination information
    if (papayaData.data.termination) {
      requirements.terminationCosts = this.parseTerminationData(papayaData.data.termination)
    }

    // Extract salary information (13th, 14th salaries)
    requirements.mandatorySalaries = this.parseSalaryRequirements(papayaData.data)

    // Extract bonus information
    requirements.bonuses = this.parseBonusRequirements(papayaData.data)

    // Extract allowance information
    requirements.allowances = this.parseAllowanceRequirements(papayaData.data)

    // Extract contribution rates
    requirements.contributions = this.parseContributionRates(papayaData.data.contribution)

    return requirements
  }

  /**
   * Extract structured legal requirements directly from the core `data` object
   */
  static extractLegalRequirementsFromCore(coreData: PapayaCountryData["data"] | null | undefined): LegalRequirements {
    const requirements: LegalRequirements = {
      terminationCosts: { noticePeriodDays: 0, severanceMonths: 0, probationPeriodDays: 0 },
      mandatorySalaries: { has13thSalary: false, has14thSalary: false },
      bonuses: {},
      allowances: {},
      contributions: { employerRates: {}, employeeRates: {} }
    }
    if (!coreData) return requirements

    // Reuse existing parsers on the provided core data
    const typedCoreData = coreData as PapayaDataStructure
    if (typedCoreData.termination) {
      requirements.terminationCosts = this.parseTerminationData(typedCoreData.termination)
    }
    requirements.mandatorySalaries = this.parseSalaryRequirements(typedCoreData)
    requirements.bonuses = this.parseBonusRequirements(typedCoreData)
    requirements.allowances = this.parseAllowanceRequirements(typedCoreData)
    requirements.contributions = this.parseContributionRates(typedCoreData.contribution)
    return requirements
  }

  /**
   * Parse termination-related data
   */
  private static parseTerminationData(termination: PapayaTermination): LegalRequirements['terminationCosts'] {
    const result = {
      noticePeriodDays: 0,
      severanceMonths: 0,
      probationPeriodDays: 0
    }

    // Parse notice period
    if (termination.notice_period) {
      result.noticePeriodDays = this.extractDaysFromText(termination.notice_period)
    }

    // Parse severance pay
    if (termination.severance_pay) {
      result.severanceMonths = this.extractMonthsFromText(termination.severance_pay)
    }

    // Parse probation period
    if (termination.probation_period) {
      result.probationPeriodDays = this.extractDaysFromText(termination.probation_period)
    }

    return result
  }

  /**
   * Parse 13th and 14th salary requirements with enhanced detection
   */
  private static parseSalaryRequirements(data: PapayaDataStructure): LegalRequirements['mandatorySalaries'] {
    const result: LegalRequirements['mandatorySalaries'] = {
      has13thSalary: false,
      has14thSalary: false
    }

    // Check multiple locations for 13th salary information
    const checkTexts = [
      data.payroll?.payroll_cycle,
      data.payroll?.[`13th_salary`],
      data[`13th_salary`],
      data.payroll?.[`14th_salary`],
      data[`14th_salary`]
    ].filter(Boolean).join(' ')

    const lowerText = checkTexts.toLowerCase()

    // Enhanced 13th salary detection (stricter: avoid "customary/optional" false positives)
    if (this.detectMandatorySalary(lowerText, '13th')) {
      result.has13thSalary = true
      result.monthlyMultiplier13th = 1/12 // 1 month divided over 12 months
    }

    // Enhanced 14th salary detection (stricter)
    if (this.detectMandatorySalary(lowerText, '14th')) {
      result.has14thSalary = true
      result.monthlyMultiplier14th = 1/12
    }

    return result
  }

  /**
   * Detect if a salary bonus (13th, 14th) is mandatory based on text analysis
   */
  private static detectMandatorySalary(text: string, salaryType: '13th' | '14th'): boolean {
    const mentions = salaryType === '13th'
      ? ['13th', 'thirteenth', '13-month', 'christmas bonus', 'aguinaldo', 'décimo terceiro']
      : ['14th', 'fourteenth', '14-month']

    // Require an explicit mention of the salary type
    if (!mentions.some(p => text.includes(p))) return false

    // Negative/soft indicators that imply non-mandatory or discretionary/common practice
    const softNegative = [
      'customary', 'customarily', 'commonly', 'common', 'typical', 'typically',
      'discretionary', 'at employer discretion', 'may be paid', 'might be paid', 'can be paid',
      'optional', 'not mandatory', 'not required', 'not obligated', 'no legal requirement',
      'depends on company policy', 'case by case', 'subject to contract', 'n/a'
    ]
    if (softNegative.some(w => text.includes(w))) return false

    // Strong positive/mandatory indicators
    const mandatorySignals = [
      'mandatory', 'required', 'must', 'obligatory', 'by law', 'legal requirement',
      'statutory', 'entitled', 'guaranteed', 'shall', 'is paid' // "is paid" alone isn't perfect but often used in mandatory contexts
    ]

    // Only treat as mandatory if positive mandatory signals present (avoid long-text heuristics)
    return mandatorySignals.some(w => text.includes(w))
  }

  /**
   * Parse vacation and other bonus requirements
   */
  private static parseBonusRequirements(data: PapayaDataStructure): LegalRequirements['bonuses'] {
    const result: LegalRequirements['bonuses'] = {}

    // Look for vacation bonus in contributions
    if (data.contribution?.employer_contributions) {
      const vacationBonus = data.contribution.employer_contributions.find(
        (contrib: PapayaContribution) => contrib.description?.toLowerCase().includes('vacation bonus')
      )
      
      if (vacationBonus) {
        result.vacationBonusPercentage = this.extractPercentageFromText(vacationBonus.rate)
      }
    }

    // Check common benefits for vacation-related bonuses
    if (data.common_benefits) {
      const benefits = Array.isArray(data.common_benefits) ? data.common_benefits : []
      benefits.forEach((benefit: string) => {
        if (benefit.toLowerCase().includes('vacation') && benefit.includes('%')) {
          result.vacationBonusPercentage = this.extractPercentageFromText(benefit)
        }
      })
    }

    return result
  }

  /**
   * Parse transportation, remote work, and other allowances with enhanced extraction
   */
  private static parseAllowanceRequirements(data: PapayaDataStructure): LegalRequirements['allowances'] {
    const result: LegalRequirements['allowances'] = {}

    // Parse from employer contributions - now using enhanced extraction
    if (data.contribution?.employer_contributions) {
      data.contribution.employer_contributions.forEach((contrib: PapayaContribution) => {
        const desc = contrib.description?.toLowerCase() || ''
        const rate = contrib.rate || ''

        if (this.isMealVoucherBenefit(desc)) {
          const amount = this.extractAmountFromText(rate)
          if (amount > 0) {
            result.mealVoucherAmount = amount
            result.mealVoucherMandatory = this.isMandatoryBenefit(desc, rate)
          }
        }
        if (this.isTransportationBenefit(desc)) {
          const amount = this.extractAmountFromText(rate)
          if (amount > 0) {
            result.transportationAmount = amount
            result.transportationMandatory = this.isMandatoryBenefit(desc, rate)
          }
        }
        if (this.isRemoteWorkBenefit(desc)) {
          const amount = this.extractAmountFromText(rate)
          if (amount > 0) {
            result.remoteWorkAmount = amount
            result.remoteWorkMandatory = this.isMandatoryBenefit(desc, rate)
          }
        }
      })
    }

    // Parse from common benefits - enhanced pattern matching
    if (data.common_benefits) {
      const benefits = Array.isArray(data.common_benefits) ? data.common_benefits : []
      benefits.forEach((benefit: string) => {
        const lowerBenefit = benefit.toLowerCase()
        
        if (this.isTransportationBenefit(lowerBenefit) && !result.transportationAmount) {
          const amount = this.extractAmountFromText(benefit)
          if (amount > 0) {
            result.transportationAmount = amount
            result.transportationMandatory = this.isMandatoryBenefit(lowerBenefit, benefit)
          }
        }
        if (this.isRemoteWorkBenefit(lowerBenefit) && !result.remoteWorkAmount) {
          const amount = this.extractAmountFromText(benefit)
          if (amount > 0) {
            result.remoteWorkAmount = amount
            result.remoteWorkMandatory = this.isMandatoryBenefit(lowerBenefit, benefit)
          }
        }
        if (this.isMealVoucherBenefit(lowerBenefit) && !result.mealVoucherAmount) {
          const amount = this.extractAmountFromText(benefit)
          if (amount > 0) {
            result.mealVoucherAmount = amount
            result.mealVoucherMandatory = this.isMandatoryBenefit(lowerBenefit, benefit)
          }
        }
      })
    }

    // Parse remote work allowance from dedicated section
    if (data.remote_work && !result.remoteWorkAmount) {
      const remoteText = data.remote_work
      const amount = this.extractAmountFromText(remoteText)
      if (amount > 0) {
        result.remoteWorkAmount = amount
        result.remoteWorkMandatory = this.isMandatoryBenefit(remoteText.toLowerCase(), remoteText)
      }
    }

    return result
  }

  /**
   * Check if benefit description refers to meal vouchers/tickets
   */
  private static isMealVoucherBenefit(text: string): boolean {
    const patterns = [
      'meal voucher', 'food voucher', 'ticket restaurant', 
      'meal ticket', 'food ticket', 'grocery voucher',
      'restaurant voucher', 'alimentação'
    ]
    return patterns.some(pattern => text.includes(pattern))
  }

  /**
   * Check if benefit description refers to transportation
   */
  private static isTransportationBenefit(text: string): boolean {
    const patterns = [
      'transport', 'auto allowance', 'gas allowance', 
      'commut', 'bus', 'metro', 'transit',
      'car allowance', 'vehicle allowance', 'travel allowance'
    ]
    return patterns.some(pattern => text.includes(pattern))
  }

  /**
   * Check if benefit description refers to remote work
   */
  private static isRemoteWorkBenefit(text: string): boolean {
    const patterns = [
      'home office', 'remote work', 'work from home',
      'wfh', 'telework', 'home office allowance',
      'remote allowance'
    ]
    return patterns.some(pattern => text.includes(pattern))
  }

  /**
   * Determine if a benefit is mandatory based on description text
   */
  private static isMandatoryBenefit(description: string, fullText: string): boolean {
    const mandatoryPatterns = [
      'mandatory', 'required', 'compulsory', 'obligatory',
      'must', 'law', 'legal', 'regulation', 'statutory',
      'collective bargaining', 'cba', 'union requirement'
    ]
    
    const optionalPatterns = [
      'optional', 'may', 'can', 'discretionary', 'voluntary'
    ]

    const text = (description + ' ' + fullText).toLowerCase()
    
    // Check for explicit optional indicators
    if (optionalPatterns.some(pattern => text.includes(pattern))) {
      return false
    }
    
    // Check for mandatory indicators
    return mandatoryPatterns.some(pattern => text.includes(pattern))
  }

  /**
   * Parse contribution rates
   */
  private static parseContributionRates(contribution: PapayaContributionData | undefined): LegalRequirements['contributions'] {
    const result = {
      employerRates: {} as Record<string, number>,
      employeeRates: {} as Record<string, number>
    }

    if (contribution?.employer_contributions) {
      contribution.employer_contributions.forEach((contrib: PapayaContribution) => {
        const desc = (contrib.description || '').toString()
        const key = this.normalizeContributionKey(desc)
        // Skip aggregate/roll-up lines like "Total Employment Cost" to avoid double counting
        const lower = desc.toLowerCase()
        const isAggregate = (
          lower.includes('total employment cost') ||
          lower.includes('total employee cost') ||
          (lower.includes('total') && lower.includes('cost')) ||
          lower.includes('overall')
        )
        if (isAggregate) return

        const rate = this.extractPercentageFromText(contrib.rate)
        if (rate > 0) {
          result.employerRates[key] = rate
        }
      })
    }

    if (contribution?.employee_contributions) {
      contribution.employee_contributions.forEach((contrib: PapayaContribution) => {
        const desc = (contrib.description || '').toString()
        const key = this.normalizeContributionKey(desc)
        const lower = desc.toLowerCase()
        const isAggregate = (
          lower.includes('total employment cost') ||
          lower.includes('total employee cost') ||
          (lower.includes('total') && lower.includes('cost')) ||
          lower.includes('overall')
        )
        if (isAggregate) return

        const rate = this.extractPercentageFromText(contrib.rate)
        if (rate > 0) {
          result.employeeRates[key] = rate
        }
      })
    }

    return result
  }

  /**
   * Utility: Extract days from text (e.g., "30 days" -> 30)
   */
  private static extractDaysFromText(text: string): number {
    const dayMatches = text.match(/(\d+)\s*days?/i)
    if (dayMatches) return parseInt(dayMatches[1])

    const monthMatches = text.match(/(\d+)\s*months?/i)
    if (monthMatches) return parseInt(monthMatches[1]) * 30

    const weekMatches = text.match(/(\d+)\s*weeks?/i)
    if (weekMatches) return parseInt(weekMatches[1]) * 7

    return 0
  }

  /**
   * Utility: Extract months from text (e.g., "3 months" -> 3)
   */
  private static extractMonthsFromText(text: string): number {
    const monthMatches = text.match(/(\d+)\s*months?/i)
    if (monthMatches) return parseInt(monthMatches[1])

    // Look for "1 month's salary" type patterns
    const salaryMatches = text.match(/(\d+)\s*month(?:'|’)?s?\s*salary/i)
    if (salaryMatches) return parseInt(salaryMatches[1])

    return 0
  }

  /**
   * Utility: Extract percentage from text (e.g., "2.75%" -> 2.75, "20.00% to 26.80%" -> 23.4)
   */
  private static extractPercentageFromText(text: string): number {
    const t = (text || '').toString()

    // Handle explicit range patterns like "20.00% to 26.80%" - take average
    const rangeMatch = t.match(/([\d.]+)%\s*(?:to|-|–)\s*([\d.]+)%/i)
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1])
      const max = parseFloat(rangeMatch[2])
      if (isFinite(min) && isFinite(max)) return (min + max) / 2
    }

    // Handle additive patterns like "7.30% + 0.85%" - sum all percentages around plus signs
    if (t.includes('+')) {
      // Only sum numbers that have a % sign (avoid summing footnotes like ages)
      const parts = t.split('+')
      let sum = 0
      let counted = 0
      for (const part of parts) {
        const m = part.match(/([\d.]+)\s*%/)
        if (m) {
          const v = parseFloat(m[1])
          if (isFinite(v)) {
            sum += v
            counted++
          }
        }
      }
      if (counted >= 2) return sum
    }

    // Otherwise pick the first percentage in the text
    const singleMatch = t.match(/([\d.]+)\s*%/)
    return singleMatch ? parseFloat(singleMatch[1]) : 0
  }

  /**
   * Utility: Extract monetary amount from text - handles ranges, approximations, and complex formats
   */
  private static extractAmountFromText(text: string): number {
    // Handle approximate values like "~ 350 BRL per month"
    const approxMatch = text.match(/[~≈]\s*([\d,]+\.?\d*)\s*[A-Z]{3}/)
    if (approxMatch) {
      const cleanNumber = approxMatch[1].replace(/,/g, '')
      return parseFloat(cleanNumber)
    }

    // Handle ranges like "20-50 BRL per working day" - take average
    const rangeMatch = text.match(/([\d,]+\.?\d*)\s*[-–]\s*([\d,]+\.?\d*)\s*[A-Z]{3}/)
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1].replace(/,/g, ''))
      const max = parseFloat(rangeMatch[2].replace(/,/g, ''))
      return (min + max) / 2
    }

    // Handle "per working day" patterns - convert to monthly (assuming 22 working days)
    const dailyMatch = text.match(/([\d,]+\.?\d*)\s*[A-Z]{3}\s*per\s*working\s*day/i)
    if (dailyMatch) {
      const dailyAmount = parseFloat(dailyMatch[1].replace(/,/g, ''))
      return dailyAmount * 22 // 22 working days per month average
    }

    // Handle standard currency patterns
    const currencyMatch = text.match(/([\d,]+\.?\d*)\s*[A-Z]{3}/)
    if (currencyMatch) {
      const cleanNumber = currencyMatch[1].replace(/,/g, '')
      return parseFloat(cleanNumber)
    }

    // Fallback: extract any number
    const numberMatch = text.match(/[\d,]+\.?\d*/)
    if (numberMatch) {
      const cleanNumber = numberMatch[0].replace(/,/g, '')
      return parseFloat(cleanNumber)
    }
    
    return 0
  }

  /**
   * Utility: Normalize contribution keys for consistency
   */
  private static normalizeContributionKey(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50) // Keep reasonable length
  }

  /**
   * Get all available countries from Papaya data
   */
  static getAvailableCountries(): string[] {
    try {
      const countryDataDir = path.join(process.cwd(), 'lib', 'country_data')
      const files = fs.readdirSync(countryDataDir)
      
      return files
        .filter(file => file.startsWith('papaya_global_data_') && file.endsWith('.json'))
        .map(file => file.replace('papaya_global_data_', '').replace('.json', '').toLowerCase())
        .sort()
    } catch (error) {
      console.error('Error reading country data directory:', error)
      return []
    }
  }

  /**
   * Clear cache (useful for development)
   */
  static clearCache(): void {
    this.cache.clear()
  }
}
