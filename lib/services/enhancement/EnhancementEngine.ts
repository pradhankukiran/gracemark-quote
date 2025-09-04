// EnhancementEngine - Core orchestrator for EOR quote enhancement using Groq LLM

import { 
  EnhancedQuote, 
  GroqEnhancementResponse,
  NormalizedQuote,
  PapayaCountryData,
  ProviderType,
  MultiProviderEnhancement,
  MultiProviderResult,
  EnhancementError,
  TerminationCostBreakdown,
  SalaryEnhancement,
  BonusEnhancement,
  AllowanceEnhancement,
  MedicalExamCosts,
  OverlapAnalysis,
  StandardizedBenefitData
} from "@/lib/types/enhancement"
import { EORFormData } from "@/lib/shared/types"
import { getCountryByName } from "@/lib/data"
import { GroqService } from "../llm/GroqService"
import { PapayaService } from "../data/PapayaService"
import { LegalProfileService } from "../data/LegalProfileService"
import { QuoteNormalizer } from "../data/QuoteNormalizer"
import { enhancementCache, EnhancementPerformanceMonitor } from "./EnhancementCache"
import { ProviderInclusionsExtractor } from "./ProviderInclusionsExtractor"

export class EnhancementEngine {
  private groqService: GroqService
  private static instance: EnhancementEngine

  constructor(groqService?: GroqService) {
    this.groqService = groqService || GroqService.getInstance()
  }

  /**
   * Singleton pattern for global instance
   */
  static getInstance(): EnhancementEngine {
    if (!EnhancementEngine.instance) {
      EnhancementEngine.instance = new EnhancementEngine()
    }
    return EnhancementEngine.instance
  }

  /**
   * Main method: Enhance a single provider quote
   */
  async enhanceQuote(params: {
    provider: ProviderType
    providerQuote: any
    formData: EORFormData
    quoteType?: 'all-inclusive' | 'statutory-only'
  }): Promise<EnhancedQuote> {
    const timer = EnhancementPerformanceMonitor.startTimer(params.provider)
    const quoteType = params.quoteType || 'all-inclusive'
    
    try {
      // Check cache first
      const cachedResult = enhancementCache.get(
        params.provider,
        params.formData,
        params.providerQuote,
        quoteType
      )
      
      if (cachedResult) {
        enhancementCache.recordHit()
        timer.end(true, true)
        return cachedResult
      }

      enhancementCache.recordMiss()
      
      // Step 1: Normalize the provider quote
      // The API route already validates providerQuote in a normalized shape.
      // Accept pre-normalized quotes to avoid double-normalization issues.
      let normalizedQuote: NormalizedQuote
      if (
        params.providerQuote &&
        typeof params.providerQuote.baseCost === 'number' &&
        typeof params.providerQuote.monthlyTotal === 'number' &&
        typeof params.providerQuote.currency === 'string' &&
        typeof params.providerQuote.country === 'string'
      ) {
        normalizedQuote = params.providerQuote as NormalizedQuote
      } else {
        normalizedQuote = QuoteNormalizer.normalize(params.provider, params.providerQuote)
      }
      
      // Step 2: Build/fetch Legal Profile (Pass 2 - per session)
      const countryCode = this.getCountryCode(params.formData.country)
      const legalProfile = LegalProfileService.getProfile({
        countryCode,
        countryName: params.formData.country,
        formData: params.formData
      })

      if (!legalProfile) {
        throw new Error(`No legal profile available for country: ${params.formData.country}`)
      }

      // Step 3: Deterministic extraction from provider quote (no LLM)
      let extractedBenefits = enhancementCache.getExtraction(
        params.provider,
        normalizedQuote.originalResponse
      )

      if (!extractedBenefits) {
        extractedBenefits = ProviderInclusionsExtractor.extract(params.provider, normalizedQuote)
        enhancementCache.setExtraction(
          params.provider,
          normalizedQuote.originalResponse,
          extractedBenefits,
          60 * 60 * 1000
        )
      }
      
      // Step 4: PASS 3 - Arithmetic compute using legal profile + inclusions
      console.log(`[Enhancement] Computing enhancements for ${params.provider}...`)
      const groqResponse = await this.groqService.computeEnhancements({
        provider: params.provider,
        baseQuote: normalizedQuote,
        quoteType,
        contractDurationMonths: legalProfile.contractMonths,
        extractedBenefits,
        legalProfile: {
          id: legalProfile.id,
          countryCode: legalProfile.countryCode,
          countryName: legalProfile.countryName,
          quoteType: legalProfile.quoteType,
          employmentType: legalProfile.employmentType,
          contractMonths: legalProfile.contractMonths,
          summary: legalProfile.summary,
          formulas: legalProfile.formulas
        }
      })

      console.log(`[Enhancement] Enhancements computed for ${params.provider}. Transforming response...`)
      // Step 5: Transform Groq response to EnhancedQuote format
      const enhancedQuote = this.transformGroqResponse(
        groqResponse, 
        normalizedQuote, 
        {
          quoteType,
          contractDurationMonths: legalProfile.contractMonths
        }
      )

      // Step 6: Validate and cache result
      this.validateEnhancedQuote(enhancedQuote)
      
      // Cache successful result (30 minutes TTL)
      enhancementCache.set(
        params.provider,
        params.formData,
        params.providerQuote,
        quoteType,
        enhancedQuote,
        30 * 60 * 1000
      )
      
      timer.end(true, false)
      return enhancedQuote

    } catch (error) {
      timer.error(error instanceof Error ? error.message : 'Unknown error')
      throw this.handleEnhancementError(error, params.provider)
    }
  }

