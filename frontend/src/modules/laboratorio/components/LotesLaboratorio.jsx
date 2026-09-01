import { useState, useEffect, useCallback } from 'react';
import { HiCube, HiTruck, HiClipboardDocumentList, HiXMark, HiArrowRight } from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Pagination from '../../../shared/components/molecules/Pagination';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import lotesMaestrosService from '../../../services/laboratorio';
import extraerMensajeError from '../../../core/services/apiError';
import { useAuth } from '../../../core/context/AuthContext';

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return '-';
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}-${mes}-${anio}`;
};

const formatearFechaHora = (fecha) => {
  if (!fecha) return null;
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return null;
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${dia}-${mes}-${anio} ${hh}:${mm}`;
};

// Estados de la reconciliación de leyes de Laboratorio (independiente del estado Abierto/Completado del lote).
// Solo cambian en 2 hitos: cargar Segunda, y llegar a Canje o Tercero — ver Lote::actualizarEstadoLaboratorio().
const ESTADO_LAB_BADGE = {
  'Cerrado': 'bg-gray-100 text-gray-600 border-gray-200',
  'Con Paquete Segunda': 'bg-blue-50 text-blue-700 border-blue-200',
  'Canjeado': 'bg-green-50 text-green-700 border-green-200',
  'En Tercero': 'bg-amber-50 text-amber-700 border-amber-200',
  'Resuelto por Tercero': 'bg-teal-50 text-teal-700 border-teal-200',
};

const vacioSiNulo = (v) => (v === null || v === undefined ? '' : String(v));
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : parseFloat(v));

