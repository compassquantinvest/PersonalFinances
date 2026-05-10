import { createContext, useCallback, useContext, useReducer } from 'react'

const ToastContext = createContext(null)

function toastReducer(state, action) {
  switch (action.type) {
    case 'add':
      return [...state, action.toast]
    case 'remove':
      return state.filter((toast) => toast.id !== action.id)
    default:
      return state
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const showToast = useCallback((message, tone = 'success') => {
    const id = crypto.randomUUID()
    dispatch({ type: 'add', toast: { id, message, tone } })
    setTimeout(() => dispatch({ type: 'remove', id }), 5000)
  }, [])

  const showSuccess = useCallback((message) => showToast(message, 'success'), [showToast])
  const showError = useCallback((message) => showToast(message, 'error'), [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showSuccess, showError }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
            <span>{toast.message}</span>
            <button type="button" className="ghost-button inline-action" onClick={() => dispatch({ type: 'remove', id: toast.id })} aria-label="Fechar">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
