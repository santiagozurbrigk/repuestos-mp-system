import { useState, useCallback } from 'react'
import ConfirmModal from '../components/ConfirmModal'

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'danger',
    resolve: null,
  })

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || 'Confirmar acción',
        message: options.message || '¿Estás seguro?',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        type: options.type || 'danger',
        resolve,
      })
    })
  }, [])

  const handleClose = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(false)
    }
    setConfirmState((prev) => ({
      ...prev,
      isOpen: false,
      resolve: null,
    }))
  }, [confirmState.resolve])

  const handleConfirm = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(true)
    }
    setConfirmState((prev) => ({
      ...prev,
      isOpen: false,
      resolve: null,
    }))
  }, [confirmState.resolve])

  const ConfirmDialog = () => (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      type={confirmState.type}
    />
  )

  return { confirm, ConfirmDialog }
}
