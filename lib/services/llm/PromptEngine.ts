// PromptEngine - Prompt builders for extraction, enhancement, and arithmetic compute

import { EnhancementInput } from "@/lib/types/enhancement"

export class PromptEngine {
  // Legacy enhancement system prompt (kept concise)
  static buildSystemPrompt(): string {
    return `You are an expert EOR (Employer of Record) analyst.
Provide conservative, legally grounded analyses.
Always output valid JSON; amounts are monthly in the quote currency.`
  }

  // Legacy enhancement user prompt
  static buildUserPrompt(input: EnhancementInput): string {
    const modeGuidance = input.quoteType === 'statutory-only'
      ? `MODE: STATUTORY-ONLY\nInclude ONLY legally mandated items. Do NOT add optional/perk benefits.`
      : `MODE: ALL-INCLUSIVE\nInclude statutory items and common mandated allowances; avoid double-counting.`

    return `ENHANCEMENT ANALYSIS REQUEST:\n\n` +
      `PROVIDER: ${input.provider.toUpperCase()}\n` +
      `QUOTE TYPE: ${input.quoteType.toUpperCase()}\n` +
      `CONTRACT DURATION: ${input.contractDurationMonths} months\n\n` +
      `BASE PROVIDER QUOTE:\n` +
      `- Provider: ${input.providerQuote.provider}\n` +
      `- Monthly Total: ${input.providerQuote.monthlyTotal} ${input.providerQuote.currency}\n` +
      `- Base Salary: ${input.providerQuote.baseCost} ${input.providerQuote.currency}\n` +
      `- Country: ${input.providerQuote.country}\n\n` +
      (input.extractedBenefits
        ? `EXTRACTED PROVIDER BENEFITS (Pass 1 Results):\n${JSON.stringify(input.extractedBenefits, null, 2)}\n\n`
        : `DETAILED PROVIDER API RESPONSE:\n${JSON.stringify(input.providerQuote.originalResponse, null, 2)}\n\n`) +
      `EMPLOYMENT DETAILS:\n` +
      `- Employee Salary: ${input.formData.baseSalary} ${input.providerQuote.currency}\n` +
      `- Country: ${input.formData.country}\n` +
      `- Employment Type: ${input.formData.employmentType}\n` +
      `- Contract Duration: ${input.contractDurationMonths} months\n\n` +
      `LEGAL REQUIREMENTS SUMMARY:\n${this.summarizeLegalRequirements(input.papayaData)}\n\n` +
      `${modeGuidance}\n\n` +
      `YOUR TASK:\n` +
      (input.extractedBenefits
        ? `- TRUST the extracted benefits. Mark already_included items and set enhancement amounts to 0.\n`
        : `- Analyze the provider response carefully. Avoid double-counting.\n`) +
      `Respond with valid JSON.`
  }

  // Pass 3: arithmetic compute system prompt
  static buildArithmeticSystemPrompt(): string {
    return `You are an expert EOR (Employer of Record) cost analyst.
Compute monthly enhancement items and final monthly total using:
- Base monthly cost and base salary
- Extracted provider inclusions (already_included items must not be added)
- Legal profile summary and formulas
- Quote type rules (statutory-only vs all-inclusive)

STRICT RULES:
- All outputs are monthly amounts in the given currency.
- Apply the provided formulas exactly and round each item and totals to 2 decimals (half-up).
- Do NOT double-count items already included by the provider.
- Statutory-only: include ONLY items mandated by law; skip optional/perk allowances.
- All-inclusive: include statutory and commonly mandatory allowances.
- Totals must satisfy: TOTAL_ENHANCEMENTS = sum(items); FINAL_MONTHLY_TOTAL = BASE_MONTHLY + TOTAL_ENHANCEMENTS.
- Respond with valid JSON (no code fences).`
  }

