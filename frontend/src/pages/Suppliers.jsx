import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  FileText,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Barcode,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getBuenosAiresDateString } from '../utils/dateHelpers'

const paymentMethodLabels = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otros',
}

export default function Suppliers() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [supplierSummary, setSupplierSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [showInvoiceImageModal, setShowInvoiceImageModal] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [extractedData, setExtractedData] = useState(null)
  const [invoiceItems, setInvoiceItems] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })
  const [invoiceFormData, setInvoiceFormData] = useState({
    supplier_id: '',
    invoice_number: '',
    invoice_date: getBuenosAiresDateString(),
    due_date: '',
    amount: '',
    paid_amount: '',
    is_paid: false,
    payment_date: '',
    payment_method: 'cash',
    observations: '',
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    if (selectedSupplier) {
      fetchInvoices(selectedSupplier.id)
      fetchSupplierSummary(selectedSupplier.id)
    }
  }, [selectedSupplier])


  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      error('Solo se permiten archivos de imagen (JPG, PNG) o PDF')
      return
    }

    // Validar tamaño (10MB máximo)
    if (file.size > 10 * 1024 * 1024) {
      error('El archivo es demasiado grande. Máximo 10MB')
      return
    }

    setSelectedImage(file)
    setProcessingImage(true)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await api.post('/suppliers/process-invoice-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.success) {
        const data = response.data.data

        // Cargar proveedores si se creó uno nuevo
        if (data.supplier_id) {
          await fetchSuppliers()
          const { data: updatedSuppliers } = await api.get('/suppliers?limit=1000')
          const foundSupplier = updatedSuppliers.find((s) => s.id === data.supplier_id)
          if (foundSupplier) {
            setSelectedSupplier(foundSupplier)
          }
        }

        // Prellenar formulario de factura
        setInvoiceFormData({
          supplier_id: data.supplier_id || '',
          invoice_number: data.invoice_number || '',
          invoice_date: data.invoice_date || getBuenosAiresDateString(),
          due_date: data.due_date || '',
          amount: data.amount > 0 ? data.amount.toString() : '',
          paid_amount: '',
          is_paid: false,
          payment_date: '',
          payment_method: 'cash',
          observations: '',
        })

        // Guardar items extraídos
        setInvoiceItems(data.items || [])
        setExtractedData(data)

        // Cerrar modal de imagen y abrir modal de factura
        setShowInvoiceImageModal(false)
        setShowInvoiceModal(true)
        setSelectedImage(null)

        success('Factura procesada correctamente. Revisa los datos antes de guardar.')
      }
    } catch (err) {
      if (err.response?.status === 503) {
        error('Servicio de OCR no disponible. Configura las credenciales de Google Cloud.')
      } else if (err.response?.status === 400) {
        error(err.response.data.error || 'No se pudo procesar la imagen. Asegúrate de que sea una factura clara.')
      } else {
        error('Error al procesar la imagen de la factura')
      }
    } finally {
      setProcessingImage(false)
    }
  }

  const handleAddInvoiceItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      {
        item_name: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        description: '',
      },
    ])
  }

  const handleUpdateInvoiceItem = (index, field, value) => {
    const updatedItems = [...invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    }

    // Ya no recalculamos total_price automáticamente
    // El usuario ingresa directamente el total_price

    setInvoiceItems(updatedItems)
  }

  const handleRemoveInvoiceItem = (index) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index))
  }

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/suppliers?limit=1000')
      setSuppliers(response.data)
      if (response.data.length > 0 && !selectedSupplier) {
        setSelectedSupplier(response.data[0])
      }
    } catch (err) {
      error('Error al cargar los proveedores')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoices = async (supplierId) => {
    try {
      const response = await api.get(`/suppliers/invoices?supplier_id=${supplierId}&limit=1000`)
      setInvoices(response.data)
    } catch (err) {
      error('Error al cargar las facturas')
    }
  }

  const fetchSupplierSummary = async (supplierId) => {
    try {
      const response = await api.get(`/suppliers/${supplierId}/summary`)
      setSupplierSummary(response.data)
    } catch (err) {
      // Error silencioso
    }
  }

  const handleSupplierSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, supplierFormData)
        success('Proveedor actualizado correctamente')
      } else {
        await api.post('/suppliers', supplierFormData)
        success('Proveedor creado correctamente')
      }
      setShowSupplierModal(false)
      setEditingSupplier(null)
      setSupplierFormData({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
      })
      fetchSuppliers()
    } catch (err) {
      error('Error al guardar el proveedor')
    }
  }

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault()
    try {
      // Construir objeto de datos limpiando campos vacíos/undefined
      const supplierId = invoiceFormData.supplier_id || selectedSupplier?.id
      if (!supplierId) {
        error('Debes seleccionar un proveedor')
        return
      }

      const data = {
        supplier_id: supplierId,
        invoice_number: invoiceFormData.invoice_number,
        invoice_date: invoiceFormData.invoice_date,
        amount: parseFloat(invoiceFormData.amount),
        is_paid: invoiceFormData.is_paid || false,
      }

      // Solo agregar campos que tienen valor (no vacíos, no undefined, no null)
      if (invoiceFormData.due_date && invoiceFormData.due_date.trim() !== '') {
        data.due_date = invoiceFormData.due_date
      }
      
      if (invoiceFormData.is_paid) {
        if (invoiceFormData.paid_amount && invoiceFormData.paid_amount.toString().trim() !== '') {
          data.paid_amount = parseFloat(invoiceFormData.paid_amount)
        } else {
          data.paid_amount = data.amount
        }
        if (invoiceFormData.payment_date && invoiceFormData.payment_date.trim() !== '') {
          data.payment_date = invoiceFormData.payment_date
        }
        if (invoiceFormData.payment_method && invoiceFormData.payment_method.trim() !== '') {
          data.payment_method = invoiceFormData.payment_method
        }
      } else {
        // Si no está pagada, no enviar payment_date ni payment_method
        data.paid_amount = invoiceFormData.paid_amount && invoiceFormData.paid_amount.toString().trim() !== ''
          ? parseFloat(invoiceFormData.paid_amount)
          : 0
      }
      
      // Solo agregar observations si tiene contenido
      if (invoiceFormData.observations && invoiceFormData.observations.trim() !== '') {
        data.observations = invoiceFormData.observations
      }

      let invoiceId
      if (editingInvoice) {
        const response = await api.put(`/suppliers/invoices/${editingInvoice.id}`, data)
        invoiceId = editingInvoice.id
        success('Factura actualizada correctamente')
      } else {
        const response = await api.post('/suppliers/invoices', data)
        invoiceId = response.data.id
        success('Factura creada correctamente')
      }

      // Guardar items de la factura si hay alguno
      if (invoiceItems.length > 0 && invoiceId) {
        try {
          // Primero eliminar items existentes si estamos editando
          if (editingInvoice) {
            // Obtener items existentes y eliminarlos
            const existingItems = await api.get(`/invoice-items/invoice/${invoiceId}`)
            for (const item of existingItems.data) {
              await api.delete(`/invoice-items/${item.id}`)
            }
          }

          // Crear nuevos items
          const itemsToSave = invoiceItems
            .filter((item) => item.item_name && item.item_name.trim() !== '')
            .map((item) => ({
              item_name: item.item_name,
              quantity: parseFloat(item.quantity || 1),
              unit_price: parseFloat(item.unit_price || 0),
              total_price: parseFloat(item.total_price || 0),
              description: item.description || null,
            }))

          if (itemsToSave.length > 0) {
            await api.post('/invoice-items/bulk', {
              invoice_id: invoiceId,
              items: itemsToSave,
            })
          }
        } catch (err) {
          console.warn('Error al guardar items de factura:', err)
          // No mostrar error al usuario, la factura ya se guardó
        }
      }
      setShowInvoiceModal(false)
      setEditingInvoice(null)
      setInvoiceFormData({
        supplier_id: selectedSupplier?.id || '',
        invoice_number: '',
        invoice_date: getBuenosAiresDateString(),
        due_date: '',
        amount: '',
        paid_amount: '',
        is_paid: false,
        payment_date: '',
        payment_method: 'cash',
        observations: '',
      })
      setInvoiceItems([])
      setExtractedData(null)
      await fetchSuppliers()
      if (selectedSupplier) {
        await fetchInvoices(selectedSupplier.id)
        await fetchSupplierSummary(selectedSupplier.id)
      }
    } catch (err) {
      error('Error al guardar la factura')
    }
  }

  const handleEditSupplier = (supplier) => {
    setEditingSupplier(supplier)
    setSupplierFormData({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    })
    setShowSupplierModal(true)
  }

  const handleEditInvoice = async (invoice) => {
    setEditingInvoice(invoice)
    setInvoiceFormData({
      supplier_id: invoice.supplier_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      amount: invoice.amount.toString(),
      paid_amount: invoice.paid_amount.toString(),
      is_paid: invoice.is_paid,
      payment_date: invoice.payment_date || '',
      payment_method: invoice.payment_method || 'cash',
      observations: invoice.observations || '',
    })

    // Cargar items de la factura
    try {
      const itemsResponse = await api.get(`/invoice-items/invoice/${invoice.id}`)
      setInvoiceItems(itemsResponse.data || [])
    } catch (err) {
      setInvoiceItems([])
    }

    setShowInvoiceModal(true)
  }

  const handleDeleteSupplier = async (id) => {
    const confirmed = await confirm({
      title: 'Eliminar proveedor',
      message: '¿Estás seguro de eliminar este proveedor? También se eliminarán todas sus facturas. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.delete(`/suppliers/${id}`)
      success('Proveedor eliminado correctamente')
      fetchSuppliers()
      if (selectedSupplier?.id === id) {
        setSelectedSupplier(null)
        setInvoices([])
        setSupplierSummary(null)
      }
    } catch (err) {
      error('Error al eliminar el proveedor')
    }
  }

  const handleDeleteInvoice = async (id) => {
    const confirmed = await confirm({
      title: 'Eliminar factura',
      message: '¿Estás seguro de eliminar esta factura? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.delete(`/suppliers/invoices/${id}`)
      success('Factura eliminada correctamente')
      if (selectedSupplier) {
        fetchInvoices(selectedSupplier.id)
        fetchSupplierSummary(selectedSupplier.id)
      }
    } catch (err) {
      error('Error al eliminar la factura')
    }
  }

  const handleToggleInvoicePaid = async (invoice) => {
    try {
      const newIsPaid = !invoice.is_paid
      const updateData = {
        is_paid: newIsPaid,
      }
      
      if (newIsPaid) {
        updateData.paid_amount = parseFloat(invoice.amount)
        updateData.payment_date = getBuenosAiresDateString()
        if (invoice.payment_method) {
          updateData.payment_method = invoice.payment_method
        } else {
          updateData.payment_method = 'cash'
        }
      } else {
        updateData.paid_amount = 0
        updateData.payment_date = null
        updateData.payment_method = null
      }
      
      await api.put(`/suppliers/invoices/${invoice.id}`, updateData)
      success(newIsPaid ? 'Factura marcada como pagada' : 'Factura marcada como no pagada')
      if (selectedSupplier) {
        fetchInvoices(selectedSupplier.id)
        fetchSupplierSummary(selectedSupplier.id)
      }
    } catch (err) {
      error('Error al actualizar la factura')
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
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Proveedores</h1>
          <p className="text-gray-600">Gestiona proveedores y facturas</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setEditingSupplier(null)
              setSupplierFormData({
                name: '',
                contact_name: '',
                phone: '',
                email: '',
                address: '',
                notes: '',
              })
              setShowSupplierModal(true)
            }}
            className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Scanner de código de barras y escaneo completo */}
      {!showInvoiceModal && (
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Escanear Factura Completa
              </label>
              <button
                type="button"
                onClick={() => setShowInvoiceImageModal(true)}
                disabled={processingImage}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingImage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Subir Imagen de Factura</span>
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Extrae automáticamente proveedor, datos y productos de la factura
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Proveedores */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-900">Proveedores</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {suppliers.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay proveedores</h3>
                  <p className="mt-1 text-sm text-gray-500">Comienza agregando tu primer proveedor.</p>
                </div>
              ) : (
                suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    onClick={() => setSelectedSupplier(supplier)}
                    className={`px-6 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors duration-150 ${
                      selectedSupplier?.id === supplier.id ? 'bg-blue-50/50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{supplier.name}</h3>
                        {supplier.contact_name && (
                          <p className="text-xs text-gray-500 mt-1">{supplier.contact_name}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditSupplier(supplier)
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSupplier(supplier.id)
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>

        {/* Detalles del Proveedor y Facturas */}
        <div className="lg:col-span-2">
          {selectedSupplier ? (
            <>
              {/* Resumen del Proveedor */}
              {supplierSummary && (
                <div className="bg-white shadow-soft rounded-xl border border-gray-100 mb-6 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedSupplier.name}</h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200">
                        <div className="text-xs font-semibold text-blue-700 mb-1">Total Facturado</div>
                        <div className="text-xl font-bold text-blue-900">
                          ${parseFloat(supplierSummary.total_amount).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-4 rounded-xl border border-green-200">
                        <div className="text-xs font-semibold text-green-700 mb-1">Total Pagado</div>
                        <div className="text-xl font-bold text-green-900">
                          ${parseFloat(supplierSummary.total_paid).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-red-100/50 p-4 rounded-xl border border-red-200">
                        <div className="text-xs font-semibold text-red-700 mb-1">Pendiente</div>
                        <div className="text-xl font-bold text-red-900">
                          ${parseFloat(supplierSummary.total_pending).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-1">Facturas</div>
                        <div className="text-xl font-bold text-gray-900">{supplierSummary.total_invoices}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {supplierSummary.paid_count} pagas / {supplierSummary.unpaid_count} pendientes
                        </div>
                      </div>
                    </div>

                    {/* Información de contacto */}
                    {(selectedSupplier.phone || selectedSupplier.email || selectedSupplier.address) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {selectedSupplier.phone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="w-4 h-4 mr-2" />
                              {selectedSupplier.phone}
                            </div>
                          )}
                          {selectedSupplier.email && (
                            <div className="flex items-center text-gray-600">
                              <Mail className="w-4 h-4 mr-2" />
                              {selectedSupplier.email}
                            </div>
                          )}
                          {selectedSupplier.address && (
                            <div className="flex items-center text-gray-600">
                              <MapPin className="w-4 h-4 mr-2" />
                              {selectedSupplier.address}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Facturas */}
              <div className="bg-white shadow-soft rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Facturas</h2>
                  <button
                    onClick={() => {
                      setEditingInvoice(null)
                      setInvoiceFormData({
                        supplier_id: selectedSupplier.id,
                        invoice_number: '',
                        invoice_date: getBuenosAiresDateString(),
                        due_date: '',
                        amount: '',
                        paid_amount: '',
                        is_paid: false,
                        payment_date: '',
                        payment_method: 'cash',
                        observations: '',
                      })
                      setShowInvoiceModal(true)
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-lg transition-all duration-200"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Nueva Factura Manual
                  </button>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {invoices.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No hay facturas</h3>
                      <p className="mt-1 text-sm text-gray-500">Comienza agregando la primera factura.</p>
                    </div>
                  ) : (
                    invoices.map((invoice) => {
                      const pendingAmount = parseFloat(invoice.amount) - parseFloat(invoice.paid_amount)
                      return (
                        <div
                          key={invoice.id}
                          className={`px-6 py-4 hover:bg-gray-50/50 transition-colors duration-150 ${
                            invoice.is_paid ? 'bg-green-50/30' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Factura #{invoice.invoice_number}
                                </h3>
                                {invoice.is_paid ? (
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
                              <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {format(new Date(invoice.invoice_date + 'T03:00:00Z'), 'dd MMM yyyy', {
                                    locale: es,
                                  })}
                                </span>
                                {invoice.due_date && (
                                  <span className="flex items-center">
                                    Vence:{' '}
                                    {format(new Date(invoice.due_date + 'T03:00:00Z'), 'dd MMM yyyy', {
                                      locale: es,
                                    })}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center space-x-4">
                                <span className="text-sm font-semibold text-gray-900">
                                  ${parseFloat(invoice.amount).toFixed(2)}
                                </span>
                                {!invoice.is_paid && pendingAmount > 0 && (
                                  <span className="text-xs text-red-600">
                                    Pendiente: ${pendingAmount.toFixed(2)}
                                  </span>
                                )}
                                {invoice.payment_method && invoice.is_paid && (
                                  <span className="text-xs text-gray-500">
                                    {paymentMethodLabels[invoice.payment_method]}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleToggleInvoicePaid(invoice)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  invoice.is_paid
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-gray-400 hover:bg-gray-50'
                                }`}
                                title={invoice.is_paid ? 'Marcar como no pagada' : 'Marcar como pagada'}
                              >
                                {invoice.is_paid ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  <XCircle className="w-5 h-5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEditInvoice(invoice)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteInvoice(invoice.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white shadow-soft rounded-xl border border-gray-100 p-12 text-center">
              <Building2 className="mx-auto h-16 w-16 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Selecciona un proveedor</h3>
              <p className="mt-2 text-sm text-gray-500">Selecciona un proveedor de la lista para ver sus facturas y detalles.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Proveedor */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
            </div>
            <form onSubmit={handleSupplierSubmit} className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Proveedor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierFormData.name}
                    onChange={(e) =>
                      setSupplierFormData({ ...supplierFormData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Contacto</label>
                  <input
                    type="text"
                    value={supplierFormData.contact_name}
                    onChange={(e) =>
                      setSupplierFormData({ ...supplierFormData, contact_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={supplierFormData.phone}
                      onChange={(e) =>
                        setSupplierFormData({ ...supplierFormData, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={supplierFormData.email}
                      onChange={(e) =>
                        setSupplierFormData({ ...supplierFormData, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={supplierFormData.address}
                    onChange={(e) =>
                      setSupplierFormData({ ...supplierFormData, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={supplierFormData.notes}
                    onChange={(e) =>
                      setSupplierFormData({ ...supplierFormData, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierModal(false)
                    setEditingSupplier(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg hover:from-primary-700 hover:to-primary-800"
                >
                  {editingSupplier ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Factura */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingInvoice ? 'Editar Factura' : 'Nueva Factura'}
              </h2>
            </div>
            <form onSubmit={handleInvoiceSubmit} className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={invoiceFormData.supplier_id || selectedSupplier?.id || ''}
                    onChange={(e) => {
                      const supplierId = e.target.value
                      setInvoiceFormData({ ...invoiceFormData, supplier_id: supplierId })
                      // Actualizar selectedSupplier si se selecciona uno diferente
                      if (supplierId) {
                        const supplier = suppliers.find((s) => s.id === supplierId)
                        if (supplier) {
                          setSelectedSupplier(supplier)
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  {!invoiceFormData.supplier_id && !selectedSupplier && (
                    <p className="mt-1 text-xs text-gray-500">
                      Si el proveedor no existe, créalo primero desde el botón "Nuevo Proveedor"
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Factura <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceFormData.invoice_number}
                    onChange={(e) =>
                      setInvoiceFormData({ ...invoiceFormData, invoice_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Factura <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={invoiceFormData.invoice_date}
                      onChange={(e) =>
                        setInvoiceFormData({ ...invoiceFormData, invoice_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={invoiceFormData.due_date}
                      onChange={(e) =>
                        setInvoiceFormData({ ...invoiceFormData, due_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={invoiceFormData.amount}
                    onChange={(e) =>
                      setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_paid"
                    checked={invoiceFormData.is_paid}
                    onChange={(e) =>
                      setInvoiceFormData({
                        ...invoiceFormData,
                        is_paid: e.target.checked,
                        paid_amount: e.target.checked ? invoiceFormData.amount : '',
                        payment_date: e.target.checked ? getBuenosAiresDateString() : '',
                      })
                    }
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="is_paid" className="text-sm font-medium text-gray-700">
                    Factura pagada
                  </label>
                </div>
                {invoiceFormData.is_paid && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto Pagado</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={invoiceFormData.amount}
                          value={invoiceFormData.paid_amount}
                          onChange={(e) =>
                            setInvoiceFormData({ ...invoiceFormData, paid_amount: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                        <input
                          type="date"
                          value={invoiceFormData.payment_date}
                          onChange={(e) =>
                            setInvoiceFormData({ ...invoiceFormData, payment_date: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                      <select
                        value={invoiceFormData.payment_method}
                        onChange={(e) =>
                          setInvoiceFormData({ ...invoiceFormData, payment_method: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {/* Sección de Productos/Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Productos de la Factura</label>
                    <button
                      type="button"
                      onClick={handleAddInvoiceItem}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Producto</span>
                    </button>
                  </div>
                  {invoiceItems.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <FileText className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">No hay productos agregados</p>
                      <p className="text-xs text-gray-400 mt-1">Haz clic en "Agregar Producto" para comenzar</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Producto</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase w-24">Cantidad</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase w-16"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {invoiceItems.map((item, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.item_name || ''}
                                    onChange={(e) => handleUpdateInvoiceItem(index, 'item_name', e.target.value)}
                                    placeholder="Nombre del producto"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={item.quantity || 1}
                                    onChange={(e) => handleUpdateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveInvoiceItem(index)}
                                    className="text-red-600 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    value={invoiceFormData.observations}
                    onChange={(e) =>
                      setInvoiceFormData({ ...invoiceFormData, observations: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoiceModal(false)
                    setEditingInvoice(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg hover:from-primary-700 hover:to-primary-800"
                >
                  {editingInvoice ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para subir imagen de factura */}
      {showInvoiceImageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Escanear Factura Completa</h2>
            </div>
            <div className="px-6 py-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona una imagen de la factura
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary-400 transition-colors">
                  <div className="space-y-1 text-center">
                    {selectedImage ? (
                      <div className="space-y-2">
                        <ImageIcon className="mx-auto h-12 w-12 text-green-500" />
                        <div className="text-sm text-gray-600">
                          <p className="font-medium">{selectedImage.name}</p>
                          <p className="text-xs text-gray-500">
                            {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="invoice-image-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                          >
                            <span>Sube un archivo</span>
                            <input
                              id="invoice-image-upload"
                              name="invoice-image-upload"
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr-only"
                              onChange={handleImageUpload}
                              disabled={processingImage}
                            />
                          </label>
                          <p className="pl-1">o arrastra y suelta</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, PDF hasta 10MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {processingImage && (
                <div className="flex items-center justify-center space-x-2 text-blue-600 py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Procesando factura con OCR...</span>
                </div>
              )}

              {selectedImage && !processingImage && (
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInvoiceImageModal(false)
                      setSelectedImage(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <label
                    htmlFor="invoice-image-upload-retry"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 cursor-pointer"
                  >
                    Procesar Factura
                    <input
                      id="invoice-image-upload-retry"
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
