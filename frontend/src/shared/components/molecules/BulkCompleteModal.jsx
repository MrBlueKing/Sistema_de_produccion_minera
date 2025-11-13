import { useState, useEffect } from 'react';
import { HiCheckCircle, HiXMark, HiExclamationCircle } from 'react-icons/hi2';
import Button from '../atoms/Button';

/**
 * BulkCompleteModal - Modal con tabla editable para completar múltiples dumpadas
 *
 * @param {boolean} show - Mostrar/ocultar modal
 * @param {array} dumpadas - Array de dumpadas seleccionadas a completar
 * @param {function} onConfirm - Callback con los datos completados
 * @param {function} onCancel - Callback al cancelar
 */
export default function BulkCompleteModal({ show, dumpadas = [], onConfirm, onCancel }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (show && dumpadas.length > 0) {
      // Inicializar formData con valores vacíos o existentes para cada dumpada
      const initialData = {};
      dumpadas.forEach(dumpada => {
        initialData[dumpada.id] = {
          ley: dumpada.ley || '',
          ley_cup: dumpada.ley_cup || '',
          certificado: dumpada.certificado || ''
        };
      });
      setFormData(initialData);
    }
  }, [show, dumpadas]);

  if (!show) return null;

  const totalDumpadas = dumpadas.length;

  // Validar si una fila está completa
  const isRowComplete = (dumpadaId) => {
    const data = formData[dumpadaId];
    if (!data) return false;
    return data.ley && data.ley_cup && data.certificado;
  };

  // Contar cuántas están completas
  const completedCount = Object.keys(formData).filter(id => isRowComplete(id)).length;

  // Validar si todas están completas
  const allComplete = completedCount === totalDumpadas;

  // Manejar cambio en input
  const handleInputChange = (dumpadaId, field, value) => {
    setFormData(prev => ({
      ...prev,
      [dumpadaId]: {
        ...prev[dumpadaId],
        [field]: value
      }
    }));
  };

  // Manejar tecla Tab para navegación rápida
  const handleKeyDown = (e, dumpadaId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = e.target.closest('td').nextElementSibling?.querySelector('input');
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleConfirm = () => {
    // Filtrar solo las completas
    const completedData = {};
    Object.entries(formData).forEach(([id, data]) => {
      if (isRowComplete(id)) {
        completedData[id] = data;
      }
    });

    if (Object.keys(completedData).length === 0) {
      return;
    }

    onConfirm(completedData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-500 text-white p-6 flex items-center justify-between rounded-t-xl sticky top-0 z-10">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <HiCheckCircle className="w-8 h-8" />
              Completar {totalDumpadas} dumpadas seleccionadas
            </h3>
            <p className="text-green-100 mt-1">
              Completa los campos de cada registro en la tabla
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-100 p-4 border-b sticky top-[88px] z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Progreso: {completedCount} de {totalDumpadas} completadas
            </span>
            <div className="flex items-center gap-2">
              {completedCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                  {Math.round((completedCount / totalDumpadas) * 100)}% listo
                </span>
              )}
            </div>
          </div>
          <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
              style={{ width: `${(completedCount / totalDumpadas) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-6">
          {/* Info Helper */}
          <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <HiExclamationCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">💡 Tips para completar rápido:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Usa <kbd className="px-2 py-1 bg-blue-200 rounded">Tab</kbd> para moverte entre campos</li>
                  <li>Usa <kbd className="px-2 py-1 bg-blue-200 rounded">Enter</kbd> para saltar al siguiente campo</li>
                  <li>Las filas completas se marcan en verde ✓</li>
                  <li>Solo se guardarán las filas completas</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tabla Editable */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2">
                  <th className="text-center py-3 px-3 font-bold text-gray-700 text-sm w-12">✓</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-sm">Acopio</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-sm">Frente</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-sm">Jornada</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-sm">
                    Ley (%) <span className="text-red-500">*</span>
                  </th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-sm">
                    Ley Cup (%) <span className="text-red-500">*</span>
                  </th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-sm">
                    Certificado <span className="text-red-500">*</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dumpadas.map((dumpada, index) => {
                  const isComplete = isRowComplete(dumpada.id);
                  return (
                    <tr
                      key={dumpada.id}
                      className={`border-b transition-colors ${
                        isComplete
                          ? 'bg-green-50 hover:bg-green-100'
                          : index % 2 === 0
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {/* Check Icon */}
                      <td className="py-2 px-3 text-center">
                        {isComplete ? (
                          <span className="text-green-600 text-xl font-bold">✓</span>
                        ) : (
                          <span className="text-gray-300 text-xl">○</span>
                        )}
                      </td>

                      {/* Acopio */}
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-gray-800 text-sm">
                          {dumpada.n_acop ? String(dumpada.n_acop).padStart(3, '0') : '-'}
                        </span>
                      </td>

                      {/* Frente */}
                      <td className="py-2 px-3">
                        <span className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs font-semibold">
                          {dumpada.frente_trabajo?.codigo_completo || '-'}
                        </span>
                      </td>

                      {/* Jornada */}
                      <td className="py-2 px-3">
                        <span className="bg-purple-100 text-purple-900 px-2 py-1 rounded text-xs font-semibold">
                          {dumpada.jornada}
                        </span>
                      </td>

                      {/* Ley */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.001"
                          value={formData[dumpada.id]?.ley || ''}
                          onChange={(e) => handleInputChange(dumpada.id, 'ley', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'ley')}
                          placeholder="2.500"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </td>

                      {/* Ley Cup */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.001"
                          value={formData[dumpada.id]?.ley_cup || ''}
                          onChange={(e) => handleInputChange(dumpada.id, 'ley_cup', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'ley_cup')}
                          placeholder="0.850"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </td>

                      {/* Certificado */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={formData[dumpada.id]?.certificado || ''}
                          onChange={(e) => handleInputChange(dumpada.id, 'certificado', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'certificado')}
                          placeholder="C-001"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer con Resumen */}
          <div className="mt-6 flex items-center justify-between pt-6 border-t">
            <div className="text-sm text-gray-600">
              {completedCount === 0 ? (
                <span className="flex items-center gap-2 text-orange-600">
                  <HiExclamationCircle className="w-5 h-5" />
                  Completa al menos una fila para guardar
                </span>
              ) : completedCount < totalDumpadas ? (
                <span className="text-gray-700">
                  Se guardarán <strong className="text-green-600">{completedCount}</strong> dumpada{completedCount !== 1 ? 's' : ''}.
                  <span className="text-orange-600 ml-2">
                    ({totalDumpadas - completedCount} incompleta{totalDumpadas - completedCount !== 1 ? 's' : ''} será{totalDumpadas - completedCount !== 1 ? 'n' : ''} ignorada{totalDumpadas - completedCount !== 1 ? 's' : ''})
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-600 font-semibold">
                  <HiCheckCircle className="w-5 h-5" />
                  ¡Todas completas! Listo para guardar
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleConfirm}
                disabled={completedCount === 0}
                icon={HiCheckCircle}
              >
                Guardar {completedCount > 0 ? `${completedCount}` : ''} Dumpada{completedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
