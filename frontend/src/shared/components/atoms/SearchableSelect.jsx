import { useState, useRef, useEffect } from 'react';
import { HiChevronDown, HiMagnifyingGlass, HiXMark } from 'react-icons/hi2';

/**
 * SearchableSelect - Select con búsqueda integrada
 *
 * @param {string} label - Etiqueta del campo
 * @param {array} options - Array de opciones [{value, label}]
 * @param {string|number} value - Valor seleccionado
 * @param {function} onChange - Callback al cambiar valor
 * @param {string} placeholder - Placeholder
 * @param {boolean} required - Campo requerido
 * @param {boolean} disabled - Campo deshabilitado
 * @param {string} emptyMessage - Mensaje cuando no hay opciones
 */
export default function SearchableSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Buscar...',
  required = false,
  disabled = false,
  emptyMessage = 'No hay opciones disponibles',
  size = 'default',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        triggerRef.current && !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // El dropdown usa position:fixed (ver más abajo) para no quedar recortado cuando este
  // select vive dentro de un contenedor con scroll (ej. tabla de líneas de reportes con
  // overflow-x-auto) — por eso hay que recalcular su posición contra el viewport al abrir,
  // y cerrarlo si la página/tabla se mueve para no dejarlo "flotando" en el lugar viejo.
  useEffect(() => {
    if (!isOpen) return;

    const cerrarPorScroll = () => {
      setIsOpen(false);
      setSearchTerm('');
    };
    window.addEventListener('scroll', cerrarPorScroll, true);
    window.addEventListener('resize', cerrarPorScroll);
    return () => {
      window.removeEventListener('scroll', cerrarPorScroll, true);
      window.removeEventListener('resize', cerrarPorScroll);
    };
  }, [isOpen]);

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filtrar opciones por búsqueda
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Obtener opción seleccionada
  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={`w-full text-left bg-white border rounded-lg flex items-center justify-between transition-all ${
          size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2.5 text-sm'
        } ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed text-gray-500'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-200'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={`truncate ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
          {value && !disabled && (
            <HiXMark
              className={`text-gray-400 hover:text-gray-600 ${size === 'sm' ? 'w-3 h-3' : 'w-5 h-5'}`}
              onClick={handleClear}
            />
          )}
          <HiChevronDown
            className={`text-gray-400 transition-transform ${size === 'sm' ? 'w-3 h-3' : 'w-5 h-5'} ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown — position:fixed calculado desde el trigger (ver toggleOpen) para no
          quedar recortado por contenedores con scroll (ej. tablas con overflow-x-auto) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{ top: coords.top, left: coords.left, width: coords.width }}
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-64">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                {searchTerm ? 'No se encontraron resultados' : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${
                    option.value === value
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-900'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
