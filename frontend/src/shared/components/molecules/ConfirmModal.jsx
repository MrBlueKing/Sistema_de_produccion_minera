import { HiTrash, HiExclamationTriangle } from 'react-icons/hi2';
import PropTypes from 'prop-types';

/**
 * Modal de confirmación reutilizable
 * @param {boolean} show - Si el modal está visible
 * @param {function} onConfirm - Función al confirmar
 * @param {function} onCancel - Función al cancelar
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje principal
 * @param {string} highlightText - Texto destacado (opcional)
 * @param {string} confirmText - Texto del botón confirmar
 * @param {string} cancelText - Texto del botón cancelar
 * @param {string} variant - Variante de color (danger, warning, info)
 * @param {React.Component} icon - Icono personalizado
 */
export default function ConfirmModal({
  show,
  onConfirm,
  onCancel,
  title = '¿Estás seguro?',
  message,
  highlightText,
  warningText = 'Esta acción no se puede deshacer.',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  icon: Icon = HiExclamationTriangle
}) {
  if (!show) return null;

  const variants = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      highlightBg: 'bg-red-50',
      highlightText: 'text-red-600',
      buttonBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      highlightBg: 'bg-yellow-50',
      highlightText: 'text-yellow-600',
      buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      highlightBg: 'bg-blue-50',
      highlightText: 'text-blue-600',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
    }
  };

  const colors = variants[variant];

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-scale-in border-3 border-orange-300">
        {/* Icono */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 ${colors.iconBg} rounded-full flex items-center justify-center`}>
            <Icon className={`w-8 h-8 ${colors.iconColor}`} />
          </div>
        </div>

        {/* Título */}
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {title}
        </h3>

        {/* Mensaje */}
        {message && (
          <p className="text-gray-600 text-center mb-2">
            {message}
          </p>
        )}

        {/* Texto destacado */}
        {highlightText && (
          <p className="text-center mb-6">
            <span className={`font-bold text-xl ${colors.highlightText} ${colors.highlightBg} px-4 py-2 rounded-lg inline-block`}>
              {highlightText}
            </span>
          </p>
        )}

        {/* Advertencia */}
        {warningText && (
          <p className="text-sm text-gray-500 text-center mb-6">
            {warningText}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 ${colors.buttonBg} text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2`}
          >
            <Icon className="w-5 h-5" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

ConfirmModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  highlightText: PropTypes.string,
  warningText: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(['danger', 'warning', 'info']),
  icon: PropTypes.elementType,
};
