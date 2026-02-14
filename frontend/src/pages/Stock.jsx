import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import BarcodeLabel from '../components/BarcodeLabel'
import BarcodeLabelSheet from '../components/BarcodeLabelSheet'
import {
  PackageCheck,
  Barcode,
  Trash2,
  Search,
  Plus,
  Minus,
  Printer,
  CheckSquare,
  Square,
  Scan,
  FileText,
} from 'lucide-react'

export default function Stock() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [printingItem, setPrintingItem] = useState(null)
  const [printingItems, setPrintingItems] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [showManualProductModal, setShowManualProductModal] = useState(false)
  const [barcodeMode, setBarcodeMode] = useState('scan') // 'scan' o 'generate'
  const [massScanMode, setMassScanMode] = useState(false)
  const [massScanProducts, setMassScanProducts] = useState([])
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
  const [activeField, setActiveField] = useState(null) // Para saber qué campo está escuchando el scanner
  const productRowRefs = useRef({})

  // Función helper para limpiar el estado del modal
  const resetModalState = () => {
    setManualProduct({
      item_name: '',
      barcode: '',
      brand: '',
      code: '',
      quantity: 1,
    })
    setFoundProduct(null)
    setBarcodeInputManual('')
    setBarcodeMode('scan')
    setActiveField(null)
    if (barcodeTimeoutManual) {
      clearTimeout(barcodeTimeoutManual)
      setBarcodeTimeoutManual(null)
    }
  }

  useEffect(() => {
    fetchStock()
  }, [])

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
    fetchStock()
  }, [searchTerm])


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


  const handleBarcodeScanManual = useCallback(async (barcode, field = null) => {
    if (!barcode) return

    // Si hay un campo activo, solo rellenar ese campo
    if (field && activeField === field) {
      if (field === 'barcode') {
        setManualProduct(prev => ({ ...prev, barcode }))
      } else if (field === 'brand') {
        setManualProduct(prev => ({ ...prev, brand: barcode }))
      } else if (field === 'code') {
        setManualProduct(prev => ({ ...prev, code: barcode }))
      }
      return
    }

    // Si no hay campo activo, buscar producto por código de barras
    try {
      setSearchingBarcodeManual(true)
      setBarcodeInputManual(barcode)
      
      const response = await api.get(`/stock/barcode/${barcode}`)
      const product = response.data
      
      // Producto encontrado - auto-rellenar y sumar cantidad
      setFoundProduct(product)
      setManualProduct({
        item_name: product.item_name,
        barcode: product.barcode,
        brand: product.brand || '',
        code: product.code || '',
        quantity: 1,
      })
      success('Producto encontrado. Los campos se rellenaron automáticamente. Se sumará la cantidad al stock existente.')
    } catch (err) {
      if (err.response?.status === 404) {
        // Producto no encontrado - modo creación (nuevo producto)
        setFoundProduct(null)
        setManualProduct(prev => ({
          ...prev,
          barcode: barcode,
          item_name: prev.item_name || '',
          brand: prev.brand || '',
          code: prev.code || '',
          quantity: prev.quantity || 1,
        }))
        success('Producto no encontrado. Completa los datos para crear uno nuevo.')
      } else {
        error('Error al buscar el producto')
      }
    } finally {
      setSearchingBarcodeManual(false)
    }
  }, [success, error, activeField])
  
  // Función para manejar lectura masiva
  const handleMassScan = useCallback(async (barcode) => {
    if (!barcode) return
    
    try {
      // Buscar si el producto ya existe
      const response = await api.get(`/stock/barcode/${barcode}`)
      const product = response.data
      
      // Si existe, aumentar cantidad en 1 en la lista masiva
      const existingIndex = massScanProducts.findIndex(p => p.barcode === barcode)
      if (existingIndex >= 0) {
        const updated = [...massScanProducts]
        updated[existingIndex].quantity += 1
        setMassScanProducts(updated)
        success(`Cantidad aumentada para: ${product.item_name}`)
      } else {
        // Si no existe, agregar a la lista con datos auto-rellenados
        setMassScanProducts(prev => [...prev, {
          item_name: product.item_name,
          barcode: product.barcode,
          brand: product.brand || '',
          code: product.code || '',
          quantity: 1,
          found: true,
        }])
        success(`Producto agregado: ${product.item_name}`)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Producto no encontrado, verificar si ya está en la lista masiva
        const existingIndex = massScanProducts.findIndex(p => p.barcode === barcode)
        if (existingIndex >= 0) {
          // Si ya está en la lista, aumentar cantidad
          const updated = [...massScanProducts]
          updated[existingIndex].quantity += 1
          setMassScanProducts(updated)
          success(`Cantidad aumentada para código: ${barcode}`)
        } else {
          // Si no está, agregar sin datos
          setMassScanProducts(prev => [...prev, {
            item_name: '',
            barcode: barcode,
            brand: '',
            code: '',
            quantity: 1,
            found: false,
          }])
          success('Producto no encontrado. Completa los datos manualmente.')
        }
      } else {
        error('Error al buscar el producto')
      }
    }
  }, [massScanProducts, success, error])

  // Función para buscar y resaltar producto por código de barras en la tabla
  const handleBarcodeSearchInTable = useCallback(async (barcode) => {
    if (!barcode || showManualProductModal) return

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
      // Si hay un campo activo (brand o code), capturar el código para ese campo
      if (activeField && (activeField === 'brand' || activeField === 'code')) {
        // Si estamos escribiendo en un input visible, permitir capturar
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'hidden') {
          if (e.key === 'Enter' && currentBarcode.trim().length > 0) {
            e.preventDefault()
            handleBarcodeScanManual(currentBarcode.trim(), activeField)
            currentBarcode = ''
            if (timeout) {
              clearTimeout(timeout)
              timeout = null
            }
            return
          }
          
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            currentBarcode += e.key
            
            if (timeout) {
              clearTimeout(timeout)
            }
            
            timeout = setTimeout(() => {
              if (currentBarcode.trim().length > 0) {
                handleBarcodeScanManual(currentBarcode.trim(), activeField)
                currentBarcode = ''
              }
              timeout = null
            }, 100)
          }
        }
        return
      }
      
      // Si estamos escribiendo en un input visible y no hay campo activo, no capturar
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'hidden') {
        return
      }

      // Modo masivo: escanear y agregar a la lista
      if (massScanMode) {
        if (e.key === 'Enter' && currentBarcode.trim().length > 0) {
          e.preventDefault()
          handleMassScan(currentBarcode.trim())
          currentBarcode = ''
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          return
        }
        
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          currentBarcode += e.key
          
          if (timeout) {
            clearTimeout(timeout)
          }
          
          timeout = setTimeout(() => {
            if (currentBarcode.trim().length > 0) {
              handleMassScan(currentBarcode.trim())
              currentBarcode = ''
            }
            timeout = null
          }, 100)
        }
        return
      }

      // Modo individual: buscar producto por código de barras
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
  }, [showManualProductModal, handleBarcodeScanManual, handleMassScan, massScanMode, activeField])

  // Capturar código de barras cuando el modal NO está abierto
  useEffect(() => {
    if (showManualProductModal) return

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
  }, [showManualProductModal, handleBarcodeSearchInTable])

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
      setBarcodeMode('scan')
      setMassScanMode(false)
      setMassScanProducts([])
      await fetchStock()
      success(foundProduct ? 'Cantidad agregada al stock correctamente' : 'Producto creado y agregado al stock correctamente')
    } catch (err) {
      error(err.response?.data?.error || 'Error al agregar el producto')
    }
  }
  
  // Función para guardar productos en modo masivo
  const handleSaveMassScanProducts = async () => {
    if (massScanProducts.length === 0) {
      error('No hay productos para guardar')
      return
    }
    
    // Validar que todos los productos tengan código de barras y nombre (si no fueron encontrados)
    const invalidProducts = massScanProducts.filter(p => !p.barcode || (!p.found && !p.item_name))
    if (invalidProducts.length > 0) {
      error(`${invalidProducts.length} producto(s) no tienen todos los datos requeridos`)
      return
    }
    
    try {
      // Guardar todos los productos
      await Promise.all(
        massScanProducts.map(product =>
          api.post('/stock', {
            item_name: product.item_name,
            barcode: product.barcode,
            brand: product.brand || null,
            code: product.code || null,
            quantity: parseInt(product.quantity) || 1,
          })
        )
      )
      
      setShowManualProductModal(false)
      setMassScanProducts([])
      setMassScanMode(false)
      setBarcodeMode('scan')
      await fetchStock()
      success(`${massScanProducts.length} producto(s) guardado(s) correctamente`)
    } catch (err) {
      error(err.response?.data?.error || 'Error al guardar los productos')
    }
  }
  
  // Función para generar código de barras
  const handleGenerateBarcode = () => {
    const newBarcode = `STK${Date.now()}${Math.floor(Math.random() * 1000)}`
    setManualProduct(prev => ({ ...prev, barcode: newBarcode }))
    success('Código de barras generado')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Stock</h1>
        <p className="text-gray-600">Gestiona el inventario de productos</p>
      </div>

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
                    onClick={() => {
                      resetModalState()
                      setMassScanMode(false)
                      setMassScanProducts([])
                      setShowManualProductModal(true)
                    }}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Producto
                  </button>
                  <button
                    onClick={() => {
                      resetModalState()
                      setMassScanMode(true)
                      setMassScanProducts([])
                      setShowManualProductModal(true)
                    }}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Lectura Masiva
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
                  Agrega productos manualmente o escanea códigos de barras para gestionar el inventario.
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
                      )
                    })}
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
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => {
              setShowManualProductModal(false)
              setMassScanMode(false)
              setMassScanProducts([])
              resetModalState()
            }}></div>
            <div className={`inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-soft-lg transform transition-all sm:my-8 sm:align-middle border border-gray-100 ${massScanMode ? 'sm:max-w-4xl sm:w-full' : 'sm:max-w-lg sm:w-full'}`}>
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {massScanMode ? 'Lectura Masiva de Productos' : 'Agregar Producto al Stock'}
                  </h3>
                  <button
                    onClick={() => {
                      setMassScanMode(!massScanMode)
                      if (!massScanMode) {
                        setMassScanProducts([])
                      } else {
                        setManualProduct({
                          item_name: '',
                          barcode: '',
                          brand: '',
                          code: '',
                          quantity: 1,
                        })
                        setFoundProduct(null)
                        setBarcodeInputManual('')
                      }
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    {massScanMode ? 'Modo Individual' : 'Lectura Masiva'}
                  </button>
                </div>
                
                {massScanMode ? (
                  <div className="space-y-4">
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        📷 Escanea múltiples códigos de barras consecutivamente. Si escaneas el mismo código más de una vez, se aumentará la cantidad automáticamente.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Escanear Código de Barras
                      </label>
                      <input
                        type="text"
                        autoFocus
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={barcodeInputManual}
                        onChange={(e) => {
                          setBarcodeInputManual(e.target.value)
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && barcodeInputManual.trim().length > 0) {
                            e.preventDefault()
                            await handleMassScan(barcodeInputManual.trim())
                            setBarcodeInputManual('')
                          }
                        }}
                        placeholder="Escanea código de barras y presiona Enter"
                      />
                    </div>
                    
                    {massScanProducts.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">
                            Productos Escaneados ({massScanProducts.length})
                          </h4>
                          <button
                            onClick={handleSaveMassScanProducts}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                          >
                            Guardar Todos
                          </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Código Barras</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Marca</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Código</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Cantidad</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase"></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {massScanProducts.map((product, index) => (
                                <tr key={index} className={product.found ? 'bg-green-50' : 'bg-yellow-50'}>
                                  <td className="px-4 py-2 text-sm font-mono">{product.barcode}</td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={product.item_name}
                                      onChange={(e) => {
                                        const updated = [...massScanProducts]
                                        updated[index].item_name = e.target.value
                                        setMassScanProducts(updated)
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                      placeholder="Nombre del producto"
                                      disabled={product.found}
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={product.brand}
                                      onChange={(e) => {
                                        const updated = [...massScanProducts]
                                        updated[index].brand = e.target.value
                                        setMassScanProducts(updated)
                                      }}
                                      onFocus={() => setActiveField('brand')}
                                      onBlur={() => setActiveField(null)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                                      placeholder="Marca (escucha scanner)"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="text"
                                      value={product.code}
                                      onChange={(e) => {
                                        const updated = [...massScanProducts]
                                        updated[index].code = e.target.value
                                        setMassScanProducts(updated)
                                      }}
                                      onFocus={() => setActiveField('code')}
                                      onBlur={() => setActiveField(null)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                                      placeholder="Código (escucha scanner)"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={product.quantity}
                                      onChange={(e) => {
                                        const updated = [...massScanProducts]
                                        updated[index].quantity = parseInt(e.target.value) || 1
                                        setMassScanProducts(updated)
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <button
                                      onClick={() => {
                                        setMassScanProducts(massScanProducts.filter((_, i) => i !== index))
                                      }}
                                      className="text-red-600 hover:text-red-700"
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
                ) : (
                  <div className="space-y-4">
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        📷 Escanea el código de barras del producto o genera uno nuevo
                      </p>
                    </div>

                    {/* Selección de modo: Escanear o Generar */}
                    <div className="flex space-x-2 mb-4">
                      <button
                        onClick={() => {
                          setBarcodeMode('scan')
                          setManualProduct(prev => ({ ...prev, barcode: '' }))
                          setFoundProduct(null)
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          barcodeMode === 'scan'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Scan className="w-4 h-4 inline mr-2" />
                        Escanear Código
                      </button>
                      <button
                        onClick={() => {
                          setBarcodeMode('generate')
                          handleGenerateBarcode()
                          setFoundProduct(null)
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          barcodeMode === 'generate'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Barcode className="w-4 h-4 inline mr-2" />
                        Generar Código
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Código de Barras *
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          required
                          autoFocus={barcodeMode === 'scan'}
                          className="flex-1 border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={manualProduct.barcode}
                          onChange={(e) => {
                            setManualProduct(prev => ({ ...prev, barcode: e.target.value }))
                            setBarcodeInputManual(e.target.value)
                            if (e.target.value.trim().length > 0 && barcodeMode === 'scan') {
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
                            if (e.key === 'Enter' && manualProduct.barcode.trim().length > 0 && barcodeMode === 'scan') {
                              e.preventDefault()
                              handleBarcodeScanManual(manualProduct.barcode.trim())
                            }
                          }}
                          placeholder={barcodeMode === 'scan' ? 'Escanea o ingresa código de barras' : 'Código generado automáticamente'}
                          disabled={barcodeMode === 'generate' || searchingBarcodeManual}
                        />
                        {barcodeMode === 'generate' && (
                          <button
                            onClick={handleGenerateBarcode}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium"
                          >
                            Regenerar
                          </button>
                        )}
                      </div>
                      {searchingBarcodeManual && (
                        <p className="mt-1 text-xs text-gray-500">Buscando producto...</p>
                      )}
                    </div>

                    {foundProduct ? (
                      <>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-medium text-green-700 mb-3">✓ Producto encontrado. Los campos se rellenaron automáticamente:</p>
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-semibold text-gray-600">Stock actual:</span>
                              <p className="text-sm text-gray-900">{foundProduct.quantity} unidades</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}

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
                          Marca <span className="text-xs text-gray-500">(escucha scanner)</span>
                        </label>
                        <input
                          type="text"
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={manualProduct.brand}
                          onChange={(e) => setManualProduct({ ...manualProduct, brand: e.target.value })}
                          onFocus={() => setActiveField('brand')}
                          onBlur={() => setActiveField(null)}
                          placeholder="Ej: SKF"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Código <span className="text-xs text-gray-500">(escucha scanner)</span>
                        </label>
                        <input
                          type="text"
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={manualProduct.code}
                          onChange={(e) => setManualProduct({ ...manualProduct, code: e.target.value })}
                          onFocus={() => setActiveField('code')}
                          onBlur={() => setActiveField(null)}
                          placeholder="Código del fabricante"
                        />
                      </div>
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
                      {foundProduct && (
                        <p className="mt-1 text-xs text-gray-500">
                          Esta cantidad se sumará al stock existente ({foundProduct.quantity} unidades)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse border-t border-gray-100">
                {massScanMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveMassScanProducts}
                      disabled={massScanProducts.length === 0}
                      className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-base font-medium text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                    >
                      Guardar Todos ({massScanProducts.length})
                    </button>
                    <button
                      type="button"
                    onClick={() => {
                      setShowManualProductModal(false)
                      setMassScanMode(false)
                      setMassScanProducts([])
                      resetModalState()
                    }}
                      className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-5 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 sm:mt-0 sm:ml-3 sm:w-auto"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAddManualProduct}
                      disabled={!manualProduct.barcode || searchingBarcodeManual || !manualProduct.item_name}
                      className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-base font-medium text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                    >
                      {foundProduct ? 'Agregar Cantidad' : 'Crear Producto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualProductModal(false)
                        setMassScanMode(false)
                        setMassScanProducts([])
                        resetModalState()
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-5 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 sm:mt-0 sm:ml-3 sm:w-auto"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
