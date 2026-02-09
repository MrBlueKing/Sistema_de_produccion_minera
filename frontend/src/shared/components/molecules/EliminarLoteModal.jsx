import { useState } from 'react';
import {
   HiExclamationTriangle, HiArrowPath, HiTrash, HiExclamationCircle } from 'react-icons/hi2';
import { HiX } from 'react-icons/hi';
import Button from '../atoms/Button';

/**
 * Modal para eliminar un lote con opciones para las camionadas
 *
 * @param {boolean} show - Si se muestra el modal
 * @param {object} lote - Objeto del lote a eliminar {id, numero_lote, camionadas: [...]}
 * @param {function} onConfirm - Función que recibe la opción seleccionada
 * @param {function} onCancel - Función al cancelar
 */
export default function EliminarLoteModal({ show, lote, onConfirm, onCancel }) {
  const [opcionSeleccionada, setOpcionSeleccionada] = useState('reasignar');
  const [loading, setLoading] = useState(false);

  if (!show || !lote) return null;

  const cantidadCamionadas = lote.camionadas?.length || lote.numero_camionadas || 0;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(opcionSeleccionada);
    setLoading(false);
  };

  const opciones = [
    {
      value: 'reasignar',
      label: 'Reasignar a otro lote',
      icon: HiArrowPath,
      color: 'blue',
      description: `Las ${cantidadCamionadas} camionada(s) se reasignarán a otro lote ABIERTO de la misma planta y empresa. Si no existe, se creará uno nuevo.`,
      recommended: true
    },
    {
      value: 'eliminar_camionadas',
      label: 'Eliminar camionadas y restaurar mezclas',
      icon: HiTrash,
      color: 'red',
      description: `Las ${cantidadCamionadas} camionada(s) se eliminarán y sus toneladas se restaurarán a las mezclas de origen. ⚠️ Esta acción no se puede deshacer.`,
      recommended: false
    },
    {
      value: 'dejar_huerfanas',
      label: 'Dejar sin lote (no recomendado)',
      icon: HiExclamationCircle,
      color: 'yellow',
      description: `Las ${cantidadCamionadas} camionada(s) quedarán sin lote asignado (huérfanas). Deberás reasignarlas manualmente después.`,
      recommended: false
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <HiExclamationTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Eliminar Lote
                </h3>
                <p className="text-sm text-gray-600">
                  {lote.numero_lote}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <HiX className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Advertencia */}
            {cantidadCamionadas > 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <span className="font-bold">⚠️ Atención:</span> Este lote tiene{' '}
                  <span className="font-bold">{cantidadCamionadas} camionada(s)</span> asociada(s).
                  Selecciona qué hacer con ellas:
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Este lote no tiene camionadas asociadas. Se eliminará directamente.
                </p>
              </div>
            )}

            {/* Opciones */}
            {cantidadCamionadas > 0 && (
              <div className="space-y-3">
                {opciones.map((opcion) => {
                  const Icon = opcion.icon;
                  const isSelected = opcionSeleccionada === opcion.value;

                  return (
                    <label
                      key={opcion.value}
                      className={`
                        block relative rounded-lg border-2 p-4 cursor-pointer transition-all
                        ${isSelected
                          ? `border-${opcion.color}-500 bg-${opcion.color}-50`
                          : 'border-gray-200 bg-white hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="opcion"
                          value={opcion.value}
                          checked={isSelected}
                          onChange={(e) => setOpcionSeleccionada(e.target.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-5 h-5 text-${opcion.color}-600`} />
                            <span className="font-semibold text-gray-900">
                              {opcion.label}
                            </span>
                            {opcion.recommended && (
                              <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full">
                                Recomendado
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {opcion.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Confirmación final */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <span className="font-bold">Advertencia:</span> La eliminación del lote no se puede deshacer.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end p-6 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Eliminar Lote'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
