import { useState, useEffect, useRef, useCallback } from 'react';
import {
  HiPlus,
  HiDocumentText,
  HiFunnel,
  HiTrash,
  HiPencilSquare,
  HiMagnifyingGlass,
  HiXMark,
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
import useJornadas from '../../../hooks/useJornadas';

// "2026-08-27T04:00:00.000000Z" o "2026-08-27" -> "27-08-2026"
function fmtFecha(v) {
  if (!v) return '—';
  const iso = String(v).slice(0, 10);
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}-${m}-${y}` : iso;
}

const FILTROS_VACIOS = {
  buscar: '',
  estado: '',
  turno: '',
  fecha_desde: '',
  fecha_hasta: '',
  id_frente_trabajo: '',
};

// Se guardan los filtros y la página por faena, para que al reentrar al módulo
// (o recargar) la operadora siga donde estaba y no tenga que rearmar el filtro.
const claveStorage = (faenaId) => `reportes_pt_filtros_${faenaId || 'all'}`;

function cargarFiltrosGuardados(faenaId) {
  try {
    const raw = localStorage.getItem(claveStorage(faenaId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      filtros: { ...FILTROS_VACIOS, ...(data.filtros || {}) },
      pagina: data.pagina || 1,
      preset: data.preset || '',
    };
  } catch {
    return null;
  }
}

// Presets de fecha: devuelven { fecha_desde, fecha_hasta } en formato YYYY-MM-DD.
function rangoPreset(preset) {
  const hoy = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const primerDiaMes = (y, m) => new Date(y, m, 1);
  const ultimoDiaMes = (y, m) => new Date(y, m + 1, 0);

  switch (preset) {
    case 'hoy':
      return { fecha_desde: fmt(hoy), fecha_hasta: fmt(hoy) };
    case 'semana': {
      const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - diaSemana);
      return { fecha_desde: fmt(lunes), fecha_hasta: fmt(hoy) };
    }
    case 'mes':
      return {
        fecha_desde: fmt(primerDiaMes(hoy.getFullYear(), hoy.getMonth())),
        fecha_hasta: fmt(hoy),
      };
    case 'mes_pasado': {
      const y = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
      const m = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
      return { fecha_desde: fmt(primerDiaMes(y, m)), fecha_hasta: fmt(ultimoDiaMes(y, m)) };
    }
    default:
      return { fecha_desde: '', fecha_hasta: '' };
  }
}

const PRESETS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes_pasado', label: 'Mes pasado' },
];

export default function ReportesPerforacionView({ polvorin, polvorines = [], tipos, faenaActual, onRefresh }) {
  const turnosPyt = useJornadas('perforacion');
  const toast = useToast();
  const faenaId = faenaActual?.id || null;

  const guardado = useRef(cargarFiltrosGuardados(faenaId)).current;

  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState([]);
  const [currentPage, setCurrentPage] = useState(guardado?.pagina || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [frentesTrabajo, setFrentesTrabajo] = useState([]);

  const [filtros, setFiltros] = useState(guardado?.filtros || FILTROS_VACIOS);
  const [presetActivo, setPresetActivo] = useState(guardado?.preset || '');
  // `buscar` se teclea sin disparar la búsqueda en cada letra
  const [buscarTexto, setBuscarTexto] = useState(guardado?.filtros?.buscar || '');

  const [reporteActual, setReporteActual] = useState(null);
  const [vistaFormulario, setVistaFormulario] = useState(false);
  const [modoCrear, setModoCrear] = useState(false);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [reporteAEliminar, setReporteAEliminar] = useState(null);

  // Para restaurar contexto al volver del formulario
  const scrollAlVolver = useRef(0);
  const [filaResaltada, setFilaResaltada] = useState(null);
  const filaRefs = useRef({});

  // Debounce del buscador de texto
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((prev) => (prev.buscar === buscarTexto ? prev : { ...prev, buscar: buscarTexto }));
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [buscarTexto]);

  useEffect(() => {
    if ((polvorin?.id || polvorines.length > 0) && !vistaFormulario) {
      loadReportes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polvorin, polvorines, currentPage, filtros, vistaFormulario, faenaId]);

  // Persistir filtros + página
  useEffect(() => {
    try {
      localStorage.setItem(
        claveStorage(faenaId),
        JSON.stringify({ filtros, pagina: currentPage, preset: presetActivo }),
      );
    } catch {
      /* localStorage lleno o bloqueado — no es crítico */
    }
  }, [filtros, currentPage, presetActivo, faenaId]);

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
      if (faenaId) params.faena_id = faenaId;
      const response = await explosivosService.getReportes(params);
      setReportes(response.data || []);
      setTotalPages(response.last_page || 1);
      setTotalRecords(response.total || 0);
    } catch {
      toast.error('Error', 'No se pudieron cargar los reportes');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (name, value) => {
    setFiltros((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const aplicarPreset = (preset) => {
    if (presetActivo === preset) {
      // segundo click = desactivar
      setPresetActivo('');
      setFiltros((prev) => ({ ...prev, fecha_desde: '', fecha_hasta: '' }));
    } else {
      setPresetActivo(preset);
      const rango = rangoPreset(preset);
      setFiltros((prev) => ({ ...prev, ...rango }));
    }
    setCurrentPage(1);
  };

  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setBuscarTexto('');
    setPresetActivo('');
    setCurrentPage(1);
  };

  const hayFiltros =
    Object.values(filtros).some((v) => v !== '') || presetActivo !== '';

  const crearReporte = () => {
    scrollAlVolver.current = window.scrollY;
    setModoCrear(true);
    setReporteActual(null);
    setVistaFormulario(true);
  };

  const verReporte = async (reporte) => {
    scrollAlVolver.current = window.scrollY;
    try {
      const detalle = await explosivosService.getReporte(reporte.id);
      setReporteActual(detalle);
      setModoCrear(false);
      setVistaFormulario(true);
    } catch {
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

  const volverALista = useCallback((idReporteTocado) => {
    setVistaFormulario(false);
    setReporteActual(null);
    setModoCrear(false);
    if (idReporteTocado) {
      setFilaResaltada(idReporteTocado);
    }
  }, []);

  // Al volver a la lista: restaurar scroll y resaltar/scrollear a la fila tocada
  useEffect(() => {
    if (vistaFormulario) return;
    if (filaResaltada && filaRefs.current[filaResaltada]) {
      filaRefs.current[filaResaltada].scrollIntoView({ block: 'center', behavior: 'smooth' });
      const t = setTimeout(() => setFilaResaltada(null), 2600);
      return () => clearTimeout(t);
    }
    if (scrollAlVolver.current) {
      window.scrollTo({ top: scrollAlVolver.current });
    }
  }, [vistaFormulario, reportes, filaResaltada]);

  const getEstadoBadge = (reporte) => {
    if (reporte.en_correccion) {
      return (
        <span
          className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
          title={`En corrección${reporte.correccion_por ? ` por ${reporte.correccion_por}` : ''}`}
        >
          En corrección
        </span>
      );
    }
    const estilos = {
      borrador: 'bg-yellow-100 text-yellow-700',
      confirmado: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-green-100 text-green-700',
    };
    const nombres = { borrador: 'Borrador', confirmado: 'Confirmado', cerrado: 'Cerrado' };
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${estilos[reporte.estado] || 'bg-gray-100 text-gray-700'}`}>
          {nombres[reporte.estado] || reporte.estado}
        </span>
        {reporte.corregido_en && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700"
            title={`Corregido el ${new Date(reporte.corregido_en).toLocaleDateString('es-CL')}${reporte.corregido_por ? ` por ${reporte.corregido_por}` : ''}${reporte.corregido_toco_devoluciones ? ' — devoluciones ajustadas' : ''}`}
          >
            <HiPencilSquare className="w-3 h-3" />
            corregido{reporte.corregido_toco_devoluciones ? ' · dev.' : ''}
          </span>
        )}
      </div>
    );
  };

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

      {/* Buscador + Filtros */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HiFunnel className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">Buscar y filtrar</span>
        </div>

        {/* Buscador de texto por código */}
        <div className="relative mb-4">
          <HiMagnifyingGlass className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={buscarTexto}
            onChange={(e) => setBuscarTexto(e.target.value)}
            placeholder="Buscar por código de reporte (ej: 0155, Madrugada-Cabildo)…"
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
          {buscarTexto && (
            <button
              type="button"
              onClick={() => setBuscarTexto('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Limpiar"
            >
              <HiXMark className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Presets de fecha */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aplicarPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                presetActivo === p.id
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="text-xs text-gray-400 self-center ml-1">o rango manual:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            {turnosPyt.nombresFiltro.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <SearchableSelect
            options={frentesTrabajo.map((f) => ({ value: f.id, label: f.codigo_completo }))}
            value={filtros.id_frente_trabajo ? parseInt(filtros.id_frente_trabajo) : ''}
            onChange={(val) => handleFiltroChange('id_frente_trabajo', val || '')}
            placeholder="Todos los frentes"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => { setPresetActivo(''); handleFiltroChange('fecha_desde', e.target.value); }}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
            />
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => { setPresetActivo(''); handleFiltroChange('fecha_hasta', e.target.value); }}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
            />
          </div>
        </div>

        {hayFiltros && (
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              Limpiar todo
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
            <p className="text-gray-500 text-lg">
              {hayFiltros ? 'Ningún reporte coincide con la búsqueda' : 'No hay reportes registrados'}
            </p>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="text-sm text-red-600 hover:underline mt-2">
                Limpiar búsqueda
              </button>
            )}
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
                    <tr
                      key={reporte.id}
                      ref={(el) => { filaRefs.current[reporte.id] = el; }}
                      className={`border-b transition-colors ${
                        filaResaltada === reporte.id
                          ? 'bg-amber-50 ring-2 ring-inset ring-amber-300'
                          : 'hover:bg-red-50/50 even:bg-gray-50/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        {(() => {
                          const partes = String(reporte.codigo || '').split('-');
                          const corr = partes.length > 1 ? partes[partes.length - 1] : '';
                          const resto = corr ? reporte.codigo.slice(0, -(corr.length + 1)) : reporte.codigo;
                          return (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                              {resto}<span className="text-gray-400">-</span>
                              <span className="font-semibold text-gray-900">{corr}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-900 tabular-nums">{fmtFecha(reporte.fecha)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{reporte.turno}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{getEstadoBadge(reporte)}</td>
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
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Abrir reporte"
                          >
                            <HiPencilSquare className="w-5 h-5" />
                          </button>
                          {!reporte.en_correccion && (
                            <button
                              onClick={() => confirmarEliminar(reporte)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar reporte"
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

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              perPage={15}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={eliminarReporte}
        title="Eliminar reporte"
        message={
          reporteAEliminar && reporteAEliminar.estado !== 'borrador'
            ? `Eliminar el reporte "${reporteAEliminar?.codigo}"? Se revierten sus movimientos de stock y se borra con todas sus líneas. Esta acción no se puede deshacer.`
            : `¿Está seguro de eliminar el reporte "${reporteAEliminar?.codigo}"? Esta acción no se puede deshacer.`
        }
        confirmText="Eliminar reporte"
        confirmVariant="danger"
      />
    </div>
  );
}
