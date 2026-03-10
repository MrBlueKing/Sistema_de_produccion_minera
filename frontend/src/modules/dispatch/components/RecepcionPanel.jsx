import React, { useState, useEffect, useMemo } from 'react';
import {
  HiCheckCircle,
  HiTruck,
  HiScale,
  HiClock,
  HiBriefcase,
  HiCube
} from 'react-icons/hi2';
import { HiFilter, HiOfficeBuilding, HiRefresh } from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Button from '../../../shared/components/atoms/Button';
import Loader from '../../../shared/components/atoms/Loader';
import laboratorioService from '../../../services/laboratorio';
import useToast from '../../../hooks/useToast';

const RecepcionPanel = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [camionadas, setCamionadas] = useState([]);
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  // Filtros
  const [filtros, setFiltros] = useState({
    planta_id: '',
    empresa_id: '',
  });

  // Recepción inline
  const [recepcionandoId, setRecepcionandoId] = useState(null);
  const [formRecepcion, setFormRecepcion] = useState({
    peso_real: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal de recepción (para datos completos)
  const [showModal, setShowModal] = useState(false);
  const [camionadaSeleccionada, setCamionadaSeleccionada] = useState(null);
  const [formRecepcionModal, setFormRecepcionModal] = useState({
    fecha_recepcion: new Date().toISOString().split('T')[0],
    hora_recepcion: new Date().toTimeString().slice(0, 5),
    peso_real: '',
    observaciones_recepcion: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    cargarCamionadas();
  }, [filtros]);

  const cargarDatos = async () => {
    try {
      const [plantasRes, empresasRes] = await Promise.all([
        laboratorioService.getPlantas({ activas: true }),
        laboratorioService.getEmpresas({ activas: true }),
      ]);
      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
    } catch (error) {
      console.error('Error cargando datos maestros:', error);
      toast.error('Error al cargar datos iniciales');
    }
  };

  const cargarCamionadas = async () => {
    setLoading(true);
    try {
      const params = { estado: 'Despachado' };
      if (filtros.planta_id) params.planta_id = filtros.planta_id;
      if (filtros.empresa_id) params.empresa_id = filtros.empresa_id;

      const response = await laboratorioService.getCamionadas(params);
      const data = response.data || response || [];
      setCamionadas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando camionadas:', error);
      toast.error('Error al cargar camionadas pendientes');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar camionadas por lote
  const camionadasPorLote = useMemo(() => {
    const grupos = {};
    camionadas.forEach(cam => {
      const loteId = cam.lote_id || 'sin_lote';
      if (!grupos[loteId]) {
        grupos[loteId] = {
          lote: cam.lote || null,
          camionadas: [],
        };
      }
      grupos[loteId].camionadas.push(cam);
    });
    return Object.values(grupos);
  }, [camionadas]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const limpiarFiltros = () => {
    setFiltros({ planta_id: '', empresa_id: '' });
  };

  // Recepción rápida inline
  const handleRecepcionRapida = (camionada) => {
    setRecepcionandoId(camionada.id);
    setFormRecepcion({ peso_real: camionada.peso || '' });
  };

  const cancelarRecepcionRapida = () => {
    setRecepcionandoId(null);
    setFormRecepcion({ peso_real: '' });
  };

  const confirmarRecepcionRapida = async (camionada) => {
    const pesoReal = parseFloat(formRecepcion.peso_real);
    if (!pesoReal || pesoReal <= 0) {
      toast.error('El peso real debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      await laboratorioService.recepcionarCamionada(camionada.id, {
        fecha_recepcion: new Date().toISOString().split('T')[0],
        hora_recepcion: new Date().toTimeString().slice(0, 5),
        peso_real: pesoReal,
      });

      toast.success('Recepcionada', `${camionada.patente} - ${pesoReal.toFixed(2)} t`);
      setRecepcionandoId(null);
      await cargarCamionadas();
    } catch (error) {
      console.error('Error al recepcionar:', error);
      toast.error('Error', error.response?.data?.mensaje || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Recepción con modal (datos completos)
  const handleRecepcionModal = (camionada) => {
    setCamionadaSeleccionada(camionada);
    setFormRecepcionModal({
      fecha_recepcion: new Date().toISOString().split('T')[0],
      hora_recepcion: new Date().toTimeString().slice(0, 5),
      peso_real: camionada.peso || '',
      observaciones_recepcion: ''
    });
    setShowModal(true);
  };

  const handleFormModalChange = (e) => {
    const { name, value } = e.target;
    setFormRecepcionModal(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitRecepcion = async (e) => {
    e.preventDefault();
    if (!formRecepcionModal.peso_real || parseFloat(formRecepcionModal.peso_real) <= 0) {
      toast.error('El peso real debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      await laboratorioService.recepcionarCamionada(camionadaSeleccionada.id, {
        fecha_recepcion: formRecepcionModal.fecha_recepcion,
        hora_recepcion: formRecepcionModal.hora_recepcion,
        peso_real: parseFloat(formRecepcionModal.peso_real),
        observaciones_recepcion: formRecepcionModal.observaciones_recepcion?.trim() || null
      });

      toast.success('Camionada recepcionada', `Patente ${camionadaSeleccionada.patente} recibida`);
      setShowModal(false);
      setCamionadaSeleccionada(null);
      await cargarCamionadas();
    } catch (error) {
      console.error('Error al recepcionar:', error);
      toast.error('Error', error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo recepcionar');
    } finally {
      setSubmitting(false);
    }
  };

  const calcularDiferencia = (pesoTeorico, pesoReal) => {
    return (parseFloat(pesoReal) - parseFloat(pesoTeorico)).toFixed(2);
  };

  const calcularPorcentajeError = (pesoTeorico, pesoReal) => {
    const diff = Math.abs(parseFloat(pesoReal) - parseFloat(pesoTeorico));
    return ((diff / parseFloat(pesoTeorico)) * 100).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <HiCheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Panel de Recepción</h2>
              <p className="text-gray-600">
                {camionadas.length} camionada{camionadas.length !== 1 ? 's' : ''} pendiente{camionadas.length !== 1 ? 's' : ''} en {camionadasPorLote.length} lote{camionadasPorLote.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button variant="secondary" icon={HiRefresh} onClick={cargarCamionadas} disabled={loading}>
            Actualizar
          </Button>
        </div>

        {/* Filtros simplificados */}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <HiOfficeBuilding className="inline mr-1" />Planta
            </label>
            <select
              name="planta_id"
              value={filtros.planta_id}
              onChange={handleFiltroChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option value="">Todas</option>
              {plantas.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <HiBriefcase className="inline mr-1" />Empresa
            </label>
            <select
              name="empresa_id"
              value={filtros.empresa_id}
              onChange={handleFiltroChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option value="">Todas</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          {(filtros.planta_id || filtros.empresa_id) && (
            <button
              onClick={limpiarFiltros}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : camionadas.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">Sin camionadas pendientes</p>
            <p className="text-gray-500 text-sm">Todas las camionadas han sido recepcionadas</p>
          </div>
        </Card>
      ) : (
        /* === CARDS AGRUPADAS POR LOTE === */
        <div className="space-y-6">
          {camionadasPorLote.map((grupo) => {
            const lote = grupo.lote;
            const cams = grupo.camionadas;
            const pesoTotalTeorico = cams.reduce((s, c) => s + parseFloat(c.peso || 0), 0);

            return (
              <Card
                key={lote?.id || 'sin_lote'}
                className="border-2 border-green-200 hover:border-green-400 transition-all"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <HiCube className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {lote?.numero_lote || 'Sin Lote'}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {lote?.planta?.nombre && (
                          <span className="flex items-center gap-1">
                            <HiOfficeBuilding className="text-blue-500" />
                            {lote.planta.nombre}
                          </span>
                        )}
                        {lote?.empresa?.nombre && (
                          <span className="flex items-center gap-1">
                            <HiBriefcase className="text-purple-500" />
                            {lote.empresa.nombre}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Pendientes</p>
                    <p className="text-2xl font-bold text-green-600">{cams.length}</p>
                    <p className="text-xs text-gray-400">{pesoTotalTeorico.toFixed(2)} t</p>
                  </div>
                </div>

                {/* Camionadas del lote */}
                <div className="space-y-2">
                  {cams.map((camionada) => {
                    const isRecepcionando = recepcionandoId === camionada.id;

                    return (
                      <div
                        key={camionada.id}
                        className={`rounded-lg border p-3 transition-all ${
                          isRecepcionando
                            ? 'border-green-400 bg-green-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          {/* Info camionada */}
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                              {camionada.numero_camionada}
                            </div>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <span className="font-mono font-bold text-gray-900 text-sm">
                                {camionada.patente}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1 hidden sm:flex">
                                <HiScale className="text-green-500" />
                                {parseFloat(camionada.peso).toFixed(2)} t
                              </span>
                              <span className="text-xs text-blue-600 font-mono hidden md:block">
                                {camionada.mezcla?.codigo || '-'}
                              </span>
                              <span className="text-xs text-gray-400 hidden lg:flex items-center gap-1">
                                <HiClock className="text-orange-400" />
                                {new Date(camionada.fecha_despacho).toLocaleDateString('es-CL')}
                              </span>
                            </div>
                          </div>

                          {/* Acciones */}
                          {!isRecepcionando ? (
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                variant="success"
                                size="sm"
                                icon={HiCheckCircle}
                                onClick={() => handleRecepcionRapida(camionada)}
                              >
                                Recepcionar
                              </Button>
                              <button
                                onClick={() => handleRecepcionModal(camionada)}
                                className="text-xs text-gray-400 hover:text-gray-600 px-2"
                                title="Recepción con más detalles"
                              >
                                ...
                              </button>
                            </div>
                          ) : (
                            /* Formulario inline */
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <label className="text-xs text-gray-600 font-medium">Peso Real:</label>
                                <input
                                  type="number"
                                  value={formRecepcion.peso_real}
                                  onChange={(e) => setFormRecepcion({ peso_real: e.target.value })}
                                  step="0.01"
                                  min="0"
                                  className="w-24 px-2 py-1.5 text-sm border-2 border-green-400 rounded-md focus:ring-2 focus:ring-green-500 font-bold text-center"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      confirmarRecepcionRapida(camionada);
                                    }
                                    if (e.key === 'Escape') cancelarRecepcionRapida();
                                  }}
                                />
                                <span className="text-xs text-gray-500">t</span>
                              </div>
                              {formRecepcion.peso_real && parseFloat(formRecepcion.peso_real) !== parseFloat(camionada.peso) && (
                                <span className={`text-xs font-bold ${
                                  parseFloat(formRecepcion.peso_real) > parseFloat(camionada.peso)
                                    ? 'text-red-500' : 'text-green-600'
                                }`}>
                                  {calcularDiferencia(camionada.peso, formRecepcion.peso_real) > 0 ? '+' : ''}
                                  {calcularDiferencia(camionada.peso, formRecepcion.peso_real)}
                                </span>
                              )}
                              <Button
                                variant="success"
                                size="sm"
                                icon={HiCheckCircle}
                                onClick={() => confirmarRecepcionRapida(camionada)}
                                disabled={submitting}
                              >
                                {submitting ? '...' : 'OK'}
                              </Button>
                              <button
                                onClick={cancelarRecepcionRapida}
                                className="text-gray-400 hover:text-gray-600 text-sm px-1"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Info extra en mobile */}
                        <div className="flex items-center gap-4 mt-1.5 sm:hidden text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <HiScale className="text-green-500" />
                            {parseFloat(camionada.peso).toFixed(2)} t
                          </span>
                          <span className="text-blue-600 font-mono">
                            {camionada.mezcla?.codigo || '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Recepción Completa */}
      {showModal && camionadaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full">
            <form onSubmit={handleSubmitRecepcion}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <HiTruck className="text-green-600" />
                    Recepcionar
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-mono font-bold">{camionadaSeleccionada.patente}</span>
                    {' '}| Lote {camionadaSeleccionada.lote?.numero_lote || '-'}
                    {' '}| Peso teórico: {parseFloat(camionadaSeleccionada.peso).toFixed(2)} t
                  </p>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                  &#x2715;
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      name="fecha_recepcion"
                      value={formRecepcionModal.fecha_recepcion}
                      onChange={handleFormModalChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                    <input
                      type="time"
                      name="hora_recepcion"
                      value={formRecepcionModal.hora_recepcion}
                      onChange={handleFormModalChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso Real (toneladas) *</label>
                  <input
                    type="number"
                    name="peso_real"
                    value={formRecepcionModal.peso_real}
                    onChange={handleFormModalChange}
                    step="0.01"
                    min="0"
                    placeholder="Peso pesado en destino"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  />
                  {formRecepcionModal.peso_real && (
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="text-gray-600">
                        Diferencia:{' '}
                        <span className={parseFloat(calcularDiferencia(camionadaSeleccionada.peso, formRecepcionModal.peso_real)) >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                          {calcularDiferencia(camionadaSeleccionada.peso, formRecepcionModal.peso_real)} t
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Error:{' '}
                        <span className="text-orange-600 font-bold">
                          {calcularPorcentajeError(camionadaSeleccionada.peso, formRecepcionModal.peso_real)}%
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    name="observaciones_recepcion"
                    value={formRecepcionModal.observaciones_recepcion}
                    onChange={handleFormModalChange}
                    rows="2"
                    placeholder="Notas adicionales..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" variant="success" icon={HiCheckCircle} disabled={submitting}>
                  {submitting ? 'Recepcionando...' : 'Confirmar'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RecepcionPanel;
