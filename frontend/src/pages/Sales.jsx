import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getBuenosAiresDateString, formatDateTimeLocal } from '../utils/dateHelpers'

const paymentMethodLabels = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otros',
}

export default function Sales() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [sales, setSales] = useState([])
  const [closedDates, setClosedDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  const [formData, setFormData] = useState({
    total_amount: '',
    payment_method: 'cash',
    observations: '',
    date: formatDateTimeLocal(),
  })

  useEffect(() => {
    fetchSales()
    fetchClosedDates()
  }, [])

  // Abrir modal con Enter cuando no está abierto
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Solo si el modal no está abierto y no estamos escribiendo en un input
      if (!showModal && e.key === 'Enter' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault()
        setEditingSale(null)
        setFormData({
          total_amount: '',
          payment_method: 'cash',
          observations: '',
          date: formatDateTimeLocal(),
        })
        setShowModal(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal])

  const fetchClosedDates = async () => {
    try {
      const response = await api.get('/cash-closure?limit=100')
      const dates = response.data.map(c => c.closure_date)
      setClosedDates(dates)
    } catch (error) {
      // Error silencioso, no crítico
    }
  }

  const fetchSales = async () => {
    try {
      setLoading(true)
      const response = await api.get('/sales?limit=100')
      setSales(response.data)
    } catch (err) {
      error('Error al cargar las ventas')
    } finally {
      setLoading(false)
    }
  }

  const isSaleDateClosed = (saleDate) => {
    const dateStr = new Date(saleDate).toISOString().split('T')[0]
    return closedDates.includes(dateStr)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSale) {
        await api.put(`/sales/${editingSale.id}`, formData)
      } else {
        await api.post('/sales', formData)
      }
      setShowModal(false)
      setEditingSale(null)
      setFormData({
        total_amount: '',
        payment_method: 'cash',
        observations: '',
        date: formatDateTimeLocal(),
      })
      fetchSales()
      fetchClosedDates() // Actualizar fechas cerradas después de guardar
      success(editingSale ? 'Venta actualizada correctamente' : 'Venta creada correctamente')
    } catch (err) {
      error('Error al guardar la venta')
    }
  }

  const handleEdit = (sale) => {
    setEditingSale(sale)
    setFormData({
      total_amount: sale.total_amount.toString(),
      payment_method: sale.payment_method,
      observations: sale.observations || '',
      date: formatDateTimeLocal(new Date(sale.date)),
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Eliminar venta',
      message: '¿Estás seguro de eliminar esta venta? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.delete(`/sales/${id}`)
      fetchSales()
      fetchClosedDates()
      success('Venta eliminada correctamente')
    } catch (err) {
      error('Error al eliminar la venta')
    }
  }

  const totalToday = sales
    .filter((sale) => {
      // sale.date es un timestamp ISO (UTC) desde el backend
      const saleDate = new Date(sale.date)
      // Convertir a fecha de Buenos Aires: restar 3 horas para obtener la fecha local
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000))
      const saleDateStr = buenosAiresDate.toISOString().split('T')[0]
      const todayStr = getBuenosAiresDateString()
      return saleDateStr === todayStr
    })
    .reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-200 border-t-primary-600"></div>
      </div>
    )
  }

  const paymentMethodColors = {
    cash: 'bg-blue-100 text-blue-700 border-blue-200',
    card: 'bg-blue-100 text-blue-700 border-blue-200',
    transfer: 'bg-blue-100 text-blue-700 border-blue-200',
    other: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Ventas</h1>
          <div className="flex items-center space-x-4">
            <p className="text-gray-600">
              Total hoy: <span className="font-semibold text-gray-900">${totalToday.toFixed(2)}</span>
            </p>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
              Presiona Enter para nueva venta
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingSale(null)
            setFormData({
              total_amount: '',
              payment_method: 'cash',
              observations: '',
              date: formatDateTimeLocal(),
            })
            setShowModal(true)
          }}
          className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Venta
        </button>
      </div>

      <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
        {sales.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas</h3>
            <p className="mt-1 text-sm text-gray-500">Comienza registrando tu primera venta.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sales.map((sale) => {
              const isClosed = isSaleDateClosed(sale.date)
              return (
                <li 
                  key={sale.id} 
                  className={`px-6 py-5 hover:bg-gray-50/50 transition-colors duration-150 ${
                    isClosed ? 'bg-gray-50/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-xl font-bold text-gray-900">
                              ${parseFloat(sale.total_amount).toFixed(2)}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${paymentMethodColors[sale.payment_method]}`}>
                              {paymentMethodLabels[sale.payment_method]}
                            </span>
                            {isClosed && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                Día Cerrado
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 text-sm text-gray-500">
                            {format(new Date(sale.date), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                              locale: es,
                            })}
                          </div>
                          {sale.observations && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                              {sale.observations}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(sale)}
                        className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors duration-150"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog />

      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => {
              setShowModal(false)
              setEditingSale(null)
            }}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-soft-lg transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100">
              <form 
                onSubmit={handleSubmit}
              >
                <div className="bg-white px-6 pt-6 pb-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    {editingSale ? 'Editar Venta' : 'Nueva Venta'}
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Monto Total *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        autoFocus
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                        value={formData.total_amount}
                        onChange={(e) =>
                          setFormData({ ...formData, total_amount: e.target.value })
                        }
                        placeholder="0.00"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const form = e.target.closest('form')
                            if (form) {
                              form.requestSubmit()
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Método de Pago *
                      </label>
                      <select
                        required
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-white"
                        value={formData.payment_method}
                        onChange={(e) =>
                          setFormData({ ...formData, payment_method: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const form = e.target.closest('form')
                            if (form) {
                              form.requestSubmit()
                            }
                          }
                        }}
                      >
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                        <option value="other">Otros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Fecha y Hora
                      </label>
                      <input
                        type="datetime-local"
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const form = e.target.closest('form')
                            if (form) {
                              form.requestSubmit()
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Observaciones
                      </label>
                      <textarea
                        rows={3}
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 resize-none"
                        value={formData.observations}
                        onChange={(e) =>
                          setFormData({ ...formData, observations: e.target.value })
                        }
                        placeholder="Opcional..."
                        onKeyDown={(e) => {
                          // En textarea, Ctrl+Enter o Cmd+Enter para guardar
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault()
                            const form = e.target.closest('form')
                            if (form) {
                              form.requestSubmit()
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse border-t border-gray-100">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-base font-medium text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 sm:ml-3 sm:w-auto"
                  >
                    {editingSale ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingSale(null)
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-5 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 sm:mt-0 sm:ml-3 sm:w-auto"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
