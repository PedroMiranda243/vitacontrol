'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate, getExamPrice, addDays } from '@/lib/utils'
import type { ExtractedOSData, ExtractedRepasseData, RepasseExtractionResult } from '@/types'

type UploadMode = 'OS' | 'REPASSE' | 'LOTE'

interface BatchImage {
  id: string
  file: File
  preview: string
  status: 'queued' | 'classifying' | 'processing' | 'success' | 'duplicate' | 'error' | 'unknown_type'
  type?: 'OS' | 'REPASSE' | 'UNKNOWN'
  recordsCreated?: number
  recordsUpdated?: number
  duplicatesSkipped?: number
  notFound?: number
  error?: string
}

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

  // Batch processing state
  const [batchImages, setBatchImages] = useState<BatchImage[]>([])
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchPaused, setBatchPaused] = useState(false)
  const [batchComplete, setBatchComplete] = useState(false)
  const batchPausedRef = useRef(false)
  const batchRunIdRef = useRef(0)
  const [activeClassifyIndex, setActiveClassifyIndex] = useState(-1)

  // Confirmation state
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ type: string; message: string; details?: string } | null>(null)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleBatchFileSelect = (files: File[]) => {
    setError(null)
    setResult(null)

    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024)
    if (validFiles.length < files.length) {
      setError('Alguns arquivos são muito grandes e foram ignorados. Máximo: 10MB por arquivo.')
    }

    if (validFiles.length === 0) return

    Promise.all(validFiles.map(file => {
      return new Promise<BatchImage>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve({
            id: crypto.randomUUID(),
            file,
            preview: e.target?.result as string,
            status: 'queued'
          })
        }
        reader.readAsDataURL(file)
      })
    })).then(images => {
      setBatchImages(prev => {
        const newBatch = [...prev, ...images]
        if (prev.length === 0) setActiveClassifyIndex(0)
        return newBatch
      })
    })
  }

  const processBatch = async (imagesToProcess?: BatchImage[]) => {
    setBatchProcessing(true)
    setBatchPaused(false)
    batchPausedRef.current = false
    setBatchComplete(false)
    
    batchRunIdRef.current += 1
    const currentRunId = batchRunIdRef.current

    let currentQueue = imagesToProcess || batchImages.filter(img => img.status === 'queued')
    
    if (currentQueue.length === 0) {
      setBatchProcessing(false)
      return
    }

    // FASE 2: Ordenação (OS primeiro)
    setBatchImages(prev => {
      return [...prev].sort((a, b) => {
        if (a.type === 'OS' && b.type !== 'OS') return -1
        if (a.type !== 'OS' && b.type === 'OS') return 1
        return 0
      })
    })

    const toProcess = currentQueue
      .filter(img => img.status === 'queued')
      .filter(img => img.type !== 'UNKNOWN')
      .sort((a, b) => {
        if (a.type === 'OS' && b.type !== 'OS') return -1
        if (a.type !== 'OS' && b.type === 'OS') return 1
        return 0
      })

    // FASE 3: Processamento
    for (const image of toProcess) {
      if (batchPausedRef.current || batchRunIdRef.current !== currentRunId) break

      setBatchImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, status: 'processing' as const } : img
      ))

      let success = false
      let retries = 0

      while (!success && retries < 3) {
        if (batchPausedRef.current || batchRunIdRef.current !== currentRunId) break

        try {
          const response = await fetch('/api/process-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              image: image.preview, 
              fileName: image.file.name,
              tipo: image.type
            }),
          })

          if (response.status === 429) {
            retries++
            if (retries < 3) {
              await new Promise(resolve => setTimeout(resolve, 15000)) // Wait 15s on Rate Limit
              continue
            }
          }

          const data = await response.json()

          if (!data.success && data.error && (data.error.includes('429') || data.error.includes('Quota exceeded'))) {
            retries++
            if (retries < 3) {
              await new Promise(resolve => setTimeout(resolve, 15000)) // Wait 15s on Rate Limit
              continue
            }
          }

          success = true

          if (data.success) {
            setBatchImages(prev => prev.map(img =>
              img.id === image.id ? {
                ...img,
                status: (data.recordsCreated === 0 && data.recordsUpdated === 0) ? 'duplicate' as const : 'success' as const,
                type: data.type,
                recordsCreated: data.recordsCreated || 0,
                recordsUpdated: data.recordsUpdated || 0,
                duplicatesSkipped: data.duplicatesSkipped || 0,
                notFound: data.notFound || 0,
              } : img
            ))
          } else {
            setBatchImages(prev => prev.map(img =>
              img.id === image.id ? { ...img, status: 'error' as const, error: data.error || 'Erro desconhecido' } : img
            ))
          }
        } catch (err) {
          success = true // break out of retry loop on network error
          setBatchImages(prev => prev.map(img =>
            img.id === image.id ? { ...img, status: 'error' as const, error: 'Erro de conexão' } : img
          ))
        }
      }

      if (!batchPausedRef.current && batchRunIdRef.current === currentRunId) {
        await new Promise(resolve => setTimeout(resolve, 6500))
      }
    }

    if (batchRunIdRef.current === currentRunId) {
      setBatchProcessing(false)
      if (!batchPausedRef.current) {
        setBatchComplete(true)
      }
    }
  }

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
    setBatchImages([])
    setBatchProcessing(false)
    setBatchPaused(false)
    setBatchComplete(false)
    batchPausedRef.current = false
    batchRunIdRef.current += 1
    setActiveClassifyIndex(-1)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
          {mode === 'OS' ? '📤 Novo Lançamento' : mode === 'REPASSE' ? '💳 Confirmar Pagamento' : '📤 Upload em Massa'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'OS'
            ? 'Upload da tela do iQuery para lançar novas ordens de serviço'
            : mode === 'REPASSE'
            ? 'Upload da listagem de repasse para confirmar pagamentos'
            : 'Envie múltiplas imagens para processamento automático em lote'}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="glass-card p-1 inline-flex rounded-xl flex-wrap">
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
        <button
          onClick={() => { setMode('LOTE'); resetAll() }}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'LOTE'
              ? 'bg-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/10'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          id="btn-mode-lote"
        >
          📤 Upload em Massa
        </button>
      </div>

      {/* Upload Zone */}
      {mode !== 'LOTE' && !imagePreview && !result && (
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

      {/* LOTE Upload Zone */}
      {mode === 'LOTE' && !batchImages.length && !batchComplete && (
        <div
          className="upload-zone p-8 sm:p-12 text-center"
          onClick={() => document.getElementById('batch-file-input')?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging') }}
          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragging') }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('dragging')
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
            if (files.length > 0) {
              handleBatchFileSelect(files)
            }
          }}
          id="batch-upload-zone"
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
               if (e.target.files) handleBatchFileSelect(Array.from(e.target.files))
               // Reset input value to allow selecting same files again if cleared
               e.target.value = ''
            }}
            className="hidden"
            id="batch-file-input"
          />
          <div className="text-5xl mb-4">
            📤
          </div>
          <p className="text-slate-300 font-medium mb-2">
            Selecione ou arraste várias imagens
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Envie múltiplas telas para processamento em lote
          </p>
          <button className="btn btn-primary btn-sm">
            Selecionar Imagens
          </button>
        </div>
      )}

      {/* Tinder Classification UI */}
      {mode === 'LOTE' && batchImages.length > 0 && activeClassifyIndex >= 0 && activeClassifyIndex < batchImages.length && (
        <div className="glass-card overflow-hidden animate-slide-up flex flex-col items-center">
          <div className="w-full p-4 border-b border-slate-700/30 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-200">
              Classificação Manual
            </h2>
            <span className="text-sm text-slate-400">
              Imagem {activeClassifyIndex + 1} de {batchImages.length}
            </span>
          </div>
          
          <div className="p-4 w-full flex-1 flex flex-col items-center justify-center bg-slate-900/50 min-h-[40vh]">
            <img 
              src={batchImages[activeClassifyIndex].preview} 
              alt="Classificando..." 
              className="max-h-[65vh] object-contain rounded-xl shadow-2xl border border-slate-700/50"
            />
          </div>

          <div className="p-6 w-full flex justify-center gap-4 border-t border-slate-700/30 bg-slate-800/20">
            <button 
              onClick={() => {
                const nextIndex = activeClassifyIndex + 1
                setBatchImages(prev => prev.map((img, idx) => idx === activeClassifyIndex ? { ...img, type: 'OS' as const, status: 'queued' as const } : img))
                setActiveClassifyIndex(nextIndex)
                if (nextIndex >= batchImages.length) {
                  setTimeout(() => {
                     const updatedBatch = batchImages.map((img, idx) => idx === activeClassifyIndex ? { ...img, type: 'OS' as const, status: 'queued' as const } : img)
                     processBatch(updatedBatch as BatchImage[])
                  }, 0)
                }
              }}
              className="flex-1 py-4 md:py-6 text-xl md:text-2xl font-bold rounded-xl bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all border border-teal-500/30 shadow-lg shadow-teal-500/10"
            >
              📋 OS
            </button>
            <button 
              onClick={() => {
                const nextIndex = activeClassifyIndex + 1
                setBatchImages(prev => prev.map((img, idx) => idx === activeClassifyIndex ? { ...img, type: 'REPASSE' as const, status: 'queued' as const } : img))
                setActiveClassifyIndex(nextIndex)
                if (nextIndex >= batchImages.length) {
                  setTimeout(() => {
                     const updatedBatch = batchImages.map((img, idx) => idx === activeClassifyIndex ? { ...img, type: 'REPASSE' as const, status: 'queued' as const } : img)
                     processBatch(updatedBatch as BatchImage[])
                  }, 0)
                }
              }}
              className="flex-1 py-4 md:py-6 text-xl md:text-2xl font-bold rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
            >
              💳 Repasse
            </button>
          </div>
        </div>
      )}

      {/* Batch Queue UI */}
      {mode === 'LOTE' && batchImages.length > 0 && activeClassifyIndex >= batchImages.length && !batchComplete && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="p-4 border-b border-slate-700/30 sm:flex items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">
                Lote de Imagens ({batchImages.length})
                {batchPaused && batchImages.some(i => i.status === 'unknown_type' || i.status === 'error') ? (
                  <span className="ml-3 text-amber-400 text-sm animate-pulse">
                    ⚠️ Pausado: Classifique as pendentes
                  </span>
                ) : batchPaused ? (
                  <span className="ml-3 text-emerald-400 text-sm animate-pulse">
                    ✅ Classificação concluída. Revise e Inicie o Salvamento.
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-48 bg-slate-700/50 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out" 
                      style={{ 
                      width: `${(batchImages.filter(i => i.status !== 'queued' && i.status !== 'processing' && i.status !== 'classifying').length / batchImages.length) * 100}%` 
                      }} 
                    />
                </div>
                <span className="text-xs text-slate-400">
                  {batchImages.filter(i => i.status !== 'queued' && i.status !== 'processing' && i.status !== 'classifying').length} / {batchImages.length}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {!batchProcessing && !batchPaused && batchImages.some(i => i.status === 'queued' && !i.type) && (
                <button onClick={() => processBatch()} className="btn btn-primary btn-sm">
                  ▶️ Iniciar Processamento
                </button>
              )}
              {batchProcessing && !batchPaused && (
                <button onClick={() => {
                  batchPausedRef.current = true
                  setBatchPaused(true)
                }} className="btn btn-secondary btn-sm">
                  ⏸️ Pausar
                </button>
              )}
              {batchPaused && batchImages.some(i => i.status === 'unknown_type' || i.status === 'error') && (
                <button disabled className="btn btn-primary btn-sm opacity-50 cursor-not-allowed">
                  ⚠️ Classifique as pendentes
                </button>
              )}
              {batchPaused && !batchImages.some(i => i.status === 'unknown_type' || i.status === 'error') && (
                <button onClick={() => {
                  setBatchPaused(false)
                  batchPausedRef.current = false
                  processBatch()
                }} className="btn btn-primary btn-sm animate-pulse">
                  ▶️ Iniciar Salvamento
                </button>
              )}
              <button onClick={resetAll} className="btn btn-ghost btn-sm text-slate-400 hover:text-rose-400">
                🗑️ Limpar
              </button>
            </div>
          </div>
          
          <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {batchImages.map(img => (
              <div key={img.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                <img 
                  src={img.preview} 
                  alt={img.file.name} 
                  className="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                  onClick={() => setZoomedImage(img.preview)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{img.file.name}</p>
                  <div className="text-xs mt-1">
                    {img.status === 'queued' && <span className="text-slate-400">⏳ Na fila {img.type && img.type !== 'UNKNOWN' && <span className="text-teal-400 ml-1 font-medium">[{img.type}]</span>}</span>}
                    {img.status === 'classifying' && <span className="text-teal-400 flex items-center gap-1"><div className="spinner !w-3 !h-3 !border-2" /> Analisando tipo...</span>}
                    {img.status === 'processing' && <span className="text-teal-400 flex items-center gap-1"><div className="spinner !w-3 !h-3 !border-2" /> Processando...</span>}
                    {img.status === 'success' && <span className="text-emerald-400">✅ {img.type} - {img.type === 'OS' ? `${img.recordsCreated} salvos` : `${img.recordsUpdated} atualizados`}</span>}
                    {img.status === 'duplicate' && <span className="text-amber-400">⚠️ Duplicatas ignoradas ({img.duplicatesSkipped})</span>}
                    {img.status === 'error' && <span className="text-rose-400">❌ {img.error}</span>}
                    {img.status === 'unknown_type' && (
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-amber-400">❓ Tipo não reconhecido</span>
                        <button onClick={() => {
                          setBatchImages(prev => prev.map(i => i.id === img.id ? { ...i, type: 'OS', status: 'queued' } : i))
                        }} className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-teal-500/20 hover:text-teal-400 transition-colors">📋 OS</button>
                        <button onClick={() => {
                          setBatchImages(prev => prev.map(i => i.id === img.id ? { ...i, type: 'REPASSE', status: 'queued' } : i))
                        }} className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-teal-500/20 hover:text-teal-400 transition-colors">💳 Repasse</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Summary */}
      {mode === 'LOTE' && batchComplete && (
        <div className="glass-card p-6 animate-slide-up border-teal-500/30 bg-teal-500/5">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-100">Lote Concluído! 🎉</h2>
            <p className="text-slate-400 mt-1">Veja o resumo do processamento abaixo</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/30 text-center">
              <div className="text-3xl font-bold text-slate-200">{batchImages.length}</div>
              <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Imagens</div>
            </div>
            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {batchImages.reduce((acc, img) => acc + (img.recordsCreated || 0), 0)}
              </div>
              <div className="text-xs text-emerald-500/70 mt-1 uppercase tracking-wider">OS Criadas</div>
            </div>
            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {batchImages.reduce((acc, img) => acc + (img.recordsUpdated || 0), 0)}
              </div>
              <div className="text-xs text-emerald-500/70 mt-1 uppercase tracking-wider">Repasses Atualizados</div>
            </div>
            <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-center">
              <div className="text-3xl font-bold text-amber-400">
                {batchImages.reduce((acc, img) => acc + (img.duplicatesSkipped || 0), 0)}
              </div>
              <div className="text-xs text-amber-500/70 mt-1 uppercase tracking-wider">Duplicadas</div>
            </div>
            <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-center">
              <div className="text-3xl font-bold text-rose-400">
                {batchImages.filter(img => img.status === 'error' || img.status === 'unknown_type').length}
              </div>
              <div className="text-xs text-rose-500/70 mt-1 uppercase tracking-wider">Erros/Pendentes</div>
            </div>
          </div>
          
          <div className="flex justify-center gap-3 flex-wrap">
            {batchImages.some(img => img.status === 'error') && (
              <button onClick={() => {
                const retryImages = batchImages.filter(img => img.status === 'error').map(img => ({ ...img, status: 'queued' as const, error: undefined }))
                setBatchImages(prev => prev.map(img => img.status === 'error' ? { ...img, status: 'queued', error: undefined } : img))
                processBatch(retryImages)
              }} className="btn btn-secondary">
                🔄 Reprocessar Falhas
              </button>
            )}
            <button onClick={resetAll} className="btn btn-secondary">
              Novo Lote
            </button>
            <button onClick={() => router.push('/dashboard')} className="btn btn-primary">
              Ver Dashboard
            </button>
          </div>
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

      {/* Zoomed Image Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-rose-400 text-4xl w-12 h-12 flex items-center justify-center bg-slate-900/50 rounded-full"
            onClick={() => setZoomedImage(null)}
          >
            &times;
          </button>
          <img 
            src={zoomedImage} 
            alt="Preview Ampliado" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
