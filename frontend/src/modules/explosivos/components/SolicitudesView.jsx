import { useState, useEffect } from 'react';
import {
  HiClipboardDocumentList,
  HiCheckCircle,
  HiClock,
  HiXMark,
  HiUser,
  HiCube,
  HiInformationCircle,
  HiTag,
  HiCalendar,
  HiPencilSquare,
  HiMagnifyingGlass,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import Pagination from '../../../shared/components/molecules/Pagination';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(dateStr) {
  if (!dateStr) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))
    ? new Date(dateStr + 'T12:00:00')
    : new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatNum(val) {
  return (parseFloat(val) || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

const TURNO_CONFIG = {
  AM:        { label: 'AM',        bg: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  PM:        { label: 'PM',        bg: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-400' },
  Noche:     { label: 'Noche',     bg: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  Madrugada: { label: 'Madrugada', bg: 'bg-violet-100 text-violet-700', dot: 'bg-violet-400' },
  // valores legados
  dia:   { label: 'Día',   bg: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  noche: { label: 'Noche', bg: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
};

// ─── OrdenTrabajo ─────────────────────────────────────────────────────────────
// Hoja de orden: encabezado + totales siempre visibles; el desglose por frente
// se carga y muestra solo si se pide (antes venía siempre y la lista era enorme).

function OrdenTrabajo({ reporte, onCerrar }) {
  const [lineas, setLineas] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [yaCargado, setYaCargado] = useState(false);

  const esPendiente = reporte.estado === 'confirmado';
  const turno = TURNO_CONFIG[reporte.turno]
    || { label: reporte.turno || '—', bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  const totales = reporte.totales_explosivos || [];
  const nFrentes = reporte.lineas_count ?? 0;

  const toggleDesglose = () => {
    const abrir = !expandido;
    setExpandido(abrir);
    if (abrir && !yaCargado) {
      setLoadingLineas(true);
      explosivosService.getReporte(reporte.id)
        .then(d => setLineas(d.lineas || []))
        .catch(() => setLineas([]))
        .finally(() => { setLoadingLineas(false); setYaCargado(true); });
    }
  };

  return (
    <div className={`bg-white rounded-xl overflow-hidden border ${
      esPendiente ? 'border-blue-300 shadow-md shadow-blue-50' : 'border-gray-200'
    }`}>

      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b ${
        esPendiente ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm font-bold text-gray-800">
            {reporte.codigo}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <HiCalendar className="w-3.5 h-3.5" />
            {formatFecha(reporte.fecha)}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${turno.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${turno.dot}`} />
            {turno.label}
          </span>
          {reporte.confirmado_por && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <HiUser className="w-3.5 h-3.5" />
              {reporte.confirmado_por}
            </span>
          )}
        </div>

        {esPendiente ? (
          <button
            onClick={() => onCerrar(reporte)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shrink-0"
          >
            <HiCheckCircle className="w-4 h-4" />
            Marcar preparado
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <HiCheckCircle className="w-4 h-4" />
            Preparado
          </span>
        )}
      </div>

      {/* ── Aviso de corrección ───────────────────────────────────────────── */}
      {reporte.corregido_en && (
        <div className={`px-5 py-2.5 border-b text-xs flex items-start gap-2 ${
          reporte.corregido_toco_devoluciones
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-blue-50 border-blue-100 text-blue-700'
        }`}>
          <HiPencilSquare className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Reporte corregido</strong> el {formatFecha(reporte.corregido_en)}
            {reporte.corregido_por ? ` por ${reporte.corregido_por}` : ''}.
            {reporte.corregido_toco_devoluciones
              ? ' Las devoluciones fueron ajustadas — revisá que el conteo físico siga siendo correcto.'
              : ' Los datos de perforación cambiaron; las devoluciones no se tocaron.'}
          </span>
        </div>
      )}

      {/* ── Totales ────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1.5 text-gray-500">
          <HiCube className="w-3.5 h-3.5" />
          {esPendiente ? 'Total a preparar' : 'Total preparado'}
        </span>
        {totales.length === 0 ? (
          <span className="text-xs text-gray-400 italic">Sin explosivos calculados</span>
        ) : (
          totales.map((t) => (
            <div key={t.id_tipo_explosivo} className="flex items-baseline gap-1.5">
              <span className="font-mono text-xs font-medium text-gray-500">
                {t.tipo_explosivo?.codigo}
              </span>
              <span className="text-lg font-bold leading-none text-gray-800 tabular-nums">
                {formatNum(t.cantidad_total)}
              </span>
              <span className="text-xs text-gray-400">
                {t.tipo_explosivo?.unidad_medida}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── Desglose por frente (colapsable) ───────────────────────────────── */}
      {nFrentes > 0 && (
        <button
          onClick={toggleDesglose}
          className="w-full px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5 hover:bg-gray-100 transition-colors text-left"
        >
          <HiTag className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {expandido ? 'Ocultar desglose por frente' : 'Ver desglose por frente'}
          </span>
          <span className="text-xs text-gray-400 font-normal ml-1">
            ({nFrentes} {nFrentes === 1 ? 'frente' : 'frentes'})
          </span>
          <span className="ml-auto text-gray-400 text-xs">{expandido ? '▾' : '▸'}</span>
        </button>
      )}

      {expandido && loadingLineas && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {expandido && !loadingLineas && lineas.length === 0 && (
        <div className="px-5 py-4 text-xs text-gray-400 italic text-center">
          Sin desglose por frente disponible
        </div>
      )}
      {expandido && !loadingLineas && lineas.length > 0 && (
        <div className="divide-y divide-gray-100">
          {lineas.map((linea, idx) => (
            <div key={linea.id} className={`px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-3 ${
              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
            }`}>
              {/* Info del frente */}
              <div className="sm:w-56 shrink-0">
                <p className="font-semibold text-sm text-gray-800">
                  {linea.frente_trabajo?.codigo_completo || `Frente #${linea.id_frente_trabajo}`}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {linea.tipo_frente?.nombre && (
                    <span className="text-xs text-gray-400">{linea.tipo_frente.nombre}</span>
                  )}
                  <span className="text-xs text-gray-400">{linea.numero_tiros} tiros</span>
                  {linea.personal && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <HiUser className="w-3 h-3" />
                      {linea.personal.nombre} {linea.personal.apellido || ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Explosivos del frente — mismo orden que totales */}
              <div className="flex flex-wrap gap-2">
                {totales.map((total) => {
                  const exp = linea.explosivos?.find(
                    e => (e.id_tipo_explosivo ?? e.tipo_explosivo?.id) === total.id_tipo_explosivo
                  );
                  if (!exp) {
                    return (
                      <div
                        key={total.id_tipo_explosivo}
                        className="w-20 rounded-lg py-2 px-1 border-2 border-dashed border-gray-200 text-center shrink-0"
                      >
                        <p className="font-mono text-xs font-semibold leading-tight truncate px-1 text-gray-300">
                          {total.tipo_explosivo?.codigo}
                        </p>
                        <p className="text-lg font-bold leading-none tabular-nums mt-1 text-gray-200">—</p>
                        <p className="text-xs leading-tight mt-0.5 truncate px-1 text-gray-200">
                          {total.tipo_explosivo?.unidad_medida}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={exp.id}
                      className="w-20 rounded-lg py-2 px-1 border border-gray-200 bg-gray-50 text-gray-700 text-center shrink-0"
                    >
                      <p className="font-mono text-xs font-semibold leading-tight truncate px-1">
                        {exp.tipo_explosivo?.codigo}
                      </p>
                      <p className="text-lg font-bold leading-none tabular-nums mt-1">
                        {formatNum(exp.cantidad_final ?? exp.cantidad_calculada)}
                      </p>
                      <p className="text-xs leading-tight mt-0.5 truncate px-1 text-gray-400">
                        {exp.tipo_explosivo?.unidad_medida}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Observaciones */}
      {reporte.observaciones && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          <span className="font-medium text-gray-600">Observaciones: </span>
          {reporte.observaciones}
        </div>
      )}
    </div>
  );
}

// ─── CerrarModal ──────────────────────────────────────────────────────────────

function CerrarModal({ reporte, onClose, onConfirm, submitting }) {
  const totales = reporte?.totales_explosivos || [];
  const [devoluciones, setDevoluciones] = useState(
    totales.map(t => ({
      id_tipo_explosivo: t.id_tipo_explosivo,
      tipo_explosivo: t.tipo_explosivo,
      cantidad_despachada: t.cantidad_total,
      cantidad_devuelta: '',
      motivo: '',
    }))
  );

  const setDevolucion = (idx, field, value) => {
    setDevoluciones(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const hayDevoluciones = devoluciones.some(d => parseFloat(d.cantidad_devuelta) > 0);

  const handleConfirm = () => {
    const devs = devoluciones
      .filter(d => parseFloat(d.cantidad_devuelta) > 0)
      .map(d => ({
        id_tipo_explosivo: d.id_tipo_explosivo,
        cantidad: parseFloat(d.cantidad_devuelta),
        motivo: d.motivo || 'Sobrante de tronadura',
      }));
    onConfirm(devs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Cerrar solicitud</h3>
            <p className="text-sm text-gray-500">{reporte?.codigo} — ¿Hubo explosivos devueltos?</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <HiInformationCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            Si hay explosivos que no se utilizaron y fueron devueltos al polvorín, ingresa las cantidades. Si no hay devoluciones, deja todo en 0.
          </p>

          <div className="space-y-3">
            {devoluciones.map((dev, idx) => (
              <div key={dev.id_tipo_explosivo} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-mono text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                      {dev.tipo_explosivo?.codigo}
                    </span>
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      {dev.tipo_explosivo?.nombre}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Despachado: <strong>{formatNum(dev.cantidad_despachada)} {dev.tipo_explosivo?.unidad_medida}</strong>
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Cantidad devuelta</label>
                    <input
                      type="number"
                      min="0"
                      max={dev.cantidad_despachada}
                      step="0.01"
                      value={dev.cantidad_devuelta}
                      onChange={(e) => setDevolucion(idx, 'cantidad_devuelta', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  {parseFloat(dev.cantidad_devuelta) > 0 && (
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Motivo (opcional)</label>
                      <input
                        type="text"
                        value={dev.motivo}
                        onChange={(e) => setDevolucion(idx, 'motivo', e.target.value)}
                        placeholder="Sobrante..."
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={HiCheckCircle}
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 justify-center bg-green-600 hover:bg-green-700"
          >
            {submitting ? 'Cerrando...' : hayDevoluciones ? 'Confirmar con devoluciones' : 'Confirmar sin devoluciones'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── SolicitudesView principal ─────────────────────────────────────────────────

export default function SolicitudesView({ polvorin, onRefresh }) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [filtroEstado, setFiltroEstado] = useState('confirmado');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [preset, setPreset] = useState('');
  const [buscar, setBuscar] = useState('');
  const [buscarInput, setBuscarInput] = useState('');

  const [reporteACerrar, setReporteACerrar] = useState(null);
  const [submittingCerrar, setSubmittingCerrar] = useState(false);
  const [resumenSalida, setResumenSalida] = useState(null);

  // debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => { setBuscar(buscarInput); setCurrentPage(1); }, 350);
    return () => clearTimeout(t);
  }, [buscarInput]);

  useEffect(() => {
    if (polvorin?.id) loadReportes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polvorin, currentPage, filtroEstado, fechaDesde, fechaHasta, buscar]);

  const loadReportes = async () => {
    setLoading(true);
    try {
      const params = { id_polvorin: polvorin.id, page: currentPage, per_page: 10 };
      if (filtroEstado) params.estado = filtroEstado;
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;
      if (buscar) params.buscar = buscar;

      const response = await explosivosService.getReportes(params);
      setReportes(response.data || []);
      setTotalPages(response.last_page || 1);
      setTotalRecords(response.total || 0);
    } catch {
      toast.error('Error', 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const aplicarPreset = (id) => {
    const hoy = new Date();
    const f = (d) => d.toISOString().slice(0, 10);
    let desde = '', hasta = '';
    if (id === preset) { setPreset(''); setFechaDesde(''); setFechaHasta(''); setCurrentPage(1); return; }
    if (id === 'hoy') { desde = hasta = f(hoy); }
    else if (id === 'semana') {
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      desde = f(lunes); hasta = f(hoy);
    } else if (id === 'mes') { desde = f(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); hasta = f(hoy); }
    else if (id === 'mes_pasado') {
      const y = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
      const m = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
      desde = f(new Date(y, m, 1)); hasta = f(new Date(y, m + 1, 0));
    }
    setPreset(id); setFechaDesde(desde); setFechaHasta(hasta); setCurrentPage(1);
  };

  const handleCerrar = async (devoluciones) => {
    if (!reporteACerrar) return;
    setSubmittingCerrar(true);
    try {
      // registrarDevoluciones ya cierra el reporte; cerrarReporte es solo para el
      // caso sin devoluciones. Llamar a los dos deja el segundo en 422.
      // Acá recién se genera la salida real de stock (planificado - devuelto),
      // así que mostramos el resumen de movimientos generados en este paso.
      const res = devoluciones.length > 0
        ? await explosivosService.registrarDevoluciones(reporteACerrar.id, devoluciones)
        : await explosivosService.cerrarReporte(reporteACerrar.id);

      toast.success('Solicitud cerrada', `${reporteACerrar.codigo} fue marcada como preparada`);
      setResumenSalida({
        codigo: reporteACerrar.codigo,
        movimientos: (res.reporte?.movimientos || []).filter((m) => m.tipo === 'salida'),
      });
      setReporteACerrar(null);
      loadReportes();
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo cerrar la solicitud');
    } finally {
      setSubmittingCerrar(false);
    }
  };

  const pendientesCount = reportes.filter(r => r.estado === 'confirmado').length;

  const FILTROS = [
    { value: 'confirmado', label: 'Pendientes' },
    { value: 'cerrado',    label: 'Cerradas' },
    { value: '',           label: 'Todas' },
  ];

  return (
    <div className="space-y-4">

      {/* Barra de control */}
      <Card className="py-4 px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Solicitudes de Explosivos</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Reportes del Jefe de Mina — {polvorin?.nombre}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {pendientesCount > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                </span>
                <span className="text-sm font-semibold text-blue-700">{pendientesCount}</span>
                <span className="text-xs text-blue-600">pendiente{pendientesCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            <button
              onClick={loadReportes}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => { setFiltroEstado(f.value); setCurrentPage(1); }}
                className={`text-sm px-3 py-1 rounded-full border transition-all ${
                  filtroEstado === f.value
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-red-300 hover:text-red-600'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto relative">
              <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscarInput}
                onChange={(e) => setBuscarInput(e.target.value)}
                placeholder="Buscar por código…"
                className="text-sm pl-8 pr-7 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 w-52"
              />
              {buscarInput && (
                <button onClick={() => setBuscarInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'hoy', l: 'Hoy' }, { id: 'semana', l: 'Esta semana' },
              { id: 'mes', l: 'Este mes' }, { id: 'mes_pasado', l: 'Mes pasado' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => aplicarPreset(p.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  preset === p.id ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {p.l}
              </button>
            ))}
            <span className="text-xs text-gray-400 mx-1">o rango:</span>
            <input type="date" value={fechaDesde}
              onChange={(e) => { setPreset(''); setFechaDesde(e.target.value); setCurrentPage(1); }}
              className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
            <input type="date" value={fechaHasta}
              onChange={(e) => { setPreset(''); setFechaHasta(e.target.value); setCurrentPage(1); }}
              className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
            {(fechaDesde || fechaHasta) && (
              <button onClick={() => { setPreset(''); setFechaDesde(''); setFechaHasta(''); setCurrentPage(1); }}
                className="text-gray-400 hover:text-gray-600">
                <HiXMark className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Lista tipo orden de trabajo */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600" />
        </div>
      ) : reportes.length === 0 ? (
        <Card className="text-center py-16">
          <HiClipboardDocumentList className="w-16 h-16 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {filtroEstado === 'confirmado' ? 'No hay solicitudes pendientes' : 'No hay solicitudes para este filtro'}
          </p>
          {filtroEstado === 'confirmado' && (
            <p className="text-sm text-gray-400 mt-1">
              Las solicitudes aparecerán cuando el Jefe de Mina confirme un reporte
            </p>
          )}
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {reportes.map((reporte) => (
              <OrdenTrabajo
                key={reporte.id}
                reporte={reporte}
                onCerrar={setReporteACerrar}
              />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
            perPage={10}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Modal cerrar */}
      {reporteACerrar && (
        <CerrarModal
          reporte={reporteACerrar}
          onClose={() => setReporteACerrar(null)}
          onConfirm={handleCerrar}
          submitting={submittingCerrar}
        />
      )}

      {/* Resumen de la salida real generada al cerrar (recién acá se descuenta stock) */}
      {resumenSalida && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Movimientos de Salida Generados</h3>
            <p className="text-xs text-gray-500 mb-4">{resumenSalida.codigo} — recién ahora se descontó del stock del polvorín.</p>
            {resumenSalida.movimientos.length === 0 ? (
              <p className="text-sm text-gray-500">No hubo salida neta (todo lo planificado fue devuelto).</p>
            ) : (
              <div className="space-y-2">
                {resumenSalida.movimientos.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="text-sm font-medium">{m.tipo_explosivo?.codigo} - {m.tipo_explosivo?.nombre}</span>
                    <span className="text-sm font-bold text-red-700">-{parseFloat(m.cantidad).toLocaleString('es-CL')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={() => setResumenSalida(null)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
