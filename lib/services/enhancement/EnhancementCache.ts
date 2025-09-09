// Enhancement Cache Service
// Provides intelligent caching for enhancement results to improve performance

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface EnhancementCacheKey {
  provider: string
  country: string
  baseSalary: string
  contractDuration: string
  employmentType: string
  quoteType: string
  quoteHash: string
}

class EnhancementCacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 30 * 60 * 1000 // 30 minutes
  private maxCacheSize = 100

  // Generate cache key from enhancement inputs
  private generateCacheKey(params: EnhancementCacheKey): string {
    const keyParts = [
      params.provider,
      params.country,
      params.baseSalary,
      params.contractDuration,
      params.employmentType,
      params.quoteType,
      params.quoteHash
    ]
    return keyParts.join('|')
  }

  // Generate hash for quote data
  private hashQuote(quote: any): string {
    try {
      const crypto = require('crypto') as typeof import('crypto')
      const relevantData = {
        monthlyTotal: quote.monthlyTotal,
        baseCost: quote.baseCost,
        currency: quote.currency,
        breakdown: quote.breakdown
      }
      const json = JSON.stringify(relevantData)
      return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
    } catch {
      // Last-resort stable fallback
      try {
        const json = JSON.stringify({
          monthlyTotal: quote?.monthlyTotal,
          baseCost: quote?.baseCost,
          currency: quote?.currency
        })
        return Buffer.from(json).toString('base64').slice(0, 16)
      } catch {
        return 'hash_unavailable'
      }
    }
  }

  // Check if cache entry is valid
  private isValidEntry<T>(entry: CacheEntry<T>): boolean {
    return Date.now() < entry.expiresAt
  }

  // Clean expired entries
  private cleanExpired(): void {
    const now = Date.now()
    const toDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        toDelete.push(key)
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key))
  }

  // Ensure cache doesn't exceed size limit
  private enforceSize(): void {
    if (this.cache.size <= this.maxCacheSize) return
    
    // Remove oldest entries
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize)
    toRemove.forEach(([key]) => this.cache.delete(key))
  }

  // Store enhancement result in cache
  public set(
    provider: string,
    formData: any,
    quote: any,
    quoteType: string,
    enhancement: any,
    ttl?: number
  ): void {
    try {
      const key = this.generateCacheKey({
        provider,
        country: formData.country,
        baseSalary: formData.baseSalary,
        contractDuration: formData.contractDuration,
        employmentType: formData.employmentType,
        quoteType,
        quoteHash: this.hashQuote(quote)
      })

      const entry: CacheEntry<any> = {
        data: enhancement,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttl || this.defaultTTL)
      }

      this.cache.set(key, entry)
      this.enforceSize()
    } catch (error) {
      console.warn('Failed to cache enhancement:', error)
    }
  }

  // Retrieve enhancement result from cache
  public get(
    provider: string,
    formData: any,
    quote: any,
    quoteType: string
  ): any | null {
    try {
      const key = this.generateCacheKey({
        provider,
        country: formData.country,
        baseSalary: formData.baseSalary,
        contractDuration: formData.contractDuration,
        employmentType: formData.employmentType,
        quoteType,
        quoteHash: this.hashQuote(quote)
      })

      const entry = this.cache.get(key)
      if (!entry || !this.isValidEntry(entry)) {
        if (entry) this.cache.delete(key)
        return null
      }

      return entry.data
    } catch (error) {
      console.warn('Failed to retrieve cached enhancement:', error)
      return null
    }
  }

  // Check if enhancement exists in cache
  public has(
    provider: string,
    formData: any,
    quote: any,
    quoteType: string
  ): boolean {
    return this.get(provider, formData, quote, quoteType) !== null
  }

  // Clear specific cache entry
  public delete(
    provider: string,
    formData: any,
    quote: any,
    quoteType: string
  ): boolean {
    try {
      const key = this.generateCacheKey({
        provider,
        country: formData.country,
        baseSalary: formData.baseSalary,
        contractDuration: formData.contractDuration,
        employmentType: formData.employmentType,
        quoteType,
        quoteHash: this.hashQuote(quote)
      })
      return this.cache.delete(key)
    } catch {
      return false
    }
  }

  // Generate cache key for benefit extraction
  private generateExtractionCacheKey(provider: string, originalResponse: any): string {
    const responseHash = this.hashOriginalResponse(originalResponse)
    return `extraction|${provider}|${responseHash}`
  }

  // Generate hash for original provider response
  private hashOriginalResponse(originalResponse: any): string {
    try {
      const crypto = require('crypto') as typeof import('crypto')
      const json = JSON.stringify(originalResponse)
      return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
    } catch {
      try {
        const json = JSON.stringify(originalResponse || {})
        return Buffer.from(json).toString('base64').slice(0, 16)
      } catch {
        return 'response_hash_unavailable'
      }
    }
  }

  // Store extraction result in cache
  public setExtraction(
    provider: string,
    originalResponse: any,
    extractedBenefits: any,
    ttl?: number
  ): void {
    try {
      const key = this.generateExtractionCacheKey(provider, originalResponse)
      
      const entry: CacheEntry<any> = {
        data: extractedBenefits,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttl || 60 * 60 * 1000) // Default 1 hour for extractions
      }

      this.cache.set(key, entry)
      this.enforceSize()
    } catch (error) {
      console.warn('Failed to cache extraction:', error)
    }
  }

  // Retrieve extraction result from cache
  public getExtraction(
    provider: string,
    originalResponse: any
  ): any | null {
    try {
      const key = this.generateExtractionCacheKey(provider, originalResponse)
      const entry = this.cache.get(key)

      if (!entry || !this.isValidEntry(entry)) {
        return null
      }

      return entry.data
    } catch (error) {
      console.warn('Failed to retrieve cached extraction:', error)
      return null
    }
  }

  // Clear all cache entries
  public clear(): void {
    this.cache.clear()
  }

  // Get cache statistics
  public getStats() {
    this.cleanExpired()
    const entries = Array.from(this.cache.values())
    
    return {
      totalEntries: this.cache.size,
      validEntries: entries.filter(e => this.isValidEntry(e)).length,
      oldestEntry: entries.length > 0 
        ? new Date(Math.min(...entries.map(e => e.timestamp)))
        : null,
      newestEntry: entries.length > 0 
        ? new Date(Math.max(...entries.map(e => e.timestamp)))
        : null,
      hitRate: this.calculateHitRate(),
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  // Calculate cache hit rate (simplified)
  private hitRate = 0
  private totalRequests = 0
  private cacheHits = 0

  public recordHit(): void {
    this.totalRequests++
    this.cacheHits++
    this.hitRate = this.cacheHits / this.totalRequests
  }

  public recordMiss(): void {
    this.totalRequests++
    this.hitRate = this.cacheHits / this.totalRequests
  }

  private calculateHitRate(): number {
    return this.hitRate
  }

  // Estimate memory usage (rough approximation)
  private estimateMemoryUsage(): string {
    const avgEntrySize = 2048 // Rough estimate in bytes
    const totalSize = this.cache.size * avgEntrySize
    
    if (totalSize < 1024) return `${totalSize}B`
    if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)}KB`
    return `${(totalSize / (1024 * 1024)).toFixed(1)}MB`
  }

  // Clean up expired entries (public method for external cleanup)
  public cleanup(): void {
    this.cleanExpired()
    this.enforceSize()
  }
}

// Singleton instance
export const enhancementCache = new EnhancementCacheService()

// Performance monitoring utilities
export class EnhancementPerformanceMonitor {
  private static metrics = {
    enhancementRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    totalResponseTime: 0,
    slowQueries: [] as Array<{ provider: string, duration: number, timestamp: number }>,
    errors: [] as Array<{ error: string, provider: string, timestamp: number }>
  }

  static startTimer(provider: string) {
    const startTime = performance.now()
    
    return {
      end: (success: boolean, cached: boolean = false) => {
        const duration = performance.now() - startTime
        
        this.metrics.enhancementRequests++
        this.metrics.totalResponseTime += duration
        this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.enhancementRequests
        
        if (cached) {
          this.metrics.cacheHits++
        } else {
          this.metrics.cacheMisses++
        }
        
        // Track slow queries (>5 seconds)
        if (duration > 5000) {
          this.metrics.slowQueries.push({
            provider,
            duration,
            timestamp: Date.now()
          })
          
          // Keep only last 10 slow queries
          if (this.metrics.slowQueries.length > 10) {
            this.metrics.slowQueries = this.metrics.slowQueries.slice(-10)
          }
        }
        
        return duration
      },
      
      error: (error: string) => {
        const duration = performance.now() - startTime
        
        this.metrics.errors.push({
          error,
          provider,
          timestamp: Date.now()
        })
        
        // Keep only last 20 errors
        if (this.metrics.errors.length > 20) {
          this.metrics.errors = this.metrics.errors.slice(-20)
        }
        
        return duration
      }
    }
  }

  static getMetrics() {
    const cacheHitRate = this.metrics.enhancementRequests > 0 
      ? (this.metrics.cacheHits / this.metrics.enhancementRequests) * 100 
      : 0
    
    return {
      ...this.metrics,
      cacheHitRate: Number(cacheHitRate.toFixed(2)),
      recentSlowQueries: this.metrics.slowQueries.slice(-5),
      recentErrors: this.metrics.errors.slice(-5)
    }
  }

  static reset() {
    this.metrics = {
      enhancementRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      slowQueries: [],
      errors: []
    }
  }
}
