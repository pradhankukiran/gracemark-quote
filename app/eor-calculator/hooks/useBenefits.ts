import { useState, useEffect, useCallback } from "react"
import { BenefitsAPIResponse } from "@/lib/shared/types"
import { fetchBenefitsData, BenefitsRequestParams } from "@/lib/shared/utils/apiUtils"

interface UseBenefitsProps {
  countryCode: string | null
  workVisa: boolean
  hoursPerDay: string
  daysPerWeek: string
  employmentType: string
}

export const useBenefits = ({ 
  countryCode, 
  workVisa, 
  hoursPerDay, 
  daysPerWeek, 
  employmentType 
}: UseBenefitsProps) => {
  const [benefitsData, setBenefitsData] = useState<BenefitsAPIResponse | null>(null)
  const [isLoadingBenefits, setIsLoadingBenefits] = useState(false)
  const [benefitsError, setBenefitsError] = useState<string | null>(null)
  const [benefitsFetched, setBenefitsFetched] = useState(false)
  const [benefitsSkipped, setBenefitsSkipped] = useState(false)

  const fetchBenefits = async (params: BenefitsRequestParams) => {
    setIsLoadingBenefits(true)
    setBenefitsError(null)
    setBenefitsData(null)

    try {
      const data = await fetchBenefitsData(params)
      setBenefitsData(data)
    } catch (err) {
      setBenefitsError(err instanceof Error ? err.message : "Failed to fetch benefits data")
    } finally {
      setIsLoadingBenefits(false)
    }
  }

  // Clear benefits data when country changes
  useEffect(() => {
    setBenefitsData(null)
    setBenefitsError(null)
    setBenefitsFetched(false)
    setBenefitsSkipped(false)
  }, [countryCode])

  // Manual fetch function that can be called by UI
  const fetchBenefitsManually = useCallback(async () => {
    if (!countryCode || !hoursPerDay || !daysPerWeek || !employmentType) {
      setBenefitsError("Missing required information to fetch benefits")
      return
    }

    const hoursNum = parseFloat(hoursPerDay)
    const daysNum = parseFloat(daysPerWeek)
    
    if (isNaN(hoursNum) || isNaN(daysNum) || hoursNum <= 0 || daysNum <= 0) {
      setBenefitsError("Invalid hours or days values")
      return
    }

    const workHoursPerWeek = hoursNum * daysNum
    
    try {
      await fetchBenefits({
        countryCode,
        workVisa,
        workHoursPerWeek,
        employmentType,
      })
      setBenefitsFetched(true)
      setBenefitsSkipped(false)
    } catch {
      setBenefitsFetched(false)
    }
  }, [countryCode, workVisa, hoursPerDay, daysPerWeek, employmentType])

  // Function to skip benefits explicitly
  const skipBenefits = useCallback(() => {
    setBenefitsSkipped(true)
    setBenefitsFetched(false)
    setBenefitsError(null)
    setBenefitsData(null)
  }, [])

  // Check if all required data is available for fetching benefits
  const canFetchBenefits = countryCode && hoursPerDay && daysPerWeek && employmentType &&
                          !isNaN(parseFloat(hoursPerDay)) && !isNaN(parseFloat(daysPerWeek)) &&
                          parseFloat(hoursPerDay) > 0 && parseFloat(daysPerWeek) > 0

  return {
    benefitsData,
    isLoadingBenefits,
    benefitsError,
    benefitsFetched,
    benefitsSkipped,
    canFetchBenefits,
    fetchBenefitsManually,
    skipBenefits,
  }
}