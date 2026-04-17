import * as XLSX from 'xlsx'
import { RecordData } from '@/types'
import { formatCurrency, formatDate, calcDiasParaVencer, getStatusLabel } from '@/lib/utils'

export function exportRecordsToXlsx(records: RecordData[], fileName: string = 'vitacontrol-export'): void {
  const data = records.map((record) => ({
    'DATA LANÇAMENTO': formatDate(record.dataLancamento),
    'OS / EXAMES OS': record.examesOs ? `${record.os} / ${record.examesOs}` : record.os,
    'DESCRIÇÃO': record.descricao,
    'EXAME': record.exame || '',
    'EMPRESA': record.empresa || '',
    'VALOR': formatCurrency(record.valor),
    'DATA DE VENCIMENTO': formatDate(record.dataVencimento),
    'PAGO': record.pago ? 'SIM' : 'NÃO',
    'DATA DO PAGAMENTO': record.dataPagamento ? formatDate(record.dataPagamento) : '',
    'DIAS PARA VENCER': record.pago ? 'OK' : calcDiasParaVencer(record.dataVencimento).toString(),
    'STATUS': getStatusLabel(record.status),
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 18 }, // DATA LANÇAMENTO
    { wch: 20 }, // OS / EXAMES OS
    { wch: 40 }, // DESCRIÇÃO
    { wch: 25 }, // EXAME
    { wch: 30 }, // EMPRESA
    { wch: 12 }, // VALOR
    { wch: 20 }, // DATA DE VENCIMENTO
    { wch: 8 },  // PAGO
    { wch: 20 }, // DATA DO PAGAMENTO
    { wch: 18 }, // DIAS PARA VENCER
    { wch: 12 }, // STATUS
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'VitaControl')

  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

export function generateXlsxBuffer(records: RecordData[]): Uint8Array {
  const data = records.map((record) => ({
    'DATA LANÇAMENTO': formatDate(record.dataLancamento),
    'OS / EXAMES OS': record.examesOs ? `${record.os} / ${record.examesOs}` : record.os,
    'DESCRIÇÃO': record.descricao,
    'EXAME': record.exame || '',
    'EMPRESA': record.empresa || '',
    'VALOR': record.valor,
    'DATA DE VENCIMENTO': formatDate(record.dataVencimento),
    'PAGO': record.pago ? 'SIM' : 'NÃO',
    'DATA DO PAGAMENTO': record.dataPagamento ? formatDate(record.dataPagamento) : '',
    'DIAS PARA VENCER': record.pago ? 'OK' : calcDiasParaVencer(record.dataVencimento).toString(),
    'STATUS': getStatusLabel(record.status),
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  
  worksheet['!cols'] = [
    { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 25 },
    { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 8 },
    { wch: 20 }, { wch: 18 }, { wch: 12 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'VitaControl')

  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new Uint8Array(arrayBuffer)
}
