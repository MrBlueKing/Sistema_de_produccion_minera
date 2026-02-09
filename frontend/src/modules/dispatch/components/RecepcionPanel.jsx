import React, { useState, useEffect } from 'react';
import {
  HiCheckCircle,
  HiTruck,
  HiScale,
  HiClock,
  HiBriefcase,
  HiCube
} from 'react-icons/hi2';
import { HiFilter, HiOfficeBuilding } from 'react-icons/hi';
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
  const [lotes, setLotes] = useState([]);

  // Filtros
  const [filtros, setFiltros] = useState({
    planta_id: '',
    empresa_id: '',
    lote_id: '',
    fecha_desde: '',
    fecha_hasta: ''
  });

  // Modal de recepción
  const [showModal, setShowModal] = useState(false);
  const [camionadaSeleccionada, setCamionadaSeleccionada] = useState(null);
  const [formRecepcion, setFormRecepcion] = useState({
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
      const [plantasRes, empresasRes, lotesRes] = await Promise.all([
        laboratorioService.getPlantas({ activas: true }),
        laboratorioService.getEmpresas({ activas: true }),
        laboratorioService.getLotes({ estado: 'Abierto' })
      ]);

      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
      setLotes(lotesRes.data || lotesRes || []);
    } catch (error) {
      console.error('Error cargando datos maestros:', error);
      toast.error('Error al cargar datos iniciales');
    }
  };

  const cargarCamionadas = async () => {
    setLoading(true);
    try {
      const params = {
        estado: 'Despachado', // Solo camionadas pendientes de recepción
        ...filtros
      };

      // Limpiar parámetros vacíos
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

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

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      planta_id: '',
      empresa_id: '',
      lote_id: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
  };

  const handleRecepcionar = (camionada) => {
    setCamionadaSeleccionada(camionada);
    setFormRecepcion({
      fecha_recepcion: new Date().toISOString().split('T')[0],
      hora_recepcion: new Date().toTimeString().slice(0, 5),
      peso_real: camionada.peso || '', // Pre-llenar con peso teórico
      observaciones_recepcion: ''
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormRecepcion(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitRecepcion = async (e) => {
    e.preventDefault();

    if (!formRecepcion.peso_real || parseFloat(formRecepcion.peso_real) <= 0) {
      toast.error('El peso real debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
        fecha_recepcion: formRecepcion.fecha_recepcion,
        hora_recepcion: formRecepcion.hora_recepcion,
        peso_real: parseFloat(formRecepcion.peso_real),
        observaciones_recepcion: formRecepcion.observaciones_recepcion?.trim() || null
      };

      await laboratorioService.recepcionarCamionada(camionadaSeleccionada.id, dataToSend);

      toast.success(
        'Camionada recepcionada',
        `Patente ${camionadaSeleccionada.patente} recibida correctamente`
      );

      setShowModal(false);
      setCamionadaSeleccionada(null);
      await cargarCamionadas();
    } catch (error) {
      console.error('Error al recepcionar:', error);
      toast.error(
        'Error al recepcionar',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo recepcionar la camionada'
      );
    } finally {
      setLoading(false);
    }
  };

  const calcularDiferencia = (pesoTeorico, pesoReal) => {
    const diff = parseFloat(pesoReal) - parseFloat(pesoTeorico);
    return diff.toFixed(2);
  };

  const calcularPorcentajeError = (pesoTeorico, pesoReal) => {
    const diff = Math.abs(parseFloat(pesoReal) - parseFloat(pesoTeorico));
    const porcentaje = (diff / parseFloat(pesoTeorico)) * 100;
    return porcentaje.toFixed(2);
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
                {camionadas.length} camionada{camionadas.length !== 1 ? 's' : ''} pendiente{camionadas.length !== 1 ? 's' : ''} de recepción
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <HiFilter className="text-green-700" />
            <h4 className="font-semibold text-green-900">Filtros de Búsqueda</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <HiOfficeBuilding className="inline mr-1" />
                Planta
              </label>
              <select
                name="planta_id"
                value={filtros.planta_id}
                onChange={handleFiltroChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Todas</option>
                {plantas.map(planta => (
                  <option key={planta.id} value={planta.id}>
                    {planta.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <HiBriefcase className="inline mr-1" />
                Empresa
              </label>
              <select
                name="empresa_id"
                value={filtros.empresa_id}
                onChange={handleFiltroChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Todas</option>
                {empresas.map(empresa => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                name="fecha_desde"
                value={filtros.fecha_desde}
                onChange={handleFiltroChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                name="fecha_hasta"
                value={filtros.fecha_hasta}
                onChange={handleFiltroChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={limpiarFiltros}
                className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Camionadas */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : camionadas.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">¡No hay camionadas pendientes!</p>
            <p className="text-gray-500 text-sm">Todas las camionadas han sido recepcionadas</p>
          </div>
        </Card>
      ) : (
        <Card className="border-l-4 border-green-400">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Camionadas Pendientes de Recepción</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
                  <th className="text-left py-3 px-3 font-bold text-green-900">N° Camionada</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Lote</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Patente</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Planta</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Empresa</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Mezcla</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Fecha Despacho</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Peso Teórico</th>
                  <th className="text-left py-3 px-3 font-bold text-green-900">Acción</th>
                </tr>
              </thead>
              <tbody>
                {camionadas.map((camionada, index) => (
                  <tr
                    key={camionada.id}
                    className={`border-b hover:bg-green-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-green-700">
                      #{camionada.numero_camionada}
                    </td>
                    <td className="py-3 px-3">
                      <Badge color="indigo" size="sm">
                        {camionada.lote?.numero_lote || '-'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">{camionada.patente}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <HiOfficeBuilding className="text-blue-500" />
                        <span className="text-xs">{camionada.lote?.planta?.nombre || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <HiBriefcase className="text-purple-500" />
                        <span className="text-xs">{camionada.lote?.empresa?.nombre || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <HiCube className="text-purple-500" />
                        <span className="text-xs font-mono">{camionada.mezcla?.codigo || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <div className="flex items-center gap-1">
                        <HiClock className="text-orange-500" />
                        {new Date(camionada.fecha_despacho).toLocaleDateString('es-CL')}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <HiScale className="text-green-500" />
                        <span className="font-bold">{parseFloat(camionada.peso).toFixed(2)} t</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Button
                        variant="success"
                        size="sm"
                        icon={HiCheckCircle}
                        onClick={() => handleRecepcionar(camionada)}
                      >
                        Recepcionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de Recepción */}
      {showModal && camionadaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <form onSubmit={handleSubmitRecepcion}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <HiTruck className="text-green-600" />
                    Recepcionar Camionada
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Patente: <span className="font-mono font-bold">{camionadaSeleccionada.patente}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Información de la Camionada */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Información del Despacho</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Lote:</p>
                    <p className="font-bold">{camionadaSeleccionada.lote?.numero_lote}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Mezcla:</p>
                    <p className="font-bold font-mono">{camionadaSeleccionada.mezcla?.codigo}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Planta:</p>
                    <p className="font-bold">{camionadaSeleccionada.lote?.planta?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Empresa:</p>
                    <p className="font-bold">{camionadaSeleccionada.lote?.empresa?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Fecha Despacho:</p>
                    <p className="font-bold">
                      {new Date(camionadaSeleccionada.fecha_despacho).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Peso Teórico:</p>
                    <p className="font-bold text-blue-700">
                      {parseFloat(camionadaSeleccionada.peso).toFixed(2)} t
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulario de Recepción */}
              <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
                <h4 className="font-semibold text-green-900 mb-4">Datos de Recepción</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Recepción *
                    </label>
                    <input
                      type="date"
                      name="fecha_recepcion"
                      value={formRecepcion.fecha_recepcion}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora de Recepción *
                    </label>
                    <input
                      type="time"
                      name="hora_recepcion"
                      value={formRecepcion.hora_recepcion}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso Real (toneladas) *
                    </label>
                    <input
                      type="number"
                      name="peso_real"
                      value={formRecepcion.peso_real}
                      onChange={handleFormChange}
                      step="0.01"
                      min="0"
                      placeholder="Peso pesado en destino"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                    {formRecepcion.peso_real && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-300">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">
                            <strong>Diferencia:</strong>{' '}
                            <span className={parseFloat(calcularDiferencia(camionadaSeleccionada.peso, formRecepcion.peso_real)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {calcularDiferencia(camionadaSeleccionada.peso, formRecepcion.peso_real)} t
                            </span>
                          </span>
                          <span className="text-gray-700">
                            <strong>Error:</strong>{' '}
                            <span className="text-orange-600">
                              {calcularPorcentajeError(camionadaSeleccionada.peso, formRecepcion.peso_real)}%
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observaciones de Recepción
                    </label>
                    <textarea
                      name="observaciones_recepcion"
                      value={formRecepcion.observaciones_recepcion}
                      onChange={handleFormChange}
                      rows="3"
                      placeholder="Notas adicionales sobre la recepción..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  icon={HiCheckCircle}
                  disabled={loading}
                >
                  {loading ? 'Recepcionando...' : 'Confirmar Recepción'}
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
