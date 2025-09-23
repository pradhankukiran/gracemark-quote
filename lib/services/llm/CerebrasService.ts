// CerebrasService - Pre-pass LLM that assembles a legal profile from Papaya data + presence flags

import type { EORFormData } from "@/lib/shared/types"
import { PapayaService } from "@/lib/services/data/PapayaService"
import { PapayaAvailability, PapayaAvailabilityFlags } from "@/lib/services/data/PapayaAvailability"
import { LegalProfileService } from "@/lib/services/data/LegalProfileService"
import { z } from "zod"

type CerebrasClient = any

export interface PrepassLegalItem {
  key: string
  name: string
  category: 'contributions' | 'bonuses' | 'allowances' | 'termination'
  mandatory: boolean
  formula?: string
  variables?: Record<string, number | string | boolean>
  monthly_amount_local: number
  min?: number
  max?: number
  source?: string
  notes?: string
}

export interface PrepassLegalProfile {
  meta: {
    country_code: string
    country: string
    currency: string
    base_salary_monthly: number
    contract_months: number
    quote_type: 'all-inclusive' | 'statutory-only'
  }
  availability: PapayaAvailabilityFlags
  items: PrepassLegalItem[]
  subtotals: { contributions: number; bonuses: number; allowances: number; termination: number }
  total_monthly_local: number
  warnings: string[]
}

const PrepassSchema = z.object({
  meta: z.object({
    country_code: z.string(),
    country: z.string(),
    currency: z.string(),
    base_salary_monthly: z.number(),
    contract_months: z.number(),
    quote_type: z.enum(['all-inclusive','statutory-only'])
  }),
  availability: z.object({
    contribution_employer_contributions: z.boolean(),
    contribution_employee_contributions: z.boolean(),
    contribution_income_tax: z.boolean(),
    payroll_13th_salary: z.boolean(),
    payroll_14th_salary: z.boolean(),
    payroll_13th_and_14th: z.boolean(),
    payroll_cycle: z.boolean(),
    termination_notice_period: z.boolean(),
    termination_severance_pay: z.boolean(),
    termination_probation_period: z.boolean(),
    common_benefits: z.boolean(),
    remote_work: z.boolean(),
    authority_payments: z.boolean(),
    minimum_wage: z.boolean()
  }),
  items: z.array(z.object({
    key: z.string(),
    name: z.string(),
    category: z.enum(['contributions','bonuses','allowances','termination']),
    mandatory: z.boolean(),
    formula: z.string().optional(),
    variables: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
    monthly_amount_local: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    source: z.string().optional(),
    notes: z.string().optional()
  })),
  subtotals: z.object({ contributions: z.number(), bonuses: z.number(), allowances: z.number(), termination: z.number() }),
  total_monthly_local: z.number(),
  warnings: z.array(z.string())
})

export class CerebrasService {
  private static instance: CerebrasService
  private client: CerebrasClient | null = null

  static getInstance(): CerebrasService {
    if (!CerebrasService.instance) CerebrasService.instance = new CerebrasService()
    return CerebrasService.instance
  }

  private async getClient(): Promise<CerebrasClient> {
    if (this.client) return this.client
    // Lazy import to avoid bundling issues if SDK is absent during build
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Cerebras = require('@cerebras/cerebras_cloud_sdk').default
    const apiKey = (process.env.CEREBRAS_API_KEY || '').trim()
    if (!apiKey) throw new Error('CEREBRAS_API_KEY is required for pre-pass')
    this.client = new Cerebras({ apiKey })
    return this.client
  }

