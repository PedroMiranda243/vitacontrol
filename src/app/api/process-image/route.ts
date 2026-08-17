import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/db'
import { extractOSData, extractRepasseData, classifyImageType } from '@/lib/gemini'
import { getExamPrice, addDays, calcStatus } from '@/lib/utils'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { image, fileName, tipo } = body

    if (!image || !fileName) {
      return NextResponse.json(
        { error: 'Imagem e fileName são obrigatórios' },
        { status: 400 }
      )
    }

    let resolvedType = tipo
    if (!resolvedType) {
      resolvedType = await classifyImageType(image)
    }

    if (resolvedType === 'UNKNOWN') {
      return NextResponse.json({ success: false, type: 'UNKNOWN', error: 'Tipo não reconhecido' })
    }

    if (resolvedType === 'OS') {
      const extractedData = await extractOSData(image)
      
      const recordsToProcess = extractedData.map(item => {
        const exame = item.exame || 'AUDIOMETRIA TONAL'
        let dataLaudo: Date
        if (item.dataLaudo.includes('/')) {
          const parts = item.dataLaudo.split('/')
          dataLaudo = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        } else {
          dataLaudo = new Date(item.dataLaudo)
        }
        return {
          dataLancamento: dataLaudo.toISOString(),
          os: item.ordemServico,
          examesOs: item.examesOs,
          descricao: item.paciente,
          exame: exame,
          empresa: item.empresa,
          valor: getExamPrice(exame),
          dataVencimento: addDays(dataLaudo, 30).toISOString(),
        }
      })

      const incomingOsList = recordsToProcess.map(r => r.os)
      const existingRecords = await prisma.record.findMany({
        where: { os: { in: incomingOsList } },
        select: { os: true, exame: true }
      })
      
      const existingSet = new Set(existingRecords.map(r => `${r.os}-${r.exame || ''}`))
      
      const newRecords = recordsToProcess.filter(r => {
        const key = `${r.os}-${r.exame || ''}`
        if (existingSet.has(key)) return false
        existingSet.add(key)
        return true
      })

      if (newRecords.length > 0) {
        await prisma.$transaction([
          prisma.record.createMany({
            data: newRecords
          }),
          prisma.uploadLog.create({
            data: {
              tipo: 'OS',
              fileName: fileName,
              recordCount: newRecords.length,
              details: `Processado com sucesso via process-image. Ignorados ${recordsToProcess.length - newRecords.length} duplicados.`
            }
          })
        ])
      } else {
        await prisma.uploadLog.create({
          data: {
            tipo: 'OS',
            fileName: fileName,
            recordCount: 0,
            details: `Todos os ${recordsToProcess.length} registros extraídos já existiam e foram ignorados.`
          }
        })
      }

      return NextResponse.json({
        success: true,
        type: 'OS',
        recordsCreated: newRecords.length,
        duplicatesSkipped: recordsToProcess.length - newRecords.length
      })
      
    } else if (resolvedType === 'REPASSE') {
      const extractedData = await extractRepasseData(image)
      const paymentDate = new Date()

      const naoEncontrados: string[] = []
      let recordsUpdated = 0

      for (const repasse of extractedData.registros) {
        const osNumber = repasse.os?.toString().trim()
        if (!osNumber) { 
          naoEncontrados.push('OS não identificada na imagem')
          continue 
        }

        const matchingRecords = await prisma.record.findMany({
          where: { os: { contains: osNumber }, pago: false }
        })

        if (matchingRecords.length === 0) { 
          naoEncontrados.push(osNumber)
          continue 
        }

        for (const record of matchingRecords) {
          const newStatus = calcStatus(true, record.dataVencimento, paymentDate) as any
          await prisma.record.update({
            where: { id: record.id },
            data: { pago: true, dataPagamento: paymentDate, status: newStatus }
          })
          recordsUpdated++
        }
      }

      await prisma.uploadLog.create({
        data: {
          tipo: 'REPASSE',
          fileName: fileName,
          recordCount: recordsUpdated,
          details: `Processado repasse. Atualizados: ${recordsUpdated}. Não encontrados: ${naoEncontrados.length > 0 ? naoEncontrados.join(', ') : '0'}`
        }
      })

      return NextResponse.json({
        success: true,
        type: 'REPASSE',
        recordsUpdated,
        notFound: naoEncontrados.length
      })
    }
    
    // Should never reach here but just in case
    return NextResponse.json({ success: false, error: 'Tipo inválido' }, { status: 400 })

  } catch (error) {
    console.error('Process image error:', error)
    const message = error instanceof Error ? error.message : 'Erro ao processar imagem'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
