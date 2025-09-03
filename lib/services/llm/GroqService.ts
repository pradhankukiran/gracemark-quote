// GroqService - High-speed LLM service for quote enhancement analysis
import 'groq-sdk/shims/node'
import { Groq } from "groq-sdk"
import type { ChatCompletion } from "groq-sdk/resources/chat/completions"
import { z } from "zod"
import { PromptEngine } from "./PromptEngine"
import { 
  GroqConfig, 
  GroqEnhancementResponse, 
  EnhancementInput,
  EnhancementError,
  StandardizedBenefitData,
  ProviderType,
  ArithmeticComputeInput
} from "@/lib/types/enhancement"

// Rate limiting interface
interface RateLimiter {
  tokensPerMinute: number
  requestsPerMinute: number
  lastRequestTime: number
  tokenCount: number
  requestCount: number
}

export class GroqService {
  private client: Groq
  private config: GroqConfig
  private rateLimiter: RateLimiter
  private static instance: GroqService

  constructor(config: Partial<GroqConfig> = {}) {
    this.config = {
      apiKey: (config.apiKey || process.env.GROQ_API_KEY || '').trim(),
      model: config.model || process.env.GROQ_MODEL || 'deepseek-r1-distill-llama-70b',
      temperature: config.temperature ?? (process.env.GROQ_TEMPERATURE ? Number(process.env.GROQ_TEMPERATURE) : 0.1),
      maxTokens: config.maxTokens ?? (process.env.GROQ_MAX_TOKENS ? Number(process.env.GROQ_MAX_TOKENS) : 131072),
      rateLimitRpm: config.rateLimitRpm ?? (process.env.GROQ_RATE_LIMIT_RPM ? Number(process.env.GROQ_RATE_LIMIT_RPM) : 30),
    }

    if (!this.config.apiKey) {
      throw new Error('Groq API key is required')
    }

    // Initialize client with explicit API key to avoid env/config drift
    this.client = new Groq({ apiKey: this.config.apiKey })

    this.rateLimiter = {
      tokensPerMinute: 6000, // Groq's typical limit
      requestsPerMinute: this.config.rateLimitRpm,
      lastRequestTime: 0,
      tokenCount: 0,
      requestCount: 0
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
    try {
      // Validate input
      this.validateInput(input)
      
      // Rate limiting check
      await this.checkRateLimit()
      
      // Build prompt
      const systemPrompt = PromptEngine.buildSystemPrompt()
      const userPrompt = PromptEngine.buildUserPrompt(input)
      
      // Make API call using Groq SDK
      const response = await this.requestWithRetry(() => this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        // Use configured generation settings and standard OpenAI-compatible params
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: "json_object" }
      }))

      // Update rate limiter
      this.updateRateLimiter((response as ChatCompletion).usage?.total_tokens || 0)

      // Parse and validate response
      const content = (response as ChatCompletion).choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content received from Groq')
      }

      const jsonText = this.extractJson(content)
      const parsedResponse = this.parseResponse(jsonText)
      this.validateResponse(parsedResponse)

      return parsedResponse

    } catch (error) {
      const enhancementError = this.handleError(error, input.provider)
      throw enhancementError
    }
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
      
      // Make API call using Groq SDK
      const response = await this.requestWithRetry(() => this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: "json_object" }
      }))

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
    try {
      // Rate limiting
      await this.checkRateLimit()

      const systemPrompt = PromptEngine.buildArithmeticSystemPrompt()
      const userPrompt = PromptEngine.buildArithmeticUserPrompt({
        provider: input.provider,
        baseMonthly: input.baseQuote.monthlyTotal,
        baseSalary: input.baseQuote.baseCost,
        currency: input.baseQuote.currency,
        quoteType: input.quoteType,
        contractMonths: input.contractDurationMonths,
        extractedBenefits: input.extractedBenefits,
        legalProfile: {
          id: input.legalProfile.id,
          summary: input.legalProfile.summary,
          formulas: input.legalProfile.formulas
        }
      })

      const response = await this.requestWithRetry(() => this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: 1,
        stream: false,
        response_format: { type: "json_object" }
      }))

      this.updateRateLimiter((response as ChatCompletion).usage?.total_tokens || 0)

      const content = (response as ChatCompletion).choices?.[0]?.message?.content
      if (!content) throw new Error('No content received from Groq arithmetic compute')

      const jsonText = this.extractJson(content)
      const parsed = this.parseResponse(jsonText)
      this.validateResponse(parsed)
      return parsed
    } catch (error) {
      throw this.handleError(error, input.provider)
    }
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
    }}
    
    if (data?.data?.termination) {
      summary.push(`TERMINATION: ${data.data.termination.notice_period || 'N/A'} notice, ${data.data.termination.severance_pay || 'N/A'} severance`)
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
        confidence_scores: parsed.confidence_scores || {
          overall: 0,
          termination_costs: 0,
          salary_enhancements: 0,
          allowances: 0
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
          overall: z.number().min(0).max(1).default(0),
          termination_costs: z.number().min(0).max(1).default(0),
          salary_enhancements: z.number().min(0).max(1).default(0),
          allowances: z.number().min(0).max(1).default(0)
        }).default({ overall: 0, termination_costs: 0, salary_enhancements: 0, allowances: 0 }),
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

    // Validate confidence scores
    Object.values(response.confidence_scores || {}).forEach(score => {
      if (typeof score !== 'number' || score < 0 || score > 1) {
        console.warn(`Invalid confidence score: ${score}`)
      }
    })

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
   * Request wrapper with simple retries/backoff for transient errors
   */
  private async requestWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0
    let delay = 500
    while (true) {
      try {
        return await fn()
      } catch (err: unknown) {
        const error = err as { message?: string; status?: string | number; code?: string | number }
        const msg = (error?.message || '').toLowerCase()
        const status = (error?.status || error?.code || '').toString()
        const retriable = msg.includes('rate') || msg.includes('timeout') || msg.includes('temporarily') || status === '429' || status === '408' || status === '503'
        if (attempt >= maxRetries || !retriable) throw err
        await new Promise(res => setTimeout(res, delay))
        delay *= 2
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
      const response = await this.client.chat.completions.create({
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
}
