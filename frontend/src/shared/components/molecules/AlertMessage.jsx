import { HiCheckCircle, HiXCircle, HiInformationCircle, HiExclamationTriangle } from 'react-icons/hi2';
import PropTypes from 'prop-types';

/**
 * Componente de mensaje de alerta reutilizable
 * @param {string} type - Tipo de alerta (success, error, warning, info)
 * @param {string} title - Título del mensaje
 * @param {string} message - Mensaje principal
 * @param {function} onClose - Función al cerrar
 */
export default function AlertMessage({ type = 'info', title, message, onClose }) {
  const types = {
    success: {
      gradient: 'from-green-50 to-emerald-50',
      border: 'border-green-500',
      iconBg: 'bg-green-500',
      icon: HiCheckCircle,
      titleColor: 'text-green-900',
      messageColor: 'text-green-800',
      closeHover: 'text-green-600 hover:text-green-800 hover:bg-green-100',
    },
    error: {
      gradient: 'from-red-50 to-rose-50',
      border: 'border-red-500',
      iconBg: 'bg-red-500',
      icon: HiXCircle,
      titleColor: 'text-red-900',
      messageColor: 'text-red-800',
      closeHover: 'text-red-600 hover:text-red-800 hover:bg-red-100',
    },
    warning: {
      gradient: 'from-yellow-50 to-amber-50',
      border: 'border-yellow-500',
      iconBg: 'bg-yellow-500',
      icon: HiExclamationTriangle,
      titleColor: 'text-yellow-900',
      messageColor: 'text-yellow-800',
      closeHover: 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100',
    },
    info: {
      gradient: 'from-blue-50 to-sky-50',
      border: 'border-blue-500',
      iconBg: 'bg-blue-500',
      icon: HiInformationCircle,
      titleColor: 'text-blue-900',
      messageColor: 'text-blue-800',
      closeHover: 'text-blue-600 hover:text-blue-800 hover:bg-blue-100',
    },
  };

  const config = types[type] || types.info;
  const Icon = config.icon;

  return (
    <div className={`mb-6 bg-gradient-to-r ${config.gradient} border-l-4 ${config.border} rounded-xl p-5 flex items-start gap-4 shadow-lg animate-slide-in transform hover:scale-[1.02] transition-transform duration-200`}>
      <div className={`w-12 h-12 ${config.iconBg} rounded-full flex items-center justify-center flex-shrink-0 shadow-md`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div className="flex-1 pt-1">
        <p className={`font-bold text-lg ${config.titleColor} mb-1`}>{title}</p>
        <p className={`${config.messageColor} text-sm leading-relaxed`}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={`${config.closeHover} rounded-full p-1 transition-colors duration-200 mt-1`}
          title="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

AlertMessage.propTypes = {
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func,
};
