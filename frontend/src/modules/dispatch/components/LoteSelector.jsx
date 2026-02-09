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
 */
const LoteSelector = ({
  plantaId,
  empresaId,
  loteId,
  onChange,
  onNuevoLoteClick,
  disabled = false
}) => {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar lotes abiertos cuando cambia planta o empresa
  useEffect(() => {
    if (plantaId && empresaId) {
      cargarLotesAbiertos();
    } else {
      setLotes([]);
    }
  }, [plantaId, empresaId]);

  const cargarLotesAbiertos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await lotesService.getLotesAbiertos(plantaId, empresaId);
      setLotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando lotes:', err);
      setError('Error al cargar lotes');
      setLotes([]);
    } finally {
      setLoading(false);
    }
  };

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
        disabled={disabled || loading || !plantaId || !empresaId}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
      >
        <option value="">
          {loading ? 'Cargando lotes...' :
           !plantaId || !empresaId ? 'Selecciona planta y empresa primero' :
           'Selecciona un lote'}
        </option>

        {lotes.map(lote => (
          <option key={lote.id} value={lote.id}>
            {lote.numero_lote} - {lote.observaciones || 'Sin observaciones'}
          </option>
        ))}

        {plantaId && empresaId && (
          <option value="crear_nuevo" className="font-bold text-green-600">
            + Crear Nuevo Lote
          </option>
        )}
      </select>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {!loading && lotes.length === 0 && plantaId && empresaId && !error && (
        <p className="text-xs text-gray-500 mt-1">
          No hay lotes abiertos. Crea uno nuevo.
        </p>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Selecciona un lote existente o crea uno nuevo
      </p>
    </div>
  );
};

export default LoteSelector;
