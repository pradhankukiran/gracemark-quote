import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface AcidTestPdfItem {
  label: string
  local: string
  usd?: string
}

export interface AcidTestPdfCategory {
  title: string
  localTotal: string
  usdTotal?: string
  items: AcidTestPdfItem[]
}

export interface AcidTestPdfMonthlyCard {
  title: string
  localValue: string
  usdValue?: string
  duration: string
  description?: string
}

export interface AcidTestPdfData {
  currency: string
  showUSD: boolean
  categories: AcidTestPdfCategory[]
  logoSrc: string
  monthlyCard: AcidTestPdfMonthlyCard
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logo: {
    width: 200,
    height: 82,
    objectFit: 'contain',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerCell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerLabel: {
    flex: 2,
  },
  headerAmount: {
    flex: 1,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryRow: {
    backgroundColor: '#f9fafb',
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  labelCell: {
    flex: 2,
    color: '#111827',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  itemLabel: {
    marginLeft: 12,
    color: '#4b5563',
  },
  amountCell: {
    flex: 1,
    textAlign: 'right',
    color: '#111827',
  },
  amountBold: {
    fontWeight: 'bold',
  },
  secondPage: {
    padding: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthlyCard: {
    width: '75%',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    textAlign: 'center',
  },
  monthlyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  monthlyLocal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  monthlyUSD: {
    fontSize: 14,
    color: '#1e293b',
    marginTop: 6,
  },
  monthlyDuration: {
    fontSize: 12,
    color: '#475569',
    marginTop: 12,
  },
  monthlyDescription: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 8,
  },
})

export const AcidTestCostBreakdownDocument: React.FC<{ data: AcidTestPdfData }> = ({ data }) => {
  const { showUSD } = data

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.logoContainer}>
          <Image src={data.logoSrc} style={styles.logo} />
        </View>
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.headerLabel]}>Category / Item</Text>
            <Text style={[styles.headerCell, styles.headerAmount]}>Amount ({data.currency})</Text>
            {showUSD && (
              <Text style={[styles.headerCell, styles.headerAmount]}>Amount (USD)</Text>
            )}
          </View>

          {data.categories.map(category => (
            <React.Fragment key={category.title}>
              <View style={[styles.tableRow, styles.categoryRow]}>
                <Text style={[styles.cell, styles.labelCell, styles.categoryLabel]}>{category.title}</Text>
                <Text style={[styles.cell, styles.amountCell, styles.amountBold]}>{category.localTotal}</Text>
                {showUSD && (
                  <Text style={[styles.cell, styles.amountCell, styles.amountBold]}>
                    {category.usdTotal ?? '—'}
                  </Text>
                )}
              </View>
              {category.items.map((item, index) => (
                <View style={styles.tableRow} key={`${category.title}-${index}`}>
                  <Text style={[styles.cell, styles.labelCell, styles.itemLabel]}>{item.label}</Text>
                  <Text style={[styles.cell, styles.amountCell]}>{item.local}</Text>
                  {showUSD && (
                    <Text style={[styles.cell, styles.amountCell]}>
                      {item.usd ?? '—'}
                    </Text>
                  )}
                </View>
              ))}
            </React.Fragment>
          ))}
        </View>
      </Page>
      <Page size="A4" style={styles.secondPage}>
        <View style={styles.monthlyCard}>
          <Text style={styles.monthlyTitle}>{data.monthlyCard.title}</Text>
          <Text style={styles.monthlyLocal}>{data.monthlyCard.localValue}</Text>
          {data.monthlyCard.usdValue ? (
            <Text style={styles.monthlyUSD}>USD: {data.monthlyCard.usdValue}</Text>
          ) : null}
          <Text style={styles.monthlyDuration}>{data.monthlyCard.duration}</Text>
          {data.monthlyCard.description ? (
            <Text style={styles.monthlyDescription}>{data.monthlyCard.description}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
