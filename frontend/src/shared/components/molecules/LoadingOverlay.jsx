import Loader from '../atoms/Loader';

/**
 * LoadingOverlay Component
 * Componente molecular que muestra un overlay de carga sobre el contenido
 *
 * @param {boolean} isLoading - Si está cargando o no
 * @param {string} text - Texto a mostrar durante la carga
 * @param {ReactNode} children - Contenido a mostrar cuando no está cargando
 */
export default function LoadingOverlay({ isLoading, text = 'Cargando...', children }) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10 rounded-lg">
          <Loader size="lg" color="primary" text={text} />
        </div>
      )}
    </div>
  );
}
