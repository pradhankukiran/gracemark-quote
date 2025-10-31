// PDF Download Handler - Orchestrates PDF generation and download process

import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import React from 'react';
import { transformQuoteDataForPDF } from './pdfDataTransformer';
import { 
  getAllProviderLogosWithBase64, 
  preloadProviderLogos
} from './logoUtils';
import { QuotePDFDocument } from './QuotePDFDocument';

// Import types
import type { PDFQuoteData } from './pdfDataTransformer';
import type { ProviderLogoData } from './logoUtils';
import { ProviderType, EnhancedQuote } from '@/lib/types/enhancement';

export interface DownloadProgress {
  step: string;
  progress: number;
  message: string;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: Error) => void;
  onSuccess?: (filename: string) => void;
  includeLogos?: boolean;
  filename?: string;
}

/**
 * Main download handler for PDF generation
 */
export async function downloadQuotePDF(
  finalChoice: { provider: string; price: number; currency: string; enhancedQuote?: EnhancedQuote } | null,
  providerData: { provider: string; price: number; inRange?: boolean; isWinner?: boolean }[],
  quoteData: any,
  enhancements: Record<ProviderType, EnhancedQuote | null>,
  options: DownloadOptions = {}
): Promise<void> {
  const {
    onProgress,
    onError,
    onSuccess,
    includeLogos = true,
    filename
  } = options;

  try {
    // Step 1: Validate input data
    onProgress?.({
      step: 'validation',
      progress: 5,
      message: 'Validating quote data...'
    });

    // Enhanced validation with detailed error messages
    const validation = validatePDFData(finalChoice, providerData, quoteData);
    
    if (!validation.isValid) {
      const errorMessage = `PDF generation failed due to invalid data:\n${validation.errors.join('\n')}`;
      throw new Error(errorMessage);
    }

    // Log warnings if any (non-blocking)
    if (validation.warnings.length > 0) {
      console.warn('PDF Generation Warnings:', validation.warnings);
    }

    // Step 2: Transform data for PDF
    onProgress?.({
      step: 'transform',
      progress: 15,
      message: 'Preparing quote data...'
    });

    // Comprehensive logging for debugging
    // console.log('📊 PDF Generation Data Debug:');
    // console.log('🎯 Final Choice:', finalChoice);
    // console.log('📋 Provider Data:', providerData);
    // console.log('📝 Quote Data Structure:', {
    //   calculatorType: quoteData?.calculatorType,
    //   status: quoteData?.status,
    //   hasFormData: !!quoteData?.formData,
    //   formDataKeys: quoteData?.formData ? Object.keys(quoteData.formData) : [],
    //   hasQuotes: !!quoteData?.quotes,
    //   quotesKeys: quoteData?.quotes ? Object.keys(quoteData.quotes) : []
    // });
    // console.log('🤖 Enhancements Available:', Object.keys(enhancements || {}));
    
    // Log specific form data for debugging
    if (quoteData?.formData) {
      // console.log('👤 Form Data Details:', {
      //   employeeName: quoteData.formData.employeeName,
      //   baseSalary: quoteData.formData.baseSalary,
      //   country: quoteData.formData.country,
      //   selectedBenefits: quoteData.formData.selectedBenefits,
      //   selectedBenefitsKeys: quoteData.formData.selectedBenefits ? Object.keys(quoteData.formData.selectedBenefits) : []
      // });
    }

    const pdfData: PDFQuoteData = transformQuoteDataForPDF(
      finalChoice,
      providerData,
      quoteData,
      enhancements
    );

    // Log transformed PDF data
    // console.log('📄 PDF Data Generated:', {
    //   documentTitle: pdfData.documentTitle,
    //   employeeName: pdfData.employee.employeeName,
    //   baseSalary: pdfData.employee.baseSalary,
    //   benefitsCount: pdfData.employee.benefits.length,
    //   providerComparisonCount: pdfData.providerComparison.length,
    //   hasEnhancedAnalysis: !!pdfData.enhancedAnalysis
    // });
    // console.log('🏆 Benefits Extracted:', pdfData.employee.benefits);

    // Step 3: Load provider logos (if requested)
    let providerLogos: Record<string, ProviderLogoData> = {};
    
    if (includeLogos) {
      onProgress?.({
        step: 'logos',
        progress: 30,
        message: 'Loading provider logos...'
      });

      try {
        const uniqueProviders = Array.from(new Set([
          finalChoice.provider,
          ...providerData.map(p => p.provider)
        ])) as ProviderType[];

        // Preload logos for better performance
        await preloadProviderLogos(uniqueProviders);
        
        // Convert logos to base64
        providerLogos = await getAllProviderLogosWithBase64(uniqueProviders);
        
        onProgress?.({
          step: 'logos',
          progress: 50,
          message: 'Provider logos loaded successfully'
        });
      } catch (logoError) {
        console.warn('Failed to load some provider logos:', logoError);
        // Continue without logos rather than failing completely
      }
    }

    // Step 4: Generate PDF document
    onProgress?.({
      step: 'generate',
      progress: 60,
      message: 'Generating PDF document...'
    });

    const documentElement = React.createElement(QuotePDFDocument, {
      data: pdfData,
      providerLogos
    });

    // Step 5: Create PDF blob
    onProgress?.({
      step: 'render',
      progress: 80,
      message: 'Rendering PDF...'
    });

    const pdfBlob = await pdf(documentElement).toBlob();

    // Step 6: Generate filename and download
    onProgress?.({
      step: 'download',
      progress: 95,
      message: 'Preparing download...'
    });

    const downloadFilename = filename || pdfData.filename;
    
    // Trigger download
    saveAs(pdfBlob, downloadFilename);

    // Step 7: Complete
    onProgress?.({
      step: 'complete',
      progress: 100,
      message: 'PDF download completed successfully!'
    });

    onSuccess?.(downloadFilename);

  } catch (error) {
    console.error('PDF generation failed:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred during PDF generation';
    
    onError?.(new Error(errorMessage));
    throw error;
  }
}

/**
 * Quick download without progress tracking (simplified version)
 */
export async function quickDownloadQuotePDF(
  finalChoice: { provider: string; price: number; currency: string; enhancedQuote?: EnhancedQuote } | null,
  providerData: { provider: string; price: number; inRange?: boolean; isWinner?: boolean }[],
  quoteData: any,
  enhancements: Record<ProviderType, EnhancedQuote | null>
): Promise<string> {
  return new Promise((resolve, reject) => {
    downloadQuotePDF(
      finalChoice,
      providerData,
      quoteData,
      enhancements,
      {
        onSuccess: (filename) => resolve(filename),
        onError: (error) => reject(error),
        includeLogos: true
      }
    );
  });
}

/**
 * Validate if PDF generation is possible with current data
 */
export function validatePDFData(
  finalChoice: { provider: string; price: number; currency: string; enhancedQuote?: EnhancedQuote } | null,
  providerData: { provider: string; price: number; inRange?: boolean; isWinner?: boolean }[],
  quoteData: any
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical validations (will prevent PDF generation)
  if (!finalChoice) {
    errors.push('No provider recommendation available - please complete reconciliation first');
  }

  if (!providerData || providerData.length === 0) {
    errors.push('No provider comparison data available - please run quotes for multiple providers');
  }

  if (!quoteData || !quoteData.formData) {
    errors.push('No quote form data available - please ensure form was submitted properly');
  }

  // Validate finalChoice structure
  if (finalChoice) {
    if (!finalChoice.provider || typeof finalChoice.provider !== 'string') {
      errors.push('Invalid provider name in recommendation');
    }
    if (typeof finalChoice.price !== 'number' || finalChoice.price <= 0) {
      errors.push('Invalid price in recommendation - price must be a positive number');
    }
    if (!finalChoice.currency || typeof finalChoice.currency !== 'string') {
      errors.push('Invalid currency in recommendation');
    }
  }

  // Validate providerData structure
  if (providerData && providerData.length > 0) {
    const invalidProviders = providerData.filter(p => 
      !p.provider || 
      typeof p.provider !== 'string' || 
      typeof p.price !== 'number' || 
      p.price < 0
    );
    
    if (invalidProviders.length > 0) {
      errors.push(`${invalidProviders.length} provider(s) have invalid pricing data`);
    }

    if (providerData.length < 2) {
      warnings.push('Only one provider available for comparison - consider getting additional quotes');
    }
  }

  // Enhanced form data validation
  if (quoteData?.formData) {
    const formData = quoteData.formData;
    
    // Critical fields
    if (!formData.country || typeof formData.country !== 'string') {
      errors.push('Employee country information is missing or invalid');
    }
    
    // Check baseSalary instead of salary
    if (!formData.baseSalary) {
      errors.push('Base salary information is missing');
    } else if (isNaN(parseFloat(formData.baseSalary)) || parseFloat(formData.baseSalary) <= 0) {
      errors.push('Base salary must be a valid positive number');
    }

    if (!formData.currency || typeof formData.currency !== 'string') {
      errors.push('Currency information is missing');
    }

    // Warning fields (missing but won't break PDF)
    if (!formData.employeeName || formData.employeeName.trim() === '') {
      warnings.push('Employee name is missing - will show as "Employee" in PDF');
    }

    if (!formData.jobTitle || formData.jobTitle.trim() === '') {
      warnings.push('Job title is missing - will show as "Position" in PDF');
    }

    if (!formData.startDate) {
      warnings.push('Start date is missing');
    }

    if (!formData.selectedBenefits || Object.keys(formData.selectedBenefits).length === 0) {
      warnings.push('No additional benefits selected - only statutory benefits will be shown');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get estimated file size (rough calculation)
 */
export function getEstimatedPDFSize(providerCount: number, includeLogos: boolean): string {
  // Base PDF size estimation
  let sizeKB = 50; // Base document
  
  // Add size for provider data
  sizeKB += providerCount * 2;
  
  // Add size for logos
  if (includeLogos) {
    sizeKB += providerCount * 15; // ~15KB per logo
  }
  
  // Add size for enhanced analysis (if present)
  sizeKB += 10;
  
  if (sizeKB > 1024) {
    return `${(sizeKB / 1024).toFixed(1)} MB`;
  }
  
  return `${Math.round(sizeKB)} KB`;
}

/**
 * Check if browser supports PDF download
 */
export function isBrowserSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for required browser APIs
  const hasBlob = typeof Blob !== 'undefined';
  const hasURL = typeof URL !== 'undefined' && URL.createObjectURL;
  const hasCanvas = typeof HTMLCanvasElement !== 'undefined';
  
  return hasBlob && hasURL && hasCanvas;
}

/**
 * Download error handler with user-friendly messages
 */
export function handleDownloadError(error: unknown): string {
  if (error instanceof Error) {
    switch (error.message) {
      case 'Missing required quote data for PDF generation':
        return 'Unable to generate PDF: Quote data is incomplete. Please ensure all providers have been analyzed.';
      
      case 'Network request failed':
        return 'Unable to generate PDF: Network connection issue. Please check your internet connection and try again.';
      
      case 'Canvas is not supported':
        return 'Unable to generate PDF: Your browser does not support PDF generation. Please try using a modern browser.';
      
      default:
        return `PDF generation failed: ${error.message}`;
    }
  }
  
  return 'An unexpected error occurred while generating the PDF. Please try again.';
}

// Export additional types for use in components
export type { PDFQuoteData, ProviderLogoData };