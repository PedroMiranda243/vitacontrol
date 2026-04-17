import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/db'

export async function GET() {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const logs = await prisma.uploadLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching upload logs:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar histórico' },
      { status: 500 }
    )
  }
}
