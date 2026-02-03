import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import {
  Package,
  Barcode,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getBuenosAiresDateString } from '../utils/dateHelpers'

export default function MerchandiseOut() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [merchandiseOut, setMerchandiseOut] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    supplier_id: '',
    barcode: '',
    invoice_number: '',
    invoice_date: getBuenosAiresDateString(),
    due_date: '',
    total_amount: '',
    is_paid: false,
    payment_date: '',
    payment_method: 'cash',
    observations: '',
    items: [],
  })
  const [editingId, setEditingId] = useState(null)
  const barcodeInputRef = useRef(null)

  useEffect(() => {
    fetchMerchandiseOut()
    fetchSuppliers()
  }, [])

  useEffect(() => {
    // Auto-focus en el input de código de barras cuando no hay formulario abierto
    if (!showForm && barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [showForm])

  const fetchMerchandiseOut = async () => {
    try {
      setLoading(true)
      const response = await api.get('/merchandise-out?limit=1000')
      setMerchandiseOut(response.data)
    } catch (err) {
      error('Error al cargar los egresos de mercadería')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers?limit=1000')
      setSuppliers(response.data)
    } catch (err) {
      // Error silencioso
    }
  }

  const handleBarcodeScan = async (barcode) => {
    if (!barcode || barcode.trim() === '') return

    setScanning(true)
    try {
      // Procesar el código de barras
      const response = await api.post('/merchandise-out/process-barcode', { barcode: barcode.trim() })

      if (response.data.success) {
        // Cargar los datos extraídos en el formulario
        const decodedData = response.data.data
        setFormData({
          supplier_id: decodedData.supplier_id || '',
          barcode: decodedData.barcode,
          invoice_number: decodedData.invoice_number || '',
          invoice_date: decodedData.invoice_date || getBuenosAiresDateString(),
          due_date: decodedData.due_date || '',
          total_amount: decodedData.total_amount?.toString() || '',
          is_paid: decodedData.is_paid || false,
          payment_date: decodedData.payment_date || '',
          payment_method: decodedData.payment_method || 'cash',
          observations: decodedData.observations || '',
          items: decodedData.items || [],
        })
        setShowForm(true)
        setBarcodeInput('')
        success('Código de barras escaneado. Por favor, verifica y completa la información.')
      }
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.existing) {
        // Ya existe un egreso con este código
        error('Este código de barras ya fue escaneado anteriormente')
        setBarcodeInput('')
      } else {
        error('Error al procesar el código de barras')
      }
    } finally {
      setScanning(false)
    }
  }

  const handleBarcodeInputKeyDown = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim() !== '') {
      e.preventDefault()
      handleBarcodeScan(barcodeInput)
    }
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_name: '',
          product_code: '',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          brand: '',
          observations: '',
        },
      ],
    })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = value

    // Calcular total_price si cambia quantity o unit_price
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = parseFloat(newItems[index].quantity || 0)
      const unitPrice = parseFloat(newItems[index].unit_price || 0)
      newItems[index].total_price = quantity * unitPrice
    }

    // Recalcular total_amount
    const totalAmount = newItems.reduce((sum, item) => {
      return sum + parseFloat(item.total_price || 0)
    }, 0)

    setFormData({
      ...formData,
      items: newItems,
      total_amount: totalAmount.toFixed(2),
    })
  }

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    const totalAmount = newItems.reduce((sum, item) => {
      return sum + parseFloat(item.total_price || 0)
    }, 0)

    setFormData({
      ...formData,
      items: newItems,
      total_amount: totalAmount.toFixed(2),
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.barcode || !formData.invoice_number || !formData.invoice_date || !formData.total_amount) {
      error('Por favor completa todos los campos requeridos')
      return
    }

    if (formData.items.length === 0) {
      error('Debe agregar al menos un producto')
      return
    }

    try {
      const data = {
        ...formData,
        supplier_id: formData.supplier_id || null,
        total_amount: parseFloat(formData.total_amount),
        items: formData.items.map((item) => ({
          ...item,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          total_price: parseFloat(item.total_price),
        })),
      }

      if (editingId) {
        await api.put(`/merchandise-out/${editingId}`, data)
        success('Egreso actualizado correctamente')
      } else {
        await api.post('/merchandise-out', data)
        success('Egreso registrado correctamente')
      }

      setShowForm(false)
      setEditingId(null)
      setFormData({
        supplier_id: '',
        barcode: '',
        invoice_number: '',
        invoice_date: getBuenosAiresDateString(),
        due_date: '',
        total_amount: '',
        is_paid: false,
        payment_date: '',
        payment_method: 'cash',
        observations: '',
        items: [],
      })
      setBarcodeInput('')
      fetchMerchandiseOut()
    } catch (err) {
      error('Error al guardar el egreso')
    }
  }

  const handleEdit = (merchandise) => {
    setEditingId(merchandise.id)
    setFormData({
      supplier_id: merchandise.supplier_id || '',
      barcode: merchandise.barcode,
      invoice_number: merchandise.invoice_number,
      invoice_date: merchandise.invoice_date,
      due_date: merchandise.due_date || '',
      total_amount: merchandise.total_amount.toString(),
      is_paid: merchandise.is_paid,
      payment_date: merchandise.payment_date || '',
      payment_method: merchandise.payment_method || 'cash',
      observations: merchandise.observations || '',
      items: merchandise.merchandise_out_items || [],
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Eliminar egreso',
      message: '¿Estás seguro de eliminar este egreso de mercadería? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.delete(`/merchandise-out/${id}`)
      success('Egreso eliminado correctamente')
      fetchMerchandiseOut()
    } catch (err) {
      error('Error al eliminar el egreso')
    }
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      supplier_id: '',
      barcode: '',
      invoice_number: '',
      invoice_date: getBuenosAiresDateString(),
      due_date: '',
      total_amount: '',
      is_paid: false,
      payment_date: '',
      payment_method: 'cash',
      observations: '',
      items: [],
    })
    setBarcodeInput('')
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Egreso de Mercadería</h1>
        <p className="text-gray-600">Escanea códigos de barras de facturas para registrar egresos</p>
      </div>

      {/* Scanner de código de barras */}
      {!showForm && (
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Barcode className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Escanear Código de Barras
              </label>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeInputKeyDown}
                placeholder="Escanea o ingresa el código de barras y presiona Enter"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
                disabled={scanning}
                autoFocus
              />
              {scanning && (
                <p className="mt-2 text-sm text-blue-600">Procesando código de barras...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulario de egreso */}
      {showForm && (
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingId ? 'Editar Egreso' : 'Nuevo Egreso'}
            </h2>
            <button
              onClick={handleCancelForm}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de Barras <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Factura <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Factura <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto Total <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Items de la factura */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Productos de la Factura <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar Producto
                </button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="col-span-12 md:col-span-3">
                      <input
                        type="text"
                        placeholder="Nombre del producto"
                        value={item.product_name}
                        onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <input
                        type="text"
                        placeholder="Código"
                        value={item.product_code}
                        onChange={(e) => handleItemChange(index, 'product_code', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Cant."
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio unit."
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <input
                        type="text"
                        placeholder="Marca"
                        value={item.brand}
                        onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <div className="px-2 py-1.5 text-sm font-semibold text-gray-700">
                        ${parseFloat(item.total_price || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-full p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {formData.items.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay productos agregados. Haz clic en "Agregar Producto" para comenzar.
                </p>
              )}
            </div>

            {/* Checkbox de pago */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_paid"
                checked={formData.is_paid}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_paid: e.target.checked,
                    payment_date: e.target.checked ? getBuenosAiresDateString() : '',
                  })
                }
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="is_paid" className="text-sm font-medium text-gray-700">
                Factura pagada
              </label>
            </div>

            {formData.is_paid && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Pago
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="debit">Débito</option>
                    <option value="credit">Crédito</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={formData.observations}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg hover:from-primary-700 hover:to-primary-800"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de egresos */}
      <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Egresos Registrados</h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {merchandiseOut.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay egresos registrados</h3>
              <p className="mt-1 text-sm text-gray-500">Escanea un código de barras para comenzar.</p>
            </div>
          ) : (
            merchandiseOut.map((merchandise) => (
              <div key={merchandise.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Factura #{merchandise.invoice_number}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Código: {merchandise.barcode} •{' '}
                          {format(new Date(merchandise.invoice_date + 'T03:00:00Z'), 'dd MMM yyyy', {
                            locale: es,
                          })}
                        </p>
                        {merchandise.suppliers && (
                          <p className="text-xs text-gray-600 mt-1">
                            Proveedor: {merchandise.suppliers.name}
                          </p>
                        )}
                      </div>
                      {merchandise.is_paid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Pagada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Pendiente
                        </span>
                      )}
                    </div>
                    <div className="ml-13 mt-2">
                      <p className="text-sm font-semibold text-gray-900">
                        ${parseFloat(merchandise.total_amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {merchandise.merchandise_out_items?.length || 0} productos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(merchandise)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(merchandise.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
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