  /**
   * Categorize cost items for assignment reconciliation
   */
  async categorizeCostItems(input: {
    provider: string
    country: string
    currency: string
    costItems: Array<{key: string, name: string, monthly_amount: number}>
  }): Promise<{
    baseSalary: Record<string, number>
    statutoryMandatory: Record<string, number>
    allowancesBenefits: Record<string, number>
    terminationCosts: Record<string, number>
    oneTimeFees: Record<string, number>
  }> {
    const { provider, country, currency, costItems } = input

    const systemPrompt = this.buildCategorizationSystemPrompt()
    const userPrompt = this.buildCategorizationUserPrompt({ provider, country, currency, costItems })

    console.log('[CerebrasService] Sending categorizeCostItems request', {
      provider,
      country,
      currency,
      costItemCount: costItems.length,
      costItems
    })

    const client = await this.getClient()
    let response: any
    try {
      response = await client.chat.completions.create({
        model: "qwen-3-32b",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        max_completion_tokens: 8192,
        temperature: 0.1,
        top_p: 1,
        response_format: { type: 'json_object' }
      })
    } catch (e: any) {
      const msg = (e?.message || '').toString().toLowerCase()
      const code = (e?.status || e?.code || '').toString()
      const retryable = msg.includes('failed to generate json') || code === '400' || msg.includes('response_format')
      if (!retryable) throw e

      // Retry without response_format
      response = await client.chat.completions.create({
        model: "qwen-3-32b",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        max_completion_tokens: 8192,
        temperature: 0.1,
        top_p: 1
      })
    }

    const content: string = response?.choices?.[0]?.message?.content || ''

    // Clean content first - remove thinking tags and other non-JSON content
    const cleanedContent = this.cleanLLMResponse(content)

    // Extract and parse JSON
    const candidates = this.extractAllJson(cleanedContent)
    let lastError: unknown = null

    for (const cand of candidates) {
      try {
        const parsed = JSON.parse(cand)
        // Simple validation - ensure we have the expected structure
        if (parsed && typeof parsed === 'object' &&
            (parsed.baseSalary !== undefined || parsed.statutoryMandatory !== undefined ||
             parsed.allowancesBenefits !== undefined || parsed.terminationCosts !== undefined ||
             parsed.oneTimeFees !== undefined)) {
          const result = {
            baseSalary: parsed.baseSalary || {},
            statutoryMandatory: parsed.statutoryMandatory || {},
            allowancesBenefits: parsed.allowancesBenefits || {},
            terminationCosts: parsed.terminationCosts || {},
            oneTimeFees: parsed.oneTimeFees || {}
          }

          console.log('[CerebrasService] Received categorizeCostItems response', {
            provider,
            country,
            currency,
            result
          })

          return result
        }
        lastError = 'Invalid response structure'
      } catch (e) {
        lastError = e
        continue
      }
    }
    throw new Error(`Cerebras cost categorization failed: ${lastError instanceof Error ? lastError.message : JSON.stringify(lastError)}`)
  }

