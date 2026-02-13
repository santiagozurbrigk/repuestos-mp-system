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
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
  expenses: 'Gastos Varios',
  freight: 'Flete',
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
  const [scannedProducts, setScannedProducts] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeTimeout, setBarcodeTimeout] = useState(null)
  const [showManualProductModal, setShowManualProductModal] = useState(false)
  const [manualProduct, setManualProduct] = useState({
    item_name: '',
    barcode: '',
    brand: '',
    code: '',
    unit_price: '',
    quantity: 1,
    useExistingBarcode: false,
  })
  const [generatingBarcode, setGeneratingBarcode] = useState(false)
  const [searchingBarcode, setSearchingBarcode] = useState(false)

  const isExpense = (method) => {
    return method === 'expenses' || method === 'freight'
  }

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
        setScannedProducts([])
        setBarcodeInput('')
        setShowModal(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal])

  // Capturar código de barras cuando el modal está abierto
  useEffect(() => {
    if (!showModal || editingSale) return

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
        handleBarcodeScan(currentBarcode.trim())
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
            handleBarcodeScan(currentBarcode.trim())
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
  }, [showModal, editingSale])

  const handleBarcodeScan = async (barcode) => {
    try {
      const response = await api.get(`/stock/barcode/${barcode}`)
      const product = response.data

      // Verificar si el producto ya está en la lista
      const existingIndex = scannedProducts.findIndex(p => p.stock_id === product.id)
      
      if (existingIndex >= 0) {
        // Si ya existe, incrementar cantidad vendida
        const updated = [...scannedProducts]
        const currentStock = updated[existingIndex].available_stock
        const newSoldQuantity = updated[existingIndex].sold_quantity + 1
        
        if (newSoldQuantity > currentStock) {
          error(`No hay suficiente stock. Disponible: ${currentStock}`)
          return
        }
        
        updated[existingIndex] = {
          ...updated[existingIndex],
          sold_quantity: newSoldQuantity,
        }
        setScannedProducts(updated)
      } else {
        // Si no existe, agregarlo con cantidad 1 y precio unitario (se puede editar)
        setScannedProducts([...scannedProducts, {
          stock_id: product.id,
          item_name: product.item_name,
          brand: product.brand,
          code: product.code,
          barcode: product.barcode,
          available_stock: product.quantity, // Stock disponible
          sold_quantity: 1, // Cantidad a vender
          unit_price: 0, // El usuario debe ingresar el precio
        }])
      }

      // Actualizar el total
      updateTotalFromProducts()
    } catch (err) {
      if (err.response?.status === 404) {
        error('Producto no encontrado o sin stock disponible')
      } else {
        error('Error al buscar el producto')
      }
    }
  }

  useEffect(() => {
    if (scannedProducts.length > 0) {
      const total = scannedProducts.reduce((sum, product) => {
        return sum + (parseFloat(product.unit_price || 0) * product.sold_quantity)
      }, 0)
      setFormData(prev => ({ ...prev, total_amount: total.toFixed(2) }))
    } else if (!editingSale) {
      // Si no hay productos y no estamos editando, limpiar el total
      setFormData(prev => ({ ...prev, total_amount: '' }))
    }
  }, [scannedProducts, editingSale])

  const handleProductQuantityChange = (index, newQuantity) => {
    const quantity = parseInt(newQuantity)
    if (quantity < 1) return
    
    const updated = [...scannedProducts]
    const product = updated[index]
    
    // Solo validar stock si no es producto manual
    if (!product.is_manual && quantity > product.available_stock) {
      error(`No hay suficiente stock. Disponible: ${product.available_stock}`)
      return
    }
    
    updated[index] = { ...updated[index], sold_quantity: quantity }
    setScannedProducts(updated)
  }

  const handleProductPriceChange = (index, newPrice) => {
    const updated = [...scannedProducts]
    updated[index] = { ...updated[index], unit_price: parseFloat(newPrice || 0) }
    setScannedProducts(updated)
  }

  const handleRemoveProduct = (index) => {
    const updated = scannedProducts.filter((_, i) => i !== index)
    setScannedProducts(updated)
  }

  const handleGenerateBarcode = async () => {
    try {
      setGeneratingBarcode(true)
      const response = await api.get('/stock/generate-barcode')
      setManualProduct({ ...manualProduct, barcode: response.data.barcode })
      success('Código de barras generado correctamente')
    } catch (err) {
      error('Error al generar el código de barras')
    } finally {
      setGeneratingBarcode(false)
    }
  }

  const handleSearchExistingBarcode = async () => {
    if (!manualProduct.barcode) {
      error('Ingresa un código de barras para buscar')
      return
    }

    try {
      setSearchingBarcode(true)
      const response = await api.get(`/stock/barcode/${manualProduct.barcode}`)
      const product = response.data
      
      setManualProduct({
        ...manualProduct,
        item_name: product.item_name,
        brand: product.brand || '',
        code: product.code || '',
        quantity: Math.min(manualProduct.quantity, product.quantity),
      })
      success('Producto encontrado')
    } catch (err) {
      if (err.response?.status === 404) {
        error('Producto no encontrado con ese código de barras')
      } else {
        error('Error al buscar el producto')
      }
    } finally {
      setSearchingBarcode(false)
    }
  }

  const handleAddManualProduct = () => {
    if (!manualProduct.item_name) {
      error('El nombre del producto es requerido')
      return
    }

    if (!manualProduct.barcode) {
      error('Debes generar o buscar un código de barras')
      return
    }

    if (!manualProduct.unit_price || parseFloat(manualProduct.unit_price) <= 0) {
      error('El precio unitario es requerido')
      return
    }

    // Verificar si ya existe en la lista
    const existingIndex = scannedProducts.findIndex(p => p.barcode === manualProduct.barcode)
    
    if (existingIndex >= 0) {
      error('Este producto ya está en la lista')
      return
    }

    // Agregar producto manual (sin stock_id porque no está en stock)
    const newProduct = {
      stock_id: null, // Producto manual, no tiene stock_id
      item_name: manualProduct.item_name,
      brand: manualProduct.brand,
      code: manualProduct.code,
      barcode: manualProduct.barcode,
      available_stock: 999999, // Stock ilimitado para productos manuales
      sold_quantity: parseInt(manualProduct.quantity),
      unit_price: parseFloat(manualProduct.unit_price),
      is_manual: true, // Marcar como producto manual
    }

    setScannedProducts([...scannedProducts, newProduct])
    setShowManualProductModal(false)
    setManualProduct({
      item_name: '',
      barcode: '',
      brand: '',
      code: '',
      unit_price: '',
      quantity: 1,
      useExistingBarcode: false,
    })
    success('Producto agregado correctamente')
  }

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
        // Si hay productos escaneados, enviarlos junto con la venta
      const saleData = {
        ...formData,
        products: scannedProducts.length > 0 ? scannedProducts.map(p => ({
          stock_id: p.stock_id, // Puede ser null para productos manuales
          quantity: p.sold_quantity,
          unit_price: p.unit_price || 0,
          barcode: p.barcode,
          item_name: p.item_name,
        })) : undefined,
      }
      await api.post('/sales', saleData)
      }
      setShowModal(false)
      setEditingSale(null)
      setFormData({
        total_amount: '',
        payment_method: 'cash',
        observations: '',
        date: formatDateTimeLocal(),
      })
      setScannedProducts([])
      setBarcodeInput('')
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
      return saleDateStr === todayStr && !isExpense(sale.payment_method)
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
    debit: 'bg-green-100 text-green-700 border-green-200',
    credit: 'bg-purple-100 text-purple-700 border-purple-200',
    transfer: 'bg-teal-100 text-teal-700 border-teal-200',
    expenses: 'bg-red-100 text-red-700 border-red-200',
    freight: 'bg-orange-100 text-orange-700 border-orange-200',
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
            setScannedProducts([])
            setBarcodeInput('')
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
                  {!editingSale && (
                    <div className="mb-4 space-y-2">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          📷 Escanea códigos de barras para agregar productos automáticamente
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowManualProductModal(true)}
                        className="w-full px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        + Agregar Producto Manualmente
                      </button>
                    </div>
                  )}
                  
                  {/* Lista de productos escaneados */}
                  {!editingSale && scannedProducts.length > 0 && (
                    <div className="mb-5">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Productos Escaneados
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {scannedProducts.map((product, index) => (
                          <div key={index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {product.item_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {product.brand && `Marca: ${product.brand} | `}
                                {product.is_manual ? 'Producto manual' : `Stock disponible: ${product.available_stock}`}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Precio"
                                value={product.unit_price || ''}
                                onChange={(e) => handleProductPriceChange(index, e.target.value)}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                              />
                              <input
                                type="number"
                                min="1"
                                max={product.is_manual ? undefined : product.available_stock}
                                value={product.sold_quantity}
                                onChange={(e) => handleProductQuantityChange(index, e.target.value)}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveProduct(index)}
                                className="p-1 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Monto Total *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        autoFocus={scannedProducts.length === 0}
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                        value={formData.total_amount}
                        onChange={(e) =>
                          setFormData({ ...formData, total_amount: e.target.value })
                        }
                        placeholder="0.00"
                        disabled={scannedProducts.length > 0}
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
                      {scannedProducts.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          El total se calcula automáticamente desde los productos escaneados
                        </p>
                      )}
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
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {(formData.payment_method === 'expenses' || formData.payment_method === 'freight') && (
                        <p className="mt-2 text-sm text-red-600">
                          ⚠️ Este registro se restará del total de caja (egreso)
                        </p>
                      )}
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

      {/* Modal para agregar producto manualmente */}
      {showManualProductModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="manual-product-modal" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowManualProductModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-soft-lg transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100">
              <div className="bg-white px-6 pt-6 pb-4">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Agregar Producto Manualmente
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={manualProduct.item_name}
                      onChange={(e) => setManualProduct({ ...manualProduct, item_name: e.target.value })}
                      placeholder="Ej: Filtro de aceite"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Código de Barras *
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        required
                        className="flex-1 border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={manualProduct.barcode}
                        onChange={(e) => setManualProduct({ ...manualProduct, barcode: e.target.value })}
                        placeholder="Código de barras"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        disabled={generatingBarcode}
                        className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {generatingBarcode ? '...' : 'Generar'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSearchExistingBarcode}
                        disabled={searchingBarcode || !manualProduct.barcode}
                        className="px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {searchingBarcode ? '...' : 'Buscar'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Genera un código nuevo o busca uno existente en el stock
                    </p>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Precio Unitario *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={manualProduct.unit_price}
                        onChange={(e) => setManualProduct({ ...manualProduct, unit_price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Cantidad *
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
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleAddManualProduct}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-base font-medium text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 sm:ml-3 sm:w-auto"
                >
                  Agregar
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
                      unit_price: '',
                      quantity: 1,
                      useExistingBarcode: false,
                    })
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
