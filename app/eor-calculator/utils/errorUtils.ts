export const handleAsyncError = (error: unknown, context?: string): string => {
  console.error(`Error ${context ? `in ${context}` : ''}:`, error)
  
  if (error instanceof Error) {
    return error.message
  }
  
  return `An error occurred${context ? ` ${context}` : ''}`
}

export const createErrorState = (error: unknown, defaultMessage: string = 'An error occurred'): string => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return defaultMessage
}

export const isNetworkError = (error: unknown): boolean => {
  return error instanceof Error && 
    (error.message.includes('fetch') || 
     error.message.includes('network') || 
     error.message.includes('Failed to'))
}

export const getErrorMessage = (
  error: unknown, 
  fallbackMessage: string = 'Something went wrong'
): string => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return fallbackMessage
}