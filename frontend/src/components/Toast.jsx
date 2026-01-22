import { useEffect } from 'react'
import { CheckCircle, XCircle, X, AlertCircle, Info } from 'lucide-react'

const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  }

  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const iconColors = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  }

  const Icon = icons[type] || Info

  return (
    <div
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-soft-lg min-w-[300px] max-w-md ${colors[type]} animate-[slideIn_0.3s_ease-out]`}
      role="alert"
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconColors[type]}`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className={`flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors ${iconColors[type]}`}
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default Toast
