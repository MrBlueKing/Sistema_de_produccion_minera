import { useState } from 'react';
import { HiCheckCircle, HiExclamationCircle, HiPlus, HiCube } from 'react-icons/hi2';
import { HiX } from 'react-icons/hi';
import Button from '../atoms/Button';
import Card from '../atoms/Card';

/**
 * Modal para seleccionar qué hacer cuando se detectan acopios existentes
 *
 * @param {boolean} show - Mostrar/ocultar modal
 * @param {Array} grupos - Grupos de dumpadas con acopios detectados
 * @param {Function} onConfirm - Callback cuando se confirma selección: (decisiones) => void
 * @param {Function} onCancel - Callback cuando se cancela
 */
export default function AcopioSelectionModal({ show, grupos = [], onConfirm, onCancel }) {
  // Estado para las decisiones de cada grupo
  // { grupoIndex: 'AGREGAR_EXISTENTE' | 'CREAR_NUEVO' | 'SIN_ACOPIO' }
  const [decisiones, setDecisiones] = useState({});

  if (!show) return null;

  const handleDecisionChange = (grupoIndex, decision) => {
    setDecisiones(prev => ({
      ...prev,
      [grupoIndex]: decision
    }));
  };

  const handleConfirm = () => {
    // Validar que todos los grupos tengan una decisión
    const todasDecididas = grupos.every((_, index) => decisiones[index]);

    if (!todasDecididas) {
      alert('Debes seleccionar una opción para cada grupo');
      return;
    }

    onConfirm(decisiones);
  };

  const getDecisionIcon = (decision) => {
    const icons = {
      'AGREGAR_EXISTENTE': <HiCheckCircle className="w-5 h-5" />,
      'CREAR_NUEVO': <HiPlus className="w-5 h-5" />,
      'SIN_ACOPIO': <HiExclamationCircle className="w-5 h-5" />
    };
    return icons[decision] || null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <HiCube className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Acopios Detectados</h2>
              <p className="text-sm text-blue-100">
                Se encontraron acopios existentes. ¿Qué deseas hacer?
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {grupos.map((grupo, grupoIndex) => {
            const acopioExistente = grupo.acopio_existente;
            const cantidadNuevas = grupo.dumpadas?.length || 0;
            const decision = decisiones[grupoIndex];

            return (
              <Card key={grupoIndex} className="border-2 border-blue-200">
                {/* Info del grupo */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-blue-900 text-lg mb-2">
                        Grupo {grupoIndex + 1}
                      </h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 font-semibold">Frente:</span>
                          <p className="text-blue-900 font-bold">
                            {grupo.frente_trabajo?.codigo_completo || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-blue-700 font-semibold">Jornada:</span>
                          <p className="text-blue-900 font-bold">{grupo.jornada}</p>
                        </div>
                        <div>
                          <span className="text-blue-700 font-semibold">Fecha:</span>
                          <p className="text-blue-900 font-bold">{grupo.fecha}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {cantidadNuevas} nueva{cantidadNuevas !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Acopio existente */}
                {acopioExistente && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <HiCheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-yellow-900 mb-2">
                          📦 Acopio Existente: {acopioExistente.codigo_acopio}
                        </h4>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-yellow-700">Estado:</span>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                              acopioExistente.estado === 'ABIERTO'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {acopioExistente.estado}
                            </span>
                          </div>
                          <div>
                            <span className="text-yellow-700">Dumpadas actuales:</span>
                            <span className="ml-2 font-bold text-yellow-900">
                              {acopioExistente.cantidad_dumpadas}
                            </span>
                          </div>
                          <div>
                            <span className="text-yellow-700">Total:</span>
                            <span className="ml-2 font-bold text-yellow-900">
                              {acopioExistente.total_toneladas} ton
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Opciones de decisión */}
                <div className="space-y-3">
                  <p className="font-semibold text-gray-700 mb-3">
                    ¿Qué deseas hacer con estas {cantidadNuevas} dumpadas nuevas?
                  </p>

                  {/* Opción 1: Agregar a existente */}
                  {acopioExistente && (
                    <label
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        decision === 'AGREGAR_EXISTENTE'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`decision-${grupoIndex}`}
                        value="AGREGAR_EXISTENTE"
                        checked={decision === 'AGREGAR_EXISTENTE'}
                        onChange={(e) => handleDecisionChange(grupoIndex, e.target.value)}
                        className="mt-1 w-5 h-5 text-green-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <HiCheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-gray-900">
                            Agregar al acopio {acopioExistente.numero_acopio} existente
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Total después: {acopioExistente.cantidad_dumpadas + cantidadNuevas} dumpadas,
                          {' '}{(parseFloat(acopioExistente.total_toneladas) + (cantidadNuevas * 4.6)).toFixed(2)} ton
                        </p>
                      </div>
                    </label>
                  )}

                  {/* Opción 2: Crear nuevo */}
                  <label
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      decision === 'CREAR_NUEVO'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`decision-${grupoIndex}`}
                      value="CREAR_NUEVO"
                      checked={decision === 'CREAR_NUEVO'}
                      onChange={(e) => handleDecisionChange(grupoIndex, e.target.value)}
                      className="mt-1 w-5 h-5 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <HiPlus className="w-5 h-5 text-blue-600" />
                        <span className="font-bold text-gray-900">
                          Crear un nuevo acopio
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Se creará un acopio separado con {cantidadNuevas} dumpadas
                        {acopioExistente && ' (útil si quieres separar por alguna razón)'}
                      </p>
                    </div>
                  </label>

                  {/* Opción 3: Sin acopio */}
                  <label
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      decision === 'SIN_ACOPIO'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`decision-${grupoIndex}`}
                      value="SIN_ACOPIO"
                      checked={decision === 'SIN_ACOPIO'}
                      onChange={(e) => handleDecisionChange(grupoIndex, e.target.value)}
                      className="mt-1 w-5 h-5 text-orange-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <HiExclamationCircle className="w-5 h-5 text-orange-600" />
                        <span className="font-bold text-gray-900">
                          Dejar sin acopio (asignar manualmente después)
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Las dumpadas quedarán disponibles en "Dumpadas sin acopio"
                      </p>
                    </div>
                  </label>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
          <p className="text-sm text-gray-600">
            {Object.keys(decisiones).length} de {grupos.length} grupo(s) configurado(s)
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={Object.keys(decisiones).length !== grupos.length}
            >
              Confirmar y Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
