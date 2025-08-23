import { useState, useEffect } from "react"
import { ValidationAPIResponse } from "@/lib/shared/types"
import { fetchValidationData } from "@/lib/shared/utils/apiUtils"

export const useCountryValidation = (countryCode: string | null) => {
  const [validationData, setValidationData] = useState<ValidationAPIResponse | null>(null)
  const [isLoadingValidations, setIsLoadingValidations] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const fetchValidations = async (code: string) => {
    setIsLoadingValidations(true)
    setValidationError(null)
    setValidationData(null)

    try {
      const data = await fetchValidationData(code)
      setValidationData(data)
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to fetch validation data")
    } finally {
      setIsLoadingValidations(false)
    }
  }

  useEffect(() => {
    if (countryCode) {
      fetchValidations(countryCode)
    } else {
      setValidationData(null)
      setValidationError(null)
    }
  }, [countryCode])

  return {
    validationData,
    isLoadingValidations,
    validationError,
  }
}