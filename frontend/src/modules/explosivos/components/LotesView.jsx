import { useState, useEffect } from 'react';
import {
  HiArchiveBox,
  HiExclamationTriangle,
  HiClock,
  HiCheckCircle,
  HiXCircle,
  HiMagnifyingGlass,
  HiFunnel,
  HiEye,
  HiXMark,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import Pagination from '../../../shared/components/molecules/Pagination';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

export default function LotesView({ polvorin, tipos, onRefresh }) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros
  const [filtros, setFiltros] = useState({
    estado: '',
    id_tipo_explosivo: '',
    con_stock: '',
    proximos_vencer: '',
  });

  // Modal de detalle
  const [showDetalle, setShowDetalle] = useState(false);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);

  // Confirmar marcar vencido
  const [showConfirmVencido, setShowConfirmVencido] = useState(false);
  const [loteAVencer, setLoteAVencer] = useState(null);

  useEffect(() => {
    if (polvorin?.id) {
      loadLotes();
    }
  }, [polvorin, currentPage, filtros]);

  const loadLotes = async () => {
    setLoading(true);
    try {
      const params = {
        id_polvorin: polvorin.id,
        page: currentPage,
        per_page: 15,
        ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '')),
      };
      const response = await explosivosService.getLotes(params);
      setLotes(response.data || []);
      setTotalPages(response.last_page || 1);
    } catch (error) {
      toast.error('Error', 'No se pudieron cargar los lotes');
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
      estado: '',
      id_tipo_explosivo: '',
      con_stock: '',
      proximos_vencer: '',
    });
    setCurrentPage(1);
  };

  const verDetalle = async (lote) => {
    try {
      const detalle = await explosivosService.getLote(lote.id);
      setLoteSeleccionado(detalle);
      setShowDetalle(true);
    } catch (error) {
      toast.error('Error', 'No se pudo cargar el detalle del lote');
    }
  };

  const confirmarMarcarVencido = (lote) => {
    setLoteAVencer(lote);
    setShowConfirmVencido(true);
  };

  const marcarVencido = async () => {
    try {
      await explosivosService.marcarLoteVencido(loteAVencer.id);
      toast.success('Lote actualizado', 'El lote fue marcado como vencido');
      setShowConfirmVencido(false);
      setLoteAVencer(null);
      loadLotes();
      onRefresh?.();
    } catch (error) {
      toast.error('Error', 'No se pudo actualizar el lote');
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Activo': 'bg-green-100 text-green-700',
      'Agotado': 'bg-gray-100 text-gray-700',
      'Vencido': 'bg-red-100 text-red-700',
      'Devuelto': 'bg-yellow-100 text-yellow-700',
    };
    return badges[estado] || 'bg-gray-100 text-gray-700';
  };

  const getAlertaVencimiento = (lote) => {
    if (lote.alerta_vencimiento === 'vencido') {
      return (
        <span className="inline-flex items-center gap-1 text-red-600 text-xs">
          <HiXCircle className="w-4 h-4" />
          Vencido
        </span>
      );
    }
    if (lote.alerta_vencimiento === 'proximo') {
      return (
        <span className="inline-flex items-center gap-1 text-yellow-600 text-xs">
          <HiClock className="w-4 h-4" />
          {lote.dias_para_vencer} días
        </span>
      );
    }
    if (lote.dias_para_vencer !== null) {
      return (
        <span className="text-green-600 text-xs">
          {lote.dias_para_vencer} días
        </span>
      );
    }
    return <span className="text-gray-400 text-xs">Sin fecha</span>;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HiFunnel className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filtros.estado}
            onChange={(e) => handleFiltroChange('estado', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos los estados</option>
            <option value="Activo">Activos</option>
            <option value="Agotado">Agotados</option>
            <option value="Vencido">Vencidos</option>
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
          <select
            value={filtros.con_stock}
            onChange={(e) => handleFiltroChange('con_stock', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Con/sin stock</option>
            <option value="1">Con stock disponible</option>
          </select>
          <select
            value={filtros.proximos_vencer}
            onChange={(e) => handleFiltroChange('proximos_vencer', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Vencimiento</option>
            <option value="1">Próximos a vencer (30 días)</option>
          </select>
        </div>
        {Object.values(filtros).some(v => v !== '') && (
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Tabla de lotes */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600"></div>
          </div>
        ) : lotes.length === 0 ? (
          <div className="text-center py-12">
            <HiArchiveBox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay lotes registrados</p>
            <p className="text-sm text-gray-400 mt-1">
              Los lotes se crean automáticamente al registrar entradas de explosivos
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 bg-gradient-to-r from-red-50 to-orange-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">N° Lote</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Explosivo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Proveedor</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Cantidad</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Vencimiento</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((lote) => (
                    <tr key={lote.id} className="border-b hover:bg-red-50/50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium">{lote.numero_lote}</span>
                        <div className="text-xs text-gray-500">
                          Ingreso: {lote.fecha_ingreso}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{lote.tipo_explosivo?.codigo}</div>
                        <div className="text-xs text-gray-500">{lote.tipo_explosivo?.nombre}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {lote.proveedor || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(lote.estado)}`}>
                          {lote.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold">
                          {parseFloat(lote.cantidad_actual).toLocaleString('es-CL')}
                        </div>
                        <div className="text-xs text-gray-500">
                          de {parseFloat(lote.cantidad_inicial).toLocaleString('es-CL')} {lote.tipo_explosivo?.unidad_medida}
                        </div>
                        {lote.porcentaje_consumido > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className="bg-red-500 h-1.5 rounded-full"
                              style={{ width: `${lote.porcentaje_consumido}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lote.fecha_vencimiento ? (
                          <div>
                            <div className="text-sm">{lote.fecha_vencimiento}</div>
                            {getAlertaVencimiento(lote)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => verDetalle(lote)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            <HiEye className="w-5 h-5" />
                          </button>
                          {lote.estado === 'Activo' && lote.alerta_vencimiento === 'vencido' && (
                            <button
                              onClick={() => confirmarMarcarVencido(lote)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Marcar como vencido"
                            >
                              <HiXCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>
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

      {/* Modal de detalle */}
      {showDetalle && loteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Detalle del Lote: {loteSeleccionado.numero_lote}
              </h3>
              <button onClick={() => setShowDetalle(false)} className="text-gray-500 hover:text-gray-700">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Explosivo</p>
                  <p className="font-medium">{loteSeleccionado.tipo_explosivo?.codigo}</p>
                  <p className="text-sm text-gray-600">{loteSeleccionado.tipo_explosivo?.nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(loteSeleccionado.estado)}`}>
                    {loteSeleccionado.estado}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Proveedor</p>
                  <p className="font-medium">{loteSeleccionado.proveedor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Guía de Despacho</p>
                  <p className="font-medium">{loteSeleccionado.guia_despacho || '-'}</p>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Fabricación</p>
                  <p className="font-medium">{loteSeleccionado.fecha_fabricacion || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ingreso</p>
                  <p className="font-medium">{loteSeleccionado.fecha_ingreso}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vencimiento</p>
                  <p className="font-medium">{loteSeleccionado.fecha_vencimiento || '-'}</p>
                  {loteSeleccionado.dias_para_vencer !== null && (
                    <p className={`text-sm ${loteSeleccionado.dias_para_vencer < 0 ? 'text-red-600' : loteSeleccionado.dias_para_vencer < 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {loteSeleccionado.dias_para_vencer < 0 ? 'Vencido' : `${loteSeleccionado.dias_para_vencer} días restantes`}
                    </p>
                  )}
                </div>
              </div>

              {/* Cantidades */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-blue-600">Cantidad Inicial</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {parseFloat(loteSeleccionado.cantidad_inicial).toLocaleString('es-CL')}
                  </p>
                  <p className="text-xs text-blue-500">{loteSeleccionado.tipo_explosivo?.unidad_medida}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-green-600">Cantidad Actual</p>
                  <p className="text-2xl font-bold text-green-700">
                    {parseFloat(loteSeleccionado.cantidad_actual).toLocaleString('es-CL')}
                  </p>
                  <p className="text-xs text-green-500">{loteSeleccionado.tipo_explosivo?.unidad_medida}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-sm text-red-600">Consumido</p>
                  <p className="text-2xl font-bold text-red-700">
                    {loteSeleccionado.porcentaje_consumido}%
                  </p>
                </div>
              </div>

              {/* Movimientos recientes */}
              {loteSeleccionado.movimientos?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Últimos Movimientos</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loteSeleccionado.movimientos.map((mov) => (
                      <div key={mov.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <span className={`text-xs font-medium ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                            {mov.tipo_formateado}
                          </span>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="text-sm text-gray-600">{mov.fecha}</span>
                        </div>
                        <span className={`font-bold ${mov.es_positivo ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.es_positivo ? '+' : '-'}{mov.cantidad}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              {loteSeleccionado.observaciones && (
                <div>
                  <p className="text-sm text-gray-500">Observaciones</p>
                  <p className="text-gray-700">{loteSeleccionado.observaciones}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <Button variant="secondary" onClick={() => setShowDetalle(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar marcar vencido */}
      <ConfirmDialog
        isOpen={showConfirmVencido}
        onClose={() => setShowConfirmVencido(false)}
        onConfirm={marcarVencido}
        title="Marcar lote como vencido"
        message={`¿Está seguro de marcar el lote "${loteAVencer?.numero_lote}" como vencido? Esta acción no se puede deshacer.`}
        confirmText="Marcar vencido"
        confirmVariant="danger"
      />
    </div>
  );
}