const diasDesde = (fecha) => {
  if (!fecha) return null;
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

// Las 4 etapas de la reconciliación de Laboratorio, con su valor y fecha si ya se cargaron.
// Se usa tanto para el stepper (columna Estado Lab) como para el ícono de fechas (columna Fecha)
// — un solo cálculo, dos lugares donde se muestra.
const getEtapasLey = (lote) => {
  const enviadoTercero = !!lote.enviado_a_tercero;
  return [
    { short: 'Segunda', label: 'Ley Paquete Segunda', value: numOrNull(lote.ley_paquete_segunda), fecha: lote.fecha_ley_paquete_segunda, alcanzada: lote.ley_paquete_segunda != null },
    { short: 'Seg. Prima', label: 'Ley Paquete Segunda Prima', value: numOrNull(lote.ley_paquete_segunda_prima), fecha: lote.fecha_ley_paquete_segunda_prima, alcanzada: lote.ley_paquete_segunda_prima != null },
    { short: 'Primera', label: 'Ley Paquete Primera', value: numOrNull(lote.ley_paquete_primera), fecha: lote.fecha_ley_paquete_primera, alcanzada: lote.ley_paquete_primera != null },
    enviadoTercero
      ? { short: 'Tercero', label: 'Ley Paquete Tercera', value: numOrNull(lote.ley_paquete_tercera), fecha: lote.fecha_ley_paquete_tercera, alcanzada: true, enTramite: lote.ley_paquete_tercera == null }
      : { short: 'Canje', label: 'Ley Canje', value: numOrNull(lote.ley_canje), fecha: lote.fecha_ley_canje, alcanzada: lote.ley_canje != null },
  ];
};

// Mismo stepper visual que StepperAvance en LotesComercial.jsx (Gerencial), adaptado a las 4
// etapas de la reconciliación de Laboratorio. A diferencia de Gerencial, el índice no sale del
// estado_laboratorio (que solo marca 2 hitos) sino de qué campos de ley ya tienen valor — así
// distingue Segunda Prima y Primera, que hoy comparten el mismo estado "Con Paquete Segunda".
function StepperLeyesLab({ etapas }) {
  const indiceActual = etapas.reduce((ultimo, e, i) => (e.alcanzada ? i : ultimo), -1);

  return (
    <div className="flex items-center min-w-[210px]">
      {etapas.map((etapa, i) => {
        const completada = i < indiceActual;
        const actual = i === indiceActual;
        const titulo = etapa.value != null
          ? `${etapa.label} · ${etapa.value.toFixed(3)}% · ${formatearFecha(etapa.fecha)}`
          : etapa.enTramite
            ? `${etapa.label} · enviado a Tercero, resultado pendiente`
            : `${etapa.label} · aún no cargada`;
        return (
          <div key={etapa.short} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                title={titulo}
                className={`w-3 h-3 rounded-full border-2 cursor-default ${
                  completada
                    ? 'bg-emerald-500 border-emerald-500'
                    : actual
                      ? etapa.enTramite
                        ? 'bg-amber-400 border-amber-400 animate-pulse'
                        : 'bg-amber-400 border-amber-400'
                      : 'bg-white border-gray-300'
                }`}
              />
              <span className={`text-[9px] whitespace-nowrap ${actual ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                {etapa.short}
              </span>
            </div>
            {i < etapas.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < indiceActual ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Columna Fecha para lotes con algún avance: punto + línea conectora + fecha, en orden
// cronológico. Apertura/Cierre en gris (metadata del lote); las fechas de leyes en verde,
// el mismo verde "completada" del stepper de Estado Lab, para que se lean como un mismo sistema.
function LineaDeTiempoFechas({ items }) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={item.label} className="grid grid-cols-[10px_auto_1fr] gap-x-2 items-start">
          <div className="flex flex-col items-center self-stretch">
            <div className={`w-[7px] h-[7px] rounded-full mt-1 shrink-0 ${item.esLey ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {i < items.length - 1 && (
              <div className={`w-[1.5px] flex-1 mt-0.5 ${item.esLey ? 'bg-emerald-400' : 'bg-gray-300'}`} />
            )}
          </div>
          <span className={`text-xs tabular-nums ${item.esLey ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
            {formatearFecha(item.fecha)}
          </span>
          <span className={`text-xs ${item.esLey ? 'text-gray-500' : 'text-gray-300'}`}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// Un input de ley + su botón Guardar + la fecha en que quedó cargada (un paso del formulario secuencial)
function CampoLey({ label, value, onChange, onSave, saving, fecha, disabled }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        {fecha && <span className="text-[11px] text-gray-400">Cargado {formatearFechaHora(fecha)}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number" step="0.001" min="0" max="100"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 pr-7 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
        </div>
        <button
          onClick={onSave}
          disabled={saving || disabled}
          className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 shrink-0"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

export default function LotesLaboratorio() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  // Mismo permiso que ya habilita aprobar/rechazar certificados — Jefe de
  // Laboratorio lo tiene, Análisis de Muestras no. Acá gatilla ver Fecha/
  // Estado Lab/Acción y poder gestionar leyes; sin él, la tabla queda de
  // solo lectura con las 6 columnas básicas.
  const puedeGestionarLeyes = hasPermission('aprobar_certificados_laboratorio');
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [verModal, setVerModal] = useState({ show: false, lote: null });
  const [form, setForm] = useState({
    ley_paquete_segunda: '',
    ley_paquete_segunda_prima: '',
    ley_paquete_primera: '',
    ley_canje: '',
    ley_paquete_tercera: '',
  });
  const [guardando, setGuardando] = useState(null); // nombre del campo en guardado, 'enviar-tercero', o null

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    planta_id: '',
    empresa_id: '',
    fecha_desde: '',
    fecha_hasta: '',
  });
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    lotesMaestrosService.getPlantas().then(setPlantas).catch(() => setPlantas([]));
    lotesMaestrosService.getEmpresas().then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        estado: 'Completado',
        page: currentPage,
        per_page: perPage,
        search: debouncedSearchTerm || undefined,
        planta_id: filters.planta_id || undefined,
        empresa_id: filters.empresa_id || undefined,
        fecha_desde: filters.fecha_desde || undefined,
        fecha_hasta: filters.fecha_hasta || undefined,
      };
      Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

      const response = await lotesMaestrosService.getLotes(params);
      setLotes(response.data || []);
      setTotalPages(response.last_page || 1);
      setTotalRecords(response.total || 0);
    } catch (error) {
      console.error('Error cargando lotes:', error);
      toast.error('Error al cargar los lotes', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, filters]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({ planta_id: '', empresa_id: '', fecha_desde: '', fecha_hasta: '' });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPeso = lotes.reduce((s, l) => s + parseFloat(l.peso_total || 0), 0);
  const totalCam = lotes.reduce((s, l) => s + (l.numero_camionadas || 0), 0);
  const leyItems = lotes.filter((l) => l.ley_lote_promedio != null && parseFloat(l.peso_total || 0) > 0);
  const leyProm = leyItems.length
    ? leyItems.reduce((s, l) => s + l.ley_lote_promedio * parseFloat(l.peso_total || 0), 0) /
      leyItems.reduce((s, l) => s + parseFloat(l.peso_total || 0), 0)
    : null;

  // Refleja el lote actualizado tanto en el modal como en la fila de la tabla, sin recargar todo
  const patchLote = (loteActualizado) => {
    setVerModal((prev) => (prev.lote?.id === loteActualizado.id ? { ...prev, lote: loteActualizado } : prev));
    setLotes((prev) => prev.map((l) => (l.id === loteActualizado.id ? { ...l, ...loteActualizado } : l)));
  };

  const abrirVerModal = (lote) => {
    setVerModal({ show: true, lote });
    setForm({
      ley_paquete_segunda: vacioSiNulo(lote.ley_paquete_segunda),
      ley_paquete_segunda_prima: vacioSiNulo(lote.ley_paquete_segunda_prima),
      ley_paquete_primera: vacioSiNulo(lote.ley_paquete_primera),
      ley_canje: vacioSiNulo(lote.ley_canje),
      ley_paquete_tercera: vacioSiNulo(lote.ley_paquete_tercera),
    });
  };

  const cerrarVerModal = () => setVerModal({ show: false, lote: null });

  const guardarCampo = async (campo) => {
    if (!verModal.lote) return;
    setGuardando(campo);
    try {
      const valor = form[campo];
      const response = await lotesMaestrosService.actualizarLeyesLaboratorio(verModal.lote.id, {
        [campo]: valor === '' ? null : parseFloat(valor),
      });
      patchLote(response.lote);
      toast.success('Ley actualizada');
    } catch (error) {
      const mensaje = await extraerMensajeError(error, 'No se pudo guardar la ley');
      toast.error('Error al guardar', mensaje);
    } finally {
      setGuardando(null);
    }
  };

  const handleEnviarATercero = async () => {
    if (!verModal.lote) return;
    setGuardando('enviar-tercero');
    try {
      const response = await lotesMaestrosService.enviarLoteATercero(verModal.lote.id);
      patchLote(response.lote);
      toast.success('Lote enviado a Tercero');
    } catch (error) {
      const mensaje = await extraerMensajeError(error, 'No se pudo enviar a Tercero');
      toast.error('Error', mensaje);
    } finally {
      setGuardando(null);
    }
  };

  const lote = verModal.lote;
  const estadoLab = lote?.estado_laboratorio || 'Cerrado';
  // Progreso del orden secuencial: Segunda → Segunda Prima → Primera → Canje/Tercero → (Tercera)
  const tieneSegunda = lote?.ley_paquete_segunda != null;
  const tieneSegundaPrima = lote?.ley_paquete_segunda_prima != null;
  const tienePrimera = lote?.ley_paquete_primera != null;
  const enviadoATercero = !!lote?.enviado_a_tercero;

  return (
    <Card className="border-l-4 border-purple-400">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Lotes</h3>
        <p className="text-sm text-gray-600 mt-1">
          {loading ? 'Cargando...' : <>Total: <span className="font-semibold text-purple-600">{totalRecords}</span> lote{totalRecords !== 1 ? 's' : ''}</>}
        </p>
      </div>

      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
        {/* Búsqueda */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🔍 Buscar</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Número de lote, planta, empresa..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Pills planta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 shrink-0">Planta</span>
          <button
            onClick={() => handleFilterChange('planta_id', '')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${!filters.planta_id ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}
          >
            Todas
          </button>
          {plantas.map((p) => (
            <button
              key={p.id}
              onClick={() => handleFilterChange('planta_id', filters.planta_id === String(p.id) ? '' : String(p.id))}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${filters.planta_id === String(p.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:border-blue-500'}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>

        {/* Pills empresa */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 shrink-0">Empresa</span>
          <button
            onClick={() => handleFilterChange('empresa_id', '')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${!filters.empresa_id ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}
          >
            Todas
          </button>
          {empresas.map((e) => (
            <button
              key={e.id}
              onClick={() => handleFilterChange('empresa_id', filters.empresa_id === String(e.id) ? '' : String(e.id))}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${filters.empresa_id === String(e.id) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-700 border-violet-200 hover:border-violet-500'}`}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        {/* Rango de fecha + limpiar */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Desde</label>
            <input
              type="date"
              value={filters.fecha_desde}
              onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hasta</label>
            <input
              type="date"
              value={filters.fecha_hasta}
              onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="px-4 py-1.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {!loading && lotes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total lotes', val: totalRecords, unit: '', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
            { label: 'Peso esta pág.', val: totalPeso.toFixed(2), unit: ' t', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
            { label: 'Ley prom.', val: leyProm != null ? leyProm.toFixed(3) : '—', unit: leyProm != null ? '%' : '', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
            { label: 'Camionadas', val: totalCam, unit: '', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-100' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}{s.unit}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto" />
          <p className="text-gray-500 mt-4 text-sm">Cargando lotes…</p>
        </div>
      ) : lotes.length === 0 ? (
        <div className="text-center py-12">
          <HiCube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">Sin resultados</p>
          <p className="text-gray-400 text-sm">Prueba ajustando los filtros</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left font-semibold">N° Lote</th>
                <th className="py-3 px-4 text-left font-semibold">Planta</th>
                <th className="py-3 px-4 text-left font-semibold">Empresa</th>
                <th className="py-3 px-4 text-center font-semibold">Cam.</th>
                <th className="py-3 px-4 text-right font-semibold">Peso Total</th>
                <th className="py-3 px-4 text-center font-semibold">Ley Mezcla</th>
                {puedeGestionarLeyes && (
                  <>
                    <th className="py-3 px-4 text-left font-semibold">Fecha</th>
                    <th className="py-3 px-4 text-left font-semibold">Estado Lab</th>
                    <th className="py-3 px-4 text-center font-semibold">Acción</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lotes.map((l) => {
                const etapas = getEtapasLey(l);
                const tieneProgreso = etapas.some((e) => e.alcanzada);
                // fecha_cierre corrupta en datos antiguos (anterior a la apertura) — se ignora en vez de mostrar algo imposible.
                const cierreValido = l.fecha_cierre && (!l.fecha_creacion || new Date(l.fecha_cierre) >= new Date(l.fecha_creacion))
                  ? l.fecha_cierre
                  : null;
                const diasSinAvance = !tieneProgreso ? diasDesde(cierreValido || l.fecha_creacion) : null;
                return (
                <tr key={l.id} className="hover:bg-purple-50/50 transition-colors">
                  <td className="py-2.5 px-4">
                    <span className="font-mono font-bold text-gray-900">{l.numero_lote}</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-700 text-xs">{l.planta?.nombre || l.planta_nombre || '-'}</td>
                  <td className="py-2.5 px-4 text-gray-700 text-xs">{l.empresa?.nombre || l.empresa_nombre || '-'}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <HiTruck className="w-3 h-3" />{l.numero_camionadas || 0}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold tabular-nums text-gray-800">
                    {parseFloat(l.peso_total || 0).toFixed(2)} <span className="text-gray-400 font-normal text-xs">t</span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {l.ley_lote_promedio != null
                      ? <span className="tabular-nums font-semibold text-orange-700">{Number(l.ley_lote_promedio).toFixed(3)}%</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  {puedeGestionarLeyes && (
                    <>
                      <td className="py-2.5 px-4">
                        {!tieneProgreso && !cierreValido ? (
                          <span className="text-xs text-gray-500 tabular-nums">{formatearFecha(l.fecha_creacion)}</span>
                        ) : (
                          <LineaDeTiempoFechas
                            items={[
                              { label: 'Apertura', fecha: l.fecha_creacion, esLey: false },
                              ...(cierreValido ? [{ label: 'Cierre', fecha: cierreValido, esLey: false }] : []),
                              ...etapas.filter((e) => e.fecha).map((e) => ({ label: e.short, fecha: e.fecha, esLey: true })),
                            ]}
                          />
                        )}
                        {diasSinAvance != null && diasSinAvance >= 7 && (
                          <span className="block text-[9px] font-bold text-amber-700 mt-0.5">{diasSinAvance} días sin cargar leyes</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block ${tieneProgreso ? 'mb-1.5' : ''} px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${ESTADO_LAB_BADGE[l.estado_laboratorio] || ESTADO_LAB_BADGE['Cerrado']}`}>
                          {l.estado_laboratorio || 'Cerrado'}
                        </span>
                        {tieneProgreso && <StepperLeyesLab etapas={etapas} />}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => abrirVerModal(l)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                        >
                          <HiClipboardDocumentList className="w-3.5 h-3.5" /> Gestionar Leyes
                        </button>
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalRecords > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          perPage={perPage}
          onPageChange={handlePageChange}
        />
      )}

      {/* Modal "Ver" — reconciliación de leyes del lote */}
      {verModal.show && lote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Lote {lote.numero_lote}</h3>
              <button onClick={cerrarVerModal} className="text-gray-400 hover:text-gray-600">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Planta</p>
                  <p className="font-semibold text-gray-800">{lote.planta?.nombre || lote.planta_nombre || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Empresa</p>
                  <p className="font-semibold text-gray-800">{lote.empresa?.nombre || lote.empresa_nombre || '-'}</p>
                </div>
              </div>

              {/* Estado actual */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado Laboratorio:</span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${ESTADO_LAB_BADGE[estadoLab]}`}>
                  {estadoLab}
                </span>
              </div>

              <p className="text-xs text-gray-500 -mt-3">Todo en Cu Insoluble · orden: Segunda → Segunda Prima → Primera → Canje/Tercero</p>

              {/* Paso 1: Segunda — siempre visible, es el punto de partida */}
              <CampoLey
                label="1. Ley Paquete Segunda (Laboratorio)"
                value={form.ley_paquete_segunda}
                onChange={(v) => setForm((p) => ({ ...p, ley_paquete_segunda: v }))}
                onSave={() => guardarCampo('ley_paquete_segunda')}
                saving={guardando === 'ley_paquete_segunda'}
                fecha={lote.fecha_ley_paquete_segunda}
              />

              {/* Paso 2: Segunda Prima — se habilita al tener Segunda */}
              {tieneSegunda && (
                <CampoLey
                  label="2. Ley Paquete Segunda Prima"
                  value={form.ley_paquete_segunda_prima}
                  onChange={(v) => setForm((p) => ({ ...p, ley_paquete_segunda_prima: v }))}
                  onSave={() => guardarCampo('ley_paquete_segunda_prima')}
                  saving={guardando === 'ley_paquete_segunda_prima'}
                  fecha={lote.fecha_ley_paquete_segunda_prima}
                />
              )}

              {/* Paso 3: Primera — se habilita al tener Segunda Prima */}
              {tieneSegundaPrima && (
                <CampoLey
                  label="3. Ley Paquete Primera (Planta)"
                  value={form.ley_paquete_primera}
                  onChange={(v) => setForm((p) => ({ ...p, ley_paquete_primera: v }))}
                  onSave={() => guardarCampo('ley_paquete_primera')}
                  saving={guardando === 'ley_paquete_primera'}
                  fecha={lote.fecha_ley_paquete_primera}
                />
              )}

              {/* Paso 4: decisión Canje / Tercero — se habilita al tener Primera */}
              {tienePrimera && !enviadoATercero && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <CampoLey
                    label="4. Ley Canje"
                    value={form.ley_canje}
                    onChange={(v) => setForm((p) => ({ ...p, ley_canje: v }))}
                    onSave={() => guardarCampo('ley_canje')}
                    saving={guardando === 'ley_canje'}
                    fecha={lote.fecha_ley_canje}
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Si no hay acuerdo en el canje:</p>
                    <button
                      onClick={handleEnviarATercero}
                      disabled={guardando === 'enviar-tercero'}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg disabled:opacity-50"
                    >
                      {guardando === 'enviar-tercero' ? 'Enviando...' : <>Enviar a Tercero <HiArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 5: Tercero — solo si se envió (alternativa a Canje) */}
              {enviadoATercero && (
                <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4">
                  <p className="text-xs text-amber-700 mb-3">Enviado a laboratorio externo — resultado vinculante. Este valor reemplaza a Ley Canje para efectos de pago.</p>
                  <CampoLey
                    label="5. Ley Paquete Tercera"
                    value={form.ley_paquete_tercera}
                    onChange={(v) => setForm((p) => ({ ...p, ley_paquete_tercera: v }))}
                    onSave={() => guardarCampo('ley_paquete_tercera')}
                    saving={guardando === 'ley_paquete_tercera'}
                    fecha={lote.fecha_ley_paquete_tercera}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
