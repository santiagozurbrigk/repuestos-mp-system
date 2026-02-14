import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import api from '../services/api'

export default function InvoiceCalendar({ onInvoiceClick }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [invoicesByDate, setInvoicesByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    fetchPendingInvoices()
  }, [currentDate])

  const fetchPendingInvoices = async () => {
    try {
      setLoading(true)
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      
      const response = await api.get('/suppliers/invoices/pending', {
        params: {
          start_date: format(monthStart, 'yyyy-MM-dd'),
          end_date: format(monthEnd, 'yyyy-MM-dd'),
        },
      })

      // Agrupar facturas por fecha de vencimiento
      const grouped = {}
      response.data.forEach((invoice) => {
        if (invoice.due_date && !invoice.is_paid) {
          const dateKey = invoice.due_date
          if (!grouped[dateKey]) {
            grouped[dateKey] = []
          }
          grouped[dateKey].push(invoice)
        }
      })

      setInvoicesByDate(grouped)
    } catch (err) {
      console.error('Error al cargar facturas pendientes:', err)
    } finally {
      setLoading(false)
    }
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = new Date(monthStart)
  calendarStart.setDate(calendarStart.getDate() - getDay(monthStart)) // Ajustar al inicio de la semana (domingo)

  const calendarEnd = new Date(monthEnd)
  const daysToAdd = 6 - getDay(monthEnd)
  calendarEnd.setDate(calendarEnd.getDate() + daysToAdd) // Ajustar al final de la semana (sábado)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const handleDateClick = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const invoices = invoicesByDate[dateKey] || []
    
    if (invoices.length > 0) {
      setSelectedDate(date)
      if (onInvoiceClick) {
        onInvoiceClick(date, invoices)
      }
    }
  }

  const getTotalForDate = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const invoices = invoicesByDate[dateKey] || []
    return invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0) - parseFloat(inv.paid_amount || 0), 0)
  }

  const isToday = (date) => {
    return isSameDay(date, new Date())
  }

  const isPastDue = (date) => {
    return date < new Date() && !isSameDay(date, new Date())
  }

  return (
    <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Calendario de Pagos</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendario */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const invoices = invoicesByDate[dateKey] || []
              const total = getTotalForDate(day)
              const hasInvoices = invoices.length > 0
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isSelected = selectedDate && isSameDay(day, selectedDate)

              return (
                <div
                  key={day.toString()}
                  onClick={() => handleDateClick(day)}
                  className={`
                    min-h-[80px] p-2 border rounded-lg cursor-pointer transition-all
                    ${!isCurrentMonth ? 'opacity-30 bg-gray-50' : 'bg-white hover:bg-gray-50'}
                    ${isToday(day) ? 'border-primary-500 border-2 bg-primary-50' : 'border-gray-200'}
                    ${hasInvoices ? 'border-orange-300 bg-orange-50 hover:bg-orange-100' : ''}
                    ${isPastDue(day) && hasInvoices ? 'border-red-400 bg-red-50' : ''}
                    ${isSelected ? 'ring-2 ring-primary-500' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`
                        text-sm font-medium
                        ${isToday(day) ? 'text-primary-700' : 'text-gray-700'}
                        ${isPastDue(day) && hasInvoices ? 'text-red-700' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </span>
                    {hasInvoices && (
                      <span className="text-xs font-semibold text-orange-600 bg-orange-200 px-1.5 py-0.5 rounded">
                        {invoices.length}
                      </span>
                    )}
                  </div>
                  {hasInvoices && (
                    <div className="mt-1">
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <DollarSign className="w-3 h-3" />
                        <span className="font-semibold">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-primary-500 bg-primary-50 rounded"></div>
              <span>Hoy</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border border-orange-300 bg-orange-50 rounded"></div>
              <span>Facturas pendientes</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border border-red-400 bg-red-50 rounded"></div>
              <span>Vencidas</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
