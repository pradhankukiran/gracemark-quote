// lib/shared/utils/storageUtils.ts - Safe storage and JSON utilities

/**
 * Safe JSON parsing with error handling
 */
export const safeJsonParse = <T = unknown>(jsonString: string, fallback?: T): { success: boolean; data?: T; error?: string } => {
  try {
    const parsed = JSON.parse(jsonString)
    return { success: true, data: parsed }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON format'
    return { 
      success: false, 
      error: errorMessage, 
      data: fallback 
    }
  }
}

/**
 * Safe JSON stringification with error handling
 */
export const safeJsonStringify = (data: unknown): { success: boolean; json?: string; error?: string } => {
  try {
    const json = JSON.stringify(data)
    return { success: true, json }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to serialize data'
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}

/**
 * Check if sessionStorage is available and functional
 */
export const isSessionStorageAvailable = (): boolean => {
  try {
    if (typeof Storage === 'undefined' || !window.sessionStorage) {
      return false
    }
    
    // Test if we can actually use sessionStorage
    const testKey = '__storage_test__'
    sessionStorage.setItem(testKey, 'test')
    sessionStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}


/**
 * Safe sessionStorage.getItem with error handling
 */
export const safeSessionStorageGet = (key: string): { success: boolean; data?: string; error?: string } => {
  try {
    if (!isSessionStorageAvailable()) {
      return { 
        success: false, 
        error: 'Session storage is not available. Please use a modern browser or enable storage.' 
      }
    }

    const data = sessionStorage.getItem(key)
    return { 
      success: true, 
      data: data || undefined 
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to read from session storage'
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}

/**
 * Safe sessionStorage.setItem with quota error handling
 */
export const safeSessionStorageSet = (key: string, value: string): { success: boolean; error?: string } => {
  try {
    if (!isSessionStorageAvailable()) {
      return { 
        success: false, 
        error: 'Session storage is not available. Please use a modern browser or enable storage.' 
      }
    }

    sessionStorage.setItem(key, value)
    return { success: true }
  } catch (error) {
    if (error instanceof DOMException) {
      if (
        error.code === 22 ||
        error.code === 1014 ||
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      ) {
        return { 
          success: false, 
          error: 'Browser storage is full. Please clear your browser data and try again.' 
        }
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to write to session storage'
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}

/**
 * Safe sessionStorage.removeItem with error handling
 */
export const safeSessionStorageRemove = (key: string): { success: boolean; error?: string } => {
  try {
    if (!isSessionStorageAvailable()) {
      return { 
        success: false, 
        error: 'Session storage is not available.' 
      }
    }

    sessionStorage.removeItem(key)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove from session storage'
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}


/**
 * Safely get and parse JSON from sessionStorage
 */
export const getJsonFromSessionStorage = <T = unknown>(
  key: string, 
  fallback?: T
): { success: boolean; data?: T; error?: string } => {
  const storageResult = safeSessionStorageGet(key)
  
  if (!storageResult.success) {
    return { 
      success: false, 
      error: storageResult.error, 
      data: fallback 
    }
  }

  if (!storageResult.data) {
    return { 
      success: false, 
      error: 'No data found for key: ' + key, 
      data: fallback 
    }
  }

  const parseResult = safeJsonParse<T>(storageResult.data, fallback)
  return parseResult
}

/**
 * Safely stringify and store JSON in sessionStorage
 */
export const setJsonInSessionStorage = (key: string, data: unknown): { success: boolean; error?: string } => {
  const stringifyResult = safeJsonStringify(data)
  
  if (!stringifyResult.success) {
    return { 
      success: false, 
      error: stringifyResult.error 
    }
  }

  const storageResult = safeSessionStorageSet(key, stringifyResult.json!)
  return storageResult
}

