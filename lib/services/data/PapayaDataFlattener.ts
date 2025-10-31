// PapayaDataFlattener - Utility to flatten and clean Papaya Global data for LLM consumption

import { PapayaCountryData } from "@/lib/types/enhancement"

export interface FlattenedPapayaData {
  country: string
  currency: string
  data: string // Flattened, cleaned data string
  extractedAt: string
}

export class PapayaDataFlattener {
  /**
   * Flatten and clean Papaya Global data for direct LLM consumption
   */
  static flatten(papayaData: PapayaCountryData): FlattenedPapayaData {
    const data = papayaData.data
    if (!data) {
      return {
        country: papayaData.country || 'Unknown',
        currency: '',
        data: 'No legal data available',
        extractedAt: new Date().toISOString()
      }
    }

    const sections: string[] = []
    
    // Extract currency from various fields
    const currency = this.extractCurrency(data)
    
    // Employer Contributions
    if (data.contribution?.employer_contributions) {
      sections.push('EMPLOYER_CONTRIBUTIONS:')
      data.contribution.employer_contributions.forEach(contrib => {
        const rate = this.cleanText(contrib.rate)
        const desc = this.cleanText(contrib.description)
        sections.push(`- ${desc}: ${rate}`)
      })
      sections.push('')
    }

    // Employee Contributions
    if (data.contribution?.employee_contributions) {
      sections.push('EMPLOYEE_CONTRIBUTIONS:')
      data.contribution.employee_contributions.forEach(contrib => {
        const rate = this.cleanText(contrib.rate)
        const desc = this.cleanText(contrib.description)
        sections.push(`- ${desc}: ${rate}`)
      })
      sections.push('')
    }

    // Minimum Wage
    if (data.minimum_wage) {
      sections.push('MINIMUM_WAGE:')
      sections.push(this.cleanText(data.minimum_wage))
      sections.push('')
    }

    // Payroll Information (13th/14th salary)
    if (data.payroll) {
      sections.push('PAYROLL_REQUIREMENTS:')
      if (data.payroll.payroll_cycle) {
        sections.push(`Payroll Cycle: ${this.cleanText(data.payroll.payroll_cycle)}`)
      }
      if (data.payroll['13th_salary']) {
        sections.push(`13th Salary: ${this.cleanText(data.payroll['13th_salary'])}`)
      }
      if (data.payroll['14th_salary']) {
        sections.push(`14th Salary: ${this.cleanText(data.payroll['14th_salary'])}`)
      }
      sections.push('')
    }

    // Working Hours
    if (data.working_hours) {
      sections.push('WORKING_HOURS:')
      if (data.working_hours.general) {
        sections.push(`General: ${this.cleanText(data.working_hours.general)}`)
      }
      if (data.working_hours.overtime) {
        sections.push(`Overtime: ${this.cleanText(data.working_hours.overtime)}`)
      }
      sections.push('')
    }

    // Termination Rules
    if (data.termination) {
      sections.push('TERMINATION_REQUIREMENTS:')
      if (data.termination.notice_period) {
        sections.push(`Notice Period: ${this.cleanText(data.termination.notice_period)}`)
      }
      if (data.termination.severance_pay) {
        sections.push(`Severance Pay: ${this.cleanText(data.termination.severance_pay)}`)
      }
      if (data.termination.probation_period) {
        sections.push(`Probation Period: ${this.cleanText(data.termination.probation_period)}`)
      }
      if (data.termination.termination_process) {
        sections.push(`Process: ${this.cleanText(data.termination.termination_process)}`)
      }
      sections.push('')
    }

    // Leave Entitlements
    if (data.leave) {
      sections.push('LEAVE_ENTITLEMENTS:')
      Object.entries(data.leave).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          const cleanKey = key.replace(/_/g, ' ').toUpperCase()
          sections.push(`${cleanKey}: ${this.cleanText(value)}`)
        }
      })
      sections.push('')
    }

    // Common Benefits
    if (data.common_benefits && Array.isArray(data.common_benefits)) {
      sections.push('COMMON_BENEFITS:')
      data.common_benefits.forEach(benefit => {
        sections.push(`- ${this.cleanText(benefit)}`)
      })
      sections.push('')
    }

    // Remote Work Rules
    if (data.remote_work) {
      sections.push('REMOTE_WORK_RULES:')
      sections.push(this.cleanText(data.remote_work))
      sections.push('')
    }

    // VAT Information
    if (data.vat?.general) {
      sections.push('VAT_RATES:')
      sections.push(this.cleanText(data.vat.general))
      sections.push('')
    }

    // Authority Payments
    if (data.authority_payments && Array.isArray(data.authority_payments)) {
      sections.push('AUTHORITY_PAYMENT_DEADLINES:')
      data.authority_payments.forEach(payment => {
        if (payment.authority_payment && payment.due_date) {
          sections.push(`- ${payment.authority_payment}: Due ${payment.due_date}`)
        }
      })
      sections.push('')
    }

    return {
      country: papayaData.country || 'Unknown',
      currency: currency,
      data: sections.join('\n').trim(),
      extractedAt: new Date().toISOString()
    }
  }

  /**
   * Flatten Papaya data focusing ONLY on sections needed to compute quotes.
   * Keeps the payload compact to reduce LLM transport/streaming issues.
   */
  static flattenForQuote(papayaData: PapayaCountryData): FlattenedPapayaData {
    const data = papayaData.data
    if (!data) {
      return {
        country: papayaData.country || 'Unknown',
        currency: '',
        data: 'No legal data available',
        extractedAt: new Date().toISOString()
      }
    }

    const sections: string[] = []

    // Extract currency
    const currency = this.extractCurrency(data)

    // Keep ONLY the most relevant sections for cost computation
    // 1) Employer contributions
    if (data.contribution?.employer_contributions) {
      sections.push('EMPLOYER_CONTRIBUTIONS:')
      data.contribution.employer_contributions.forEach(contrib => {
        const rate = this.cleanText(contrib.rate)
        const desc = this.cleanText(contrib.description)
        sections.push(`- ${desc}: ${rate}`)
      })
      sections.push('')
    }

    // 2) Payroll requirements (13th/14th)
    if (data.payroll) {
      sections.push('PAYROLL_REQUIREMENTS:')
      if (data.payroll['13th_salary']) {
        sections.push(`13th Salary: ${this.cleanText(data.payroll['13th_salary'])}`)
      }
      if (data.payroll['14th_salary']) {
        sections.push(`14th Salary: ${this.cleanText(data.payroll['14th_salary'])}`)
      }
      sections.push('')
    }

    // 3) Termination rules
    if (data.termination) {
      sections.push('TERMINATION_REQUIREMENTS:')
      if (data.termination.notice_period) {
        sections.push(`Notice Period: ${this.cleanText(data.termination.notice_period)}`)
      }
      if (data.termination.severance_pay) {
        sections.push(`Severance Pay: ${this.cleanText(data.termination.severance_pay)}`)
      }
      if (data.termination.probation_period) {
        sections.push(`Probation Period: ${this.cleanText(data.termination.probation_period)}`)
      }
      sections.push('')
    }

    // 4) Common benefits (non-mandatory, for all-inclusive)
    if (data.common_benefits && Array.isArray(data.common_benefits)) {
      sections.push('COMMON_BENEFITS:')
      data.common_benefits.forEach(benefit => {
        sections.push(`- ${this.cleanText(benefit)}`)
      })
      sections.push('')
    }

    const compactData = sections.join('\n').trim()
    // Hard cap length to reduce transport issues
    const maxLen = 20000
    const clipped = compactData.length > maxLen ? (compactData.slice(0, maxLen) + '\n[truncated]') : compactData

    return {
      country: papayaData.country || 'Unknown',
      currency,
      data: clipped,
      extractedAt: new Date().toISOString()
    }
  }

  /**
   * Clean text by removing excessive whitespace and normalizing
   */
  private static cleanText(text: string): string {
    if (!text || typeof text !== 'string') return ''
    
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single
      .trim()
  }

  /**
   * Extract currency code from various Papaya data fields
   */
  private static extractCurrency(data: any): string {
    // Try to find currency code in various places
    const textToSearch = [
      data.minimum_wage || '',
      ...(data.contribution?.employer_contributions || []).map((c: any) => `${c.rate} ${c.description}`),
      ...(data.common_benefits || []).join(' ')
    ].join(' ')

    // Common currency patterns
    const currencyMatch = textToSearch.match(/\b([A-Z]{3})\b/)
    if (currencyMatch) {
      return currencyMatch[1]
    }

    // Fallback to common country currency mappings
    const countryName = (data.country || '').toLowerCase()
    const currencyMap: Record<string, string> = {
      'brazil': 'BRL',
      'argentina': 'ARS',
      'colombia': 'COP',
      'mexico': 'MXN',
      'chile': 'CLP',
      'peru': 'PEN',
      'germany': 'EUR',
      'france': 'EUR',
      'spain': 'EUR',
      'italy': 'EUR',
      'netherlands': 'EUR',
      'united kingdom': 'GBP',
      'uk': 'GBP',
      'united states': 'USD',
      'usa': 'USD'
    }

    return currencyMap[countryName] || 'USD'
  }

  /**
   * Get a compact summary version for logging/debugging
   */
  static getSummary(flattened: FlattenedPapayaData): string {
    const lines = flattened.data.split('\n')
    const sectionHeaders = lines.filter(line => line.endsWith(':'))
    return `${flattened.country} (${flattened.currency}) - Sections: ${sectionHeaders.join(', ')}`
  }
}
