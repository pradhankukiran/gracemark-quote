import { useState, useRef, useCallback, useEffect } from "react"

interface UseDebouncedInputOptions {
  debounceDelay?: number
  onValidate?: (value: string) => void
  onImmediate?: (value: string) => void
}

/**
 * Custom hook for debounced input handling with immediate UI updates
 * but delayed validation to prevent excessive re-renders
 */
export const useDebouncedInput = (
  initialValue: string = "",
  { debounceDelay = 300, onValidate, onImmediate }: UseDebouncedInputOptions = {}
) => {
  const [value, setValue] = useState(initialValue)
  const [debouncedValue, setDebouncedValue] = useState(initialValue)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Update local value when external value changes
  useEffect(() => {
    setValue(initialValue)
    setDebouncedValue(initialValue)
  }, [initialValue])

  // Handle immediate value changes (for UI responsiveness)
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue)
    
    // Call immediate callback if provided (for UI updates)
    onImmediate?.(newValue)

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Set up debounced validation
    if (onValidate) {
      debounceRef.current = setTimeout(() => {
        setDebouncedValue(newValue)
        onValidate(newValue)
      }, debounceDelay)
    } else {
      // If no validation needed, update debounced value immediately
      setDebouncedValue(newValue)
    }
  }, [debounceDelay, onValidate, onImmediate])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    value,
    debouncedValue,
    handleChange,
    setValue
  }
}

/**
 * Custom hook specifically for form fields with validation
 */
export const useDebouncedFormField = <T extends string | number | boolean>(
  initialValue: T,
  onUpdate: (value: T) => void,
  onValidate?: (value: T) => void,
  debounceDelay = 300
) => {
  const [localValue, setLocalValue] = useState(initialValue)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Update local value when external value changes
  useEffect(() => {
    setLocalValue(initialValue)
  }, [initialValue])

  const handleChange = useCallback((newValue: T) => {
    setLocalValue(newValue)
    
    // Immediate UI update
    onUpdate(newValue)

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounced validation
    if (onValidate) {
      debounceRef.current = setTimeout(() => {
        onValidate(newValue)
      }, debounceDelay)
    }
  }, [onUpdate, onValidate, debounceDelay])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    value: localValue,
    handleChange,
    setValue: setLocalValue
  }
}