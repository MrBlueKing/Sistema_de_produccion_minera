import React, { useState, useMemo } from 'react';
import { HiX, HiCheckCircle, HiChevronDown, HiChevronUp, HiInformationCircle } from 'react-icons/hi';
import Button from '../../../shared/components/atoms/Button';
import { useConfig } from '../../../hooks/useConfig';

const CerrarLoteModal = ({ lote, onConfirm, onCancel }) => {
  const { config } = useConfig();
  const [cerrando, setCerrando] = useState(false);
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const [formData, setFormData] = useState({
    metodo: 'ninguno', // 'ninguno', 'paladas', o 'toneladas'
    numero_paladas: '',
    toneladas_remanente: '',
    observaciones_remanente: ''
  });

  const toneladasPorPalada = config?.toneladas_por_palada || 1.82;

  const resumenMezclas = useMemo(() => {
    if (!lote?.camionadas || lote.camionadas.length === 0) return [];

    const mezclasMap = {};
    lote.camionadas.forEach((cam) => {
      const mezclaId = cam.mezcla_id;
      if (!mezclaId) return;

      if (!mezclasMap[mezclaId]) {
        mezclasMap[mezclaId] = {
          mezcla_id: mezclaId,
          codigo: cam.mezcla?.codigo || `Mezcla #${mezclaId}`,
          total_ton: cam.mezcla?.total_ton || 0,
          toneladas_disponibles: cam.mezcla?.toneladas_disponibles || 0,
          peso_real_lote: 0,
          camionadas: 0,
        };
      }

      mezclasMap[mezclaId].peso_real_lote += parseFloat(cam.peso_real || 0);
      mezclasMap[mezclaId].camionadas += 1;
    });

    return Object.values(mezclasMap);
  }, [lote]);

  const totalPesoRealLote = resumenMezclas.reduce((sum, m) => sum + m.peso_real_lote, 0);
  const totalRemanente = resumenMezclas.reduce((sum, m) => sum + parseFloat(m.toneladas_disponibles || 0), 0);

  const calcularToneladas = () => {
    if (formData.metodo === 'paladas' && formData.numero_paladas) {
      return parseFloat(formData.numero_paladas) * toneladasPorPalada;
    }
    if (formData.metodo === 'toneladas' && formData.toneladas_remanente) {
      return parseFloat(formData.toneladas_remanente);
    }
    return 0;
  };

  const handleToggleOpciones = () => {
    setMostrarOpciones((prev) => {
      if (prev) {
        // Al colapsar, resetear selección
        setFormData({ metodo: 'ninguno', numero_paladas: '', toneladas_remanente: '', observaciones_remanente: '' });
      }
      return !prev;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const datos = {};

    if (formData.metodo === 'paladas' && formData.numero_paladas) {
      datos.numero_paladas = parseInt(formData.numero_paladas);
    } else if (formData.metodo === 'toneladas' && formData.toneladas_remanente) {
      datos.toneladas_remanente = parseFloat(formData.toneladas_remanente);
    }

    if (formData.observaciones_remanente) {
      datos.observaciones_remanente = formData.observaciones_remanente;
    }

    setCerrando(true);
    try {
      await onConfirm(datos);
    } finally {
      setCerrando(false);
    }
  };

  const toneladasCalculadas = calcularToneladas();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-5 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <HiCheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Cerrar Lote</h2>
                <p className="text-indigo-100 text-sm mt-1">
                  {lote?.numero_lote || 'Lote'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <HiX className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Resumen de mezclas */}
          {resumenMezclas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen de mezclas en este lote</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Mezcla</th>
                      <th className="text-right px-4 py-2 text-gray-600 font-medium">Total Mezcla</th>
                      <th className="text-right px-4 py-2 text-gray-600 font-medium">Despachado (Lote)</th>
                      <th className="text-right px-4 py-2 text-gray-600 font-medium">Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumenMezclas.map((m) => (
                      <tr key={m.mezcla_id}>
                        <td className="px-4 py-2 font-medium text-gray-900">{m.codigo}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {parseFloat(m.total_ton).toFixed(2)} t
                        </td>
                        <td className="px-4 py-2 text-right text-blue-600 font-medium">
                          {m.peso_real_lote.toFixed(2)} t
                          <span className="text-gray-400 text-xs ml-1">({m.camionadas} cam.)</span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold">
                          <span className={parseFloat(m.toneladas_disponibles || 0) > 0.01 ? 'text-green-600' : 'text-gray-400'}>
                            {parseFloat(m.toneladas_disponibles || 0).toFixed(2)} t
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr className="font-semibold">
                      <td className="px-4 py-2 text-gray-700">Total</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {resumenMezclas.reduce((s, m) => s + parseFloat(m.total_ton), 0).toFixed(2)} t
                      </td>
                      <td className="px-4 py-2 text-right text-blue-700">
                        {totalPesoRealLote.toFixed(2)} t
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={totalRemanente > 0.01 ? 'text-green-700' : 'text-gray-400'}>
                          {totalRemanente.toFixed(2)} t
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalRemanente > 0.01 && (
                <p className="text-xs text-gray-500 mt-2">
                  Las toneladas disponibles ya fueron descontadas al recepcionar. Quedan disponibles para futuros despachos.
                </p>
              )}
            </div>
          )}

          {/* Sección opcional: remanente recogido del suelo */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={handleToggleOpciones}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <HiInformationCircle className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-gray-700">
                  ¿Hubo material recogido del suelo durante el despacho?
                </span>
                {mostrarOpciones && formData.metodo !== 'ninguno' && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    Remanente a registrar
                  </span>
                )}
              </div>
              {mostrarOpciones
                ? <HiChevronUp className="w-5 h-5 text-gray-400" />
                : <HiChevronDown className="w-5 h-5 text-gray-400" />
              }
            </button>

            {mostrarOpciones && (
              <div className="p-4 space-y-4">
                <p className="text-xs text-gray-500">
                  Durante la carga puede quedar material derramado en el suelo que fue recogido con pala cargadora.
                  Si fue el caso, regístralo aquí para que quede disponible para futuros despachos.
                </p>

                <div className="space-y-2">
                  <label
                    className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: formData.metodo === 'paladas' ? '#4f46e5' : '#d1d5db' }}
                  >
                    <input
                      type="radio"
                      name="metodo"
                      value="paladas"
                      checked={formData.metodo === 'paladas'}
                      onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                      className="w-4 h-4 text-indigo-600 mt-0.5"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900 text-sm">Por número de paladas</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Ingresa cuántas paladas se recogieron — el sistema calcula el peso
                        ({toneladasPorPalada} ton/palada)
                      </p>
                    </div>
                  </label>

                  <label
                    className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: formData.metodo === 'toneladas' ? '#4f46e5' : '#d1d5db' }}
                  >
                    <input
                      type="radio"
                      name="metodo"
                      value="toneladas"
                      checked={formData.metodo === 'toneladas'}
                      onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                      className="w-4 h-4 text-indigo-600 mt-0.5"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900 text-sm">Ingresar toneladas directamente</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Si tienes el peso exacto del material recogido (por báscula u otro medio)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Campos según método */}
                {formData.metodo === 'paladas' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de paladas recogidas
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.numero_paladas}
                      onChange={(e) => setFormData({ ...formData, numero_paladas: e.target.value })}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                      placeholder="Ej: 12"
                      required
                    />
                    {formData.numero_paladas && (
                      <div className="mt-2 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                        <p className="text-sm text-green-900">
                          <strong>Toneladas calculadas:</strong> {toneladasCalculadas.toFixed(2)} t
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          {formData.numero_paladas} paladas × {toneladasPorPalada} ton/palada
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {formData.metodo === 'toneladas' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Toneladas del material recogido
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.toneladas_remanente}
                      onChange={(e) => setFormData({ ...formData, toneladas_remanente: e.target.value })}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                      placeholder="0.00"
                      required
                    />
                  </div>
                )}

                {formData.metodo !== 'ninguno' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones (opcional)
                    </label>
                    <textarea
                      value={formData.observaciones_remanente}
                      onChange={(e) => setFormData({ ...formData, observaciones_remanente: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Información adicional sobre el remanente..."
                      rows="2"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4 pt-4 border-t-2 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="px-6 py-3"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={HiCheckCircle}
              disabled={cerrando}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700"
            >
              {cerrando ? 'Cerrando...' : 'Cerrar Lote'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CerrarLoteModal;
