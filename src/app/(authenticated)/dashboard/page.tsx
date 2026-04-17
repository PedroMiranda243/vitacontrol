'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { formatCurrency, formatDate, calcDiasParaVencer, cn } from '@/lib/utils'
import type { RecordData, DashboardSummary, Status } from '@/types'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [records, setRecords] = useState<RecordData[]>([])
  const [summary, setSummary] = useState<DashboardSummary>({
    emAberto: { quantidade: 0, valorTotal: 0 },
    pago: { quantidade: 0, valorTotal: 0 },
    vencido: { quantidade: 0, valorTotal: 0 },
  })
  const [empresas, setEmpresas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL')
  const [empresaFilter, setEmpresaFilter] = useState('')
  const [mesAnoFilter, setMesAnoFilter] = useState('')
  const [page, setPage] = useState(1)

  // Edit modal
  const [editingRecord, setEditingRecord] = useState<RecordData | null>(null)
  const [editForm, setEditForm] = useState<Partial<RecordData>>({})
  const [saving, setSaving] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (empresaFilter) params.set('empresa', empresaFilter)
      if (mesAnoFilter) params.set('mesAno', mesAnoFilter)
      params.set('page', page.toString())
      params.set('limit', '50')

      const response = await fetch(`/api/records?${params}`)
      const data = await response.json()

      if (response.ok) {
        setRecords(data.records || [])
        setSummary(data.summary || summary)
        setEmpresas(data.empresas || [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Error fetching records:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, empresaFilter, mesAnoFilter, page])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleExport = async (filter: string) => {
    try {
      const response = await fetch(`/api/export?filter=${filter}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vitacontrol-${filter}-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  const openEditModal = (record: RecordData) => {
    setEditingRecord(record)
    setEditForm({
      dataLancamento: record.dataLancamento?.split('T')[0],
      os: record.os,
      examesOs: record.examesOs,
      descricao: record.descricao,
      exame: record.exame,
      empresa: record.empresa,
      valor: record.valor,
      dataVencimento: record.dataVencimento?.split('T')[0],
      pago: record.pago,
      dataPagamento: record.dataPagamento?.split('T')[0] || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingRecord?.id) return
    setSaving(true)
    try {
      const response = await fetch(`/api/records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (response.ok) {
        setEditingRecord(null)
        fetchRecords()
      }
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    try {
      const response = await fetch(`/api/records/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchRecords()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'EM_ABERTO': return 'status-em-aberto'
      case 'PAGO': case 'OK': return 'status-pago'
      case 'VENCIDO': return 'status-vencido'
      default: return ''
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'EM_ABERTO': return 'Em Aberto'
      case 'PAGO': return 'Pago'
      case 'VENCIDO': return 'Vencido'
      case 'OK': return 'OK'
      default: return status
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('all')}
            className="btn btn-secondary btn-sm"
            id="btn-export-all"
          >
            📥 Exportar Tudo
          </button>
          <button
            onClick={() => handleExport('unpaid')}
            className="btn btn-secondary btn-sm"
            id="btn-export-unpaid"
          >
            📥 Não Pagos
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <div className="summary-card em-aberto" id="card-em-aberto">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🟡</span>
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Em Aberto</span>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">
            {summary.emAberto.quantidade}
          </div>
          <div className="text-lg font-semibold text-amber-400 mt-1 font-mono">
            {formatCurrency(summary.emAberto.valorTotal)}
          </div>
        </div>

        <div className="summary-card pago" id="card-pago">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🟢</span>
            <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Pago</span>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">
            {summary.pago.quantidade}
          </div>
          <div className="text-lg font-semibold text-emerald-400 mt-1 font-mono">
            {formatCurrency(summary.pago.valorTotal)}
          </div>
        </div>

        <div className="summary-card vencido" id="card-vencido">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🔴</span>
            <span className="text-sm font-semibold text-rose-400 uppercase tracking-wide">Vencido</span>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">
            {summary.vencido.quantidade}
          </div>
          <div className="text-lg font-semibold text-rose-400 mt-1 font-mono">
            {formatCurrency(summary.vencido.valorTotal)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as Status | 'ALL'); setPage(1) }}
              className="input"
              id="filter-status"
            >
              <option value="ALL">Todos</option>
              <option value="EM_ABERTO">Em Aberto</option>
              <option value="PAGO">Pago</option>
              <option value="VENCIDO">Vencido</option>
              <option value="OK">OK</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Empresa</label>
            <select
              value={empresaFilter}
              onChange={(e) => { setEmpresaFilter(e.target.value); setPage(1) }}
              className="input"
              id="filter-empresa"
            >
              <option value="">Todas</option>
              {empresas.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Mês/Ano</label>
            <input
              type="month"
              value={mesAnoFilter}
              onChange={(e) => { setMesAnoFilter(e.target.value); setPage(1) }}
              className="input"
              id="filter-mes-ano"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setStatusFilter('ALL'); setEmpresaFilter(''); setMesAnoFilter(''); setPage(1) }}
              className="btn btn-ghost btn-sm w-full"
              id="btn-clear-filters"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="spinner mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Carregando registros...</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-4xl mb-4">📋</p>
              <p className="text-slate-400">Nenhum registro encontrado</p>
              {isAdmin && (
                <a href="/upload" className="btn btn-primary btn-sm mt-4 inline-flex">
                  Novo Lançamento
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data Lanç.</th>
                  <th>OS</th>
                  <th>Descrição</th>
                  <th>Exame</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Pago</th>
                  <th>Dt. Pgto</th>
                  <th>Dias</th>
                  <th>Status</th>
                  {isAdmin && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => {
                  const dias = record.pago ? null : calcDiasParaVencer(record.dataVencimento)
                  return (
                    <tr key={record.id || idx}>
                      <td>{formatDate(record.dataLancamento)}</td>
                      <td className="font-mono text-xs">
                        {record.os}
                        {record.examesOs && (
                          <span className="text-slate-500"> / {record.examesOs}</span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate" title={record.descricao}>
                        {record.descricao}
                      </td>
                      <td className="text-xs text-slate-400">{record.exame || '-'}</td>
                      <td className="font-mono font-semibold text-teal-400">
                        {formatCurrency(record.valor)}
                      </td>
                      <td>{formatDate(record.dataVencimento)}</td>
                      <td>
                        <span className={cn(
                          'text-xs font-bold',
                          record.pago ? 'text-emerald-400' : 'text-slate-500'
                        )}>
                          {record.pago ? 'SIM' : 'NÃO'}
                        </span>
                      </td>
                      <td className="text-sm">
                        {record.dataPagamento ? formatDate(record.dataPagamento) : '-'}
                      </td>
                      <td>
                        {record.pago ? (
                          <span className="text-emerald-400 font-semibold text-xs">OK</span>
                        ) : (
                          <span className={cn(
                            'font-mono font-semibold text-xs',
                            dias !== null && dias < 0 ? 'text-rose-400' : 'text-amber-400'
                          )}>
                            {dias}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={cn('status-badge', getStatusClass(record.status))}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditModal(record)}
                              className="btn btn-ghost btn-sm text-xs"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => record.id && handleDelete(record.id)}
                              className="btn btn-ghost btn-sm text-xs"
                              title="Excluir"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-700/30 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="btn btn-secondary btn-sm"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="modal-overlay" onClick={() => setEditingRecord(null)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-100">Editar Registro</h2>
              <button
                onClick={() => setEditingRecord(null)}
                className="btn btn-ghost btn-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Data Lançamento</label>
                  <input
                    type="date"
                    value={editForm.dataLancamento || ''}
                    onChange={(e) => setEditForm({ ...editForm, dataLancamento: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">OS</label>
                  <input
                    type="text"
                    value={editForm.os || ''}
                    onChange={(e) => setEditForm({ ...editForm, os: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Descrição (Paciente)</label>
                <input
                  type="text"
                  value={editForm.descricao || ''}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Exame</label>
                  <input
                    type="text"
                    value={editForm.exame || ''}
                    onChange={(e) => setEditForm({ ...editForm, exame: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.valor || ''}
                    onChange={(e) => setEditForm({ ...editForm, valor: parseFloat(e.target.value) })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Empresa</label>
                <input
                  type="text"
                  value={editForm.empresa || ''}
                  onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Data Vencimento</label>
                  <input
                    type="date"
                    value={editForm.dataVencimento || ''}
                    onChange={(e) => setEditForm({ ...editForm, dataVencimento: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Data Pagamento</label>
                  <input
                    type="date"
                    value={editForm.dataPagamento || ''}
                    onChange={(e) => setEditForm({ ...editForm, dataPagamento: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-pago"
                  checked={editForm.pago || false}
                  onChange={(e) => setEditForm({ ...editForm, pago: e.target.checked })}
                  className="w-4 h-4 rounded bg-navy-900 border-slate-600 text-teal-500 focus:ring-teal-500"
                />
                <label htmlFor="edit-pago" className="text-sm text-slate-300">
                  Pago
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-700/30">
              <button
                onClick={() => setEditingRecord(null)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="btn btn-primary flex-1"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