  /**
   * Run pre-pass to assemble a legal profile JSON from Papaya + presence flags
   */
  async buildLegalProfile(params: {
    countryCode: string
    formData: EORFormData
  }): Promise<PrepassLegalProfile> {
    const { countryCode, formData } = params

    const core = PapayaService.getCountryCoreData(countryCode)
    const full = PapayaService.getCountryData(countryCode)
    if (!core || !full) throw new Error(`Papaya data not found for country ${countryCode}`)

    const availability = PapayaAvailability.getFlags(countryCode)

    // Deterministic numeric hints (fallbacks if LLM fails)
    const legalProfile = LegalProfileService.getProfile({
      countryCode,
      countryName: full.country,
      formData
    })

    const numericHints = {
      // Termination
      termination: {
        notice_days: legalProfile?.requirements?.terminationCosts?.noticePeriodDays ?? 0,
        severance_months: legalProfile?.requirements?.terminationCosts?.severanceMonths ?? 0
      },
      salaries: {
        has_13th: legalProfile?.requirements?.mandatorySalaries?.has13thSalary ?? false,
        has_14th: legalProfile?.requirements?.mandatorySalaries?.has14thSalary ?? false
      },
      allowances: legalProfile?.requirements?.allowances || {},
      contributions: legalProfile?.requirements?.contributions?.employerRates || {}
    }

    const localCurrency = this.extractCurrency(core, full.country)
    const meta = {
      country_code: countryCode.toUpperCase(),
      country: full.country,
      currency: localCurrency,
      base_salary_monthly: Number(formData.baseSalary || 0) || Number((full as any)?.data?.payroll?.base_salary || 0) || 0,
      contract_months: Math.max(1, parseInt(formData.contractDuration || '12') || 12),
      quote_type: (formData.quoteType || 'all-inclusive') as 'all-inclusive' | 'statutory-only'
    }

    // Presence-gated compact text (preserve headings)
    const snippets: string[] = []
    const d = core as any
    if (availability.contribution_employer_contributions && d?.contribution?.employer_contributions) {
      snippets.push('EMPLOYER_CONTRIBUTIONS:')
      d.contribution.employer_contributions.forEach((c: any) => snippets.push(`- ${c.description}: ${c.rate}`))
      snippets.push('')
    }
    if ((availability.payroll_13th_salary || availability.payroll_14th_salary || availability.payroll_cycle) && d?.payroll) {
      snippets.push('PAYROLL:')
      if (availability.payroll_cycle && d.payroll.payroll_cycle) snippets.push(`Payroll Cycle: ${d.payroll.payroll_cycle}`)
      if (availability.payroll_13th_salary && d.payroll['13th_salary']) snippets.push(`13th Salary: ${d.payroll['13th_salary']}`)
      if (availability.payroll_14th_salary && d.payroll['14th_salary']) snippets.push(`14th Salary: ${d.payroll['14th_salary']}`)
      snippets.push('')
    }
    if ((availability.termination_notice_period || availability.termination_severance_pay || availability.termination_probation_period) && d?.termination) {
      snippets.push('TERMINATION:')
      if (availability.termination_notice_period && d.termination.notice_period) snippets.push(`Notice Period: ${d.termination.notice_period}`)
      if (availability.termination_severance_pay && d.termination.severance_pay) snippets.push(`Severance Pay: ${d.termination.severance_pay}`)
      if (availability.termination_probation_period && d.termination.probation_period) snippets.push(`Probation Period: ${d.termination.probation_period}`)
      snippets.push('')
    }
    if (availability.common_benefits && Array.isArray(d?.common_benefits)) {
      snippets.push('COMMON_BENEFITS:')
      d.common_benefits.forEach((b: string) => snippets.push(`- ${b}`))
      snippets.push('')
    }
    if (availability.authority_payments && Array.isArray(d?.authority_payments)) {
      snippets.push('AUTHORITY_PAYMENTS:')
      d.authority_payments.forEach((ap: any) => {
        const authority = ap.authority_payment || 'Unknown Authority'
        const dates = ap.dates || 'Schedule not specified'
        const methods = ap.methods || 'Methods not specified'
        snippets.push(`- ${authority}: ${dates} (${methods})`)
      })
      snippets.push('')
    }

    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt({ meta, availability, numericHints, text: snippets.join('\n').trim() })

    

    const client = await this.getClient()
    let response: any
    try {
      response = await client.chat.completions.create({
        model: "qwen-3-32b",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        max_completion_tokens: 8192,
        temperature: 0.1,
        top_p: 1,
        // If supported by the SDK/model, this enforces JSON-only output
        response_format: { type: 'json_object' }
      })
    } catch (e: any) {
      const msg = (e?.message || '').toString().toLowerCase()
      const code = (e?.status || e?.code || '').toString()
      const retryable = msg.includes('failed to generate json') || code === '400' || msg.includes('response_format')
      if (!retryable) throw e

      

      // Retry without response_format (some models may not support it)
      response = await client.chat.completions.create({
        model: "qwen-3-32b",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        max_completion_tokens: 8192,
        temperature: 0.1,
        top_p: 1
      })
    }

    const content: string = response?.choices?.[0]?.message?.content || ''

    const cerebrasDebugEnabled = (process.env.CEREBRAS_DEBUG || '').toLowerCase() === 'true'

    

    // Try to find a candidate JSON object that matches the schema
    const candidates = this.extractAllJson(this.cleanLLMResponse(content))
    let lastError: unknown = null

    

    for (const cand of candidates) {
      try {
        const parsed = JSON.parse(cand)
        const candidate = this.normalizePrepassCandidate(parsed)
        const safe = PrepassSchema.safeParse(candidate)
        if (safe.success) return this.toPrepassProfile(safe.data)

        

        lastError = safe.error
      } catch (e) {
        lastError = e
        continue
      }
    }
    // As a final fallback, attempt basic extraction
    try {
      const coarse = this.extractJson(content)
      const parsed = JSON.parse(coarse)
      const candidate = this.normalizePrepassCandidate(parsed)
      const safe = PrepassSchema.safeParse(candidate)
      if (safe.success) return this.toPrepassProfile(safe.data)
      lastError = safe.error
    } catch (e) { lastError = e }
    throw new Error(`Cerebras pre-pass schema error: ${lastError instanceof Error ? lastError.message : JSON.stringify(lastError)}`)
  }

