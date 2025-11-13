import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { saveAs } from 'file-saver'
import { ICCostBreakdownDocument, ICPdfData } from './ICCostBreakdownDocument'

export async function exportICCostBreakdownPdf(data: ICPdfData, filename: string) {
  const instance = pdf(<ICCostBreakdownDocument data={data} />)
  const blob = await instance.toBlob()
  saveAs(blob, filename)
}
