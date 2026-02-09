import { useState, useEffect } from 'react';
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiAdjustmentsHorizontal,
  HiPlus,
  HiXMark,
  HiMagnifyingGlass,
  HiCalendar,
  HiFunnel,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Pagination from '../../../shared/components/molecules/Pagination';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';
import { useFaena } from '../../../contexts/FaenaContext';

export default function MovimientosView({ polvorin, tipos, onRefresh, faenaActual }) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros
  const [filtros, setFiltros] = useState({
    tipo: '',
    fecha_desde: '',
    fecha_hasta: '',
    id_tipo_explosivo: '',
  });

  // Modal de nuevo movimiento
  const [showModal, setShowModal] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState('entrada');
  const [formData, setFormData] = useState({
    id_tipo_explosivo: '',
    cantidad: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    guia_despacho: '',
    recibido_por: '',
    entregado_por: '',
    autorizado_por: '',
    motivo: '',
    observaciones: '',
    // Para lotes nuevos
    numero_lote: '',
    fecha_vencimiento: '',
    proveedor: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Personal autorizado para salidas
  const [personalAutorizado, setPersonalAutorizado] = useState([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  useEffect(() => {
    if (polvorin?.id) {
      loadMovimientos();
    }
  }, [polvorin, currentPage, filtros]);

  // Cargar personal autorizado cuando se necesite
  const cargarPersonalAutorizado = async () => {
    setLoadingPersonal(true);
    try {
      const data = await explosivosService.getPersonalAutorizado({ activo: 'true' });
      setPersonalAutorizado(data);
    } catch (error) {
      console.error('Error al cargar personal autorizado:', error);
    } finally {
      setLoadingPersonal(false);
    }
  };

  const loadMovimientos = async () => {
    setLoading(true);
    try {
      const params = {
        id_polvorin: polvorin.id,
        page: currentPage,
        per_page: 15,
        ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '')),
      };
      const response = await explosivosService.getMovimientos(params);
      setMovimientos(response.data || []);
      setTotalPages(response.last_page || 1);
    } catch (error) {
      toast.error('Error', 'No se pudieron cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (name, value) => {
    setFiltros(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const limpiarFiltros = () => {
    setFiltros({
      tipo: '',
      fecha_desde: '',
      fecha_hasta: '',
      id_tipo_explosivo: '',
    });
    setCurrentPage(1);
  };

  const abrirModalEntrada = () => {
    setTipoMovimiento('entrada');
    setFormData({
      id_tipo_explosivo: '',
      cantidad: '',
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5),
      guia_despacho: '',
      recibido_por: '',
      autorizado_por: '',
      motivo: '',
      observaciones: '',
      numero_lote: '',
      fecha_vencimiento: '',
      proveedor: '',
    });
    setShowModal(true);
  };

  const abrirModalSalida = () => {
    setTipoMovimiento('salida');
    setFormData({
      id_tipo_explosivo: '',
      cantidad: '',
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5),
      id_solicitante: '',
      entregado_por: '',
      autorizado_por: '',
      motivo: '',
      observaciones: '',
    });
    cargarPersonalAutorizado();
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (tipoMovimiento === 'entrada') {
        // Primero crear el lote si se proporciona número de lote
        if (formData.numero_lote) {
          await explosivosService.createLote({
            numero_lote: formData.numero_lote,
            id_tipo_explosivo: formData.id_tipo_explosivo,
            id_polvorin: polvorin.id,
            fecha_ingreso: formData.fecha,
            fecha_vencimiento: formData.fecha_vencimiento || null,
            proveedor: formData.proveedor,
            guia_despacho: formData.guia_despacho,
            cantidad: formData.cantidad,
            recibido_por: formData.recibido_por,
            autorizado_por: formData.autorizado_por,
            observaciones: formData.observaciones,
            id_faena: faenaActual.id,
          });
        } else {
          // Entrada sin lote nuevo
          await explosivosService.registrarEntrada({
            id_polvorin: polvorin.id,
            id_tipo_explosivo: formData.id_tipo_explosivo,
            cantidad: formData.cantidad,
            fecha: formData.fecha,
            hora: formData.hora,
            guia_despacho: formData.guia_despacho,
            recibido_por: formData.recibido_por,
            autorizado_por: formData.autorizado_por,
            motivo: formData.motivo || 'Ingreso de explosivos',
            observaciones: formData.observaciones,
            id_faena: faenaActual.id,
          });
        }
        toast.success('Entrada registrada', 'El ingreso de explosivos fue registrado correctamente');
      } else {
        await explosivosService.registrarSalida({
          id_polvorin: polvorin.id,
          id_tipo_explosivo: formData.id_tipo_explosivo,
          cantidad: formData.cantidad,
          fecha: formData.fecha,
          hora: formData.hora,
          entregado_por: formData.entregado_por,
          autorizado_por: formData.autorizado_por,
          motivo: formData.motivo || 'Consumo de explosivos',
          observaciones: formData.observaciones,
          id_faena: faenaActual.id,
        });
        toast.success('Salida registrada', 'La salida de explosivos fue registrada correctamente');
      }

      setShowModal(false);
      loadMovimientos();
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo registrar el movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'entrada':
        return <HiArrowDownTray className="w-5 h-5 text-green-600" />;
      case 'salida':
        return <HiArrowUpTray className="w-5 h-5 text-red-600" />;
      case 'ajuste':
        return <HiAdjustmentsHorizontal className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTipoBadge = (tipo) => {
    const clases = {
      entrada: 'bg-green-100 text-green-700',
      salida: 'bg-red-100 text-red-700',
      ajuste: 'bg-blue-100 text-blue-700',
      devolucion: 'bg-yellow-100 text-yellow-700',
      transferencia: 'bg-purple-100 text-purple-700',
    };
    return clases[tipo] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Acciones rápidas */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Registrar Movimiento</h3>
          <div className="flex gap-2">
            <Button variant="success" icon={HiArrowDownTray} onClick={abrirModalEntrada}>
              Nueva Entrada
            </Button>
            <Button variant="danger" icon={HiArrowUpTray} onClick={abrirModalSalida}>
              Nueva Salida
            </Button>
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HiFunnel className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filtros.tipo}
            onChange={(e) => handleFiltroChange('tipo', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos los tipos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
            <option value="ajuste">Ajustes</option>
          </select>
          <select
            value={filtros.id_tipo_explosivo}
            onChange={(e) => handleFiltroChange('id_tipo_explosivo', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos los explosivos</option>
            {tipos.map(tipo => (
              <option key={tipo.id} value={tipo.id}>{tipo.codigo} - {tipo.nombre}</option>
            ))}
          </select>
          <input
            type="date"
            value={filtros.fecha_desde}
            onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
            placeholder="Desde"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
          <input
            type="date"
            value={filtros.fecha_hasta}
            onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
            placeholder="Hasta"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
        {Object.values(filtros).some(v => v !== '') && (
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Tabla de movimientos */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600"></div>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12">
            <HiArrowDownTray className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay movimientos registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 bg-gradient-to-r from-red-50 to-orange-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Explosivo</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Cantidad</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => (
                    <tr key={mov.id} className="border-b hover:bg-red-50/50">
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{mov.fecha}</div>
                        {mov.hora && <div className="text-xs text-gray-500">{mov.hora}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {mov.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTipoBadge(mov.tipo)}`}>
                          {getTipoIcon(mov.tipo)}
                          {mov.tipo_formateado || mov.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{mov.tipo_explosivo?.codigo}</div>
                        <div className="text-xs text-gray-500">{mov.tipo_explosivo?.nombre}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${mov.es_positivo ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.es_positivo ? '+' : '-'}{parseFloat(mov.cantidad).toLocaleString('es-CL')}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          {mov.tipo_explosivo?.unidad_medida}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">
                        {mov.motivo || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Modal de nuevo movimiento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className={`px-6 py-4 border-b ${tipoMovimiento === 'entrada' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${tipoMovimiento === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                  {tipoMovimiento === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Explosivo *
                </label>
                <select
                  value={formData.id_tipo_explosivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_tipo_explosivo: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Seleccione...</option>
                  {tipos.map(tipo => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.codigo} - {tipo.nombre} ({tipo.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.cantidad}
                    onChange={(e) => setFormData(prev => ({ ...prev, cantidad: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {tipoMovimiento === 'entrada' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-700 mb-3">Datos del Lote (Opcional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          N° Lote Fabricante
                        </label>
                        <input
                          type="text"
                          value={formData.numero_lote}
                          onChange={(e) => setFormData(prev => ({ ...prev, numero_lote: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha Vencimiento
                        </label>
                        <input
                          type="date"
                          value={formData.fecha_vencimiento}
                          onChange={(e) => setFormData(prev => ({ ...prev, fecha_vencimiento: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Proveedor
                        </label>
                        <input
                          type="text"
                          value={formData.proveedor}
                          onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Guía Despacho
                        </label>
                        <input
                          type="text"
                          value={formData.guia_despacho}
                          onChange={(e) => setFormData(prev => ({ ...prev, guia_despacho: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recibido por
                    </label>
                    <input
                      type="text"
                      value={formData.recibido_por}
                      onChange={(e) => setFormData(prev => ({ ...prev, recibido_por: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </>
              )}

              {tipoMovimiento === 'salida' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Solicitante (Personal Autorizado) *
                  </label>
                  {loadingPersonal ? (
                    <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-500">Cargando personal...</span>
                    </div>
                  ) : personalAutorizado.length === 0 ? (
                    <div className="px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50 text-sm text-yellow-700">
                      No hay personal autorizado. Configure el personal en la pestaña de Configuración.
                    </div>
                  ) : (
                    <select
                      value={formData.id_solicitante}
                      onChange={(e) => {
                        const persona = personalAutorizado.find(p => p.id === parseInt(e.target.value));
                        setFormData(prev => ({
                          ...prev,
                          id_solicitante: e.target.value,
                          entregado_por: persona ? `${persona.nombre} ${persona.apellido || ''} - ${persona.rut}` : ''
                        }));
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Seleccione solicitante...</option>
                      {personalAutorizado.map(persona => (
                        <option key={persona.id} value={persona.id}>
                          {persona.nombre} {persona.apellido} - {persona.rut}
                          {persona.cargo && ` (${persona.cargo})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Autorizado por
                </label>
                <input
                  type="text"
                  value={formData.autorizado_por}
                  onChange={(e) => setFormData(prev => ({ ...prev, autorizado_por: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant={tipoMovimiento === 'entrada' ? 'success' : 'danger'}
                  disabled={submitting}
                >
                  {submitting ? 'Guardando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
