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
    startDate: z.string().optional()
  }),
  providerQuotes: z.record(z.object({
    provider: z.string(),
    currency: z.string(),
    country: z.string(),
    monthlyTotal: z.number(),
    baseCost: z.number(),
    breakdown: z.record(z.number().optional()).optional(),
    originalResponse: z.any()
  })),
  quoteType: z.enum(['all-inclusive', 'statutory-only']).optional(),
  papayaData: z.any().optional()
})

type BatchEnhancementRequest = z.infer<typeof BatchEnhancementRequestSchema>

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse and validate request body
    const body = await request.json()
    const validatedInput = BatchEnhancementRequestSchema.parse(body)

    // Initialize enhancement engine
    const enhancementEngine = EnhancementEngine.getInstance()

    // Convert providerQuotes to the expected format
    // Build up a partial map then cast when invoking the engine
    const providerQuotes: Partial<Record<ProviderType, any>> = {}
    Object.entries(validatedInput.providerQuotes).forEach(([provider, quote]) => {
      if (['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'].includes(provider)) {
        providerQuotes[provider as ProviderType] = quote
      }
    })

    // Perform batch enhancement
    const result = await enhancementEngine.enhanceAllProviders({
      formData: validatedInput.formData as EORFormData,
      papayaData: validatedInput.papayaData || null,
      providerQuotes: providerQuotes as Record<ProviderType, any>,
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
  const jobId = searchParams.get('jobId')

  // This could be extended to support async processing with job queues
  return NextResponse.json({
    message: 'Batch processing is synchronous',
    supportedProviders: ['deel', 'remote', 'rivermate', 'oyster', 'rippling', 'skuad', 'velocity'],
    maxConcurrentJobs: 7
  })
}
