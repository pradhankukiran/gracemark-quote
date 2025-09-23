// PapayaAvailability - Read presence flags for Papaya sections per country (ISO2)

import fs from 'fs'
import path from 'path'

type AvailabilityMap = Record<string, string[]>

export interface PapayaAvailabilityFlags {
  contribution_employer_contributions: boolean
  contribution_employee_contributions: boolean
  contribution_income_tax: boolean
  payroll_13th_salary: boolean
  payroll_14th_salary: boolean
  payroll_13th_and_14th: boolean
  payroll_cycle: boolean
  termination_notice_period: boolean
  termination_severance_pay: boolean
  termination_probation_period: boolean
  common_benefits: boolean
  remote_work: boolean
  authority_payments: boolean
  minimum_wage: boolean
}

export class PapayaAvailability {
  private static cache: { map?: AvailabilityMap } = {}

  static getFlags(countryCode: string): PapayaAvailabilityFlags {
    const code = (countryCode || '').trim().toUpperCase()
    const data = this.load()
    const has = (key: string) => Array.isArray((data as any)[key]) && (data as any)[key].includes(code)
    return {
      contribution_employer_contributions: has('contribution{employer_contributions}') || has('contribution'),
      contribution_employee_contributions: has('contribution{employee_contributions}') || has('contribution'),
      contribution_income_tax: has('contribution{income_tax}') || has('contribution'),
      payroll_13th_salary: has('payroll{13th_salary}') || has('payroll{13th_&_14th_salaries}') ,
      payroll_14th_salary: has('payroll{14th_salary}') || has('payroll{13th_&_14th_salaries}') ,
      payroll_13th_and_14th: has('payroll{13th_&_14th_salaries}'),
      payroll_cycle: has('payroll{payroll_cycle}') || has('payroll{payroll_frequency}'),
      termination_notice_period: has('termination{notice_period}'),
      termination_severance_pay: has('termination{severance_pay}') || has('termination{severance}'),
      termination_probation_period: has('termination{probation_period}') || has('termination{probation}'),
      common_benefits: has('common_benefits'),
      remote_work: has('remote_work'),
      authority_payments: has('authority_payments'),
      minimum_wage: has('minimum_wage')
    }
  }

  /**
   * Get available benefit types for dynamic LLM mapping
   */
  static getAvailableBenefitTypes(countryCode: string): {
    hasCommonBenefits: boolean
    hasMandatory13thSalary: boolean
    hasMandatory14thSalary: boolean
    hasVacationBonus: boolean
    hasTerminationCosts: boolean
    hasEmployerContributions: boolean
    hasRemoteWorkSupport: boolean
  } {
    const flags = this.getFlags(countryCode)
    return {
      hasCommonBenefits: flags.common_benefits,
      hasMandatory13thSalary: flags.payroll_13th_salary,
      hasMandatory14thSalary: flags.payroll_14th_salary,
      hasVacationBonus: flags.payroll_13th_salary, // Often related to 13th salary systems
      hasTerminationCosts: flags.termination_severance_pay || flags.termination_notice_period,
      hasEmployerContributions: flags.contribution_employer_contributions,
      hasRemoteWorkSupport: flags.remote_work
    }
  }

  /**
   * Check if a country should include specific allowance types in all-inclusive quotes
   */
  static shouldIncludeAllowanceType(countryCode: string, allowanceType: string): boolean {
    const flags = this.getFlags(countryCode)

    // Only include allowances if country has common_benefits data
    if (!flags.common_benefits) return false

    // For countries with common benefits, include standard allowance types
    const standardAllowances = [
      'transportation_allowance', 'transport_allowance', 'commuter_allowance',
      'meal_vouchers', 'food_allowance', 'meal_allowance',
      'remote_work_allowance', 'home_office_allowance', 'wfh_allowance',
      'wellness_allowance', 'health_allowance', 'fitness_allowance',
      'communication_allowance', 'phone_allowance', 'internet_allowance',
      'health_insurance', 'medical_insurance', 'insurance_allowance', 'healthcare_allowance',
      'car_allowance', 'vehicle_allowance',
      'travel_insurance', 'insurance_allowance',
      'cleaning_allowance', 'house_allowance'
    ]

    const normalizedType = allowanceType.toLowerCase().replace(/[_\s-]/g, '')
    return standardAllowances.some(allowed =>
      allowed.toLowerCase().replace(/[_\s-]/g, '').includes(normalizedType) ||
      normalizedType.includes(allowed.toLowerCase().replace(/[_\s-]/g, ''))
    )
  }

  /**
   * Get country-specific benefit mapping hints for LLM processing
   */
  static getBenefitMappingHints(countryCode: string): {
    expectedBenefitCategories: string[]
    shouldEstimateAmounts: boolean
    allowanceAmountRanges: Record<string, { min: number; max: number }>
  } {
    const flags = this.getFlags(countryCode)
    const categories: string[] = []

    if (flags.contribution_employer_contributions) categories.push('contributions')
    if (flags.payroll_13th_salary) categories.push('bonuses')
    if (flags.termination_severance_pay || flags.termination_notice_period) categories.push('termination')
    if (flags.common_benefits) categories.push('allowances')

    // Country-specific amount estimation ranges (in local currency units)
    const ranges: Record<string, { min: number; max: number }> = {}
    if (flags.common_benefits) {
      // Conservative estimation ranges - will be refined per country
      ranges.meal_vouchers = { min: 25, max: 100 }
      ranges.transportation_allowance = { min: 50, max: 200 }
      ranges.remote_work_allowance = { min: 25, max: 100 }
      ranges.wellness_allowance = { min: 30, max: 120 }
      ranges.communication_allowance = { min: 20, max: 80 }
      ranges.car_allowance = { min: 100, max: 400 }
    }

    return {
      expectedBenefitCategories: categories,
      shouldEstimateAmounts: flags.common_benefits,
      allowanceAmountRanges: ranges
    }
  }

  private static load(): AvailabilityMap {
    if (this.cache.map) return this.cache.map
    const filePath = path.join(process.cwd(), 'lib', 'country_data', 'papaya_data_global.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw) as AvailabilityMap
    this.cache.map = json
    return json
  }
}
