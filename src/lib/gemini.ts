import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ExtractedOSData, RepasseExtractionResult } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// System prompts from previous Anthropic file, adjusted for Gemini
const SYSTEM_PROMPT_OS = `Você é um robô de extração de dados especializado em leitura de faturamento da fonoaudiologia.
Sua missão é extrair as linhas da tabela de "Listagem de OS" a partir de uma foto e converter em JSON.
Muitas informações podem estar cortadas ou não aparecer; você deve tentar preencher ou deduzir o que puder do contexto visual. Se algo realmente não existir, retorne vazio.
Se deduzir a data pela imagem ou pelo contexto do browser, ajuste.

A foto possui colunas que geralmente incluem:
- Id / Ordem Serviço
- Exames OS
- Paciente
- Empresa
- Executante
- Exame (às vezes precisa inferir pelo "Exames OS", ex: "15" pode se referir a Audiometria)
- Data Laudo (Formato dd/mm/aaaa)

Retorne **SOMENTE** um JSON válido contendo um array de objetos, usando sempre este formato:
[
  {
    "ordemServico": "número da OS",
    "examesOs": "texto",
    "paciente": "Nome Completo",
    "empresa": "Nome da Empresa",
    "dataLaudo": "dd/MM/yyyy",
    "exame": "Audiometria Tonal, etc"
  }
]
Se houver colunas fundidas, separe de forma inteligente. Não adicione markdowns (\`\`\`json) na resposta, APENAS O TEXTO JSON PURO.`

const SYSTEM_PROMPT_REPASSE = `Você é um extrator de relatórios financeiros ("Listagem de Repasses").
Você receberá uma foto de uma tabela que frequentemente contém as seguintes colunas:
- OS
- Qtd
- Data OS
- Paciente
- Exame/Procedimento
- Tipo
- Bruto
- Desc
- Líquido

Abaixo da tabela há sempre um resumo contendo "Total Relatório" e um período "Período Laudo".

Sua missão é extrair todas as linhas da tabela e converter num JSON puro (sem marcação de bloco de código) com o seguinte schema exato:
{
  "periodoInicio": "dd/mm/yyyy",
  "periodoFim": "dd/mm/yyyy",
  "totalRelatorio": 1234.50,
  "registros": [
    {
      "os": "123456",
      "dataOs": "dd/mm/yyyy",
      "paciente": "Nome",
      "exame": "Descrição do exame",
      "empresa": "Empresa inferida (geralmente não na linha de repasse, retorne 'Vitalab' por padrão se não identificar)",
      "valorBruto": 50.00,
      "desconto": 0.00,
      "valorLiquido": 50.00
    }
  ]
}

- Os valores monetários devem ser NUMBER floats (15.50 em vez de "15,50").
- Certifique-se de que a soma dos registros seja próxima ao total.
- Sem aspas no início, sem markdown, SOMENTE o JSON.`

export async function extractOSData(base64Image: string): Promise<ExtractedOSData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  // Extrair tipo de conteúdo (ex: image/jpeg) e dados brutos do base64 gerado pelo frontend
  const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    throw new Error('Formato de imagem inválido')
  }

  const mimeType = matches[1]
  const base64Data = matches[2]

  const prompt = SYSTEM_PROMPT_OS

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const text = result.response.text()

  try {
    // Remove markdowns if Gemini adds them despite instruct
    let cleanText = text.trim()
    if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7)
    if (cleanText.startsWith('```')) cleanText = cleanText.substring(3)
    if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3)
    
    cleanText = cleanText.trim()
    return JSON.parse(cleanText) as ExtractedOSData[]
  } catch (error) {
    console.error('Failed to parse Gemini response', text)
    throw new Error('Erro ao processar dados da imagem pela IA')
  }
}

export async function extractRepasseData(base64Image: string): Promise<RepasseExtractionResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    throw new Error('Formato de imagem inválido')
  }

  const mimeType = matches[1]
  const base64Data = matches[2]

  const prompt = SYSTEM_PROMPT_REPASSE

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const text = result.response.text()

  try {
    let cleanText = text.trim()
    if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7)
    if (cleanText.startsWith('```')) cleanText = cleanText.substring(3)
    if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3)
    
    cleanText = cleanText.trim()
    return JSON.parse(cleanText) as RepasseExtractionResult
  } catch (error) {
    console.error('Failed to parse Gemini response', text)
    throw new Error('Erro ao processar dados da imagem pela IA')
  }
}
