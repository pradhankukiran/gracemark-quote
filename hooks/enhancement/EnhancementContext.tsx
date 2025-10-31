"use client"

import React, { createContext, useContext } from 'react'
import { useQuoteEnhancement } from './useQuoteEnhancement'
import type { EnhancedQuote } from '@/lib/types/enhancement'

type Ctx = ReturnType<typeof useQuoteEnhancement>

const EnhancementContext = createContext<Ctx | null>(null)

export const EnhancementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useQuoteEnhancement()
  return (
    <EnhancementContext.Provider value={value}>{children}</EnhancementContext.Provider>
  )
}

export const useEnhancementContext = (): Ctx => {
  const ctx = useContext(EnhancementContext)
  if (!ctx) {
    throw new Error('useEnhancementContext must be used within EnhancementProvider')
  }
  return ctx
}

