// API Route: Batch Quote Enhancement
// POST /api/enhancement/batch

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { EnhancementEngine } from '@/lib/services/enhancement/EnhancementEngine'
import { ProviderType } from '@/lib/types/enhancement'
import { EORFormData } from '@/lib/shared/types'

// Input validation schema for batch processing
const BatchEnhancementRequestSchema = z.object({
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
  providerQuotes: z.record(z.object({
    provider: z.string(),
    currency: z.string(),
    country: z.string(),
    monthlyTotal: z.number(),
    baseCost: z.number(),
    breakdown: z.record(z.number().optional()).optional(),
    originalResponse: z.record(z.unknown())
  })),
  quoteType: z.enum(['all-inclusive', 'statutory-only']).optional(),
  papayaData: z.record(z.unknown()).optional()
})

// type BatchEnhancementRequest = z.infer<typeof BatchEnhancementRequestSchema> // Unused

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse and validate request body (gracefully handle empty/malformed JSON)
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
    const validatedInput = BatchEnhancementRequestSchema.parse(body)

    // Initialize enhancement engine
    const enhancementEngine = EnhancementEngine.getInstance()

    // Convert providerQuotes to the expected format
    // Build up a partial map then cast when invoking the engine
    const providerQuotes: Partial<Record<ProviderType, Record<string, unknown>>> = {}
    Object.entries(validatedInput.providerQuotes).forEach(([provider, quote]) => {
      if (['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'].includes(provider)) {
        providerQuotes[provider as ProviderType] = quote
      }
    })

    // Perform batch enhancement
    const result = await enhancementEngine.enhanceAllProviders({
      formData: validatedInput.formData as EORFormData,
      papayaData: validatedInput.papayaData || null,
      providerQuotes: providerQuotes as Record<ProviderType, Record<string, unknown>>,
      quoteType: validatedInput.quoteType || 'all-inclusive'
    })

    // Return successful response
    return NextResponse.json({
      success: true,
      data: result,
      totalProcessingTime: Date.now() - startTime,
      providersProcessed: Object.keys(result.enhancements).length,
      errorsOccurred: Object.keys(result.errors).length
    })

  } catch (error) {
    console.error('Batch enhancement error:', error)

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

// Get batch processing status
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  // jobId parameter available for future async processing
  searchParams.get('jobId')

  // This could be extended to support async processing with job queues
  return NextResponse.json({
    message: 'Batch processing is synchronous',
    supportedProviders: ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'],
    maxConcurrentJobs: 7
  })
}
