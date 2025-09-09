// API Route: Enhancement System Debug/Monitoring
// GET /api/enhancement/debug

import { NextRequest, NextResponse } from 'next/server'
import { EnhancementEngine } from '@/lib/services/enhancement/EnhancementEngine'
import { EnhancementPerformanceMonitor } from '@/lib/services/enhancement/EnhancementCache'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    const enhancementEngine = EnhancementEngine.getInstance()

    switch (action) {
      case 'stats':
        return NextResponse.json({
          success: true,
          data: enhancementEngine.getStats(),
          timestamp: new Date().toISOString()
        })

      case 'cache':
        return NextResponse.json({
          success: true,
          data: enhancementEngine.getCacheStats(),
          timestamp: new Date().toISOString()
        })

      case 'performance':
        return NextResponse.json({
          success: true,
          data: enhancementEngine.getPerformanceMetrics(),
          timestamp: new Date().toISOString()
        })

      case 'health':
        const isHealthy = await enhancementEngine.healthCheck()
        const stats = enhancementEngine.getStats()
        return NextResponse.json({
          success: true,
          data: {
            healthy: isHealthy,
            components: {
              groq: {
                healthy: isHealthy,
                model: stats.groqStats?.model,
                requestsPerMinute: stats.groqStats?.requestsPerMinute,
                lastRequestTime: stats.groqStats?.lastRequestTime,
              },
              papaya: true,
              cache: true
            }
          },
          timestamp: new Date().toISOString()
        })

      case 'env':
        return NextResponse.json({
          success: true,
          data: {
            hasGroqKey: !!process.env.GROQ_API_KEY,
            groqKeyLength: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0,
            groqKeyLooksTrimmed: process.env.GROQ_API_KEY ? (process.env.GROQ_API_KEY.trim() === process.env.GROQ_API_KEY) : null,
            model: process.env.GROQ_MODEL || 'deepseek-r1-distill-llama-70b'
          },
          timestamp: new Date().toISOString()
        })

      case 'ping': {
        const key = (process.env.GROQ_API_KEY || '').trim()
        if (!key) {
          return NextResponse.json({ success: false, error: 'No GROQ_API_KEY set' }, { status: 400 })
        }
        try {
          const resp = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${key}` }
          })
          const text = await resp.text()
          return NextResponse.json({
            success: true,
            status: resp.status,
            ok: resp.ok,
            bodyPreview: text.slice(0, 200),
          })
        } catch (err: unknown) {
          return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
        }
      }

      case 'cleanup':
        enhancementEngine.cleanupCache()
        return NextResponse.json({
          success: true,
          data: { message: 'Cache cleanup completed' },
          timestamp: new Date().toISOString()
        })

      default:
        // Default: return comprehensive stats
        return NextResponse.json({
          success: true,
          data: {
            overview: enhancementEngine.getStats(),
            cache: enhancementEngine.getCacheStats(),
            performance: enhancementEngine.getPerformanceMetrics(),
            health: await enhancementEngine.healthCheck()
          },
          timestamp: new Date().toISOString()
        })
    }

  } catch (error) {
    console.error('Debug endpoint error:', error)

    return NextResponse.json({
      success: false,
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

// Clear cache (useful for testing)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const target = searchParams.get('target')

    const enhancementEngine = EnhancementEngine.getInstance()

    switch (target) {
      case 'cache':
        enhancementEngine.clearCache()
        return NextResponse.json({
          success: true,
          data: { message: 'Cache cleared successfully' },
          timestamp: new Date().toISOString()
        })

      case 'performance':
        EnhancementPerformanceMonitor.reset()
        return NextResponse.json({
          success: true,
          data: { message: 'Performance metrics reset' },
          timestamp: new Date().toISOString()
        })

      case 'all':
        enhancementEngine.clearCache()
        EnhancementPerformanceMonitor.reset()
        return NextResponse.json({
          success: true,
          data: { message: 'All debug data cleared' },
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid target',
          message: 'Specify target: cache, performance, or all'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Debug clear endpoint error:', error)

    return NextResponse.json({
      success: false,
      error: 'Clear operation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}
