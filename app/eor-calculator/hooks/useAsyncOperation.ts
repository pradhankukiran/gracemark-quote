import { useState, useCallback } from 'react'
import { handleAsyncError } from '../utils/errorUtils'

interface AsyncOperationState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseAsyncOperationReturn<T> {
  state: AsyncOperationState<T>
  execute: (operation: () => Promise<T>) => Promise<T | null>
  reset: () => void
  setData: (data: T | null) => void
  setError: (error: string | null) => void
}

export function useAsyncOperation<T = unknown>(
  initialData: T | null = null
): UseAsyncOperationReturn<T> {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: initialData,
    loading: false,
    error: null
  })

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await operation()
      setState(prev => ({ ...prev, data: result, loading: false, error: null }))
      return result
    } catch (error) {
      const errorMessage = handleAsyncError(error, 'async operation')
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: initialData, loading: false, error: null })
  }, [initialData])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  return {
    state,
    execute,
    reset,
    setData,
    setError
  }
}