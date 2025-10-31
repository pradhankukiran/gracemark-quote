import { useState, useEffect } from "react"
import { ValidationAPIResponse } from "@/lib/shared/types"
import { fetchValidationData } from "@/lib/shared/utils/apiUtils"

export const useCountryValidation = (countryCode: string | null) => {
  const [validationData, setValidationData] = useState<ValidationAPIResponse | null>(null)
  const [isLoadingValidations, setIsLoadingValidations] = useState(false)

  const fetchValidations = async (code: string) => {
    setIsLoadingValidations(true)
    setValidationData(null)

    try {
      const data = await fetchValidationData(code)
      setValidationData(data)
    } catch (err) {
      // In a real app, you'd want to handle this error more gracefully
      console.error(err)
    } finally {
      setIsLoadingValidations(false)
    }
  }

  useEffect(() => {
    if (countryCode) {
      fetchValidations(countryCode)
    } else {
      setValidationData(null)
    }
  }, [countryCode])

  return {
    validationData,
    isLoadingValidations,
  }
}