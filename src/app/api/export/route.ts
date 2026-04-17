import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/db'
import { generateXlsxBuffer } from '@/lib/xlsx'
import { calcDiasParaVencer, calcStatus, getStatusLabel } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const filter = searchParams.get('filter') || 'all'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (filter === 'unpaid') {
      where.pago = false
    } else if (filter === 'overdue') {
      where.pago = false
      where.dataVencimento = { lt: new Date() }
    }

    const records = await prisma.record.findMany({
      where,
      orderBy: { dataLancamento: 'desc' },
    })

    const recordData = records.map((r) => ({
      id: r.id,
      dataLancamento: r.dataLancamento.toISOString(),
      os: r.os,
      examesOs: r.examesOs || undefined,
      descricao: r.descricao,
      exame: r.exame || undefined,
      empresa: r.empresa || undefined,
      valor: r.valor,
      dataVencimento: r.dataVencimento.toISOString(),
      pago: r.pago,
      dataPagamento: r.dataPagamento?.toISOString(),
      status: calcStatus(r.pago, r.dataVencimento, r.dataPagamento) as 'EM_ABERTO' | 'PAGO' | 'VENCIDO' | 'OK',
      diasParaVencer: r.pago ? undefined : calcDiasParaVencer(r.dataVencimento),
    }))

    const buffer = generateXlsxBuffer(recordData)

    const filterLabel = filter === 'unpaid' ? 'nao-pagos' : filter === 'overdue' ? 'vencidos' : 'completo'
    const fileName = `vitacontrol-${filterLabel}-${new Date().toISOString().split('T')[0]}.xlsx`

    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    console.error('Error exporting records:', error)
    return NextResponse.json(
      { error: 'Erro ao exportar registros' },
      { status: 500 }
    )
  }
}
