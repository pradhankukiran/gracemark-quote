// Professional PDF Document Template - EOR Quote Analysis Report
// Completely redesigned to fix page breaks and layout issues

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from '@react-pdf/renderer';
import { PDFQuoteData } from './pdfDataTransformer';
import { ProviderLogoData } from './logoUtils';

// Professional color scheme
const colors = {
  primary: '#1e40af',
  secondary: '#374151',
  accent: '#10b981',
  danger: '#ef4444',
  background: '#f8fafc',
  border: '#e2e8f0',
  text: '#1f2937',
  textLight: '#6b7280',
  white: '#ffffff'
};

// Optimized styles to prevent page overflow
const styles = StyleSheet.create({
  // Page layout - Fixed sizing to prevent overflow
  page: {
    backgroundColor: colors.white,
    padding: 30, // Reduced from 40
    fontSize: 9, // Reduced from 10
    fontFamily: 'Helvetica',
    color: colors.text,
    lineHeight: 1.3 // Reduced from 1.4
  },
  
  // Header - Compact
  header: {
    marginBottom: 20, // Reduced from 30
    paddingBottom: 15, // Reduced from 20
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    borderBottomStyle: 'solid'
  },
  
  headerTitle: {
    fontSize: 20, // Reduced from 24
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 6, // Reduced from 8
    textAlign: 'center'
  },
  
  headerSubtitle: {
    fontSize: 11, // Reduced from 12
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 4 // Reduced from 5
  },
  
  headerDate: {
    fontSize: 9, // Reduced from 10
    color: colors.textLight,
    textAlign: 'right'
  },
  
  // Section titles - Compact
  sectionTitle: {
    fontSize: 14, // Reduced from 16
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12, // Reduced from 15
    marginTop: 15, // Reduced from 20
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  
  // Executive Summary - Compact
  executiveCard: {
    backgroundColor: colors.background,
    padding: 15, // Reduced from 20
    marginBottom: 20, // Reduced from 25
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderLeftStyle: 'solid'
  },
  
  providerHighlight: {
    marginBottom: 12 // Reduced from 15
  },
  
  providerName: {
    fontSize: 16, // Reduced from 18
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4 // Reduced from 5
  },
  
  providerPrice: {
    fontSize: 24, // Reduced from 28
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 8 // Reduced from 10
  },
  
  recommendation: {
    fontSize: 10, // Reduced from 11
    color: colors.textLight,
    lineHeight: 1.4
  },
  
  // Optimized layout - Single column to prevent overflow
  contentSection: {
    marginBottom: 15 // Reduced from 25
  },
  
  // Info cards - Compact
  infoCard: {
    backgroundColor: colors.background,
    padding: 12, // Reduced from 15
    marginBottom: 12, // Reduced from 15
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'solid'
  },
  
  cardTitle: {
    fontSize: 11, // Reduced from 12
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10, // Reduced from 12
    textTransform: 'uppercase'
  },
  
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6, // Reduced from 8
    alignItems: 'flex-start'
  },
  
  infoLabel: {
    fontSize: 8, // Reduced from 9
    color: colors.textLight,
    width: '40%',
    flexShrink: 0
  },
  
  infoValue: {
    fontSize: 9, // Reduced from 11
    fontWeight: 'bold',
    color: colors.text,
    width: '60%',
    textAlign: 'right'
  },
  
  // Benefits list - Optimized
  benefitsList: {
    marginTop: 6 // Reduced from 8
  },
  
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 3, // Reduced from 4
    alignItems: 'flex-start'
  },
  
  bullet: {
    width: 10, // Reduced from 12
    fontSize: 8, // Reduced from 10
    color: colors.primary,
    marginRight: 4, // Reduced from 5
  },
  
  benefitText: {
    fontSize: 8, // Reduced from 9
    color: colors.text,
    flex: 1,
    lineHeight: 1.3
  },
  
  // Tables - Compact
  table: {
    marginBottom: 15, // Reduced from 20
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'solid'
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 6, // Reduced from 8
    paddingHorizontal: 3 // Reduced from 4
  },
  
  tableHeaderCell: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 8, // Reduced from 9
    textAlign: 'center',
    paddingHorizontal: 2 // Reduced from 4
  },
  
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    paddingVertical: 5, // Reduced from 6
    paddingHorizontal: 3 // Reduced from 4
  },
  
  tableRowAlt: {
    backgroundColor: colors.background
  },
  
  tableCell: {
    fontSize: 8, // Reduced from 9
    paddingHorizontal: 2, // Reduced from 4
    paddingVertical: 1, // Reduced from 2
    textAlign: 'left'
  },
  
  tableCellCenter: {
    textAlign: 'center'
  },
  
  tableCellBold: {
    fontWeight: 'bold'
  },
  
  // Optimized column widths
  colProvider: { width: '22%' },
  colCost: { width: '22%' },
  colVariance: { width: '18%' },
  colInRange: { width: '16%' },
  colStatus: { width: '22%' },
  
  // Status colors
  statusGreen: { color: colors.accent },
  statusRed: { color: colors.danger },
  statusGray: { color: colors.textLight },
  
  // Analysis section - Compact
  analysisCard: {
    backgroundColor: colors.white,
    padding: 12, // Reduced from 15
    marginBottom: 15, // Reduced from 20
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'solid',
    borderRadius: 4
  },
  
  analysisTitle: {
    fontSize: 11, // Reduced from 12
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8 // Reduced from 10
  },
  
  analysisText: {
    fontSize: 8, // Reduced from 10
    lineHeight: 1.3, // Reduced from 1.4
    color: colors.text,
    marginBottom: 4 // Reduced from 6
  },
  
  confidenceScore: {
    fontSize: 12, // Reduced from 14
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 8 // Reduced from 10
  },
  
  warningItem: {
    flexDirection: 'row',
    marginBottom: 4, // Reduced from 6
    alignItems: 'flex-start'
  },
  
  warningIcon: {
    width: 12, // Reduced from 15
    fontSize: 8, // Reduced from 10
    color: colors.danger,
    marginRight: 4 // Reduced from 5
  },
  
  warningText: {
    fontSize: 8, // Reduced from 9
    color: colors.danger,
    flex: 1,
    lineHeight: 1.2 // Reduced from 1.3
  },
  
  // Footer - RELATIVE positioning to prevent page breaks
  footer: {
    marginTop: 20, // Changed from position absolute
    paddingTop: 10, // Reduced from 15
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  
  footerText: {
    fontSize: 7, // Reduced from 8
    color: colors.textLight
  },

  // Two-column layout with proper sizing
  twoColumns: {
    flexDirection: 'row',
    marginBottom: 15, // Reduced from 25
    gap: 10 // Reduced from 15
  },
  
  column: {
    width: '48%',
    flexShrink: 0
  }
});

