// PapayaService - Parse and extract legal requirements from Papaya Global data

import { PapayaCountryData, LegalRequirements } from "@/lib/types/enhancement"
import fs from 'fs'
import path from 'path'

export class PapayaService {
  private static cache = new Map<string, PapayaCountryData>()

  /**
   * Get country data from Papaya Global JSON files
   */
  static getCountryData(countryCode: string): PapayaCountryData | null {
    try {
      // Check cache first
      if (this.cache.has(countryCode)) {
        return this.cache.get(countryCode)!
      }

      const filePath = path.join(
        process.cwd(), 
        'lib', 
        'country_data', 
        `papaya_global_data_${countryCode.toUpperCase()}.json`
      )

      if (!fs.existsSync(filePath)) {
        console.warn(`Papaya data not found for country: ${countryCode}`)
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
   * Parse termination-related data
   */
  private static parseTerminationData(termination: any): LegalRequirements['terminationCosts'] {
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
   * Parse 13th and 14th salary requirements
   */
  private static parseSalaryRequirements(data: any): LegalRequirements['mandatorySalaries'] {
    const result: LegalRequirements['mandatorySalaries'] = {
      has13thSalary: false,
      has14thSalary: false
    }

    // Check payroll section for 13th salary mentions
    const payrollText = data.payroll?.payroll_cycle?.toLowerCase() || ''
    
    if (payrollText.includes('13th') || payrollText.includes('thirteenth')) {
      result.has13thSalary = true
      result.monthlyMultiplier13th = 1/12 // 1 month divided over 12 months
    }

    if (payrollText.includes('14th') || payrollText.includes('fourteenth')) {
      result.has14thSalary = true
      result.monthlyMultiplier14th = 1/12
    }

    // Check for direct 13th_salary field in data
    if (data['13th_salary']) {
      const salaryText = data['13th_salary'].toLowerCase()
      if (!salaryText.includes('no') && !salaryText.includes('not')) {
        result.has13thSalary = true
        result.monthlyMultiplier13th = 1/12
      }
    }

    return result
  }

  /**
   * Parse vacation and other bonus requirements
   */
  private static parseBonusRequirements(data: any): LegalRequirements['bonuses'] {
    const result: LegalRequirements['bonuses'] = {}

    // Look for vacation bonus in contributions
    if (data.contribution?.employer_contributions) {
      const vacationBonus = data.contribution.employer_contributions.find(
        (contrib: any) => contrib.description?.toLowerCase().includes('vacation bonus')
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
   * Parse transportation, remote work, and other allowances
   */
  private static parseAllowanceRequirements(data: any): LegalRequirements['allowances'] {
    const result: LegalRequirements['allowances'] = {}

    // Parse from employer contributions
    if (data.contribution?.employer_contributions) {
      data.contribution.employer_contributions.forEach((contrib: any) => {
        const desc = contrib.description?.toLowerCase() || ''
        const rate = contrib.rate || ''

        if (desc.includes('meal') && desc.includes('voucher')) {
          result.mealVoucherAmount = this.extractAmountFromText(rate)
        }
        if (desc.includes('transport')) {
          result.transportationAmount = this.extractAmountFromText(rate)
        }
      })
    }

    // Parse from common benefits
    if (data.common_benefits) {
      const benefits = Array.isArray(data.common_benefits) ? data.common_benefits : []
      benefits.forEach((benefit: string) => {
        const lowerBenefit = benefit.toLowerCase()
        
        if (lowerBenefit.includes('transport') || lowerBenefit.includes('auto allowance')) {
          result.transportationAmount = this.extractAmountFromText(benefit)
        }
        if (lowerBenefit.includes('home office') || lowerBenefit.includes('remote work')) {
          result.remoteWorkAmount = this.extractAmountFromText(benefit)
        }
        if (lowerBenefit.includes('meal') && lowerBenefit.includes('voucher')) {
          result.mealVoucherAmount = this.extractAmountFromText(benefit)
        }
      })
    }

    // Parse remote work allowance from dedicated section
    if (data.remote_work) {
      const remoteText = data.remote_work
      const amount = this.extractAmountFromText(remoteText)
      if (amount > 0) {
        result.remoteWorkAmount = amount
      }
    }

    return result
  }

  /**
   * Parse contribution rates
   */
  private static parseContributionRates(contribution: any): LegalRequirements['contributions'] {
    const result = {
      employerRates: {} as Record<string, number>,
      employeeRates: {} as Record<string, number>
    }

    if (contribution?.employer_contributions) {
      contribution.employer_contributions.forEach((contrib: any) => {
        const key = this.normalizeContributionKey(contrib.description)
        const rate = this.extractPercentageFromText(contrib.rate)
        if (rate > 0) {
          result.employerRates[key] = rate
        }
      })
    }

    if (contribution?.employee_contributions) {
      contribution.employee_contributions.forEach((contrib: any) => {
        const key = this.normalizeContributionKey(contrib.description)
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
    const salaryMatches = text.match(/(\d+)\s*month'?s?\s*salary/i)
    if (salaryMatches) return parseInt(salaryMatches[1])

    return 0
  }

  /**
   * Utility: Extract percentage from text (e.g., "2.75%" -> 2.75)
   */
  private static extractPercentageFromText(text: string): number {
    const matches = text.match(/([\d.]+)%/)
    return matches ? parseFloat(matches[1]) : 0
  }

  /**
   * Utility: Extract monetary amount from text
   */
  private static extractAmountFromText(text: string): number {
    // Try to find numbers with currency symbols
    const currencyMatches = text.match(/[\d,]+\.?\d*/)
    if (currencyMatches) {
      const cleanNumber = currencyMatches[0].replace(/,/g, '')
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
