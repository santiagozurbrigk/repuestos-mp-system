import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import BarcodeLabel from '../components/BarcodeLabel'
import {
  Package,
  PackageCheck,
  Barcode,
  CheckCircle2,
  Trash2,
  Search,
  Plus,
  Minus,
  Printer,
} from 'lucide-react'

export default function Stock() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [activeTab, setActiveTab] = useState('pending') // 'pending' o 'stock'
  const [pendingItems, setPendingItems] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [generatingBarcode, setGeneratingBarcode] = useState(null)
  const [confirmingItem, setConfirmingItem] = useState(null)
  const [printingItem, setPrintingItem] = useState(null)

  useEffect(() => {
    fetchPendingStock()
    fetchStock()
  }, [])

  const fetchPendingStock = async () => {
    try {
      setLoading(true)
      const response = await api.get('/stock/pending')
      setPendingItems(response.data || [])
    } catch (err) {
      console.error('Error al obtener stock pendiente:', err)
      error('Error al cargar el stock pendiente')
    } finally {
      setLoading(false)
    }
  }

  const fetchStock = async () => {
    try {
      const response = await api.get(`/stock${searchTerm ? `?search=${searchTerm}` : ''}`)
      setStockItems(response.data || [])
    } catch (err) {
      console.error('Error al obtener stock:', err)
      error('Error al cargar el stock')
    }
  }

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStock()
    }
  }, [searchTerm, activeTab])

  const handleGenerateBarcode = async (itemId) => {
    try {
      setGeneratingBarcode(itemId)
      const response = await api.put(`/stock/pending/${itemId}/generate-barcode`)
      setPendingItems((prev) =>
        prev.map((item) => (item.id === itemId ? response.data : item))
      )
      success('Código de barras generado correctamente')
    } catch (err) {
      console.error('Error al generar código de barras:', err)
      error('Error al generar el código de barras')
    } finally {
      setGeneratingBarcode(null)
    }
  }

  const handleConfirmItem = async (itemId) => {
    try {
      setConfirmingItem(itemId)
      await api.put(`/stock/pending/${itemId}/confirm`)
      await fetchPendingStock()
      await fetchStock()
      success('Producto confirmado y agregado al stock')
    } catch (err) {
      console.error('Error al confirmar item:', err)
      error('Error al confirmar el producto')
    } finally {
      setConfirmingItem(null)
    }
  }

  const handleDeletePending = async (itemId) => {
    const confirmed = await confirm(
      '¿Eliminar este producto del stock pendiente?',
      'Esta acción no se puede deshacer.'
    )
    if (!confirmed) return

    try {
      await api.delete(`/stock/pending/${itemId}`)
      await fetchPendingStock()
      success('Producto eliminado del stock pendiente')
    } catch (err) {
      console.error('Error al eliminar item pendiente:', err)
      error('Error al eliminar el producto')
    }
  }

  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 0) return

    try {
      await api.put(`/stock/${itemId}/quantity`, { quantity: newQuantity })
      await fetchStock()
      success('Cantidad actualizada correctamente')
    } catch (err) {
      console.error('Error al actualizar cantidad:', err)
      error('Error al actualizar la cantidad')
    }
  }

  const handleDeleteStock = async (itemId) => {
    const confirmed = await confirm(
      '¿Eliminar este producto del stock?',
      'Esta acción no se puede deshacer.'
    )
    if (!confirmed) return

    try {
      await api.delete(`/stock/${itemId}`)
      await fetchStock()
      success('Producto eliminado del stock')
    } catch (err) {
      console.error('Error al eliminar item de stock:', err)
      error('Error al eliminar el producto')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Stock</h1>
        <p className="text-gray-600">Gestiona el inventario de productos</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <Package className="w-4 h-4" />
            <span>Stock Pendiente</span>
            {pendingItems.length > 0 && (
              <span className="ml-2 bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`${
              activeTab === 'stock'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Stock</span>
          </button>
        </nav>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'pending' ? (
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-lg font-semibold text-gray-900">Productos Pendientes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Productos escaneados de facturas que requieren código de barras
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos pendientes</h3>
              <p className="mt-1 text-sm text-gray-500">
                Los productos escaneados de facturas aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Marca
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Código de Barras
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{item.code || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{item.brand || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.barcode ? (
                          <div className="flex items-center space-x-2">
                            <Barcode className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-mono text-gray-900">{item.barcode}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Sin código</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {!item.barcode ? (
                            <button
                              onClick={() => handleGenerateBarcode(item.id)}
                              disabled={generatingBarcode === item.id}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {generatingBarcode === item.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                  Generando...
                                </>
                              ) : (
                                <>
                                  <Barcode className="w-3 h-3 mr-1" />
                                  Generar Código
                                </>
                              )}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setPrintingItem(item)}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                              >
                                <Printer className="w-3 h-3 mr-1" />
                                Imprimir
                              </button>
                              <button
                                onClick={() => handleConfirmItem(item.id)}
                                disabled={confirmingItem === item.id}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {confirmingItem === item.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                    Confirmando...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Confirmar
                                  </>
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeletePending(item.id)}
                            className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Barra de búsqueda */}
          <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, código, marca o código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tabla de stock */}
          <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-900">Stock Actual</h2>
              <p className="text-sm text-gray-500 mt-1">
                Productos confirmados con código de barras
              </p>
            </div>

            {stockItems.length === 0 ? (
              <div className="p-12 text-center">
                <PackageCheck className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos en stock</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Confirma productos del stock pendiente para agregarlos aquí.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Marca
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Código de Barras
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{item.code || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{item.brand || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Barcode className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-mono text-gray-900">{item.barcode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-gray-900 w-12 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setPrintingItem(item)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                              <Printer className="w-3 h-3 mr-1" />
                              Imprimir
                            </button>
                            <button
                              onClick={() => handleDeleteStock(item.id)}
                              className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog />
      
      {/* Modal de impresión de etiqueta */}
      {printingItem && (
        <BarcodeLabel
          item={printingItem}
          onClose={() => setPrintingItem(null)}
        />
      )}
    </div>
  )
}
