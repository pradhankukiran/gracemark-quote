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
  OverlapAnalysis,
  StandardizedBenefitData,
  DirectEnhancementInput,
  LegalRequirements
} from "@/lib/types/enhancement"
import { EORFormData } from "@/lib/shared/types"
import { getCountryByName } from "@/lib/data"
import { GroqService } from "../llm/GroqService"
import { PapayaService } from "../data/PapayaService"
import { PapayaDataFlattener } from "../data/PapayaDataFlattener"
import { LegalProfileService } from "../data/LegalProfileService"
import { QuoteNormalizer } from "../data/QuoteNormalizer"
import { enhancementCache, EnhancementPerformanceMonitor } from "./EnhancementCache"
import { ProviderInclusionsExtractor } from "./ProviderInclusionsExtractor"
import type { PrepassLegalProfile } from "@/lib/services/llm/CerebrasService"
import { PapayaAvailability } from "@/lib/services/data/PapayaAvailability"

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
    providerQuote: NormalizedQuote | Record<string, unknown>
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
      
      // Step 4: PASS 3 - Arithmetic compute using legal profile + inclusions (with retry)
      console.log(`[Enhancement] Computing enhancements for ${params.provider}...`)
      let groqResponse
      let lastError: unknown
      
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          groqResponse = await this.groqService.computeEnhancements({
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
          break // Success - exit retry loop
        } catch (error) {
          lastError = error
          if (attempt === 1) {
            console.warn(`[Enhancement] Groq call attempt ${attempt} failed for ${params.provider}, retrying once...`, error instanceof Error ? error.message : 'Unknown error')
          } else {
            console.error(`[Enhancement] Groq call attempt ${attempt} failed for ${params.provider}, giving up.`, error instanceof Error ? error.message : 'Unknown error')
            throw error // Final failure - re-throw
          }
        }
      }

      if (!groqResponse) {
        throw new Error('No response received from Groq LLM service')
      }

      // console.log(`[Enhancement] Enhancements computed for ${params.provider}. Transforming response...`)
      // Step 5: Transform Groq response to EnhancedQuote format
      const enhancedQuote = this.transformGroqResponse(
        groqResponse,
        normalizedQuote,
        {
          quoteType,
          contractDurationMonths: legalProfile.contractMonths,
          formData: params.formData,
          legalRequirements: legalProfile.requirements
        }
      )

      // Debug logging for enhanced quote result
      if (typeof window === 'undefined') {
        try {
          const baseTotal = normalizedQuote.monthlyTotal
          const enhancement = enhancedQuote.totalEnhancement
          const finalTotal = enhancedQuote.finalTotal
          console.log(`[Enhancement] Enhanced Quote Result for ${params.provider}: Base: ${baseTotal.toLocaleString()} ${enhancedQuote.baseCurrency} → Enhanced: ${finalTotal.toLocaleString()} ${enhancedQuote.baseCurrency} (+${enhancement.toLocaleString()} ${enhancedQuote.baseCurrency})`, {
            baseTotal,
            totalEnhancement: enhancement,
            finalTotal,
            currency: enhancedQuote.baseCurrency,
            overallConfidence: enhancedQuote.overallConfidence,
            keyEnhancements: {
              terminationCosts: (() => {
                const tc = enhancedQuote.enhancements.terminationCosts
                if (!tc) return 0
                const months = Math.max(1, Number(tc.basedOnContractMonths || 12))
                const total = Number(tc.totalTerminationCost || 0)
                return months > 0 ? Number((total / months).toFixed(2)) : 0
              })(),
              thirteenthSalary: enhancedQuote.enhancements.thirteenthSalary?.monthlyAmount || 0,
              employerContributions: enhancedQuote.enhancements.additionalContributions ? Object.values(enhancedQuote.enhancements.additionalContributions).reduce((sum, val) => sum + (val || 0), 0) : 0
            }
          })
        } catch {/* noop */}
      }

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
   * Direct enhancement using flattened Papaya data (New Simplified Approach)
   */
  async enhanceQuoteDirect(params: {
    provider: ProviderType
    providerQuote: NormalizedQuote | Record<string, unknown>
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
      
      // Step 2: Build a Papaya Legal Profile via pre-pass (Cerebras)
      const countryCode = this.getCountryCode(params.formData.country)
      const papayaData = PapayaService.getCountryData(countryCode)
      if (!papayaData) throw new Error(`No Papaya Global data available for country: ${params.formData.country}`)

      // Prepare quote-level pre-pass key components
      const contractDurationMonths = Math.max(1, parseInt(params.formData.contractDuration || '12') || 12)
      const baseSalaryMonthly = Number(params.formData.baseSalary || 0) || 0
      const employmentType = (params.formData.employmentType || '').toString()
      const prepassKey = {
        countryCode,
        baseSalaryMonthly,
        contractMonths: contractDurationMonths,
        quoteType,
        employmentType
      }

      // Run pre-pass with cache/in-flight dedupe in parallel with provider extraction
      const cerebrasPrepassPromise = (async () => {
        // Try cache first
        const cached = enhancementCache.getPrepassBaseline(prepassKey)
        if (cached) return cached

        // Check in-flight
        const inflight = enhancementCache.getPrepassInflight(prepassKey)
        if (inflight) return await inflight

        // Start new request and register as in-flight
        const p = (async () => {
          try {
            const { CerebrasService } = await import("@/lib/services/llm/CerebrasService")
            const cerebras = CerebrasService.getInstance()
            const baseline = await cerebras.buildLegalProfile({ countryCode, formData: params.formData })
            // Cache on success
            enhancementCache.setPrepassBaseline(prepassKey, baseline, 30 * 60 * 1000)
            return baseline
          } catch (err) {
            console.warn('[Enhancement] Cerebras pre-pass failed, using deterministic baseline:', err instanceof Error ? err.message : 'Unknown')
            const deterministicBaseline = this.buildDeterministicPrepassBaseline({
              countryCode,
              countryName: params.formData.country,
              formData: params.formData
            })
            enhancementCache.setPrepassBaseline(prepassKey, deterministicBaseline, 30 * 60 * 1000)
            return deterministicBaseline
          }
        })()
        enhancementCache.setPrepassInflight(prepassKey, p)
        try {
          const result = await p
          return result
        } finally {
          enhancementCache.clearPrepassInflight(prepassKey)
        }
      })()

      // Build legal profile for deterministic safety net
      const legalProfile = LegalProfileService.getProfile({
        countryCode,
        countryName: params.formData.country,
        formData: params.formData
      })
      
      // Step 3: Extract provider benefits (what they already include)
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

      // Step 4: Contract duration calculation
      // (already computed above as contractDurationMonths)
      // Step 5: Wait for pre-pass (Cerebras) and compute deterministic deltas using the legal profile
      console.log(`[Enhancement] Building legal baseline via Cerebras pre-pass for ${params.provider}...`)
      let groqLikeResponse
      try {
        const legalBaseline = await cerebrasPrepassPromise
        // Use Groq with Cerebras pre-pass baseline to compute final enhancements per provider
        groqLikeResponse = await this.groqService.computeEnhancementsWithPrepass({
          provider: params.provider,
          baseQuote: normalizedQuote,
          quoteType,
          contractDurationMonths: contractDurationMonths,
          extractedBenefits,
          prepass: legalBaseline
        })
      } catch (prepassError) {
        console.warn('[Enhancement] Cerebras pre-pass failed, attempting deterministic baseline:', prepassError instanceof Error ? prepassError.message : 'Unknown')
        try {
          const deterministicBaseline = this.buildDeterministicPrepassBaseline({
            countryCode,
            countryName: params.formData.country,
            formData: params.formData
          })
          groqLikeResponse = await this.groqService.computeEnhancementsWithPrepass({
            provider: params.provider,
            baseQuote: normalizedQuote,
            quoteType,
            contractDurationMonths,
            extractedBenefits,
            prepass: deterministicBaseline
          })
        } catch (detErr) {
          console.warn('[Enhancement] Deterministic baseline failed, falling back to direct Groq path:', detErr instanceof Error ? detErr.message : 'Unknown')
          const flattenedPapaya = PapayaDataFlattener.flattenForQuote(papayaData)
          let lastError: unknown
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const directInput: DirectEnhancementInput = {
                provider: params.provider,
                baseQuote: normalizedQuote,
                formData: params.formData,
                papayaData: flattenedPapaya.data,
                papayaCurrency: flattenedPapaya.currency,
                quoteType,
                contractDurationMonths,
                extractedBenefits
              }
              groqLikeResponse = await this.groqService.computeDirectEnhancements(directInput)
              break
            } catch (error) {
              lastError = error
              if (attempt === 1) {
                console.warn(`[Enhancement] Direct Groq call attempt ${attempt} failed for ${params.provider}, retrying once...`, error instanceof Error ? error.message : 'Unknown error')
              } else {
                console.error(`[Enhancement] Direct Groq call attempt ${attempt} failed for ${params.provider}, giving up.`, error instanceof Error ? error.message : 'Unknown error')
                throw error
              }
            }
          }
          if (!groqLikeResponse) throw detErr || new Error('Fallback Groq path failed')
        }
      }

      // console.log(`[Enhancement] Enhancements computed for ${params.provider}. Transforming response...`)
      const enhancedQuote = this.transformGroqResponse(
        groqLikeResponse,
        normalizedQuote,
        {
          quoteType,
          contractDurationMonths,
          formData: params.formData,
          legalRequirements: legalProfile?.requirements
        }
      )

      // Debug logging for enhanced quote result
      if (typeof window === 'undefined') {
        try {
          const baseTotal = normalizedQuote.monthlyTotal
          const enhancement = enhancedQuote.totalEnhancement
          const finalTotal = enhancedQuote.finalTotal
          console.log(`[Enhancement] Enhanced Quote Result for ${params.provider}: Base: ${baseTotal.toLocaleString()} ${enhancedQuote.baseCurrency} → Enhanced: ${finalTotal.toLocaleString()} ${enhancedQuote.baseCurrency} (+${enhancement.toLocaleString()} ${enhancedQuote.baseCurrency})`, {
            baseTotal,
            totalEnhancement: enhancement,
            finalTotal,
            currency: enhancedQuote.baseCurrency,
            overallConfidence: enhancedQuote.overallConfidence,
            keyEnhancements: {
              terminationCosts: (() => {
                const tc = enhancedQuote.enhancements.terminationCosts
                if (!tc) return 0
                const months = Math.max(1, Number(tc.basedOnContractMonths || 12))
                const total = Number(tc.totalTerminationCost || 0)
                return months > 0 ? Number((total / months).toFixed(2)) : 0
              })(),
              thirteenthSalary: enhancedQuote.enhancements.thirteenthSalary?.monthlyAmount || 0,
              employerContributions: enhancedQuote.enhancements.additionalContributions ? Object.values(enhancedQuote.enhancements.additionalContributions).reduce((sum, val) => sum + (val || 0), 0) : 0
            }
          })
        } catch {/* noop */}
      }

      // Step 7: Validate and cache result
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
    const results: Record<ProviderType, EnhancedQuote> = {} as Record<ProviderType, EnhancedQuote>
    const errors: Record<ProviderType, EnhancementError[]> = {} as Record<ProviderType, EnhancementError[]>

    // Process all providers in parallel
    const promises = Object.entries(params.providerQuotes).map(async ([provider, quote]) => {
      try {
        const enhanced = await this.enhanceQuoteDirect({
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
    input: { quoteType: 'all-inclusive' | 'statutory-only'; contractDurationMonths: number; formData?: EORFormData; legalRequirements?: LegalRequirements }
  ): EnhancedQuote {
    const { enhancements, confidence_scores, analysis } = groqResponse

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

    // Note: Do not mirror main employer_contributions_total into additionalContributions here to avoid double counting.
    // The aggregate contribution is handled later in the totals section in a single, canonical place.

    // Medical exam
    if (enhancements.medical_exam) {
      const me = enhancements.medical_exam
      enhancementData.medicalExam = {
        required: me.required || false,
        estimatedCost: me.estimated_cost || 0,
        confidence: me.confidence || 0.5
      }
    }

    // Deterministic baseline safety net: ensure key statutory items are present using LegalProfile
    try {
      const baseSalary = Number(baseQuote.baseCost) || 0
      const months = Math.max(1, Number(input.contractDurationMonths) || 12)
      const lr = input.legalRequirements

      if (lr && baseSalary > 0) {
        // Termination costs (monthlyized)
        const hasLLMTermination = !!enhancementData.terminationCosts && (enhancementData.terminationCosts.totalTerminationCost || 0) > 0
        const noticeDays = Math.max(0, Number(lr.terminationCosts?.noticePeriodDays || 0))
        const severanceMonths = Math.max(0, Number(lr.terminationCosts?.severanceMonths || 0))
        const derivedMonths = (noticeDays / 30) + severanceMonths
        const effectiveMonths = derivedMonths > 0 ? derivedMonths : 3 // fallback: 3 months total if parsing unavailable
        const termTotal = effectiveMonths * baseSalary
        const termMonthly = months > 0 ? (termTotal / months) : 0
        if (!hasLLMTermination && termMonthly > 0) {
          enhancementData.terminationCosts = {
            noticePeriodCost: (noticeDays / 30) > 0 ? (noticeDays / 30) * baseSalary : 0,
            severanceCost: severanceMonths > 0 ? (severanceMonths * baseSalary) : (effectiveMonths >= 3 ? termTotal : 0),
            totalTerminationCost: termTotal,
            explanation: 'Deterministic termination provision based on Papaya legal profile (notice + severance).',
            confidence: 0.8,
            basedOnContractMonths: months
          }
        }

        // 13th salary
        const hasTh13 = !!enhancementData.thirteenthSalary && ((enhancementData.thirteenthSalary.monthlyAmount || 0) > 0 || (enhancementData.thirteenthSalary.yearlyAmount || 0) > 0)
        if (!hasTh13 && lr.mandatorySalaries?.has13thSalary) {
          const m = baseSalary / 12
          enhancementData.thirteenthSalary = {
            monthlyAmount: m,
            yearlyAmount: m * 12,
            explanation: 'Deterministic 13th salary accrual (Papaya indicates mandatory).',
            confidence: 0.8,
            isAlreadyIncluded: false
          }
        }

        // 14th salary
        const hasTh14 = !!enhancementData.fourteenthSalary && ((enhancementData.fourteenthSalary.monthlyAmount || 0) > 0 || (enhancementData.fourteenthSalary.yearlyAmount || 0) > 0)
        if (!hasTh14 && lr.mandatorySalaries?.has14thSalary) {
          const m = baseSalary / 12
          enhancementData.fourteenthSalary = {
            monthlyAmount: m,
            yearlyAmount: m * 12,
            explanation: 'Deterministic 14th salary accrual (Papaya indicates mandatory).',
            confidence: 0.75,
            isAlreadyIncluded: false
          }
        }

        // Vacation bonus (as yearly percentage; monthlyized later)
        const hasVac = !!enhancementData.vacationBonus && (enhancementData.vacationBonus.amount || 0) > 0
        const vacPct = Number(lr.bonuses?.vacationBonusPercentage || 0)
        if (!hasVac && vacPct > 0 && input.quoteType !== 'statutory-only') {
          const yearly = baseSalary * (vacPct / 100)
          enhancementData.vacationBonus = {
            amount: yearly,
            frequency: 'yearly',
            explanation: 'Deterministic vacation bonus from Papaya employer contribution guidance.',
            confidence: 0.6,
            isAlreadyIncluded: false
          }
        }

        // Employer contributions from Papaya (prefer per-item details over aggregate if provider hasn't included them)
        const hasLLMAggContrib = !!(groqResponse as any)?.enhancements?.employer_contributions_total && typeof (groqResponse as any)?.enhancements?.employer_contributions_total?.monthly_amount === 'number'
        const employerRates = lr.contributions?.employerRates || {}
        const sumRate = Object.values(employerRates).reduce((s, r) => s + (Number(r) || 0), 0)
        const providerHasContribBreakdown = typeof baseQuote.breakdown?.statutoryContributions === 'number' && isFinite(baseQuote.breakdown!.statutoryContributions!) && (baseQuote.breakdown!.statutoryContributions! > 0)
        if (!hasLLMAggContrib && !providerHasContribBreakdown && sumRate > 0) {
          const perItem: Record<string, number> = {}
          Object.entries(employerRates).forEach(([key, rate]) => {
            const pct = Number(rate) || 0
            if (pct > 0) {
              const monthly = baseSalary * (pct / 100)
              perItem[`employer_contrib_${key}`] = monthly
            }
          })
          if (Object.keys(perItem).length > 0) {
            enhancementData.additionalContributions = {
              ...(enhancementData.additionalContributions || {}),
              ...perItem
            }
          }
        }

        // Common allowances from Papaya (include in all-inclusive mode)
        if (input.quoteType === 'all-inclusive') {
          const allow = lr.allowances || {}
          const addIf = (cond: boolean, key: string, amt?: number) => {
            const n = Number(amt || 0)
            if (cond && n > 0) {
              enhancementData.additionalContributions = {
                ...(enhancementData.additionalContributions || {}),
                [key]: n
              }
            }
          }
          addIf(true, 'allowance_meal_vouchers', allow.mealVoucherAmount)
          addIf(true, 'allowance_transportation', allow.transportationAmount)
          addIf(true, 'allowance_remote_work', allow.remoteWorkAmount)
        }
      }
    } catch { /* noop deterministic safety */ }

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
    // Map aggregate employer contributions total if present in LLM output
    const aggContrib: any = (groqResponse as any)?.enhancements?.employer_contributions_total
    if (aggContrib && typeof aggContrib.monthly_amount === 'number' && isFinite(aggContrib.monthly_amount)) {
      enhancementData.additionalContributions = {
        ...(enhancementData.additionalContributions || {}),
        employer_contributions_total: aggContrib.monthly_amount
      }
      addIf(aggContrib.monthly_amount)
    }

    let computedMonthlyEnhancement = monthlyEnhancements.reduce((s, n) => s + n, 0)
    const baseMonthly = baseQuote.monthlyTotal

    // If a fullQuote is present, override enhancement total to align with full monthly total
    let fullQuote = (groqResponse as any)?.full_quote as (EnhancedQuote['fullQuote'] | undefined)
    if (fullQuote && typeof fullQuote === 'object') {
      try {
        const fqTotal = Number((fullQuote as any)?.total_monthly) || 0
        if (fqTotal > 0) {
          const llmDelta = computedMonthlyEnhancement
          const fqDelta = Math.max(0, fqTotal - baseMonthly)
          // Do not lose deterministic or LLM deltas when full-quote under-reports
          computedMonthlyEnhancement = Math.max(llmDelta, fqDelta)
        }
      } catch { /* noop */ }
    }

    let safeEnhancementMonthly = computedMonthlyEnhancement
    let safeTotalsMonthly = baseMonthly + safeEnhancementMonthly

    // Deterministic inclusion of Local Office benefits (if provided and currency matches)
    try {
      const targetCurrency = ((groqResponse as any)?.output_currency || fullQuote?.currency || baseQuote.currency || '').toString()
      const sourceCurrency = input.formData?.currency || ''
      const local = input.formData?.localOfficeInfo as (EORFormData['localOfficeInfo'] | undefined)

      const parseNum = (v?: string) => {
        if (!v) return 0
        const t = v.trim()
        if (!t || t.toLowerCase() === 'n/a' || t.toLowerCase() === 'no') return 0
        const n = Number(t)
        return isFinite(n) && n > 0 ? n : 0
      }

      if (local && targetCurrency && sourceCurrency && targetCurrency === sourceCurrency) {
        const mv = parseNum(local.mealVoucher)
        const tr = parseNum(local.transportation)
        const wfh = parseNum(local.wfh)
        const hi = parseNum(local.healthInsurance)
        const mpo = parseNum(local.monthlyPaymentsToLocalOffice)
        const vatPct = parseNum(local.vat)
        const vatAmt = mpo > 0 && vatPct > 0 ? (mpo * vatPct) / 100 : 0

        const additions: Record<string, number> = {}
        if (mv > 0) additions['local_meal_voucher'] = mv
        if (tr > 0) additions['local_transportation'] = tr
        if (wfh > 0) additions['local_wfh'] = wfh
        if (hi > 0) additions['local_health_insurance'] = hi
        if (mpo > 0) additions['local_office_monthly_payments'] = mpo
        if (vatAmt > 0) additions['local_office_vat'] = Number(vatAmt.toFixed(2))

        const localSum = Object.values(additions).reduce((s, n) => s + n, 0)
        if (localSum > 0) {
          enhancementData.additionalContributions = {
            ...(enhancementData.additionalContributions || {}),
            ...additions
          }
          safeEnhancementMonthly += localSum
          safeTotalsMonthly += localSum
        }
      } else if (local && targetCurrency && sourceCurrency && targetCurrency !== sourceCurrency) {
        // Append a warning if currencies mismatch; we skip adding to avoid mixing currencies
        try {
          (groqResponse as any).warnings = [
            ...((groqResponse as any)?.warnings || []),
            `Local benefits provided in ${sourceCurrency} not added to totals (current quote currency ${targetCurrency}).`
          ]
        } catch { /* noop */ }
      }
    } catch { /* noop */ }

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
      overallConfidence: (confidence_scores?.overall ?? 0.7),
      explanations: this.extractExplanations(enhancementData),
      warnings: groqResponse.warnings || [],
      overlapAnalysis,
      calculatedAt: new Date().toISOString(),
      baseCurrency: (groqResponse as any)?.output_currency || fullQuote?.currency || baseQuote.currency,
      fullQuote: fullQuote && typeof fullQuote === 'object' ? fullQuote : undefined,
      recalcBaseItems: Array.isArray((groqResponse as any)?.recalc_base_items) ? (groqResponse as any)?.recalc_base_items : undefined
    }
  }

  // Build a deterministic pre-pass baseline using LegalProfileService and form inputs (provider-agnostic)
  private buildDeterministicPrepassBaseline(params: { countryCode: string; countryName: string; formData: EORFormData }): PrepassLegalProfile {
    const { countryCode, countryName, formData } = params
    const legalProfile = LegalProfileService.getProfile({ countryCode, countryName, formData })
    const availability = PapayaAvailability.getFlags(countryCode)

    const baseSalary = Math.max(0, Number(formData.baseSalary || 0) || 0)
    const contractMonths = Math.max(1, parseInt(formData.contractDuration || '12') || 12)
    const quoteType = (formData.quoteType || 'all-inclusive') as 'all-inclusive' | 'statutory-only'
    const currency = formData.currency || 'USD'

    const items: PrepassLegalProfile['items'] = []

    // Termination monthly provision
    const noticeDays = Math.max(0, Number(legalProfile?.requirements?.terminationCosts?.noticePeriodDays || 0))
    const severanceMonths = Math.max(0, Number(legalProfile?.requirements?.terminationCosts?.severanceMonths || 0))
    const termMonths = (noticeDays / 30) + severanceMonths
    const termMonthly = termMonths > 0 ? (baseSalary * termMonths) / contractMonths : 0
    if (termMonthly > 0) {
      items.push({
        key: 'termination_costs',
        name: 'Termination Provision',
        category: 'termination',
        mandatory: true,
        formula: '((notice_days/30)+severance_months) * base_salary / contract_months',
        variables: { notice_days: noticeDays, severance_months: severanceMonths },
        monthly_amount_local: Number(termMonthly.toFixed(2)),
        notes: 'Deterministic baseline from legal profile'
      })
    }

    // 13th/14th salary
    if (legalProfile?.requirements?.mandatorySalaries?.has13thSalary) {
      const m = Number((baseSalary / 12).toFixed(2))
      items.push({ key: 'thirteenth_salary', name: '13th Month Salary', category: 'bonuses', mandatory: true, formula: 'base/12', monthly_amount_local: m })
    }
    if (legalProfile?.requirements?.mandatorySalaries?.has14thSalary) {
      const m = Number((baseSalary / 12).toFixed(2))
      items.push({ key: 'fourteenth_salary', name: '14th Month Salary', category: 'bonuses', mandatory: true, formula: 'base/12', monthly_amount_local: m })
    }

    // Allowances (only include in all-inclusive mode)
    const allow = legalProfile?.requirements?.allowances || {}
    const addAllowance = (key: string, name: string, amt?: number) => {
      const n = Math.max(0, Number(amt || 0))
      if (n > 0 && quoteType === 'all-inclusive') {
        items.push({ key, name, category: 'allowances', mandatory: false, monthly_amount_local: Number(n.toFixed(2)) })
      }
    }
    addAllowance('meal_vouchers', 'Meal Vouchers', (allow as any).mealVoucherAmount)
    addAllowance('transportation_allowance', 'Transportation Allowance', (allow as any).transportationAmount)
    addAllowance('remote_work_allowance', 'Remote Work Allowance', (allow as any).remoteWorkAmount)

    // Employer contributions (aggregate monthly cost from percentage rates)
    const rates = legalProfile?.requirements?.contributions?.employerRates || {}
    Object.entries(rates).forEach(([k, v]) => {
      const pct = Math.max(0, Number(v || 0))
      if (pct > 0) {
        const amt = Number((baseSalary * (pct / 100)).toFixed(2))
        items.push({ key: `employer_contrib_${k}`, name: `Employer Contribution - ${k}`, category: 'contributions', mandatory: true, monthly_amount_local: amt })
      }
    })

    // Subtotals and totals
    const subtotals = items.reduce((acc, it) => {
      acc[it.category] = Number((acc[it.category as keyof typeof acc] + it.monthly_amount_local).toFixed(2))
      return acc
    }, { contributions: 0, bonuses: 0, allowances: 0, termination: 0 } as { contributions: number; bonuses: number; allowances: number; termination: number })
    const total = Number((subtotals.contributions + subtotals.bonuses + subtotals.allowances + subtotals.termination).toFixed(2))

    const baseline: PrepassLegalProfile = {
      meta: {
        country_code: countryCode.toUpperCase(),
        country: countryName,
        currency, // use form currency; conversion happens downstream per provider
        base_salary_monthly: baseSalary,
        contract_months: contractMonths,
        quote_type: quoteType
      },
      availability: availability,
      items,
      subtotals,
      total_monthly_local: total,
      warnings: ['Deterministic baseline used due to Cerebras pre-pass failure']
    }
    return baseline
  }

  /**
   * Reconcile a pre-pass legal profile (local currency) with provider inclusions to produce a GroqEnhancementResponse-like object.
   * Performs currency conversion per item using PapayaCurrencyProvider if needed.
   */
  private async reconcilePrepassWithProvider(
    baseline: import('../llm/CerebrasService').PrepassLegalProfile,
    params: {
      baseQuote: { provider: string; monthlyTotal: number; baseCost: number; currency: string; country: string; breakdown?: Record<string, number | undefined> }
      quoteType: 'all-inclusive' | 'statutory-only'
      contractMonths: number
      extractedBenefits: StandardizedBenefitData
    }
  ): Promise<import('@/lib/types/enhancement').GroqEnhancementResponse> {
    const providerCurrency = params.baseQuote.currency
    const localCurrency = baseline.meta.currency || providerCurrency

    const getNum = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v)
      return isFinite(n) && n > 0 ? n : 0
    }
    const prov = params.extractedBenefits?.includedBenefits || {}
    const monthlyOf = (x: any): number => {
      if (!x) return 0
      const amt = typeof x.amount === 'number' ? x.amount : 0
      const freq = (x.frequency || '').toLowerCase()
      return freq === 'yearly' ? amt / 12 : amt
    }

    // Provider coverage map (monthly, provider currency)
    const providerCoverage = {
      thirteenth_salary: monthlyOf((prov as any).thirteenthSalary),
      fourteenth_salary: monthlyOf((prov as any).fourteenthSalary),
      vacation_bonus: monthlyOf((prov as any).vacationBonus),
      transportation_allowance: monthlyOf((prov as any).transportAllowance),
      remote_work_allowance: monthlyOf((prov as any).remoteWorkAllowance),
      meal_vouchers: monthlyOf((prov as any).mealVouchers),
      social_security: monthlyOf((prov as any).socialSecurity)
    }

    // Convert local baseline items → provider currency
    const convertAmount = async (amount: number): Promise<number> => {
      try {
        if (!amount || localCurrency === providerCurrency) return amount || 0
        const { PapayaCurrencyProvider } = await import('@/lib/providers/papaya-currency-provider')
        const conv = new PapayaCurrencyProvider()
        const res = await conv.convertCurrency(amount, localCurrency, providerCurrency)
        if (res.success && res.data?.conversion_data?.target_amount) return res.data.conversion_data.target_amount
        return amount // fallback: no conversion
      } catch {
        return amount
      }
    }

    const enhancements: any = {}
    const missing: string[] = []
    const coverageStrs: string[] = []
    const warnings: string[] = Array.isArray(baseline.warnings) ? baseline.warnings.slice() : []

    // Helper to accumulate totals
    const deltas: number[] = []
    const addDelta = (n: number) => { if (isFinite(n) && n > 0) deltas.push(n) }

    const isStatutory = params.quoteType === 'statutory-only'

    const addCoverageStr = (k: string, v: number) => { if (v > 0) coverageStrs.push(`${k}: ${v.toFixed(2)} ${providerCurrency}`) }
    Object.entries(providerCoverage).forEach(([k,v]) => addCoverageStr(k, v as number))

    // Iterate pre-pass items and compute per-item delta
    const tasks = baseline.items.map(async item => {
      // Skip optional allowances in statutory-only
      if (isStatutory && !item.mandatory && item.category === 'allowances') return
      const localMonthly = getNum(item.monthly_amount_local)
      const providerMonthly = await convertAmount(localMonthly)
      const key = item.key

      // Map to known keys where possible
      const mapKey = (() => {
        if (key.includes('13') || key === 'thirteenth_salary') return 'thirteenth_salary'
        if (key.includes('14') || key === 'fourteenth_salary') return 'fourteenth_salary'
        if (key.includes('vacation') && item.category === 'bonuses') return 'vacation_bonus'
        if (key.includes('transport')) return 'transportation_allowance'
        if (key.includes('remote')) return 'remote_work_allowance'
        if (key.includes('meal')) return 'meal_vouchers'
        if (item.category === 'termination') return 'termination_costs'
        if (item.category === 'contributions') return 'employer_contributions_total'
        return key
      })()

      // Provider coverage for mapped key
      const coverage = (providerCoverage as any)[mapKey] || 0

      if (mapKey === 'termination_costs') {
        // For termination, treat as monthly provision, compute total over contract for explanation
        const total = providerMonthly * Math.max(1, params.contractMonths)
        enhancements.termination_costs = {
          notice_period_cost: 0,
          severance_cost: 0,
          total,
          explanation: 'Termination liability monthly accrual from legal baseline',
          confidence: 0.7
        }
        addDelta(providerMonthly)
        return
      }

      // Contributions: aggregate as one top-up to avoid duplicate UI entries
      if (mapKey === 'employer_contributions_total') {
        const delta = Math.max(0, providerMonthly - Math.max(coverage, 0))
        if (delta > 0) {
          enhancements.employer_contributions_total = {
            monthly_amount: delta,
            explanation: 'Employer contributions baseline vs provider coverage',
            confidence: 0.7,
            already_included: delta === 0
          }
          addDelta(delta)
          missing.push('employer_contributions')
        }
        return
      }

      // Regular mapped items
      const delta = Math.max(0, providerMonthly - Math.max(coverage, 0))
      if (mapKey === 'thirteenth_salary') {
        enhancements.thirteenth_salary = {
          monthly_amount: delta,
          yearly_amount: delta * 12,
          explanation: '13th salary baseline vs provider coverage',
          confidence: 0.75,
          already_included: delta === 0
        }
      } else if (mapKey === 'fourteenth_salary') {
        enhancements.fourteenth_salary = {
          monthly_amount: delta,
          yearly_amount: delta * 12,
          explanation: '14th salary baseline vs provider coverage',
          confidence: 0.7,
          already_included: delta === 0
        }
      } else if (mapKey === 'vacation_bonus') {
        enhancements.vacation_bonus = {
          amount: delta * 12,
          explanation: 'Vacation bonus baseline vs provider coverage',
          confidence: 0.7,
          already_included: delta === 0
        }
      } else if (mapKey === 'transportation_allowance') {
        if (!isStatutory || item.mandatory) {
          enhancements.transportation_allowance = {
            monthly_amount: delta,
            explanation: 'Transportation allowance baseline vs provider coverage',
            confidence: 0.6,
            already_included: delta === 0,
            mandatory: !!item.mandatory
          }
        }
      } else if (mapKey === 'remote_work_allowance') {
        if (!isStatutory || item.mandatory) {
          enhancements.remote_work_allowance = {
            monthly_amount: delta,
            explanation: 'Remote work allowance baseline vs provider coverage',
            confidence: 0.6,
            already_included: delta === 0,
            mandatory: !!item.mandatory
          }
        }
      } else if (mapKey === 'meal_vouchers') {
        if (!isStatutory || item.mandatory) {
          enhancements.meal_vouchers = {
            monthly_amount: delta,
            explanation: 'Meal vouchers baseline vs provider coverage',
            confidence: 0.6,
            already_included: delta === 0
          }
        }
      }
      if (delta > 0) missing.push(mapKey)
      addDelta(delta)
    })

    // Wait for conversions
    await Promise.all(tasks)
    const total = deltas.reduce((s, n) => s + n, 0)
    const resp: import('@/lib/types/enhancement').GroqEnhancementResponse = {
      analysis: {
        provider_coverage: coverageStrs,
        missing_requirements: missing,
        double_counting_risks: []
      },
      enhancements,
      totals: {
        total_monthly_enhancement: Number(total.toFixed(2)),
        total_yearly_enhancement: Number((total * 12).toFixed(2)),
        final_monthly_total: Number((params.baseQuote.monthlyTotal + total).toFixed(2))
      },
      confidence_scores: { overall: 0.75, termination_costs: enhancements.termination_costs ? 0.7 : 0, salary_enhancements: (enhancements.thirteenth_salary || enhancements.fourteenth_salary) ? 0.75 : 0, allowances: (enhancements.transportation_allowance || enhancements.remote_work_allowance || enhancements.meal_vouchers) ? 0.6 : 0 },
      recommendations: [],
      warnings
    }
    return resp
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
      const exp = (enhancement as { explanation?: string })?.explanation
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
  private handleEnhancementError(error: unknown, provider: ProviderType): EnhancementError {
    // Check if it's already an EnhancementError
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      return error as EnhancementError
    }

    const errorObj = error as { message?: string }
    return {
      code: 'ENHANCEMENT_ERROR',
      message: errorObj?.message || 'Unknown enhancement error',
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
   * Perform explicit missing benefits detection with gap analysis
   */
  analyzeMissingBenefits(params: {
    legalRequirements: LegalRequirements
    providerInclusions: StandardizedBenefitData
    quoteType: 'all-inclusive' | 'statutory-only'
    baseSalary: number
    currency: string
  }): {
    missingBenefits: string[]
    includedBenefits: string[]
    gapAnalysis: {
      benefit: string
      required: boolean
      mandatory: boolean
      providerHas: boolean
      providerAmount: number
      confidence: number
      reasoning: string
    }[]
    overallConfidence: number
  } {
    const { legalRequirements, providerInclusions, quoteType, currency } = params
    const missing: string[] = []
    const included: string[] = []
    const analysis: {
      benefit: string
      required: boolean
      mandatory: boolean
      providerHas: boolean
      providerAmount: number
      confidence: number
      reasoning: string
    }[] = []

    // Check 13th salary
    if (legalRequirements.mandatorySalaries.has13thSalary) {
      const providerAmount = providerInclusions.includedBenefits.thirteenthSalary?.amount || 0
      const hasProvider = providerAmount > 0
      analysis.push({
        benefit: '13th Salary',
        required: true,
        mandatory: true,
        providerHas: hasProvider,
        providerAmount,
        confidence: 0.9,
        reasoning: 'Legal requirement: 13th month salary payment as per local labor law'
      })
      if (hasProvider) {
        included.push('13th Salary')
      } else {
        missing.push('13th Salary')
      }
    }

    // Check 14th salary
    if (legalRequirements.mandatorySalaries.has14thSalary) {
      const providerAmount = providerInclusions.includedBenefits.fourteenthSalary?.amount || 0
      const hasProvider = providerAmount > 0
      analysis.push({
        benefit: '14th Salary',
        required: true,
        mandatory: true,
        providerHas: hasProvider,
        providerAmount,
        confidence: 0.9,
        reasoning: 'Legal requirement: 14th month salary payment as per local labor law'
      })
      if (hasProvider) {
        included.push('14th Salary')
      } else {
        missing.push('14th Salary')
      }
    }

    // Check vacation bonus
    if (legalRequirements.bonuses.vacationBonusPercentage && legalRequirements.bonuses.vacationBonusPercentage > 0) {
      const providerAmount = providerInclusions.includedBenefits.vacationBonus?.amount || 0
      const hasProvider = providerAmount > 0
      analysis.push({
        benefit: 'Vacation Bonus',
        required: true,
        mandatory: true,
        providerHas: hasProvider,
        providerAmount,
        confidence: 0.8,
        reasoning: `Legal requirement: ${legalRequirements.bonuses.vacationBonusPercentage}% vacation bonus as per local law`
      })
      if (hasProvider) {
        included.push('Vacation Bonus')
      } else {
        missing.push('Vacation Bonus')
      }
    }

    // Check transportation allowance
    if (legalRequirements.allowances.transportationAmount && legalRequirements.allowances.transportationAmount > 0) {
      const providerAmount = providerInclusions.includedBenefits.transportAllowance?.amount || 0
      const hasProvider = providerAmount > 0
      const isMandatory = legalRequirements.allowances.transportationMandatory || false
      const shouldInclude = quoteType === 'all-inclusive' || isMandatory
      
      if (shouldInclude) {
        analysis.push({
          benefit: 'Transportation Allowance',
          required: shouldInclude,
          mandatory: isMandatory,
          providerHas: hasProvider,
          providerAmount,
          confidence: isMandatory ? 0.8 : 0.6,
          reasoning: isMandatory 
            ? `Legal requirement: ${legalRequirements.allowances.transportationAmount} ${currency} transportation allowance (mandatory)`
            : `Common practice: ${legalRequirements.allowances.transportationAmount} ${currency} transportation allowance (commonly provided)`
        })
        if (hasProvider) {
          included.push('Transportation Allowance')
        } else {
          missing.push('Transportation Allowance')
        }
      }
    }

    // Check meal vouchers
    if (legalRequirements.allowances.mealVoucherAmount && legalRequirements.allowances.mealVoucherAmount > 0) {
      const providerAmount = providerInclusions.includedBenefits.mealVouchers?.amount || 0
      const hasProvider = providerAmount > 0
      const isMandatory = legalRequirements.allowances.mealVoucherMandatory || false
      const shouldInclude = quoteType === 'all-inclusive' || isMandatory
      
      if (shouldInclude) {
        analysis.push({
          benefit: 'Meal Vouchers',
          required: shouldInclude,
          mandatory: isMandatory,
          providerHas: hasProvider,
          providerAmount,
          confidence: isMandatory ? 0.8 : 0.6,
          reasoning: isMandatory 
            ? `Legal requirement: ${legalRequirements.allowances.mealVoucherAmount} ${currency} meal vouchers (mandatory)`
            : `Common practice: ${legalRequirements.allowances.mealVoucherAmount} ${currency} meal vouchers (commonly provided)`
        })
        if (hasProvider) {
          included.push('Meal Vouchers')
        } else {
          missing.push('Meal Vouchers')
        }
      }
    }

    // Check remote work allowance
    if (legalRequirements.allowances.remoteWorkAmount && legalRequirements.allowances.remoteWorkAmount > 0) {
      const providerAmount = providerInclusions.includedBenefits.remoteWorkAllowance?.amount || 0
      const hasProvider = providerAmount > 0
      const isMandatory = legalRequirements.allowances.remoteWorkMandatory || false
      const shouldInclude = quoteType === 'all-inclusive' || isMandatory
      
      if (shouldInclude) {
        analysis.push({
          benefit: 'Remote Work Allowance',
          required: shouldInclude,
          mandatory: isMandatory,
          providerHas: hasProvider,
          providerAmount,
          confidence: isMandatory ? 0.8 : 0.5,
          reasoning: isMandatory 
            ? `Legal requirement: ${legalRequirements.allowances.remoteWorkAmount} ${currency} remote work allowance (mandatory)`
            : `Common practice: ${legalRequirements.allowances.remoteWorkAmount} ${currency} remote work allowance (commonly provided)`
        })
        if (hasProvider) {
          included.push('Remote Work Allowance')
        } else {
          missing.push('Remote Work Allowance')
        }
      }
    }

    // Calculate overall confidence based on the quality of legal requirements data
    const mandatoryBenefitsCount = analysis.filter(a => a.mandatory).length
    const totalBenefitsAnalyzed = analysis.length
    const baseConfidence = totalBenefitsAnalyzed > 0 ? 0.6 : 0.3
    const mandatoryBonus = mandatoryBenefitsCount * 0.1
    const overallConfidence = Math.min(0.95, baseConfidence + mandatoryBonus)

    return {
      missingBenefits: missing,
      includedBenefits: included,
      gapAnalysis: analysis,
      overallConfidence
    }
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
