// PDF Data Transformer - Formats quote data for professional PDF documents

import { ProviderType, EnhancedQuote } from "@/lib/types/enhancement";
import { QuoteNormalizer } from "@/lib/services/data/QuoteNormalizer";
import { ProviderInclusionsExtractor } from "@/lib/services/enhancement/ProviderInclusionsExtractor";
import { EORFormData } from "@/lib/shared/types";

export interface PDFQuoteData {
  // Document metadata
  documentTitle: string;
  generatedAt: string;
  filename: string;

  // Executive summary
  selectedProvider: {
    name: string;
    logo?: string;
    totalCost: number;
    currency: string;
    recommendation: string;
  };

  // Employee information
  employee: {
    baseSalary: number;
    currency: string;
    country: string;
    benefits: string[];
    employmentType: string;
    startDate?: string;
    employeeName?: string;
    jobTitle?: string;
    holidayDays?: string;
    workSchedule?: string;
  };

  // Provider comparison
  providerComparison: {
    provider: string;
    logo?: string;
    monthlyCost: number;
    currency: string;
    variance: number;
    variancePercentage: string;
    inRange: boolean;
    isWinner: boolean;
    enhancementTotal?: number;
    confidence?: number;
  }[];

  // Enhanced analysis
  enhancedAnalysis?: {
    totalEnhancement: number;
    confidence: number;
    breakdown: {
      category: string;
      amount: number;
      description: string;
      confidence: number;
    }[];
    warnings: string[];
    legalRequirements: string[];
  };

  // Reconciliation details
  reconciliation: {
    methodology: string;
    varianceThreshold: string;
    candidatesInRange: number;
    totalProvidersAnalyzed: number;
    selectionCriteria: string;
    analysis: string;
  };

  // Cost breakdown
  costBreakdown: {
    baseSalaryCost: number;
    additionalCosts: number;
    totalMonthlyCost: number;
    annualCost: number;
    currency: string;
  };

  // Detailed base quote breakdown (from provider API)
  baseQuoteDetails: {
    name: string;
    amount: number;
    frequency: string;
    description?: string;
  }[];

  // Detailed enhancement breakdown (from LLM calculations)
  enhancementDetails: {
    category: string;
    monthlyAmount: number;
    yearlyAmount?: number;
    explanation: string;
    confidence: number;
    isMandatory?: boolean;
    isAlreadyIncluded: boolean;
  }[];
}

