// Enhanced EOR Quote System Types

import { EORFormData } from "@/lib/shared/types"

// Provider Types
export type ProviderType = 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity'

// Provider Response Types
export interface RemoteAPIResponse {
  employment?: {
    employer_currency_costs?: {
      monthly_contributions_total?: number
      monthly_benefits_total?: number
      monthly_contributions_breakdown?: Array<{ name: string; amount: number }>
      monthly_benefits_breakdown?: Array<{ name: string; amount: number }>
    }
  }
  contributions?: number
  [key: string]: unknown
}

export interface RivermateAPIResponse {
  taxItems?: Array<{ name: string; amount: number }>
  [key: string]: unknown
}

export interface OysterAPIResponse {
  contributions?: Array<{ name: string; amount: number }>
  [key: string]: unknown
}

export interface GenericProviderResponse {
  costs?: Array<{ name: string; amount: number | string; frequency?: string }>
  employer_costs?: number | string
  [key: string]: unknown
}

export type ProviderResponseType = RemoteAPIResponse | RivermateAPIResponse | OysterAPIResponse | GenericProviderResponse

// Base Quote Structure (normalized across all providers)
export interface NormalizedQuote {
  provider: ProviderType
  baseCost: number
  currency: string
  country: string
  monthlyTotal: number
  breakdown: {
    platformFee?: number
    managementFee?: number
    processingFee?: number
    statutoryContributions?: number
    [key: string]: number | undefined
  }
  originalResponse: ProviderResponseType // Raw provider response
}

// Standardized Benefit Data (extracted from provider responses)
export interface StandardizedBenefitData {
  provider: ProviderType
  baseSalary: number
  currency: string
  country: string
  monthlyTotal: number
  includedBenefits: {
    thirteenthSalary?: {
      amount: number
      frequency: 'monthly' | 'yearly'
      description?: string
    }
    fourteenthSalary?: {
      amount: number
      frequency: 'monthly' | 'yearly'
      description?: string
    }
    transportAllowance?: {
      amount: number
      frequency: 'monthly'
      description?: string
    }
    mealVouchers?: {
      amount: number
      frequency: 'monthly'
      description?: string
    }
    vacationBonus?: {
      amount: number
      frequency: 'yearly'
      description?: string
    }
    socialSecurity?: {
      amount: number
      frequency: 'monthly'
      description?: string
    }
    healthInsurance?: {
      amount: number
      frequency: 'monthly'
      description?: string
    }
    [key: string]: {
      amount: number
      frequency: 'monthly' | 'yearly'
      description?: string
    } | undefined
  }
  totalMonthlyBenefits: number
  extractionConfidence: number
  extractedAt: string
}

// Papaya Global Data Structure
export interface PapayaCountryData {
  country: string
  url: string
  scraped_at: string
  data: {
    contribution: {
      employer_contributions: Array<{
        rate: string
        description: string
      }>
      employee_contributions: Array<{
        rate: string
        description: string
      }>
      income_tax?: Array<{
        rate: string
        description: string
      }>
    }
    minimum_wage?: string
    payroll: {
      payroll_cycle: string
      '13th_salary'?: string
      '14th_salary'?: string
      [key: string]: string | undefined
    }
    working_hours: {
      general: string
      overtime: string
    }
    leave: {
      annual_leave_vacation: string
      public_holidays: string
      sick_days: string
      maternity_leave: string
      paternity_leave: string
      [key: string]: string
    }
    termination: {
      termination_process: string
      notice_period: string
      severance_pay: string
      probation_period: string
    }
    common_benefits?: string[]
    remote_work?: string
    vat?: { general: string }
    authority_payments?: Array<{ authority_payment: string; paid_to: string; due_date: string }>
    visa?: { general_info: string }
    [key: string]: string | string[] | Record<string, unknown> | Array<Record<string, unknown>> | undefined
  }
}