  /**
   * Enhance multiple provider quotes in parallel
   */
  async enhanceAllProviders(params: MultiProviderEnhancement): Promise<MultiProviderResult> {
    const startTime = Date.now()
    const results: Record<ProviderType, EnhancedQuote> = {} as any
    const errors: Record<ProviderType, EnhancementError[]> = {} as any

    // Process all providers in parallel
    const promises = Object.entries(params.providerQuotes).map(async ([provider, quote]) => {
      try {
        const enhanced = await this.enhanceQuote({
          provider: provider as ProviderType,
          providerQuote: quote,
          formData: params.formData,
          quoteType: params.quoteType
        })
        
        results[provider as ProviderType] = enhanced
      } catch (error) {
        const enhancementError = this.handleEnhancementError(error, provider as ProviderType)
        errors[provider as ProviderType] = [enhancementError]
      }
    })

    await Promise.allSettled(promises)

    // Generate comparison analysis
    const comparison = this.generateComparison(results)
    
    return {
      enhancements: results,
      comparison,
      processingTime: Date.now() - startTime,
      errors
    }
  }

  /**
   * Transform Groq LLM response to structured EnhancedQuote
   */
  private transformGroqResponse(
    groqResponse: GroqEnhancementResponse,
    baseQuote: NormalizedQuote,
    input: { quoteType: 'all-inclusive' | 'statutory-only'; contractDurationMonths: number }
  ): EnhancedQuote {
    const { enhancements, totals, confidence_scores, analysis } = groqResponse

    // Build enhancement objects
    const enhancementData: EnhancedQuote['enhancements'] = {}

    // Termination costs
    if (enhancements.termination_costs) {
      const tc = enhancements.termination_costs
      enhancementData.terminationCosts = {
        noticePeriodCost: tc.notice_period_cost || 0,
        severanceCost: tc.severance_cost || 0,
        totalTerminationCost: tc.total || 0,
        explanation: tc.explanation || 'Standard termination provisions',
        confidence: tc.confidence || 0.5,
        basedOnContractMonths: input.contractDurationMonths
      }
    }

    // 13th salary
    if (enhancements.thirteenth_salary) {
      const ts = enhancements.thirteenth_salary
      enhancementData.thirteenthSalary = {
        monthlyAmount: ts.monthly_amount || 0,
        yearlyAmount: ts.yearly_amount || 0,
        explanation: ts.explanation || '13th month salary as required by law',
        confidence: ts.confidence || 0.5,
        isAlreadyIncluded: ts.already_included || false
      }
    }

    // 14th salary
    if (enhancements.fourteenth_salary) {
      const fs = enhancements.fourteenth_salary
      enhancementData.fourteenthSalary = {
        monthlyAmount: fs.monthly_amount || 0,
        yearlyAmount: fs.yearly_amount || 0,
        explanation: fs.explanation || '14th month salary as required by law',
        confidence: fs.confidence || 0.5,
        isAlreadyIncluded: fs.already_included || false
      }
    }

    // Vacation bonus
    if (enhancements.vacation_bonus) {
      const vb = enhancements.vacation_bonus
      enhancementData.vacationBonus = {
        amount: vb.amount || 0,
        frequency: 'yearly',
        explanation: vb.explanation || 'Vacation bonus as required by law',
        confidence: vb.confidence || 0.5,
        isAlreadyIncluded: vb.already_included || false
      }
    }

    // Transportation allowance
    if (enhancements.transportation_allowance) {
      const ta = enhancements.transportation_allowance
      enhancementData.transportationAllowance = {
        monthlyAmount: ta.monthly_amount || 0,
        currency: baseQuote.currency,
        explanation: ta.explanation || 'Transportation allowance',
        confidence: ta.confidence || 0.5,
        isAlreadyIncluded: ta.already_included || false,
        isMandatory: ta.mandatory || false
      }
    }

    // Remote work allowance
    if (enhancements.remote_work_allowance) {
      const rwa = enhancements.remote_work_allowance
      enhancementData.remoteWorkAllowance = {
        monthlyAmount: rwa.monthly_amount || 0,
        currency: baseQuote.currency,
        explanation: rwa.explanation || 'Remote work allowance',
        confidence: rwa.confidence || 0.5,
        isAlreadyIncluded: rwa.already_included || false,
        isMandatory: rwa.mandatory || false
      }
    }

    // Meal vouchers
    if (enhancements.meal_vouchers) {
      const mv = enhancements.meal_vouchers
      enhancementData.mealVouchers = {
        monthlyAmount: mv.monthly_amount || 0,
        currency: baseQuote.currency,
        explanation: mv.explanation || 'Meal voucher allowance',
        confidence: mv.confidence || 0.5,
        isAlreadyIncluded: mv.already_included || false,
        isMandatory: false
      }
    }

    // Medical exam
    if (enhancements.medical_exam) {
      const me = enhancements.medical_exam
      enhancementData.medicalExam = {
        required: me.required || false,
        estimatedCost: me.estimated_cost || 0,
        confidence: me.confidence || 0.5
      }
    }

    // Build overlap analysis
    const overlapAnalysis: OverlapAnalysis = {
      providerIncludes: analysis?.provider_coverage || [],
      providerMissing: analysis?.missing_requirements || [],
      doubleCountingRisk: analysis?.double_counting_risks || [],
      recommendations: groqResponse.recommendations || []
    }

    // Compute a consistent monthly enhancement sum from individual items
    const monthlyEnhancements: number[] = []
    const addIf = (n?: number, included = true) => {
      if (included && typeof n === 'number' && isFinite(n) && n > 0) monthlyEnhancements.push(n)
    }

    // Termination provision: monthlyize over contract duration if provided
    if (enhancementData.terminationCosts && enhancementData.terminationCosts.totalTerminationCost > 0) {
      const months = enhancementData.terminationCosts.basedOnContractMonths || input.contractDurationMonths || 12
      const monthlyized = months > 0 ? enhancementData.terminationCosts.totalTerminationCost / months : 0
      addIf(monthlyized)
    }

    // Thirteenth/fourteenth salary (monthly amounts preferred, otherwise yearly/12)
    if (enhancementData.thirteenthSalary && !enhancementData.thirteenthSalary.isAlreadyIncluded) {
      const m = enhancementData.thirteenthSalary.monthlyAmount
      const y = enhancementData.thirteenthSalary.yearlyAmount
      addIf(m ?? (y ? y / 12 : 0))
    }
    if (enhancementData.fourteenthSalary && !enhancementData.fourteenthSalary.isAlreadyIncluded) {
      const m = enhancementData.fourteenthSalary.monthlyAmount
      const y = enhancementData.fourteenthSalary.yearlyAmount
      addIf(m ?? (y ? y / 12 : 0))
    }

    // Vacation bonus (monthlyize if marked yearly)
    if (enhancementData.vacationBonus && !enhancementData.vacationBonus.isAlreadyIncluded) {
      const vb = enhancementData.vacationBonus
      const monthly = vb.frequency === 'yearly' ? (vb.amount || 0) / 12 : (vb.amount || 0)
      addIf(monthly)
    }

    // Allowances (monthly) — in statutory-only mode, include only if mandatory
    if (enhancementData.transportationAllowance && !enhancementData.transportationAllowance.isAlreadyIncluded) {
      const ok = input.quoteType !== 'statutory-only' || enhancementData.transportationAllowance.isMandatory
      if (ok) addIf(enhancementData.transportationAllowance.monthlyAmount)
    }
    if (enhancementData.remoteWorkAllowance && !enhancementData.remoteWorkAllowance.isAlreadyIncluded) {
      const ok = input.quoteType !== 'statutory-only' || enhancementData.remoteWorkAllowance.isMandatory
      if (ok) addIf(enhancementData.remoteWorkAllowance.monthlyAmount)
    }
    if (enhancementData.mealVouchers && !enhancementData.mealVouchers.isAlreadyIncluded) {
      const ok = input.quoteType !== 'statutory-only' || enhancementData.mealVouchers.isMandatory
      if (ok) addIf(enhancementData.mealVouchers.monthlyAmount)
    }

    // Additional contributions (assume monthly values)
    if (enhancementData.additionalContributions) {
      Object.values(enhancementData.additionalContributions).forEach(v => addIf(v))
    }

    const computedMonthlyEnhancement = monthlyEnhancements.reduce((s, n) => s + n, 0)
    const baseMonthly = baseQuote.monthlyTotal
    // For consistency, compute final total strictly as base + computed enhancements
    const safeEnhancementMonthly = computedMonthlyEnhancement
    const safeTotalsMonthly = baseMonthly + safeEnhancementMonthly

    return {
      provider: baseQuote.provider,
      baseQuote,
      quoteType: input.quoteType,
      enhancements: enhancementData,
      totalEnhancement: safeEnhancementMonthly,
      finalTotal: safeTotalsMonthly,
      monthlyCostBreakdown: {
        baseCost: baseMonthly,
        enhancements: safeEnhancementMonthly,
        total: safeTotalsMonthly
      },
      overallConfidence: confidence_scores.overall || 0.5,
      explanations: this.extractExplanations(enhancementData),
      warnings: groqResponse.warnings || [],
      overlapAnalysis,
      calculatedAt: new Date().toISOString(),
      baseCurrency: baseQuote.currency
    }
  }

