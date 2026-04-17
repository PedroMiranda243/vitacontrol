import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/db'
import { calcStatus } from '@/lib/utils'
import { Status } from '@/types'

export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const empresa = searchParams.get('empresa')
  const mesAno = searchParams.get('mesAno')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (empresa) {
    where.empresa = { contains: empresa, mode: 'insensitive' }
  }

  if (mesAno) {
    const [year, month] = mesAno.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)
    where.dataLancamento = {
      gte: startDate,
      lte: endDate,
    }
  }

  try {
    const [records, total] = await Promise.all([
      prisma.record.findMany({
        where,
        orderBy: { dataLancamento: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.record.count({ where }),
    ])

    // Recalculate status for non-paid records (dynamic)
    const updatedRecords = records.map((record) => {
      if (!record.pago) {
        const currentStatus = calcStatus(record.pago, record.dataVencimento)
        if (currentStatus !== record.status) {
          // Update in database asynchronously
          prisma.record.update({
            where: { id: record.id },
            data: { status: currentStatus },
          }).catch(console.error)
        }
        return { ...record, status: currentStatus }
      }
      return record
    })

    // Get summary data
    const allRecords = await prisma.record.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: { status: true, valor: true, pago: true, dataVencimento: true },
    })

    const summary = {
      emAberto: { quantidade: 0, valorTotal: 0 },
      pago: { quantidade: 0, valorTotal: 0 },
      vencido: { quantidade: 0, valorTotal: 0 },
    }

    allRecords.forEach((r) => {
      const s = r.pago 
        ? 'PAGO' 
        : calcStatus(r.pago, r.dataVencimento) as Status

      if (s === 'PAGO' || s === 'OK') {
        summary.pago.quantidade++
        summary.pago.valorTotal += r.valor
      } else if (s === 'VENCIDO') {
        summary.vencido.quantidade++
        summary.vencido.valorTotal += r.valor
      } else {
        summary.emAberto.quantidade++
        summary.emAberto.valorTotal += r.valor
      }
    })

    // Get unique empresas for filter dropdown
    const empresas = await prisma.record.findMany({
      distinct: ['empresa'],
      select: { empresa: true },
      where: { empresa: { not: null } },
    })

    return NextResponse.json({
      records: updatedRecords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary,
      empresas: empresas.map(e => e.empresa).filter(Boolean),
    })
  } catch (error) {
    console.error('Error fetching records:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar registros' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { records, fileName } = body

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Registros são obrigatórios' },
        { status: 400 }
      )
    }

    const createdRecords = await prisma.$transaction(
      records.map((record: {
        dataLancamento: string
        os: string
        examesOs?: string
        descricao: string
        exame?: string
        empresa?: string
        valor: number
        dataVencimento: string
      }) =>
        prisma.record.create({
          data: {
            dataLancamento: new Date(record.dataLancamento),
            os: record.os,
            examesOs: record.examesOs || null,
            descricao: record.descricao,
            exame: record.exame || null,
            empresa: record.empresa || null,
            valor: record.valor,
            dataVencimento: new Date(record.dataVencimento),
            pago: false,
            status: 'EM_ABERTO',
          },
        })
      )
    )

    // Log the upload
    await prisma.uploadLog.create({
      data: {
        tipo: 'OS',
        fileName: fileName || 'upload-os.jpg',
        recordCount: createdRecords.length,
        details: `${createdRecords.length} registros criados`,
      },
    })

    return NextResponse.json({
      success: true,
      count: createdRecords.length,
      records: createdRecords,
    })
  } catch (error) {
    console.error('Error creating records:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar registros' },
      { status: 500 }
    )
  }
}