  // Heuristic currency extraction from core Papaya sections
  private extractCurrency(core: any, countryName?: string): string {
    try {
      const textToSearch = [
        core?.minimum_wage || '',
        ...(core?.contribution?.employer_contributions || []).map((c: any) => `${c.rate} ${c.description}`),
        ...(core?.common_benefits || []).join(' ')
      ].join(' ')
      const m = textToSearch.match(/\b([A-Z]{3})\b/)
      if (m) return m[1]
      const cn = (countryName || '').toLowerCase()
      const map: Record<string,string> = {
        'argentina': 'ARS', 'brazil': 'BRL', 'colombia': 'COP', 'mexico': 'MXN', 'chile': 'CLP', 'peru': 'PEN',
        'germany': 'EUR', 'france': 'EUR', 'spain': 'EUR', 'italy': 'EUR', 'netherlands': 'EUR',
        'united kingdom': 'GBP', 'uk': 'GBP', 'united states': 'USD', 'usa': 'USD'
      }
      return map[cn] || 'USD'
    } catch { return 'USD' }
  }

  private buildCategorizationSystemPrompt(): string {
    return [
      'You are an expert EOR cost categorization specialist.',
      '',
      'TASK: Categorize cost items into 5 specific business categories for assignment reconciliation.',
      '',
      'CATEGORIES:',
      '1. baseSalary: Base salary, gross salary components (NOT bonuses or statutory extras)',
      '2. statutoryMandatory: Legally required employer contributions, taxes, social security, pension contributions, mandatory insurance',
      '3. allowancesBenefits: Optional allowances like meal vouchers, transportation, remote work stipends, health benefits',
      '4. terminationCosts: Notice period costs, severance payments, termination-related provisions',
      '5. oneTimeFees: One-time setup costs, background checks, medical exams, onboarding fees',
      '',
      'CRITICAL RULES:',
      '- 13th salary, 14th salary = statutoryMandatory (legally required in many countries)',
      '- Vacation bonus = statutoryMandatory if legally required, allowancesBenefits if optional',
      '- Use country context to determine if items are legally mandatory vs optional',
      '- Each cost item goes into exactly ONE category',
      '- Return JSON with exact structure: {baseSalary: {}, statutoryMandatory: {}, allowancesBenefits: {}, terminationCosts: {}, oneTimeFees: {}}',
      '- Use original item keys as keys in each category object',
      '- Values are the monthly amounts',
      '',
      'STRICT OUTPUT FORMAT:',
      '- DO NOT include thinking tags like <think> or reasoning',
      '- DO NOT include explanations or commentary',
      '- OUTPUT ONLY VALID JSON - nothing else',
      '- Start response with { and end with }'
    ].join('\n')
  }

  private buildCategorizationUserPrompt(input: {
    provider: string
    country: string
    currency: string
    costItems: Array<{key: string, name: string, monthly_amount: number}>
  }): string {
    return [
      'COST CATEGORIZATION REQUEST',
      '',
      `Provider: ${input.provider}`,
      `Country: ${input.country}`,
      `Currency: ${input.currency}`,
      '',
      'COST ITEMS TO CATEGORIZE:',
      JSON.stringify(input.costItems, null, 2),
      '',
      'CATEGORIZE into these exact structure:',
      '{',
      '  "baseSalary": {',
      '    "item_key": amount',
      '  },',
      '  "statutoryMandatory": {',
      '    "item_key": amount',
      '  },',
      '  "allowancesBenefits": {',
      '    "item_key": amount',
      '  },',
      '  "terminationCosts": {',
      '    "item_key": amount',
      '  },',
      '  "oneTimeFees": {',
      '    "item_key": amount',
      '  }',
      '}',
      '',
      'Remember: Use country context to determine if 13th salary, vacation bonus etc. are legally mandatory (statutoryMandatory) or optional (allowancesBenefits).',
      'Return valid JSON only.'
    ].join('\n')
  }

