import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import BarcodeLabel from '../components/BarcodeLabel'
import BarcodeLabelSheet from '../components/BarcodeLabelSheet'
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
  CheckSquare,
  Square,
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
  const [printingItems, setPrintingItems] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [showManualProductModal, setShowManualProductModal] = useState(false)
  const [manualProduct, setManualProduct] = useState({
    item_name: '',
    barcode: '',
    brand: '',
    code: '',
    quantity: 1,
  })
  const [foundProduct, setFoundProduct] = useState(null)
  const [barcodeInputManual, setBarcodeInputManual] = useState('')
  const [barcodeTimeoutManual, setBarcodeTimeoutManual] = useState(null)
  const [searchingBarcodeManual, setSearchingBarcodeManual] = useState(false)
  const [highlightedProductId, setHighlightedProductId] = useState(null)
  const productRowRefs = useRef({})

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
      setSelectedItems(prev => prev.filter(id => id !== itemId))
      success('Producto eliminado del stock')
    } catch (err) {
      console.error('Error al eliminar item de stock:', err)
      error('Error al eliminar el producto')
    }
  }

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId)
      } else {
        return [...prev, itemId]
      }
    })
  }

  const handleSelectAll = () => {
    if (selectedItems.length === stockItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(stockItems.map(item => item.id))
    }
  }

  const handlePrintSelected = () => {
    if (selectedItems.length === 0) {
      error('No hay productos seleccionados')
      return
    }
    
    const itemsToPrint = stockItems.filter(item => 
      selectedItems.includes(item.id) && item.barcode
    )
    
    if (itemsToPrint.length === 0) {
      error('Los productos seleccionados no tienen código de barras')
      return
    }
    
    if (itemsToPrint.length < selectedItems.length) {
      const withoutBarcode = selectedItems.length - itemsToPrint.length
      error(`${withoutBarcode} producto(s) seleccionado(s) no tienen código de barras y fueron omitidos`)
    }
    
    setPrintingItems(itemsToPrint)
  }

  const handleBarcodeScanManual = useCallback(async (barcode) => {
    if (!barcode) return

    try {
      setSearchingBarcodeManual(true)
      setBarcodeInputManual(barcode)
      
      const response = await api.get(`/stock/barcode/${barcode}`)
      const product = response.data
      
      // Producto encontrado - modo edición (sumar cantidad)
      setFoundProduct(product)
      setManualProduct({
        item_name: product.item_name,
        barcode: product.barcode,
        brand: product.brand || '',
        code: product.code || '',
        quantity: 1,
      })
      success('Producto encontrado. Se sumará la cantidad al stock existente.')
    } catch (err) {
      if (err.response?.status === 404) {
        // Producto no encontrado - modo creación (nuevo producto)
        setFoundProduct(null)
        setManualProduct({
          item_name: '',
          barcode: barcode,
          brand: '',
          code: '',
          quantity: 1,
        })
        success('Producto no encontrado. Completa los datos para crear uno nuevo.')
      } else {
        error('Error al buscar el producto')
      }
    } finally {
      setSearchingBarcodeManual(false)
    }
  }, [success, error])

  // Función para buscar y resaltar producto por código de barras en la tabla
  const handleBarcodeSearchInTable = useCallback(async (barcode) => {
    if (!barcode || activeTab !== 'stock' || showManualProductModal) return

    try {
      // Buscar el producto en la lista actual de stockItems
      let product = stockItems.find(item => item.barcode === barcode)
      
      if (product) {
        // Resaltar el producto
        setHighlightedProductId(product.id)
        
        // Hacer scroll hasta la fila del producto
        setTimeout(() => {
          const rowElement = productRowRefs.current[product.id]
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        
        // Quitar el resaltado después de 3 segundos
        setTimeout(() => {
          setHighlightedProductId(null)
        }, 3000)
        
        success(`Producto encontrado: ${product.item_name}`)
      } else {
        // Si no está en la lista actual, buscar en el servidor
        try {
          const response = await api.get(`/stock/barcode/${barcode}`)
          const foundProduct = response.data
          
          // Si el producto existe pero no está en la lista actual, limpiar búsqueda y recargar
          if (foundProduct) {
            setSearchTerm('')
            await fetchStock()
            
            // Esperar un momento para que se cargue la lista y luego buscar de nuevo
            setTimeout(async () => {
              const response = await api.get('/stock')
              const updatedItems = response.data || []
              const updatedProduct = updatedItems.find(item => item.barcode === barcode)
              
              if (updatedProduct) {
                setStockItems(updatedItems)
                setHighlightedProductId(updatedProduct.id)
                
                setTimeout(() => {
                  const rowElement = productRowRefs.current[updatedProduct.id]
                  if (rowElement) {
                    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }, 100)
                
                setTimeout(() => {
                  setHighlightedProductId(null)
                }, 3000)
                
                success(`Producto encontrado: ${updatedProduct.item_name}`)
              } else {
                error('Producto no encontrado en el stock')
              }
            }, 500)
          }
        } catch (err) {
          if (err.response?.status === 404) {
            error('Producto no encontrado en el stock')
          } else {
            error('Error al buscar el producto')
          }
        }
      }
    } catch (err) {
      error('Error al buscar el producto')
    }
  }, [activeTab, showManualProductModal, stockItems, success, error, fetchStock])

  // Capturar código de barras cuando el modal está abierto
  useEffect(() => {
    if (!showManualProductModal) return

    let currentBarcode = ''
    let timeout = null

    const handleKeyPress = (e) => {
      // Si estamos escribiendo en un input visible, no capturar
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'hidden') {
        return
      }

      // Los scanners de código de barras envían caracteres rápidamente seguidos de Enter
      if (e.key === 'Enter' && currentBarcode.trim().length > 0) {
        e.preventDefault()
        handleBarcodeScanManual(currentBarcode.trim())
        currentBarcode = ''
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        return
      }

      // Acumular caracteres del código de barras
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        currentBarcode += e.key
        
        // Limpiar timeout anterior
        if (timeout) {
          clearTimeout(timeout)
        }

        // Si no hay más caracteres en 100ms, procesar el código
        timeout = setTimeout(() => {
          if (currentBarcode.trim().length > 0) {
            handleBarcodeScanManual(currentBarcode.trim())
            currentBarcode = ''
          }
          timeout = null
        }, 100)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [showManualProductModal, handleBarcodeScanManual])

  // Capturar código de barras cuando estamos en la pestaña Stock y el modal NO está abierto
  useEffect(() => {
    if (activeTab !== 'stock' || showManualProductModal) return

    let currentBarcode = ''
    let timeout = null

    const handleKeyPress = (e) => {
      // Si estamos escribiendo en un input visible (como el buscador), no capturar
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'hidden') {
        // Si es el input de búsqueda y tiene foco, permitir escribir normalmente
        return
      }

      // Los scanners de código de barras envían caracteres rápidamente seguidos de Enter
      if (e.key === 'Enter' && currentBarcode.trim().length > 0) {
        e.preventDefault()
        handleBarcodeSearchInTable(currentBarcode.trim())
        currentBarcode = ''
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        return
      }

      // Acumular caracteres del código de barras
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        currentBarcode += e.key
        
        // Limpiar timeout anterior
        if (timeout) {
          clearTimeout(timeout)
        }

        // Si no hay más caracteres en 100ms, procesar el código
        timeout = setTimeout(() => {
          if (currentBarcode.trim().length > 0) {
            handleBarcodeSearchInTable(currentBarcode.trim())
            currentBarcode = ''
          }
          timeout = null
        }, 100)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [activeTab, showManualProductModal, handleBarcodeSearchInTable])

  const handleAddManualProduct = async () => {
    if (!manualProduct.barcode) {
      error('Código de barras requerido')
      return
    }

    // Si no existe el producto, requiere nombre
    if (!foundProduct && !manualProduct.item_name) {
      error('El nombre del producto es requerido para crear uno nuevo')
      return
    }

    try {
      await api.post('/stock', {
        item_name: manualProduct.item_name,
        barcode: manualProduct.barcode,
        brand: manualProduct.brand || null,
        code: manualProduct.code || null,
        quantity: parseInt(manualProduct.quantity) || 1,
      })
      
      setShowManualProductModal(false)
      setManualProduct({
        item_name: '',
        barcode: '',
        brand: '',
        code: '',
        quantity: 1,
      })
      setFoundProduct(null)
      setBarcodeInputManual('')
      await fetchStock()
      success(foundProduct ? 'Cantidad agregada al stock correctamente' : 'Producto creado y agregado al stock correctamente')
    } catch (err) {
      error(err.response?.data?.error || 'Error al agregar el producto')
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Stock Actual</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Productos confirmados con código de barras
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {selectedItems.length > 0 && (
                    <button
                      onClick={handlePrintSelected}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir {selectedItems.length} Seleccionado(s)
                    </button>
                  )}
                  <button
                    onClick={() => setShowManualProductModal(true)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Producto
                  </button>
                </div>
              </div>
            </div>
            
            {/* Barra de selección múltiple */}
            {selectedItems.length > 0 && (
              <div className="px-6 py-3 bg-primary-50 border-b border-primary-200 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-primary-900">
                    {selectedItems.length} producto(s) seleccionado(s)
                  </span>
                  <button
                    onClick={() => setSelectedItems([])}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Deseleccionar todo
                  </button>
                </div>
              </div>
            )}

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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center"
                          title="Seleccionar todas"
                        >
                          {selectedItems.length === stockItems.length && stockItems.length > 0 ? (
                            <CheckSquare className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
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
                    {stockItems.map((item) => {
                      const isSelected = selectedItems.includes(item.id)
                      return (
                        <tr 
                          key={item.id} 
                          ref={(el) => {
                            if (el) {
                              productRowRefs.current[item.id] = el
                            }
                          }}
                          className={`hover:bg-gray-50 transition-all duration-300 ${
                            highlightedProductId === item.id 
                              ? 'bg-yellow-100 ring-2 ring-yellow-400 ring-offset-2 shadow-lg' 
                              : ''
                          } ${isSelected ? 'bg-primary-50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleSelectItem(item.id)}
                              className="flex items-center"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-primary-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </td>
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
      
      {/* Modal de impresión de etiqueta individual */}
      {printingItem && (
        <BarcodeLabel
          item={printingItem}
          onClose={() => setPrintingItem(null)}
        />
      )}

      {/* Modal de impresión de múltiples etiquetas */}
      {printingItems && (
        <BarcodeLabelSheet
          items={printingItems}
          onClose={() => setPrintingItems(null)}
        />
      )}

      {/* Modal para agregar producto manualmente */}
      {showManualProductModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="manual-product-modal" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowManualProductModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-soft-lg transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100">
              <div className="bg-white px-6 pt-6 pb-4">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Agregar Producto al Stock
                </h3>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    📷 Escanea el código de barras del producto para agregarlo automáticamente
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Código de Barras *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={barcodeInputManual}
                      onChange={(e) => {
                        setBarcodeInputManual(e.target.value)
                        if (e.target.value.trim().length > 0) {
                          // Si se escribe manualmente, buscar después de un delay
                          if (barcodeTimeoutManual) {
                            clearTimeout(barcodeTimeoutManual)
                          }
                          const timeout = setTimeout(() => {
                            if (e.target.value.trim().length > 0) {
                              handleBarcodeScanManual(e.target.value.trim())
                            }
                          }, 500)
                          setBarcodeTimeoutManual(timeout)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && barcodeInputManual.trim().length > 0) {
                          e.preventDefault()
                          handleBarcodeScanManual(barcodeInputManual.trim())
                        }
                      }}
                      placeholder="Escanea o ingresa código de barras"
                      disabled={searchingBarcodeManual}
                    />
                    {searchingBarcodeManual && (
                      <p className="mt-1 text-xs text-gray-500">Buscando producto...</p>
                    )}
                  </div>

                  {foundProduct ? (
                    <>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-700 mb-3">Producto encontrado:</p>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-semibold text-gray-600">Nombre:</span>
                            <p className="text-sm text-gray-900">{manualProduct.item_name}</p>
                          </div>
                          {manualProduct.brand && (
                            <div>
                              <span className="text-xs font-semibold text-gray-600">Marca:</span>
                              <p className="text-sm text-gray-900">{manualProduct.brand}</p>
                            </div>
                          )}
                          {manualProduct.code && (
                            <div>
                              <span className="text-xs font-semibold text-gray-600">Código:</span>
                              <p className="text-sm text-gray-900">{manualProduct.code}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-semibold text-gray-600">Código de Barras:</span>
                            <p className="text-sm font-mono text-gray-900">{manualProduct.barcode}</p>
                          </div>
                          {foundProduct.quantity > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-gray-600">Stock actual:</span>
                              <p className="text-sm text-gray-900">{foundProduct.quantity} unidades</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Cantidad a Agregar *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={manualProduct.quantity}
                          onChange={(e) => setManualProduct({ ...manualProduct, quantity: e.target.value })}
                          placeholder="1"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Esta cantidad se sumará al stock existente del producto
                        </p>
                      </div>
                    </>
                  ) : manualProduct.barcode ? (
                    <>
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-medium text-yellow-700 mb-3">Producto no encontrado. Completa los datos para crear uno nuevo:</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nombre del Producto *
                        </label>
                        <input
                          type="text"
                          required
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={manualProduct.item_name}
                          onChange={(e) => setManualProduct({ ...manualProduct, item_name: e.target.value })}
                          placeholder="Ej: Filtro de aceite"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Marca
                          </label>
                          <input
                            type="text"
                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            value={manualProduct.brand}
                            onChange={(e) => setManualProduct({ ...manualProduct, brand: e.target.value })}
                            placeholder="Ej: VW"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Código
                          </label>
                          <input
                            type="text"
                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            value={manualProduct.code}
                            onChange={(e) => setManualProduct({ ...manualProduct, code: e.target.value })}
                            placeholder="Código interno"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Cantidad Inicial *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={manualProduct.quantity}
                          onChange={(e) => setManualProduct({ ...manualProduct, quantity: e.target.value })}
                          placeholder="1"
                        />
                      </div>
                    </>
                  ) : !searchingBarcodeManual && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                      <p className="text-sm text-gray-500">
                        Escanea un código de barras para buscar el producto
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleAddManualProduct}
                  disabled={!manualProduct.barcode || searchingBarcodeManual || (!foundProduct && !manualProduct.item_name)}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-base font-medium text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                >
                  {foundProduct ? 'Agregar Cantidad' : 'Crear Producto'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualProductModal(false)
                    setManualProduct({
                      item_name: '',
                      barcode: '',
                      brand: '',
                      code: '',
                      quantity: 1,
                    })
                    setFoundProduct(null)
                    setBarcodeInputManual('')
                    if (barcodeTimeoutManual) {
                      clearTimeout(barcodeTimeoutManual)
                    }
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-5 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 sm:mt-0 sm:ml-3 sm:w-auto"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
