import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { saveAs } from 'file-saver'
import { AcidTestCostBreakdownDocument, AcidTestPdfData } from './AcidTestCostBreakdownDocument'

export async function exportAcidTestCostBreakdownPdf(data: AcidTestPdfData, filename: string) {
  const instance = pdf(<AcidTestCostBreakdownDocument data={data} />)
  const blob = await instance.toBlob()
  saveAs(blob, filename)
}