  private buildSystemPrompt(): string {
    return [
      'You assemble a strictly valid JSON legal profile for EMPLOYER monthly costs using ONLY the provided Papaya text, availability flags, and NUMERIC_HINTS.',
      '',
      'RESPONSE CONTRACT:',
      '- Output EXACTLY ONE JSON object with these top-level keys: meta, availability, items, subtotals, total_monthly_local, warnings.',
      '- Always include ALL keys, even if empty (use 0 for numbers, [] for arrays).',
      '- Output a single JSON object, NOT an array. Do not wrap the object in square brackets [].',
      '- Do NOT include code fences, markdown, or extra commentary.',
      '',
      'CURRENCY + UNITS:',
      '- Use meta.currency for ALL monetary outputs (no currency symbols).',
      '- All amounts must be MONTHLY in meta.currency.',
      '- Convert formats: yearly→/12, daily→×22, ranges→midpoint; round to 2 decimals.',
      '',
      'TERMINATION:',
      '- Monthly provision = ((notice_days/30)+severance_months)×meta.base_salary_monthly / meta.contract_months.',
      '- If tenure/years_of_service unknown: choose a conservative severance_months (e.g., 3) and add a warning.',
      '',
      'SCOPE:',
      '- Exclude employee contributions and income tax; exclude aggregate roll-ups (e.g., "Total Employment Cost").',
      '- Statutory-only: include ONLY mandatory items.',
      '- All-inclusive: include statutory + common benefits. Use AVAILABILITY flags to determine which allowances are applicable for this country. For allowances without exact amounts, provide reasonable estimates based on typical ranges: meal vouchers (25-100), transportation (50-200), remote work allowance (25-100), wellness allowance (30-80), phone/internet allowance (20-60) monthly in local currency. Only include allowances that are common for the specific country.',
      '',
      'CATEGORY MAPPING (CRITICAL):',
      '- Use ONLY these exact category values: "contributions", "bonuses", "allowances", "termination"',
      '- COMMON_BENEFITS items → category: "allowances" (meal vouchers, transport, wellness, etc.)',
      '- EMPLOYER_CONTRIBUTIONS items → category: "contributions" (social security, payroll taxes, etc.)',
      '- 13th/14th salary, aguinaldo → category: "bonuses"',
      '- Severance, notice periods → category: "termination"',
      '- NEVER use "common_benefits" as a category value.',
      '',
      'DATA USE:',
      '- Prefer numeric values extracted from Papaya text when present.',
      '- For allowances in all-inclusive quotes: use NUMERIC_HINTS as primary source if Papaya lacks specific amounts, or estimate typical amounts if hints are empty.',
      '- Use AVAILABILITY flags to include sections only when present for the country.',
      '- For employer contributions with multiple rate options (e.g., different company sizes), choose the higher/conservative rate and include only ONE entry per contribution type.',
      '- For authority payments: include monthly provisions for mandatory government payments (payroll tax, social security, workers compensation, etc.) based on payment schedules provided. Categorize as "contributions".',
      '',
      'Return JSON only.'
    ].join('\n')
  }

