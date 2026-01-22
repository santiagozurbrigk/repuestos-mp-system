import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { getBuenosAiresDateString, parseBuenosAiresDate } from '../utils/dateHelpers'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, TrendingUp } from 'lucide-react'

// Colores azules sutiles para gráficos
const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
const CHART_COLORS = {
  primary: '#3b82f6',
  light: '#60a5fa',
  lighter: '#93c5fd',
  lightest: '#bfdbfe',
}

export default function Statistics() {
  const { error: showError } = useToast()
  const [dailyStats, setDailyStats] = useState([])
  const [weeklyStats, setWeeklyStats] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [paymentStats, setPaymentStats] = useState({})
  const [salesCountStats, setSalesCountStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date()
    const thirtyDaysAgo = subDays(today, 30)
    return {
      startDate: getBuenosAiresDateString(thirtyDaysAgo),
      endDate: getBuenosAiresDateString(today),
    }
  })

  useEffect(() => {
    fetchStatistics()
  }, [dateRange])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const { startDate, endDate } = dateRange

      const [
        dailyResponse,
        weeklyResponse,
        monthlyResponse,
        paymentResponse,
        salesCountResponse,
      ] = await Promise.all([
        api.get(`/statistics/daily?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/statistics/weekly?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/statistics/monthly?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/statistics/payment-methods?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/statistics/sales-count?startDate=${startDate}&endDate=${endDate}`),
      ])

      setDailyStats(dailyResponse.data || [])
      setWeeklyStats(weeklyResponse.data || [])
      setMonthlyStats(monthlyResponse.data || [])
      setPaymentStats(paymentResponse.data || {})
      setSalesCountStats(salesCountResponse.data || [])
    } catch (err) {
      // El logger ya está manejando el error en el interceptor de axios
      // Solo mostramos un mensaje amigable al usuario
      if (err.response?.status === 401) {
        showError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.')
      } else if (err.code === 'ERR_NETWORK') {
        showError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.')
      } else {
        showError('Error al cargar las estadísticas. Por favor, intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleQuickRange = (days) => {
    const today = new Date()
    const daysAgo = subDays(today, days)
    setDateRange({
      startDate: getBuenosAiresDateString(daysAgo),
      endDate: getBuenosAiresDateString(today),
    })
  }

  const paymentData = [
    { name: 'Efectivo', value: parseFloat(paymentStats.cash || 0) },
    { name: 'Tarjeta', value: parseFloat(paymentStats.card || 0) },
    { name: 'Transferencia', value: parseFloat(paymentStats.transfer || 0) },
    { name: 'Otros', value: parseFloat(paymentStats.other || 0) },
  ].filter((item) => item.value > 0)

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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Estadísticas</h1>
        <p className="text-gray-600">Análisis y reportes de ventas</p>
      </div>

      <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="border border-gray-300 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm"
              />
              <span className="text-gray-500 font-medium">a</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="border border-gray-300 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleQuickRange(7)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
            >
              7 días
            </button>
            <button
              onClick={() => handleQuickRange(30)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
            >
              30 días
            </button>
            <button
              onClick={() => handleQuickRange(90)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
            >
              90 días
            </button>
          </div>
        </div>
      </div>

      {/* Gráfico de ventas diarias */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 mb-6 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Ventas Diarias</h2>
        </div>
        <div className="p-6">
          {dailyStats.length === 0 ? (
            <div className="flex items-center justify-center h-300 text-gray-500">
              <div className="text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={1} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const dateObj = parseBuenosAiresDate(value)
                    return dateObj ? format(dateObj, 'dd/MM', { locale: es }) : value
                  }}
                  stroke="#9ca3af"
                  style={{ fontSize: '12px', fontWeight: 400 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px', fontWeight: 400 }}
                  tickFormatter={(value) => `$${value}`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                  formatter={(value) => [`$${parseFloat(value).toFixed(2)}`, 'Total']}
                  labelFormatter={(value) => {
                    const dateObj = parseBuenosAiresDate(value)
                    return dateObj ? format(dateObj, 'dd/MM/yyyy', { locale: es }) : value
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: CHART_COLORS.primary }}
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico de métodos de pago */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-xl font-semibold text-gray-900">Distribución por Método de Pago</h2>
          </div>
          <div className="p-6">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#3b82f6"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    }}
                    formatter={(value) => `$${parseFloat(value).toFixed(2)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-300 text-gray-500">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm">No hay datos para mostrar</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-xl font-semibold text-gray-900">Cantidad de Ventas por Día</h2>
          </div>
          <div className="p-6">
            {salesCountStats.length === 0 ? (
              <div className="flex items-center justify-center h-300 text-gray-500">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm">No hay datos para mostrar</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesCountStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={1} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const dateObj = parseBuenosAiresDate(value)
                      return dateObj ? format(dateObj, 'dd/MM', { locale: es }) : value
                    }}
                    stroke="#9ca3af"
                    style={{ fontSize: '12px', fontWeight: 400 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    style={{ fontSize: '12px', fontWeight: 400 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    }}
                    labelFormatter={(value) => {
                      const dateObj = parseBuenosAiresDate(value)
                      return dateObj ? format(dateObj, 'dd/MM/yyyy', { locale: es }) : value
                    }}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="Cantidad de Ventas" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de ventas semanales */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 mb-6 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Ventas Semanales</h2>
        </div>
        <div className="p-6">
          {weeklyStats.length === 0 ? (
            <div className="flex items-center justify-center h-300 text-gray-500">
              <div className="text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={1} />
                <XAxis
                  dataKey="week_start"
                  tickFormatter={(value) => {
                    const dateObj = parseBuenosAiresDate(value)
                    return dateObj ? format(dateObj, 'dd/MM', { locale: es }) : value
                  }}
                  stroke="#9ca3af"
                  style={{ fontSize: '12px', fontWeight: 400 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px', fontWeight: 400 }}
                  tickFormatter={(value) => `$${value}`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                  formatter={(value) => `$${parseFloat(value).toFixed(2)}`}
                  labelFormatter={(value) => {
                    const dateObj = parseBuenosAiresDate(value)
                    return dateObj ? format(dateObj, 'dd/MM/yyyy', { locale: es }) : value
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                <Bar dataKey="cash" stackId="a" fill={CHART_COLORS.primary} name="Efectivo" radius={[6, 6, 0, 0]} />
                <Bar dataKey="card" stackId="a" fill={CHART_COLORS.light} name="Tarjeta" />
                <Bar dataKey="transfer" stackId="a" fill={CHART_COLORS.lighter} name="Transferencia" />
                <Bar dataKey="other" stackId="a" fill={CHART_COLORS.lightest} name="Otros" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico de ventas mensuales */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Ventas Mensuales</h2>
        </div>
        <div className="p-6">
          {monthlyStats.length === 0 ? (
            <div className="flex items-center justify-center h-300 text-gray-500">
              <div className="text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={1} />
                <XAxis
                  dataKey="month"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px', fontWeight: 400 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px', fontWeight: 400 }}
                  tickFormatter={(value) => `$${value}`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                  formatter={(value) => `$${parseFloat(value).toFixed(2)}`}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                <Bar dataKey="cash" stackId="a" fill={CHART_COLORS.primary} name="Efectivo" radius={[6, 6, 0, 0]} />
                <Bar dataKey="card" stackId="a" fill={CHART_COLORS.light} name="Tarjeta" />
                <Bar dataKey="transfer" stackId="a" fill={CHART_COLORS.lighter} name="Transferencia" />
                <Bar dataKey="other" stackId="a" fill={CHART_COLORS.lightest} name="Otros" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
