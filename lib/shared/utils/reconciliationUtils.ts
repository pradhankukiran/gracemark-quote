// Shared utility functions for reconciliation calculations
// These functions can be used both client-side and server-side

export function round2(n: number): number { 
  return Math.round((n + Number.EPSILON) * 100) / 100 
}

export function round4(n: number): number { 
  return Math.round((n + Number.EPSILON) * 10000) / 10000 
}

export function mean(a: number[]): number { 
  return a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0 
}

export function median(a: number[]): number {
  if (!a.length) return 0
  const b = [...a].sort((x, y) => x - y)
  const mid = Math.floor(b.length / 2)
  return b.length % 2 ? b[mid] : (b[mid - 1] + b[mid]) / 2
}

export function stdDev(a: number[]): number {
  if (a.length <= 1) return 0
  const m = mean(a)
  const varSum = a.reduce((s, n) => s + Math.pow(n - m, 2), 0) / (a.length - 1)
  return Math.sqrt(varSum)
}

export function argMin(a: number[]): number { 
  if (!a.length) return -1
  let i = 0, mi = a[0]
  for (let k = 1; k < a.length; k++) { 
    if (a[k] < mi) { mi = a[k]; i = k } 
  } 
  return i 
}

export function argMax(a: number[]): number { 
  if (!a.length) return -1
  let i = 0, ma = a[0]
  for (let k = 1; k < a.length; k++) { 
    if (a[k] > ma) { ma = a[k]; i = k } 
  } 
  return i 
}

export function clamp01(n: number): number { 
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n)) 
}

export function hasCriticalMissing(missing: string[]): boolean {
  const crit = ['social security', 'mandatory', 'statutory', 'health insurance', 'pension', 'tax', 'termination', 'notice', 'severance']
  const lower = (missing || []).map(s => (s || '').toString().toLowerCase())
  return lower.some(s => crit.some(c => s.includes(c)))
}

export function buildNotes(coverage: { missing?: string[]; doubleCountingRisk?: string[] }): string[] {
  const notes: string[] = []
  if (coverage?.missing?.length) {
    notes.push(`Missing: ${coverage.missing.slice(0, 3).join(', ')}${coverage.missing.length > 3 ? '…' : ''}`)
  }
  if (coverage?.doubleCountingRisk?.length) {
    notes.push(`Double-counting risk: ${coverage.doubleCountingRisk.slice(0, 2).join(', ')}${coverage.doubleCountingRisk.length > 2 ? '…' : ''}`)
  }
  return notes
}