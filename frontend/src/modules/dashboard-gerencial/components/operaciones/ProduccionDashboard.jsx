import { useState, useEffect, useRef } from 'react';
import gerencialService from '../../services/gerencialService';
import { FAENA_COLORS, DEFAULT_FAENA_COLORS } from '../../../../contexts/faenaColor';
import SelectorFaenasGrid from '../../../../shared/components/molecules/SelectorFaenasGrid';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine, LabelList,
} from 'recharts';
import {
  FiTruck, FiBox, FiLayers, FiPackage, FiTrendingUp,
  FiBarChart2, FiAlertCircle, FiCheckCircle, FiClock, FiRefreshCw, FiZap
} from 'react-icons/fi';
import { FaIndustry, FaMountain } from 'react-icons/fa';
import ReconstruccionLote from './ReconstruccionLote';
import { CATEGORICAL, crearAsignadorDeFrentes } from '../../utils/chartColors';

// Un solo color por serie (magnitud) — la ley usa el siguiente slot de la
// paleta categórica cuando aparece junto al tonelaje en el mismo tablero.
const COLOR_TONELAJE = CATEGORICAL[0]; // azul
const COLOR_ACUMULADO = CATEGORICAL[1]; // naranjo

// Helpers de formato
const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};
const formatInteger = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-CL').format(num);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
};

// Hook para cargar datos de producción
const useProduccionData = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);
  const [faenasConDatos, setFaenasConDatos] = useState([]);
  const [selectedFaenas, setSelectedFaenas] = useState([]);
  const faenasInitialized = useRef(false);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);

  const cargarFaenas = async () => {
    try {
      const response = await gerencialService.getFaenas();
      if (response.success) {
        const ids = response.data || [];
        const faenas = ids
          .map((id) => FAENA_COLORS[id] ?? { ...DEFAULT_FAENA_COLORS, id })
          .filter((f) => f.id !== null);
        setFaenasConDatos(faenas);
      }
    } catch (err) {
      console.error('Error cargando faenas:', err);
    }
  };

  const cargarDatos = async (faenaId = null) => {
    try {
      setLoading(true);
      setError(null);
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };
      if (faenaId) params.id_faena = faenaId;
      const response = await gerencialService.getResumen(params);
      if (response.success) {
        setDatos(response.data);
      } else {
        setError(response.message || 'Error al cargar datos');
      }
    } catch (err) {
      console.error('Error cargando datos de producción:', err);
      setError('Error de conexión con el sistema. Verifique que el backend esté activo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFaenas();
    cargarDatos(null);
  }, []);

  // Inicializa selectedFaenas la primera vez que llegan las faenas (un solo render)
  useEffect(() => {
    if (faenasConDatos.length > 0 && !faenasInitialized.current) {
      faenasInitialized.current = true;
      setSelectedFaenas(faenasConDatos.map((f) => f.name));
    }
  }, [faenasConDatos]);

  const handleFaenaToggle = (name, isSelected) => {
    const next = isSelected
      ? [...selectedFaenas, name]
      : selectedFaenas.filter((n) => n !== name);
    setSelectedFaenas(next);
  };

  return {
    loading, error, datos,
    fechaInicio, setFechaInicio,
    fechaFin, setFechaFin,
    cargarDatos, selectedFaenas, handleFaenaToggle, faenasConDatos,
  };
};

// Preparar datos para gráficos
const usePreparedData = (datos) => {
  const topFrentes = (datos?.top_frentes || []).map((f) => ({
    ...f,
    tonelaje: Number(f.tonelaje) || 0,
    cantidad: Number(f.cantidad) || 0,
    ley_promedio: Number(f.ley_promedio) || 0,
    nombre: f.nombre?.length > 18 ? f.nombre.substring(0, 18) + '...' : f.nombre,
  }));

  // Pareto: % del total (no toneladas absolutas — un solo eje 0-100% junto al
  // % acumulado, en vez del gráfico de doble eje que había antes) + % acumulado.
  const totalTonFrentes = topFrentes.reduce((s, f) => s + f.tonelaje, 0);
  let acum = 0;
  const paretoFrentes = topFrentes.map((f) => {
    acum += f.tonelaje;
    return {
      ...f,
      pct_total: totalTonFrentes > 0 ? Math.round((f.tonelaje / totalTonFrentes) * 1000) / 10 : 0,
      pct_acumulado: totalTonFrentes > 0 ? Math.round((acum / totalTonFrentes) * 100) : 0,
    };
  });

  return { topFrentes, paretoFrentes };
};