interface QuotePDFDocumentProps {
  data: PDFQuoteData;
  providerLogos?: Record<string, ProviderLogoData>;
}

// Sanitize benefits coming from mixed sources (strip leading bullets/control chars)
const sanitizeBenefit = (value: unknown): string => {
  try {
    const str = String(value ?? '');
    // Remove leading control chars, bullets, dashes, and punctuation
    return str.replace(/^[\u0000-\u0020\u2000-\u206F\u2E00-\u2E7F•\-\s]+/u, '').trim();
  } catch {
    return '';
  }
};

export const QuotePDFDocument: React.FC<QuotePDFDocumentProps> = ({
  data,
  providerLogos = {}
}) => {
  return (
    <Document>
      {/* PAGE 1 - Executive Summary & Employee Details */}
      <Page size="A4" style={styles.page}>
{/* Header removed per user request */}

        {/* Executive Summary */}
        <View style={styles.executiveCard}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.providerHighlight}>
            <Text style={styles.providerName}>
              Recommended Provider: {data.selectedProvider.name}
            </Text>
            <Text style={styles.providerPrice}>
              {data.selectedProvider.totalCost.toLocaleString('en-US', {
                style: 'currency',
                currency: data.selectedProvider.currency
              })} / month
            </Text>
          </View>
          <Text style={styles.recommendation}>{data.selectedProvider.recommendation}</Text>
        </View>

        {/* Employee & Cost in Two Columns */}
        <View style={[styles.contentSection, styles.twoColumns]}>
          <View style={styles.column}>
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Employee Details</Text>
              {data.employee.employeeName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Employee Name:</Text>
                  <Text style={styles.infoValue}>{data.employee.employeeName}</Text>
                </View>
              )}
              {data.employee.jobTitle && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Job Title:</Text>
                  <Text style={styles.infoValue}>{data.employee.jobTitle}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Base Salary:</Text>
                <Text style={styles.infoValue}>
                  {data.employee.baseSalary.toLocaleString('en-US', {
                    style: 'currency',
                    currency: data.employee.currency
                  })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Country:</Text>
                <Text style={styles.infoValue}>{data.employee.country}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Employment Type:</Text>
                <Text style={styles.infoValue}>{data.employee.employmentType}</Text>
              </View>
              {data.employee.workSchedule && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Work Schedule:</Text>
                  <Text style={styles.infoValue}>{data.employee.workSchedule}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.column}>
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Cost Breakdown</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Base Salary:</Text>
                <Text style={styles.infoValue}>
                  {data.costBreakdown.baseSalaryCost.toLocaleString('en-US', {
                    style: 'currency',
                    currency: data.costBreakdown.currency
                  })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Additional Costs:</Text>
                <Text style={styles.infoValue}>
                  {data.costBreakdown.additionalCosts.toLocaleString('en-US', {
                    style: 'currency',
                    currency: data.costBreakdown.currency
                  })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Monthly Total:</Text>
                <Text style={[styles.infoValue, { color: colors.primary, fontSize: 11 }]}>
                  {data.costBreakdown.totalMonthlyCost.toLocaleString('en-US', {
                    style: 'currency',
                    currency: data.costBreakdown.currency
                  })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Annual Cost:</Text>
                <Text style={[styles.infoValue, { color: colors.accent, fontSize: 11 }]}>
                  {data.costBreakdown.annualCost.toLocaleString('en-US', {
                    style: 'currency',
                    currency: data.costBreakdown.currency
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Benefits Package - AI-Powered Analysis */}
        <View style={styles.contentSection}>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>AI-Enhanced Benefits Package</Text>
            <View style={styles.benefitsList}>
              {data.employee.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.benefitText}>{sanitizeBenefit(benefit)}</Text>
                </View>
              ))}
            </View>
            
            {/* Show AI confidence and enhancement value */}
            {data.enhancedAnalysis && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', borderTopStyle: 'solid' }}>
                <Text style={[styles.analysisText, { fontWeight: 'bold', marginBottom: 4 }]}>
                  AI Enhancement Value: {data.enhancedAnalysis.totalEnhancement.toLocaleString('en-US', {
                    style: 'currency',
                    currency: data.selectedProvider.currency
                  })} monthly
                </Text>
                <Text style={styles.analysisText}>
                  Confidence: {(data.enhancedAnalysis.confidence * 100).toFixed(0)}% | Based on local employment law analysis
                </Text>
              </View>
            )}
          </View>
        </View>

{/* Provider selection summary removed per user request */}

        {/* Base Quote Breakdown - Direct from Provider API */}
        {data.baseQuoteDetails.length > 0 && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Base Quote Breakdown</Text>
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Provider API Response - {data.selectedProvider.name}</Text>
              {data.baseQuoteDetails.map((item, index) => (
                <View key={index} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{item.name}:</Text>
                  <Text style={[styles.infoValue, { fontSize: 10 }]}>
                    {item.amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: data.selectedProvider.currency
                    })} {item.frequency}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Enhanced Quote Breakdown - Direct from LLM Analysis */}
        {data.enhancementDetails.length > 0 && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>AI Enhancement Breakdown</Text>
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>LLM Analysis Response</Text>
              {data.enhancementDetails.map((enhancement, index) => (
                <View key={index} style={{ marginBottom: 8, paddingBottom: 6, borderBottomWidth: index < data.enhancementDetails.length - 1 ? 1 : 0, borderBottomColor: '#e2e8f0', borderBottomStyle: 'solid' }}>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { fontWeight: 'bold', color: colors.primary }]}>
                      {enhancement.category}
                      {enhancement.isMandatory ? ' (Mandatory)' : ''}
                      {enhancement.isAlreadyIncluded ? ' (Included)' : ''}:
                    </Text>
                    <Text style={[styles.infoValue, { fontSize: 10, fontWeight: 'bold' }]}>
                      {enhancement.monthlyAmount.toLocaleString('en-US', {
                        style: 'currency',
                        currency: data.selectedProvider.currency
                      })} monthly
                    </Text>
                  </View>
                  {enhancement.yearlyAmount && enhancement.yearlyAmount > 0 && (
                    <View style={[styles.infoRow, { marginTop: 2 }]}>
                      <Text style={styles.infoLabel}>Annual Amount:</Text>
                      <Text style={styles.infoValue}>
                        {enhancement.yearlyAmount.toLocaleString('en-US', {
                          style: 'currency',
                          currency: data.selectedProvider.currency
                        })}
                      </Text>
                    </View>
                  )}
                  <View style={{ marginTop: 4 }}>
                    <Text style={[styles.analysisText, { fontSize: 7 }]}>
                      {enhancement.explanation}
                    </Text>
                    <Text style={[styles.analysisText, { fontSize: 7, color: colors.textLight, marginTop: 2 }]}>
                      Confidence: {(enhancement.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Streamlined Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            AI-Enhanced EOR Analysis | For informational purposes only | Consult legal experts for compliance
          </Text>
          <Text style={styles.footerText}>
            Generated: {data.generatedAt.split(',')[0]}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default QuotePDFDocument;
