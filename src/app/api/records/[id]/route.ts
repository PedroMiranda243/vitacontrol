import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/db'
import { calcStatus } from '@/lib/utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    
    const updateData: Record<string, unknown> = {}
    
    if (body.dataLancamento !== undefined) updateData.dataLancamento = new Date(body.dataLancamento)
    if (body.os !== undefined) updateData.os = body.os
    if (body.examesOs !== undefined) updateData.examesOs = body.examesOs
    if (body.descricao !== undefined) updateData.descricao = body.descricao
    if (body.exame !== undefined) updateData.exame = body.exame
    if (body.empresa !== undefined) updateData.empresa = body.empresa
    if (body.valor !== undefined) updateData.valor = parseFloat(body.valor)
    if (body.dataVencimento !== undefined) updateData.dataVencimento = new Date(body.dataVencimento)
    if (body.pago !== undefined) updateData.pago = body.pago
    if (body.dataPagamento !== undefined) updateData.dataPagamento = body.dataPagamento ? new Date(body.dataPagamento) : null

    // Recalculate status
    const existing = await prisma.record.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    const pago = updateData.pago !== undefined ? updateData.pago as boolean : existing.pago
    const dataVencimento = updateData.dataVencimento !== undefined 
      ? updateData.dataVencimento as Date 
      : existing.dataVencimento
    const dataPagamento = updateData.dataPagamento !== undefined 
      ? updateData.dataPagamento as Date | null
      : existing.dataPagamento

    updateData.status = calcStatus(pago, dataVencimento, dataPagamento)

    const updated = await prisma.record.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, record: updated })
  } catch (error) {
    console.error('Error updating record:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar registro' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    
    await prisma.record.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting record:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir registro' },
      { status: 500 }
    )
  }
}
