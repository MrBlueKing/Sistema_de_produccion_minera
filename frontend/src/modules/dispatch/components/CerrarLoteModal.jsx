import React, { useState, useEffect } from 'react';
import { HiX, HiCheckCircle } from 'react-icons/hi';
import Button from '../../../shared/components/atoms/Button';
import { useConfig } from '../../../hooks/useConfig';

const CerrarLoteModal = ({ lote, onConfirm, onCancel }) => {
  const { config, loading: loadingConfig } = useConfig();
  const [formData, setFormData] = useState({
    metodo: 'paladas', // 'paladas', 'toneladas', o 'ninguno'
    numero_paladas: '',
    toneladas_remanente: '',
    observaciones_remanente: ''
  });

  const toneladasPorPalada = config?.toneladas_por_palada || 1.82;

  const calcularToneladas = () => {
    if (formData.metodo === 'paladas' && formData.numero_paladas) {
      return parseFloat(formData.numero_paladas) * toneladasPorPalada;
    }
    if (formData.metodo === 'toneladas' && formData.toneladas_remanente) {
      return parseFloat(formData.toneladas_remanente);
    }
    return 0;
  };

  const handleSubmit = (e) => {
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

    onConfirm(datos);
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
          {/* Información */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-900">
              <strong>Nota:</strong> Al cerrar el lote, las mezclas con toneladas disponibles quedarán como remanentes.
              Opcionalmente, puedes crear un remanente adicional basado en material recogido del suelo.
            </p>
          </div>

          {/* Método de cálculo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              ¿Deseas crear un remanente adicional?
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                     style={{ borderColor: formData.metodo === 'ninguno' ? '#4f46e5' : '#d1d5db' }}>
                <input
                  type="radio"
                  name="metodo"
                  value="ninguno"
                  checked={formData.metodo === 'ninguno'}
                  onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                  className="w-4 h-4 text-indigo-600"
                />
                <div className="ml-3">
                  <span className="font-medium text-gray-900">No, solo cerrar el lote</span>
                  <p className="text-xs text-gray-500">Sin remanente adicional</p>
                </div>
              </label>

              <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                     style={{ borderColor: formData.metodo === 'paladas' ? '#4f46e5' : '#d1d5db' }}>
                <input
                  type="radio"
                  name="metodo"
                  value="paladas"
                  checked={formData.metodo === 'paladas'}
                  onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                  className="w-4 h-4 text-indigo-600"
                />
                <div className="ml-3">
                  <span className="font-medium text-gray-900">Por número de paladas</span>
                  <p className="text-xs text-gray-500">
                    Calcular automáticamente ({toneladasPorPalada} ton/palada)
                  </p>
                </div>
              </label>

              <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                     style={{ borderColor: formData.metodo === 'toneladas' ? '#4f46e5' : '#d1d5db' }}>
                <input
                  type="radio"
                  name="metodo"
                  value="toneladas"
                  checked={formData.metodo === 'toneladas'}
                  onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                  className="w-4 h-4 text-indigo-600"
                />
                <div className="ml-3">
                  <span className="font-medium text-gray-900">Ingresar toneladas directamente</span>
                  <p className="text-xs text-gray-500">Peso exacto del remanente</p>
                </div>
              </label>
            </div>
          </div>

          {/* Campos según método */}
          {formData.metodo === 'paladas' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Paladas Recogidas
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
                Toneladas del Remanente
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
                Observaciones del Remanente (Opcional)
              </label>
              <textarea
                value={formData.observaciones_remanente}
                onChange={(e) => setFormData({ ...formData, observaciones_remanente: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Información adicional sobre el remanente..."
                rows="3"
              />
            </div>
          )}

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
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700"
            >
              Cerrar Lote
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CerrarLoteModal;
