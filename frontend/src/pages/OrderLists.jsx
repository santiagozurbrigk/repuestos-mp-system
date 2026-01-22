import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Package, Trash2, CheckCircle, XCircle, X } from 'lucide-react'
import { getBuenosAiresDateString, parseBuenosAiresDate } from '../utils/dateHelpers'

const statusLabels = {
  pending: 'Pendiente',
  ordered: 'Pedido',
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  ordered: 'bg-green-100 text-green-800',
}

export default function OrderLists() {
  const { success, error } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [orderLists, setOrderLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState(null)
  const [inputValues, setInputValues] = useState({ 1: '', 2: '', 3: '', 4: '' })
  const inputRefs = {
    1: useRef(null),
    2: useRef(null),
    3: useRef(null),
    4: useRef(null),
  }

  useEffect(() => {
    fetchOrderLists()
  }, [])

  useEffect(() => {
    // Si hay una lista seleccionada, obtener o crear una lista del día actual
    if (!selectedList && orderLists.length > 0) {
      const todayStr = getBuenosAiresDateString()
      
      const todayList = orderLists.find(
        (list) => list.created_date === todayStr && list.status === 'pending'
      )
      
      if (todayList) {
        setSelectedList(todayList)
      } else {
        // Si no hay lista de hoy, usar la más reciente pendiente
        const pendingList = orderLists.find((list) => list.status === 'pending')
        if (pendingList) {
          setSelectedList(pendingList)
        }
      }
    }
  }, [orderLists])

  const fetchOrderLists = async (updateSelected = false) => {
    try {
      setLoading(true)
      const response = await api.get('/order-lists?limit=50')
      const lists = response.data
      setOrderLists(lists)
      
      // Si se solicita actualizar la lista seleccionada, hacerlo
      if (updateSelected && selectedList) {
        const updatedList = lists.find((list) => list.id === selectedList.id)
        if (updatedList) {
          setSelectedList(updatedList)
        }
      }
    } catch (err) {
      error('Error al cargar las listas de pedidos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    try {
      // No enviar created_date, dejar que el backend use la fecha de Buenos Aires
      const response = await api.post('/order-lists', {})
      
      // Asegurarse de que la respuesta incluya los items (aunque esté vacío)
      const listWithItems = {
        ...response.data,
        order_list_items: response.data.order_list_items || []
      }
      
      await fetchOrderLists(false)
      setSelectedList(listWithItems)
      success('Lista creada correctamente')
    } catch (err) {
      error('Error al crear la lista')
    }
  }

  const handleAddItem = async (sector, itemName) => {
    if (!itemName.trim() || !selectedList) return

    try {
      await api.post(`/order-lists/${selectedList.id}/items`, {
        item_name: itemName.trim(),
        sector: sector,
      })
      
      // Limpiar el input del sector inmediatamente
      setInputValues((prev) => ({ ...prev, [sector]: '' }))
      
      // Obtener la lista actualizada directamente con todos sus items
      const listResponse = await api.get(`/order-lists/${selectedList.id}`)
      const updatedList = listResponse.data
      
      // Crear un nuevo objeto para forzar la actualización de React
      const freshList = {
        ...updatedList,
        order_list_items: [...(updatedList.order_list_items || [])]
      }
      
      // Actualizar el estado de la lista seleccionada inmediatamente
      setSelectedList(freshList)
      
      // También actualizar todas las listas para el selector
      const allListsResponse = await api.get('/order-lists?limit=50')
      setOrderLists(allListsResponse.data)
      
      // Enfocar de nuevo el input
      setTimeout(() => {
        inputRefs[sector].current?.focus()
      }, 50)
      success('Artículo agregado correctamente')
    } catch (err) {
      error('Error al agregar el artículo')
    }
  }

  const handleKeyPress = (e, sector) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const itemName = inputValues[sector]
      if (itemName.trim()) {
        handleAddItem(sector, itemName)
      }
    }
  }

  const handleDeleteItem = async (listId, itemId) => {
    const confirmed = await confirm({
      title: 'Eliminar artículo',
      message: '¿Estás seguro de eliminar este artículo?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.delete(`/order-lists/${listId}/items/${itemId}`)
      
      // Actualizar la lista seleccionada directamente
      if (selectedList && selectedList.id === listId) {
        const listResponse = await api.get(`/order-lists/${listId}`)
        const updatedList = {
          ...listResponse.data,
          order_list_items: [...(listResponse.data.order_list_items || [])]
        }
        setSelectedList(updatedList)
      }
      
      // Actualizar todas las listas
      await fetchOrderLists(false)
      success('Artículo eliminado correctamente')
    } catch (err) {
      error('Error al eliminar el artículo')
    }
  }

  const handleUpdateStatus = async (listId, status) => {
    try {
      await api.put(`/order-lists/${listId}`, { status })
      await fetchOrderLists()
      success('Estado actualizado correctamente')
    } catch (err) {
      error('Error al actualizar el estado')
    }
  }

  const handleDeleteList = async (listId) => {
    const confirmed = await confirm({
      title: 'Eliminar lista',
      message: '¿Estás seguro de eliminar esta lista completa? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
    })

    if (!confirmed) return

    try {
      await api.delete(`/order-lists/${listId}`)
      if (selectedList?.id === listId) {
        setSelectedList(null)
      }
      await fetchOrderLists()
      success('Lista eliminada correctamente')
    } catch (err) {
      error('Error al eliminar la lista')
    }
  }

  const getItemsBySector = (items, sector) => {
    if (!items || !Array.isArray(items)) return []
    return items.filter((item) => item.sector === sector).sort((a, b) => {
      // Ordenar por fecha de creación (más recientes primero)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Usar selectedList si existe, sino buscar la lista del día actual o la más reciente pendiente
  const currentList = selectedList || (() => {
    const todayStr = getBuenosAiresDateString()
    const todayList = orderLists.find(
      (list) => list.created_date === todayStr && list.status === 'pending'
    )
    return todayList || orderLists.find((list) => list.status === 'pending')
  })()

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Listas de Pedidos</h1>
          <p className="text-gray-600">Gestiona las listas de artículos a pedir</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={selectedList?.id || ''}
            onChange={(e) => {
              const list = orderLists.find((l) => l.id === e.target.value)
              setSelectedList(list || null)
            }}
            className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm"
          >
            <option value="">Seleccionar lista...</option>
            {orderLists.map((list) => {
              const dateObj = parseBuenosAiresDate(list.created_date)
              return (
                <option key={list.id} value={list.id}>
                  {dateObj ? format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: es }) : list.created_date} -{' '}
                  {statusLabels[list.status]}
                </option>
              )
            })}
          </select>
          <button
            onClick={handleCreateList}
            className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Lista
          </button>
        </div>
      </div>

      {currentList && (
        <div className="bg-white shadow-soft rounded-xl border border-gray-100 mb-6 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {(() => {
                      const dateObj = parseBuenosAiresDate(currentList.created_date)
                      return dateObj 
                        ? format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: es })
                        : currentList.created_date
                    })()}
                  </h3>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold border ${statusColors[currentList.status]}`}
                >
                  {currentList.status === 'pending' ? (
                    <XCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {statusLabels[currentList.status]}
                </span>
                {currentList.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus(currentList.id, 'ordered')}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Pedido
                  </button>
                )}
                <button
                  onClick={() => handleDeleteList(currentList.id)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                  title="Eliminar lista"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Grid de 4 sectores */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6 h-[600px]">
              {/* Sector 1 - Arriba Izquierda */}
              <div className="border-2 border-gray-200 rounded-xl p-5 flex flex-col bg-gradient-to-br from-blue-50/20 to-transparent hover:border-blue-300 transition-all duration-200">
                <div className="mb-3 font-semibold text-gray-800 text-sm uppercase tracking-wide">Sector 1</div>
                <input
                  ref={inputRefs[1]}
                  type="text"
                  value={inputValues[1]}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, 1: e.target.value }))}
                  onKeyPress={(e) => handleKeyPress(e, 1)}
                  placeholder="Escribe y presiona Enter..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white"
                />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {getItemsBySector(currentList?.order_list_items, 1).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150"
                    >
                      <span className="text-sm font-medium text-gray-900 flex-1">{item.item_name}</span>
                      <button
                        onClick={() => handleDeleteItem(currentList.id, item.id)}
                        className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        title="Eliminar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector 2 - Arriba Derecha */}
              <div className="border-2 border-gray-200 rounded-xl p-5 flex flex-col bg-gradient-to-br from-emerald-50/30 to-transparent hover:border-emerald-300 transition-all duration-200">
                <div className="mb-3 font-semibold text-gray-800 text-sm uppercase tracking-wide">Sector 2</div>
                <input
                  ref={inputRefs[2]}
                  type="text"
                  value={inputValues[2]}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, 2: e.target.value }))}
                  onKeyPress={(e) => handleKeyPress(e, 2)}
                  placeholder="Escribe y presiona Enter..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white"
                />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {getItemsBySector(currentList?.order_list_items, 2).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150"
                    >
                      <span className="text-sm font-medium text-gray-900 flex-1">{item.item_name}</span>
                      <button
                        onClick={() => handleDeleteItem(currentList.id, item.id)}
                        className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        title="Eliminar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector 3 - Abajo Izquierda */}
              <div className="border-2 border-gray-200 rounded-xl p-5 flex flex-col bg-gradient-to-br from-blue-50/20 to-transparent hover:border-blue-300 transition-all duration-200">
                <div className="mb-3 font-semibold text-gray-800 text-sm uppercase tracking-wide">Sector 3</div>
                <input
                  ref={inputRefs[3]}
                  type="text"
                  value={inputValues[3]}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, 3: e.target.value }))}
                  onKeyPress={(e) => handleKeyPress(e, 3)}
                  placeholder="Escribe y presiona Enter..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white"
                />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {getItemsBySector(currentList?.order_list_items, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150"
                    >
                      <span className="text-sm font-medium text-gray-900 flex-1">{item.item_name}</span>
                      <button
                        onClick={() => handleDeleteItem(currentList.id, item.id)}
                        className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        title="Eliminar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector 4 - Abajo Derecha */}
              <div className="border-2 border-gray-200 rounded-xl p-5 flex flex-col bg-gradient-to-br from-blue-50/20 to-transparent hover:border-blue-300 transition-all duration-200">
                <div className="mb-3 font-semibold text-gray-800 text-sm uppercase tracking-wide">Sector 4</div>
                <input
                  ref={inputRefs[4]}
                  type="text"
                  value={inputValues[4]}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, 4: e.target.value }))}
                  onKeyPress={(e) => handleKeyPress(e, 4)}
                  placeholder="Escribe y presiona Enter..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white"
                />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {getItemsBySector(currentList?.order_list_items, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150"
                    >
                      <span className="text-sm font-medium text-gray-900 flex-1">{item.item_name}</span>
                      <button
                        onClick={() => handleDeleteItem(currentList.id, item.id)}
                        className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        title="Eliminar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!currentList && (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          No hay listas de pedidos. Crea una nueva lista para comenzar.
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
