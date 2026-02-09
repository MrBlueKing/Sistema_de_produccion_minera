import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiXMark } from 'react-icons/hi2';

export default function RangoTooltip({ rangoActual, rangos, children }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, showAbove: false });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const tooltipHeight = 450;

      const spaceBelow = viewportHeight - rect.bottom;
      const showAbove = spaceBelow < tooltipHeight && rect.top > tooltipHeight;

      setPosition({
        top: showAbove ? rect.top - 10 : rect.bottom + 10,
        left: rect.left + rect.width / 2,
        showAbove,
      });
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    setIsPinned(!isPinned);
    setShowTooltip(true);
  };

  const handleMouseEnter = () => {
    if (!isPinned) {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setShowTooltip(false);
    }
  };

  const handleClose = () => {
    setShowTooltip(false);
    setIsPinned(false);
  };

  useEffect(() => {
    if (showTooltip) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showTooltip]);

  // Cerrar al hacer click fuera o presionar ESC (solo si está pinned)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isPinned &&
        showTooltip &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target)
      ) {
        handleClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape' && isPinned && showTooltip) {
        handleClose();
      }
    };

    if (isPinned && showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isPinned, showTooltip]);

  const tooltipContent = showTooltip && rangos && rangos.length > 0 && (
    <div
      ref={tooltipRef}
      className="fixed z-[9999]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: position.showAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
      }}
      onMouseEnter={() => !isPinned && setShowTooltip(true)}
      onMouseLeave={() => !isPinned && setShowTooltip(false)}
    >
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-2xl border-2 border-blue-200 p-4 w-96">
        {/* Flecha del tooltip */}
        <div
          className={`absolute left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-blue-200 rotate-45 ${
            position.showAbove
              ? 'bottom-[-7px] border-r-2 border-b-2'
              : 'top-[-7px] border-l-2 border-t-2'
          }`}
        ></div>

        {/* Contenido del tooltip */}
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-blue-200">
            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              📊 Tabla de Rangos
            </h4>
            {isPinned && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Cerrar"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Indicador de estado */}
          <div className="mb-2 text-center">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              isPinned
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {isPinned ? '📌 Fijado - Click afuera o ESC para cerrar' : '💡 Click para fijar'}
            </span>
          </div>

          {/* Tabla de rangos */}
          <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                <tr>
                  <th className="text-left py-2 px-3 font-bold">Rango</th>
                  <th className="text-center py-2 px-2 font-bold">Límite Inferior</th>
                  <th className="text-center py-2 px-2 font-bold">Límite Superior</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {rangos.map((rango, index) => {
                  const isActive = rango.nomenclatura === rangoActual;
                  return (
                    <tr
                      key={rango.id || index}
                      className={`border-b border-gray-100 transition-colors ${
                        isActive
                          ? 'bg-blue-100 hover:bg-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className={`py-2 px-3 ${isActive ? 'font-bold' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold shadow-sm ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {rango.nomenclatura}
                          </span>
                          {isActive && (
                            <span className="text-blue-600 text-xs font-bold animate-pulse">← ACTUAL</span>
                          )}
                        </div>
                      </td>
                      <td className={`py-2 px-2 text-center ${
                        isActive ? 'text-blue-900 font-bold' : 'text-gray-600'
                      }`}>
                        {parseFloat(rango.limite_inferior).toFixed(2)}%
                      </td>
                      <td className={`py-2 px-2 text-center ${
                        isActive ? 'text-blue-900 font-bold' : 'text-gray-600'
                      }`}>
                        {parseFloat(rango.limite_superior).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer con información */}
          <div className="mt-3 pt-2 border-t border-gray-200">
            <p className="text-[10px] text-gray-500 text-center italic">
              {isPinned
                ? 'Tooltip fijado. Puedes hacer scroll sin que desaparezca.'
                : 'Pasa el mouse para previsualizar o haz click para fijar'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block cursor-pointer"
        title={isPinned ? "Click para desfijar" : "Click para fijar - Hover para previsualizar"}
      >
        {children}
      </span>

      {tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
}
