import { HiCheckCircle, HiXCircle } from 'react-icons/hi2';

/**
 * ProgressIndicator - Indicador visual de progreso por pasos
 *
 * @param {boolean} show - Mostrar/ocultar indicador
 * @param {array} steps - Array de pasos [{id, label, status: 'pending'|'loading'|'completed'|'error'}]
 */
export default function ProgressIndicator({ show, steps = [] }) {
  if (!show || steps.length === 0) return null;

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return <HiCheckCircle className="w-6 h-6 text-green-500" />;
      case 'loading':
        return (
          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        );
      case 'error':
        return <HiXCircle className="w-6 h-6 text-red-500" />;
      default: // pending
        return (
          <div className="w-6 h-6 rounded-full border-3 border-gray-300 bg-white"></div>
        );
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 font-semibold';
      case 'loading':
        return 'text-blue-700 font-semibold';
      case 'error':
        return 'text-red-700 font-semibold';
      default:
        return 'text-gray-500';
    }
  };

  const getStepBgColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'loading':
        return 'bg-blue-50 border-blue-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-transparet backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-bold text-gray-900">
            Procesando Dumpadas
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            Por favor espere mientras se procesan los datos...
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`p-4 rounded-lg border-2 transition-all ${getStepBgColor(step.status)}`}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getStepIcon(step.status)}
                </div>

                {/* Label */}
                <div className="flex-1">
                  <p className={`text-sm ${getStepColor(step.status)}`}>
                    {step.label}
                  </p>
                </div>

                {/* Step Number */}
                <div className="flex-shrink-0">
                  <span className="text-xs font-bold text-gray-400">
                    Paso {index + 1}/{steps.length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">
              Progreso General
            </span>
            <span className="text-xs font-bold text-blue-600">
              {Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{
                width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            No cierre esta ventana hasta que el proceso finalice
          </p>
        </div>
      </div>
    </div>
  );
}
