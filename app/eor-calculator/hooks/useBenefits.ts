import { useState, useEffect } from "react"
import { BenefitsAPIResponse } from "../types"
import { fetchBenefitsData, BenefitsRequestParams } from "../utils/apiUtils"

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

  useEffect(() => {
    if (countryCode && hoursPerDay && daysPerWeek && employmentType) {
      const hoursNum = parseFloat(hoursPerDay)
      const daysNum = parseFloat(daysPerWeek)
      
      if (!isNaN(hoursNum) && !isNaN(daysNum) && hoursNum > 0 && daysNum > 0) {
        const workHoursPerWeek = hoursNum * daysNum
        
        fetchBenefits({
          countryCode,
          workVisa,
          workHoursPerWeek,
          employmentType,
        })
      }
    } else {
      setBenefitsData(null)
      setBenefitsError(null)
    }
  }, [countryCode, workVisa, hoursPerDay, daysPerWeek, employmentType])

  return {
    benefitsData,
    isLoadingBenefits,
    benefitsError,
  }
}