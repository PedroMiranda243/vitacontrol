import { Status } from '@/types'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateISO(date: string | Date): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

export function parseBRDate(dateStr: string): Date {
  // Parse DD/MM/YYYY format
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  // Try ISO format
  return new Date(dateStr)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function calcDiasParaVencer(dataVencimento: string | Date): number {
  const vencimento = new Date(dataVencimento)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  vencimento.setHours(0, 0, 0, 0)
  const diff = vencimento.getTime() - hoje.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function calcStatus(pago: boolean, dataVencimento: string | Date, dataPagamento?: string | Date | null): Status {
  if (pago) {
    if (dataPagamento) {
      const venc = new Date(dataVencimento)
      const pgto = new Date(dataPagamento)
      venc.setHours(0, 0, 0, 0)
      pgto.setHours(0, 0, 0, 0)
      return pgto <= venc ? 'OK' : 'PAGO'
    }
    return 'PAGO'
  }
  const dias = calcDiasParaVencer(dataVencimento)
  return dias < 0 ? 'VENCIDO' : 'EM_ABERTO'
}

export function getExamPrice(examName: string): number {
  const name = examName.toUpperCase().trim()
  
  if (name.includes('AUDIOMETRIA TONAL E VOCAL') || name.includes('TONAL/VOCAL')) {
    return 50.0
  }
  if (name.includes('AUDIOMETRIA TONAL')) {
    return 35.0
  }
  if (name.includes('AUDIOMETRIA')) {
    return 35.0
  }
  
  // Default price for unknown exams
  return 35.0
}

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'EM_ABERTO':
      return 'amber'
    case 'PAGO':
    case 'OK':
      return 'emerald'
    case 'VENCIDO':
      return 'rose'
    default:
      return 'slate'
  }
}

export function getStatusLabel(status: Status): string {
  switch (status) {
    case 'EM_ABERTO':
      return 'Em Aberto'
    case 'PAGO':
      return 'Pago'
    case 'VENCIDO':
      return 'Vencido'
    case 'OK':
      return 'OK'
    default:
      return status
  }
}

export function getStatusEmoji(status: Status): string {
  switch (status) {
    case 'EM_ABERTO':
      return '🟡'
    case 'PAGO':
    case 'OK':
      return '🟢'
    case 'VENCIDO':
      return '🔴'
    default:
      return '⚪'
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