  /**
   * Generate comparison analysis for multiple providers
   */
  private generateComparison(results: Record<ProviderType, EnhancedQuote>) {
    const providers = Object.keys(results) as ProviderType[]
    if (providers.length === 0) {
      return {
        cheapest: 'none' as ProviderType,
        mostExpensive: 'none' as ProviderType,
        averageCost: 0,
        recommendations: ['No valid quotes to compare']
      }
    }

    const costs = providers.map(p => ({ provider: p, cost: results[p].finalTotal }))
    costs.sort((a, b) => a.cost - b.cost)

    const averageCost = costs.reduce((sum, item) => sum + item.cost, 0) / costs.length

    return {
      cheapest: costs[0].provider,
      mostExpensive: costs[costs.length - 1].provider,
      averageCost,
      recommendations: [
        `${costs[0].provider} offers the most cost-effective solution`,
        `Consider ${costs[0].provider} for budget optimization`,
        costs.length > 1 ? `${costs[1].provider} is the second-best option` : null
      ].filter(Boolean) as string[]
    }
  }

  /**
   * Extract all explanations from enhancement data
   */
  private extractExplanations(enhancements: EnhancedQuote['enhancements']): string[] {
    const explanations: string[] = []

    Object.values(enhancements).forEach(enhancement => {
      const exp = (enhancement as any)?.explanation
      if (enhancement && typeof exp === 'string' && exp.length > 0) {
        explanations.push(exp)
      }
    })

    return explanations
  }

