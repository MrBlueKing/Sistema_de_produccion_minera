import { useState } from 'react';
import { HiInformationCircle } from 'react-icons/hi2';
import { FAENA_COLORS, getFaenaColors } from '../../../constants/faenaColors';

/**
 * Selector multi-faena con grid de tarjetas visuales
 * Inspirado en el proyecto petroleo - Consumos Generales
 *
 * @param {Array} selectedFaenas - IDs de faenas seleccionadas
 * @param {Function} onToggleFaena - Callback cuando se selecciona/deselecciona una faena
 * @param {Array} faenas - Todas las faenas disponibles
 * @param {Array} faenasVisibles - IDs de faenas que se deben mostrar (opcional, si no se pasa muestra todas)
 * @param {string} className - Clases CSS adicionales
 * @param {boolean} loading - Estado de carga
 */
const FaenaMultiSelector = ({
  selectedFaenas = [],
  onToggleFaena,
  faenas = [],
  faenasVisibles = null, // null = mostrar todas
  className = '',
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Filtrar faenas según la lista de visibles
  const faenasFiltradas = faenasVisibles
    ? faenas.filter(faena => faenasVisibles.includes(faena.id))
    : faenas;

  // Total de faenas disponibles
  const totalFaenas = faenasFiltradas.length;

  // Función para manejar click en tarjeta de faena
  const handleFaenaClick = (faenaId) => {
    if (loading) return;

    const isSelected = selectedFaenas.includes(faenaId);
    onToggleFaena?.(faenaId, !isSelected);
  };

  // Función para seleccionar todas las faenas
  const handleSelectAll = () => {
    if (loading) return;

    if (selectedFaenas.length === totalFaenas) {
      // Si todas están seleccionadas, deseleccionar todas
      faenasFiltradas.forEach(faena => {
        if (selectedFaenas.includes(faena.id)) {
          onToggleFaena?.(faena.id, false);
        }
      });
    } else {
      // Seleccionar todas
      faenasFiltradas.forEach(faena => {
        if (!selectedFaenas.includes(faena.id)) {
          onToggleFaena?.(faena.id, true);
        }
      });
    }
  };

  if (!faenasFiltradas || faenasFiltradas.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${className}`}>
        <div className="flex items-center gap-2 text-gray-600">
          <HiInformationCircle className="w-5 h-5" />
          <span className="text-sm">No hay faenas disponibles</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-purple-50 rounded-lg p-4 border border-purple-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-2 rounded-lg shadow-sm">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-gray-800">
            🏭 Selector de Faenas
          </h4>
          <p className="text-gray-600 text-xs">
            {selectedFaenas.length}/{totalFaenas} faenas seleccionadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón seleccionar todas */}
          <button
            onClick={handleSelectAll}
            disabled={loading}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedFaenas.length === totalFaenas ? 'Deseleccionar todas' : 'Seleccionar todas'}
          </button>

          {/* Botón expandir/colapsar (móvil) */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Grid de tarjetas de faenas */}
      <div className={`${expanded ? 'block' : 'hidden'} sm:block`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {faenasFiltradas.map((faena) => {
            const colors = getFaenaColors(faena.id);
            const isSelected = selectedFaenas.includes(faena.id);

            return (
              <button
                key={faena.id}
                onClick={() => handleFaenaClick(faena.id)}
                disabled={loading}
                className={`relative overflow-hidden p-3 rounded-lg border-2 transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? `${colors.borderFull} ${colors.bg} shadow-md scale-105`
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Indicador de selección */}
                <div
                  className={`absolute top-1 right-1 w-2 h-2 rounded-full transition-all duration-300 ${
                    isSelected ? 'bg-green-500 shadow-lg' : 'bg-gray-300'
                  }`}
                />

                {/* Contenido de la tarjeta */}
                <div className="text-left">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-lg">
                      {colors.emoji}
                    </span>
                    <h5
                      className={`font-bold text-sm truncate ${
                        isSelected ? colors.text : 'text-gray-600'
                      }`}
                    >
                      {faena.ubicacion || colors.name}
                    </h5>
                  </div>
                  {faena.detalle && (
                    <p className="text-xs text-gray-500 truncate">
                      {faena.detalle}
                    </p>
                  )}
                </div>

                {/* Barra inferior decorativa */}
                {isSelected && (
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-1 ${colors.gradient} opacity-60`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Resumen de faenas activas */}
        <div className="mt-3 pt-3 border-t border-purple-200">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">Activas:</span>
            {selectedFaenas.length === 0 ? (
              <span className="text-red-600 font-medium">Ninguna faena seleccionada</span>
            ) : (
              faenasFiltradas
                .filter(faena => selectedFaenas.includes(faena.id))
                .map((faena) => {
                  const colors = getFaenaColors(faena.id);
                  return (
                    <span
                      key={faena.id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.badge} border ${colors.borderFull}`}
                    >
                      <span className="text-xs">{colors.emoji}</span>
                      <span className="hidden sm:inline">{faena.ubicacion || colors.name}</span>
                    </span>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Indicador de carga - más sutil */}
      {loading && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-200 border-t-purple-600"></div>
            <p className="text-xs text-gray-600">Cargando...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaenaMultiSelector;
