// GroqService - High-speed LLM service for quote enhancement analysis
import 'groq-sdk/shims/node'
import { Groq } from "groq-sdk"
import type { ChatCompletion } from "groq-sdk/resources/chat/completions"
import { z } from "zod"
import { PromptEngine } from "./PromptEngine"
import { PapayaService } from "@/lib/services/data/PapayaService"
import { PapayaDataFlattener } from "@/lib/services/data/PapayaDataFlattener"
import { PapayaAvailability } from "@/lib/services/data/PapayaAvailability"
import { LegalProfileService } from "@/lib/services/data/LegalProfileService"
import { getCountryByName } from "@/lib/country-data"
import type { EORFormData } from "@/lib/shared/types"
import { 
  GroqConfig, 
  GroqEnhancementResponse, 
  EnhancementInput,
  EnhancementError,
  StandardizedBenefitData,
  ProviderType,
  ArithmeticComputeInput,
  DirectEnhancementInput
} from "@/lib/types/enhancement"
import type { PrepassLegalProfile } from "@/lib/services/llm/CerebrasService"

// Rate limiting interface
interface RateLimiter {
  tokensPerMinute: number
  requestsPerMinute: number
  lastRequestTime: number
  tokenCount: number
  requestCount: number
}

// Employer contributions processing interface
interface EmployerContributionData {
  monthlyAmount: number
  explanation: string
  confidence: number
  alreadyIncluded: boolean
  source: 'item_aggregation' | 'fallback' | 'deterministic_delta' | 'direct_computation' | 'papaya_baseline'
}

export class GroqService {
  private client: Groq | null
  private clients: { pass1?: Groq; pass2?: Groq; pass3?: Groq; default?: Groq } = {}
  private providerClients: Partial<Record<ProviderType, Groq>> = {}
  private config: GroqConfig
  private rateLimiter: RateLimiter
  private static instance: GroqService
  private multiKeyEnabled: boolean

  constructor(config: Partial<GroqConfig> = {}) {
    this.config = {
      apiKey: (config.apiKey || process.env.GROQ_API_KEY || '').trim(),
      model: config.model || process.env.GROQ_MODEL || 'groq/compound-mini',
      temperature: config.temperature ?? (process.env.GROQ_TEMPERATURE ? Number(process.env.GROQ_TEMPERATURE) : 0.1),
      maxTokens: config.maxTokens ?? (process.env.GROQ_MAX_TOKENS ? Number(process.env.GROQ_MAX_TOKENS) : 8192),
      rateLimitRpm: config.rateLimitRpm ?? (process.env.GROQ_RATE_LIMIT_RPM ? Number(process.env.GROQ_RATE_LIMIT_RPM) : 30),
      requestTimeoutMs: config.requestTimeoutMs ?? (process.env.GROQ_REQUEST_TIMEOUT_MS ? Number(process.env.GROQ_REQUEST_TIMEOUT_MS) : 30000),
    }

    // Feature flag for multi-key routing
    {
      const rawFlag = (process.env.GROQ_MULTI_KEY_ENABLED || '').toString()
      const flag = rawFlag.trim().toLowerCase()
      this.multiKeyEnabled = flag === 'true' || flag === '1' || flag === 'yes'
    }

    // Load per-pass keys (with fallback to default key)
    const defaultKey = this.config.apiKey
    const key1 = (process.env.GROQ_API_KEY_1 || '').trim()
    const key2 = (process.env.GROQ_API_KEY_2 || '').trim()
    const key3 = (process.env.GROQ_API_KEY_3 || '').trim()

    if (this.multiKeyEnabled) {
      const pass1Key = key1 || defaultKey
      const pass2Key = key2 || defaultKey
      const pass3Key = key3 || defaultKey

      if (!pass1Key && !pass2Key && !pass3Key) {
        throw new Error('Groq API key(s) required: set GROQ_API_KEY or GROQ_API_KEY_1..3')
      }

      if (pass1Key) this.clients.pass1 = new Groq({ apiKey: pass1Key, defaultHeaders: { "Groq-Model-Version": "latest" } })
      if (pass2Key) this.clients.pass2 = new Groq({ apiKey: pass2Key, defaultHeaders: { "Groq-Model-Version": "latest" } })
      if (pass3Key) this.clients.pass3 = new Groq({ apiKey: pass3Key, defaultHeaders: { "Groq-Model-Version": "latest" } })
      if (defaultKey) this.clients.default = new Groq({ apiKey: defaultKey, defaultHeaders: { "Groq-Model-Version": "latest" } })

      this.client = null
    } else {
      if (!defaultKey) {
        throw new Error('Groq API key is required')
      }
      // Initialize single client with explicit API key to avoid env/config drift
      this.client = new Groq({ apiKey: defaultKey, defaultHeaders: { "Groq-Model-Version": "latest" } })
      this.clients.default = this.client
    }

    this.rateLimiter = {
      tokensPerMinute: 6000, // Groq's typical limit
      requestsPerMinute: this.config.rateLimitRpm,
      lastRequestTime: 0,
      tokenCount: 0,
      requestCount: 0
    }

    // Debug: summarize multi-key state and slot presence once (no secrets)
    try {
      const present = (name: string) => !!(process.env[name] && process.env[name]!.trim().length > 0)
      const summary = {
        model: this.config.model,
        multiKeyEnabled: this.multiKeyEnabled,
        slots: {
          key1: present('GROQ_API_KEY_1'),
          key2: present('GROQ_API_KEY_2'),
          key3: present('GROQ_API_KEY_3'),
          key4: present('GROQ_API_KEY_4'),
          key5: present('GROQ_API_KEY_5'),
          key6: present('GROQ_API_KEY_6'),
          key7: present('GROQ_API_KEY_7'),
        }
      }
      // Only log on server side
      if (typeof window === 'undefined') {
        // console.log('[GroqService] init:', summary)
      }
    } catch {
      // ignore
    }
  }

  /**
   * Singleton pattern for global instance
   */
  static getInstance(config?: Partial<GroqConfig>): GroqService {
    if (!GroqService.instance) {
      GroqService.instance = new GroqService(config)
    }
    return GroqService.instance
  }

  /**
   * Main method: Enhance quote using Groq LLM
   */
  async enhanceQuote(input: EnhancementInput): Promise<GroqEnhancementResponse> {
    // DEPRECATED: This method should use the proper Cerebras → Groq flow
    // Delegate to the correct flow via EnhancementEngine
    throw new Error('enhanceQuote() is deprecated. Use EnhancementEngine.enhanceQuote() for proper Cerebras → Groq flow.')
  }

