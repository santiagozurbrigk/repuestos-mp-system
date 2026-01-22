import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Wallet, Lock, CheckCircle, Trash2 } from 'lucide-react'
import { getBuenosAiresDateString, parseBuenosAiresDate } from '../utils/dateHelpers'

const paymentMethodLabels = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otros',
}

export default function CashClosure() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [todaySummary, setTodaySummary] = useState(null)
  const [closures, setClosures] = useState([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    fetchTodaySummary()
    fetchClosures()
  }, [])

  const fetchTodaySummary = async () => {
    try {
      const response = await api.get('/cash-closure/today-summary')
      setTodaySummary(response.data)
    } catch (error) {
      // Error silencioso, se maneja en el componente
    }
  }

  const fetchClosures = async () => {
    try {
      setLoading(true)
      const response = await api.get('/cash-closure?limit=30')
      setClosures(response.data)
    } catch (err) {
      error('Error al cargar los cierres de caja')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseCash = async () => {
    // Usar fecha de Buenos Aires
    const todayStr = getBuenosAiresDateString()
    
    const confirmed = await confirm({
      title: 'Cerrar caja',
      message: `¿Estás seguro de cerrar la caja del día ${todayStr}? Una vez cerrada, no podrás agregar más ventas a este día.`,
      confirmText: 'Cerrar caja',
      cancelText: 'Cancelar',
      type: 'warning',
    })

    if (!confirmed) return

    try {
      setClosing(true)
      logger.info('Cerrando caja', { date: todayStr })
      await api.post('/cash-closure', {
        closure_date: todayStr,
      })
      logger.success('Caja cerrada exitosamente')
      await fetchTodaySummary()
      await fetchClosures()
      success('Caja cerrada correctamente')
    } catch (err) {
      logger.error('Error al cerrar caja:', err)
      const errorMessage = err.response?.data?.error || 'Error al cerrar la caja'
      error(errorMessage)
      
      // Si el error es que ya existe un cierre, recargar el resumen
      if (error.response?.status === 400) {
        await fetchTodaySummary()
      }
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-200 border-t-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Cierre de Caja</h1>
        <p className="text-gray-600">Gestiona los cierres diarios de caja</p>
      </div>

      {/* Resumen del día */}
      {todaySummary && (
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 mb-8 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Resumen del Día
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              {todaySummary.isClosed && (
                <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <Lock className="w-4 h-4 mr-2" />
                  Cerrado
                </span>
              )}
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-xl border border-blue-200">
                <div className="text-sm font-semibold text-blue-700 mb-2">Total Facturado</div>
                <div className="text-3xl font-bold text-blue-900">
                  ${parseFloat(todaySummary.total_sales).toFixed(2)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-xl border border-blue-200">
                <div className="text-sm font-semibold text-blue-700 mb-2">Cantidad de Ventas</div>
                <div className="text-3xl font-bold text-blue-900">{todaySummary.sales_count}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-xl border border-blue-200">
                <div className="text-sm font-semibold text-blue-700 mb-2">Promedio por Venta</div>
                <div className="text-3xl font-bold text-blue-900">
                  $
                  {todaySummary.sales_count > 0
                    ? (parseFloat(todaySummary.total_sales) / todaySummary.sales_count).toFixed(2)
                    : '0.00'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-1">Efectivo</div>
                <div className="text-xl font-bold text-gray-900">
                  ${parseFloat(todaySummary.total_cash).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-1">Tarjeta</div>
                <div className="text-xl font-bold text-gray-900">
                  ${parseFloat(todaySummary.total_card).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-1">Transferencia</div>
                <div className="text-xl font-bold text-gray-900">
                  ${parseFloat(todaySummary.total_transfer).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-1">Otros</div>
                <div className="text-xl font-bold text-gray-900">
                  ${parseFloat(todaySummary.total_other).toFixed(2)}
                </div>
              </div>
            </div>
            {!todaySummary.isClosed && (
              <div className="mt-6">
                <button
                  onClick={handleCloseCash}
                  disabled={closing}
                  className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  {closing ? 'Cerrando...' : 'Cerrar Caja'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historial de cierres */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Historial de Cierres</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {closures.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Wallet className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cierres registrados</h3>
              <p className="mt-1 text-sm text-gray-500">Los cierres aparecerán aquí una vez que los realices.</p>
            </div>
          ) : (
            closures.map((closure) => (
              <div key={closure.id} className="px-6 py-5 hover:bg-gray-50/50 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <span className="text-lg font-bold text-gray-900">
                          {(() => {
                            const dateObj = parseBuenosAiresDate(closure.closure_date)
                            return dateObj 
                              ? format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: es })
                              : closure.closure_date
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <span className="text-gray-600 text-xs block mb-1">Total</span>
                        <span className="font-bold text-gray-900">
                          ${parseFloat(closure.total_sales).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <span className="text-gray-600 text-xs block mb-1">Efectivo</span>
                        <span className="font-bold text-gray-900">
                          ${parseFloat(closure.total_cash).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <span className="text-gray-600 text-xs block mb-1">Tarjeta</span>
                        <span className="font-bold text-gray-900">
                          ${parseFloat(closure.total_card).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <span className="text-gray-600 text-xs block mb-1">Transferencia</span>
                        <span className="font-bold text-gray-900">
                          ${parseFloat(closure.total_transfer).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <span className="text-gray-600 text-xs block mb-1">Ventas</span>
                        <span className="font-bold text-gray-900">{closure.sales_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={async () => {
                        const dateObj = parseBuenosAiresDate(closure.closure_date)
                        const formattedDate = dateObj 
                          ? format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: es })
                          : closure.closure_date
                        
                        const confirmed = await confirm({
                          title: 'Eliminar cierre de caja',
                          message: `¿Estás seguro de eliminar el cierre de caja del ${formattedDate}? Esta acción no se puede deshacer.`,
                          confirmText: 'Eliminar',
                          cancelText: 'Cancelar',
                          type: 'danger',
                        })

                        if (!confirmed) return

                        try {
                          await api.delete(`/cash-closure/${closure.id}`)
                          await fetchClosures()
                          await fetchTodaySummary()
                          success('Cierre de caja eliminado correctamente')
                        } catch (err) {
                          error('Error al eliminar el cierre de caja')
                        }
                      }}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                      title="Eliminar cierre de caja"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog />
    </div>
  )
}