// Legal Requirements Extracted from Papaya Data
export interface LegalRequirements {
  terminationCosts: {
    noticePeriodDays: number
    severanceMonths: number
    probationPeriodDays: number
  }
  mandatorySalaries: {
    has13thSalary: boolean
    has14thSalary: boolean
    monthlyMultiplier13th?: number
    monthlyMultiplier14th?: number
  }
  bonuses: {
    vacationBonusPercentage?: number
    yearEndBonusMonths?: number
  }
  allowances: {
    transportationAmount?: number
    transportationMandatory?: boolean
    remoteWorkAmount?: number
    remoteWorkMandatory?: boolean
    mealVoucherAmount?: number
    mealVoucherMandatory?: boolean
  }
  contributions: {
    employerRates: Record<string, number>
    employeeRates: Record<string, number>
  }
}

export interface TerminationCostBreakdown {
  noticePeriodCost?: number
  severanceCost?: number
  probationCost?: number
  totalTerminationCost: number
  explanation?: string
  confidence?: number
  basedOnContractMonths?: number
}

// Individual Enhancement Calculations

export interface TerminationComponentEnhancement {
  monthlyAmount: number
  totalAmount: number
  explanation: string
  confidence: number
  isAlreadyIncluded: boolean
}

export interface SalaryEnhancement {
  monthlyAmount: number
  yearlyAmount: number
  explanation: string
  confidence: number
  isAlreadyIncluded: boolean
}

export interface BonusEnhancement {
  amount: number
  frequency: 'monthly' | 'yearly' | 'upon-termination'
  explanation: string
  confidence: number
  isAlreadyIncluded: boolean
}

export interface AllowanceEnhancement {
  monthlyAmount: number
  currency: string
  explanation: string
  confidence: number
  isAlreadyIncluded: boolean
  isMandatory: boolean
}

export interface MedicalExamCosts {
  required: boolean
  estimatedCost?: number
  providers?: string[]
  confidence: number
}

// Overlap Analysis
export interface OverlapAnalysis {
  providerIncludes: string[]
  providerMissing: string[]
  doubleCountingRisk: string[]
  recommendations: string[]
}

// Main Enhanced Quote Structure
export interface EnhancedQuote {
  // Base Information
  provider: ProviderType
  baseQuote: NormalizedQuote
  quoteType: 'all-inclusive' | 'statutory-only'
  
  // Enhancements
  enhancements: {
    severanceProvision?: TerminationComponentEnhancement
    probationProvision?: TerminationComponentEnhancement
    thirteenthSalary?: SalaryEnhancement
    fourteenthSalary?: SalaryEnhancement
    vacationBonus?: BonusEnhancement
    transportationAllowance?: AllowanceEnhancement
    remoteWorkAllowance?: AllowanceEnhancement
    mealVouchers?: AllowanceEnhancement
    medicalExam?: MedicalExamCosts
    additionalContributions?: Record<string, number>
    terminationCosts?: TerminationCostBreakdown
  }
  
  // Totals
  totalEnhancement: number
  finalTotal: number
  monthlyCostBreakdown: {
    baseCost: number
    enhancements: number
    total: number
  }
  
  // Metadata
  overallConfidence: number
  explanations: string[]
  warnings: string[]
  overlapAnalysis: OverlapAnalysis
  calculatedAt: string
  
  // Currency Information
  baseCurrency: string
  displayCurrency?: string
  exchangeRate?: number
  
  // Optional: Full quote assembled in local currency (Papaya)
  fullQuote?: {
    type: 'all-inclusive' | 'statutory-only'
    country: string
    currency: string
    base_salary_monthly: number
    items: Array<{ key: string; name: string; monthly_amount: number }>
    subtotals: {
      contributions: number
      bonuses: number
      allowances: number
      termination: number
    }
    total_monthly: number
  }
  // Optional: Names of base-quote items that the LLM marked as needing recomputation (UI hint only)
  recalcBaseItems?: string[]
}

// Groq LLM Input/Output Types
export interface EnhancementInput {
  provider: ProviderType
  providerQuote: NormalizedQuote
  formData: EORFormData
  papayaData: PapayaCountryData
  quoteType: 'all-inclusive' | 'statutory-only'
  contractDurationMonths: number
  extractedBenefits?: StandardizedBenefitData // Optional for two-pass flow
}

