import Toast from '../atoms/Toast';

/**
 * ToastContainer - Contenedor de todas las notificaciones toast
 * Posiciona los toasts en la esquina superior derecha de la pantalla
 *
 * @param {array} toasts - Array de objetos toast con {id, type, message, description}
 * @param {function} onRemove - Callback para remover un toast por ID
 */
export default function ToastContainer({ toasts = [], onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            type={toast.type}
            message={toast.message}
            description={toast.description}
            onClose={() => onRemove(toast.id)}
            duration={toast.duration}
          />
        </div>
      ))}
    </div>
  );
}
