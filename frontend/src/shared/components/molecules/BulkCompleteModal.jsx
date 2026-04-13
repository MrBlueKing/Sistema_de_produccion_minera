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
 */
export default function BulkCompleteModal({ show, dumpadas = [], onConfirm, onCancel }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (show && dumpadas.length > 0) {
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

  const calcularCuInsoluble = (dumpadaId) => {
    const data = formData[dumpadaId];
    if (!data || !data.ley || !data.cu_soluble) return null;
    const ley = parseFloat(data.ley);
    const cuSoluble = parseFloat(data.cu_soluble);
    if (isNaN(ley) || isNaN(cuSoluble)) return null;
    const cuInsoluble = ley - cuSoluble;
    return cuInsoluble >= 0 ? cuInsoluble.toFixed(2) : null;
  };

  const isRowComplete = (dumpadaId) => {
    const data = formData[dumpadaId];
    if (!data) return false;
    const hasLey = data.ley && parseFloat(data.ley) > 0;
    const hasCuSoluble = data.cu_soluble && parseFloat(data.cu_soluble) >= 0;
    const cuInsoluble = calcularCuInsoluble(dumpadaId);
    return hasLey && hasCuSoluble && cuInsoluble !== null && parseFloat(cuInsoluble) >= 0;
  };

  const hasRowError = (dumpadaId) => {
    const data = formData[dumpadaId];
    if (!data || !data.ley || !data.cu_soluble) return false;
    const ley = parseFloat(data.ley);
    const cuSoluble = parseFloat(data.cu_soluble);
    if (isNaN(ley) || isNaN(cuSoluble)) return false;
    return (ley - cuSoluble) < 0;
  };

  const completedCount = Object.keys(formData).filter(id => isRowComplete(id)).length;

  const handleInputChange = (dumpadaId, field, value) => {
    setFormData(prev => ({
      ...prev,
      [dumpadaId]: { ...prev[dumpadaId], [field]: value }
    }));
  };

  const handleKeyDown = (e, dumpadaId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = e.target.closest('td')?.nextElementSibling?.querySelector('input')
        || e.target.closest('tr')?.nextElementSibling?.querySelector('input')
        || e.target.closest('[data-card]')?.querySelector(`[data-field="${field === 'ley' ? 'cu_soluble' : 'ley'}"]`)
        || e.target.closest('[data-card]')?.nextElementSibling?.querySelector('[data-field="ley"]');
      nextInput?.focus();
    }
  };

  const handleConfirm = () => {
    const completedData = {};
    Object.entries(formData).forEach(([id, data]) => {
      if (isRowComplete(id)) {
        completedData[id] = {
          ley: data.ley,
          cu_soluble: data.cu_soluble,
          cu_insoluble: calcularCuInsoluble(id)
        };
      }
    });
    if (Object.keys(completedData).length === 0) return;
    onConfirm(completedData);
  };

  const progressPercent = totalDumpadas > 0 ? (completedCount / totalDumpadas) * 100 : 0;

  return (
    /* Backdrop: translúcido + blur */
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 sm:my-8 flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-4 sm:px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <HiCheckCircle className="w-6 h-6 flex-shrink-0" />
              <span className="truncate">Completar {totalDumpadas} dumpada{totalDumpadas !== 1 ? 's' : ''}</span>
            </h3>
            <p className="text-green-100 text-xs sm:text-sm mt-0.5">
              Ingresa Cu Total y Cu Soluble. El Cu Insoluble se calcula solo.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-3 flex-shrink-0 text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">
              {completedCount} de {totalDumpadas} completadas
            </span>
            {completedCount > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                {Math.round(progressPercent)}% listo
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto max-h-[60vh] sm:max-h-[65vh]">

          {/* Info Helper */}
          <div className="mx-4 sm:mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <HiCalculator className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 space-y-0.5">
                <p><strong>Cu Total (%):</strong> ingresar manualmente</p>
                <p><strong>Cu Soluble (%):</strong> ingresar manualmente</p>
                <p className="text-green-700"><strong>Cu Insoluble (%):</strong> calculado automáticamente (Cu Total − Cu Soluble)</p>
                <p className="text-purple-700 flex items-center gap-1 pt-1">
                  <HiDocumentText className="w-3.5 h-3.5" />
                  El certificado se asigna al generar el PDF.
                </p>
              </div>
            </div>
          </div>

          {/* ── MOBILE: tarjetas ── */}
          <div className="md:hidden px-4 py-4 space-y-3">
            {dumpadas.map((dumpada) => {
              const isComplete = isRowComplete(dumpada.id);
              const hasError = hasRowError(dumpada.id);
              const cuInsoluble = calcularCuInsoluble(dumpada.id);

              return (
                <div
                  key={dumpada.id}
                  data-card
                  className={`rounded-xl border-2 p-3 transition-colors ${
                    hasError
                      ? 'border-red-300 bg-red-50'
                      : isComplete
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Cabecera de tarjeta */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      {dumpada.tipo === 'muestra_libre' ? (
                        <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          {dumpada.nombre || 'Muestra libre'}
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-gray-800 break-all">
                          {dumpada.acopios || '—'}
                        </span>
                      )}
                    </div>
                    <span className="text-lg flex-shrink-0 ml-2">
                      {hasError ? '✗' : isComplete ? '✓' : '○'}
                    </span>
                  </div>

                  {/* Inputs en grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Cu Total (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        data-field="ley"
                        value={formData[dumpada.id]?.ley || ''}
                        onChange={(e) => handleInputChange(dumpada.id, 'ley', e.target.value)}
                        placeholder="2.22"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Cu Soluble (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        data-field="cu_soluble"
                        value={formData[dumpada.id]?.cu_soluble || ''}
                        onChange={(e) => handleInputChange(dumpada.id, 'cu_soluble', e.target.value)}
                        placeholder="0.14"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Cu Insoluble calculado */}
                  {cuInsoluble !== null && (
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold ${
                        hasError
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : 'bg-green-100 text-green-700 border border-green-300'
                      }`}>
                        <HiCalculator className="w-3.5 h-3.5" />
                        Cu Insoluble: {cuInsoluble}%
                      </span>
                      {hasError && (
                        <p className="text-red-600 text-[10px] mt-0.5">Cu Soluble &gt; Cu Total</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP: tabla ── */}
          <div className="hidden md:block mx-4 sm:mx-6 my-4">
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-center py-3 px-2 font-bold text-gray-600 text-xs w-8">✓</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-600 text-xs">Código</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-600 text-xs min-w-[130px]">
                      Cu Total (%) <span className="text-red-500">*</span>
                    </th>
                    <th className="text-left py-3 px-3 font-bold text-gray-600 text-xs min-w-[130px]">
                      Cu Soluble (%) <span className="text-red-500">*</span>
                    </th>
                    <th className="text-left py-3 px-3 font-bold text-gray-600 text-xs">
                      <span className="flex items-center gap-1">
                        <HiCalculator className="w-3.5 h-3.5 text-green-600" />
                        Cu Insoluble (%)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dumpadas.map((dumpada, index) => {
                    const isComplete = isRowComplete(dumpada.id);
                    const hasError = hasRowError(dumpada.id);
                    const cuInsoluble = calcularCuInsoluble(dumpada.id);

                    return (
                      <tr
                        key={dumpada.id}
                        className={`transition-colors ${
                          hasError
                            ? 'bg-red-50'
                            : isComplete
                            ? 'bg-green-50'
                            : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        <td className="py-2 px-2 text-center text-base">
                          {hasError ? (
                            <span className="text-red-500">✗</span>
                          ) : isComplete ? (
                            <span className="text-green-500">✓</span>
                          ) : (
                            <span className="text-gray-300">○</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {dumpada.tipo === 'muestra_libre' ? (
                            <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                              {dumpada.nombre || 'Muestra libre'}
                            </span>
                          ) : (
                            <span className="font-mono text-gray-800 text-xs">
                              {dumpada.acopios || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData[dumpada.id]?.ley || ''}
                            onChange={(e) => handleInputChange(dumpada.id, 'ley', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'ley')}
                            placeholder="2.22"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData[dumpada.id]?.cu_soluble || ''}
                            onChange={(e) => handleInputChange(dumpada.id, 'cu_soluble', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, dumpada.id, 'cu_soluble')}
                            placeholder="0.14"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          {cuInsoluble !== null ? (
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-mono font-semibold ${
                                hasError
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-green-100 text-green-700 border border-green-200'
                              }`}>
                                <HiCalculator className="w-3.5 h-3.5" />
                                {cuInsoluble}%
                              </span>
                              {hasError && (
                                <p className="text-red-600 text-[10px] mt-0.5">Soluble &gt; Total</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {completedCount === 0 ? (
              <span className="flex items-center gap-1.5 text-orange-600">
                <HiExclamationCircle className="w-4 h-4 flex-shrink-0" />
                Completa al menos una fila para guardar
              </span>
            ) : completedCount < totalDumpadas ? (
              <span>
                Se guardarán{' '}
                <strong className="text-green-600">{completedCount}</strong>{' '}
                dumpada{completedCount !== 1 ? 's' : ''}.{' '}
                <span className="text-orange-600">
                  ({totalDumpadas - completedCount} incompleta{totalDumpadas - completedCount !== 1 ? 's' : ''})
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                <HiCheckCircle className="w-4 h-4" />
                ¡Todas completas! Listo para guardar
              </span>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              onClick={handleConfirm}
              disabled={completedCount === 0}
              icon={HiCheckCircle}
              className="flex-1 sm:flex-none"
            >
              Guardar {completedCount > 0 ? completedCount : ''} Dumpada{completedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
