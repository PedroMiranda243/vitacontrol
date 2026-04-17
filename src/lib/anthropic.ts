import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function getMediaType(base64: string): ImageMediaType {
  if (base64.startsWith('data:image/png')) return 'image/png'
  if (base64.startsWith('data:image/gif')) return 'image/gif'
  if (base64.startsWith('data:image/webp')) return 'image/webp'
  return 'image/jpeg'
}

function stripDataPrefix(base64: string): string {
  const commaIndex = base64.indexOf(',')
  if (commaIndex !== -1) {
    return base64.slice(commaIndex + 1)
  }
  return base64
}

export async function extractOSData(base64Image: string): Promise<string> {
  const mediaType = getMediaType(base64Image)
  const imageData = stripDataPrefix(base64Image)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData,
            },
          },
          {
            type: 'text',
            text: `Analise esta imagem de uma listagem de Ordens de Serviço do sistema iQuery (sistema médico).
Extraia TODOS os registros visíveis na tabela.

Para cada registro, extraia os seguintes campos:
- id: número do Id (coluna Id)
- ordemServico: número da Ordem Serviço
- examesOs: número do Exames OS
- paciente: nome completo do Paciente
- empresa: nome da Empresa
- executante: nome do Executante (se visível)
- exame: tipo do Exame (ex: AUDIOMETRIA TONAL, AUDIOMETRIA TONAL E VOCAL, etc)
- dataLaudo: Data do Laudo no formato DD/MM/YYYY
- status: Status (Liberado, Pendente, etc)

IMPORTANTE:
- Extraia TODOS os registros visíveis, não apenas os primeiros
- Se um campo não estiver legível, use "ILEGÍVEL" como valor
- Retorne SOMENTE um JSON array válido, sem texto adicional
- Formato: [{"id": "...", "ordemServico": "...", "examesOs": "...", "paciente": "...", "empresa": "...", "executante": "...", "exame": "...", "dataLaudo": "...", "status": "..."}]`,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find(block => block.type === 'text')
  return textContent ? textContent.text : ''
}

export async function extractRepasseData(base64Image: string): Promise<string> {
  const mediaType = getMediaType(base64Image)
  const imageData = stripDataPrefix(base64Image)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData,
            },
          },
          {
            type: 'text',
            text: `Analise esta imagem de uma Listagem de Repasses de um laboratório/clínica médica.
Este é um documento que lista pagamentos de repasses para profissionais de saúde.

Extraia TODOS os registros de repasse visíveis no documento.

Para cada registro, extraia:
- os: número da OS (Ordem de Serviço)
- paciente: nome completo do Paciente
- exame: tipo do Exame/Procedimento
- valorBruto: valor Bruto (número decimal, ex: 35.00)
- desconto: valor do Desconto (número decimal, ex: 0.00)
- valorLiquido: valor Líquido (número decimal, ex: 35.00)
- dataOs: Data da OS no formato DD/MM/YYYY
- empresa: nome do Convênio/Empresa (aparece como cabeçalho de seção, ex: "RHMED CONSULTORES - PAULO AFONSO")

Também extraia os totais:
- totalRelatorio: Total do Relatório (valor líquido total)
- periodoInicio: data início do período no formato DD/MM/YYYY
- periodoFim: data fim do período no formato DD/MM/YYYY

IMPORTANTE:
- Extraia TODOS os registros, incluindo de diferentes convênios/empresas
- O nome do convênio/empresa aparece como cabeçalho de seção, aplique-o a todos os registros abaixo dele
- Valores monetários devem ser números decimais (sem R$)
- Retorne SOMENTE um JSON válido, sem texto adicional
- Formato: {"registros": [{"os": "...", "paciente": "...", "exame": "...", "valorBruto": 0, "desconto": 0, "valorLiquido": 0, "dataOs": "...", "empresa": "..."}], "totalRelatorio": 0, "periodoInicio": "...", "periodoFim": "..."}`,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find(block => block.type === 'text')
  return textContent ? textContent.text : ''
}

export function parseExtractedJSON(rawText: string): unknown {
  // Try to extract JSON from the response
  let text = rawText.trim()
  
  // Remove possible markdown code block markers
  if (text.startsWith('```json')) {
    text = text.slice(7)
  } else if (text.startsWith('```')) {
    text = text.slice(3)
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3)
  }
  text = text.trim()
  
  try {
    return JSON.parse(text)
  } catch {
    // Try to find JSON in the text
    const jsonStart = text.indexOf('[')
    const jsonObjStart = text.indexOf('{')
    const start = jsonStart !== -1 && (jsonObjStart === -1 || jsonStart < jsonObjStart) 
      ? jsonStart 
      : jsonObjStart
    
    if (start !== -1) {
      const isArray = text[start] === '['
      const end = isArray 
        ? text.lastIndexOf(']') + 1 
        : text.lastIndexOf('}') + 1
      
      if (end > start) {
        return JSON.parse(text.slice(start, end))
      }
    }
    
    throw new Error('Não foi possível extrair dados JSON da resposta da IA')
  }
}
