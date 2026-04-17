'use client'

import { useState, useEffect } from 'react'
import type { UploadLogData } from '@/types'

export default function UploadHistoryPage() {
  const [logs, setLogs] = useState<UploadLogData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const response = await fetch('/api/upload-logs')
        const data = await response.json()
        if (response.ok) {
          setLogs(data.logs || [])
        }
      } catch (error) {
        console.error('Error fetching logs:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">📋 Histórico de Uploads</h1>
        <p className="text-slate-400 text-sm mt-1">
          Registro de todas as imagens processadas
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="spinner mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Carregando histórico...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-slate-400">Nenhum upload registrado</p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Arquivo</th>
                  <th>Registros</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <span className={`status-badge ${
                        log.tipo === 'OS' ? 'status-em-aberto' : 'status-pago'
                      }`}>
                        {log.tipo === 'OS' ? '📋 OS' : '💳 Repasse'}
                      </span>
                    </td>
                    <td className="text-sm text-slate-400">{log.fileName}</td>
                    <td className="font-mono font-semibold text-teal-400">
                      {log.recordCount}
                    </td>
                    <td className="text-sm text-slate-400">{log.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
