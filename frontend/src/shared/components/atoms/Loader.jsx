/**
 * Loader Component
 * Componente atómico para mostrar un indicador de carga
 *
 * @param {string} size - Tamaño del loader: 'sm', 'md', 'lg', 'xl'
 * @param {string} color - Color del loader: 'primary', 'secondary', 'white'
 * @param {string} text - Texto opcional a mostrar debajo del loader
 * @param {boolean} fullScreen - Si es true, muestra el loader en pantalla completa
 */
export default function Loader({
  size = 'md',
  color = 'primary',
  text = '',
  fullScreen = false
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
    xl: 'w-16 h-16 border-4',
  };

  const colorClasses = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent',
    success: 'border-green-600 border-t-transparent',
    warning: 'border-yellow-600 border-t-transparent',
    danger: 'border-red-600 border-t-transparent',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`
          ${sizeClasses[size]}
          ${colorClasses[color]}
          rounded-full
          animate-spin
        `}
        role="status"
        aria-label="Cargando"
      />
      {text && (
        <p className={`text-sm font-medium ${color === 'white' ? 'text-white' : 'text-gray-700'}`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-xl">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}
