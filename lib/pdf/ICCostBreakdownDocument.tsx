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
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111827',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 150,
    height: 62,
    objectFit: 'contain',
  },
  header: {
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 3,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoItem: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  rateCards: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  rateCard: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1.5,
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
    fontSize: 7,
    color: '#64748b',
    marginBottom: 3,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  rateCardValue: {
    fontSize: 11,
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
    fontSize: 8,
    color: '#64748b',
  },
  formulaBox: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  formulaText: {
    fontSize: 8,
    color: '#475569',
    textAlign: 'center',
  },
  costTable: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  costRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 8,
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
    fontSize: 9,
  },
  costLabelWhite: {
    color: '#ffffff',
  },
  costDescription: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 1,
  },
  costValue: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  costValueWhite: {
    color: '#ffffff',
    fontSize: 10,
  },
  summaryBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ecfdf5',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    color: '#065f46',
    fontWeight: 'bold',
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#047857',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
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

          <View style={[styles.costTable, { marginTop: 8 }]}>
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
