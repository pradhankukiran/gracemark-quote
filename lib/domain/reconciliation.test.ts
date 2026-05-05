import { describe, it, expect } from 'vitest'
import { selectVarianceWinner } from './reconciliation'

// Default band is ±4% of deelPrice (lower=0.96, upper=1.04 from constants).
describe('selectVarianceWinner', () => {
  it('picks the highest in-range provider when multiple are in band', () => {
    const result = selectVarianceWinner(
      [
        { provider: 'a', price: 98 },  // in range (>= 96)
        { provider: 'b', price: 102 }, // in range
        { provider: 'c', price: 110 }, // out of range (>104)
      ],
      100,
    )
    expect(result.lowerBound).toBeCloseTo(96, 10)
    expect(result.upperBound).toBeCloseTo(104, 10)
    expect(result.candidates.map(p => p.provider)).toEqual(['a', 'b'])
    expect(result.winner).not.toBeNull()
    expect(result.winner?.provider).toBe('b')
    expect(result.winner?.price).toBe(102)
  })

  it('returns null winner when all providers are out of range', () => {
    const result = selectVarianceWinner(
      [
        { provider: 'a', price: 50 },
        { provider: 'b', price: 200 },
      ],
      100,
    )
    expect(result.winner).toBeNull()
    expect(result.candidates).toHaveLength(0)
    expect(result.analyzed).toHaveLength(2)
    expect(result.analyzed.every(p => !p.inRange)).toBe(true)
  })

  it('selects the sole provider when its price equals the anchor', () => {
    const result = selectVarianceWinner(
      [{ provider: 'only', price: 100 }],
      100,
    )
    expect(result.winner?.provider).toBe('only')
    expect(result.winner?.price).toBe(100)
    expect(result.candidates).toHaveLength(1)
  })

  it('honours custom upper/lower band overrides', () => {
    // Override to ±10% — 110 is now in-range, 80 still out.
    const result = selectVarianceWinner(
      [
        { provider: 'a', price: 80 },
        { provider: 'b', price: 95 },
        { provider: 'c', price: 110 },
      ],
      100,
      { lowerBound: 0.9, upperBound: 1.1 },
    )
    expect(result.lowerBound).toBeCloseTo(90, 10)
    expect(result.upperBound).toBeCloseTo(110, 10)
    expect(result.winner?.provider).toBe('c')
    expect(result.candidates).toHaveLength(2)
  })

  it('returns empty analyzed/candidates when prices array is empty', () => {
    const result = selectVarianceWinner([], 100)
    expect(result.analyzed).toEqual([])
    expect(result.candidates).toEqual([])
    expect(result.winner).toBeNull()
  })

  it('treats prices exactly at the upper/lower bound as in-range', () => {
    const result = selectVarianceWinner(
      [
        { provider: 'low', price: 96 },
        { provider: 'high', price: 104 },
      ],
      100,
    )
    expect(result.candidates).toHaveLength(2)
    expect(result.winner?.provider).toBe('high')
  })
})
