import React, { useState, useEffect } from 'react';
import { HiPlus, HiCube } from 'react-icons/hi';
import lotesService from '../../../services/lotes';

/**
 * Componente atómico para seleccionar o crear un lote
 * @param {number} plantaId - ID de la planta seleccionada
 * @param {number} empresaId - ID de la empresa seleccionada
 * @param {number} loteId - ID del lote seleccionado
 * @param {function} onChange - Callback cuando cambia la selección (loteId)
 * @param {function} onNuevoLoteClick - Callback cuando se hace click en "Crear Nuevo Lote"
 * @param {boolean} disabled - Si el selector está deshabilitado
 * @param {number} excludeId - ID de lote a excluir de la lista (ej. el que se está eliminando)
 * @param {boolean} allowCrearNuevo - Si se muestra la opción "+ Crear Nuevo Lote"
 * @param {boolean} requierePlantaEmpresa - Si es false, lista TODOS los lotes abiertos (de la faena del usuario) sin filtrar por planta/empresa
 */
const LoteSelector = ({
  plantaId,
  empresaId,
  loteId,
  onChange,
  onNuevoLoteClick,
  disabled = false,
  excludeId = null,
  allowCrearNuevo = true,
  requierePlantaEmpresa = true
}) => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const puedeCargar = !requierePlantaEmpresa || (plantaId && empresaId);

  // Cargar lotes abiertos cuando cambia planta o empresa
  useEffect(() => {
    if (puedeCargar) {
      cargarLotesAbiertos();
    } else {
      setLotes([]);
    }
  }, [plantaId, empresaId, requierePlantaEmpresa]);

  const cargarLotesAbiertos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = requierePlantaEmpresa
        ? await lotesService.getLotesAbiertos(plantaId, empresaId)
        : await lotesService.getLotesAbiertos();
      setLotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando lotes:', err);
      setError('Error al cargar lotes');
      setLotes([]);
    } finally {
      setLoading(false);
    }
  };

  const lotesFiltrados = excludeId
    ? lotes.filter(lote => lote.id !== excludeId)
    : lotes;

  const handleChange = (e) => {
    const value = e.target.value;

    if (value === 'crear_nuevo') {
      onNuevoLoteClick && onNuevoLoteClick();
    } else {
      onChange && onChange(value ? parseInt(value) : null);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <HiCube className="inline mr-1" />
        Lote *
      </label>

      <select
        name="lote_id"
        value={loteId || ''}
        onChange={handleChange}
        disabled={disabled || loading || !puedeCargar}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
      >
        <option value="">
          {loading ? 'Cargando lotes...' :
           !puedeCargar ? 'Selecciona planta y empresa primero' :
           'Selecciona un lote'}
        </option>

        {lotesFiltrados.map(lote => (
          <option key={lote.id} value={lote.id}>
            {lote.numero_lote || 'Sin número'}
            {!requierePlantaEmpresa && (lote.planta || lote.empresa)
              ? ` — ${lote.planta?.nombre || '?'} / ${lote.empresa?.nombre || '?'}`
              : ` - ${lote.observaciones || 'Sin observaciones'}`}
          </option>
        ))}

        {allowCrearNuevo && puedeCargar && (
          <option value="crear_nuevo" className="font-bold text-green-600">
            + Crear Nuevo Lote
          </option>
        )}
      </select>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {!loading && lotesFiltrados.length === 0 && puedeCargar && !error && (
        <p className="text-xs text-gray-500 mt-1">
          {allowCrearNuevo ? 'No hay lotes abiertos. Crea uno nuevo.' : 'No hay otro lote abierto disponible.'}
        </p>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Selecciona un lote existente o crea uno nuevo
      </p>
    </div>
  );
};

export default LoteSelector;