  private buildUserPrompt(input: { meta: PrepassLegalProfile['meta']; availability: PapayaAvailabilityFlags; numericHints: any; text: string }): string {
    // Get country-specific benefit availability hints
    const benefitHints = PapayaAvailability.getBenefitMappingHints(input.meta.country_code)
    const countryBenefitGuidance = benefitHints.expectedBenefitCategories.length > 0
      ? `EXPECTED_ALLOWANCES_FOR_${input.meta.country_code}: ${benefitHints.expectedBenefitCategories.join(', ')}`
      : `No specific allowance categories identified for ${input.meta.country_code}`
    const schema = [
      '{',
      '  "meta": {',
      '    "country_code": "AR",',
      '    "country": "Argentina",',
      '    "currency": "ARS",',
      '    "base_salary_monthly": 0,',
      '    "contract_months": 12,',
      '    "quote_type": "all-inclusive"',
      '  },',
      '  "availability": {',
      '    "payroll_13th_salary": true,',
      '    "payroll_14th_salary": true,',
      '    "payroll_cycle": true,',
      '    "termination_notice_period": true,',
      '    "termination_severance_pay": true,',
      '    "termination_probation_period": true,',
      '    "common_benefits": true',
      '  },',
      '  "items": [',
      '    {',
      '      "key": "thirteenth_salary",',
      '      "name": "13th Month Salary",',
      '      "category": "bonuses",',
      '      "mandatory": true,',
      '      "formula": "base_salary_monthly / 12",',
      '      "variables": { "base_salary_monthly": 0.0 },',
      '      "monthly_amount_local": 0.0,',
      '      "source": "PAYROLL",',
      '      "notes": "Aguinaldo"',
      '    }',
      '  ],',
      '  "subtotals": { "contributions": 0.0, "bonuses": 0.0, "allowances": 0.0, "termination": 0.0 },',
      '  "total_monthly_local": 0.0,',
      '  "warnings": []',
      '}'
    ].join('\n')

    return [
      'PRE-PASS REQUEST (Papaya → Legal Profile JSON)',
      '',
      'RESPONSE REQUIREMENTS:',
      '- Output exactly one JSON object with keys: meta, availability, items, subtotals, total_monthly_local, warnings.',
      '- Include all keys even if empty; numbers must be numbers (not strings).',
      '- Use meta.currency for all amounts; amounts are monthly.',
      '- When multiple rates exist for the same contribution type, select the applicable one or choose the higher rate if uncertain.',
      '- Do not wrap the JSON object in arrays [] or add any extra brackets.',
      '- No code fences or commentary.',
      '',
      `META: ${JSON.stringify(input.meta)}`,
      `AVAILABILITY_FLAGS: ${JSON.stringify(input.availability)}`,
      countryBenefitGuidance,
      '',
      'NUMERIC_HINTS:',
      JSON.stringify(input.numericHints),
      'PAPAYA_TEXT (presence-gated):',
      input.text || 'N/A',
      'OUTPUT_SCHEMA (example shape):',
      schema
    ].join('\n')
  }

