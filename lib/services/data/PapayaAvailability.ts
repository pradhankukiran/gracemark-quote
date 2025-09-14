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

  private static load(): AvailabilityMap {
    if (this.cache.map) return this.cache.map
    const filePath = path.join(process.cwd(), 'lib', 'country_data', 'papaya_data_global.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw) as AvailabilityMap
    this.cache.map = json
    return json
  }
}

