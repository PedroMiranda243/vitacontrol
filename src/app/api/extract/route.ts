import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { extractOSData, extractRepasseData } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { image, tipo } = body

    if (!image || !tipo) {
      return NextResponse.json(
        { error: 'Imagem e tipo são obrigatórios' },
        { status: 400 }
      )
    }

    if (tipo !== 'OS' && tipo !== 'REPASSE') {
      return NextResponse.json(
        { error: 'Tipo deve ser "OS" ou "REPASSE"' },
        { status: 400 }
      )
    }

    let data

    if (tipo === 'OS') {
      data = await extractOSData(image)
    } else {
      data = await extractRepasseData(image)
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Extraction error:', error)
    const message = error instanceof Error ? error.message : 'Erro ao processar imagem'
    return NextResponse.json(
      { 
        success: false, 
        error: message,
      },
      { status: 500 }
    )
  }
}