  private extractJson(text: string): string {
    const t = (text || '').trim()
    if (!t) return t

    // Prefer fenced block first
    const fence = t.match(/```(?:json)?\n([\s\S]*?)\n```/i)
    if (fence) return fence[1].trim()

    // Handle array-wrapped JSON: [{ ... }] -> { ... }
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t)
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'object') {
          return JSON.stringify(parsed[0])
        }
      } catch {
        // Fall through to other extraction methods
      }
    }

    // If whole text is a single JSON object
    if (t.startsWith('{')) {
      // Attempt to trim trailing non-JSON using balanced brace scan
      const obj = this.extractBalancedObject(t)
      if (obj) return obj
    }

    // Otherwise, scan for the first balanced JSON object within the text
    for (let idx = 0; idx < t.length; idx++) {
      if (t[idx] === '{') {
        const obj = this.extractBalancedObject(t.substring(idx))
        if (obj) return obj
      }
    }

    // Fallback: last resort heuristic
    const i = t.indexOf('{'); const j = t.lastIndexOf('}')
    if (i >= 0 && j > i) return t.substring(i, j + 1)
    return t
  }

  // Extract all parseable JSON object candidates from text, ordered by preference
  private extractAllJson(text: string): string[] {
    const t = (text || '').trim()
    const out: string[] = []
    if (!t) return out

    // 1) Fenced blocks first (usually the intended output)
    const fenceRe = /```(?:json)?\n([\s\S]*?)\n```/gi
    let m: RegExpExecArray | null
    while ((m = fenceRe.exec(t)) !== null) {
      const snippet = (m[1] || '').trim()
      if (!snippet) continue
      try { JSON.parse(snippet); out.push(snippet) } catch { /* ignore */ }
    }

    // 2) Handle array-wrapped JSON: [{ ... }] -> { ... }
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t)
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'object') {
          out.push(JSON.stringify(parsed[0]))
        }
      } catch { /* ignore */ }
    }

    // 3) Full text if it looks like a single object
    if (t.startsWith('{')) {
      const obj = this.extractBalancedObject(t)
      if (obj) out.push(obj)
    }

    // 4) Scan for any balanced objects within the text
    for (let idx = 0; idx < t.length; idx++) {
      if (t[idx] === '{') {
        const obj = this.extractBalancedObject(t.substring(idx))
        if (obj) out.push(obj)
      }
    }

    // De-duplicate while preserving order
    return Array.from(new Set(out))
  }

  private normalizePrepassCandidate(input: unknown): unknown {
    const parseIfJsonString = (value: unknown): unknown => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
      try { return JSON.parse(trimmed) } catch { return value }
    }

    let candidate = parseIfJsonString(input)
    const unwrapKeys = ['legal_profile', 'profile', 'result', 'data', 'output', 'response']
    let depth = 0

    while (
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      depth < 5 &&
      !(('meta' in candidate) && ('availability' in candidate) && ('items' in candidate))
    ) {
      let next: unknown = null
      for (const key of unwrapKeys) {
        if (Object.prototype.hasOwnProperty.call(candidate, key)) {
          next = parseIfJsonString((candidate as Record<string, unknown>)[key])
          break
        }
      }
      if (!next) break
      candidate = next
      depth++
    }

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const obj = candidate as Record<string, unknown>
      obj.meta = parseIfJsonString(obj.meta)
      const rawAvailability = parseIfJsonString(obj.availability) as Record<string, boolean> | undefined
      if (rawAvailability) {
        obj.availability = this.normalizeAvailability(rawAvailability)
        if (process.env.NODE_ENV === 'development') {
          console.log('[CerebrasService] Normalized availability from Cerebras response:', {
            raw: rawAvailability,
            normalized: obj.availability
          })
        }
      } else {
        // If Cerebras didn't return availability, use country code to generate defaults
        const meta = obj.meta as any
        const countryCode = meta?.country_code || 'US'
        obj.availability = PapayaAvailability.getFlags(countryCode)
        if (process.env.NODE_ENV === 'development') {
          console.log('[CerebrasService] Using fallback availability for country:', countryCode, obj.availability)
        }
      }

      const parsedItems = Array.isArray(obj.items) ? obj.items : parseIfJsonString(obj.items)
      if (Array.isArray(parsedItems)) {
        obj.items = this.normalizeCategoryFields(parsedItems)
      } else if (parsedItems && typeof parsedItems === 'object') {
        obj.items = this.normalizeCategoryFields(Object.values(parsedItems))
      }

      obj.subtotals = parseIfJsonString(obj.subtotals)

      const parsedWarnings = Array.isArray(obj.warnings) ? obj.warnings : parseIfJsonString(obj.warnings)
      if (Array.isArray(parsedWarnings)) {
        obj.warnings = parsedWarnings
      } else if (parsedWarnings) {
        obj.warnings = [parsedWarnings]
      }
    }

    return candidate
  }

  private normalizeCategoryFields(items: any[]): any[] {
    const validCategories = ['contributions', 'bonuses', 'allowances', 'termination'] as const
    const categoryMapping: Record<string, typeof validCategories[number]> = {
      'common_benefits': 'allowances',
      'benefit': 'allowances',
      'benefits': 'allowances',
      'salary': 'bonuses',
      'salaries': 'bonuses',
      'contribution': 'contributions',
      'terminations': 'termination',
      'bonus': 'bonuses',
      'allowance': 'allowances'
    }

    const normalizeVariableValue = (value: unknown): number | string | boolean | undefined => {
      if (value == null) return undefined
      if (typeof value === 'number' || typeof value === 'boolean') return value
      if (typeof value === 'string') return value
      if (Array.isArray(value)) {
        const filtered = value.filter(entry => entry != null)
        if (filtered.length === 0) return undefined
        if (filtered.every(entry => typeof entry === 'number')) {
          return Number((filtered as number[]).reduce((sum, n) => sum + n, 0) / filtered.length)
        }
        return filtered.map(entry => {
          if (entry == null) return ''
          if (typeof entry === 'object') {
            try { return JSON.stringify(entry) } catch { return String(entry) }
          }
          return String(entry)
        }).join(' | ')
      }
      if (typeof value === 'object') {
        try { return JSON.stringify(value) } catch { return String(value) }
      }
      return undefined
    }

    return items.map(item => {
      if (item && typeof item === 'object' && item.category) {
        const normalizedVariables: Record<string, number | string | boolean> = {}
        if (item.variables && typeof item.variables === 'object') {
          Object.entries(item.variables).forEach(([key, value]) => {
            const normalized = normalizeVariableValue(value)
            if (normalized !== undefined) {
              normalizedVariables[key] = normalized
            }
          })
          item.variables = normalizedVariables
        }

        const category = String(item.category).toLowerCase()

        // If category is already valid, keep it
        if (validCategories.includes(category as any)) {
          return item
        }

        // Try to map invalid category to valid one
        const mappedCategory = categoryMapping[category]
        if (mappedCategory) {
          return {
            ...item,
            category: mappedCategory
          }
        }

        // If no mapping found, try to guess based on item name/key
        const itemName = String(item.name || item.key || '').toLowerCase()
        let guessedCategory: typeof validCategories[number] = 'allowances' // default fallback

        if (itemName.includes('contribution') || itemName.includes('social') || itemName.includes('tax')) {
          guessedCategory = 'contributions'
        } else if (itemName.includes('13th') || itemName.includes('14th') || itemName.includes('salary') || itemName.includes('bonus')) {
          guessedCategory = 'bonuses'
        } else if (itemName.includes('termination') || itemName.includes('severance') || itemName.includes('notice')) {
          guessedCategory = 'termination'
        } else {
          guessedCategory = 'allowances' // meal vouchers, transport, etc.
        }

        return {
          ...item,
          category: guessedCategory
        }
      }
      return item
    })
  }

  private extractBalancedObject(s: string): string | null {
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (inStr) {
        if (esc) { esc = false; continue }
        if (ch === '\\') { esc = true; continue }
        if (ch === '"') { inStr = false; continue }
        continue
      }
      if (ch === '"') { inStr = true; continue }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          const candidate = s.substring(0, i + 1)
          try {
            JSON.parse(candidate)
            return candidate.trim()
          } catch { /* try continue scanning */ }
        }
      }
    }
    return null
  }

  // Clean LLM response to remove thinking tags and non-JSON content
  private cleanLLMResponse(content: string): string {
    if (!content || typeof content !== 'string') return content

    // Remove thinking tags and their content
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '')

    // Remove thinking blocks that might not have closing tags
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '')

    // Remove other common LLM artifacts
    cleaned = cleaned.replace(/^[^{]*({[\s\S]*})[^}]*$/g, '$1') // Extract JSON part

    // Remove leading/trailing text before/after JSON
    cleaned = cleaned.replace(/^[^{]*/, '').replace(/[^}]*$/, '')

    return cleaned.trim()
  }

  // Convert a validated parsed object into a strongly-typed PrepassLegalProfile
  private toPrepassProfile(parsed: z.infer<typeof PrepassSchema>): PrepassLegalProfile {
    return {
      meta: parsed.meta,
      availability: parsed.availability,
      items: parsed.items as unknown as PrepassLegalItem[],
      subtotals: parsed.subtotals,
      total_monthly_local: parsed.total_monthly_local,
      warnings: parsed.warnings
    }
  }

  private normalizeAvailability(input: Record<string, boolean>): PapayaAvailabilityFlags {
    const b = (k: string) => Boolean(input?.[k])
    return {
      contribution_employer_contributions: b('contribution_employer_contributions') || b('contribution{employer_contributions}'),
      contribution_employee_contributions: b('contribution_employee_contributions') || b('contribution{employee_contributions}'),
      contribution_income_tax: b('contribution_income_tax') || b('contribution{income_tax}'),
      payroll_13th_salary: b('payroll_13th_salary') || b('payroll{13th_salary}') || b('payroll{13th_&_14th_salaries}'),
      payroll_14th_salary: b('payroll_14th_salary') || b('payroll{14th_salary}') || b('payroll{13th_&_14th_salaries}'),
      payroll_13th_and_14th: b('payroll_13th_and_14th') || b('payroll{13th_&_14th_salaries}'),
      payroll_cycle: b('payroll_cycle') || b('payroll{payroll_cycle}') || b('payroll{payroll_frequency}'),
      termination_notice_period: b('termination_notice_period') || b('termination{notice_period}'),
      termination_severance_pay: b('termination_severance_pay') || b('termination{severance_pay}') || b('termination{severance}') ,
      termination_probation_period: b('termination_probation_period') || b('termination{probation_period}') || b('termination{probation}'),
      common_benefits: b('common_benefits'),
      remote_work: b('remote_work'),
      authority_payments: b('authority_payments'),
      minimum_wage: b('minimum_wage')
    }
  }
}
