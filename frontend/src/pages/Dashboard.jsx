import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { ShoppingCart, Wallet, List, TrendingUp, DollarSign } from 'lucide-react'
import { getBuenosAiresDateString } from '../utils/dateHelpers'

export default function Dashboard() {
  const { error } = useToast()
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    weekSales: 0,
    monthSales: 0,
    pendingLists: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const today = getBuenosAiresDateString()
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)

      // Ventas de hoy
      const todayResponse = await api.get(`/sales?startDate=${today}&limit=1000`)
      const todaySales = todayResponse.data
      const todayTotal = todaySales.reduce(
        (sum, sale) => sum + parseFloat(sale.total_amount),
        0
      )

      // Ventas de la semana
      const weekAgoStr = getBuenosAiresDateString(weekAgo)
      const weekResponse = await api.get(
        `/sales?startDate=${weekAgoStr}&limit=1000`
      )
      const weekTotal = weekResponse.data.reduce(
        (sum, sale) => sum + parseFloat(sale.total_amount),
        0
      )

      // Ventas del mes
      const monthAgoStr = getBuenosAiresDateString(monthAgo)
      const monthResponse = await api.get(
        `/sales?startDate=${monthAgoStr}&limit=1000`
      )
      const monthTotal = monthResponse.data.reduce(
        (sum, sale) => sum + parseFloat(sale.total_amount),
        0
      )

      // Listas pendientes
      const listsResponse = await api.get('/order-lists?status=pending&limit=1000')
      const pendingLists = listsResponse.data.filter((list) => list.status === 'pending').length

      const statsData = {
        todaySales: todayTotal,
        todayCount: todaySales.length,
        weekSales: weekTotal,
        monthSales: monthTotal,
        pendingLists,
      }

      setStats(statsData)
    } catch (error) {
      error('Error al cargar las estadísticas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-200 border-t-primary-600"></div>
      </div>
    )
  }

  const quickActions = [
    {
      name: 'Nueva Venta',
      href: '/sales',
      icon: ShoppingCart,
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100/50',
    },
    {
      name: 'Cierre de Caja',
      href: '/cash-closure',
      icon: Wallet,
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100/50',
    },
    {
      name: 'Listas de Pedidos',
      href: '/order-lists',
      icon: List,
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100/50',
    },
    {
      name: 'Estadísticas',
      href: '/statistics',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100/50',
    },
  ]

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Resumen general del sistema</p>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow-soft rounded-xl border border-gray-100 hover:shadow-soft-lg transition-shadow duration-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Ventas de Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.todaySales.toFixed(2)}
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-soft rounded-xl border border-gray-100 hover:shadow-soft-lg transition-shadow duration-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Cantidad de Ventas Hoy</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayCount}</p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-soft rounded-xl border border-gray-100 hover:shadow-soft-lg transition-shadow duration-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Ventas Semanales</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.weekSales.toFixed(2)}
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-soft rounded-xl border border-gray-100 hover:shadow-soft-lg transition-shadow duration-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Listas Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingLists}</p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <List className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ventas mensuales */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 mb-8 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Resumen Mensual</h2>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
              ${stats.monthSales.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">Total facturado este mes</p>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Acciones Rápidas</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.name}
                  to={action.href}
                  className={`group relative bg-gradient-to-br ${action.bgGradient} p-6 rounded-xl border border-gray-200 hover:border-transparent hover:shadow-soft-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                        {action.name}
                      </h3>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