  // Pass 3: arithmetic compute user prompt
  static buildArithmeticUserPrompt(params: {
    provider: string
    baseMonthly: number
    baseSalary: number
    currency: string
    quoteType: 'all-inclusive' | 'statutory-only'
    contractMonths: number
    extractedBenefits: any
    legalProfile: { id: string; summary: string; formulas: string }
  }): string {
    const { provider, baseMonthly, baseSalary, currency, quoteType, contractMonths, extractedBenefits, legalProfile } = params
    return [
      `ARITHMETIC COMPUTE REQUEST (Pass 3)`,
      `PROVIDER: ${provider}`,
      `QUOTE TYPE: ${quoteType}`,
      `BASE MONTHLY: ${baseMonthly} ${currency}`,
      `BASE SALARY: ${baseSalary} ${currency}`,
      `CONTRACT MONTHS: ${contractMonths}`,
      `CURRENCY: ${currency}`,
      '',
      `LEGAL PROFILE ID: ${legalProfile.id}`,
      `LEGAL PROFILE SUMMARY:`,
      legalProfile.summary,
      '',
      `FORMULAS:`,
      legalProfile.formulas,
      '',
      `EXTRACTED PROVIDER INCLUSIONS:`,
      JSON.stringify(extractedBenefits, null, 2),
      '',
      `OUTPUT JSON EXAMPLE (MATCH EXACT KEYS):`,
      '{',
      '  "enhancements": {',
      '    "termination_costs": {',
      '      "notice_period_cost": 0,',
      '      "severance_cost": 0,',
      '      "total": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0',
      '    },',
      '    "thirteenth_salary": {',
      '      "monthly_amount": 0,',
      '      "yearly_amount": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0,',
      '      "already_included": false',
      '    },',
      '    "fourteenth_salary": {',
      '      "monthly_amount": 0,',
      '      "yearly_amount": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0,',
      '      "already_included": false',
      '    },',
      '    "vacation_bonus": {',
      '      "amount": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0,',
      '      "already_included": false',
      '    },',
      '    "transportation_allowance": {',
      '      "monthly_amount": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0,',
      '      "already_included": false,',
      '      "mandatory": false',
      '    },',
      '    "remote_work_allowance": {',
      '      "monthly_amount": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0,',
      '      "already_included": false,',
      '      "mandatory": false',
      '    },',
      '    "meal_vouchers": {',
      '      "monthly_amount": 0,',
      '      "explanation": "",',
      '      "confidence": 0.0,',
      '      "already_included": false',
      '    }',
      '  },',
      '  "totals": {',
      '    "total_monthly_enhancement": 0,',
      '    "final_monthly_total": 0',
      '  },',
      '  "confidence_scores": { "overall": 0.0 },',
      '  "warnings": [],',
      '  "recommendations": []',
      '}',
      '',
      'REQUIREMENTS:',
      '- Use the exact keys as above.',
      '- For items ALREADY INCLUDED in the extracted benefits (amount > 0), set already_included=true and enhancement amounts to 0.',
      '- In statutory-only mode, include ONLY items that are mandatory by law (set mandatory=true for allowances that are legally required).',
      '- Compute termination_costs using the given formulas and divide by contract months to monthlyize.',
      '- Set final_monthly_total = base_monthly + total_monthly_enhancement.'
    ].join('\n')
  }

  // Pass 1: extraction system prompt
  static buildExtractionSystemPrompt(): string {
    return `You are an expert EOR benefit extraction specialist. Extract and standardize ALL salary components and benefits from provider API responses.
RULES: amounts monthly in quote currency; include benefits found with amount > 0; set amount 0 for not found; only extract (no estimation).`
  }

  // Pass 1: extraction user prompt
  static buildExtractionUserPrompt(originalResponse: unknown, provider: string): string {
    return `BENEFIT EXTRACTION REQUEST:\n\n` +
      `PROVIDER: ${provider.toUpperCase()}\n` +
      `API RESPONSE TO ANALYZE:\n${JSON.stringify(originalResponse, null, 2)}\n\n` +
      `Respond with standardized JSON including: baseSalary, currency, country, monthlyTotal, includedBenefits{...}, totalMonthlyBenefits, extractionConfidence, extractedAt.`
  }

