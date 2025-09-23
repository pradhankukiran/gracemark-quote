// API Route: Single Quote Enhancement
// POST /api/enhancement/quote

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { EnhancementEngine } from '@/lib/services/enhancement/EnhancementEngine'
// Remove unused import
// import { ProviderType } from '@/lib/types/enhancement'
import { EORFormData } from '@/lib/shared/types'

// Input validation schema
const EnhancementRequestSchema = z.object({
  provider: z.enum(['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity']),
  providerQuote: z.object({
    provider: z.string(),
    currency: z.string(),
    country: z.string(),
    monthlyTotal: z.number(),
    baseCost: z.number(),
    breakdown: z.record(z.number().optional()).optional(),
    originalResponse: z.record(z.unknown())
  }),
  formData: z.object({
    country: z.string(),
    baseSalary: z.string(),
    contractDuration: z.string(),
    employmentType: z.string(),
    quoteType: z.enum(['all-inclusive', 'statutory-only']).optional(),
    clientName: z.string().optional(),
    clientCountry: z.string().optional(),
    currency: z.string().optional(),
    workVisaRequired: z.boolean().optional(),
    startDate: z.string().optional(),
    // Accept local office info so we can include local benefits deterministically
    localOfficeInfo: z.object({
      mealVoucher: z.string().optional(),
      transportation: z.string().optional(),
      wfh: z.string().optional(),
      healthInsurance: z.string().optional(),
      monthlyPaymentsToLocalOffice: z.string().optional(),
      vat: z.string().optional(),
      preEmploymentMedicalTest: z.string().optional(),
      drugTest: z.string().optional(),
      backgroundCheckViaDeel: z.string().optional(),
    }).optional()
  }),
  quoteType: z.enum(['all-inclusive', 'statutory-only']).optional()
})

// type EnhancementRequest = z.infer<typeof EnhancementRequestSchema> // Unused

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse and validate request body (handle empty/malformed JSON gracefully)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON body',
        message: 'Request body is missing or not valid JSON'
      }, { status: 400 })
    }
    const validatedInput = EnhancementRequestSchema.parse(body)

    // Initialize enhancement engine
    const enhancementEngine = EnhancementEngine.getInstance()

    // Perform enhancement using unified raw-Papaya path
    const effectiveQuoteType = validatedInput.quoteType || 
      (validatedInput.formData.quoteType === 'all-inclusive' || validatedInput.formData.quoteType === 'statutory-only' 
        ? validatedInput.formData.quoteType 
        : 'all-inclusive')

    // Use the pre-pass pipeline for single-provider enhancement so each provider
    // gets Cerebras baseline reconciliation before Groq computes deltas.
    const enhancedQuote = await enhancementEngine.enhanceQuoteDirect({
      provider: validatedInput.provider,
      providerQuote: validatedInput.providerQuote,
      formData: validatedInput.formData as EORFormData,
      quoteType: effectiveQuoteType
    })

    

    // Return successful response
    return NextResponse.json({
      success: true,
      data: enhancedQuote,
      processingTime: Date.now() - startTime
    })

  } catch (error) {
    console.error('Quote enhancement error:', error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    // Handle rate limiting errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'RATE_LIMIT_EXCEEDED') {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: 60
      }, { status: 429 })
    }

    // Handle request timeout explicitly
    if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code === 'REQUEST_TIMEOUT') {
      return NextResponse.json({
        success: false,
        error: 'Request timeout',
        message: 'Request timed out. Please try again.'
      }, { status: 504 })
    }

    // Handle Groq API errors
    if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code === 'GROQ_ERROR') {
      return NextResponse.json({
        success: false,
        error: 'LLM service error',
        message: 'Enhancement service temporarily unavailable'
      }, { status: 503 })
    }

    // Handle general errors
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      processingTime: Date.now() - startTime
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  try {
    const enhancementEngine = EnhancementEngine.getInstance()
    const isHealthy = await enhancementEngine.healthCheck()
    const stats = enhancementEngine.getStats()

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      stats
    })

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
