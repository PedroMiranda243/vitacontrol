'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate, getExamPrice, addDays } from '@/lib/utils'
import type { ExtractedOSData, ExtractedRepasseData, RepasseExtractionResult } from '@/types'

type UploadMode = 'OS' | 'REPASSE'

export default function UploadPage() {
  const [mode, setMode] = useState<UploadMode>('OS')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // OS extraction state
  const [osData, setOsData] = useState<ExtractedOSData[]>([])
  const [osEdits, setOsEdits] = useState<Record<number, Partial<ExtractedOSData>>>({})

  // Repasse extraction state
  const [repasseData, setRepasseData] = useState<RepasseExtractionResult | null>(null)

  // Confirmation state
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ type: string; message: string; details?: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)
    setOsData([])
    setOsEdits({})
    setRepasseData(null)

    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 10MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setImagePreview(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleExtract = async () => {
    if (!imagePreview) return

    setExtracting(true)
    setError(null)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePreview, tipo: mode }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Erro ao extrair dados da imagem')
        return
      }

      if (mode === 'OS') {
        const extracted = data.data as ExtractedOSData[]
        setOsData(Array.isArray(extracted) ? extracted : [])
      } else {
        setRepasseData(data.data as RepasseExtractionResult)
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.')
      console.error(err)
    } finally {
      setExtracting(false)
    }
  }

  const getEditedOsValue = (index: number, field: keyof ExtractedOSData, original: string): string => {
    return (osEdits[index]?.[field] as string) || original
  }

  const updateOsEdit = (index: number, field: keyof ExtractedOSData, value: string) => {
    setOsEdits(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value }
    }))
  }

  const handleConfirmOS = async () => {
    setConfirming(true)
    setError(null)

    try {
      const records = osData.map((item, idx) => {
        const edited = osEdits[idx] || {}
        const exame = (edited.exame as string) || item.exame || 'AUDIOMETRIA TONAL'
        const dataLaudoStr = (edited.dataLaudo as string) || item.dataLaudo
        
        // Parse date
        let dataLaudo: Date
        if (dataLaudoStr.includes('/')) {
          const parts = dataLaudoStr.split('/')
          dataLaudo = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        } else {
          dataLaudo = new Date(dataLaudoStr)
        }

        return {
          dataLancamento: dataLaudo.toISOString(),
          os: (edited.ordemServico as string) || item.ordemServico,
          examesOs: (edited.examesOs as string) || item.examesOs,
          descricao: (edited.paciente as string) || item.paciente,
          exame: exame,
          empresa: (edited.empresa as string) || item.empresa,
          valor: getExamPrice(exame),
          dataVencimento: addDays(dataLaudo, 30).toISOString(),
        }
      })

      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, fileName: 'upload-os.jpg' }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          type: 'success',
          message: `✅ ${data.count} registro(s) salvos com sucesso!`,
        })
        setOsData([])
        setOsEdits({})
        setImagePreview(null)
      } else {
        setError(data.error || 'Erro ao salvar registros')
      }
    } catch (err) {
      setError('Erro ao salvar. Tente novamente.')
      console.error(err)
    } finally {
      setConfirming(false)
    }
  }

  const handleConfirmRepasse = async () => {
    if (!repasseData) return
    setConfirming(true)
    setError(null)

    try {
      const response = await fetch('/api/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registros: repasseData.registros,
          dataPagamento: new Date().toISOString(),
          fileName: 'upload-repasse.jpg',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const details = [
          data.atualizados.length > 0 ? `✅ ${data.atualizados.length} registro(s) atualizado(s)` : '',
          data.naoEncontrados.length > 0 ? `⚠️ ${data.naoEncontrados.length} OS não encontrada(s): ${data.naoEncontrados.join(', ')}` : '',
        ].filter(Boolean).join('\n')

        setResult({
          type: data.naoEncontrados.length > 0 ? 'partial' : 'success',
          message: `Pagamento confirmado!`,
          details,
        })
        setRepasseData(null)
        setImagePreview(null)
      } else {
        setError(data.error || 'Erro ao confirmar pagamento')
      }
    } catch (err) {
      setError('Erro ao processar. Tente novamente.')
      console.error(err)
    } finally {
      setConfirming(false)
    }
  }

  const resetAll = () => {
    setImagePreview(null)
    setOsData([])
    setOsEdits({})
    setRepasseData(null)
    setError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
          {mode === 'OS' ? '📤 Novo Lançamento' : '💳 Confirmar Pagamento'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'OS'
            ? 'Upload da tela do iQuery para lançar novas ordens de serviço'
            : 'Upload da listagem de repasse para confirmar pagamentos'}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="glass-card p-1 inline-flex rounded-xl">
        <button
          onClick={() => { setMode('OS'); resetAll() }}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'OS'
              ? 'bg-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/10'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          id="btn-mode-os"
        >
          📋 Lançar OS
        </button>
        <button
          onClick={() => { setMode('REPASSE'); resetAll() }}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'REPASSE'
              ? 'bg-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/10'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          id="btn-mode-repasse"
        >
          💳 Confirmar Pagamento
        </button>
      </div>

      {/* Upload Zone */}
      {!imagePreview && !result && (
        <div
          className="upload-zone p-8 sm:p-12 text-center"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging') }}
          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragging') }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('dragging')
            const file = e.dataTransfer.files[0]
            if (file) {
              const dt = new DataTransfer()
              dt.items.add(file)
              if (fileInputRef.current) {
                fileInputRef.current.files = dt.files
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
              }
            }
          }}
          id="upload-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="file-input"
          />
          <div className="text-5xl mb-4">
            {mode === 'OS' ? '📸' : '📄'}
          </div>
          <p className="text-slate-300 font-medium mb-2">
            {mode === 'OS'
              ? 'Tire uma foto da tela do iQuery'
              : 'Tire uma foto da listagem de repasse'}
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Arraste e solte ou clique para selecionar
          </p>
          <button className="btn btn-primary btn-sm">
            Selecionar Imagem
          </button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && !osData.length && !repasseData && !result && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-200">Prévia da Imagem</h2>
            <button onClick={resetAll} className="btn btn-ghost btn-sm">
              ✕ Remover
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700/30 mb-4">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-[400px] object-contain bg-black/20"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="btn btn-primary flex-1"
              id="btn-extract"
            >
              {extracting ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Processando com IA...
                </>
              ) : (
                <>🤖 Extrair Dados com IA</>
              )}
            </button>
          </div>
          {extracting && (
            <p className="text-center text-slate-400 text-sm mt-3 animate-pulse">
              Aguarde, a IA está analisando a imagem... Isso pode levar alguns segundos.
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="glass-card p-4 border-rose-500/30 bg-rose-500/5 animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div>
              <p className="text-rose-400 font-medium">{error}</p>
              <button onClick={resetAll} className="btn btn-ghost btn-sm mt-2 text-slate-400">
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OS Data Preview */}
      {osData.length > 0 && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="p-4 border-b border-slate-700/30">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-200">
                📋 Dados Extraídos ({osData.length} registros)
              </h2>
              <button onClick={resetAll} className="btn btn-ghost btn-sm">
                ✕ Cancelar
              </button>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Revise os dados antes de confirmar. Clique em um campo para editar.
            </p>
          </div>

          <div className="table-container" style={{ maxHeight: '60vh' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ordem Serviço</th>
                  <th>Exames OS</th>
                  <th>Paciente</th>
                  <th>Empresa</th>
                  <th>Exame</th>
                  <th>Data Laudo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {osData.map((item, idx) => {
                  const exame = getEditedOsValue(idx, 'exame', item.exame)
                  return (
                    <tr key={idx}>
                      <td className="text-slate-500 text-xs">{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={getEditedOsValue(idx, 'ordemServico', item.ordemServico)}
                          onChange={(e) => updateOsEdit(idx, 'ordemServico', e.target.value)}
                          className="input py-1 px-2 text-xs w-28"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={getEditedOsValue(idx, 'examesOs', item.examesOs)}
                          onChange={(e) => updateOsEdit(idx, 'examesOs', e.target.value)}
                          className="input py-1 px-2 text-xs w-24"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={getEditedOsValue(idx, 'paciente', item.paciente)}
                          onChange={(e) => updateOsEdit(idx, 'paciente', e.target.value)}
                          className="input py-1 px-2 text-xs w-48"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={getEditedOsValue(idx, 'empresa', item.empresa)}
                          onChange={(e) => updateOsEdit(idx, 'empresa', e.target.value)}
                          className="input py-1 px-2 text-xs w-36"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={exame}
                          onChange={(e) => updateOsEdit(idx, 'exame', e.target.value)}
                          className="input py-1 px-2 text-xs w-36"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={getEditedOsValue(idx, 'dataLaudo', item.dataLaudo)}
                          onChange={(e) => updateOsEdit(idx, 'dataLaudo', e.target.value)}
                          className="input py-1 px-2 text-xs w-28"
                        />
                      </td>
                      <td className="font-mono text-teal-400 font-semibold text-xs">
                        {formatCurrency(getExamPrice(exame))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-700/30 flex gap-3">
            <button onClick={resetAll} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleConfirmOS}
              disabled={confirming}
              className="btn btn-primary flex-1"
              id="btn-confirm-os"
            >
              {confirming ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Salvando...
                </>
              ) : (
                `✅ Confirmar ${osData.length} Registro(s)`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Repasse Data Preview */}
      {repasseData && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="p-4 border-b border-slate-700/30">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-200">
                💳 Dados do Repasse ({repasseData.registros.length} registros)
              </h2>
              <button onClick={resetAll} className="btn btn-ghost btn-sm">
                ✕ Cancelar
              </button>
            </div>
            <div className="flex gap-4 mt-2 text-sm text-slate-400">
              <span>Período: {repasseData.periodoInicio} — {repasseData.periodoFim}</span>
              <span className="font-mono text-teal-400 font-semibold">
                Total: {formatCurrency(repasseData.totalRelatorio)}
              </span>
            </div>
          </div>

          <div className="table-container" style={{ maxHeight: '60vh' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>OS</th>
                  <th>Paciente</th>
                  <th>Exame</th>
                  <th>Empresa</th>
                  <th>Data OS</th>
                  <th>Bruto</th>
                  <th>Desc.</th>
                  <th>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {repasseData.registros.map((item, idx) => (
                  <tr key={idx}>
                    <td className="text-slate-500 text-xs">{idx + 1}</td>
                    <td className="font-mono text-xs">{item.os}</td>
                    <td className="text-xs">{item.paciente}</td>
                    <td className="text-xs text-slate-400">{item.exame}</td>
                    <td className="text-xs text-slate-400">{item.empresa}</td>
                    <td className="text-xs">{item.dataOs}</td>
                    <td className="font-mono text-xs">{formatCurrency(item.valorBruto)}</td>
                    <td className="font-mono text-xs text-rose-400">{formatCurrency(item.desconto)}</td>
                    <td className="font-mono text-xs font-semibold text-teal-400">
                      {formatCurrency(item.valorLiquido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-700/30 flex gap-3">
            <button onClick={resetAll} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleConfirmRepasse}
              disabled={confirming}
              className="btn btn-primary flex-1"
              id="btn-confirm-repasse"
            >
              {confirming ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Processando...
                </>
              ) : (
                `💳 Confirmar Pagamento`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Message */}
      {result && (
        <div className={`glass-card p-6 animate-slide-up ${
          result.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-100 mb-2">{result.message}</p>
            {result.details && (
              <div className="text-sm text-slate-400 mb-4 whitespace-pre-line">
                {result.details}
              </div>
            )}
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={resetAll} className="btn btn-secondary">
                Novo Upload
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary"
              >
                Ver Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
