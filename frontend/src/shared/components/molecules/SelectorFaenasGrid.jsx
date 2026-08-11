import { useState } from 'react';
import { FaIndustry } from 'react-icons/fa';
import { FAENA_COLORS } from '../../../contexts/faenaColor';

/**
 * Selector de faenas visual con cards (portado desde Sistema_de_gestion_de_petroleo).
 *
 * Modo multi  → selectedFaenas = string[], onToggle(name, isSelected)
 * Modo single → selectedFaena  = id|null,   onSelect(id|null)
 *
 * Props:
 *   faenas         - array de objetos faena (de FAENA_COLORS). Default = todos.
 *   mode           - 'multi' | 'single'. Default = 'multi'.
 *   selectedFaenas - (multi) array de nombres seleccionados.
 *   selectedFaena  - (single) id seleccionado o null.
 *   onToggle       - (multi) callback(name, isSelected).
 *   onSelect       - (single) callback(id|null).
 *   loading        - deshabilita interacción.
 */
const SelectorFaenasGrid = ({
  faenas,
  mode = 'multi',
  selectedFaenas = [],
  selectedFaena = null,
  onToggle,
  onSelect,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(true);

  const listaFaenas = faenas ?? Object.values(FAENA_COLORS);
  const totalFaenas = listaFaenas.length;

  const isSelected = (f) =>
    mode === 'multi'
      ? selectedFaenas.includes(f.name)
      : selectedFaena === f.id;

  const handleClick = (f) => {
    if (loading) return;
    if (mode === 'multi') {
      onToggle?.(f.name, !isSelected(f));
    } else {
      onSelect?.(isSelected(f) ? null : f.id);
    }
  };

  const countLabel =
    mode === 'multi'
      ? `${selectedFaenas.length}/${totalFaenas} faenas seleccionadas`
      : selectedFaena === null
      ? `${totalFaenas}/${totalFaenas} faenas (todas)`
      : `1/${totalFaenas} faena seleccionada`;

  return (
    <div className="mb-4 sm:mb-6">
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-2 rounded-lg shadow-sm">
            <FaIndustry className="text-white text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-gray-800">🏭 Selector de Faenas</h4>
            <p className="text-gray-600 text-xs">{countLabel}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>

        <div className={`${expanded ? 'block' : 'hidden'} sm:block`}>
          {/* Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {listaFaenas.map((f) => {
              const sel = isSelected(f);
              return (
                <button
                  key={f.id}
                  onClick={() => handleClick(f)}
                  disabled={loading}
                  className={`relative overflow-hidden p-2 sm:p-3 rounded-lg border-2 transition-all duration-300 transform active:scale-95 ${
                    sel
                      ? `${f.border} ${f.badge} shadow-md scale-105`
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`absolute top-1 right-1 w-2 h-2 rounded-full transition-all duration-300 ${
                      sel ? 'bg-green-500 shadow-lg' : 'bg-gray-300'
                    }`}
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-1 mb-1">
                      <h5 className={`font-bold text-xs sm:text-sm truncate ${sel ? f.text : 'text-gray-600'}`}>
                        {f.name}
                      </h5>
                    </div>
                  </div>
                  {sel && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 opacity-60"
                      style={{ background: `linear-gradient(to right, ${f.primary}, ${f.dark ?? f.primary})` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectorFaenasGrid;
