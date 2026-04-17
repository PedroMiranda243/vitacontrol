export type Role = 'ADMIN' | 'VIEWER'

export type Status = 'EM_ABERTO' | 'PAGO' | 'VENCIDO' | 'OK'

export interface RecordData {
  id?: string
  dataLancamento: string
  os: string
  examesOs?: string
  descricao: string
  exame?: string
  empresa?: string
  valor: number
  dataVencimento: string
  pago: boolean
  dataPagamento?: string
  status: Status
  diasParaVencer?: number
}

export interface ExtractedOSData {
  id?: string
  ordemServico: string
  examesOs: string
  paciente: string
  empresa: string
  executante?: string
  exame: string
  dataLaudo: string
  status?: string
}

export interface ExtractedRepasseData {
  os: string
  paciente: string
  exame: string
  valorBruto: number
  desconto: number
  valorLiquido: number
  dataOs: string
  empresa: string
}

export interface RepasseExtractionResult {
  registros: ExtractedRepasseData[]
  totalRelatorio: number
  periodoInicio: string
  periodoFim: string
}

export interface ExtractionResponse {
  success: boolean
  data?: ExtractedOSData[] | RepasseExtractionResult
  error?: string
  rawResponse?: string
}

export interface ConfirmPaymentResult {
  atualizados: Array<{
    id: string
    os: string
    descricao: string
    dataPagamento: string
  }>
  naoEncontrados: string[]
}

export interface DashboardSummary {
  emAberto: { quantidade: number; valorTotal: number }
  pago: { quantidade: number; valorTotal: number }
  vencido: { quantidade: number; valorTotal: number }
}

export interface FilterParams {
  status?: Status | 'ALL'
  empresa?: string
  mesAno?: string
  page?: number
  limit?: number
}

export interface UploadLogData {
  id: string
  tipo: string
  fileName: string
  recordCount: number
  details?: string
  createdAt: string
}
