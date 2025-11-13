import { useEffect } from 'react';
import { HiCheckCircle, HiXCircle, HiInformationCircle, HiExclamationTriangle, HiXMark } from 'react-icons/hi2';

/**
 * Toast - Componente atómico para notificaciones tipo toast
 *
 * @param {string} type - Tipo de toast: 'success', 'error', 'info', 'warning'
 * @param {string} message - Mensaje principal a mostrar
 * @param {string} description - Descripción adicional opcional
 * @param {function} onClose - Callback cuando se cierra el toast
 * @param {number} duration - Duración en ms antes de auto-cerrar (0 = no auto-cerrar)
 */
export default function Toast({
  type = 'info',
  message,
  description,
  onClose,
  duration = 5000
}) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      textColor: 'text-green-800',
      icon: HiCheckCircle,
      iconColor: 'text-green-600'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      textColor: 'text-red-800',
      icon: HiXCircle,
      iconColor: 'text-red-600'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      textColor: 'text-yellow-800',
      icon: HiExclamationTriangle,
      iconColor: 'text-yellow-600'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      textColor: 'text-blue-800',
      icon: HiInformationCircle,
      iconColor: 'text-blue-600'
    }
  };

  const currentConfig = config[type] || config.info;
  const Icon = currentConfig.icon;

  return (
    <div
      className={`${currentConfig.bg} ${currentConfig.border} border-l-4 rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[320px] max-w-md animate-slide-in-right`}
      role="alert"
    >
      <Icon className={`w-6 h-6 ${currentConfig.iconColor} flex-shrink-0 mt-0.5`} />

      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${currentConfig.textColor} text-sm`}>
          {message}
        </p>
        {description && (
          <p className={`${currentConfig.textColor} text-xs mt-1 opacity-90`}>
            {description}
          </p>
        )}
      </div>

      <button
        onClick={onClose}
        className={`${currentConfig.iconColor} hover:opacity-70 transition-opacity flex-shrink-0`}
        aria-label="Cerrar notificación"
      >
        <HiXMark className="w-5 h-5" />
      </button>
    </div>
  );
}
