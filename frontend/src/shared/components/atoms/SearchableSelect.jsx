import { useState, useRef, useEffect } from 'react';
import { HiChevronDown, HiMagnifyingGlass, HiXMark } from 'react-icons/hi2';

const BREAKPOINT_MOBILE = 640; // Tailwind 'sm'
const ALTO_PANEL_ESTIMADO = 320; // coincide con el max-h-80 que tenía el panel desktop

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
  multiple = false,
}) {
  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : [];
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: ALTO_PANEL_ESTIMADO });
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < BREAKPOINT_MOBILE
  );
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < BREAKPOINT_MOBILE);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Cerrar dropdown al hacer click fuera (solo aplica al modo desktop — en mobile
  // el selector es una hoja de pantalla completa, se cierra con el botón X)
  useEffect(() => {
    if (isMobile) return;
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
  }, [isMobile]);

  // El dropdown desktop usa position:fixed (ver más abajo) para no quedar recortado
  // cuando este select vive dentro de un contenedor con scroll (ej. tabla de líneas
  // de reportes con overflow-x-auto) — por eso hay que recalcular su posición contra
  // el viewport al abrir, y cerrarlo si la página/tabla se mueve para no dejarlo
  // "flotando" en el lugar viejo. En mobile no aplica (hoja fija a pantalla completa).
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const cerrarPorScroll = (event) => {
      // Ignorar el scroll dentro del propio listado de opciones (o del buscador):
      // el evento 'scroll' no burbujea pero sí se captura en window, así que sin este
      // chequeo, scrollear la lista para ver más opciones cerraba el dropdown solo.
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) return;
      setIsOpen(false);
      setSearchTerm('');
    };
    window.addEventListener('scroll', cerrarPorScroll, true);
    window.addEventListener('resize', cerrarPorScroll);
    return () => {
      window.removeEventListener('scroll', cerrarPorScroll, true);
      window.removeEventListener('resize', cerrarPorScroll);
    };
  }, [isOpen, isMobile]);

  // Bloquea el scroll del fondo mientras la hoja mobile está abierta (cubre toda
  // la pantalla, sin esto la página de atrás se alcanza a mover por debajo).
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [isOpen, isMobile]);

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
  const selectedOption = multiple ? null : options.find(opt => opt.value === value);

  // Texto que muestra el botón
  const triggerLabel = multiple
    ? (selectedValues.length === 0
        ? placeholder
        : selectedValues.length === 1
          ? (options.find(o => o.value === selectedValues[0])?.label ?? `${selectedValues.length} seleccionado`)
          : `${selectedValues.length} seleccionados`)
    : (selectedOption ? selectedOption.label : placeholder);

  const haySeleccion = multiple ? selectedValues.length > 0 : Boolean(value);

  const handleSelect = (optionValue) => {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(next);
      // No se cierra ni se limpia la búsqueda: se pueden marcar varias seguidas.
      return;
    }
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(multiple ? [] : '');
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  // Calcula si el panel desktop cabe abajo del trigger; si no, lo abre hacia arriba
  // y en ambos casos acota su alto máximo al espacio realmente disponible, para que
  // nunca quede cortado contra el borde de la ventana (antes siempre abría hacia
  // abajo sin chequear el espacio disponible).
  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current && !isMobile) {
      const rect = triggerRef.current.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom - 8;
      const espacioArriba = rect.top - 8;
      const abreHaciaArriba = espacioAbajo < ALTO_PANEL_ESTIMADO && espacioArriba > espacioAbajo;

      // El panel no puede ser más angosto que el trigger, pero tampoco queda pegado
      // a su ancho — triggers chicos (ej. la columna "Frente" de la tabla) igual
      // muestran nombres largos completos, sin que se corten en dos líneas.
      const ANCHO_MIN_PANEL = 260;
      const width = Math.max(rect.width, ANCHO_MIN_PANEL);
      const left = Math.min(rect.left, window.innerWidth - width - 8);

      setCoords(
        abreHaciaArriba
          ? {
              bottom: window.innerHeight - rect.top + 4,
              left,
              width,
              maxHeight: Math.min(ALTO_PANEL_ESTIMADO, espacioArriba),
            }
          : {
              top: rect.bottom + 4,
              left,
              width,
              maxHeight: Math.min(ALTO_PANEL_ESTIMADO, espacioAbajo),
            }
      );
    }
    setIsOpen((prev) => !prev);
  };

  const listaOpciones = (
    filteredOptions.length === 0 ? (
      <div className="px-4 py-8 text-center text-gray-500 text-sm">
        {searchTerm ? 'No se encontraron resultados' : emptyMessage}
      </div>
    ) : (
      filteredOptions.map((option) => {
        const marcada = multiple ? selectedValues.includes(option.value) : option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-2 ${
              marcada ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-900'
            }`}
          >
            {multiple && (
              <span
                className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center text-[10px] ${
                  marcada ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                }`}
              >
                {marcada ? '✓' : ''}
              </span>
            )}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })
    )
  );

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
        <span className={`truncate ${haySeleccion ? 'text-gray-900' : 'text-gray-500'}`}>
          {triggerLabel}
        </span>

        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
          {haySeleccion && !disabled && (
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

      {isOpen && isMobile && (
        /* Hoja de pantalla completa (mobile): sin coordenadas fijas que calcular,
           así que no hay nada que el teclado pueda desalinear. El buscador queda
           fijo arriba y la lista scrollea debajo, igual que un picker nativo. */
        <div
          ref={dropdownRef}
          className="fixed inset-0 z-50 bg-white flex flex-col"
        >
          <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="relative flex-1">
              <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
              aria-label="Cerrar"
            >
              <HiXMark className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listaOpciones}
          </div>
        </div>
      )}

      {isOpen && !isMobile && (
        /* Dropdown desktop — position:fixed calculado desde el trigger (ver
           toggleOpen) para no quedar recortado por contenedores con scroll (ej.
           tablas con overflow-x-auto), y con flip hacia arriba + alto acotado
           cuando no cabe hacia abajo. */
        <div
          ref={dropdownRef}
          style={coords}
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden flex flex-col"
        >
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
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

          <div className="flex-1 overflow-y-auto">
            {listaOpciones}
          </div>
        </div>
      )}
    </div>
  );
}