  /**
   * Extract benefit data from provider API response (Pass 1)
   */
  async extractBenefits(originalResponse: unknown, provider: ProviderType): Promise<StandardizedBenefitData> {
    try {
      // Rate limiting check
      await this.checkRateLimit()
      
      // Build extraction prompts
      const systemPrompt = PromptEngine.buildExtractionSystemPrompt()
      const userPrompt = PromptEngine.buildExtractionUserPrompt(originalResponse, provider)

      

      // Make API call using Groq SDK (Pass 1)
      const client = this.getClient('pass1')
      const response = await this.requestWithRetry((opts) => client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [],
        tool_choice: 'none',
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: "json_object" }
      }, { signal: opts?.signal }))

      // Update rate limiter
      this.updateRateLimiter((response as ChatCompletion).usage?.total_tokens || 0)

     

      // Parse and validate response
      const content = (response as ChatCompletion).choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content received from Groq extraction')
      }

      const jsonText = this.extractJson(content)
      const parsedResponse = this.parseExtractionResponse(jsonText, provider)
      this.validateExtractionResponse(parsedResponse)

      return parsedResponse

    } catch (error) {
      const enhancementError = this.handleError(error, provider)
      throw enhancementError
    }
  }

  // NOTE: Prompt building now handled by PromptEngine

  /**
   * Arithmetic compute (Pass 3): combine legal profile + inclusions to produce final totals
   */
  async computeEnhancements(input: ArithmeticComputeInput): Promise<GroqEnhancementResponse> {
    // Unified path: wrap to direct raw-Papaya flow using country code
    try {
      await this.checkRateLimit()

      // Load and flatten Papaya data based on legalProfile country
      const countryCode = (input.legalProfile?.countryCode || '').toString().trim().toUpperCase()
      const papaya = countryCode ? PapayaService.getCountryData(countryCode) : null
      if (!papaya) {
        throw new Error(`No Papaya Global data available for country: ${input.legalProfile?.countryName || countryCode || 'unknown'}`)
      }
      const flattened = PapayaDataFlattener.flatten(papaya)

      // Use the original formData passed from EnhancementEngine (includes addBenefits checkbox!)
      const formData = input.formData || {
        // Fallback minimal formData if not provided (shouldn't happen in normal flow)
        employeeName: '',
        jobTitle: '',
        workVisaRequired: false,
        country: input.baseQuote.country,
        state: '',
        currency: input.baseQuote.currency,
        isCurrencyManuallySet: false,
        originalCurrency: null,
        clientName: '',
        clientType: 'new',
        clientCountry: '',
        clientCurrency: input.baseQuote.currency,
        baseSalary: String(input.baseQuote.baseCost),
        holidayDays: '',
        probationPeriod: '',
        hoursPerDay: '',
        daysPerWeek: '',
        startDate: '',
        employmentType: input.legalProfile.employmentType || '',
        quoteType: input.quoteType,
        contractDuration: String(input.contractDurationMonths || input.legalProfile.contractMonths || 12),
        enableComparison: false,
        compareCountry: '',
        compareState: '',
        compareCurrency: '',
        compareSalary: '',
        currentStep: 'form',
        showProviderComparison: false,
        showOptionalEmployeeData: false,
        showBenefits: false,
        selectedBenefits: {},
        localOfficeInfo: {
          mealVoucher: '',
          transportation: '',
          wfh: '',
          healthInsurance: '',
          monthlyPaymentsToLocalOffice: '',
          vat: '',
          preEmploymentMedicalTest: '',
          drugTest: '',
          backgroundCheckViaDeel: ''
        }
      }

      return await this.computeDirectEnhancements({
        provider: input.provider,
        baseQuote: input.baseQuote,
        formData,
        papayaData: flattened.data,
        papayaCurrency: flattened.currency,
        quoteType: input.quoteType,
        contractDurationMonths: input.contractDurationMonths,
        extractedBenefits: input.extractedBenefits
      })
    } catch (error) {
      throw this.handleError(error, input.provider)
    }
  }

  /**
   * Enhancement computation using Cerebras-processed legal profile data
   * This method only handles the Cerebras → Groq flow (Flow A)
   */
  async computeDirectEnhancements(input: DirectEnhancementInput): Promise<GroqEnhancementResponse> {
    try {
      // Rate limiting
      await this.checkRateLimit()

      // Use baseline prompting for Cerebras-processed flattened Papaya data
      let systemPrompt = PromptEngine.buildBaselineSystemPrompt()

      // Build BASE ITEMS from provider response for deduplication
      const baseItems: string[] = []
      try {
        const or: any = input.baseQuote.originalResponse || {}
        if (Array.isArray(or?.costs)) {
          for (const c of or.costs) {
            const n = String(c?.name || '').trim()
            if (n) baseItems.push(n)
          }
        }
        // Always include base salary
        baseItems.unshift('Base Salary')
      } catch { /* noop */ }

      let userPrompt = PromptEngine.buildBaselineUserPrompt({
        baseQuote: input.baseQuote as any,
        formData: input.formData, // KEEP: Pass full formData for addBenefits
        papayaData: input.papayaData,
        papayaCurrency: input.papayaCurrency,
        quoteType: input.quoteType,
        contractMonths: input.contractDurationMonths,
        baseItems
      })

      // Minify prompts to reduce token count
      try {
        const compact = (s: string) => s.replace(/\s+/g, ' ').trim()
        systemPrompt = compact(systemPrompt)
        userPrompt = compact(userPrompt)
      } catch { /* noop */ }

      

      // Make request to Groq using provider-routed client and retry wrapper
      const client = this.getProviderClient(input.provider)
      const response = await this.requestWithRetry((opts) => client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [],
        tool_choice: 'none',
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: "json_object" }
      }, { signal: opts?.signal }))

      // Update rate limiter usage
      this.updateRateLimiter((response as ChatCompletion).usage?.total_tokens || 0)

      

      const content = (response as ChatCompletion).choices?.[0]?.message?.content
      if (!content) {
        // Safe fallback: return zero-delta object to avoid breaking UI
        const zeroDelta = 0
        const groqLike: any = {
          analysis: { provider_coverage: [], missing_requirements: [], double_counting_risks: [] },
          enhancements: { employer_contributions_total: { monthly_amount: zeroDelta, explanation: 'LLM returned empty content', confidence: 0.0, already_included: true } },
          totals: {
            total_monthly_enhancement: 0,
            total_yearly_enhancement: 0,
            final_monthly_total: input.baseQuote.monthlyTotal
          },
          confidence_scores: { overall: 0.0, salary_enhancements: 0.0, allowances: 0.0 },
          recommendations: [],
          warnings: ['LLM returned no content for full-quote request'],
          output_currency: input.papayaCurrency || input.baseQuote.currency
        }
        return this.deduplicateEnhancementResponse(groqLike, input.provider) as unknown as GroqEnhancementResponse
      }

      // Parse full quote (local currency) and transform into a GroqEnhancementResponse-compatible structure
      const jsonText = this.extractJson(content)
      const parsed = JSON.parse(jsonText) as any
      const quote = parsed?.quote
      if (!quote || typeof quote.total_monthly !== 'number' || typeof quote.base_salary_monthly !== 'number') {
        // Safe fallback: retain base totals with warning
        const groqLike: any = {
          analysis: { provider_coverage: [], missing_requirements: [], double_counting_risks: [] },
          enhancements: { employer_contributions_total: { monthly_amount: 0, explanation: 'Invalid full-quote response; fallback to base', confidence: 0.0, already_included: true } },
          totals: {
            total_monthly_enhancement: 0,
            total_yearly_enhancement: 0,
            final_monthly_total: input.baseQuote.monthlyTotal
          },
          confidence_scores: { overall: 0.0, salary_enhancements: 0.0, allowances: 0.0 },
          recommendations: [],
          warnings: ['Invalid full-quote response from LLM'],
          output_currency: input.papayaCurrency || input.baseQuote.currency
        }
        return this.deduplicateEnhancementResponse(groqLike, input.provider) as unknown as GroqEnhancementResponse
      }

      // Prepare currency conversion (Papaya/local -> provider currency)
      const providerCurrency = input.baseQuote.currency
      const localCurrency = (quote.currency || input.papayaCurrency || providerCurrency) as string

      let rate: number | null = null
      const convertLocalToProvider = async (amount: number): Promise<number> => {
        try {
          if (!amount || localCurrency === providerCurrency) return amount || 0
          // Use a one-shot rate fetch to avoid multiple network calls
          if (rate === null) {
            const { PapayaCurrencyProvider } = await import('@/lib/providers/papaya-currency-provider')
            const conv = new PapayaCurrencyProvider()
            const one = await conv.convertCurrency(1, localCurrency, providerCurrency)
            const parsed = parseFloat((one as any)?.data?.conversion_data?.exchange_rate || 'NaN')
            rate = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
          }
          if (rate && rate > 0) return Number((amount * rate).toFixed(2))
          // Fallback to per-amount conversion if rate not available
          const { PapayaCurrencyProvider } = await import('@/lib/providers/papaya-currency-provider')
          const conv = new PapayaCurrencyProvider()
          const res = await conv.convertCurrency(amount, localCurrency, providerCurrency)
          const tgt = (res as any)?.data?.conversion_data?.target_amount
          return typeof tgt === 'number' && isFinite(tgt) ? Number(tgt.toFixed(2)) : amount
        } catch { return amount }
      }

      // Parse the LLM response to extract detailed enhancement items
      const deltaLocal = Math.max(0, Number(quote.total_monthly) - Number(quote.base_salary_monthly || 0))
      const delta = await convertLocalToProvider(deltaLocal)
      const items = Array.isArray(quote.items) ? quote.items : []
      const baseSalary = Number(input.baseQuote.baseCost || 0)
      const contractMonths = input.contractDurationMonths || 12
      const isStatutory = input.quoteType === 'statutory-only'

      // Build detailed enhancement objects from LLM response items
      const enhancements: any = {}
      const analysis = { provider_coverage: [], missing_requirements: [], double_counting_risks: [] }
      const terminationLLM: Array<{ monthlyAmount: number; name: string; notes?: string }> = []
      const pushUnique = (target: string[], message: string) => {
        if (!message) return
        if (!target.includes(message)) target.push(message)
      }

      const warnings: string[] = Array.isArray(parsed?.warnings) ? parsed.warnings : []

      let totalEnhancement = 0

      for (const item of items) {
        if (!item || typeof item !== 'object') continue

        const category = String(item.category || '').toLowerCase()
        const name = String(item.name || '').toLowerCase()
        const keyLower = String((item as any).key || '').toLowerCase()
        // Accept both monthly_amount (as per prompt schema) and monthly_amount_local (older)
        const monthlyLocal = Math.max(0, Number((item as any).monthly_amount ?? (item as any).monthly_amount_local ?? 0))
        const monthlyAmount = await convertLocalToProvider(monthlyLocal)
        if (monthlyAmount <= 0) continue

        // Map items to enhancement objects based on category and name
        const isSeverance = name.includes('severance') || keyLower.includes('severance')
        const isProbation = name.includes('probation') || keyLower.includes('probation')

        if (isSeverance || isProbation) {
          terminationLLM.push({
            monthlyAmount,
            name: item.name || 'Termination Provision',
            notes: item.notes
          })
          continue
        }

        if (category === 'termination' || name.includes('termination') || keyLower.includes('termination')) {
          // Skip generic termination items (e.g., notice provisions) to avoid displaying them
          continue
        } else if (name.includes('13th') || name.includes('thirteenth')) {
          enhancements.thirteenth_salary = {
            monthly_amount: monthlyAmount,
            yearly_amount: monthlyAmount * 12,
            explanation: item.notes || '13th month salary as required by law',
            confidence: 0.8,
            already_included: false
          }
          totalEnhancement += monthlyAmount
        } else if (name.includes('14th') || name.includes('fourteenth')) {
          enhancements.fourteenth_salary = {
            monthly_amount: monthlyAmount,
            yearly_amount: monthlyAmount * 12,
            explanation: item.notes || '14th month salary as required by law',
            confidence: 0.75,
            already_included: false
          }
          totalEnhancement += monthlyAmount
        } else if (name.includes('vacation') && category === 'bonuses') {
          enhancements.vacation_bonus = {
            amount: monthlyAmount * 12,
            explanation: item.notes || 'Vacation bonus as required by law',
            confidence: 0.7,
            already_included: false
          }
          totalEnhancement += monthlyAmount
        } else if (category === 'contributions' || name.includes('contribution') ||
                   name.toLowerCase().includes('authority') || name.toLowerCase().includes('ato') ||
                   name.toLowerCase().includes('workers') || name.toLowerCase().includes('superannuation') ||
                   name.toLowerCase().includes('payroll_tax') || name.toLowerCase().includes('state_revenue')) {
          // Use consolidated employer contributions processing
          const currentAmount = enhancements.employer_contributions_total?.monthly_amount || 0
          const contributionData = this.processEmployerContributions({
            source: 'item_aggregation',
            monthlyAmount: currentAmount + monthlyAmount,
            explanation: 'Employer contributions based on legal requirements'
          })

          if (contributionData) {
            enhancements.employer_contributions_total = {
              monthly_amount: contributionData.monthlyAmount,
              explanation: contributionData.explanation,
              confidence: contributionData.confidence,
              already_included: contributionData.alreadyIncluded
            }
            totalEnhancement += monthlyAmount
          }
        } else {
          // Dynamic country-aware benefit mapping instead of hardcoded patterns
          const countryCode = this.countryToCode(input.baseQuote.country)

          // Check for transportation allowance
          if (PapayaAvailability.shouldIncludeAllowanceType(countryCode, 'transportation') &&
              (name.includes('transport') || name.includes('commut') || name.includes('car'))) {
            if (!isStatutory || mandatory) {
              enhancements.transportation_allowance = {
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Transportation allowance',
                confidence: 0.65,
                already_included: false,
                mandatory: mandatory
              }
              totalEnhancement += monthlyAmount
            }
          }
          // Check for remote work allowance
          else if (PapayaAvailability.shouldIncludeAllowanceType(countryCode, 'remote_work') &&
                   ((name.includes('remote') && name.includes('work')) || name.includes('home') || name.includes('office'))) {
            if (!isStatutory || mandatory) {
              enhancements.remote_work_allowance = {
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Remote work allowance',
                confidence: 0.6,
                already_included: false,
                mandatory: mandatory
              }
              totalEnhancement += monthlyAmount
            }
          }
          // Check for meal allowance
          else if (PapayaAvailability.shouldIncludeAllowanceType(countryCode, 'meal') &&
                   (name.includes('meal') || name.includes('food') || name.includes('lunch') || name.includes('voucher'))) {
            if (!isStatutory || mandatory) {
              enhancements.meal_vouchers = {
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Meal voucher allowance',
                confidence: 0.6,
                already_included: false
              }
              totalEnhancement += monthlyAmount
            }
          }
          // Check for wellness/health allowance
          else if (PapayaAvailability.shouldIncludeAllowanceType(countryCode, 'wellness') &&
                   (name.includes('wellness') || name.includes('health') || name.includes('gym') || name.includes('fitness'))) {
            if (!isStatutory || mandatory) {
              enhancements.wellness_allowance = {
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Wellness allowance',
                confidence: 0.55,
                already_included: false,
                mandatory: mandatory
              }
              totalEnhancement += monthlyAmount
            }
          }
          // Check for phone/internet allowance
          else if (PapayaAvailability.shouldIncludeAllowanceType(countryCode, 'phone') &&
                   (name.includes('phone') || name.includes('internet') || name.includes('mobile') || name.includes('communication'))) {
            if (!isStatutory || mandatory) {
              enhancements.phone_allowance = {
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Phone and internet allowance',
                confidence: 0.55,
                already_included: false,
                mandatory: mandatory
              }
              totalEnhancement += monthlyAmount
            }
          }
          else if (
            PapayaAvailability.shouldIncludeAllowanceType(countryCode, 'health_insurance') &&
            (name.includes('insurance') || name.includes('healthcare') || name.includes('medical'))
          ) {
            if (!isStatutory || mandatory) {
              enhancements.health_insurance_allowance = {
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Private health insurance allowance',
                confidence: 0.55,
                already_included: false,
                mandatory: mandatory
              }
              totalEnhancement += monthlyAmount
            }
          }
          // Check for other common benefits dynamically
          else if (PapayaAvailability.getFlags(countryCode).common_benefits &&
                   (name.includes('allowance') || name.includes('benefit') || name.includes('voucher') || name.includes('insurance'))) {
            if (!isStatutory || mandatory) {
              enhancements.other_allowances = enhancements.other_allowances || []
              enhancements.other_allowances.push({
                name: item.name || 'Other allowance',
                monthly_amount: monthlyAmount,
                explanation: item.notes || 'Additional allowance',
                confidence: 0.5,
                already_included: false,
                mandatory: mandatory
              })
              totalEnhancement += monthlyAmount
            }
          }
        }
      }

      const countryRecord = getCountryByName(input.baseQuote.country)
      const countryCode = (countryRecord?.code || input.baseQuote.country || 'US').toString().toUpperCase()
      const countryName = countryRecord?.name || input.baseQuote.country
      const terminationComponents = this.computeTerminationComponents({
        countryCode,
        countryName,
        formData: input.formData,
        baseSalaryMonthly: baseSalary,
        contractMonths
      })

      const registerTerminationComponent = (
        key: 'severance_provision' | 'probation_provision',
        monthlyAmount: number,
        totalAmount: number,
        explanation: string,
        confidence: number
      ) => {
        const monthlyRounded = Number(monthlyAmount.toFixed(2))
        const totalRounded = Number(totalAmount.toFixed(2))
        if (monthlyRounded <= 0 && totalRounded <= 0) return
        enhancements[key] = {
          monthly_amount: monthlyRounded,
          total_amount: totalRounded,
          explanation,
          confidence,
          already_included: false
        }
        if (monthlyRounded > 0) {
          totalEnhancement += monthlyRounded
        }
        pushUnique(analysis.missing_requirements, key)
      }

      if (terminationComponents.totalMonthly > 0) {
        const confidence = terminationComponents.warnings.length ? 0.5 : 0.7
        const severanceExplanation = `Statutory severance provision required in ${countryName}`
        const probationExplanation = `Probation termination provision required in ${countryName}`

        const severanceMonthly = terminationComponents.severanceMonthly
        const probationMonthly = terminationComponents.probationMonthly

        const severanceTotal = Number((severanceMonthly * contractMonths).toFixed(2))
        const probationTotal = Number((probationMonthly * contractMonths).toFixed(2))

        registerTerminationComponent('severance_provision', severanceMonthly, severanceTotal, severanceExplanation, confidence)
        registerTerminationComponent('probation_provision', probationMonthly, probationTotal, probationExplanation, confidence)

        terminationComponents.warnings.forEach(warning => warnings.push(warning))
      } else if (terminationLLM.length > 0) {
        const combinedMonthly = terminationLLM.reduce((sum, entry) => sum + entry.monthlyAmount, 0)
        if (combinedMonthly > 0) {
          const combinedMonthlyRounded = Number(combinedMonthly.toFixed(2))
          totalEnhancement += combinedMonthlyRounded
          warnings.push('Termination breakdown unavailable from legal profile; using LLM termination provision output.')
        }
      }

      // If we couldn't parse detailed items, fall back to aggregate enhancement
      if (totalEnhancement === 0 && delta > 0) {
        const contributionData = this.processEmployerContributions({
          source: 'fallback',
          delta,
          explanation: 'Legal compliance enhancement (aggregate)',
          confidence: 0.5
        })

        if (contributionData) {
          enhancements.employer_contributions_total = {
            monthly_amount: contributionData.monthlyAmount,
            explanation: contributionData.explanation,
            confidence: contributionData.confidence,
            already_included: contributionData.alreadyIncluded
          }
          totalEnhancement = contributionData.monthlyAmount
        }
      }

      const groqLike: any = {
        analysis,
        enhancements,
        totals: {
          total_monthly_enhancement: Number(totalEnhancement.toFixed(2)),
          total_yearly_enhancement: Number((totalEnhancement * 12).toFixed(2)),
          final_monthly_total: Number((input.baseQuote.monthlyTotal + totalEnhancement).toFixed(2))
        },
        confidence_scores: {
          overall: Object.keys(enhancements).length > 0 ? 0.7 : 0.0,
          salary_enhancements: (enhancements.thirteenth_salary || enhancements.fourteenth_salary) ? 0.75 : 0.0,
          allowances: (enhancements.transportation_allowance || enhancements.remote_work_allowance || enhancements.meal_vouchers) ? 0.6 : 0.0
        },
        recommendations: [],
        warnings,
        // Keep all reported totals in provider currency to avoid mixing
        output_currency: providerCurrency,
        full_quote: quote,
        recalc_base_items: Array.isArray(parsed?.recalc_base_items) ? parsed.recalc_base_items : []
      }

      // Return compatible structure
      return this.deduplicateEnhancementResponse(groqLike, input.provider) as unknown as GroqEnhancementResponse

    } catch (error) {
      throw this.handleError(error, input.provider)
    }
  }

  /**
   * Enhancement using Cerebras pre-pass baseline + provider coverage.
   * Baseline amounts are converted to provider currency before prompting; Groq computes deltas and packaging.
   */
  async computeEnhancementsWithPrepass(input: {
    provider: ProviderType
    baseQuote: { provider: string; monthlyTotal: number; baseCost: number; currency: string; country: string; breakdown?: Record<string, number | undefined>; originalResponse?: unknown }
    quoteType: 'all-inclusive' | 'statutory-only'
    contractDurationMonths: number
    extractedBenefits: StandardizedBenefitData
    prepass: PrepassLegalProfile
  }): Promise<GroqEnhancementResponse> {
    await this.checkRateLimit()

    const providerCurrency = input.baseQuote.currency
    const isStatutory = input.quoteType === 'statutory-only'

    // Build provider coverage map (monthly)
    const prov = input.extractedBenefits?.includedBenefits || {}
    const monthlyOf = (x: any): number => {
      if (!x) return 0
      const amt = typeof x.amount === 'number' ? x.amount : 0
      const freq = (x.frequency || '').toLowerCase()
      return freq === 'yearly' ? amt / 12 : amt
    }
    const providerCoverage: Record<string, number> = {
      thirteenth_salary: monthlyOf((prov as any).thirteenthSalary),
      fourteenth_salary: monthlyOf((prov as any).fourteenthSalary),
      vacation_bonus: monthlyOf((prov as any).vacationBonus),
      transportation_allowance: monthlyOf((prov as any).transportAllowance),
      remote_work_allowance: monthlyOf((prov as any).remoteWorkAllowance),
      meal_vouchers: monthlyOf((prov as any).mealVouchers),
      social_security: monthlyOf((prov as any).socialSecurity),
      severance_provision: 0,
      probation_provision: 0
    }

    // Convert baseline items → provider currency and map to known keys
    const baselineProviderCurrency: Record<string, number> = {}
    const baselineMandatoryFlags: Record<string, boolean> = {}
    const localCurrency = input.prepass.meta.currency || providerCurrency
    let cachedConversionRate: number | null | undefined

    const getConversionRate = async (): Promise<number | null> => {
      if (localCurrency === providerCurrency) return 1
      if (cachedConversionRate !== undefined) return cachedConversionRate

      try {
        const { PapayaCurrencyProvider } = await import('@/lib/providers/papaya-currency-provider')
        const conv = new PapayaCurrencyProvider()
        const res = await conv.convertCurrency(1, localCurrency, providerCurrency)

        if (res.success && res.data?.conversion_data) {
          const rateString = res.data.conversion_data.exchange_rate
          const rateFromTarget = res.data.conversion_data.target_amount
          const parsedRate = Number.parseFloat(typeof rateString === 'string' ? rateString : '')
          const candidate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : Number(rateFromTarget)
          if (Number.isFinite(candidate) && candidate > 0) {
            cachedConversionRate = candidate
            return cachedConversionRate
          }
        }
      } catch {
        // fall through to mark failure below
      }

      cachedConversionRate = null
      return cachedConversionRate
    }

    const convertAmount = async (amount: number): Promise<number> => {
      if (!amount) return 0
      const rate = await getConversionRate()
      if (rate === null) return amount
      if (rate === 1) return amount
      return Number((amount * rate).toFixed(2))
    }
    const items = Array.isArray(input.prepass.items) ? input.prepass.items : []
    for (const item of items) {
      const localMonthly = typeof item.monthly_amount_local === 'number' ? item.monthly_amount_local : Number(item.monthly_amount_local || 0)
      const providerMonthly = await convertAmount(localMonthly)
      // Map to known keys
      const key = item.key || ''
      const lowerKey = key.toLowerCase()
      const component = (typeof (item as any).component === 'string' ? (item as any).component : '').toLowerCase()
      const mapKey = (() => {
        if (lowerKey.includes('13') || key === 'thirteenth_salary') return 'thirteenth_salary'
        if (lowerKey.includes('14') || key === 'fourteenth_salary') return 'fourteenth_salary'
        if (lowerKey.includes('vacation') && item.category === 'bonuses') return 'vacation_bonus'
        if (lowerKey.includes('transport')) return 'transportation_allowance'
        if (lowerKey.includes('remote')) return 'remote_work_allowance'
        if (lowerKey.includes('meal')) return 'meal_vouchers'
        if (component === 'severance') return 'severance_provision'
        if (component === 'probation') return 'probation_provision'
        // Authority payments (ATO, Workers comp, Superannuation, state taxes, etc.)
        if (lowerKey.includes('authority') || key.includes('ATO') || key.includes('ato') ||
            lowerKey.includes('workers') || lowerKey.includes('compensation') || lowerKey.includes('superannuation') ||
            lowerKey.includes('payroll_tax') || lowerKey.includes('state_revenue') || item.name?.toLowerCase().includes('authority')) return 'employer_contributions_total'
        if (item.category === 'contributions') return 'employer_contributions_total'
        return ''
      })()
      if (!mapKey) continue
      // Aggregate where appropriate
      if (mapKey === 'employer_contributions_total') {
        baselineProviderCurrency[mapKey] = (baselineProviderCurrency[mapKey] || 0) + (providerMonthly || 0)
      } else if (mapKey === 'vacation_bonus') {
        // store monthly equivalent for uniformity
        baselineProviderCurrency[mapKey] = (baselineProviderCurrency[mapKey] || 0) + (providerMonthly || 0)
      } else {
        baselineProviderCurrency[mapKey] = (baselineProviderCurrency[mapKey] || 0) + (providerMonthly || 0)
      }
      baselineMandatoryFlags[mapKey] = !!item.mandatory
    }

    const prepassCountryCode = (input.prepass?.meta?.country_code || '').toString().trim().toUpperCase()
    const fallbackCountryCode = this.countryToCode(input.baseQuote.country)
    const resolvedCountryCode = (prepassCountryCode || fallbackCountryCode || 'US').toUpperCase()

    // Gate baseline with deterministic legal requirements to avoid LLM pre-pass false positives (e.g., "customary" 13th salary)
    try {
      const core = PapayaService.getCountryCoreData(resolvedCountryCode)
      const legal = PapayaService.extractLegalRequirementsFromCore(core as any)
      if (legal && legal.mandatorySalaries) {
        const isAllInclusive = (input.quoteType === 'all-inclusive')
        const presence = (input.prepass?.availability as any) || {}
        const baseMonthlyFromPrepass = Math.max(0, Number((input.prepass?.meta as any)?.base_salary_monthly || 0))
        const baseMonthlyFromQuote = Math.max(0, Number(input.baseQuote.baseCost || 0))
        const baseMonthly = baseMonthlyFromPrepass || baseMonthlyFromQuote

        // Statutory-only: keep only mandatory salaries
        if (input.quoteType === 'statutory-only') {
          if (!legal.mandatorySalaries.has13thSalary) {
            baselineProviderCurrency['thirteenth_salary'] = 0
            baselineMandatoryFlags['thirteenth_salary'] = false
          }
          if (!legal.mandatorySalaries.has14thSalary) {
            baselineProviderCurrency['fourteenth_salary'] = 0
            baselineMandatoryFlags['fourteenth_salary'] = false
          }
        } else if (isAllInclusive) {
          // All-inclusive: include if legally mandatory OR presence flag true
          if (presence.payroll_13th_salary && !baselineProviderCurrency['thirteenth_salary']) {
            baselineProviderCurrency['thirteenth_salary'] = Number((baseMonthly / 12).toFixed(2))
            baselineMandatoryFlags['thirteenth_salary'] = !!legal.mandatorySalaries.has13thSalary // mark true only if mandatory
          }
          if (legal.mandatorySalaries.has13thSalary && !baselineProviderCurrency['thirteenth_salary']) {
            baselineProviderCurrency['thirteenth_salary'] = Number((baseMonthly / 12).toFixed(2))
            baselineMandatoryFlags['thirteenth_salary'] = true
          }
          if (presence.payroll_14th_salary && !baselineProviderCurrency['fourteenth_salary']) {
            baselineProviderCurrency['fourteenth_salary'] = Number((baseMonthly / 12).toFixed(2))
            baselineMandatoryFlags['fourteenth_salary'] = !!legal.mandatorySalaries.has14thSalary
          }
          if (legal.mandatorySalaries.has14thSalary && !baselineProviderCurrency['fourteenth_salary']) {
            baselineProviderCurrency['fourteenth_salary'] = Number((baseMonthly / 12).toFixed(2))
            baselineMandatoryFlags['fourteenth_salary'] = true
          }
        }

        // Termination fallback: if baseline lacks termination monthly, derive from legal hints
        try {
          const terminationHints = this.computeTerminationComponents({
            countryCode: resolvedCountryCode,
            countryName: input.baseQuote.country,
            baseSalaryMonthly: baseMonthly,
            contractMonths: input.contractDurationMonths || 12
          })
          if (!baselineProviderCurrency['severance_provision'] && terminationHints.severanceMonthly > 0) {
            baselineProviderCurrency['severance_provision'] = terminationHints.severanceMonthly
            baselineMandatoryFlags['severance_provision'] = true
          }
          if (!baselineProviderCurrency['probation_provision'] && terminationHints.probationMonthly > 0) {
            baselineProviderCurrency['probation_provision'] = terminationHints.probationMonthly
            baselineMandatoryFlags['probation_provision'] = false
          }
        } catch { /* noop */ }
      }
    } catch {/* noop */}

    const baselineTermination = this.computeTerminationComponents({
      countryCode: resolvedCountryCode,
      countryName: input.baseQuote.country,
      baseSalaryMonthly: Math.max(0, Number(input.baseQuote.baseCost || 0)),
      contractMonths: input.contractDurationMonths || 12
    })

    if (!baselineProviderCurrency['severance_provision'] && baselineTermination.severanceMonthly > 0) {
      baselineProviderCurrency['severance_provision'] = baselineTermination.severanceMonthly
      baselineMandatoryFlags['severance_provision'] = true
    }
    if (!baselineProviderCurrency['probation_provision'] && baselineTermination.probationMonthly > 0) {
      baselineProviderCurrency['probation_provision'] = baselineTermination.probationMonthly
      baselineMandatoryFlags['probation_provision'] = false
    }

    const terminationKeys = ['severance_provision', 'probation_provision'] as const
    const terminationSum = Number(terminationKeys.reduce((sum, key) => sum + (baselineProviderCurrency[key] || 0), 0).toFixed(2))

    // In statutory-only mode, zero-out non-mandatory allowances from baseline
    if (isStatutory) {
      const optionalAllowanceKeys = ['transportation_allowance', 'remote_work_allowance', 'meal_vouchers']
      for (const k of optionalAllowanceKeys) {
        if (!baselineMandatoryFlags[k]) baselineProviderCurrency[k] = 0
      }
    }

    // Build prompts
    let systemPrompt = PromptEngine.buildPrepassSystemPrompt()
    let userPrompt = PromptEngine.buildPrepassUserPrompt({
      provider: input.provider,
      currency: providerCurrency,
      quoteType: input.quoteType,
      contractMonths: input.contractDurationMonths,
      baseMonthly: input.baseQuote.monthlyTotal,
      baselineProviderCurrency,
      baselineMandatoryFlags,
      providerCoverage
    })
    try {
      const compact = (s: string) => s.replace(/\s+/g, ' ').trim()
      systemPrompt = compact(systemPrompt)
      userPrompt = compact(userPrompt)
    } catch { /* noop */ }

    

    const client = this.getProviderClient(input.provider)
    try {
      const response = await this.requestWithRetry((opts) => client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [],
        tool_choice: 'none',
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: 'json_object' }
      }, { signal: opts?.signal }))

      this.updateRateLimiter((response as ChatCompletion).usage?.total_tokens || 0)

     

      const content = (response as ChatCompletion).choices?.[0]?.message?.content
      if (content) {
        const jsonText = this.extractJson(content)
        const parsed = JSON.parse(jsonText)
        // Minimal shape safeguard
        if (parsed && parsed.enhancements && parsed.totals) {
          // Inject default confidence scores if LLM omitted them
          try {
            const cs = (parsed as any).confidence_scores || {}
            ;(parsed as any).confidence_scores = {
              overall: typeof cs.overall === 'number' ? cs.overall : 0.7,
              salary_enhancements: typeof cs.salary_enhancements === 'number' ? cs.salary_enhancements : 0.7,
              allowances: typeof cs.allowances === 'number' ? cs.allowances : 0.6
            }
          } catch { /* noop */ }
          // Ensure employer contributions delta is present deterministically if LLM omitted it
          try {
            const baselineContrib = Math.max(0, Number(baselineProviderCurrency['employer_contributions_total'] || 0))
            const providerContrib = Math.max(0, Number(providerCoverage['social_security'] || 0))
            const hasContrib = parsed.enhancements && (parsed.enhancements as any).employer_contributions_total && typeof (parsed.enhancements as any).employer_contributions_total.monthly_amount === 'number' && (parsed.enhancements as any).employer_contributions_total.monthly_amount > 0

            if (!hasContrib && baselineContrib > 0) {
              const contributionData = this.processEmployerContributions({
                source: 'deterministic_delta',
                baselineAmount: baselineContrib,
                providerAmount: providerContrib,
                explanation: 'Deterministic employer contributions delta (baseline minus provider coverage)'
              })

              if (contributionData) {
                ;(parsed.enhancements as any).employer_contributions_total = {
                  monthly_amount: contributionData.monthlyAmount,
                  explanation: contributionData.explanation,
                  confidence: contributionData.confidence,
                  already_included: contributionData.alreadyIncluded
                }

                // Adjust totals conservatively by adding the missing delta
                if (parsed.totals && typeof parsed.totals.total_monthly_enhancement === 'number') {
                  parsed.totals.total_monthly_enhancement = Number((parsed.totals.total_monthly_enhancement + contributionData.monthlyAmount).toFixed(2))
                  parsed.totals.total_yearly_enhancement = Number((parsed.totals.total_monthly_enhancement * 12).toFixed(2))
                  parsed.totals.final_monthly_total = Number((input.baseQuote.monthlyTotal + parsed.totals.total_monthly_enhancement).toFixed(2))
                }
              }
            }
          } catch {/* noop */}
          return this.deduplicateEnhancementResponse(parsed, input.provider) as GroqEnhancementResponse
        }
      }
      // Fallback to deterministic delta compute
      return await this.computeDeltasFallback(baselineProviderCurrency, baselineMandatoryFlags, providerCoverage, input.baseQuote.monthlyTotal)
    } catch (error) {
      // Fallback deterministic
      return await this.computeDeltasFallback(baselineProviderCurrency, baselineMandatoryFlags, providerCoverage, input.baseQuote.monthlyTotal)
    }
  }

  private countryToCode(country: string): string {
    try {
      const c = getCountryByName(country)
      if (c?.code) return c.code.toUpperCase()
    } catch { /* noop */ }
    const fallback = (country || '').toUpperCase().trim()
    // Accept already-ISO2 fallback if user provided that
    if (fallback.length === 2) return fallback
    // Minimal heuristics for a few common names
    const map: Record<string, string> = {
      'UNITED STATES': 'US', 'USA': 'US', 'UNITED KINGDOM': 'GB', 'UK': 'GB',
      'GERMANY': 'DE', 'FRANCE': 'FR', 'SPAIN': 'ES', 'ITALY': 'IT', 'NETHERLANDS': 'NL',
      'BRAZIL': 'BR', 'ARGENTINA': 'AR', 'COLOMBIA': 'CO', 'MEXICO': 'MX', 'CHILE': 'CL', 'PERU': 'PE'
    }
    return map[fallback] || fallback.slice(0, 2)
  }

  private async computeDeltasFallback(
    baseline: Record<string, number>,
    mandatory: Record<string, boolean>,
    coverage: Record<string, number>,
    baseMonthly: number
  ): Promise<GroqEnhancementResponse> {
    const get = (k: string) => Math.max(0, Number(baseline[k] || 0))
    const cov = (k: string) => Math.max(0, Number(coverage[k] || 0))
    const delta = (k: string) => Math.max(0, get(k) - cov(k))

    const d_th13 = delta('thirteenth_salary')
    const d_th14 = delta('fourteenth_salary')
    const d_vac = delta('vacation_bonus')
    const d_trans = delta('transportation_allowance')
    const d_remote = delta('remote_work_allowance')
    const d_meal = delta('meal_vouchers')
    const d_contrib = delta('employer_contributions_total')
    const d_term_severance = delta('severance_provision')
    const d_term_probation = delta('probation_provision')
    const d_term_total = d_term_severance + d_term_probation

    const total = Number((d_th13 + d_th14 + d_vac + d_trans + d_remote + d_meal + d_contrib + d_term_total).toFixed(2))

    const enhancements: any = {}
    if (d_term_severance > 0 || d_term_probation > 0) {
      if (d_term_severance > 0) {
        enhancements.severance_provision = {
          monthly_amount: Number(d_term_severance.toFixed(2)),
          total_amount: Number((d_term_severance * 12).toFixed(2)),
          explanation: 'Severance provision delta',
          confidence: 0.7,
          already_included: false
        }
      }
      if (d_term_probation > 0) {
        enhancements.probation_provision = {
          monthly_amount: Number(d_term_probation.toFixed(2)),
          total_amount: Number((d_term_probation * 12).toFixed(2)),
          explanation: 'Probation termination provision delta',
          confidence: 0.6,
          already_included: false
        }
      }
    }
    if (get('thirteenth_salary') > 0) enhancements.thirteenth_salary = { monthly_amount: d_th13, yearly_amount: Number((d_th13 * 12).toFixed(2)), explanation: '13th salary delta', confidence: 0.75, already_included: d_th13 === 0 }
    if (get('fourteenth_salary') > 0) enhancements.fourteenth_salary = { monthly_amount: d_th14, yearly_amount: Number((d_th14 * 12).toFixed(2)), explanation: '14th salary delta', confidence: 0.7, already_included: d_th14 === 0 }
    if (get('vacation_bonus') > 0) enhancements.vacation_bonus = { amount: Number((d_vac * 12).toFixed(2)), explanation: 'Vacation bonus delta', confidence: 0.6, already_included: d_vac === 0 }
    if (get('transportation_allowance') > 0) enhancements.transportation_allowance = { monthly_amount: d_trans, explanation: 'Transportation allowance delta', confidence: 0.6, already_included: d_trans === 0, mandatory: !!mandatory['transportation_allowance'] }
    if (get('remote_work_allowance') > 0) enhancements.remote_work_allowance = { monthly_amount: d_remote, explanation: 'Remote work allowance delta', confidence: 0.6, already_included: d_remote === 0, mandatory: !!mandatory['remote_work_allowance'] }
    if (get('meal_vouchers') > 0) enhancements.meal_vouchers = { monthly_amount: d_meal, explanation: 'Meal vouchers delta', confidence: 0.6, already_included: d_meal === 0 }
    if (get('employer_contributions_total') > 0) {
      const contributionData = this.processEmployerContributions({
        source: 'direct_computation',
        delta: d_contrib,
        explanation: 'Employer contributions delta'
      })

      if (contributionData) {
        enhancements.employer_contributions_total = {
          monthly_amount: contributionData.monthlyAmount,
          explanation: contributionData.explanation,
          confidence: contributionData.confidence,
          already_included: contributionData.alreadyIncluded
        }
      }
    }

    return {
      analysis: { provider_coverage: [], missing_requirements: [], double_counting_risks: [] },
      enhancements,
      totals: {
        total_monthly_enhancement: total,
        total_yearly_enhancement: Number((total * 12).toFixed(2)),
        final_monthly_total: Number((baseMonthly + total).toFixed(2))
      },
      confidence_scores: { overall: 0.7, salary_enhancements: (get('thirteenth_salary') + get('fourteenth_salary') + get('vacation_bonus')) > 0 ? 0.7 : 0.0, allowances: (get('transportation_allowance') + get('remote_work_allowance') + get('meal_vouchers')) > 0 ? 0.6 : 0.0 },
      recommendations: [],
      warnings: []
    }
  }

  /**
   * Reconcile Papaya legal baseline (LLM result) with provider coverage to compute missing deltas.
   */
  private reconcileBaselineWithProvider(
    baseline: any,
    params: {
      baseQuote: { provider: string; monthlyTotal: number; baseCost: number; currency: string; country: string; breakdown?: Record<string, number | undefined> }
      quoteType: 'all-inclusive' | 'statutory-only'
      contractMonths: number
      extractedBenefits: StandardizedBenefitData
    }
  ): GroqEnhancementResponse {
    const b = baseline?.enhancements?.baseline || {}
    const warnings: string[] = Array.isArray(baseline?.warnings) ? baseline.warnings : []

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

    // Provider coverage map (monthly)
    const providerCoverage = {
      thirteenth_salary: monthlyOf((prov as any).thirteenthSalary),
      fourteenth_salary: monthlyOf((prov as any).fourteenthSalary),
      vacation_bonus: monthlyOf((prov as any).vacationBonus),
      transportation_allowance: monthlyOf((prov as any).transportAllowance),
      remote_work_allowance: monthlyOf((prov as any).remoteWorkAllowance),
      meal_vouchers: monthlyOf((prov as any).mealVouchers),
      social_security: monthlyOf((prov as any).socialSecurity),
      severance_provision: 0,
      probation_provision: 0
    }

    // Contributions coverage: prefer normalized breakdown aggregate if available
    const providerContribAggregate = getNum(params.baseQuote.breakdown?.statutoryContributions) || providerCoverage.social_security || 0

    const contractMonths = Math.max(1, params.contractMonths || 12)

    const terminationBaseline = this.computeTerminationComponents({
      countryCode: this.countryToCode(params.baseQuote.country),
      countryName: params.baseQuote.country,
      baseSalaryMonthly: Math.max(0, Number(params.baseQuote.baseCost || 0)),
      contractMonths: params.contractMonths
    })
    terminationBaseline.warnings.forEach(w => warnings.push(w))

    // Baseline amounts
    const base_th13 = getNum(b?.thirteenth_salary?.monthly_amount)
    const base_th14 = getNum(b?.fourteenth_salary?.monthly_amount)
    const base_vac = getNum(b?.vacation_bonus?.monthly_amount)
    const base_trans = getNum(b?.transportation_allowance?.monthly_amount)
    const base_trans_mand = !!b?.transportation_allowance?.mandatory
    const base_remote = getNum(b?.remote_work_allowance?.monthly_amount)
    const base_remote_mand = !!b?.remote_work_allowance?.mandatory
    const base_meal = getNum(b?.meal_vouchers?.monthly_amount)
    const base_contrib_total = getNum(b?.contributions?.total_monthly)
    const base_term_severance = getNum(b?.termination?.severance_cost ?? terminationBaseline.severanceMonthly)
    const base_term_probation = getNum(b?.termination?.probation_cost ?? terminationBaseline.probationMonthly)
    const base_term_monthly = base_term_severance + base_term_probation
    const base_term_total = Number((base_term_monthly * contractMonths).toFixed(2))

    const isStatutory = params.quoteType === 'statutory-only'

    // Delta helpers
    const topUp = (baselineAmt: number, providerAmt: number) => Math.max(0, baselineAmt - providerAmt)
    const includeIf = (include: boolean, amt: number) => (include ? amt : 0)

    // Compute deltas
    const delta_th13 = topUp(base_th13, providerCoverage.thirteenth_salary)
    const delta_th14 = topUp(base_th14, providerCoverage.fourteenth_salary)
    const delta_vac = topUp(base_vac, providerCoverage.vacation_bonus)
    const allow_trans = isStatutory ? base_trans_mand : true
    const allow_remote = isStatutory ? base_remote_mand : true
    const delta_trans = topUp(includeIf(allow_trans, base_trans), providerCoverage.transportation_allowance)
    const delta_remote = topUp(includeIf(allow_remote, base_remote), providerCoverage.remote_work_allowance)
    const delta_meal = topUp(isStatutory ? 0 : base_meal, providerCoverage.meal_vouchers)
    const delta_contrib = topUp(base_contrib_total, providerContribAggregate)
    const delta_term_severance = topUp(base_term_severance, providerCoverage.severance_provision)
    const delta_term_probation = topUp(base_term_probation, providerCoverage.probation_provision)
    const delta_term_monthly = delta_term_severance + delta_term_probation

    // Build enhancements block (deltas as monthly amounts; termination as total for later monthlyization)
    const enhancements: GroqEnhancementResponse['enhancements'] = {}
    const terminationConfidence = terminationBaseline.warnings.length > 0 ? 0.5 : 0.7
    if (delta_term_severance > 0) {
      enhancements.severance_provision = {
        monthly_amount: Number(delta_term_severance.toFixed(2)),
        total_amount: Number((delta_term_severance * contractMonths).toFixed(2)),
        explanation: 'Severance provision based on legal baseline',
        confidence: terminationConfidence,
        already_included: false
      }
    }
    if (delta_term_probation > 0) {
      enhancements.probation_provision = {
        monthly_amount: Number(delta_term_probation.toFixed(2)),
        total_amount: Number((delta_term_probation * contractMonths).toFixed(2)),
        explanation: 'Probation termination provision based on legal baseline',
        confidence: terminationConfidence,
        already_included: false
      }
    }
    if (base_th13 > 0) {
      enhancements.thirteenth_salary = {
        monthly_amount: delta_th13,
        yearly_amount: delta_th13 * 12,
        explanation: 'Papaya baseline vs provider coverage',
        confidence: 0.75,
        already_included: delta_th13 === 0
      }
    }
    if (base_th14 > 0) {
      enhancements.fourteenth_salary = {
        monthly_amount: delta_th14,
        yearly_amount: delta_th14 * 12,
        explanation: 'Papaya baseline vs provider coverage',
        confidence: 0.7,
        already_included: delta_th14 === 0
      }
    }
    if (base_vac > 0) {
      enhancements.vacation_bonus = {
        amount: delta_vac * 12, // baseline likely yearly; we store as yearly per existing type
        explanation: 'Papaya baseline vs provider coverage',
        confidence: 0.7,
        already_included: delta_vac === 0
      }
    }
    if (includeIf(allow_trans, base_trans) > 0) {
      enhancements.transportation_allowance = {
        monthly_amount: delta_trans,
        explanation: 'Papaya baseline vs provider coverage',
        confidence: 0.65,
        already_included: delta_trans === 0,
        mandatory: !!base_trans_mand
      }
    }
    if (includeIf(allow_remote, base_remote) > 0) {
      enhancements.remote_work_allowance = {
        monthly_amount: delta_remote,
        explanation: 'Papaya baseline vs provider coverage',
        confidence: 0.6,
        already_included: delta_remote === 0,
        mandatory: !!base_remote_mand
      }
    }
    if (!isStatutory && base_meal > 0) {
      enhancements.meal_vouchers = {
        monthly_amount: delta_meal,
        explanation: 'Papaya baseline vs provider coverage',
        confidence: 0.6,
        already_included: delta_meal === 0
      }
    }
    if (base_contrib_total > 0) {
      const contributionData = this.processEmployerContributions({
        source: 'papaya_baseline',
        delta: delta_contrib,
        explanation: 'Papaya baseline vs provider aggregate/per-item contributions'
      })

      if (contributionData) {
        ;(enhancements as any).employer_contributions_total = {
          monthly_amount: contributionData.monthlyAmount,
          explanation: contributionData.explanation,
          confidence: contributionData.confidence,
          already_included: contributionData.alreadyIncluded
        }
      }
    }

    // Aggregate analysis
    const providerCoverageStrings: string[] = []
    Object.entries(providerCoverage).forEach(([k, v]) => {
      if (v > 0) providerCoverageStrings.push(`${k}: ${v.toFixed(2)} ${params.baseQuote.currency}`)
    })
    const missingReq: string[] = []
    if (delta_th13 > 0) missingReq.push('thirteenth_salary')
    if (delta_th14 > 0) missingReq.push('fourteenth_salary')
    if (delta_vac > 0) missingReq.push('vacation_bonus')
    if (delta_trans > 0) missingReq.push('transportation_allowance')
    if (delta_remote > 0) missingReq.push('remote_work_allowance')
    if (delta_meal > 0) missingReq.push('meal_vouchers')
    if (delta_contrib > 0) missingReq.push('employer_contributions')
    if (delta_term_severance > 0) missingReq.push('severance_provision')
    if (delta_term_probation > 0) missingReq.push('probation_provision')

    const doubleCountingRisks: string[] = []
    if (providerCoverage.social_security > 0 && (params.baseQuote.breakdown?.statutoryContributions || 0) > 0) {
      doubleCountingRisks.push('Provider shows both aggregate and per-item contributions; avoid double counting')
    }

    const totalMonthlyEnhancement = [
      delta_th13,
      delta_th14,
      delta_vac,
      delta_trans,
      delta_remote,
      delta_meal,
      delta_contrib,
      delta_term_severance,
      delta_term_probation
    ].reduce((s, n) => s + (isFinite(n) ? n : 0), 0)

    const response: GroqEnhancementResponse = {
      analysis: {
        provider_coverage: providerCoverageStrings,
        missing_requirements: missingReq,
        double_counting_risks: doubleCountingRisks
      },
      enhancements,
      totals: {
        total_monthly_enhancement: Number(totalMonthlyEnhancement.toFixed(2)),
        total_yearly_enhancement: Number((totalMonthlyEnhancement * 12).toFixed(2)),
        final_monthly_total: Number((params.baseQuote.monthlyTotal + totalMonthlyEnhancement).toFixed(2))
      },
      confidence_scores: {
        overall: warnings.length > 0 ? 0.6 : 0.8,
        salary_enhancements: (base_th13 + base_th14 + base_vac) > 0 ? 0.75 : 0.0,
        allowances: (base_trans + base_remote + base_meal) > 0 ? 0.6 : 0.0
      },
      recommendations: [],
      warnings
    }

    return response
  }

  /**
   * Summarize Papaya data for prompt
   */
  private summarizePapayaData(papayaData: unknown): string {
    const summary = []
    
    // Type guard to check if papayaData has expected structure
    const data = papayaData as { data?: {
      termination?: { notice_period?: string; severance_pay?: string };
      payroll?: { payroll_cycle?: string };
      contribution?: { employer_contributions?: Array<{ description?: string; rate?: string }> };
      authority_payments?: Array<{ authority_payment?: string; dates?: string; methods?: string }>;
    }}
    
    if (data?.data?.termination) {
      summary.push(`TERMINATION: ${data.data.termination.severance_pay || 'N/A'} severance requirement`)
    }
    
    if (data?.data?.payroll?.payroll_cycle) {
      summary.push(`PAYROLL: ${data.data.payroll.payroll_cycle}`)
    }
    
    if (data?.data?.contribution?.employer_contributions) {
      const contribs = data.data.contribution.employer_contributions
        .slice(0, 5)
        .map((c: { description?: string; rate?: string }) => `${c.description}: ${c.rate}`)
        .join(', ')
      summary.push(`CONTRIBUTIONS: ${contribs}`)
    }

    if (data?.data?.authority_payments) {
      const authorities = data.data.authority_payments
        .slice(0, 5)
        .map((ap: { authority_payment?: string; dates?: string; methods?: string }) =>
          `${ap.authority_payment || 'Unknown Authority'}: ${ap.dates || 'Schedule not specified'}`)
        .join(', ')
      summary.push(`AUTHORITY_PAYMENTS: ${authorities}`)
    }

    return summary.join('\n') || 'No detailed legal data available'
  }

  /**
   * Parse and validate Groq response
   */
  private parseResponse(content: string): GroqEnhancementResponse {
    try {
      const parsed = JSON.parse(content)
      
      // Ensure required structure exists
      const response: GroqEnhancementResponse = {
        analysis: parsed.analysis || {
          provider_coverage: [],
          missing_requirements: [],
          double_counting_risks: []
        },
        enhancements: parsed.enhancements || {},
        totals: parsed.totals || {
          total_monthly_enhancement: 0,
          total_yearly_enhancement: 0,
          final_monthly_total: 0
        },
        confidence_scores: {
          overall: 0.7,
          salary_enhancements: 0.7,
          allowances: 0.6
        },
        recommendations: parsed.recommendations || [],
        warnings: parsed.warnings || []
      }

      // Validate via Zod schema (lenient optional fields)
      const schema = z.object({
        analysis: z.object({
          provider_coverage: z.array(z.string()).default([]),
          missing_requirements: z.array(z.string()).default([]),
          double_counting_risks: z.array(z.string()).default([])
        }),
        enhancements: z.record(z.any()).default({}),
        totals: z.object({
          total_monthly_enhancement: z.number().nonnegative().default(0),
          total_yearly_enhancement: z.number().nonnegative().default(0),
          final_monthly_total: z.number().nonnegative().default(0)
        }),
        confidence_scores: z.object({
          overall: z.number().min(0).max(1).default(0.7),
          salary_enhancements: z.number().min(0).max(1).default(0.7),
          allowances: z.number().min(0).max(1).default(0.6)
        }).optional(),
        recommendations: z.array(z.string()).default([]),
        warnings: z.array(z.string()).default([])
      })

      const safe = schema.safeParse(response)
      if (!safe.success) {
        throw new Error(`Schema validation failed: ${safe.error.message}`)
      }

      return safe.data as GroqEnhancementResponse

    } catch (error) {
      throw new Error(`Failed to parse Groq response: ${error}`)
    }
  }

  /**
   * Parse and validate Groq extraction response
   */
  private parseExtractionResponse(content: string, provider: ProviderType): StandardizedBenefitData {
    try {
      const parsed = JSON.parse(content)
      
      // Ensure required structure exists with defaults
      const response: StandardizedBenefitData = {
        provider: parsed.provider || provider,
        baseSalary: parsed.baseSalary || 0,
        currency: parsed.currency || 'USD',
        country: parsed.country || 'Unknown',
        monthlyTotal: parsed.monthlyTotal || 0,
        includedBenefits: parsed.includedBenefits || {},
        totalMonthlyBenefits: parsed.totalMonthlyBenefits || 0,
        extractionConfidence: parsed.extractionConfidence || 0.5,
        extractedAt: parsed.extractedAt || new Date().toISOString()
      }

      return response

    } catch (error) {
      throw new Error(`Failed to parse Groq extraction response: ${error}`)
    }
  }

  /**
   * Validate extraction response structure and content
   */
  private validateExtractionResponse(response: StandardizedBenefitData): void {
    // Check required fields
    if (!response.provider || !response.currency || !response.country) {
      throw new Error('Invalid extraction response structure')
    }

    // Validate monetary amounts
    if (response.baseSalary < 0 || response.monthlyTotal < 0 || response.totalMonthlyBenefits < 0) {
      throw new Error('Invalid monetary amounts in extraction response')
    }

    // Validate confidence score
    if (response.extractionConfidence < 0 || response.extractionConfidence > 1) {
      console.warn(`Invalid extraction confidence score: ${response.extractionConfidence}`)
      response.extractionConfidence = Math.max(0, Math.min(1, response.extractionConfidence))
    }

    // Validate benefit amounts
    if (response.includedBenefits) {
      Object.values(response.includedBenefits).forEach(benefit => {
        if (benefit && benefit.amount < 0) {
          console.warn(`Invalid benefit amount: ${benefit.amount}`)
        }
      })
    }
  }

  /**
   * Validate response structure and content
   */
  private validateResponse(response: GroqEnhancementResponse): void {
    // Check required fields
    if (!response.analysis || !response.enhancements || !response.totals) {
      throw new Error('Invalid response structure from Groq')
    }

    // Confidence scores are now set to defaults (no longer parsed from LLM)

    // Validate monetary amounts
    const { totals } = response
    if (totals.total_monthly_enhancement < 0 || totals.final_monthly_total < 0) {
      throw new Error('Invalid monetary amounts in response')
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: EnhancementInput): void {
    if (!input.provider || !input.providerQuote || !input.formData) {
      throw new Error('Missing required input parameters')
    }

    if (!input.providerQuote.currency || !input.providerQuote.country) {
      throw new Error('Invalid provider quote structure')
    }
  }

  /**
   * Rate limiting implementation
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now()
    const oneMinute = 60 * 1000

    // Reset counters if a minute has passed
    if (now - this.rateLimiter.lastRequestTime > oneMinute) {
      this.rateLimiter.requestCount = 0
      this.rateLimiter.tokenCount = 0
      this.rateLimiter.lastRequestTime = now
    }

    // Check request rate limit
    if (this.rateLimiter.requestCount >= this.rateLimiter.requestsPerMinute) {
      const waitTime = oneMinute - (now - this.rateLimiter.lastRequestTime)
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`)
    }

    // Approximate tokens for upcoming request (use configured max)
    const projectedTokens = Math.max(256, Math.min(this.config.maxTokens, 2048))
    if ((this.rateLimiter.tokenCount + projectedTokens) > this.rateLimiter.tokensPerMinute) {
      const waitTime = oneMinute - (now - this.rateLimiter.lastRequestTime)
      // Sleep until window resets to avoid immediate failure
      await new Promise(res => setTimeout(res, Math.max(waitTime, 250)))
      // Reset window
      this.rateLimiter.requestCount = 0
      this.rateLimiter.tokenCount = 0
      this.rateLimiter.lastRequestTime = Date.now()
    }

    this.rateLimiter.requestCount++
  }

  /**
   * Update rate limiter after successful request
   */
  private updateRateLimiter(tokensUsed: number): void {
    this.rateLimiter.tokenCount += tokensUsed
  }


  /**
   * Extract JSON object from LLM text (handles code fences/explanations)
   */
  private extractJson(text: string): string {
    const trimmed = text.trim()
    // If content already looks like JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

    // Remove code fences if present
    const fenceMatch = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/i)
    if (fenceMatch) {
      const inner = fenceMatch[1].trim()
      if (inner.startsWith('{')) return inner
    }

    // Fallback: find first JSON object substring
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1)
    }

    // Give up – return original (will fail parse and be handled by caller)
    return trimmed
  }

  /**
   * Consolidated employer contributions processing
   * Prevents multiple code paths from creating duplicate employer_contributions_total
   */
  private processEmployerContributions(context: {
    source: EmployerContributionData['source']
    monthlyAmount?: number
    baselineAmount?: number
    providerAmount?: number
    delta?: number
    explanation?: string
    confidence?: number
    alreadyIncluded?: boolean
  }): EmployerContributionData | null {
    const {
      source,
      monthlyAmount = 0,
      baselineAmount = 0,
      providerAmount = 0,
      delta = 0,
      explanation,
      confidence = 0.7,
      alreadyIncluded = false
    } = context

    // Calculate final amount based on source type
    let finalAmount = 0
    let finalExplanation = explanation || 'Employer statutory contributions'
    let finalAlreadyIncluded = alreadyIncluded

    switch (source) {
      case 'item_aggregation':
        finalAmount = monthlyAmount
        finalExplanation = explanation || 'Employer contributions based on legal requirements'
        break

      case 'fallback':
        finalAmount = delta
        finalExplanation = explanation || 'Legal compliance enhancement (aggregate)'
        break

      case 'deterministic_delta':
        finalAmount = Math.max(0, baselineAmount - providerAmount)
        finalExplanation = explanation || 'Deterministic employer contributions delta (baseline minus provider coverage)'
        break

      case 'direct_computation':
      case 'papaya_baseline':
        finalAmount = delta
        finalExplanation = explanation || 'Employer contributions delta'
        finalAlreadyIncluded = delta === 0
        break
    }

    // Return null if no contribution needed
    if (finalAmount <= 0) {
      
      return null
    }

    

    return {
      monthlyAmount: Number(finalAmount.toFixed(2)),
      explanation: finalExplanation,
      confidence,
      alreadyIncluded: finalAlreadyIncluded,
      source
    }
  }

  private computeTerminationComponents(params: {
    countryCode: string
    countryName: string
    formData?: EORFormData
    baseSalaryMonthly: number
    contractMonths: number
  }): {
    severanceMonthly: number
    probationMonthly: number
    totalMonthly: number
    warnings: string[]
  } {
    const { countryCode, countryName, formData, baseSalaryMonthly, contractMonths } = params

    const salaryMonthly = Math.max(0, Number(baseSalaryMonthly) || 0)
    const contractMonthsSafe = Math.max(1, Number(contractMonths) || 1)

    const formDataRef = formData ?? ({} as EORFormData)

    const profile = LegalProfileService.getProfile({
      countryCode,
      countryName,
      formData: formDataRef
    })

    const requirements = profile?.requirements?.terminationCosts

    const parseDays = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (!value) return 0
      const text = String(value).toLowerCase()
      const dayMatch = text.match(/([\d.]+)\s*day/)
      if (dayMatch) return Math.round(parseFloat(dayMatch[1]))
      const monthMatch = text.match(/([\d.]+)\s*month/)
      if (monthMatch) return Math.round(parseFloat(monthMatch[1]) * 30)
      const weekMatch = text.match(/([\d.]+)\s*week/)
      if (weekMatch) return Math.round(parseFloat(weekMatch[1]) * 7)
      const numericMatch = text.match(/([\d.]+)/)
      if (numericMatch) return Math.round(parseFloat(numericMatch[1]))
      return 0
    }

    const severanceMonths = Math.max(0, requirements?.severanceMonths ?? 0)
    let probationDays = Math.max(0, requirements?.probationPeriodDays ?? 0)

    if (!probationDays && formDataRef?.probationPeriod) {
      probationDays = Math.max(probationDays, parseDays(formDataRef.probationPeriod))
    }

    const round = (value: number) => Number.isFinite(value) ? Number(value.toFixed(2)) : 0

    const severanceMonthly = round(severanceMonths * salaryMonthly / contractMonthsSafe)
    const probationMonthly = round((probationDays / 30) * salaryMonthly / contractMonthsSafe)
    const totalMonthly = round(severanceMonthly + probationMonthly)

    const warnings: string[] = []
    if (severanceMonthly === 0 && (requirements?.severanceMonths ?? 0) === 0 && salaryMonthly > 0) {
      warnings.push('Severance months data missing; severance provision defaulted to 0.')
    }
    if (probationMonthly === 0 && (requirements?.probationPeriodDays ?? 0) === 0 && salaryMonthly > 0) {
      warnings.push('Probation period data missing; probation provision defaulted to 0.')
    }

    return {
      severanceMonthly,
      probationMonthly,
      totalMonthly,
      warnings
    }
  }

  /**
   * Deduplicates LLM response to prevent double employer contributions
   * Ensures only one employer_contributions_total exists across all enhancement structures
   */
  private deduplicateEnhancementResponse(response: any, provider?: ProviderType): any {
    if (!response || typeof response !== 'object') return response

    // Check if both main enhancements AND additionalContributions have employer contributions
    const hasMainContrib = response.enhancements?.employer_contributions_total
    const hasAdditionalContrib = response.enhancements?.additionalContributions?.employer_contributions_total

    if (hasMainContrib && hasAdditionalContrib) {
      if (typeof window === 'undefined') {
        console.warn('[GroqService] deduplicateEnhancementResponse: Found duplicate employer contributions, removing from additionalContributions')
        console.warn('  Main enhancement:', hasMainContrib)
        console.warn('  Additional contribution:', hasAdditionalContrib)
      }

      // Keep the main enhancement, remove from additionalContributions
      delete response.enhancements.additionalContributions.employer_contributions_total

      // If additionalContributions is now empty, remove it entirely
      if (Object.keys(response.enhancements.additionalContributions).length === 0) {
        delete response.enhancements.additionalContributions
      }
    }

    const primaryKeys = [
      'thirteenth_salary',
      'fourteenth_salary',
      'vacation_bonus',
      'transportation_allowance',
      'remote_work_allowance',
      'meal_vouchers',
      'phone_allowance',
      'wellness_allowance',
      'health_insurance_allowance',
      'severance_provision',
      'probation_provision'
    ]

    if (response.enhancements?.additionalContributions) {
      for (const key of primaryKeys) {
        if (response.enhancements[key] && response.enhancements.additionalContributions[key]) {
          if (typeof window === 'undefined') {
            console.warn(`[GroqService] deduplicateEnhancementResponse: Removing duplicate additional contribution for ${key}`)
          }
          delete response.enhancements.additionalContributions[key]
        }
      }

      const canonicalPatterns: Record<string, string[]> = {
        thirteenth_salary: ['13th', 'thirteenth', 'aguinaldo'],
        fourteenth_salary: ['14th', 'fourteenth'],
        vacation_bonus: ['vacation bonus', 'vacation_pay', 'holiday bonus'],
        transportation_allowance: ['transport', 'commute', 'commuting allowance', 'bus', 'metro'],
        remote_work_allowance: ['remote work', 'home office', 'wfh'],
        meal_vouchers: ['meal', 'food', 'lunch voucher', 'ticket'],
        phone_allowance: ['phone', 'internet', 'mobile', 'communication'],
        wellness_allowance: ['wellness', 'gym', 'fitness', 'health'],
        health_insurance_allowance: ['insurance', 'healthcare', 'medical'],
        severance_provision: ['severance', 'redundancy', 'termination payout'],
        probation_provision: ['probation']
      }
      const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

      for (const key of Object.keys(response.enhancements.additionalContributions)) {
        const keyNorm = normalizeKey(key)
        if (keyNorm.includes('local') || keyNorm.includes('office')) continue

        for (const [primaryKey, patterns] of Object.entries(canonicalPatterns)) {
          if (!response.enhancements[primaryKey]) continue
          if (patterns.some(pattern => keyNorm.includes(pattern))) {
            if (typeof window === 'undefined') {
              console.warn(`[GroqService] deduplicateEnhancementResponse: Removing fuzzy duplicate '${key}' for ${primaryKey}`)
            }
            delete response.enhancements.additionalContributions[key]
            break
          }
        }
      }

      // Clean up empty bag after removals
      if (Object.keys(response.enhancements.additionalContributions).length === 0) {
        delete response.enhancements.additionalContributions
      }
    }

    // Also check for individual employer contribution items that might sum to the same total
    if (hasMainContrib && response.enhancements?.additionalContributions) {
      const mainAmount = hasMainContrib.monthly_amount || 0
      const additionalKeys = Object.keys(response.enhancements.additionalContributions)
      const employerContribKeys = additionalKeys.filter(key =>
        key.toLowerCase().includes('employer') && key.toLowerCase().includes('contrib')
      )

      if (employerContribKeys.length > 0) {
        const additionalTotal = employerContribKeys.reduce((sum, key) => {
          const amount = response.enhancements.additionalContributions[key]
          return sum + (typeof amount === 'number' ? amount : (amount?.monthly_amount || 0))
        }, 0)

        // If amounts are similar (within 10%), likely duplicate
        if (Math.abs(mainAmount - additionalTotal) / Math.max(mainAmount, additionalTotal, 1) < 0.1) {
          if (typeof window === 'undefined') {
            console.warn(`[GroqService] deduplicateEnhancementResponse: Removing likely duplicate employer contrib items (main: ${mainAmount}, additional: ${additionalTotal})`)
          }

          employerContribKeys.forEach(key => {
            delete response.enhancements.additionalContributions[key]
          })
        }
      }
    }

    // Validate the response after deduplication
    if (provider) {
      this.validateEnhancementResponse(response, provider)
    }

    return response
  }

  /**
   * Validates enhancement response for common issues and logs warnings
   */
  private validateEnhancementResponse(response: any, provider: ProviderType): void {
    if (!response || typeof response !== 'object') return

    const enhancements = response.enhancements || {}
    const additionalContribs = enhancements.additionalContributions || {}

    // Check for employer contributions duplication patterns
    const mainEmployerContrib = enhancements.employer_contributions_total
    const additionalEmployerContrib = additionalContribs.employer_contributions_total

    // Individual employer contribution items in additionalContributions
    const individualEmployerContribs = Object.keys(additionalContribs).filter(key =>
      key.toLowerCase().includes('employer') && key.toLowerCase().includes('contrib')
    )

    
  }

  /**
   * Request wrapper with simple retries/backoff for transient errors
   */
  private async requestWithRetry<T>(
    fn: (opts?: { signal?: AbortSignal }) => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const configuredRetries = process.env.GROQ_MAX_RETRIES ? Number(process.env.GROQ_MAX_RETRIES) : 1
    const overallBudgetMs = process.env.GROQ_TOTAL_TIMEOUT_MS ? Number(process.env.GROQ_TOTAL_TIMEOUT_MS) : 60000
    const perRequestTimeoutMs = this.config.requestTimeoutMs || 30000

    // Guard against invalid env values
    const safeOverallBudget = Number.isFinite(overallBudgetMs) && overallBudgetMs > 0 ? overallBudgetMs : 60000
    const safePerRequestTimeout = Number.isFinite(perRequestTimeoutMs) && perRequestTimeoutMs > 0 ? perRequestTimeoutMs : 30000
    const allowedRetries = typeof maxRetries === 'number' ? maxRetries : configuredRetries

    let attempt = 0
    let delay = 250
    const start = Date.now()

    while (true) {
      const elapsed = Date.now() - start
      const remaining = safeOverallBudget - elapsed
      // Reserve a tiny buffer to avoid overshooting the overall budget
      const bufferMs = 50
      // Reduce timeout for later attempts to stay within overall budget
      const attemptTimeout = Math.max(100, Math.min(safePerRequestTimeout, remaining - (attempt > 0 ? delay : 0) - bufferMs))

      // If we don't have time left for another attempt, fail fast
      if (remaining <= bufferMs) {
        throw new Error('timeout')
      }

      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => {
        try { controller.abort('timeout') } catch { /* noop */ }
      }, attemptTimeout)

      try {
        const result = await fn({ signal: controller.signal })
        clearTimeout(timeoutHandle)
        return result
      } catch (err: unknown) {
        clearTimeout(timeoutHandle)
        const error = err as { name?: string; message?: string; status?: string | number; code?: string | number }
        const msg = (error?.message || '').toLowerCase()
        const status = (error?.status || error?.code || '').toString()

        const isAbort = (error as Error)?.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout')
        const retriable = isAbort || msg.includes('rate') || msg.includes('temporarily') || status === '429' || status === '408' || status === '503'

        if (attempt >= allowedRetries || !retriable) {
          // Normalize aborts to a timeout error for consistent error handling upstream
          if (isAbort) throw new Error('timeout')
          throw err
        }

        // Backoff before retrying (but don't exceed overall budget)
        const now = Date.now()
        const stillRemaining = safeOverallBudget - (now - start)
        if (stillRemaining <= delay + bufferMs) {
          // No time left for a backoff + another attempt
          throw err
        }
        await new Promise(res => setTimeout(res, delay))
        delay = Math.min(delay * 2, 1000)
        attempt++
      }
    }
  }

  /**
   * Enhanced error handling
   */
  private handleError(error: unknown, provider?: ProviderType): EnhancementError {
    const enhancementError: EnhancementError = {
      code: 'GROQ_ERROR',
      message: 'Unknown error occurred',
      provider,
      originalError: error
    }

    const errorObj = error as { message?: string }
    
    if (errorObj?.message?.includes('rate limit')) {
      enhancementError.code = 'RATE_LIMIT_EXCEEDED'
      enhancementError.message = 'Too many requests. Please try again later.'
    } else if (errorObj?.message?.includes('API key')) {
      enhancementError.code = 'INVALID_API_KEY'
      enhancementError.message = 'Invalid or missing Groq API key'
    } else if (errorObj?.message?.includes('timeout')) {
      enhancementError.code = 'REQUEST_TIMEOUT'
      enhancementError.message = 'Request timed out. Please try again.'
    } else if (errorObj?.message?.includes('parse')) {
      enhancementError.code = 'RESPONSE_PARSE_ERROR'
      enhancementError.message = 'Failed to parse LLM response'
    } else if (typeof error === 'string') {
      enhancementError.message = error
    } else if (errorObj?.message) {
      enhancementError.message = errorObj.message
    }

    return enhancementError
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<boolean> {
    try {
      

      const client = this.getClient('pass2')
      const response = await client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: "You are a health check. Reply with JSON only." },
          { role: "user", content: "ping" }
        ],
        max_tokens: 16,
        temperature: 0,
        top_p: 1,
        stream: false,
        response_format: { type: "json_object" }
      })

      const content = response.choices[0]?.message?.content || ''

      

      const json = this.extractJson(content)
      const parsed = JSON.parse(json)
      return parsed && (parsed.status === 'ok' || parsed.ok === true)
    } catch (error) {
      console.error('Groq health check failed:', error)
      return false
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      model: this.config.model,
      requestsPerMinute: this.rateLimiter.requestsPerMinute,
      currentRequestCount: this.rateLimiter.requestCount,
      currentTokenCount: this.rateLimiter.tokenCount,
      lastRequestTime: this.rateLimiter.lastRequestTime
    }
  }

  /**
   * Reconciliation via LLM (ranking + recommendations only; totals are provided and must not be changed)
   */
  async reconcile(input: {
    settings: { currency: string; threshold: number; riskMode: boolean }
    providers: Array<{
      provider: string
      total: number
      confidence: number
      coverage: { includes: string[]; missing: string[]; doubleCountingRisk: string[] }
      quoteType: 'all-inclusive' | 'statutory-only'
    }>
  }): Promise<unknown> {
    try {
      await this.checkRateLimit()

      let systemPrompt = PromptEngine.buildReconciliationSystemPrompt()
      let userPrompt = PromptEngine.buildReconciliationUserPrompt(input)
      try {
        const compact = (s: string) => s.replace(/\s+/g, ' ').trim()
        systemPrompt = compact(systemPrompt)
        userPrompt = compact(userPrompt)
      } catch { /* noop */ }

      

      // Use only the default single-key client (GROQ_API_KEY) for reconciliation
      const client = this.getDefaultClientForReconciliation()
      const response = await this.requestWithRetry((opts) => client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [],
        tool_choice: 'none',
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: 'json_object' }
      }, { signal: opts?.signal }))

      this.updateRateLimiter((response as ChatCompletion).usage?.total_tokens || 0)

     

      const content = (response as ChatCompletion).choices?.[0]?.message?.content
      if (!content) throw new Error('No content received from Groq reconciliation')
      const jsonText = this.extractJson(content)
      const parsed = JSON.parse(jsonText)
      return parsed
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Resolve Groq client for a given pass with sensible fallbacks
   */
  private getClient(pass: 'pass1' | 'pass2' | 'pass3'): Groq {
    if (this.multiKeyEnabled) {
      const client = this.clients[pass] || this.clients.default
      if (client) return client
      // As a last resort, pick the first available client
      const anyClient = this.clients.pass1 || this.clients.pass2 || this.clients.pass3
      if (anyClient) return anyClient
      throw new Error('No Groq client available for requested pass')
    }
    if (this.client) return this.client
    // Should not happen, but keep a clear error path
    throw new Error('Groq client not initialized')
  }

  /**
   * Resolve default client explicitly for reconciliation.
   * Uses only GROQ_API_KEY; does not use provider/pass keys.
   */
  private getDefaultClientForReconciliation(): Groq {
    const client = this.clients.default || this.client
    if (!client) {
      throw new Error('GROQ_API_KEY is required for reconciliation (default client missing)')
    }
    return client
  }

  /**
   * Resolve Groq client for arithmetic compute (per provider -> key slot)
   * Mapping:
   *  1: deel, 2: remote, 3: rivermate, 4: oyster, 5: rippling, 6: skuad, 7: velocity
   */
  private getProviderClient(provider: ProviderType): Groq {
    if (!this.multiKeyEnabled) return this.clients.default || (this.client as Groq)

    if (this.providerClients[provider]) return this.providerClients[provider] as Groq

    const slot = this.mapProviderToSlot(provider)
    const envKeyName = `GROQ_API_KEY_${slot}`
    const slotKey = (process.env[envKeyName] || '').toString().trim()
    const defaultKey = (process.env.GROQ_API_KEY || '').toString().trim()

    if (!slotKey) {
      // If multi-key is enabled, warn loudly about fallback
      if (this.multiKeyEnabled && typeof window === 'undefined') {
        console.warn(`[GroqService] Missing ${envKeyName} for provider=${provider}. Using default GROQ_API_KEY fallback. This may collapse routing to a single org.`)
      }
      const fallbackKey = defaultKey
      if (!fallbackKey) {
        const fallback = this.clients.default || this.clients.pass2 || this.clients.pass3 || this.client
        if (!fallback) throw new Error(`Groq API key missing for ${provider} (expected ${envKeyName} or GROQ_API_KEY)`)
        return fallback
      }
      const client = new Groq({ apiKey: fallbackKey, defaultHeaders: { "Groq-Model-Version": "latest" } })
      this.providerClients[provider] = client
      return client
    }

    const client = new Groq({ apiKey: slotKey, defaultHeaders: { "Groq-Model-Version": "latest" } })
    this.providerClients[provider] = client
    return client
  }

  private mapProviderToSlot(provider: ProviderType): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
    switch (provider) {
      case 'deel': return 1
      case 'remote': return 2
      case 'rivermate': return 3
      case 'oyster': return 4
      case 'rippling': return 5
      case 'skuad': return 6
      case 'velocity': return 7
      default: return 1
    }
  }
}
