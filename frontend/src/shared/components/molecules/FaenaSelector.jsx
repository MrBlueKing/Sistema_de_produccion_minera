import { useFaena } from '../../../contexts/FaenaContext';

export default function FaenaSelector({ className = '' }) {
  const { esUsuarioGlobal, faenaSeleccionada, cambiarFaena, faenas, loading } = useFaena();

  // No mostrar nada si no es usuario global
  if (!esUsuarioGlobal) {
    return null;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
        Filtrar por Faena:
      </label>
      <select
        value={faenaSeleccionada || ''}
        onChange={(e) => cambiarFaena(e.target.value || null)}
        disabled={loading}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[200px] bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">Todas las faenas</option>
        {faenas.map(faena => (
          <option key={faena.id} value={faena.id}>
            {faena.ubicacion || faena.nombre || `Faena ${faena.id}`}
          </option>
        ))}
      </select>
      {loading && (
        <span className="text-sm text-gray-500">Cargando...</span>
      )}
    </div>
  );
}
