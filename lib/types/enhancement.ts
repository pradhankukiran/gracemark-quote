// Enhanced EOR Quote System Types

import { EORFormData } from "@/lib/shared/types"

// Provider Types
export type ProviderType = 'deel' | 'remote' | 'rivermate' | 'oyster' | 'rippling' | 'skuad' | 'velocity'

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
  originalResponse: any // Raw provider response
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
      [key: string]: any
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
    [key: string]: any
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
    remoteWorkAmount?: number
    mealVoucherAmount?: number
  }
  contributions: {
    employerRates: Record<string, number>
    employeeRates: Record<string, number>
  }
}

// Individual Enhancement Calculations
export interface TerminationCostBreakdown {
  noticePeriodCost: number
  severanceCost: number
  totalTerminationCost: number
  explanation: string
  confidence: number
  basedOnContractMonths: number
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
    terminationCosts?: TerminationCostBreakdown
    thirteenthSalary?: SalaryEnhancement
    fourteenthSalary?: SalaryEnhancement
    vacationBonus?: BonusEnhancement
    transportationAllowance?: AllowanceEnhancement
    remoteWorkAllowance?: AllowanceEnhancement
    mealVouchers?: AllowanceEnhancement
    medicalExam?: MedicalExamCosts
    additionalContributions?: Record<string, number>
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
  extractedBenefits: StandardizedBenefitData
  legalProfile: LegalProfileInfo
}

export interface GroqEnhancementResponse {
  analysis: {
    provider_coverage: string[]
    missing_requirements: string[]
    double_counting_risks: string[]
  }
  enhancements: {
    termination_costs?: {
      notice_period_cost: number
      severance_cost: number
      total: number
      explanation: string
      confidence: number
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
    termination_costs: number
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
  originalError?: any
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
