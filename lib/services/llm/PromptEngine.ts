// PromptEngine - Prompt builders for extraction, enhancement, and arithmetic compute

import { EnhancementInput, PapayaCountryData, StandardizedBenefitData } from "@/lib/types/enhancement"

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
      ? `MODE: STATUTORY-ONLY\nInclude all legally mandated items and any documented allowances with explicit amounts. Avoid speculative perks.`
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

  // Pass 3: arithmetic compute system prompt with gap analysis focus
  static buildArithmeticSystemPrompt(): string {
    return `You are an expert EOR (Employer of Record) cost analyst specializing in MISSING BENEFITS DETECTION.

YOUR CORE TASK: Identify missing mandatory benefits by comparing provider inclusions vs legal requirements.

ANALYSIS PROCESS:
1. EXAMINE: What benefits the provider already includes (extracted provider inclusions)
2. COMPARE: Against what the legal profile says is mandatory/required
3. IDENTIFY: Missing mandatory benefits that should be included but aren't
4. COMPUTE: Monthly costs for only the missing items
5. FLAG: Benefits as already_included=true if provider covers them

STRICT RULES:
- All outputs are monthly amounts in the given currency
- Apply the provided formulas exactly and round each item to 2 decimals (half-up)
- CRITICAL: Do NOT double-count items already included by the provider
- CRITICAL: Mark already_included=true for benefits found in provider inclusions
- TERMINATION: Break termination liability into severance and notice components where data is available.
- Statutory-only: include all mandatory salaries, allowances, and benefits. ONLY EXCLUDE termination costs (severance_cost and notice_period_cost).
- All-inclusive: include ONLY items explicitly present in the legal profile (Papaya-derived) — mandatory items, allowances, termination costs with clear amounts/rates. Do NOT add anything not in the profile.
- Missing benefits must have clear legal justification from the legal profile
- SOURCE-OF-TRUTH: Use ONLY the provided legal profile (Papaya-derived). Do NOT invent or infer benefits from general knowledge or other countries.
- Totals: TOTAL_ENHANCEMENTS = sum(missing items only); FINAL_MONTHLY_TOTAL = BASE_MONTHLY + TOTAL_ENHANCEMENTS
- Respond with valid JSON (no code fences)

FOCUS: Your primary job is gap analysis - finding what's legally required but missing from the provider quote.`
  }

  // Pass 3: arithmetic compute user prompt with enhanced gap analysis structure
  static buildArithmeticUserPrompt(params: {
    provider: string
    baseMonthly: number
    baseSalary: number
    currency: string
    quoteType: 'all-inclusive' | 'statutory-only'
    contractMonths: number
    extractedBenefits: StandardizedBenefitData
    legalProfile: { id: string; summary: string; formulas: string }
  }): string {
    const { provider, baseMonthly, baseSalary, currency, quoteType, contractMonths, extractedBenefits, legalProfile } = params
    return [
      `GAP ANALYSIS REQUEST - MISSING BENEFITS DETECTION`,
      '',
      `PROVIDER: ${provider}`,
      `QUOTE TYPE: ${quoteType} (include mandatory items; allowances allowed when specified)`,
      `BASE MONTHLY: ${baseMonthly} ${currency}`,
      `BASE SALARY: ${baseSalary} ${currency}`,
      `CONTRACT MONTHS: ${contractMonths}`,
      `CURRENCY: ${currency}`,
      '',
      `═══ LEGAL REQUIREMENTS (What should be included) ═══`,
      `LEGAL PROFILE ID: ${legalProfile.id}`,
      legalProfile.summary,
      '',
      `CALCULATION FORMULAS:`,
      legalProfile.formulas,
      '',
      `═══ PROVIDER INCLUSIONS (What is already included) ═══`,
      JSON.stringify(extractedBenefits, null, 2),
      '',
      `═══ YOUR TASK: GAP ANALYSIS ═══`,
      `1. Compare LEGAL REQUIREMENTS vs PROVIDER INCLUSIONS`,
      `2. Identify benefits that are legally required but missing from provider`,
      `3. For each benefit, check if provider already includes it (amount > 0)`,
      `4. If included: set already_included=true, enhancement amount=0`,
      `5. If missing: set already_included=false, compute enhancement amount`,
      `6. Include all mandatory legal benefits plus any allowances explicitly present in the legal profile with specified amounts or rates`,
      `7. Do NOT include any benefit that is not present in the legal profile. Do NOT infer from training data.`,
      '',
      `OUTPUT JSON EXAMPLE (MATCH EXACT KEYS):`,
      '{',
      '  "enhancements": {',
      '    "severance_cost": {',
      '      "monthly_amount": 0,',
      '      "total_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false',
      '    },',
      '    "notice_period_cost": {',
      '      "monthly_amount": 0,',
      '      "total_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false',
      '    },',
      '    "thirteenth_salary": {',
      '      "monthly_amount": 0,',
      '      "yearly_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false',
      '    },',
      '    "fourteenth_salary": {',
      '      "monthly_amount": 0,',
      '      "yearly_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false',
      '    },',
      '    "vacation_bonus": {',
      '      "amount": 0,',
      '      "explanation": "",',
      '      "already_included": false',
      '    },',
      '    "transportation_allowance": {',
      '      "monthly_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false,',
      '      "mandatory": false',
      '    },',
      '    "remote_work_allowance": {',
      '      "monthly_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false,',
      '      "mandatory": false',
      '    },',
      '    "meal_vouchers": {',
      '      "monthly_amount": 0,',
      '      "explanation": "",',
      '      "already_included": false',
      '    }',
      '  },',
      '  "totals": {',
      '    "total_monthly_enhancement": 0,',
      '    "final_monthly_total": 0',
      '  },',
      '',
      '  "warnings": [],',
      '  "recommendations": []',
      '}',
      '',
      'GAP ANALYSIS REQUIREMENTS:',
      '- Use the exact keys as above.',
      '- CRITICAL: Perform thorough gap analysis between LEGAL REQUIREMENTS and PROVIDER INCLUSIONS.',
      '- For items ALREADY INCLUDED in provider benefits (amount > 0): set already_included=true, enhancement amounts to 0.',
      '- For MISSING MANDATORY items: set already_included=false, compute proper enhancement amounts.',
      '- In statutory-only mode: include all items (mandatory salaries, allowances, benefits). ONLY EXCLUDE termination costs (severance_cost and notice_period_cost).',
      '- In all-inclusive mode: include mandatory + commonly required benefits + termination costs.',
      '- Populate severance_cost and notice_period_cost with individual monthly amounts only in all-inclusive mode (set to 0 or omit in statutory-only).',
      '- Provide clear explanations for why each missing benefit is required (reference legal profile).',
      '- Set final_monthly_total = base_monthly + total_monthly_enhancement (missing items only).',
      '- If NO benefits are missing, total_monthly_enhancement should be 0.',
      '',
      'EXAMPLE GAP ANALYSIS SCENARIOS:',
      '- If legal profile requires 13th salary but provider includes 0 → add 13th salary enhancement',
      '- If legal profile requires meal vouchers but provider includes 350 BRL → set already_included=true, amount=0',
      '- If legal profile shows transportation is optional → skip in statutory-only mode'
    ].join('\n')
  }

  // Pass 1: extraction system prompt
  static buildExtractionSystemPrompt(): string {
    return `You are an expert EOR benefit extraction specialist. Extract and standardize ALL salary components and benefits from provider API responses.
RULES: amounts monthly in quote currency; include benefits found with amount > 0; set amount 0 for not found; only extract (no estimation).

CRITICAL: Detect implicit benefit inclusions by analyzing:
1. TOTAL vs SALARY gap - if monthlyTotal >> baseSalary, the difference likely contains statutory benefits
2. Generic accrual/provision fields (accrualsProvision, accruals, provisions, salary_accruals, etc.)
3. Mathematical patterns - if any field ≈ baseSalary/12, it likely contains 13th salary
4. If any field ≈ baseSalary/14, it likely contains 14th salary`
  }

  // Pass 1: extraction user prompt
  static buildExtractionUserPrompt(originalResponse: unknown, provider: string): string {
    return `BENEFIT EXTRACTION REQUEST:\n\n` +
      `PROVIDER: ${provider.toUpperCase()}\n` +
      `API RESPONSE TO ANALYZE:\n${JSON.stringify(originalResponse, null, 2)}\n\n` +
      `═══ DETECTION PATTERNS FOR ANNUAL SALARY BONUSES ═══\n\n` +
      `CRITICAL: Detect these even when not explicitly named:\n\n` +
      `13TH SALARY DETECTION:\n` +
      `• Named fields: "13th month", "13th salary", "thirteenth salary", "aguinaldo", "Christmas bonus", "year-end bonus", "decimo tercero"\n` +
      `• Implicit patterns:\n` +
      `  - Any "accrual", "provision", "accruals_provision", "salary_accruals" field ≈ baseSalary/12\n` +
      `  - If monthlyTotal = baseSalary + other_items + (baseSalary/12), the 13th is included\n` +
      `  - Calculate: Does any numeric field equal approximately baseSalary ÷ 12? → Mark as 13th salary\n\n` +
      `14TH SALARY DETECTION:\n` +
      `• Named fields: "14th month", "14th salary", "fourteenth salary", "school bonus", "decimo cuarto"\n` +
      `• Implicit patterns: Any field ≈ baseSalary/14\n\n` +
      `VACATION/CHRISTMAS BONUS:\n` +
      `• Named fields: "vacation bonus", "holiday bonus", "Christmas bonus", "aguinaldo", "prima vacacional"\n` +
      `• Implicit patterns: Check if any bonus field matches common percentages (33%, 50%, etc.)\n\n` +
      `ANALYSIS STEPS:\n` +
      `1. Extract baseSalary and monthlyTotal from response\n` +
      `2. Calculate baseSalary/12 and baseSalary/14\n` +
      `3. Check ALL numeric fields for matches (±2% tolerance)\n` +
      `4. Check field names for keywords above\n` +
      `5. If detected implicitly, set benefit amount > 0 and add explanation\n\n` +
      `EXAMPLES:\n` +
      `• If accrualsProvision = 416.67 and baseSalary = 5000 → 13th salary detected (5000÷12=416.67)\n` +
      `• If total = 5916.67, salary = 5000, explicit_items = 500 → Check if 416.67 gap = 13th salary\n` +
      `• If field "provisiones" = 357.14 and baseSalary = 5000 → 14th salary detected (5000÷14=357.14)\n\n` +
      `Respond with standardized JSON including: baseSalary, currency, country, monthlyTotal, includedBenefits{...}, totalMonthlyBenefits, extractionConfidence, extractedAt.\n\n` +
      `⚠️ IMPORTANT: If you detect 13th/14th salary implicitly, set the amount AND add detailed explanation of how it was detected (e.g., "Detected in accrualsProvision field: 416.67 ≈ baseSalary/12").`
  }

  // Smart truncation that preserves critical sections
  private static smartTruncatePapayaData(papayaData: string, maxLength: number): string {
    if (typeof papayaData !== 'string' || papayaData.length <= maxLength) {
      return papayaData
    }

    // For very large data (>200k), use simple truncation to avoid timeout
    if (papayaData.length > 200000) {
      return papayaData.slice(0, maxLength) + '\n[truncated - data too large for smart parsing]'
    }

    // Define critical sections in order of importance
    const criticalSections = [
      'COMMON_BENEFITS:',
      'PAYROLL:',
      'TERMINATION:',
      'EMPLOYER_CONTRIBUTIONS:',
      'AUTHORITY_PAYMENTS:',
      'MINIMUM_WAGE:',
      'REMOTE_WORK:'
    ]

    // Split data by sections
    const lines = papayaData.split('\n')
    const sectionGroups: Array<{ section: string; lines: string[]; priority: number }> = []
    let currentSection = ''
    let currentLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Check if this line starts a new section
      const sectionMatch = criticalSections.find(sec => trimmed.startsWith(sec))
      if (sectionMatch) {
        // Save previous section if it exists
        if (currentSection && currentLines.length > 0) {
          const priority = criticalSections.indexOf(currentSection)
          sectionGroups.push({ section: currentSection, lines: [...currentLines], priority })
        }
        // Start new section
        currentSection = sectionMatch
        currentLines = [line]
      } else {
        currentLines.push(line)
      }
    }

    // Save final section
    if (currentSection && currentLines.length > 0) {
      const priority = criticalSections.indexOf(currentSection)
      sectionGroups.push({ section: currentSection, lines: [...currentLines], priority })
    }

    // Sort by priority (lower number = higher priority)
    sectionGroups.sort((a, b) => a.priority - b.priority)

    // Build truncated result by adding sections in order until we hit the limit
    let result = ''
    let addedSections = 0

    for (const group of sectionGroups) {
      const sectionText = group.lines.join('\n')
      if ((result + sectionText).length <= maxLength - 50) { // Leave buffer for truncation message
        if (result) result += '\n'
        result += sectionText
        addedSections++
      } else {
        break
      }
    }

    // Add truncation notice if we couldn't include all sections
    if (addedSections < sectionGroups.length) {
      result += `\n\n[truncated: ${sectionGroups.length - addedSections} additional sections omitted]`
    }

    return result || papayaData.slice(0, maxLength - 20) + '\n[fallback truncated]'
  }

  // Utility: summarize Papaya snippets
  private static summarizeLegalRequirements(papayaData: PapayaCountryData): string {
    if (!papayaData?.data) return 'No detailed legal data available'
    const parts: string[] = []
    if (papayaData.data.termination) {
      const t = papayaData.data.termination
      parts.push(`TERMINATION: ${t.severance_pay || 'Standard severance'} severance requirement`)
    }
    if (papayaData.data.payroll?.payroll_cycle) {
      const p = papayaData.data.payroll.payroll_cycle
      if (p.toLowerCase().includes('13th')) parts.push('13TH SALARY: may be required')
      if (p.toLowerCase().includes('14th')) parts.push('14TH SALARY: may be required')
    }
    if (papayaData.data.authority_payments?.length) {
      const first = papayaData.data.authority_payments.slice(0, 3).map((ap: { authority_payment?: string; dates?: string }) => `${ap.authority_payment || 'Authority'}: ${ap.dates || 'Payment required'}`)
      if (first.length) parts.push(`AUTHORITY_PAYMENTS: ${first.join(', ')}`)
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
      `- Output strictly valid JSON with the exact keys requested. No extra text.`
    )
  }

  // Reconciliation: user prompt
  static buildReconciliationUserPrompt(input: {
    settings: { currency: string; threshold: number; riskMode: boolean }
    providers: Array<{
      provider: string
      total: number
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
      '    { "provider": "deel", "total": 0, "delta": 0, "pct": 0, "within4": true, "notes": [] }',
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

  // Direct Enhancement System Prompt (Form-Aware Benefit Categorization)
  static buildDirectSystemPrompt(): string {
    return `You are an expert EOR (Employer of Record) gap analyst specializing in provider-specific benefit analysis using Papaya Global legal data.

CORE MISSION: Produce different enhancement results for different providers based on their actual coverage vs legal/common requirements.

FORM DATA LOGIC (CRITICAL):
- addBenefits ≠ false (default) → Include mandatory items plus common allowances (transportation, meal vouchers, remote work, etc.)
- addBenefits = false → Include ONLY legally mandatory items unless Papaya flags a specific allowance as legally required

BENEFIT CATEGORIES:
1. MANDATORY BENEFITS: Always include if missing (13th salary, 14th salary, authority payments, allowances)
2. TERMINATION COSTS: Include severance/notice costs ONLY in all-inclusive mode (not in statutory-only)
3. COMMON BENEFITS: Include Papaya-listed allowances in both modes

PROVIDER-SPECIFIC GAP ANALYSIS:
- If provider includes benefit (amount > 0) → already_included=true, enhancement=0
- If provider missing benefit (amount = 0) → already_included=false, calculate enhancement
- Different providers MUST produce different results based on their actual inclusions

CALCULATION RULES:
- Mandatory items: Apply simplified formulas (severance_cost = base_salary ÷ 12; notice_period_cost = base_salary ÷ contract_months)
- Always emit separate severance_cost and notice_period_cost entries.
- Common benefits: Use Papaya explicit amounts from common_benefits section
- All outputs: Monthly amounts in base currency, rounded to 2 decimals
- Valid JSON only, no explanations outside JSON

SUCCESS CRITERIA: Providers with different inclusions get different enhancement totals reflecting their actual coverage gaps.`
  }

  // Direct Enhancement User Prompt (Form-Aware Comprehensive)
  static buildDirectUserPrompt(params: {
    provider: string
    baseQuote: any
    formData: any
    papayaData: string
    papayaCurrency: string
    quoteType: 'all-inclusive' | 'statutory-only'
    contractMonths: number
    extractedBenefits: StandardizedBenefitData
  }): string {
    const { provider, baseQuote, formData, papayaData, papayaCurrency, quoteType, contractMonths, extractedBenefits } = params
    
    // Build a compact snake_case map of provider included benefits with monthlyized amounts
    const src = extractedBenefits?.includedBenefits || ({} as any)
    const monthlyOf = (x: any) => {
      if (!x) return 0
      const amt = typeof x.amount === 'number' ? x.amount : 0
      const freq = (x.frequency || '').toLowerCase()
      return freq === 'yearly' ? amt / 12 : amt
    }
    const includedSnakeCase: Record<string, number> = {
      thirteenth_salary: monthlyOf(src.thirteenthSalary),
      fourteenth_salary: monthlyOf(src.fourteenthSalary),
      vacation_bonus: monthlyOf(src.vacationBonus),
      transportation_allowance: monthlyOf(src.transportationAllowance),
      remote_work_allowance: monthlyOf(src.remoteWorkAllowance),
      meal_vouchers: monthlyOf(src.mealVouchers),
      social_security: monthlyOf(src.socialSecurity),
      health_insurance: monthlyOf(src.healthInsurance),
      severance_cost: 0,
      notice_period_cost: 0,
    }

    // Form data logic for benefit inclusion
    const addBenefitsFlag = formData.addBenefits
    const includeCommonBenefits = addBenefitsFlag !== false || quoteType === 'statutory-only'
    const addBenefitsDisplay = addBenefitsFlag !== false
      ? 'true'
      : quoteType === 'statutory-only'
        ? 'false (overridden for statutory-only requirements)'
        : 'false'
    
    const formLogic = `
FORM DATA ANALYSIS:
- Quote Type: ${quoteType}
- Add Benefits Checkbox: ${addBenefitsDisplay}
- Effective Include Allowances: ${includeCommonBenefits}
- Contract Duration: ${contractMonths} months

INCLUSION LOGIC FOR THIS REQUEST:
${includeCommonBenefits
  ? '→ INCLUDE mandatory legal items plus common allowances (transportation, meal vouchers, remote work, etc.)'
  : '→ MANDATORY ONLY: Include only legally required items'}`

    // Smart truncation that preserves critical sections
    const limitedPapayaData = this.smartTruncatePapayaData(papayaData, 50000)

    return [
      `PROVIDER GAP ANALYSIS: ${provider.toUpperCase()} - ${baseQuote.country}`,
      '',
      formLogic,
      '',
      '═══ STEP 1: PROVIDER CURRENT COVERAGE ═══',
      'What does THIS provider already include (monthly amounts):',
      JSON.stringify(includedSnakeCase, null, 2),
      '',
      '═══ STEP 2: LEGAL + COMMON REQUIREMENTS ═══',
      `Base Salary: ${formData.baseSalary} ${baseQuote.currency}`,
      `Contract: ${contractMonths} months`,
      '',
      'PAPAYA GLOBAL DATA:',
      limitedPapayaData,
      '',
      '═══ STEP 3: BENEFIT CLASSIFICATION ═══',
      '',
      'MANDATORY BENEFITS (always include if missing):',
      '• 13th Salary: Check payroll section for "Aguinaldo" or "13th month"',
      '• Termination Provisions: Check termination section (severance + notice obligations)',
      '',
      includeCommonBenefits ? [
        'COMMON BENEFITS (include if missing):',
        '• Meal Vouchers: Check common_benefits section',
        '• Transportation: Check common_benefits section', 
        '• Internet/Mobile: Check common_benefits section',
        '• Health Insurance: Check common_benefits section',
        '• Other allowances with explicit amounts',
        ...(addBenefitsFlag === false && quoteType === 'statutory-only'
          ? ['• NOTE: Even with addBenefits=false, statutory-only mode requires including Papaya-listed allowances.']
          : [])
      ].join('\n') : 'COMMON BENEFITS: SKIP (addBenefits set to false for this request)',
      '',
      '═══ STEP 4: GAP ANALYSIS PER BENEFIT ═══',
      '',
      '⚠️ IMPORTANT: TERMINATION PROVISIONS (severance, notice) should ONLY be calculated in all-inclusive mode, NOT in statutory-only mode.',
      '',
      'For regular benefits (salary components, allowances):',
      '',
      'EXAMPLE 1 - Provider includes 13th salary:',
      '• Provider coverage: thirteenth_salary = 416.67 (included)',
      '• Legal requirement: Papaya shows 13th salary mandatory',
      '• Result: already_included=true, monthly_amount=0',
      '• Reasoning: "Provider already includes 13th salary"',
      '',
      'EXAMPLE 2 - Provider missing mandatory benefit:',
      '• Provider coverage: fourteenth_salary = 0 (missing)',
      '• Legal requirement: Papaya shows 14th salary required',
      '• Calculation: BASE_SALARY ÷ 12',
      '• Result: already_included=false, monthly_amount=calculated',
      '• Reasoning: "Provider missing 14th salary. Papaya requires..."',
      '',
      includeCommonBenefits ? [
        'EXAMPLE 3 - Common benefit (includeCommonBenefits=true path):',
        '• Provider coverage: meal_vouchers = 0 (missing)',
        '• Papaya shows: "Meal Vouchers – 6,000 ARS monthly"',
        '• Result: already_included=false, monthly_amount=6000',
        '• Reasoning: "Provider missing meal vouchers. Papaya shows 6,000 ARS standard"'
      ].join('\n') : '',
      '',
      '═══ CALCULATION FORMULAS ═══',
      '• 13th Salary: BASE_SALARY ÷ 12 (if Papaya says mandatory)',
      '• Severance: SEVERANCE_MONTHS × BASE_SALARY ÷ CONTRACT_MONTHS',
      '• Severance Cost: BASE_SALARY ÷ 12',
      '• Notice Period Cost: BASE_SALARY ÷ CONTRACT_MONTHS',
      '• Common Benefits: Use exact monthly amounts from Papaya common_benefits',
      '• Currency: Convert Papaya amounts to base currency if needed',
      '',
      '═══ VERIFICATION REQUIREMENTS ═══',
      'Your analysis section MUST show:',
      `• provider_coverage: What ${provider} currently includes`,
      `• missing_requirements: What ${provider} needs based on legal/form requirements`,
      '• Ensure different providers get different enhancement totals',
      '',
      'DYNAMIC JSON OUTPUT INSTRUCTIONS:',
      '',
      'DO NOT use a fixed schema. Instead, create enhancement objects dynamically for EVERY benefit/cost you discover in the Papaya data.',
      '',
      'STEP-BY-STEP PARSING APPROACH:',
      '',
      '🔴 PHASE 1: QUOTE TYPE FILTERING',
      '',
      '1. TERMINATION COSTS (CALCULATE ONLY IN ALL-INCLUSIVE MODE):',
      '   • RULE: Termination costs are ONLY included in all-inclusive mode, NOT in statutory-only mode',
      '   • If quoteType === "all-inclusive": Calculate termination costs using formula below',
      '   • If quoteType === "statutory-only": Skip termination costs entirely',
      '   • SIMPLE FORMULA (when applicable): termination_monthly = (BASE_SALARY × 3) ÷ CONTRACT_MONTHS',
      '   • EXPLANATION: Assumes ~2-3 months total termination liability spread over contract',
      '',
      '🟡 PHASE 2: GAP ANALYSIS FOR REGULAR BENEFITS',
      '',
      '2. PAYROLL SECTION ANALYSIS:',
      '   • Search for "13th", "Aguinaldo", "thirteenth" → Calculate BASE_SALARY ÷ 12',
      '   • Search for "14th", "fourteenth" → Calculate BASE_SALARY ÷ 12', 
      '   • Search for vacation bonus, vacation pay percentages → Calculate accordingly',
      '   • Look for payment cycle requirements and additional salary components',
      '',
      '3. COMMON_BENEFITS SECTION PARSING (when includeCommonBenefits=true):',
      '   • Parse EVERY line containing benefit amounts',
      '   • Extract amounts in format "X to Y currency" → use midpoint: (X+Y)÷2',
      '   • Convert daily amounts to monthly: daily_amount × 22 working days',
      '   • Create separate objects for each benefit found',
      '',
      '4. MINIMUM_WAGE & AUTHORITY_PAYMENTS:',
      '   • Check for mandatory payment requirements',
      '   • Look for fixed costs that employers must pay',
      '',
      '5. LEAVE SECTION ANALYSIS:',
      '   • Check for paid leave that employers must fund',
      '   • Calculate if there are specific employer costs mentioned',
      '',
      'FLEXIBLE BENEFIT OBJECT CREATION FRAMEWORK:',
      '',
      'Create dynamic objects based on benefit type discovered. Adapt field names and structure to the specific benefit:',
      '',
      'TYPE 1 - SALARY COMPONENTS (13th, 14th, vacation bonus):',
      '{"monthly_amount": X, "yearly_amount": Y, "explanation": "Papaya text quote", "already_included": boolean}',
      '',
      'TYPE 2 - FIXED ALLOWANCES (meal, transport, internet, mobile, gym):',
      '{"monthly_amount": X, "explanation": "Papaya text quote", "already_included": boolean, "mandatory": boolean}',
      '',
      'TYPE 3 - TERMINATION COMPONENTS (calculate only in all-inclusive mode):',
      '{"monthly_amount": X, "total_amount": Y, "explanation": "Papaya termination requirement", "already_included": boolean}',
      '  • Emit separate objects for "severance_cost" and "notice_period_cost" only in all-inclusive mode',
      '  • In statutory-only mode: Do not include these at all',
      '',
      'TYPE 4 - RANGE-BASED BENEFITS (amounts like "5,000 to 7,000"):',
      '{"monthly_amount": midpoint, "min_amount": X, "max_amount": Y, "explanation": "Papaya text quote", "already_included": boolean}',
      '',
      'TYPE 5 - DAILY-TO-MONTHLY CONVERSION:',
      '{"monthly_amount": daily_amount * 22, "daily_amount": X, "explanation": "Papaya text quote", "already_included": boolean}',
      '',
      'NAMING CONVENTIONS:',
      '• Use descriptive snake_case: "private_health_insurance", "internet_allowance"',
      '• Be specific: "meal_vouchers" not "meal", "internet_allowance" not "internet"',
      '• Match Papaya terminology when possible',
      '',
      'EXAMPLE DISCOVERY PROCESS:',
      '• Find "Gym Allowance – 5,000 to 7,000 ARS monthly" → Create "gym_allowance" object',
      '• Find "Internet Allowance – 2,500 ARS monthly" → Create "internet_allowance" object',
      '• Find "Private Health Insurance – 10,000 to 12,000 ARS monthly" → Create "private_health_insurance" object',
      '• Find termination section in all-inclusive mode → Create "severance_cost" and "notice_period_cost" objects',
      '• Find termination section in statutory-only mode → Skip termination costs entirely',
      '',
      'JSON STRUCTURE:',
      `{
        "analysis": {
          "provider_coverage": ["List what ${provider} actually includes"],
          "missing_requirements": ["List what ${provider} is missing"],
          "benefit_mode": "${includeCommonBenefits ? 'mandatory+allowances' : 'mandatory-only'}",
          "papaya_sections_parsed": ["payroll", "termination", "common_benefits"],
          "total_benefits_found": 0
        },
        "enhancements": {
          // CREATE OBJECTS DYNAMICALLY FOR EVERY BENEFIT YOU FIND
          // Examples of what you might discover:
          // "thirteenth_salary": {...},
          // "severance_cost": {...},
          // "notice_period_cost": {...},
          // "gym_allowance": {...},
          // "internet_allowance": {...},
          // "meal_vouchers": {...},
          // "transportation_allowance": {...},
          // etc.
        },
        "totals": {
          "total_monthly_enhancement": 0,
          "final_monthly_total": ${baseQuote.monthlyTotal}
        },
      }`,
      '',
      'EXHAUSTIVE DISCOVERY MANDATE:',
      '',
      'PRIMARY DIRECTIVE: FIND EVERY POSSIBLE COST/BENEFIT',
      '• Read EVERY section of Papaya data thoroughly',
      '• Create objects for EVERY benefit/cost mentioned with amounts',
      '• When in doubt, INCLUDE rather than exclude',
      '• Better to over-include than miss legitimate costs',
      '',
      'COMPREHENSIVE COVERAGE REQUIREMENTS:',
      '• TERMINATION COSTS: Calculate severance and notice components ONLY in all-inclusive mode. Skip entirely in statutory-only mode.',
      '• MANDATORY BENEFITS: Always include regardless of form settings (13th salary, statutory bonuses, allowances)',
      '• COMMON BENEFITS: Include ALL when includeCommonBenefits=true (be exhaustive)',
      '• RANGES: Use midpoint calculations for "X to Y" amounts',
      '',
      'ROBUST COST CALCULATION RULES:',
      '',
      '1. EXACT AMOUNTS: "5,000 ARS monthly" → use 5000',
      '2. COMPLETE RANGES: "5,000 to 7,000 ARS" → use midpoint: (5000+7000)÷2 = 6000',
      '3. INCOMPLETE RANGES:',
      '   • "Up to 5,000 ARS" → use 65% of max: 5000 × 0.65 = 3250',
      '   • "Starting from 3,000 ARS" → use 130% of min: 3000 × 1.3 = 3900',
      '   • "Around 4,000 ARS" → use stated amount: 4000',
      '4. PERCENTAGE CALCULATIONS:',
      '   • "3% of salary" → BASE_SALARY × 0.03',
      '   • "2% to 5% of salary" → BASE_SALARY × midpoint (3.5%)',
      '   • "Up to 4% of salary" → BASE_SALARY × 2.6% (65% of max)',
      '5. TIME CONVERSIONS:',
      '   • Daily → Monthly: daily_amount × 22 working days',
      '   • Weekly → Monthly: weekly_amount × 4.33',
      '   • Yearly → Monthly: yearly_amount ÷ 12',
      '6. NO COST SPECIFIED:',
      '   • "Meal vouchers available" (no amount) → Use industry standard: BASE_SALARY × 0.02',
      '   • "Internet stipend provided" → Use standard: BASE_SALARY × 0.015',
      '   • "Transportation allowance" → Use standard: BASE_SALARY × 0.03',
      '   • "Mobile phone allowance" → Use standard: BASE_SALARY × 0.01',
      '7. VAGUE COSTS:',
      '   • "Market rate" → Use conservative: BASE_SALARY × 0.025',
      '   • "Competitive rate" → Use standard: BASE_SALARY × 0.02',
      '   • "Varies by location" → Use average: BASE_SALARY × 0.02',
      '   • "Subject to negotiation" → Use baseline: BASE_SALARY × 0.015',
      '8. CONDITIONAL COVERAGE:',
      '   • "Company covers 80%" (no base cost) → Estimate total as BASE_SALARY × 0.05, use 80%',
      '   • "Partial reimbursement" → Use 50% of estimated standard cost',
      '',
      'SUCCESS CRITERIA:',
      '• All Papaya sections have been thoroughly parsed',
      '• Every benefit with a numeric value has a corresponding enhancement object',
      '• Termination costs are calculated ONLY in all-inclusive mode (omitted in statutory-only)',
      '• When includeCommonBenefits=true, all common_benefits are included',
      '• Different providers get different totals based on their coverage gaps',
      '',
      'CONFIDENCE SCORING FOR ESTIMATES:',
      '• Exact amounts from Papaya → confidence: 0.9',
      '• Complete ranges with midpoint → confidence: 0.8',
      '• Incomplete ranges (up to/starting from) → confidence: 0.7',
      '• Percentage calculations → confidence: 0.8',
      '• Industry standard estimates (no cost given) → confidence: 0.5',
      '• Vague cost estimates (market rate, etc.) → confidence: 0.4',
      '• Conditional/partial coverage estimates → confidence: 0.6',
      '',
      'EXPLANATION REQUIREMENTS:',
      '• Always include source: "Papaya: 5,000 to 7,000 ARS (midpoint used)"',
      '• For estimates: "Estimated: No cost specified, used 2% of salary standard"',
      '• For vague costs: "Estimated: Market rate converted to 2.5% of salary"',
      '• For ranges: "Papaya: Up to 5,000 ARS (65% estimate used)"',
      '',
      'CRITICAL REQUIREMENTS:',
      '• NEVER skip benefits just because cost is unclear - always estimate',
      '• NEVER default to 0 - use the calculation rules above',
      '• NEVER make up exact numbers - follow the percentage formulas',
      '• ALWAYS include explanation of how amount was derived',
      '• Termination costs: Calculate only in all-inclusive mode (skip in statutory-only mode)'
    ].filter(line => line !== '').join('\n')
  }

  // Baseline-First System Prompt (Papaya-only baseline, no reconciliation)
  static buildBaselineSystemPrompt(): string {
    return `You are an expert EOR (Employer of Record) cost analyst.

TASK: Assemble a COMPLETE monthly quote using Papaya Global data + the given form context ONLY. Do NOT reconcile with any provider quote. Do NOT subtract anything. Build the quote directly.

STRICT RULES:
- Currency: ALWAYS output in the local country currency detected from Papaya (no conversion). Use that as the single output currency.
- Base salary: The base salary provided is MONTHLY and must be used as-is.
- Quote types:
  - statutory-only: include all legally mandated salary components, statutory allowances, and common benefits. ONLY EXCLUDE termination costs (severance_cost and notice_period_cost).
  - all-inclusive: include statutory baseline PLUS commonly provided allowances/benefits PLUS termination costs listed by Papaya with clear amounts.
- Statutory-only EXCLUSIONS: ONLY exclude termination costs (severance_cost and notice_period_cost). Include all other items: mandatory salaries (13th/14th), allowances (meal vouchers, transportation, remote work, etc.), and benefits.
- Conditional items: If a statutory item is conditional (e.g., UK Apprenticeship Levy requires exceeding a paybill threshold) and the condition cannot be determined from inputs, set the amount to 0 and add a short warning.
- De-duplication: EXCLUDE any item that matches BASE ITEMS (by meaning or close name). Normalize names (lowercase, remove punctuation/stop-words like 'contribution', 'fund', 'fee'). Prefer the base item and do not output a duplicate.
- Monthly amounts only. If yearly → divide by 12. If daily → multiply by 22 working days. If ranges → midpoint. Round to 2 decimals (half-up).
- Markers: For any item that requires recomputation (e.g., annual → monthly, banded %, provisions), append the token ##RECALC## to the item.key (and you may also append to the item.name). Do NOT perform the math; just mark it.
 - Monthly amounts only. If yearly → divide by 12. If daily → multiply by 22 working days. If ranges → midpoint. Round to 2 decimals (half-up).
  - Use the exact JSON schema provided.
  - Do not subtract or compare to provider coverage.

RESPONSE JSON SHAPE (exact keys):
{
  "quote": {
    "type": "statutory-only" | "all-inclusive",
    "country": "string",
    "currency": "string",
    "base_salary_monthly": 0,
    "items": [
      { "key": "string", "name": "string", "monthly_amount": 0 }
    ],
    "subtotals": {
      "bonuses": 0,
      "allowances": 0,
      "termination": 0
    },
    "total_monthly": 0
  },
  "recalc_base_items": ["string"],
  "warnings": []
}`
  }

  // Pre-pass baseline reconciliation (Cerebras baseline used with provider coverage)
  static buildPrepassSystemPrompt(): string {
    return (
      `You are an expert EOR cost analyst.\n` +
      `TASK: Compute monthly enhancement deltas using a LEGAL BASELINE and PROVIDER COVERAGE.\n` +
      `RULES:\n` +
      `- All amounts are already in the PROVIDER CURRENCY. Do NOT perform currency conversion.\n` +
      `- Compute deltas = max(0, baseline_monthly - provider_coverage_monthly).\n` +
      `- Statutory-only: include all items (mandatory salaries, allowances, benefits). ONLY EXCLUDE termination costs (severance_cost and notice_period_cost).\n` +
      `- All-inclusive: include all items including termination costs.\n` +
      `- Avoid double counting (if provider coverage >= baseline, delta=0 with already_included=true).\n` +
      `- Termination: compute separate deltas for severance and notice components only in all-inclusive mode.\n` +
      `- Output strictly valid JSON with the exact keys requested (no extra text).`
    )
  }

  static buildPrepassUserPrompt(input: {
    provider: string
    currency: string
    quoteType: 'all-inclusive' | 'statutory-only'
    contractMonths: number
    baseMonthly: number
    baselineProviderCurrency: Record<string, number>
    baselineMandatoryFlags: Record<string, boolean>
    providerCoverage: Record<string, number>
  }): string {
    const schema = [
      '{',
      '  "analysis": { "provider_coverage": [], "missing_requirements": [], "double_counting_risks": [] },',
      '  "enhancements": {',
      '    "severance_cost": { "monthly_amount": 0, "total_amount": 0, "explanation": "", "already_included": false },',
      '    "notice_period_cost": { "monthly_amount": 0, "total_amount": 0, "explanation": "", "already_included": false },',
      '    "thirteenth_salary": { "monthly_amount": 0, "yearly_amount": 0, "explanation": "", "already_included": false },',
      '    "fourteenth_salary": { "monthly_amount": 0, "yearly_amount": 0, "explanation": "", "already_included": false },',
      '    "vacation_bonus": { "amount": 0, "explanation": "", "already_included": false },',
      '    "transportation_allowance": { "monthly_amount": 0, "explanation": "", "already_included": false, "mandatory": false },',
      '    "remote_work_allowance": { "monthly_amount": 0, "explanation": "", "already_included": false, "mandatory": false },',
      '    "meal_vouchers": { "monthly_amount": 0, "explanation": "", "already_included": false }',
      '  },',
      '  "totals": {',
      '    "total_monthly_enhancement": 0,',
      '    "total_yearly_enhancement": 0,',
      '    "final_monthly_total": 0',
      '  },',
      '',
      '  "warnings": []',
      '}'
    ].join('\n')

    return [
      `PRE-PASS RECONCILIATION REQUEST`,
      `PROVIDER: ${input.provider}`,
      `CURRENCY: ${input.currency}`,
      `QUOTE TYPE: ${input.quoteType}`,
      `CONTRACT MONTHS: ${input.contractMonths}`,
      `BASE MONTHLY (provider): ${input.baseMonthly}`,
      '',
      'BASELINE (provider currency) MAP:',
      JSON.stringify(input.baselineProviderCurrency),
      'BASELINE MANDATORY FLAGS:',
      JSON.stringify(input.baselineMandatoryFlags),
      'PROVIDER COVERAGE (monthly):',
      JSON.stringify(input.providerCoverage),
      '',
      'OUTPUT SCHEMA:',
      schema,
      '',
      'Respond with strictly valid JSON only.'
    ].join('\n')
  }

  // Baseline-First User Prompt (Enhanced with addBenefits logic)
  static buildBaselineUserPrompt(params: {
    baseQuote: { country: string; currency: string; monthlyTotal: number; baseCost: number }
    formData: any // Accept full formData for addBenefits checkbox
    papayaData: string
    papayaCurrency: string
    quoteType: 'all-inclusive' | 'statutory-only'
    contractMonths: number
    baseItems?: string[]
  }): string {
    const { baseQuote, formData, papayaData, papayaCurrency, quoteType, contractMonths, baseItems } = params

    // Consider addBenefits opt-in; treat undefined as true for backward compatibility
    const addBenefitsFlag = formData.addBenefits
    const includeCommonBenefits = addBenefitsFlag !== false || quoteType === 'statutory-only'
    const addBenefitsDisplay = addBenefitsFlag !== false
      ? 'true'
      : quoteType === 'statutory-only'
        ? 'false (overridden for statutory-only requirements)'
        : 'false'

    // Smart truncation that preserves critical sections
    const limitedPapayaData = this.smartTruncatePapayaData(papayaData, 50000)

    // Form analysis section (simplified to avoid template literal issues)
    const formLogic = [
      'FORM DATA ANALYSIS:',
      `- Quote Type: ${quoteType || 'unknown'}`,
      `- Add Benefits Checkbox: ${addBenefitsDisplay}`,
      `- Effective Include Allowances: ${includeCommonBenefits}`,
      `- Contract Duration: ${contractMonths || 12} months`,
      '',
      'INCLUSION LOGIC FOR THIS REQUEST:',
      includeCommonBenefits
        ? '→ INCLUDE mandatory legal items plus common allowances (transportation, meal vouchers, remote work, etc.)'
        : '→ MANDATORY ONLY: Include only legally required items'
    ].join('\n')

    return [
      `FULL QUOTE REQUEST (no reconciliation)`,
      `COUNTRY: ${baseQuote.country}`,
      `LOCAL CURRENCY (detected from Papaya): ${papayaCurrency}`,
      `BASE SALARY MONTHLY (from base quote): ${baseQuote.baseCost}`,
      `CONTRACT MONTHS: ${contractMonths}`,
      `QUOTE TYPE: ${quoteType}`,
      '',
      formLogic,
      '',
      'BASE ITEMS (already present in base quote):',
      Array.isArray(baseItems) && baseItems.length > 0 ? JSON.stringify(baseItems, null, 2) : '[]',
      '',
      includeCommonBenefits ? [
        'BENEFIT INCLUSION RULES:',
        '• MANDATORY BENEFITS: Always include if missing (13th salary, statutory allowances)',
        '• TERMINATION COSTS: Include ONLY in all-inclusive mode (exclude in statutory-only mode)',
        '• COMMON BENEFITS: Include ALL when includeCommonBenefits=true (meal vouchers, transportation, allowances, remote work stipends)',
        '• Use Papaya amounts and convert to monthly as needed',
        ...(addBenefitsFlag === false && quoteType === 'statutory-only'
          ? ['• NOTE: Add-benefits checkbox is false, but statutory-only mode still requires including Papaya-listed allowances.']
          : []),
        ''
      ].join('\n') : [
        'BENEFIT INCLUSION RULES:',
        '• MANDATORY ONLY: Include only legally required items (13th salary, statutory allowances)',
        '• TERMINATION COSTS: Include ONLY in all-inclusive mode (exclude in statutory-only mode)',
        '• SKIP COMMON BENEFITS: Do not include meal vouchers, transportation allowances, or other optional benefits',
        ''
      ].join('\n'),
      'PAPAYA GLOBAL DATA (flattened):',
      limitedPapayaData,
      '',
      'RESPONSE INSTRUCTIONS:',
      '- Always use LOCAL currency (Papaya) as the quote.currency.',
      '- Use the provided base salary as MONTHLY base_salary_monthly.',
      '- CRITICAL BENEFIT LOGIC:',
      includeCommonBenefits
        ? '  * This request: Include mandatory items plus common allowances (transportation, meal vouchers, remote work, etc.)'
        : '  * This request: Include only legally mandated items',
      ...(includeCommonBenefits && addBenefitsFlag === false && quoteType === 'statutory-only'
        ? ['  * NOTE: Add-benefits checkbox is false, but statutory-only mode overrides it—include Papaya-listed allowances.']
        : []),
      '  * If addBenefits=false in future requests: Include only mandatory items',
      '- MANDATORY ALWAYS: authority payments, 13th/14th salary (if required)',
      '- TERMINATION COSTS: Include severance/notice costs ONLY in all-inclusive mode (exclude in statutory-only mode)',
      includeCommonBenefits
        ? '- COMMON BENEFITS (INCLUDE): meal vouchers, transportation, internet/mobile allowances, WFH stipends from Papaya common_benefits section'
        : '- COMMON BENEFITS (EXCLUDE): meal vouchers, transportation, internet/mobile allowances, WFH stipends',
      '',
      '- COST HANDLING FOR UNCLEAR DATA:',
      '  * Exact amounts: Use as-is',
      '  * Ranges "X to Y": Use midpoint (X+Y)÷2',
      '  * "Up to X": Use 65% of X',
      '  * "Starting from X": Use 130% of X',
      '  * No cost given: Use salary percentage (meal=2%, transport=3%, internet=1.5%)',
      '  * "Market rate": Use 2.5% of base salary',
      '  * Percentages: Calculate against BASE_SALARY',
      '  * Always include confidence score and explanation',
      '',
      '- De-duplication: REMOVE any item that matches BASE ITEMS (by meaning or close name).',
      '- Markers: For items needing recompute (annual → monthly), append ##RECALC## to item.key.',
      '- NEVER skip benefits due to unclear costs - always estimate using rules above.',
      '- Compute subtotals per category and total_monthly = base_salary_monthly + sum(items).',
      '- Strictly follow the schema.',
    ].join('\n')
  }
}
