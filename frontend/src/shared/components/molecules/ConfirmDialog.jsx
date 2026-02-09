import { HiExclamationTriangle, HiXMark } from 'react-icons/hi2';
import Button from '../atoms/Button';
import Card from '../atoms/Card';

/**
 * ConfirmDialog Component
 * Componente molecular para mostrar diálogos de confirmación personalizados
 *
 * @param {boolean} isOpen - Si el diálogo está abierto
 * @param {function} onClose - Función para cerrar el diálogo
 * @param {function} onConfirm - Función a ejecutar al confirmar
 * @param {string} title - Título del diálogo
 * @param {string} message - Mensaje del diálogo
 * @param {string} confirmText - Texto del botón de confirmar (default: "Confirmar")
 * @param {string} cancelText - Texto del botón de cancelar (default: "Cancelar")
 * @param {string} type - Tipo de diálogo: 'danger', 'warning', 'info' (default: 'warning')
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: HiExclamationTriangle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      confirmVariant: 'danger'
    },
    warning: {
      icon: HiExclamationTriangle,
      iconColor: 'text-yellow-600',
      iconBg: 'bg-yellow-100',
      confirmVariant: 'warning'
    },
    info: {
      icon: HiExclamationTriangle,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      confirmVariant: 'primary'
    }
  };

  const config = typeConfig[type] || typeConfig.warning;
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`${config.iconBg} p-3 rounded-full`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Message */}
        <div className="mb-6 ml-12">
          <p className="text-gray-700">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
