import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/db'
import { calcStatus } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { registros, dataPagamento, fileName } = body

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return NextResponse.json(
        { error: 'Registros de repasse são obrigatórios' },
        { status: 400 }
      )
    }

    const paymentDate = dataPagamento ? new Date(dataPagamento) : new Date()
    const atualizados: Array<{
      id: string
      os: string
      descricao: string
      dataPagamento: string
    }> = []
    const naoEncontrados: string[] = []

    for (const repasse of registros) {
      const osNumber = repasse.os?.toString().trim()
      
      if (!osNumber) {
        naoEncontrados.push('OS não identificado')
        continue
      }

      // Find matching records by OS number
      const matchingRecords = await prisma.record.findMany({
        where: {
          os: { contains: osNumber },
          pago: false,
        },
      })

      if (matchingRecords.length === 0) {
        naoEncontrados.push(osNumber)
        continue
      }

      for (const record of matchingRecords) {
        const newStatus = calcStatus(true, record.dataVencimento, paymentDate)

        await prisma.record.update({
          where: { id: record.id },
          data: {
            pago: true,
            dataPagamento: paymentDate,
            status: newStatus,
          },
        })

        atualizados.push({
          id: record.id,
          os: record.os,
          descricao: record.descricao,
          dataPagamento: paymentDate.toISOString(),
        })
      }
    }

    // Log the upload
    await prisma.uploadLog.create({
      data: {
        tipo: 'REPASSE',
        fileName: fileName || 'upload-repasse.jpg',
        recordCount: atualizados.length,
        details: `${atualizados.length} atualizados, ${naoEncontrados.length} não encontrados`,
      },
    })

    return NextResponse.json({
      success: true,
      atualizados,
      naoEncontrados,
    })
  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: 'Erro ao confirmar pagamentos' },
      { status: 500 }
    )
  }
}
