import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { HiSearch } from 'react-icons/hi';

const CamionCombobox = ({ camiones, value, onChange, disabled, placeholder = 'Buscar...', excluirPatente = null }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const c = camiones.find(c => c.patente === value);
    setSearch(c ? `${c.nombre} (${c.patente})` : (value || ''));
  }, [value, camiones]);

  useEffect(() => {
    const handler = (e) => {
      const dentroWrap = wrapRef.current?.contains(e.target);
      const dentroDropdown = dropdownRef.current?.contains(e.target);
      if (!dentroWrap && !dentroDropdown) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const calcularPosicion = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 260),
      zIndex: 9999,
    });
  };

  const handleOpen = () => {
    calcularPosicion();
    setOpen(true);
  };

  const disponibles = camiones.filter(c => c.patente !== excluirPatente);
  const filtered = disponibles.filter(c =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || c.patente.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapRef}>
      <div className="relative">
        <HiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); handleOpen(); if (!e.target.value) onChange(''); }}
          onFocus={handleOpen}
          disabled={disabled}
          placeholder={disabled ? 'Cargando...' : placeholder}
          className={`w-full pl-7 pr-2 py-1.5 border-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-orange-400 ${
            value ? 'border-green-300 text-green-800 bg-green-50' : 'border-gray-200'
          } disabled:bg-gray-100`}
        />
      </div>
      {open && !disabled && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-gray-200 rounded-lg shadow-2xl max-h-56 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Sin resultados para "{search}"</div>
          ) : filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.patente); setOpen(false); }}
              className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0 ${
                c.patente === value ? 'bg-blue-50 font-semibold' : ''
              }`}
            >
              <span className="font-mono font-bold text-blue-700 text-sm">{c.patente}</span>
              <span className="text-xs text-gray-400 ml-2">{c.nombre}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CamionCombobox;
