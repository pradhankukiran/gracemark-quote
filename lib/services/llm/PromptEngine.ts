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
- Statutory-only: include ONLY items mandated by law; skip optional allowances
- All-inclusive: include ONLY items explicitly present in the legal profile (Papaya-derived) — mandatory items and allowances with clear amounts/rates. Do NOT add anything not in the profile.
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
      `QUOTE TYPE: ${quoteType} (${quoteType === 'statutory-only' ? 'MANDATORY ONLY' : 'ALL BENEFITS'})`,
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
      `6. Apply ${quoteType === 'statutory-only' ? 'ONLY mandatory/legally required benefits' : 'ONLY items explicitly present in the legal profile — mandatory items and allowances with specified amounts/rates'}`,
      `7. Do NOT include any benefit that is not present in the legal profile. Do NOT infer from training data.`,
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
      'GAP ANALYSIS REQUIREMENTS:',
      '- Use the exact keys as above.',
      '- CRITICAL: Perform thorough gap analysis between LEGAL REQUIREMENTS and PROVIDER INCLUSIONS.',
      '- For items ALREADY INCLUDED in provider benefits (amount > 0): set already_included=true, enhancement amounts to 0.',
      '- For MISSING MANDATORY items: set already_included=false, compute proper enhancement amounts.',
      '- In statutory-only mode: include ONLY items that are mandatory by law (set mandatory=true for legally required allowances).',
      '- In all-inclusive mode: include mandatory + commonly required benefits.',
      '- Compute termination_costs using given formulas and divide by contract months to monthlyize.',
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
  private static summarizeLegalRequirements(papayaData: PapayaCountryData): string {
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
      const first = papayaData.data.contribution.employer_contributions.slice(0, 3).map((c: { description: string; rate: string }) => `${c.description}: ${c.rate}`)
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

  // Direct Enhancement System Prompt (Form-Aware Benefit Categorization)
  static buildDirectSystemPrompt(): string {
    return `You are an expert EOR (Employer of Record) gap analyst specializing in provider-specific benefit analysis using Papaya Global legal data.

CORE MISSION: Produce different enhancement results for different providers based on their actual coverage vs legal/common requirements.

FORM DATA LOGIC (CRITICAL):
- quoteType = "statutory-only" → Include ONLY legally mandatory items
- quoteType = "all-inclusive" + addBenefits = true → Include mandatory + common benefits  
- quoteType = "all-inclusive" + addBenefits = false → Include ONLY mandatory items

BENEFIT CATEGORIES:
1. MANDATORY BENEFITS: Always include if missing (13th salary, termination costs, required contributions)
2. COMMON BENEFITS: Include only if quoteType="all-inclusive" AND addBenefits=true

PROVIDER-SPECIFIC GAP ANALYSIS:
- If provider includes benefit (amount > 0) → already_included=true, enhancement=0
- If provider missing benefit (amount = 0) → already_included=false, calculate enhancement
- Different providers MUST produce different results based on their actual inclusions

CALCULATION RULES:
- Mandatory items: Allow formula-based calculations (e.g., termination = months × salary)
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
      transportation_allowance: monthlyOf(src.transportAllowance),
      remote_work_allowance: monthlyOf(src.remoteWorkAllowance),
      meal_vouchers: monthlyOf(src.mealVouchers),
      social_security: monthlyOf(src.socialSecurity),
      health_insurance: monthlyOf(src.healthInsurance),
      termination_costs: 0 // Providers never explicitly include termination costs (contingent liabilities)
    }

    // Form data logic for benefit inclusion
    const addBenefits = formData.addBenefits || false
    const includeCommonBenefits = quoteType === 'all-inclusive' && addBenefits
    
    const formLogic = `
FORM DATA ANALYSIS:
- Quote Type: ${quoteType}
- Add Benefits Checkbox: ${addBenefits}
- Contract Duration: ${contractMonths} months

INCLUSION LOGIC FOR THIS REQUEST:
${quoteType === 'statutory-only' 
  ? '→ MANDATORY ONLY: Include only legally required items'
  : includeCommonBenefits 
    ? '→ FULL INCLUSIVE: Include mandatory + common benefits' 
    : '→ MANDATORY ONLY: Include only legally required items'
}`

    const limitedPapayaData = typeof papayaData === 'string' && papayaData.length > 50000
      ? papayaData.slice(0, 50000) + '\n[truncated]'
      : papayaData

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
      '• Termination Costs: Check termination section (notice + severance)',
      '• Required Contributions: Check employer contribution requirements',
      '',
      includeCommonBenefits ? [
        'COMMON BENEFITS (include if missing):',
        '• Meal Vouchers: Check common_benefits section',
        '• Transportation: Check common_benefits section', 
        '• Internet/Mobile: Check common_benefits section',
        '• Other allowances with explicit amounts'
      ].join('\n') : 'COMMON BENEFITS: SKIP (not requested for this quote type)',
      '',
      '═══ STEP 4: GAP ANALYSIS PER BENEFIT ═══',
      '',
      '⚠️ IMPORTANT: TERMINATION COSTS are handled in PHASE 1 (always calculated), NOT here.',
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
        'EXAMPLE 3 - Common benefit (only if addBenefits=true):',
        '• Provider coverage: meal_vouchers = 0 (missing)',
        '• Papaya shows: "Meal Vouchers – 6,000 ARS monthly"',
        '• Result: already_included=false, monthly_amount=6000',
        '• Reasoning: "Provider missing meal vouchers. Papaya shows 6,000 ARS standard"'
      ].join('\n') : '',
      '',
      '═══ CALCULATION FORMULAS ═══',
      '• 13th Salary: BASE_SALARY ÷ 12 (if Papaya says mandatory)',
      '• Termination: ((YEARS_OF_SERVICE × MONTHLY_SALARY) + (NOTICE_MONTHS × MONTHLY_SALARY)) ÷ CONTRACT_MONTHS',
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
      '🔴 PHASE 1: MANDATORY CALCULATIONS (ALWAYS CALCULATE - NO GAP ANALYSIS)',
      '',
      '1. TERMINATION COSTS (ALWAYS CALCULATE IF TERMINATION SECTION EXISTS):',
      '   • RULE: Providers never include termination costs → always calculate if legal data exists',
      '   • SIMPLE FORMULA: termination_monthly = (BASE_SALARY × 3) ÷ CONTRACT_MONTHS',
      '   • EXPLANATION: Assumes ~2-3 months total termination liability spread over contract',
      '   • NO provider checking - always include if Papaya has termination section',
      '',
      '🟡 PHASE 2: GAP ANALYSIS FOR REGULAR BENEFITS',
      '',
      '2. PAYROLL SECTION ANALYSIS:',
      '   • Search for "13th", "Aguinaldo", "thirteenth" → Calculate BASE_SALARY ÷ 12',
      '   • Search for "14th", "fourteenth" → Calculate BASE_SALARY ÷ 12', 
      '   • Search for vacation bonus, vacation pay percentages → Calculate accordingly',
      '   • Look for payment cycle requirements and additional salary components',
      '',
      '3. EMPLOYER CONTRIBUTION SECTION ANALYSIS:',
      '   • Parse EVERY employer contribution percentage and amount',
      '   • Calculate monthly costs: (BASE_SALARY × percentage) for each contribution',
      '   • Include: pension, health, employment fund, insurance contributions',
      '   • Fixed amounts (like "176 ARS") → add directly to monthly costs',
      '',
      '4. COMMON_BENEFITS SECTION PARSING (when addBenefits=true):',
      '   • Parse EVERY line containing benefit amounts',
      '   • Extract amounts in format "X to Y currency" → use midpoint: (X+Y)÷2',
      '   • Convert daily amounts to monthly: daily_amount × 22 working days',
      '   • Create separate objects for each benefit found',
      '',
      '5. MINIMUM_WAGE & AUTHORITY_PAYMENTS:',
      '   • Check for mandatory payment requirements',
      '   • Look for fixed costs that employers must pay',
      '',
      '6. LEAVE SECTION ANALYSIS:',
      '   • Check for paid leave that employers must fund',
      '   • Calculate if there are specific employer costs mentioned',
      '',
      'FLEXIBLE BENEFIT OBJECT CREATION FRAMEWORK:',
      '',
      'Create dynamic objects based on benefit type discovered. Adapt field names and structure to the specific benefit:',
      '',
      'TYPE 1 - SALARY COMPONENTS (13th, 14th, vacation bonus):',
      '{"monthly_amount": X, "yearly_amount": Y, "explanation": "Papaya text quote", "confidence": 0.9, "already_included": boolean}',
      '',
      'TYPE 2 - FIXED ALLOWANCES (meal, transport, internet, mobile, gym):',
      '{"monthly_amount": X, "explanation": "Papaya text quote", "confidence": 0.8, "already_included": boolean, "mandatory": boolean}',
      '',
      'TYPE 3 - PERCENTAGE-BASED CONTRIBUTIONS (pension, health, social security):',
      '{"monthly_amount": X, "percentage": "Y%", "calculation_base": BASE_SALARY, "explanation": "Papaya text quote", "confidence": 0.9, "already_included": boolean}',
      '',
      'TYPE 4 - TERMINATION COSTS (always calculate - no gap analysis):',
      '{"monthly_amount": X, "total_estimated": Y, "explanation": "Papaya termination requirements spread over contract", "confidence": 0.8}',
      '',
      'TYPE 5 - RANGE-BASED BENEFITS (amounts like "5,000 to 7,000"):',
      '{"monthly_amount": midpoint, "min_amount": X, "max_amount": Y, "explanation": "Papaya text quote", "confidence": 0.7, "already_included": boolean}',
      '',
      'TYPE 6 - DAILY-TO-MONTHLY CONVERSION:',
      '{"monthly_amount": daily_amount * 22, "daily_amount": X, "explanation": "Papaya text quote", "confidence": 0.8, "already_included": boolean}',
      '',
      'NAMING CONVENTIONS:',
      '• Use descriptive snake_case: "private_health_insurance", "employer_pension_contribution"',
      '• Be specific: "meal_vouchers" not "meal", "internet_allowance" not "internet"',
      '• Match Papaya terminology when possible',
      '',
      'EXAMPLE DISCOVERY PROCESS:',
      '• Find "Gym Allowance – 5,000 to 7,000 ARS monthly" → Create "gym_allowance" object',
      '• Find "Internet Allowance – 2,500 ARS monthly" → Create "internet_allowance" object',  
      '• Find "Private Health Insurance – 10,000 to 12,000 ARS monthly" → Create "private_health_insurance" object',
      '• Find termination section → ALWAYS create "termination_costs" using simple formula (no gap analysis)',
      '',
      'JSON STRUCTURE:',
      `{
        "analysis": {
          "provider_coverage": ["List what ${provider} actually includes"],
          "missing_requirements": ["List what ${provider} is missing"],
          "benefit_mode": "${quoteType === 'statutory-only' ? 'statutory-only' : (includeCommonBenefits ? 'inclusive+benefits' : 'inclusive-only-mandatory')}",
          "papaya_sections_parsed": ["payroll", "termination", "common_benefits", "contribution"],
          "total_benefits_found": 0
        },
        "enhancements": {
          // CREATE OBJECTS DYNAMICALLY FOR EVERY BENEFIT YOU FIND
          // Examples of what you might discover:
          // "thirteenth_salary": {...},
          // "termination_costs": {...},
          // "gym_allowance": {...},
          // "internet_allowance": {...},
          // "meal_vouchers": {...},
          // "transportation_allowance": {...},
          // "employer_health_contribution": {...},
          // etc.
        },
        "totals": {
          "total_monthly_enhancement": 0,
          "final_monthly_total": ${baseQuote.monthlyTotal}
        },
        "confidence_scores": { "overall": 0.8 }
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
      '• TERMINATION COSTS: ALWAYS calculate if termination section exists - NO exceptions, NO gap analysis',
      '• MANDATORY BENEFITS: Always include regardless of form settings (13th salary, contributions)',
      '• COMMON BENEFITS: Include ALL when addBenefits=true (be exhaustive)',
      '• EMPLOYER CONTRIBUTIONS: Calculate and include every percentage/amount',
      '• RANGES: Use midpoint calculations for "X to Y" amounts',
      '',
      'CALCULATION APPROACH:',
      '• If Papaya gives exact amounts → use them',
      '• If Papaya gives percentages → calculate against BASE_SALARY',
      '• If Papaya gives ranges → use midpoint: (min + max) ÷ 2',
      '• If daily amounts → convert to monthly: daily × 22 working days',
      '• Round all amounts to 2 decimal places',
      '',
      'SUCCESS CRITERIA:',
      '• All Papaya sections have been thoroughly parsed',
      '• Every benefit with a numeric value has a corresponding enhancement object',
      '• Termination costs are calculated (not defaulted to 0)',
      '• When addBenefits=true, all common_benefits are included',
      '• Different providers get different totals based on their coverage gaps',
      '',
      'AVOID THESE MISTAKES:',
      '• NEVER skip termination costs - if termination section exists, ALWAYS calculate using simple formula',
      '• DON\'T apply gap analysis to termination costs - providers never include them',
      '• Don\'t default to 0 for unclear calculations - make reasonable estimates',
      '• Don\'t limit to only "obvious" benefits - include everything found',
      '• Don\'t ignore ranges or variable amounts - calculate midpoints'
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
  - statutory-only: include ONLY legally mandated employer costs (social security, mandatory pension/insurances, mandatory bonuses where applicable, legally required allowances, and termination provisions if applicable and monthlyized).
  - all-inclusive: include statutory baseline PLUS commonly provided allowances/benefits listed by Papaya with clear amounts.
- Statutory-only EXCLUSIONS: Do NOT include enhanced/optional pension uplifts, private healthcare, meal/food allowances, remote/WFH allowances, car allowances, wellness/gym, or any other common benefits that are not explicitly mandated by law. Do NOT include leave entitlements (e.g., paternity/maternity) as monthly costs unless Papaya specifies a concrete monthly employer payment.
- Conditional items: If a statutory item is conditional (e.g., UK Apprenticeship Levy requires exceeding a paybill threshold) and the condition cannot be determined from inputs, set the amount to 0 and add a short warning.
- De-duplication: EXCLUDE any item that matches BASE ITEMS (by meaning or close name). Normalize names (lowercase, remove punctuation/stop-words like 'contribution', 'fund', 'fee'). Prefer the base item and do not output a duplicate.
- Monthly amounts only. If yearly → divide by 12. If daily → multiply by 22 working days. If ranges → midpoint. Round to 2 decimals (half-up).
- Markers: For any item that requires recomputation (e.g., annual → monthly, banded %, provisions), append the token ##RECALC## to the item.key (and you may also append to the item.name). Do NOT perform the math; just mark it.
 - Monthly amounts only. If yearly → divide by 12. If daily → multiply by 22 working days. If ranges → midpoint. Round to 2 decimals (half-up).
  - Use the exact JSON schema provided. Do not add analysis/confidence fields.
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
      "contributions": 0,
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
      `- Statutory-only: include ONLY mandatory items; skip non-mandatory allowances.\n` +
      `- All-inclusive: include mandatory items and allowances present in baseline.\n` +
      `- Avoid double counting (if provider coverage >= baseline, delta=0 with already_included=true).\n` +
      `- Termination costs: use the provided baseline monthly provision as a single item (do not split).\n` +
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
      '    "termination_costs": { "total": 0, "explanation": "", "confidence": 0.7 },',
      '    "thirteenth_salary": { "monthly_amount": 0, "yearly_amount": 0, "explanation": "", "confidence": 0.7, "already_included": false },',
      '    "fourteenth_salary": { "monthly_amount": 0, "yearly_amount": 0, "explanation": "", "confidence": 0.7, "already_included": false },',
      '    "vacation_bonus": { "amount": 0, "explanation": "", "confidence": 0.6, "already_included": false },',
      '    "transportation_allowance": { "monthly_amount": 0, "explanation": "", "confidence": 0.6, "already_included": false, "mandatory": false },',
      '    "remote_work_allowance": { "monthly_amount": 0, "explanation": "", "confidence": 0.6, "already_included": false, "mandatory": false },',
      '    "meal_vouchers": { "monthly_amount": 0, "explanation": "", "confidence": 0.6, "already_included": false }',
      '  },',
      '  "totals": {',
      '    "total_monthly_enhancement": 0,',
      '    "total_yearly_enhancement": 0,',
      '    "final_monthly_total": 0',
      '  },',
      '  "confidence_scores": { "overall": 0.7 },',
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

  // Baseline-First User Prompt
  static buildBaselineUserPrompt(params: {
    baseQuote: { country: string; currency: string; monthlyTotal: number; baseCost: number }
    formData: { baseSalary: string }
    papayaData: string
    papayaCurrency: string
    quoteType: 'all-inclusive' | 'statutory-only'
    contractMonths: number
    baseItems?: string[]
  }): string {
    const { baseQuote, formData, papayaData, papayaCurrency, quoteType, contractMonths, baseItems } = params

    const limitedPapayaData = typeof papayaData === 'string' && papayaData.length > 50000
      ? papayaData.slice(0, 50000) + '\n[truncated]'
      : papayaData

    return [
      `FULL QUOTE REQUEST (no reconciliation)`,
      `COUNTRY: ${baseQuote.country}`,
      `LOCAL CURRENCY (detected from Papaya): ${papayaCurrency}`,
      `BASE SALARY MONTHLY (from base quote): ${baseQuote.baseCost}`,
      `CONTRACT MONTHS: ${contractMonths}`,
      `QUOTE TYPE: ${quoteType}`,
      '',
      'BASE ITEMS (already present in base quote):',
      Array.isArray(baseItems) && baseItems.length > 0 ? JSON.stringify(baseItems, null, 2) : '[]',
      '',
      'PAPAYA GLOBAL DATA (flattened):',
      limitedPapayaData,
      '',
      'RESPONSE INSTRUCTIONS:',
      '- Always use LOCAL currency (Papaya) as the quote.currency.',
      '- Use the provided base salary as MONTHLY base_salary_monthly.',
      '- For statutory-only: include only legally mandated employer items (employer contributions from Papaya contributions section, mandatory 13th/14th if explicitly required, termination provisions monthlyized when applicable). Exclude enhanced pension uplifts, private healthcare, meal/food, WFH/remote allowances, car, wellness/gym, and leave entitlements as recurring monthly items.',
      '- For all-inclusive: include statutory baseline plus common benefits with amounts from Papaya.',
      '- De-duplication: REMOVE any item that matches BASE ITEMS (by meaning or close name). Normalize names (lowercase, remove punctuation/stop-words like contribution/fund/fee). Choose the base item over your generated one.',
      '- Markers: For any item that needs recompute (e.g., annual → monthly), append ##RECALC## to item.key (and optionally to item.name). Do not compute the amount; just mark it.',
      '- Compute subtotals per category and total_monthly = base_salary_monthly + sum(items).',
      '- No analysis/confidence fields; strictly follow the schema.',
    ].join('\n')
  }
}
