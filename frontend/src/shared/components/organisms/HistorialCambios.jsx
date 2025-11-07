import { useState, useEffect } from 'react';
import { HiClock, HiXMark, HiArrowPath, HiArrowUturnLeft } from 'react-icons/hi2';
import PropTypes from 'prop-types';
import Card from '../atoms/Card';
import Button from '../atoms/Button';
import AlertMessage from '../molecules/AlertMessage';
import ConfirmModal from '../molecules/ConfirmModal';

/**
 * Componente para mostrar el historial de cambios de un registro
 */
export default function HistorialCambios({ show, onClose, frenteId, loadHistorial, onRevertir, onSuccess, title = 'Historial de Cambios' }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [revertirModal, setRevertirModal] = useState({ show: false, auditoriaId: null, fecha: '', cambios: [] });

  useEffect(() => {
    if (show && frenteId) {
      cargarHistorial();
    }
  }, [show, frenteId]);

  const cargarHistorial = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await loadHistorial(frenteId);
      setHistorial(response.data.historial || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError('No se pudo cargar el historial de cambios');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertir = (item) => {
    // Solo permitir revertir si hay datos anteriores
    if (!item.cambios || item.cambios.length === 0) {
      setError('No hay cambios para revertir en esta entrada');
      return;
    }

    setRevertirModal({
      show: true,
      auditoriaId: item.id,
      fecha: new Date(item.fecha).toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      cambios: item.cambios // Pasar los cambios para mostrarlos
    });
  };

  const confirmarRevertir = async () => {
    const auditoriaId = revertirModal.auditoriaId;
    setRevertirModal({ show: false, auditoriaId: null, fecha: '', cambios: [] });
    setLoading(true);
    setError(null);

    try {
      await onRevertir(frenteId, auditoriaId);
      setSuccess('¡Cambio revertido exitosamente! El frente ha vuelto a su estado anterior.');

      // Recargar historial
      await cargarHistorial();

      // Notificar al componente padre
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error revirtiendo cambio:', err);
      setError(err.response?.data?.message || 'No se pudo revertir el cambio');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getAccionColor = (accion) => {
    const colores = {
      creado: 'bg-green-100 text-green-800 border-green-300',
      actualizado: 'bg-blue-100 text-blue-800 border-blue-300',
      eliminado: 'bg-red-100 text-red-800 border-red-300',
      restaurado: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };
    return colores[accion] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getAccionTexto = (accion) => {
    const textos = {
      creado: 'Creado',
      actualizado: 'Actualizado',
      eliminado: 'Eliminado',
      restaurado: 'Restaurado',
    };
    return textos[accion] || accion;
  };

  const formatearCampo = (campo) => {
    const nombres = {
      manto: 'Manto',
      calle: 'Calle',
      hebra: 'Hebra',
      numero_frente: 'Número',
      codigo_completo: 'Código Completo',
      id_tipo_frente: 'Tipo de Frente',
    };
    return nombres[campo] || campo;
  };

  const formatearValor = (valor) => {
    if (valor === null || valor === undefined || valor === '') {
      return <span className="text-gray-400 italic">vacío</span>;
    }
    return valor;
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 transform animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <HiClock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="text-orange-100 text-sm">Registro completo de modificaciones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors duration-200"
            title="Cerrar"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {success && (
            <AlertMessage
              type="success"
              title="¡Éxito!"
              message={success}
              onClose={() => setSuccess(null)}
            />
          )}

          {error && (
            <AlertMessage
              type="error"
              title="Error"
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {/* Modal de confirmación de revertir - Custom */}
          {revertirModal.show && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 transform animate-scale-in border-3 border-yellow-300">
                {/* Icono */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                    <HiArrowUturnLeft className="w-8 h-8 text-yellow-600" />
                  </div>
                </div>

                {/* Título */}
                <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  ¿Revertir cambios?
                </h3>

                {/* Mensaje */}
                <p className="text-gray-600 text-center mb-2">
                  Vas a <strong className="text-yellow-700">DESHACER</strong> los siguientes cambios y volver al estado anterior:
                </p>
                <p className="text-center mb-4">
                  <span className="text-sm text-gray-500">
                    Estado del: <span className="font-bold text-yellow-600">{revertirModal.fecha}</span>
                  </span>
                </p>

                {/* Vista previa de cambios que se revertirán */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-4 max-h-60 overflow-y-auto">
                  <p className="text-sm font-bold text-yellow-900 mb-3 flex items-center gap-2">
                    <HiArrowUturnLeft className="w-4 h-4" />
                    Se aplicarán estos valores anteriores:
                  </p>
                  <div className="space-y-2">
                    {revertirModal.cambios && revertirModal.cambios.map((cambio, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          📝 {formatearCampo(cambio.campo)}
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">Valor actual:</p>
                            <p className="text-sm font-semibold text-red-700 line-through">
                              {formatearValor(cambio.nuevo)}
                            </p>
                          </div>
                          <div className="text-yellow-600 text-xl">→</div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">Volverá a ser:</p>
                            <p className="text-sm font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                              {formatearValor(cambio.anterior)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advertencia */}
                <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Esta acción creará un nuevo registro en el historial. Los cambios actuales se perderán.
                  </p>
                </div>

                {/* Botones */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setRevertirModal({ show: false, auditoriaId: null, fecha: '', cambios: [] })}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarRevertir}
                    className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <HiArrowUturnLeft className="w-5 h-5" />
                    Sí, Revertir Cambios
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Cargando historial...</p>
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiClock className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-700 font-medium mb-2">No hay historial disponible</p>
              <p className="text-sm text-gray-500">
                Este registro aún no tiene cambios registrados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timeline */}
              <div className="relative">
                {historial.map((item, index) => (
                  <div key={item.id} className="relative pb-8">
                    {/* Línea vertical */}
                    {index !== historial.length - 1 && (
                      <span
                        className="absolute left-5 top-10 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      ></span>
                    )}

                    <div className="relative flex items-start space-x-3">
                      {/* Icono */}
                      <div className="relative">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-white ${getAccionColor(item.accion).split(' ')[0]}`}>
                          <HiArrowPath className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-orange-300 transition-colors">
                          {/* Header de la acción */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getAccionColor(item.accion)}`}>
                                {getAccionTexto(item.accion)}
                              </span>
                              <span className="text-sm font-medium text-gray-700">{item.usuario}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(item.fecha).toLocaleString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Observaciones */}
                          {item.observaciones && (
                            <p className="text-sm text-gray-600 mb-3 italic">"{item.observaciones}"</p>
                          )}

                          {/* Cambios específicos */}
                          {item.cambios && item.cambios.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-700 uppercase">Cambios realizados:</p>
                                {item.accion === 'actualizado' && (
                                  <button
                                    onClick={() => handleRevertir(item)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 rounded-lg transition-all shadow-sm hover:shadow-md"
                                    title="Deshacer estos cambios y volver al estado anterior"
                                  >
                                    <HiArrowUturnLeft className="w-4 h-4" />
                                    Deshacer Cambios
                                  </button>
                                )}
                              </div>
                              {item.cambios.map((cambio, idx) => (
                                <div key={idx} className="bg-white rounded p-3 border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-600 mb-1">
                                    {formatearCampo(cambio.campo)}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-xs text-red-600 font-medium">Antes: </span>
                                      <span className="text-gray-700">{formatearValor(cambio.anterior)}</span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-green-600 font-medium">Después: </span>
                                      <span className="text-gray-700">{formatearValor(cambio.nuevo)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 rounded-b-2xl flex justify-end border-t">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

HistorialCambios.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  frenteId: PropTypes.number,
  loadHistorial: PropTypes.func.isRequired,
  onRevertir: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  title: PropTypes.string,
};