  // Utility: summarize Papaya snippets
  private static summarizeLegalRequirements(papayaData: any): string {
    if (!papayaData?.data) return 'No detailed legal data available'
    const parts: string[] = []
    if (papayaData.data.termination) {
      const t = papayaData.data.termination
      parts.push(`TERMINATION: ${t.notice_period || 'Standard notice'}, ${t.severance_pay || 'Standard severance'}`)
    }
    if (papayaData.data.payroll?.payroll_cycle) {
      const p = papayaData.data.payroll.payroll_cycle
      if (p.toLowerCase().includes('13th')) parts.push('13TH SALARY: may be required')
      if (p.toLowerCase().includes('14th')) parts.push('14TH SALARY: may be required')
    }
    if (papayaData.data.contribution?.employer_contributions) {
      const first = papayaData.data.contribution.employer_contributions.slice(0, 3).map((c: any) => `${c.description}: ${c.rate}`)
      if (first.length) parts.push(`CONTRIBUTIONS: ${first.join(', ')}`)
    }
    if (papayaData.data.common_benefits?.length) {
      parts.push(`COMMON BENEFITS: ${papayaData.data.common_benefits.slice(0, 3).join(', ')}`)
    }
    return parts.join('\n') || 'Standard employment law applies'
  }

  // Reconciliation: system prompt
  static buildReconciliationSystemPrompt(): string {
    return (
      `You are an EOR reconciliation engine.\n` +
      `RULES:\n` +
      `- Use ONLY the provided normalized monthly totals in the selected currency.\n` +
      `- DO NOT perform currency conversion.\n` +
      `- Apply the <= threshold rule: within_band if (total - minTotal) / minTotal <= threshold.\n` +
      `- If an item has missing mandatory coverage, add a warning note; do not assume inclusions.\n` +
      `- If riskMode=true, also produce reasoning that prioritizes higher confidence, but totals remain as given.\n` +
      `- Output strictly valid JSON with the exact keys requested. No extra text.`
    )
  }

  // Reconciliation: user prompt
  static buildReconciliationUserPrompt(input: {
    settings: { currency: string; threshold: number; riskMode: boolean }
    providers: Array<{
      provider: string
      total: number
      confidence: number
      coverage: { includes: string[]; missing: string[]; doubleCountingRisk: string[] }
      quoteType: 'all-inclusive' | 'statutory-only'
    }>
  }): string {
    const header = [
      `RECONCILIATION REQUEST`,
      `CURRENCY: ${input.settings.currency}`,
      `THRESHOLD: ${input.settings.threshold}`,
      `RISK_MODE: ${input.settings.riskMode}`,
      '',
      `PROVIDERS (normalized totals in selected currency):`,
      JSON.stringify(input.providers, null, 2),
      '',
      `RESPONSE JSON SCHEMA (EXACT KEYS):`,
      '{',
      '  "items": [',
      '    { "provider": "deel", "total": 0, "delta": 0, "pct": 0, "within4": true, "confidence": 0.0, "notes": [] }',
      '  ],',
      '  "summary": {',
      '    "currency": "USD",',
      '    "cheapest": "deel",',
      '    "mostExpensive": "oyster",',
      '    "average": 0,',
      '    "median": 0,',
      '    "stdDev": 0,',
      '    "within4Count": 0',
      '  },',
      '  "recommendations": [],',
      '  "excluded": []',
      '}',
      '',
      'INSTRUCTIONS:',
      '- Rank providers by total ascending.',
      '- Compute delta and pct vs the cheapest total.',
      '- Set within4 using the provided THRESHOLD (<=).',
      '- Add notes if critical benefits are missing or double counting risk exists.',
      '- Provide 2-5 recommendations summarizing the tradeoffs.',
    ].join('\n')
    return header
  }
}
