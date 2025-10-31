export interface AsyncState<T = unknown> {
  data: T | null
  loading: boolean
  error: string | null
}

export const createAsyncState = <T = unknown>(
  initialData: T | null = null
): AsyncState<T> => ({
  data: initialData,
  loading: false,
  error: null
})

export const setLoadingState = <T>(state: AsyncState<T>): AsyncState<T> => ({
  ...state,
  loading: true,
  error: null
})

export const setSuccessState = <T>(
  state: AsyncState<T>, 
  data: T
): AsyncState<T> => ({
  ...state,
  data,
  loading: false,
  error: null
})

export const setErrorState = <T>(
  state: AsyncState<T>, 
  error: string
): AsyncState<T> => ({
  ...state,
  loading: false,
  error
})

export const resetState = <T>(): AsyncState<T> => ({
  data: null,
  loading: false,
  error: null
})