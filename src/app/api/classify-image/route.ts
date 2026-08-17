import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { classifyImageType } from '@/lib/gemini'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: 'Imagem é obrigatória' },
        { status: 400 }
      )
    }

    const type = await classifyImageType(image)

    return NextResponse.json({
      success: true,
      type
    })

  } catch (error) {
    console.error('Classify image error:', error)
    const message = error instanceof Error ? error.message : 'Erro ao classificar imagem'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
