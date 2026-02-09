import { useState, useEffect } from 'react';
import { HiCube, HiCheckCircle, HiTrash } from 'react-icons/hi2';
import { HiX } from 'react-icons/hi';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import acopiosService from '../../../services/acopios';

/**
 * Modal para editar un acopio
 *
 * @param {boolean} show - Mostrar/ocultar modal
 * @param {Object} acopio - Acopio a editar
 * @param {Function} onClose - Callback cuando se cierra
 * @param {Function} onSuccess - Callback cuando se edita exitosamente
 * @param {Function} toast - Función para mostrar mensajes
 * @param {Function} formatearFecha - Función para formatear fechas
 */
export default function AcopioEditModal({ show, acopio, onClose, onSuccess, toast, formatearFecha }) {
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [dumpadas, setDumpadas] = useState([]);
  const [dumpadasDisponibles, setDumpadasDisponibles] = useState([]);
  const [dumpadasAgregar, setDumpadasAgregar] = useState([]);
  const [dumpadasQuitar, setDumpadasQuitar] = useState([]);
  const [vistaActual, setVistaActual] = useState('editar'); // 'editar' | 'agregar' | 'quitar'

  useEffect(() => {
    if (show && acopio) {
      setNombre(acopio.nombre || '');
      setObservaciones(acopio.observaciones || '');
      loadDumpadas();
      loadDumpadasDisponibles();
      setDumpadasAgregar([]);
      setDumpadasQuitar([]);
      setVistaActual('editar');
    }
  }, [show, acopio]);

  const loadDumpadas = async () => {
    try {
      const response = await acopiosService.getAcopio(acopio.id);
      setDumpadas(response.data.dumpadas || []);
    } catch (error) {
      console.error('Error cargando dumpadas:', error);
      toast?.error('Error', error.response?.data?.message || error.message);
    }
  };

  const loadDumpadasDisponibles = async () => {
    try {
      const response = await acopiosService.getDumpadasSinAcopio();
      setDumpadasDisponibles(response.data || []);
    } catch (error) {
      console.error('Error cargando dumpadas disponibles:', error);
    }
  };

  const handleGuardarCambios = async () => {
    setLoading(true);
    try {
      // Agregar dumpadas si hay
      if (dumpadasAgregar.length > 0) {
        await acopiosService.agregarDumpadas(acopio.id, dumpadasAgregar);
      }

      // Quitar dumpadas si hay
      if (dumpadasQuitar.length > 0) {
        await acopiosService.quitarDumpadas(acopio.id, dumpadasQuitar);
      }

      toast?.success('Acopio actualizado', 'Los cambios han sido guardados exitosamente');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error guardando cambios:', error);
      toast?.error('Error al guardar cambios', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDumpadaAgregar = (dumpadaId) => {
    setDumpadasAgregar(prev => {
      if (prev.includes(dumpadaId)) {
        return prev.filter(id => id !== dumpadaId);
      } else {
        return [...prev, dumpadaId];
      }
    });
  };

  const toggleDumpadaQuitar = (dumpadaId) => {
    setDumpadasQuitar(prev => {
      if (prev.includes(dumpadaId)) {
        return prev.filter(id => id !== dumpadaId);
      } else {
        return [...prev, dumpadaId];
      }
    });
  };

  if (!show) return null;

  const puedeEditar = acopio?.estado !== 'EN_MEZCLA';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <HiCube className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Editar Acopio</h2>
              <p className="text-sm text-purple-100">{acopio?.codigo_acopio}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {/* Mensaje de bloqueo si está en mezcla */}
        {!puedeEditar && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-6 mt-4">
            <div className="flex items-center gap-2">
              <HiX className="w-5 h-5 text-red-600" />
              <p className="text-red-800 font-semibold">
                Este acopio está EN MEZCLA y no puede ser editado
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            onClick={() => setVistaActual('editar')}
            className={`px-4 py-3 font-semibold transition-colors ${
              vistaActual === 'editar'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Información
          </button>
          <button
            onClick={() => setVistaActual('agregar')}
            className={`px-4 py-3 font-semibold transition-colors ${
              vistaActual === 'agregar'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
            disabled={!puedeEditar}
          >
            Agregar Dumpadas ({dumpadasAgregar.length})
          </button>
          <button
            onClick={() => setVistaActual('quitar')}
            className={`px-4 py-3 font-semibold transition-colors ${
              vistaActual === 'quitar'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
            disabled={!puedeEditar}
          >
            Quitar Dumpadas ({dumpadasQuitar.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Vista: Información */}
          {vistaActual === 'editar' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-700 mb-1">Tipo</p>
                  <p className="font-bold text-blue-900">{acopio.tipo}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-700 mb-1">Estado</p>
                  <p className="font-bold text-green-900">{acopio.estado}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-700 mb-1">Dumpadas</p>
                  <p className="text-2xl font-bold text-purple-900">{acopio.cantidad_dumpadas}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-orange-700 mb-1">Total</p>
                  <p className="text-2xl font-bold text-orange-900">{acopio.total_toneladas} ton</p>
                </div>
              </div>

              {acopio.frente_trabajo && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Frente de Trabajo</p>
                      <p className="font-bold text-gray-900">{acopio.frente_trabajo.codigo_completo}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Jornada</p>
                      <p className="font-bold text-gray-900">{acopio.jornada}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Fecha</p>
                      <p className="font-bold text-gray-900">{formatearFecha(acopio.fecha)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Input
                  label="Nombre del Acopio (opcional)"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Alta Ley para Venta"
                  disabled={!puedeEditar}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas sobre este acopio..."
                  rows="4"
                  disabled={!puedeEditar}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100"
                />
              </div>

              {/* Dumpadas actuales */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-4">
                  Dumpadas en el Acopio ({dumpadas.length})
                </h4>
                {dumpadas.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-100">
                          <th className="text-left py-2 px-2 font-bold text-gray-900">N° Dump</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-900">Frente</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-900">Jornada</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-900">Fecha</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-900">Toneladas</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-900">Ley</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-900">Ley Visual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dumpadas.map((dumpada, index) => (
                          <tr key={dumpada.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="py-2 px-2 font-mono font-bold text-gray-800">{dumpada.numero_dumpada || '-'}</td>
                            <td className="py-2 px-2 font-bold text-blue-900">
                              {dumpada.frente_trabajo?.codigo_completo || 'N/A'}
                            </td>
                            <td className="py-2 px-2">{dumpada.jornada}</td>
                            <td className="py-2 px-2">{formatearFecha(dumpada.fecha)}</td>
                            <td className="py-2 px-2 font-semibold">{dumpada.ton}</td>
                            <td className="py-2 px-2">
                              {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(3)}%` : '-'}
                            </td>
                            <td className="py-2 px-2">
                              {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(3)}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-600 py-4">No hay dumpadas en este acopio</p>
                )}
              </div>
            </div>
          )}

          {/* Vista: Agregar Dumpadas */}
          {vistaActual === 'agregar' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-blue-800">
                  Selecciona las dumpadas que deseas agregar a este acopio
                </p>
              </div>

              {dumpadasDisponibles.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  No hay dumpadas disponibles sin acopio
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dumpadasDisponibles.map((dumpada) => (
                    <label
                      key={dumpada.id}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        dumpadasAgregar.includes(dumpada.id)
                          ? 'border-purple-500 bg-purple-100'
                          : 'border-gray-300 bg-white hover:border-purple-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dumpadasAgregar.includes(dumpada.id)}
                        onChange={() => toggleDumpadaAgregar(dumpada.id)}
                        className="w-5 h-5 text-purple-600"
                      />
                      <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="font-bold text-purple-900">
                            {dumpada.frente_trabajo?.codigo_completo || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="bg-purple-600 text-white px-2 py-0.5 rounded-full text-xs">
                            {dumpada.jornada}
                          </span>
                        </div>
                        <div className="text-gray-700">
                          {formatearFecha(dumpada.fecha)}
                        </div>
                        <div className="text-gray-700">
                          {dumpada.ton} ton • Ley: {dumpada.ley_visual}%
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {dumpadasAgregar.length > 0 && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <p className="text-green-900 font-semibold">
                    {dumpadasAgregar.length} dumpada(s) seleccionada(s) para agregar
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Vista: Quitar Dumpadas */}
          {vistaActual === 'quitar' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
                <p className="text-orange-800">
                  Selecciona las dumpadas que deseas quitar de este acopio
                </p>
              </div>

              {dumpadas.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  No hay dumpadas en este acopio
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dumpadas.map((dumpada) => (
                    <label
                      key={dumpada.id}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        dumpadasQuitar.includes(dumpada.id)
                          ? 'border-red-500 bg-red-100'
                          : 'border-gray-300 bg-white hover:border-red-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dumpadasQuitar.includes(dumpada.id)}
                        onChange={() => toggleDumpadaQuitar(dumpada.id)}
                        className="w-5 h-5 text-red-600"
                      />
                      <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="font-bold text-red-900">
                            {dumpada.frente_trabajo?.codigo_completo || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs">
                            {dumpada.jornada}
                          </span>
                        </div>
                        <div className="text-gray-700">
                          {formatearFecha(dumpada.fecha)}
                        </div>
                        <div className="text-gray-700">
                          {dumpada.ton} ton • Ley: {dumpada.ley_visual}%
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {dumpadasQuitar.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-900 font-semibold">
                    {dumpadasQuitar.length} dumpada(s) seleccionada(s) para quitar
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
          <div className="text-sm text-gray-600">
            {dumpadasAgregar.length > 0 && (
              <span className="text-green-700 font-semibold">
                +{dumpadasAgregar.length} agregar
              </span>
            )}
            {dumpadasAgregar.length > 0 && dumpadasQuitar.length > 0 && ' | '}
            {dumpadasQuitar.length > 0 && (
              <span className="text-red-700 font-semibold">
                -{dumpadasQuitar.length} quitar
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Cancelar
            </Button>
            {puedeEditar && (
              <Button
                variant="primary"
                onClick={handleGuardarCambios}
                disabled={loading || (dumpadasAgregar.length === 0 && dumpadasQuitar.length === 0)}
              >
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