export function transformQuoteDataForPDF(
  finalChoice: { provider: string; price: number; currency: string; enhancedQuote?: EnhancedQuote } | null,
  providerData: { provider: string; price: number; inRange?: boolean; isWinner?: boolean }[],
  quoteData: any,
  enhancements: Record<ProviderType, EnhancedQuote | null>
): PDFQuoteData {
  const formData = quoteData?.formData as EORFormData;
  const timestamp = new Date();
  // Prioritize enhancedQuote from finalChoice, fallback to enhancements lookup
  const selectedProviderEnhancement = finalChoice?.enhancedQuote || 
    (finalChoice ? enhancements[finalChoice.provider as ProviderType] : null);

  // Calculate costs using actual enhancement data when available
  const baseSalary = formData?.baseSalary ? parseFloat(formData.baseSalary) : 0;
  const selectedPrice = selectedProviderEnhancement?.finalTotal || finalChoice?.price || 0;
  const additionalCosts = selectedProviderEnhancement ? 
    selectedProviderEnhancement.totalEnhancement : 
    Math.max(0, selectedPrice - baseSalary);

  // Format provider comparison data
  const formattedProviderComparison = providerData.map(provider => {
    const enhancement = enhancements[provider.provider as ProviderType];
    const deelPrice = providerData.find(p => p.provider === 'deel')?.price || 0;
    const variance = deelPrice > 0 ? provider.price - deelPrice : 0;
    const variancePercentage = deelPrice > 0 ? ((variance / deelPrice) * 100).toFixed(1) : '0.0';

    return {
      provider: provider.provider,
      monthlyCost: provider.price,
      currency: finalChoice?.currency || 'USD',
      variance: variance,
      variancePercentage: `${variance >= 0 ? '+' : ''}${variancePercentage}%`,
      inRange: provider.inRange || false,
      isWinner: provider.isWinner || false,
      enhancementTotal: enhancement?.totalEnhancement,
      confidence: enhancement?.overallConfidence
    };
  });

  // Enhanced analysis data
  const enhancedAnalysis = selectedProviderEnhancement ? {
    totalEnhancement: selectedProviderEnhancement.totalEnhancement,
    confidence: selectedProviderEnhancement.overallConfidence,
    breakdown: (selectedProviderEnhancement as any)?.breakdown?.map((item: any) => ({
      category: item.category,
      amount: item.amount,
      description: item.description,
      confidence: item.confidence
    })) || [],
    warnings: selectedProviderEnhancement.warnings || [],
    legalRequirements: (selectedProviderEnhancement as any)?.legalRequirements || []
  } : undefined;

  // Collect base included benefits from the selected provider's base quote
  const baseIncludedBenefitLabels: string[] = [];
  try {
    if (finalChoice?.provider && quoteData?.quotes) {
      const provider = finalChoice.provider as ProviderType;
      const providerQuote: any = (quoteData.quotes as any)[provider] || (quoteData.quotes as any)[`${provider}`];
      if (providerQuote) {
        const normalized = QuoteNormalizer.normalize(provider, providerQuote);
        const extracted = ProviderInclusionsExtractor.extract(provider, normalized as any);
        const labelSet = new Set<string>();
        Object.values(extracted.includedBenefits || {}).forEach((item: any) => {
          const label = (item?.description || '').toString().trim();
          if (label) {
            const key = label.toLowerCase();
            if (!labelSet.has(key)) {
              labelSet.add(key);
              baseIncludedBenefitLabels.push(label);
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn('PDF: Failed to extract base included benefits for PDF:', e instanceof Error ? e.message : e);
  }

  // Reconciliation analysis
  const candidatesInRange = providerData.filter(p => p.inRange).length;
  const reconciliationAnalysis = generateReconciliationAnalysis(
    providerData.length,
    candidatesInRange,
    finalChoice?.provider || 'Unknown'
  );

  // Enhanced benefit labels from computed enhancements (to ensure visibility)
  const enhancementLabels: string[] = [];
  try {
    const e: any = selectedProviderEnhancement?.enhancements;
    if (e) {
      if (e?.terminationCosts && (e.terminationCosts.totalTerminationCost || 0) > 0) {
        enhancementLabels.push('Termination Provision (pro-rated)');
      }
      if (e?.thirteenthSalary && !e.thirteenthSalary.isAlreadyIncluded && ((e.thirteenthSalary.monthlyAmount || 0) > 0 || (e.thirteenthSalary.yearlyAmount || 0) > 0)) {
        enhancementLabels.push('13th Month Salary');
      }
      if (e?.fourteenthSalary && !e.fourteenthSalary.isAlreadyIncluded && ((e.fourteenthSalary.monthlyAmount || 0) > 0 || (e.fourteenthSalary.yearlyAmount || 0) > 0)) {
        enhancementLabels.push('14th Month Salary');
      }
      if (e?.vacationBonus && !e.vacationBonus.isAlreadyIncluded && (e.vacationBonus.amount || 0) > 0) {
        enhancementLabels.push('Vacation Bonus');
      }
      if (e?.transportationAllowance && !e.transportationAllowance.isAlreadyIncluded && (e.transportationAllowance.monthlyAmount || 0) > 0) {
        enhancementLabels.push('Transportation Allowance');
      }
      if (e?.remoteWorkAllowance && !e.remoteWorkAllowance.isAlreadyIncluded && (e.remoteWorkAllowance.monthlyAmount || 0) > 0) {
        enhancementLabels.push('Remote Work Allowance');
      }
      if (e?.mealVouchers && !e.mealVouchers.isAlreadyIncluded && (e.mealVouchers.monthlyAmount || 0) > 0) {
        enhancementLabels.push('Meal Vouchers');
      }
    }
  } catch {}

  const combinedBaseLabels = [...baseIncludedBenefitLabels, ...enhancementLabels];

  // Extract detailed base quote costs from original provider API response
  const baseQuoteDetails: { name: string; amount: number; frequency: string; description?: string }[] = [];
  try {
    if (finalChoice?.provider && quoteData?.quotes) {
      const provider = finalChoice.provider as ProviderType;
      const providerQuote: any = (quoteData.quotes as any)[provider] || (quoteData.quotes as any)[`${provider}`];
      
      if (providerQuote && providerQuote.costs && Array.isArray(providerQuote.costs)) {
        // Extract costs from Deel-style response
        providerQuote.costs.forEach((cost: any) => {
          if (cost && cost.name && cost.amount) {
            const amount = typeof cost.amount === 'string' ? parseFloat(cost.amount) || 0 : cost.amount || 0;
            if (amount > 0) {
              baseQuoteDetails.push({
                name: cost.name || 'Unknown Cost',
                amount: amount,
                frequency: cost.frequency || 'monthly',
                description: cost.description || undefined
              });
            }
          }
        });
      } else if (providerQuote) {
        // Handle other provider formats - extract key cost fields
        const costFields = [
          { key: 'deel_fee', name: 'Platform Fee' },
          { key: 'employer_costs', name: 'Employer Costs' },
          { key: 'contributions', name: 'Statutory Contributions' },
          { key: 'severance_accural', name: 'Severance Accrual' },
          { key: 'total_costs', name: 'Total Costs' }
        ];
        
        costFields.forEach(field => {
          const value = providerQuote[field.key];
          if (value !== undefined && value !== null) {
            const amount = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
            if (amount > 0) {
              baseQuoteDetails.push({
                name: field.name,
                amount: amount,
                frequency: 'monthly'
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn('PDF: Failed to extract base quote details:', e instanceof Error ? e.message : e);
  }

  // Extract detailed enhancement calculations from LLM response
  const enhancementDetails: {
    category: string;
    monthlyAmount: number;
    yearlyAmount?: number;
    explanation: string;
    confidence: number;
    isMandatory?: boolean;
    isAlreadyIncluded: boolean;
  }[] = [];
  
  if (selectedProviderEnhancement?.enhancements) {
    const enhancements = selectedProviderEnhancement.enhancements;
    
    // 13th Month Salary
    if (enhancements.thirteenthSalary) {
      enhancementDetails.push({
        category: '13th Month Salary',
        monthlyAmount: enhancements.thirteenthSalary.monthlyAmount || 0,
        yearlyAmount: enhancements.thirteenthSalary.yearlyAmount || 0,
        explanation: enhancements.thirteenthSalary.explanation || 'Additional salary payment required by law',
        confidence: enhancements.thirteenthSalary.confidence || 0,
        isAlreadyIncluded: enhancements.thirteenthSalary.isAlreadyIncluded || false
      });
    }
    
    // 14th Month Salary
    if (enhancements.fourteenthSalary) {
      enhancementDetails.push({
        category: '14th Month Salary',
        monthlyAmount: enhancements.fourteenthSalary.monthlyAmount || 0,
        yearlyAmount: enhancements.fourteenthSalary.yearlyAmount || 0,
        explanation: enhancements.fourteenthSalary.explanation || 'Additional salary payment required by law',
        confidence: enhancements.fourteenthSalary.confidence || 0,
        isAlreadyIncluded: enhancements.fourteenthSalary.isAlreadyIncluded || false
      });
    }
    
    // Vacation Bonus
    if (enhancements.vacationBonus) {
      enhancementDetails.push({
        category: 'Vacation Bonus',
        monthlyAmount: (enhancements.vacationBonus.amount || 0) / 12, // Convert yearly to monthly
        yearlyAmount: enhancements.vacationBonus.amount || 0,
        explanation: enhancements.vacationBonus.explanation || 'Annual vacation bonus payment',
        confidence: enhancements.vacationBonus.confidence || 0,
        isAlreadyIncluded: enhancements.vacationBonus.isAlreadyIncluded || false
      });
    }
    
    // Transportation Allowance
    if (enhancements.transportationAllowance) {
      enhancementDetails.push({
        category: 'Transportation Allowance',
        monthlyAmount: enhancements.transportationAllowance.monthlyAmount || 0,
        explanation: enhancements.transportationAllowance.explanation || 'Monthly transportation support',
        confidence: enhancements.transportationAllowance.confidence || 0,
        isMandatory: enhancements.transportationAllowance.isMandatory || false,
        isAlreadyIncluded: enhancements.transportationAllowance.isAlreadyIncluded || false
      });
    }
    
    // Remote Work Allowance
    if (enhancements.remoteWorkAllowance) {
      enhancementDetails.push({
        category: 'Remote Work Allowance',
        monthlyAmount: enhancements.remoteWorkAllowance.monthlyAmount || 0,
        explanation: enhancements.remoteWorkAllowance.explanation || 'Monthly remote work support',
        confidence: enhancements.remoteWorkAllowance.confidence || 0,
        isMandatory: enhancements.remoteWorkAllowance.isMandatory || false,
        isAlreadyIncluded: enhancements.remoteWorkAllowance.isAlreadyIncluded || false
      });
    }
    
    // Meal Vouchers
    if (enhancements.mealVouchers) {
      enhancementDetails.push({
        category: 'Meal Vouchers',
        monthlyAmount: enhancements.mealVouchers.monthlyAmount || 0,
        explanation: enhancements.mealVouchers.explanation || 'Monthly meal voucher allowance',
        confidence: enhancements.mealVouchers.confidence || 0,
        isAlreadyIncluded: enhancements.mealVouchers.isAlreadyIncluded || false
      });
    }
    
    // Termination Costs
    if (enhancements.terminationCosts) {
      const monthlyTerminationCost = (enhancements.terminationCosts.totalTerminationCost || 0) / 12;
      enhancementDetails.push({
        category: 'Termination Protection',
        monthlyAmount: monthlyTerminationCost,
        yearlyAmount: enhancements.terminationCosts.totalTerminationCost || 0,
        explanation: enhancements.terminationCosts.explanation || 'Legal termination cost provisions',
        confidence: enhancements.terminationCosts.confidence || 0,
        isAlreadyIncluded: false // Termination costs are typically additional
      });
    }
    
    // Medical Exam Costs
    if (enhancements.medicalExam && enhancements.medicalExam.required && enhancements.medicalExam.estimatedCost) {
      enhancementDetails.push({
        category: 'Medical Exam',
        monthlyAmount: (enhancements.medicalExam.estimatedCost || 0) / 12, // Spread over year
        yearlyAmount: enhancements.medicalExam.estimatedCost || 0,
        explanation: 'Required pre-employment medical examination',
        confidence: enhancements.medicalExam.confidence || 0,
        isAlreadyIncluded: false
      });
    }
    
    // console.log(`PDF: Extracted ${enhancementDetails.length} enhancement details from LLM response`);
  }

  return {
    // Document metadata
    documentTitle: `EOR Quote Analysis - ${finalChoice?.provider || 'Multiple Providers'}`,
    generatedAt: timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }),
    filename: `GraceMark_Quote_${finalChoice?.provider || 'Analysis'}_${timestamp.toISOString().split('T')[0]}.pdf`,

    // Executive summary
    selectedProvider: {
      name: capitalizeProvider(finalChoice?.provider || ''),
      totalCost: finalChoice?.price || 0,
      currency: finalChoice?.currency || 'USD',
      recommendation: generateRecommendationText(finalChoice, candidatesInRange, providerData.length)
    },

    // Employee information
    employee: {
      baseSalary: baseSalary,
      currency: formData?.currency || 'USD',
      country: formData?.country || 'Unknown',
      benefits: extractEnhancedBenefits(formData, selectedProviderEnhancement, combinedBaseLabels),
      employmentType: formData?.quoteType === 'all-inclusive' ? 'Full Employment Package' : 'Statutory Minimum Only',
      startDate: formData?.startDate,
      employeeName: formData?.employeeName || 'Employee',
      jobTitle: formData?.jobTitle || 'Position',
      holidayDays: formData?.holidayDays || 'Standard',
      workSchedule: formData?.hoursPerDay && formData?.daysPerWeek 
        ? `${formData.hoursPerDay} hours/day, ${formData.daysPerWeek} days/week`
        : 'Standard work schedule'
    },

    // Provider comparison
    providerComparison: formattedProviderComparison,

    // Enhanced analysis
    enhancedAnalysis,

    // Reconciliation details
    reconciliation: {
      methodology: '4% Variance Analysis using Deel as baseline reference',
      varianceThreshold: '±4% from Deel baseline price',
      candidatesInRange: candidatesInRange,
      totalProvidersAnalyzed: providerData.length,
      selectionCriteria: 'Highest price within acceptable variance range',
      analysis: reconciliationAnalysis
    },

    // Cost breakdown
    costBreakdown: {
      baseSalaryCost: selectedProviderEnhancement?.baseQuote?.baseCost || baseSalary,
      additionalCosts: additionalCosts,
      totalMonthlyCost: selectedPrice,
      annualCost: selectedPrice * 12,
      currency: finalChoice?.currency || 'USD'
    },

    // Detailed breakdowns from raw API responses
    baseQuoteDetails: baseQuoteDetails,
    enhancementDetails: enhancementDetails
  };
}

// Helper functions
function capitalizeProvider(provider: string): string {
  if (!provider) return '';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function extractUnifiedBenefits(
  formData: EORFormData | undefined,
  selectedProviderEnhancement: any,
  baseIncluded: string[] = []
): string[] {
  const benefits: string[] = [];
  const uniqueBenefits = new Set<string>(); // Prevent duplicates
  
  // console.log('🔍 Extracting Benefits Debug Info:');
  // console.log('📋 Form Data Selected Benefits:', formData?.selectedBenefits);
  // console.log('🤖 Enhancement Data:', selectedProviderEnhancement);
  
  // 1. Add statutory employment basics (always included)
  const statutoryBenefits = [
    'Statutory Employment Benefits',
    'Legal Compliance Coverage',
    'Employment Contract Management'
  ];
  
  statutoryBenefits.forEach(benefit => {
    benefits.push(benefit);
    uniqueBenefits.add(benefit.toLowerCase());
  });
  
  // 2. Base quote included benefits (from provider quote)
  if (Array.isArray(baseIncluded) && baseIncluded.length > 0) {
    let baseIncludedAdded = 0;
    baseIncluded.forEach((label) => {
      const clean = (label || '').toString().trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!uniqueBenefits.has(key)) {
        benefits.push(clean);
        uniqueBenefits.add(key);
        baseIncludedAdded++;
      }
    });
    // console.log(`PDF: Added ${baseIncludedAdded} base included benefits from provider quote`);
  }
  
  // 3. Extract benefits from form data (user selections)
  if (formData?.selectedBenefits) {
    let formBenefitsAdded = 0;
    Object.values(formData.selectedBenefits).forEach(benefit => {
      if (benefit && benefit.benefitName) {
        const benefitDisplay = benefit.providerName 
          ? `${benefit.benefitName} (${benefit.providerName})`
          : benefit.benefitName;
        
        const benefitKey = benefitDisplay.toLowerCase();
        if (!uniqueBenefits.has(benefitKey)) {
          benefits.push(`• ${benefitDisplay}`);
          uniqueBenefits.add(benefitKey);
          formBenefitsAdded++;
        }
      }
    });
    // console.log(`📦 Added ${formBenefitsAdded} benefits from form selections`);
  }
  
  // 3. Extract legal requirements from enhancement analysis
  if (selectedProviderEnhancement?.legalRequirements) {
    let legalBenefitsAdded = 0;
    const legalReqs = Array.isArray(selectedProviderEnhancement.legalRequirements) 
      ? selectedProviderEnhancement.legalRequirements 
      : [];
    
    legalReqs.forEach((requirement: string) => {
      if (requirement && typeof requirement === 'string' && requirement.trim()) {
        // Format legal requirements as compliance benefits
        const complianceBenefit = `• ${requirement.trim()}`;
        const benefitKey = requirement.toLowerCase().trim();
        
        if (!uniqueBenefits.has(benefitKey)) {
          benefits.push(complianceBenefit);
          uniqueBenefits.add(benefitKey);
          legalBenefitsAdded++;
        }
      }
    });
    // console.log(`⚖ Added ${legalBenefitsAdded} legal requirements as benefits`);
  }
  
  // 4. Extract enhancement breakdown items as additional coverage
  if (selectedProviderEnhancement?.breakdown) {
    let enhancementBenefitsAdded = 0;
    const breakdown = Array.isArray(selectedProviderEnhancement.breakdown) 
      ? selectedProviderEnhancement.breakdown 
      : [];
    
    breakdown.forEach((item: any) => {
      if (item && item.category && item.description) {
        const enhancementBenefit = `• ${item.category}: ${item.description}`;
        const benefitKey = `${item.category} ${item.description}`.toLowerCase();
        
        if (!uniqueBenefits.has(benefitKey) && item.amount > 0) {
          benefits.push(enhancementBenefit);
          uniqueBenefits.add(benefitKey);
          enhancementBenefitsAdded++;
        }
      }
    });
    // console.log(`💼 Added ${enhancementBenefitsAdded} enhancement items as benefits`);
  }
  
  // 5. Add compliance warnings as benefit considerations
  if (selectedProviderEnhancement?.warnings) {
    let warningBenefitsAdded = 0;
    const warnings = Array.isArray(selectedProviderEnhancement.warnings) 
      ? selectedProviderEnhancement.warnings 
      : [];
    
    // Only add first 2 warnings to avoid overcrowding
    warnings.slice(0, 2).forEach((warning: string) => {
      if (warning && typeof warning === 'string' && warning.trim()) {
        const warningBenefit = `• Compliance Note: ${warning.trim()}`;
        const benefitKey = warning.toLowerCase().trim();
        
        if (!uniqueBenefits.has(benefitKey)) {
          benefits.push(warningBenefit);
          uniqueBenefits.add(benefitKey);
          warningBenefitsAdded++;
        }
      }
    });
    // console.log(`⚠ Added ${warningBenefitsAdded} compliance warnings as benefit notes`);
  }
  
  // 6. Fallback if no benefits found
  if (benefits.length === statutoryBenefits.length) {
    benefits.push('Additional benefits analysis in progress');
    // console.log('PDF: Added fallback message - no additional benefits found');
  }
  
  // console.log(`PDF: Total Benefits Extracted: ${benefits.length}`);
  // console.log('PDF: Final Benefits List:', benefits);
  
  return benefits;
}

// Enhanced benefits extraction that prioritizes AI enhancement data
function extractEnhancedBenefits(
  formData: EORFormData | undefined,
  selectedProviderEnhancement: EnhancedQuote | null,
  baseIncluded: string[] = []
): string[] {
  const benefits: string[] = [];
  const uniqueBenefits = new Set<string>();
  
  // console.log('🔍 Enhanced Benefits Extraction Debug:');
  // console.log('🤖 Enhanced Quote Data:', selectedProviderEnhancement);
  
  // 1. Add statutory employment basics (always included)
  const statutoryBenefits = [
    'Employment Contract & Legal Compliance',
    'Local Statutory Benefits Coverage',
    'Employer of Record Services'
  ];
  
  statutoryBenefits.forEach(benefit => {
    benefits.push(benefit);
    uniqueBenefits.add(benefit.toLowerCase());
  });

  // 2. Extract enhancements from AI-calculated data (PRIORITY SOURCE)
  if (selectedProviderEnhancement?.enhancements) {
    let enhancementBenefitsAdded = 0;
    const enhancements = selectedProviderEnhancement.enhancements;
    
    // 13th Month Salary
    if (enhancements.thirteenthSalary && !enhancements.thirteenthSalary.isAlreadyIncluded) {
      const amount = enhancements.thirteenthSalary.monthlyAmount || 0;
      if (amount > 0) {
        const currency = selectedProviderEnhancement.baseCurrency || 'USD';
        benefits.push(`• 13th Month Salary: ${formatCurrency(amount, currency)} monthly`);
        uniqueBenefits.add('13th month salary');
        enhancementBenefitsAdded++;
      }
    }
    
    // 14th Month Salary
    if (enhancements.fourteenthSalary && !enhancements.fourteenthSalary.isAlreadyIncluded) {
      const amount = enhancements.fourteenthSalary.monthlyAmount || 0;
      if (amount > 0) {
        const currency = selectedProviderEnhancement.baseCurrency || 'USD';
        benefits.push(`• 14th Month Salary: ${formatCurrency(amount, currency)} monthly`);
        uniqueBenefits.add('14th month salary');
        enhancementBenefitsAdded++;
      }
    }
    
    // Vacation Bonus
    if (enhancements.vacationBonus && !enhancements.vacationBonus.isAlreadyIncluded) {
      const amount = enhancements.vacationBonus.amount || 0;
      if (amount > 0) {
        const currency = selectedProviderEnhancement.baseCurrency || 'USD';
        benefits.push(`• Vacation Bonus: ${formatCurrency(amount, currency)} annually`);
        uniqueBenefits.add('vacation bonus');
        enhancementBenefitsAdded++;
      }
    }
    
    // Transportation Allowance
    if (enhancements.transportationAllowance && !enhancements.transportationAllowance.isAlreadyIncluded) {
      const amount = enhancements.transportationAllowance.monthlyAmount || 0;
      if (amount > 0) {
        const currency = selectedProviderEnhancement.baseCurrency || 'USD';
        const mandatory = enhancements.transportationAllowance.isMandatory ? ' (Mandatory)' : '';
        benefits.push(`• Transportation Allowance: ${formatCurrency(amount, currency)} monthly${mandatory}`);
        uniqueBenefits.add('transportation allowance');
        enhancementBenefitsAdded++;
      }
    }
    
    // Remote Work Allowance
    if (enhancements.remoteWorkAllowance && !enhancements.remoteWorkAllowance.isAlreadyIncluded) {
      const amount = enhancements.remoteWorkAllowance.monthlyAmount || 0;
      if (amount > 0) {
        const currency = selectedProviderEnhancement.baseCurrency || 'USD';
        const mandatory = enhancements.remoteWorkAllowance.isMandatory ? ' (Mandatory)' : '';
        benefits.push(`• Remote Work Allowance: ${formatCurrency(amount, currency)} monthly${mandatory}`);
        uniqueBenefits.add('remote work allowance');
        enhancementBenefitsAdded++;
      }
    }
    
    // Meal Vouchers
    if (enhancements.mealVouchers && !enhancements.mealVouchers.isAlreadyIncluded) {
      const amount = enhancements.mealVouchers.monthlyAmount || 0;
      if (amount > 0) {
        const currency = selectedProviderEnhancement.baseCurrency || 'USD';
        benefits.push(`• Meal Vouchers: ${formatCurrency(amount, currency)} monthly`);
        uniqueBenefits.add('meal vouchers');
        enhancementBenefitsAdded++;
      }
    }
    
    // Termination Costs (as coverage)
    if (enhancements.terminationCosts && enhancements.terminationCosts.totalTerminationCost > 0) {
      const amount = enhancements.terminationCosts.totalTerminationCost;
      const currency = selectedProviderEnhancement.baseCurrency || 'USD';
      benefits.push(`• Termination Protection: ${formatCurrency(amount, currency)} coverage`);
      uniqueBenefits.add('termination protection');
      enhancementBenefitsAdded++;
    }
    
    // console.log(`💼 Added ${enhancementBenefitsAdded} AI-calculated enhancements`);
  }
  
  // 3. Add base included benefits (from provider quote) if not already covered
  if (Array.isArray(baseIncluded) && baseIncluded.length > 0) {
    let baseIncludedAdded = 0;
    baseIncluded.forEach((label) => {
      const clean = (label || '').toString().trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!uniqueBenefits.has(key)) {
        benefits.push(`• ${clean}`);
        uniqueBenefits.add(key);
        baseIncludedAdded++;
      }
    });
    // console.log(`📦 Added ${baseIncludedAdded} base provider benefits`);
  }
  
  // 4. Add user-selected benefits from form (if not covered by enhancements)
  if (formData?.selectedBenefits) {
    let formBenefitsAdded = 0;
    Object.values(formData.selectedBenefits).forEach(benefit => {
      if (benefit && benefit.benefitName) {
        const benefitDisplay = benefit.providerName 
          ? `${benefit.benefitName} (${benefit.providerName})`
          : benefit.benefitName;
        
        const benefitKey = benefitDisplay.toLowerCase();
        if (!uniqueBenefits.has(benefitKey)) {
          benefits.push(`• ${benefitDisplay}`);
          uniqueBenefits.add(benefitKey);
          formBenefitsAdded++;
        }
      }
    });
    // console.log(`📋 Added ${formBenefitsAdded} user-selected benefits`);
  }
  
  // 5. Add legal requirements as compliance coverage
  if (selectedProviderEnhancement?.warnings && selectedProviderEnhancement.warnings.length > 0) {
    let complianceBenefitsAdded = 0;
    selectedProviderEnhancement.warnings.slice(0, 2).forEach((warning: string) => {
      if (warning && typeof warning === 'string' && warning.trim()) {
        const complianceBenefit = `• Legal Compliance: ${warning.trim()}`;
        const benefitKey = warning.toLowerCase().trim();
        
        if (!uniqueBenefits.has(benefitKey)) {
          benefits.push(complianceBenefit);
          uniqueBenefits.add(benefitKey);
          complianceBenefitsAdded++;
        }
      }
    });
    // console.log(`⚖ Added ${complianceBenefitsAdded} compliance requirements`);
  }
  
  // 6. Fallback if no enhanced benefits found
  if (benefits.length === statutoryBenefits.length) {
    benefits.push('• Additional benefits as per local employment law');
    // console.log('PDF: Added fallback benefit message');
  }
  
  // console.log(`PDF Enhanced: Total Benefits Extracted: ${benefits.length}`);
  // console.log('PDF Enhanced: Final Benefits List:', benefits);
  
  return benefits;
}

function generateRecommendationText(
  finalChoice: { provider: string; price: number; currency: string } | null,
  candidatesInRange: number,
  totalProviders: number
): string {
  if (!finalChoice) {
    return 'No provider recommendation available due to insufficient data.';
  }

  if (candidatesInRange === 0) {
    return `${capitalizeProvider(finalChoice.provider)} was selected as the only available option, though it falls outside the optimal variance range.`;
  }

  if (candidatesInRange === 1) {
    return `${capitalizeProvider(finalChoice.provider)} is the only provider within the acceptable variance range and is therefore the recommended choice.`;
  }

  return `${capitalizeProvider(finalChoice.provider)} offers the highest value among ${candidatesInRange} providers within the acceptable variance range, making it the optimal choice for this engagement.`;
}

function generateReconciliationAnalysis(
  totalProviders: number,
  candidatesInRange: number,
  selectedProvider: string
): string {
  const analysis = [];
  
  analysis.push(`Analyzed ${totalProviders} EOR providers using a systematic variance analysis approach.`);
  analysis.push(`Used Deel as the baseline reference price for variance calculations.`);
  analysis.push(`Applied a ±4% variance threshold to identify competitively priced providers.`);
  
  if (candidatesInRange > 0) {
    analysis.push(`${candidatesInRange} provider(s) fell within the acceptable variance range.`);
    analysis.push(`Selected ${capitalizeProvider(selectedProvider)} as it offered the highest value within the acceptable range.`);
  } else {
    analysis.push(`No providers fell within the ±4% variance range.`);
    analysis.push(`${capitalizeProvider(selectedProvider)} was selected as the best available option.`);
  }
  
  return analysis.join(' ');
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    // Fallback if currency is invalid
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

export function calculateSavingsFromBaseline(
  selectedPrice: number,
  baselinePrice: number,
  currency: string
): { amount: number; percentage: string; formatted: string; isPositive: boolean } {
  const savings = baselinePrice - selectedPrice;
  const percentage = baselinePrice > 0 ? ((savings / baselinePrice) * 100) : 0;
  
  return {
    amount: Math.abs(savings),
    percentage: `${percentage >= 0 ? '' : '+'}${Math.abs(percentage).toFixed(1)}%`,
    formatted: formatCurrency(Math.abs(savings), currency),
    isPositive: savings > 0
  };
}