  /**
   * Validate enhanced quote structure and data
   */
  private validateEnhancedQuote(quote: EnhancedQuote): void {
    // Basic structure validation
    if (!quote.provider || !quote.baseQuote || !quote.baseCurrency) {
      throw new Error('Invalid enhanced quote structure')
    }

    // Monetary validation
    if (quote.finalTotal < 0 || quote.totalEnhancement < 0) {
      throw new Error('Invalid monetary values in enhanced quote')
    }

    // Confidence validation
    if (quote.overallConfidence < 0 || quote.overallConfidence > 1) {
      console.warn(`Invalid confidence score: ${quote.overallConfidence}`)
    }

    // Enhancement data validation
    Object.values(quote.enhancements).forEach(enhancement => {
      if (enhancement && 'confidence' in enhancement) {
        if (enhancement.confidence < 0 || enhancement.confidence > 1) {
          console.warn(`Invalid enhancement confidence score: ${enhancement.confidence}`)
        }
      }
    })
  }

  /**
   * Get country code from country name
   */
  private getCountryCode(countryName: string): string {
    if (!countryName) return ''
    // Prefer canonical country code from shared data
    const match = getCountryByName(countryName)
    if (match?.code) return match.code

    // Fallback: common mappings
    const countryMap: Record<string, string> = {
      'brazil': 'BR',
      'argentina': 'AR',
      'colombia': 'CO',
      'mexico': 'MX',
      'chile': 'CL',
      'peru': 'PE',
      'germany': 'DE',
      'united kingdom': 'GB',
      'uk': 'GB',
      'france': 'FR',
      'spain': 'ES',
      'italy': 'IT',
      'netherlands': 'NL',
      'united states': 'US',
      'united states of america': 'US',
      'usa': 'US'
    }

    const code = countryMap[countryName.toLowerCase()]
    if (!code) {
      // Last resort: first two letters
      return countryName.substring(0, 2).toUpperCase()
    }
    return code
  }