// Legal profile (Pass 2) for 3-pass flow
export interface LegalProfileInfo {
  id: string
  countryCode: string
  countryName: string
  quoteType: 'all-inclusive' | 'statutory-only'
  employmentType: string
  contractMonths: number
  summary: string
  formulas: string
}

// Arithmetic compute input (Pass 3)
export interface ArithmeticComputeInput {
  provider: ProviderType
  baseQuote: NormalizedQuote
  quoteType: 'all-inclusive' | 'statutory-only'
  contractDurationMonths: number
  formData?: EORFormData
  extractedBenefits: StandardizedBenefitData
  legalProfile: LegalProfileInfo
}

// Direct Enhancement Input (New Simplified Approach)
export interface DirectEnhancementInput {
  provider: ProviderType
  baseQuote: NormalizedQuote
  formData: EORFormData
  papayaData: string // Flattened Papaya Global legal data
  papayaCurrency: string // Currency extracted from Papaya data
  quoteType: 'all-inclusive' | 'statutory-only'
  contractDurationMonths: number
  extractedBenefits: StandardizedBenefitData // What provider already includes
}

export interface GroqEnhancementResponse {
  analysis: {
    provider_coverage: string[]
    missing_requirements: string[]
    double_counting_risks: string[]
  }
  enhancements: {
    severance_provision?: {
      monthly_amount: number
      total_amount: number
      explanation: string
      confidence: number
      already_included: boolean
    }
    probation_provision?: {
      monthly_amount: number
      total_amount: number
      explanation: string
      confidence: number
      already_included: boolean
    }
    thirteenth_salary?: {
      monthly_amount: number
      yearly_amount: number
      explanation: string
      confidence: number
      already_included: boolean
    }
    fourteenth_salary?: {
      monthly_amount: number
      yearly_amount: number
      explanation: string
      confidence: number
      already_included: boolean
    }
    vacation_bonus?: {
      amount: number
      explanation: string
      confidence: number
      already_included: boolean
    }
    transportation_allowance?: {
      monthly_amount: number
      explanation: string
      confidence: number
      already_included: boolean
      mandatory: boolean
    }
    remote_work_allowance?: {
      monthly_amount: number
      explanation: string
      confidence: number
      already_included: boolean
      mandatory: boolean
    }
    meal_vouchers?: {
      monthly_amount: number
      explanation: string
      confidence: number
      already_included: boolean
    }
    medical_exam?: {
      required: boolean
      estimated_cost?: number
      explanation: string
      confidence: number
    }
  }
  totals: {
    total_monthly_enhancement: number
    total_yearly_enhancement: number
    final_monthly_total: number
  }
  confidence_scores: {
    overall: number
    salary_enhancements: number
    allowances: number
  }
  recommendations: string[]
  warnings: string[]
}

// Service Configuration Types
export interface GroqConfig {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  rateLimitRpm: number
  requestTimeoutMs?: number
}

export interface CacheConfig {
  ttl: number // Time to live in seconds
  keyPrefix: string
  enabled: boolean
}

// Error Types
export interface EnhancementError {
  code: string
  message: string
  provider?: ProviderType
  originalError?: Error | unknown
}

// Multi-Provider Enhancement
export interface MultiProviderEnhancement {
  formData: EORFormData
  papayaData: PapayaCountryData
  providerQuotes: Record<ProviderType, NormalizedQuote>
  quoteType: 'all-inclusive' | 'statutory-only'
}

export interface MultiProviderResult {
  enhancements: Record<ProviderType, EnhancedQuote>
  comparison: {
    cheapest: ProviderType
    mostExpensive: ProviderType
    averageCost: number
    recommendations: string[]
  }
  processingTime: number
  errors: Record<ProviderType, EnhancementError[]>
}

// Validation Schemas (for Zod)
export interface EnhancementValidation {
  input: EnhancementInput
  errors: string[]
  warnings: string[]
  isValid: boolean
}
