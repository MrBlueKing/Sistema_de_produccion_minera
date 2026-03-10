import { useState, useEffect } from 'react';
import {
  HiPlus,
  HiDocumentText,
  HiFunnel,
  HiTrash,
  HiEye,
  HiPencil,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import Pagination from '../../../shared/components/molecules/Pagination';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import explosivosService from '../services/explosivos';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import useToast from '../../../hooks/useToast';
import ReportePerforacionForm from './ReportePerforacionForm';

export default function ReportesPerforacionView({ polvorin, polvorines = [], tipos, faenaActual, onRefresh }) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [frentesTrabajo, setFrentesTrabajo] = useState([]);

  // Filtros
  const [filtros, setFiltros] = useState({
    estado: '',
    turno: '',
    fecha_desde: '',
    fecha_hasta: '',
    id_frente_trabajo: '',
  });

  // Vista de detalle/formulario
  const [reporteActual, setReporteActual] = useState(null);
  const [vistaFormulario, setVistaFormulario] = useState(false);
  const [modoCrear, setModoCrear] = useState(false);

  // Confirmar eliminación
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [reporteAEliminar, setReporteAEliminar] = useState(null);

  useEffect(() => {
    if ((polvorin?.id || polvorines.length > 0) && !vistaFormulario) {
      loadReportes();
    }
  }, [polvorin, polvorines, currentPage, filtros, vistaFormulario]);

  useEffect(() => {
    const loadFrentes = async () => {
      try {
        const params = { estado: 'activo', per_page: 500 };
        if (faenaActual?.id) params.id_faena = faenaActual.id;
        const res = await ingenieriaService.getFrentesTrabajo(params);
        setFrentesTrabajo(res.data || res);
      } catch { /* ignore */ }
    };
    loadFrentes();
  }, [faenaActual]);

  const loadReportes = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        per_page: 15,
        ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '')),
      };
      const response = await explosivosService.getReportes(params);
      setReportes(response.data || []);
      setTotalPages(response.last_page || 1);
    } catch (error) {
      toast.error('Error', 'No se pudieron cargar los reportes');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (name, value) => {
    setFiltros((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const limpiarFiltros = () => {
    setFiltros({ estado: '', turno: '', fecha_desde: '', fecha_hasta: '', id_frente_trabajo: '' });
    setCurrentPage(1);
  };

  const crearReporte = () => {
    setModoCrear(true);
    setReporteActual(null);
    setVistaFormulario(true);
  };

  const verReporte = async (reporte) => {
    try {
      const detalle = await explosivosService.getReporte(reporte.id);
      setReporteActual(detalle);
      setModoCrear(false);
      setVistaFormulario(true);
    } catch (error) {
      toast.error('Error', 'No se pudo cargar el reporte');
    }
  };

  const confirmarEliminar = (reporte) => {
    setReporteAEliminar(reporte);
    setShowConfirmDelete(true);
  };

  const eliminarReporte = async () => {
    try {
      await explosivosService.deleteReporte(reporteAEliminar.id);
      toast.success('Reporte eliminado', 'El reporte fue eliminado correctamente');
      setShowConfirmDelete(false);
      loadReportes();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo eliminar el reporte');
    }
  };

  const volverALista = () => {
    setVistaFormulario(false);
    setReporteActual(null);
    setModoCrear(false);
  };

  const getEstadoBadge = (estado) => {
    const estilos = {
      borrador: 'bg-yellow-100 text-yellow-700',
      confirmado: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-green-100 text-green-700',
    };
    const nombres = {
      borrador: 'Borrador',
      confirmado: 'Confirmado',
      cerrado: 'Cerrado',
    };
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${estilos[estado] || 'bg-gray-100 text-gray-700'}`}>
        {nombres[estado] || estado}
      </span>
    );
  };

  // Si estamos en vista formulario
  if (vistaFormulario) {
    return (
      <ReportePerforacionForm
        reporte={reporteActual}
        modoCrear={modoCrear}
        polvorin={polvorin}
        polvorines={polvorines}
        tipos={tipos}
        faenaActual={faenaActual}
        onVolver={volverALista}
        onRefresh={() => {
          onRefresh?.();
          loadReportes();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Acciones */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Reportes de Perforación y Tronadura</h3>
          <Button variant="primary" icon={HiPlus} onClick={crearReporte}>
            Nuevo Reporte
          </Button>
        </div>
      </Card>

      {/* Filtros */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HiFunnel className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filtros.estado}
            onChange={(e) => handleFiltroChange('estado', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="confirmado">Confirmado</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <select
            value={filtros.turno}
            onChange={(e) => handleFiltroChange('turno', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          >
            <option value="">Todos los turnos</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
            <option value="Noche">Noche</option>
          </select>
          <SearchableSelect
            options={frentesTrabajo.map((f) => ({ value: f.id, label: f.codigo_completo }))}
            value={filtros.id_frente_trabajo ? parseInt(filtros.id_frente_trabajo) : ''}
            onChange={(val) => handleFiltroChange('id_frente_trabajo', val || '')}
            placeholder="Todos los frentes"
          />
          <input
            type="date"
            value={filtros.fecha_desde}
            onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
          <input
            type="date"
            value={filtros.fecha_hasta}
            onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
        {Object.values(filtros).some((v) => v !== '') && (
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600"></div>
          </div>
        ) : reportes.length === 0 ? (
          <div className="text-center py-12">
            <HiDocumentText className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay reportes registrados</p>
            <p className="text-sm text-gray-400 mt-2">Cree su primer reporte de perforación y tronadura</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 bg-gradient-to-r from-red-50 to-orange-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Turno</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Estado</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Líneas</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Resumen Explosivos</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((reporte) => (
                    <tr key={reporte.id} className="border-b hover:bg-red-50/50 even:bg-gray-50/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{reporte.codigo}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{reporte.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{reporte.turno}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{getEstadoBadge(reporte.estado)}</td>
                      <td className="px-4 py-3 text-center font-medium">{reporte.lineas_count || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(reporte.totales_explosivos || []).slice(0, 3).map((t) => (
                            <span key={t.id_tipo_explosivo} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                              {t.tipo_explosivo?.codigo}: {parseFloat(t.cantidad_total).toLocaleString('es-CL')}
                            </span>
                          ))}
                          {(reporte.totales_explosivos || []).length > 3 && (
                            <span className="text-xs text-gray-400">+{reporte.totales_explosivos.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => verReporte(reporte)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalle"
                          >
                            {reporte.estado === 'borrador' ? <HiPencil className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                          </button>
                          {reporte.estado === 'borrador' && (
                            <button
                              onClick={() => confirmarEliminar(reporte)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <HiTrash className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={eliminarReporte}
        title="Eliminar Reporte"
        message={`¿Está seguro de eliminar el reporte "${reporteAEliminar?.codigo}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}
