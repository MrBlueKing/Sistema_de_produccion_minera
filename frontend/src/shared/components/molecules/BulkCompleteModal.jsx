import { useState, useEffect } from 'react';
import { HiCheckCircle, HiXMark, HiExclamationCircle, HiCalculator, HiDocumentText } from 'react-icons/hi2';
import Button from '../atoms/Button';

/**
 * BulkCompleteModal - Modal con tabla editable para completar múltiples dumpadas
 *
 * Campos de entrada:
 * - Cu Total (ley): Ingresado manualmente
 * - Cu Soluble: Ingresado manualmente
 *
 * Campos automáticos:
 * - Cu Insoluble: Calculado (Cu Total - Cu Soluble)
 * - Ley Cup (capping): Calculado en el backend
 * - Certificado: Se genera al crear el PDF (NO aquí)
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
          cu_soluble: dumpada.cu_soluble || ''
        };
      });
      setFormData(initialData);
    }
  }, [show, dumpadas]);

  if (!show) return null;

  const totalDumpadas = dumpadas.length;

  // Calcular Cu Insoluble automáticamente
  const calcularCuInsoluble = (dumpadaId) => {
    const data = formData[dumpadaId];
    if (!data || !data.ley || !data.cu_soluble) return null;

    const ley = parseFloat(data.ley);
    const cuSoluble = parseFloat(data.cu_soluble);

    if (isNaN(ley) || isNaN(cuSoluble)) return null;

    const cuInsoluble = ley - cuSoluble;
    return cuInsoluble >= 0 ? cuInsoluble.toFixed(2) : null;
  };

  // Validar si una fila está completa (solo ley y cu_soluble requeridos)
  const isRowComplete = (dumpadaId) => {
    const data = formData[dumpadaId];
    if (!data) return false;

    const hasLey = data.ley && parseFloat(data.ley) > 0;
    const hasCuSoluble = data.cu_soluble && parseFloat(data.cu_soluble) >= 0;
    const cuInsoluble = calcularCuInsoluble(dumpadaId);

    return hasLey && hasCuSoluble && cuInsoluble !== null && parseFloat(cuInsoluble) >= 0;
  };

  // Contar cuántas están completas
  const completedCount = Object.keys(formData).filter(id => isRowComplete(id)).length;

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

  // Manejar tecla Enter para navegación rápida
  const handleKeyDown = (e, dumpadaId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Buscar el siguiente input en la misma fila o la siguiente
      const currentRow = e.target.closest('tr');
      const nextInput = e.target.closest('td').nextElementSibling?.querySelector('input');

      if (nextInput) {
        nextInput.focus();
      } else {
        // Si no hay más inputs en la fila, ir a la primera celda de la siguiente fila
        const nextRow = currentRow?.nextElementSibling;
        const firstInputNextRow = nextRow?.querySelector('input');
        if (firstInputNextRow) {
          firstInputNextRow.focus();
        }
      }
    }
  };

  const handleConfirm = () => {
    // Filtrar solo las completas y agregar cu_insoluble calculado
    const completedData = {};
    Object.entries(formData).forEach(([id, data]) => {
      if (isRowComplete(id)) {
        completedData[id] = {
          ley: data.ley,
          cu_soluble: data.cu_soluble,
          cu_insoluble: calcularCuInsoluble(id)
          // certificado NO se envía - se genera al crear el PDF
        };
      }
    });

    if (Object.keys(completedData).length === 0) {
      return;
    }

    onConfirm(completedData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-500 text-white p-6 flex items-center justify-between rounded-t-xl sticky top-0 z-10">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <HiCheckCircle className="w-8 h-8" />
              Completar {totalDumpadas} dumpadas seleccionadas
            </h3>
            <p className="text-green-100 mt-1">
              Ingresa Cu Total y Cu Soluble. El Cu Insoluble se calcula automáticamente.
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
              <HiCalculator className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Ingreso de leyes:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Cu Total (%):</strong> Ingresar manualmente</li>
                  <li><strong>Cu Soluble (%):</strong> Ingresar manualmente</li>
                  <li className="text-green-700"><strong>Cu Insoluble (%):</strong> Se calcula automáticamente (Cu Total - Cu Soluble)</li>
                </ul>
                <p className="mt-2 text-purple-700 flex items-center gap-1">
                  <HiDocumentText className="w-4 h-4" />
                  <strong>Nota:</strong> El número de certificado se asignará al generar el PDF.
                </p>
              </div>
            </div>
          </div>

          {/* Tabla Editable */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2">
                  <th className="text-center py-3 px-2 font-bold text-gray-700 text-xs w-10">✓</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-xs">N° Dump</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-xs">Frente</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-xs">Jornada</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-xs min-w-[120px]">
                    Cu Total (%) <span className="text-red-500">*</span>
                  </th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-xs min-w-[120px]">
                    Cu Soluble (%) <span className="text-red-500">*</span>
                  </th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 text-xs">
                    <span className="flex items-center gap-1">
                      <HiCalculator className="w-4 h-4 text-green-600" />
                      Cu Insoluble (%)
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dumpadas.map((dumpada, index) => {
                  const isComplete = isRowComplete(dumpada.id);
                  const cuInsoluble = calcularCuInsoluble(dumpada.id);
                  const hasError = formData[dumpada.id]?.ley && formData[dumpada.id]?.cu_soluble && cuInsoluble !== null && parseFloat(cuInsoluble) < 0;

                  return (
                    <tr
                      key={dumpada.id}
                      className={`border-b transition-colors ${
                        hasError
                          ? 'bg-red-50 hover:bg-red-100'
                          : isComplete
                          ? 'bg-green-50 hover:bg-green-100'
                          : index % 2 === 0
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {/* Check Icon */}
                      <td className="py-2 px-2 text-center">
                        {hasError ? (
                          <span className="text-red-600 text-xl font-bold">✗</span>
                        ) : isComplete ? (
                          <span className="text-green-600 text-xl font-bold">✓</span>
                        ) : (
                          <span className="text-gray-300 text-xl">○</span>
                        )}
                      </td>

                      {/* N° Dump */}
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-gray-800 text-sm">
                          {dumpada.numero_dumpada ? String(dumpada.numero_dumpada) : '-'}
                        </span>
                      </td>

                      {/* Frente */}
                      <td className="py-2 px-3">
                        <span className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                          {dumpada.frente_trabajo?.codigo_completo || '-'}
                        </span>
                      </td>

                      {/* Jornada */}
                      <td className="py-2 px-3">
                        <span className="bg-purple-100 text-purple-900 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                          {dumpada.jornada}{dumpada.numero_jornada ? `-${dumpada.numero_jornada}` : ''}
                        </span>
                      </td>

                      {/* Cu Total (ley) */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData[dumpada.id]?.ley || ''}
                          onChange={(e) => handleInputChange(dumpada.id, 'ley', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'ley')}
                          placeholder="2.22"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                        />
                      </td>

                      {/* Cu Soluble */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData[dumpada.id]?.cu_soluble || ''}
                          onChange={(e) => handleInputChange(dumpada.id, 'cu_soluble', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'cu_soluble')}
                          placeholder="0.14"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                        />
                      </td>

                      {/* Cu Insoluble (Calculado) */}
                      <td className="py-2 px-3">
                        {cuInsoluble !== null ? (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-mono font-semibold ${
                              parseFloat(cuInsoluble) < 0
                                ? 'bg-red-100 text-red-700 border border-red-300'
                                : 'bg-green-100 text-green-700 border border-green-300'
                            }`}>
                              <HiCalculator className="w-4 h-4" />
                              {cuInsoluble}%
                            </span>
                            {hasError && (
                              <p className="text-red-600 text-[10px] mt-1">Cu Soluble &gt; Cu Total</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Ingrese datos...</span>
                        )}
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
                    ({totalDumpadas - completedCount} incompleta{totalDumpadas - completedCount !== 1 ? 's' : ''})
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