// =============================================
// Componente: Filtros de Producción
// =============================================
const FiltrosProduccion = ({ fechaInicio, setFechaInicio, fechaFin, setFechaFin, loading }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        />
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 pb-2">
          <FiRefreshCw className="w-4 h-4 animate-spin" />
          Cargando…
        </div>
      )}
    </div>
  </div>
);

// =============================================
// Componente: Loading de Producción
// =============================================
const ProduccionLoading = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3"></div>
      <p className="text-gray-600 text-sm">Cargando datos de producción...</p>
    </div>
  </div>
);

// =============================================
// Componente: Error de Producción
// =============================================
const ProduccionError = ({ error }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
    <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-red-700 font-medium">Error</p>
      <p className="text-red-600 text-sm">{error}</p>
    </div>
  </div>
);

// =============================================
// COMPONENTE COMBINADO: Vista Operaciones
// =============================================
export const ProduccionCompleta = () => {
  const { loading, error, datos, fechaInicio, setFechaInicio, fechaFin, setFechaFin, cargarDatos, selectedFaenas, handleFaenaToggle, faenasConDatos } = useProduccionData();
  const { topFrentes, paretoFrentes } = usePreparedData(datos);
  const [reporte, setReporte]               = useState(null);
  const [reporteLoading, setReporteLoading] = useState(false);
  const [dumpDiarias, setDumpDiarias]       = useState([]);
  const [dumpLoading, setDumpLoading]       = useState(false);
  const [dumpMetrica, setDumpMetrica]       = useState('toneladas'); // 'toneladas' | 'cantidad'
  const [turnos, setTurnos]                 = useState([]);
  const [turnosLoading, setTurnosLoading]   = useState(false);
  const [turnosPeriodo, setTurnosPeriodo]   = useState(null);

  const [vista, setVista] = useState('resumen');

  // Un solo asignador de color por frente para todo el dashboard (persiste
  // mientras el componente esté montado): un frente conserva su color aunque
  // cambie el filtro de fecha/faena o quede afuera y vuelva a aparecer.
  const obtenerColorFrente = useRef(crearAsignadorDeFrentes()).current;

  // Cuando exactamente una faena está seleccionada → filtrar por ella
  const faenaIdActiva = selectedFaenas.length === 1
    ? (faenasConDatos.find((f) => f.name === selectedFaenas[0])?.id ?? null)
    : null;

  // Faenas cargadas pero ninguna seleccionada → no mostrar datos
  const ningunaSeleccionada = faenasConDatos.length > 0 && selectedFaenas.length === 0;

  const didMount = useRef(false);

  const cargarReporte = async (faenaId, fi, ff) => {
    setReporteLoading(true);
    try {
      const params = { fecha_inicio: fi, fecha_fin: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getReporteProduccion(params);
      if (res.success) setReporte(res.data);
    } catch (e) { console.error('Error reporte:', e); }
    finally { setReporteLoading(false); }
  };

  const cargarDumpDiarias = async (faenaId, fi, ff) => {
    setDumpLoading(true);
    try {
      const params = { fecha_desde: fi, fecha_hasta: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getDumpadasDiarias(params);
      if (res.success) setDumpDiarias(res.data ?? []);
    } catch (e) { console.error('Error dumpadas diarias:', e); }
    finally { setDumpLoading(false); }
  };

  // "Producción por Frente y Turno": el backend recorta solo a "ayer" como
  // máximo (nunca hoy) porque el turno más reciente puede seguir recibiendo
  // dumpadas — no se manda fecha_hasta acá, se deja que el backend decida.
  const cargarTurnos = async (faenaId, fi) => {
    setTurnosLoading(true);
    try {
      const params = { fecha_desde: fi };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getProduccionPorTurno(params);
      if (res.success) {
        setTurnos(res.data ?? []);
        setTurnosPeriodo(res.periodo ?? null);
      }
    } catch (e) { console.error('Error producción por turno:', e); }
    finally { setTurnosLoading(false); }
  };

  useEffect(() => {
    const fi = new Date(); fi.setDate(1);
    const fiStr = fi.toISOString().split('T')[0];
    const ffStr = new Date().toISOString().split('T')[0];
    cargarReporte(null, fiStr, ffStr);
    cargarDumpDiarias(null, fiStr, ffStr);
    cargarTurnos(null, fiStr);
  }, []);

  // Recarga automática cuando cambian fechas o selección de faenas
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (ningunaSeleccionada) return;
    cargarDatos(faenaIdActiva);
    cargarReporte(faenaIdActiva, fechaInicio, fechaFin);
    cargarDumpDiarias(faenaIdActiva, fechaInicio, fechaFin);
    cargarTurnos(faenaIdActiva, fechaInicio);
  }, [fechaInicio, fechaFin, faenaIdActiva, ningunaSeleccionada]);

  return (
    <div className="mt-6 space-y-6">
      {/* Sub-navegación */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[
          { id: 'resumen', label: 'Resumen de Producción' },
          { id: 'trazabilidad', label: 'Trazabilidad de Lote' },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              vista === v.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {vista === 'trazabilidad' && <ReconstruccionLote />}

      {vista === 'resumen' && (
        <>
          {faenasConDatos.length > 0 && (
            <SelectorFaenasGrid
              faenas={faenasConDatos}
              mode="multi"
              selectedFaenas={selectedFaenas}
              onToggle={handleFaenaToggle}
              loading={loading}
            />
          )}

          <FiltrosProduccion
            fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
            fechaFin={fechaFin} setFechaFin={setFechaFin}
            loading={loading}
          />

          {loading && <ProduccionLoading />}
          {error && <ProduccionError error={error} />}

          {!loading && ningunaSeleccionada && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <FaIndustry className="text-5xl opacity-30" />
              <p className="text-lg font-medium">Selecciona al menos una faena para ver datos</p>
            </div>
          )}

          {!loading && datos && !ningunaSeleccionada && (
            <>
              {/* 3 KPIs gerenciales grandes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <FiTruck className="w-5 h-5" />
                    <span className="text-sm font-medium">Tonelaje Despachado</span>
                  </div>
                  <p className="text-4xl font-bold mt-2">{formatNumber(datos.despachos?.tonelaje_despachado)}</p>
                  <p className="text-sm opacity-70 mt-1">toneladas en el período</p>
                  <p className="text-xs opacity-60 mt-2">{formatInteger(datos.despachos?.total)} camionadas</p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <FiTrendingUp className="w-5 h-5" />
                    <span className="text-sm font-medium">Ley Cu Ponderada</span>
                  </div>
                  <p className="text-4xl font-bold mt-2">
                    {reporte?.total_general?.ley_ponderada != null
                      ? `${formatNumber(reporte.total_general.ley_ponderada)}%`
                      : '—'}
                  </p>
                  <p className="text-sm opacity-70 mt-1">Cu en lotes despachados</p>
                  <p className="text-xs opacity-60 mt-2">{formatNumber(datos.dumpadas?.ley_promedio)}% en dumpadas</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <FiPackage className="w-5 h-5" />
                    <span className="text-sm font-medium">Lotes Cerrados</span>
                  </div>
                  <p className="text-4xl font-bold mt-2">{formatInteger(datos.lotes?.cerrados)}</p>
                  <p className="text-sm opacity-70 mt-1">de {formatInteger(datos.lotes?.total)} lotes en total</p>
                  <p className="text-xs opacity-60 mt-2">{formatInteger(datos.lotes?.abiertos)} aún abiertos</p>
                </div>
              </div>


              {/* Top frentes + Tabla empresa × planta */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {topFrentes.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="bg-blue-50 px-6 py-4 border-b">
                      <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                        <FaMountain className="text-blue-600" /> Top Frentes por Tonelaje y Ley
                      </h3>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={Math.max(240, topFrentes.length * 42)}>
                        <BarChart data={topFrentes} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const row = payload[0]?.payload;
                              return (
                                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                                  <p className="font-semibold text-gray-800 mb-1">{label}</p>
                                  <p style={{ color: COLOR_TONELAJE }}>Tonelaje: {formatNumber(row?.tonelaje)} t</p>
                                  {row?.ley_promedio != null && <p className="text-gray-600">Ley Cu: {formatNumber(row.ley_promedio)}%</p>}
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="tonelaje" name="Tonelaje (t)" fill={COLOR_TONELAJE} radius={[0, 4, 4, 0]}>
                            <LabelList
                              dataKey="ley_promedio"
                              position="right"
                              formatter={(v) => (v != null ? `${formatNumber(v)}%` : '')}
                              fontSize={11}
                              fill="#374151"
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-gray-400 mt-1 text-right">Etiqueta al final de cada barra = ley Cu promedio del frente</p>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="bg-amber-50 px-6 py-4 border-b flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <FaIndustry className="text-amber-600" /> Por Empresa y Planta
                    </h3>
                    <button
                      onClick={() => cargarReporte(faenaIdActiva, fechaInicio, fechaFin)}
                      disabled={reporteLoading}
                      className="text-xs text-gray-500 hover:text-amber-600 flex items-center gap-1 border border-gray-200 rounded px-2 py-1 hover:border-amber-300 transition-colors"
                    >
                      <FiRefreshCw className={`w-3 h-3 ${reporteLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </button>
                  </div>
                  {reporteLoading ? (
                    <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500 mx-auto" /></div>
                  ) : reporte ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wide">Empresa</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wide">Planta</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Viajes</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Tonelaje</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Ley %</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {reporte.filas.map((f, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-800">{f.empresa}</td>
                              <td className="px-4 py-2 text-gray-600">{f.planta}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{f.n_viajes}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{formatNumber(f.tonelaje)} t</td>
                              <td className="px-4 py-2 text-right text-gray-700">{f.ley_ponderada != null ? `${formatNumber(f.ley_ponderada)}%` : '—'}</td>
                            </tr>
                          ))}
                          {reporte.totales_por_planta.map((t, i) => (
                            <tr key={`sub-${i}`} className="bg-amber-50 border-t border-amber-200">
                              <td className="px-4 py-2 font-bold text-amber-800 uppercase" colSpan={2}>Total {t.planta}</td>
                              <td className="px-4 py-2 text-right font-bold text-amber-800">{t.n_viajes}</td>
                              <td className="px-4 py-2 text-right font-bold text-amber-800">{formatNumber(t.tonelaje)} t</td>
                              <td className="px-4 py-2 text-right font-bold text-amber-800">{t.ley_ponderada != null ? `${formatNumber(t.ley_ponderada)}%` : '—'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-800">
                            <td className="px-4 py-3 font-bold text-white" colSpan={2}>Total General</td>
                            <td className="px-4 py-3 text-right font-bold text-white">{reporte.total_general.n_viajes}</td>
                            <td className="px-4 py-3 text-right font-bold text-white">{formatNumber(reporte.total_general.tonelaje)} t</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-300">{reporte.total_general.ley_ponderada != null ? `${formatNumber(reporte.total_general.ley_ponderada)}%` : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">Sin datos disponibles.</div>
                  )}
                </div>
              </div>

              {/* ── ANÁLISIS ─────────────────────────────── */}

              {/* Pareto de frentes */}
              {paretoFrentes.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="px-6 py-4 border-b flex items-center gap-2">
                    <FiBarChart2 className="text-indigo-600 w-5 h-5" />
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">Pareto de Frentes</h3>
                      <p className="text-xs text-gray-400">% del tonelaje total por frente + % acumulado (significación) — la ley Cu de cada frente va sobre su barra</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={paretoFrentes} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="nombre" tick={{ fontSize: 10, angle: -35, textAnchor: 'end' }} interval={0} />
                        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                        <ReferenceLine y={80} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: '#6b7280' }} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const total = payload.find(p => p.dataKey === 'pct_total');
                            const acum = payload.find(p => p.dataKey === 'pct_acumulado');
                            const row = payload[0]?.payload;
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                <p className="font-semibold text-gray-800 mb-1">{label}</p>
                                {total && <p style={{ color: COLOR_TONELAJE }}>% del total: {total.value}% ({formatNumber(row?.tonelaje)} t)</p>}
                                {acum && <p style={{ color: COLOR_ACUMULADO }}>% Acumulado: {acum.value}%</p>}
                                {row?.ley_promedio != null && <p className="text-gray-600">Ley Cu: {formatNumber(row.ley_promedio)}%</p>}
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="pct_total" name="% del total" fill={COLOR_TONELAJE} radius={[3, 3, 0, 0]}>
                          <LabelList dataKey="ley_promedio" position="top" formatter={(v) => `${formatNumber(v)}%`} fontSize={10} fill="#374151" />
                        </Bar>
                        <Line dataKey="pct_acumulado" name="% Acumulado" type="monotone"
                          stroke={COLOR_ACUMULADO} strokeWidth={2.5} dot={{ r: 4, fill: COLOR_ACUMULADO, strokeWidth: 0 }}
                          activeDot={{ r: 6 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {paretoFrentes.length > 0 && (() => {
                      const idx80 = paretoFrentes.findIndex(f => f.pct_acumulado >= 80);
                      if (idx80 < 0) return null;
                      return (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          <span className="font-semibold" style={{ color: COLOR_ACUMULADO }}>{idx80 + 1} frente{idx80 > 0 ? 's' : ''}</span>
                          {' '}generan el 80% del tonelaje total
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Avance diario por frente */}
              {(dumpDiarias.length > 0 || dumpLoading) && (() => {
                // Pivotear: [{ fecha, frente, toneladas, cantidad, ley_promedio }] → [{ fecha, Frente1: val, ..., _detalle, _leyDia }]
                // _detalle guarda ton+cantidad+ley por frente para el tooltip (no depende del toggle);
                // _leyDia es la ley ponderada por tonelaje de TODOS los frentes ese día (para la etiqueta sobre la barra).
                const frentes = [...new Set(dumpDiarias.map(d => d.frente))].sort();
                const byFecha = {};
                dumpDiarias.forEach(d => {
                  if (!byFecha[d.fecha]) {
                    byFecha[d.fecha] = { fecha: d.fecha.slice(5), _detalle: {}, _tonTotal: 0, _tonLeyTotal: 0 };
                  }
                  const row = byFecha[d.fecha];
                  row[d.frente] = dumpMetrica === 'toneladas' ? d.toneladas : d.cantidad;
                  row._detalle[d.frente] = { toneladas: d.toneladas, cantidad: d.cantidad, ley_promedio: d.ley_promedio };
                  if (d.ley_promedio != null) {
                    row._tonTotal += d.toneladas;
                    row._tonLeyTotal += d.toneladas * d.ley_promedio;
                  }
                });
                const chartData = Object.values(byFecha)
                  .map((row) => ({ ...row, _leyDia: row._tonTotal > 0 ? row._tonLeyTotal / row._tonTotal : null }))
                  .sort((a, b) => a.fecha.localeCompare(b.fecha));

                return (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiBarChart2 className="text-emerald-600 w-5 h-5" />
                        <div>
                          <h3 className="text-base font-semibold text-gray-800">Avance Diario por Frente</h3>
                          <p className="text-xs text-gray-400">Tonelaje/cantidad por día y frente — la ley Cu de cada uno aparece en el detalle y la ley del día sobre la barra</p>
                        </div>
                      </div>
                      <div className="flex gap-1 text-xs">
                        <button onClick={() => setDumpMetrica('toneladas')}
                          className={`px-3 py-1 rounded-full font-semibold transition-colors ${dumpMetrica === 'toneladas' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          Toneladas
                        </button>
                        <button onClick={() => setDumpMetrica('cantidad')}
                          className={`px-3 py-1 rounded-full font-semibold transition-colors ${dumpMetrica === 'cantidad' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          Cantidad
                        </button>
                      </div>
                    </div>
                    {dumpLoading ? (
                      <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto" /></div>
                    ) : (
                      <div className="p-4">
                        <ResponsiveContainer width="100%" height={340}>
                          <BarChart data={chartData} margin={{ top: 24, right: 20, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="fecha" tick={{ fontSize: 10, angle: -35, textAnchor: 'end' }} interval={0} />
                            <YAxis tick={{ fontSize: 11 }}
                              label={{ value: dumpMetrica === 'toneladas' ? 'Toneladas' : 'Dumpadas', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const row = payload[0]?.payload;
                                const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
                                return (
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[220px]">
                                    <p className="font-semibold text-gray-700 mb-2">{label}</p>
                                    {payload.map((p) => {
                                      const det = row?._detalle?.[p.dataKey];
                                      return (
                                        <div key={p.dataKey} className="mb-1.5">
                                          <div className="flex justify-between gap-3">
                                            <span style={{ color: p.fill }} className="font-medium">{p.dataKey}</span>
                                            <span className="font-mono font-semibold">
                                              {formatNumber(det?.toneladas)} t · {det?.cantidad ?? '-'} dumpadas
                                            </span>
                                          </div>
                                          {det?.ley_promedio != null && (
                                            <div className="text-right text-gray-500">Ley Cu: {formatNumber(det.ley_promedio)}%</div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    <div className="border-t mt-1 pt-1 flex justify-between font-semibold text-gray-800">
                                      <span>Total</span>
                                      <span className="font-mono">
                                        {dumpMetrica === 'toneladas' ? `${formatNumber(total)} t` : `${total} dumpadas`}
                                        {row?._leyDia != null && ` · Ley ${formatNumber(row._leyDia)}%`}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            {frentes.map((f, i) => (
                              <Bar key={f} dataKey={f} stackId="a" fill={obtenerColorFrente(f)}
                                radius={i === frentes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
                                {i === frentes.length - 1 && (
                                  <LabelList
                                    dataKey="_leyDia"
                                    position="top"
                                    formatter={(v) => (v != null ? `Ley ${formatNumber(v)}%` : '')}
                                    fontSize={10}
                                    fill="#374151"
                                  />
                                )}
                              </Bar>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-3 mt-1">
                          {frentes.map((f) => (
                            <span key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: obtenerColorFrente(f) }} />
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Producción por Frente y Turno (antes "disparos" — ver nota abajo) */}
              {(turnos.length > 0 || turnosLoading) && (() => {
                const turnoLabel = (t) => `${t.fecha.slice(5)} ${t.jornada}`;
                const frentesTurno = [...new Set(turnos.map(t => t.frente))].sort();
                const byTurno = {};
                turnos.forEach(t => {
                  const key = `${t.fecha}_${t.jornada}`;
                  if (!byTurno[key]) byTurno[key] = { turno: turnoLabel(t), fecha: t.fecha };
                  byTurno[key][t.frente] = t.toneladas;
                });
                const chartDataTurno = Object.values(byTurno).sort((a, b) => a.fecha.localeCompare(b.fecha));
                const filasOrdenadas = [...turnos].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.frente.localeCompare(b.frente));

                return (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center gap-2">
                      <FiZap className="text-orange-600 w-5 h-5" />
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">Producción por Frente y Turno</h3>
                        <p className="text-xs text-gray-400">
                          Tonelaje y ley extraídos por turno (Madrugada/AM/PM) — no incluye el día de hoy, el turno más reciente puede seguir recibiendo dumpadas
                          {turnosPeriodo && ` · ventana ${turnosPeriodo.fecha_desde} a ${turnosPeriodo.fecha_hasta}`}
                        </p>
                      </div>
                    </div>
                    {turnosLoading ? (
                      <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto" /></div>
                    ) : (
                      <div className="p-4 space-y-4">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartDataTurno} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="turno" tick={{ fontSize: 10, angle: -35, textAnchor: 'end' }} interval={0} />
                            <YAxis tick={{ fontSize: 11 }}
                              label={{ value: 'Toneladas', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
                                return (
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
                                    <p className="font-semibold text-gray-700 mb-2">{label}</p>
                                    {payload.map(p => (
                                      <div key={p.dataKey} className="flex justify-between gap-3">
                                        <span style={{ color: p.fill }}>{p.dataKey}</span>
                                        <span className="font-mono font-semibold">{formatNumber(p.value)} t</span>
                                      </div>
                                    ))}
                                    <div className="border-t mt-1 pt-1 flex justify-between font-semibold text-gray-800">
                                      <span>Total</span>
                                      <span className="font-mono">{formatNumber(total)} t</span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            {frentesTurno.map((f, i) => (
                              <Bar key={f} dataKey={f} stackId="a" fill={obtenerColorFrente(f)}
                                radius={i === frentesTurno.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-3">
                          {frentesTurno.map((f) => (
                            <span key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: obtenerColorFrente(f) }} />
                              {f}
                            </span>
                          ))}
                        </div>

                        {/* Tabla-vista: mismo dato del gráfico, detalle exacto por fila */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Frente</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Turno</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Tonelaje</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Ley %</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">N° Dumpadas</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {filasOrdenadas.map((t, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 font-medium text-gray-800">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: obtenerColorFrente(t.frente) }} />
                                      {t.frente}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">{t.fecha}</td>
                                  <td className="px-4 py-2 text-gray-600">{t.jornada}</td>
                                  <td className="px-4 py-2 text-right text-gray-700">{formatNumber(t.toneladas)} t</td>
                                  <td className="px-4 py-2 text-right text-gray-700">{t.ley_promedio != null ? `${formatNumber(t.ley_promedio)}%` : '—'}</td>
                                  <td className="px-4 py-2 text-right text-gray-700">{t.n_dumpadas}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </>
          )}
        </>
      )}
    </div>
  );
};
