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

    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt({ meta, availability, numericHints, text: snippets.join('\n').trim() })

    // Debug logging for development
     if (typeof window === 'undefined') {
      try {
        console.log('[Cerebras] Build Legal Profile - Request Details:', {
          method: 'buildLegalProfile',
          countryCode: countryCode,
          model: "qwen-3-32b",
          temperature: 0.1,
          max_completion_tokens: 8192,
          meta: meta,
          availability: availability,
          prompts: {
            system: systemPrompt,
            user: userPrompt
          }
        })
      } catch {/* noop */}
    }

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

      // Debug logging for retry attempt
       if (typeof window === 'undefined') {
        try {
          console.log('[Cerebras] Build Legal Profile - Retrying without response_format:', {
            method: 'buildLegalProfile',
            countryCode: countryCode,
            error_message: msg,
            error_code: code
          })
        } catch {/* noop */}
      }

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

    // Debug logging for development
     if (typeof window === 'undefined') {
      try {
        console.log('[Cerebras] Build Legal Profile - Response Details:', {
          method: 'buildLegalProfile',
          countryCode: countryCode,
          usage: {
            prompt_tokens: response?.usage?.prompt_tokens,
            completion_tokens: response?.usage?.completion_tokens,
            total_tokens: response?.usage?.total_tokens
          },
          response_length: content.length,
          raw_content: content
        })
      } catch {/* noop */}
    }

    // Try to find a candidate JSON object that matches the schema
    const candidates = this.extractAllJson(content)
    let lastError: unknown = null

    // Debug logging for development
    if (typeof window === 'undefined') {
      try {
        console.log('[Cerebras] Schema Validation Debug:', {
          method: 'buildLegalProfile',
          countryCode: countryCode,
          candidatesFound: candidates.length,
          candidateTypes: candidates.map((c, i) => {
            try {
              const p = JSON.parse(c)
              return `${i}: ${Array.isArray(p) ? 'Array' : typeof p}`
            } catch {
              return `${i}: Invalid JSON`
            }
          })
        })
      } catch {/* noop */}
    }

    for (const cand of candidates) {
      try {
        const parsed = JSON.parse(cand)
        const safe = PrepassSchema.safeParse(parsed)
        if (safe.success) return this.toPrepassProfile(safe.data)

        // Debug logging for schema errors
        if (typeof window === 'undefined') {
          try {
            console.log('[Cerebras] Schema Validation Failed:', {
              method: 'buildLegalProfile',
              countryCode: countryCode,
              candidateType: Array.isArray(parsed) ? 'Array' : typeof parsed,
              hasRequiredKeys: parsed && typeof parsed === 'object' ? {
                meta: 'meta' in parsed,
                availability: 'availability' in parsed,
                items: 'items' in parsed,
                subtotals: 'subtotals' in parsed,
                total_monthly_local: 'total_monthly_local' in parsed,
                warnings: 'warnings' in parsed
              } : false,
              errorPath: safe.error?.issues?.[0]?.path?.join('.'),
              errorMessage: safe.error?.issues?.[0]?.message
            })
          } catch {/* noop */}
        }

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
      const safe = PrepassSchema.safeParse(parsed)
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
      '- All-inclusive: include statutory + common benefits ONLY when numeric values are present or can be safely computed.',
      '',
      'DATA USE:',
      '- Prefer numeric values extracted from Papaya text when present.',
      '- If Papaya lacks numbers for a required item, use NUMERIC_HINTS as a fallback source.',
      '- Use AVAILABILITY flags to include sections only when present for the country.',
      '- For employer contributions with multiple rate options (e.g., different company sizes), choose the higher/conservative rate and include only ONE entry per contribution type.',
      '',
      'Return JSON only.'
    ].join('\n')
  }

  private buildUserPrompt(input: { meta: PrepassLegalProfile['meta']; availability: PapayaAvailabilityFlags; numericHints: any; text: string }): string {
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