  /**
   * Enhanced error handling
   */
  private handleEnhancementError(error: any, provider: ProviderType): EnhancementError {
    if (error.code && error.message) {
      // Already an EnhancementError
      return error as EnhancementError
    }

    return {
      code: 'ENHANCEMENT_ERROR',
      message: error?.message || 'Unknown enhancement error',
      provider,
      originalError: error
    }
  }

  /**
   * Calculate confidence score for termination costs
   */
  calculateTerminationCostConfidence(
    papayaData: PapayaCountryData,
    calculatedCosts: TerminationCostBreakdown
  ): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence if we have specific legal data
    if (papayaData.data?.termination?.notice_period) {
      confidence += 0.2
    }
    if (papayaData.data?.termination?.severance_pay) {
      confidence += 0.2
    }
    if (calculatedCosts.basedOnContractMonths > 0) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Health check for the enhancement engine
   */
  async healthCheck(): Promise<boolean> {
    try {
      const groqHealthy = await this.groqService.healthCheck()
      const papayaHealthy = PapayaService.getAvailableCountries().length > 0
      
      return groqHealthy && papayaHealthy
    } catch (error) {
      console.error('Enhancement engine health check failed:', error)
      return false
    }
  }

  /**
   * Get enhancement statistics
   */
  getStats() {
    return {
      groqStats: this.groqService.getStats(),
      papayaCountries: PapayaService.getAvailableCountries().length,
      supportedProviders: 7,
      cacheStats: enhancementCache.getStats(),
      performanceStats: EnhancementPerformanceMonitor.getMetrics()
    }
  }

  /**
   * Clear enhancement cache (useful for testing or cache invalidation)
   */
  clearCache() {
    enhancementCache.clear()
  }

  /**
   * Force cache cleanup (remove expired entries)
   */
  cleanupCache() {
    enhancementCache.cleanup()
  }

  /**
   * Get cache statistics only
   */
  getCacheStats() {
    return enhancementCache.getStats()
  }

  /**
   * Get performance metrics only
   */
  getPerformanceMetrics() {
    return EnhancementPerformanceMonitor.getMetrics()
  }
}
