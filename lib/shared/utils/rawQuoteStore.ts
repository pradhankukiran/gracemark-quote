import { ProviderType } from '@/lib/types/enhancement'

export type RawQuoteKind = 'primary' | 'comparison'

export interface RawQuoteEntry {
  primary?: unknown
  comparison?: unknown
}

const rawQuoteStore = new Map<ProviderType, RawQuoteEntry>()

export const setRawQuote = (provider: ProviderType, payload: unknown, kind: RawQuoteKind = 'primary') => {
  const entry = rawQuoteStore.get(provider) ?? {}
  if (kind === 'primary') {
    entry.primary = payload
  } else {
    entry.comparison = payload
  }
  rawQuoteStore.set(provider, entry)
}

export const getRawQuote = (provider: ProviderType): RawQuoteEntry | undefined => rawQuoteStore.get(provider)

export const clearRawQuotes = () => {
  rawQuoteStore.clear()
}
