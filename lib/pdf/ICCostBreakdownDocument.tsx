import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface ICPdfRateInfo {
  payRateHourly: string
  payRateMonthly: string
  billRateHourly: string
  billRateMonthly: string
  agencyFeeHourly: string
  agencyFeeMonthly: string
  markupPercentage: string
  workedHours: number
}

export interface ICPdfCostItem {
  label: string
  value: string
  description?: string
}

export interface ICPdfData {
  contractorName: string
  country: string
  currency: string
  showUSD: boolean
  rateInfo: ICPdfRateInfo
  costBreakdown: ICPdfCostItem[]
  totalClientCost: string
  monthlyMarkup: string
  contractDuration: string
  paymentFrequency: string
  logoSrc: string
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 82,
    objectFit: 'contain',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  infoItem: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  rateCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rateCard: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  rateCardPrimary: {
    backgroundColor: '#f0f9ff',
    borderColor: '#3b82f6',
  },
  rateCardSecondary: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  rateCardLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  rateCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  rateCardValuePrimary: {
    color: '#1e40af',
  },
  rateCardValueSecondary: {
    color: '#065f46',
  },
  rateCardSecondaryValue: {
    fontSize: 9,
    color: '#64748b',
  },
  formulaBox: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  formulaText: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'center',
  },
  costTable: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  costRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  costRowLast: {
    borderBottomWidth: 0,
  },
  costRowHighlight: {
    backgroundColor: '#f9fafb',
  },
  costRowTotal: {
    backgroundColor: '#1e293b',
  },
  costLabel: {
    flex: 2,
    fontSize: 10,
  },
  costLabelWhite: {
    color: '#ffffff',
  },
  costDescription: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
  costValue: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  costValueWhite: {
    color: '#ffffff',
    fontSize: 13,
  },
  summaryBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: 'bold',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#047857',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
})

export const ICCostBreakdownDocument: React.FC<{ data: ICPdfData }> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image src={data.logoSrc} style={styles.logo} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Independent Contractor Quote Breakdown</Text>
          <Text style={styles.subtitle}>
            {data.contractorName} • {data.country}
          </Text>
        </View>

        {/* Rate Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate Overview</Text>

          <View style={styles.rateCards}>
            <View style={[styles.rateCard, styles.rateCardPrimary]}>
              <Text style={styles.rateCardLabel}>Pay Rate (Contractor)</Text>
              <Text style={[styles.rateCardValue, styles.rateCardValuePrimary]}>
                {data.rateInfo.payRateHourly}/hr
              </Text>
              <Text style={styles.rateCardSecondaryValue}>
                {data.rateInfo.payRateMonthly}/month
              </Text>
            </View>

            <View style={[styles.rateCard, styles.rateCardPrimary]}>
              <Text style={styles.rateCardLabel}>Bill Rate (Client)</Text>
              <Text style={[styles.rateCardValue, styles.rateCardValuePrimary]}>
                {data.rateInfo.billRateHourly}/hr
              </Text>
              <Text style={styles.rateCardSecondaryValue}>
                {data.rateInfo.billRateMonthly}/month
              </Text>
            </View>

            <View style={[styles.rateCard, styles.rateCardSecondary]}>
              <Text style={styles.rateCardLabel}>Agency Fee (Markup)</Text>
              <Text style={[styles.rateCardValue, styles.rateCardValueSecondary]}>
                {data.rateInfo.agencyFeeHourly}/hr
              </Text>
              <Text style={styles.rateCardSecondaryValue}>
                {data.rateInfo.agencyFeeMonthly}/month
              </Text>
            </View>
          </View>

          <View style={styles.formulaBox}>
            <Text style={styles.formulaText}>
              Bill Rate = Pay Rate × (1 + {data.rateInfo.markupPercentage}% markup) |
              Monthly conversions assume {data.rateInfo.workedHours} hours per month
            </Text>
          </View>
        </View>

        {/* Monthly Cost Breakdown Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Cost Breakdown</Text>

          <View style={styles.costTable}>
            {data.costBreakdown.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.costRow,
                  index % 2 === 1 ? styles.costRowHighlight : {},
                  index === data.costBreakdown.length - 1 ? styles.costRowLast : {},
                ]}
              >
                <View style={styles.costLabel}>
                  <Text>{item.label}</Text>
                  {item.description && (
                    <Text style={styles.costDescription}>{item.description}</Text>
                  )}
                </View>
                <Text style={styles.costValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.costTable, { marginTop: 12 }]}>
            <View style={[styles.costRow, styles.costRowTotal, styles.costRowLast]}>
              <Text style={[styles.costLabel, styles.costLabelWhite]}>
                Total Client Cost per Month
              </Text>
              <Text style={[styles.costValue, styles.costValueWhite]}>
                {data.totalClientCost}
              </Text>
            </View>
          </View>

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Monthly Markup</Text>
              <Text style={styles.summaryValue}>{data.monthlyMarkup}</Text>
            </View>
          </View>
        </View>

        {/* Contract Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contract Details</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contract Duration</Text>
              <Text style={styles.infoValue}>{data.contractDuration}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Payment Frequency</Text>
              <Text style={styles.infoValue}>{data.paymentFrequency}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Currency</Text>
              <Text style={styles.infoValue}>{data.currency}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated by GraceMark • {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  )
}
