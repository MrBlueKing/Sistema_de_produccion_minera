import { useState, useEffect, useRef } from 'react';
import gerencialService from '../../services/gerencialService';
import { FAENA_COLORS, DEFAULT_FAENA_COLORS } from '../../../../contexts/faenaColor';
import SelectorFaenasGrid from '../../../../shared/components/molecules/SelectorFaenasGrid';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine, LabelList,
  ScatterChart, Scatter,
} from 'recharts';
import {
  FiTruck, FiBox, FiLayers, FiPackage, FiTrendingUp,
  FiBarChart2, FiAlertCircle, FiCheckCircle, FiClock, FiRefreshCw,
  FiDroplet, FiTarget,
} from 'react-icons/fi';
import { FaIndustry, FaMountain } from 'react-icons/fa';
import ReconstruccionLote from './ReconstruccionLote';
import { CATEGORICAL, crearAsignadorDeFrentes } from '../../utils/chartColors';
import useDebounce from '../../../../hooks/useDebounce';

// Un solo color por serie (magnitud) — la ley usa el siguiente slot de la
// paleta categórica cuando aparece junto al tonelaje en el mismo tablero.
const COLOR_TONELAJE = CATEGORICAL[0]; // azul
const COLOR_ACUMULADO = CATEGORICAL[1]; // naranjo
// Scatter de lotes: colores de estado, distintos de los índices 0/1 de arriba
// para que el color no cambie de significado entre gráficos del mismo dashboard.
const COLOR_LOTE_ABIERTO = CATEGORICAL[3]; // amarillo
const COLOR_LOTE_COMPLETADO = CATEGORICAL[5]; // verde

// Helpers de formato
const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};
const formatInteger = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-CL').format(num);
};

// Tendencia vs período anterior, en 2 piezas para poder ubicarlas por
// separado en el layout: el % al lado derecho del número grande, el valor
// anterior abajo chico. Para los 7 números que las usan acá (tonelaje, ley,
// lotes cerrados, 4 ratios de eficiencia) "más" siempre es mejor, así que
// sube=verde/baja=rojo es válido sin excepciones por KPI.
const TendenciaBadge = ({ actual, anterior }) => {
  if (actual == null || anterior == null || anterior === 0) return null;
  const delta = ((actual - anterior) / Math.abs(anterior)) * 100;
  const casiIgual = Math.abs(delta) < 0.5;
  const sube = delta > 0;
  return (
    <span className={`text-sm font-semibold whitespace-nowrap ${casiIgual ? 'text-gray-400' : sube ? 'text-emerald-600' : 'text-red-500'}`}>
      {casiIgual ? '≈ igual' : `${sube ? '▲' : '▼'} ${formatNumber(Math.abs(delta))}%`}
    </span>
  );
};

const TendenciaAnterior = ({ actual, anterior, unidad = '' }) => {
  if (actual == null || anterior == null) return null;
  return <p className="text-xs text-gray-400 mt-0.5">antes {formatNumber(anterior)}{unidad} (período anterior)</p>;
};

// Cuando el denominador del período anterior es 0 (ej. sin tiros confirmados
// ese mes), el ratio da null y TendenciaAnterior no muestra nada — esto explica
// por qué, en vez de dejar el espacio en blanco sin decir nada.
const TendenciaSinDato = ({ ratioAnterior, denominadorAnterior, etiqueta }) => {
  if (ratioAnterior != null) return null;
  if (denominadorAnterior == null || denominadorAnterior > 0) return null;
  return <p className="text-xs text-gray-400 mt-0.5">sin {etiqueta} en el período anterior — no se puede comparar</p>;
};

// Punto del scatter de lotes: r=5 (≥8px de diámetro) + anillo blanco de 2px para
// que se distingan al solaparse, en vez de un stroke de color que sumaría tinta.
const PuntoLote = (props) => {
  const { cx, cy, fill } = props;
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />;
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
        // Seleccionar todas las faenas en el MISMO batch que faenasConDatos —
        // si se hace en un efecto aparte (como antes), hay un render intermedio
        // real con "hay faenas pero ninguna seleccionada", que disparaba el
        // filtro por accidente y repetía las 6 cargas con los mismos datos.
        setFaenasConDatos(faenas);
        setSelectedFaenas(faenas.map((f) => f.name));
      }
    } catch (err) {
      console.error('Error cargando faenas:', err);
    }
  };

  // Generación de request: cada llamada a cargarDatos incrementa el contador y
  // se queda con "su" número. Si para cuando responde el backend ya arrancó
  // una llamada más nueva (ej. StrictMode disparando el mismo efecto dos veces
  // al montar, o el usuario cambiando el filtro rápido), esta respuesta vieja
  // se descarta en vez de pisar el estado — evita que Recharts re-anime los
  // gráficos con "datos nuevos" que en realidad son la misma respuesta de antes.
  const generacionDatosRef = useRef(0);
  const abortDatosRef = useRef(null);

  const cargarDatos = async (faenaId = null) => {
    abortDatosRef.current?.abort();
    const controller = new AbortController();
    abortDatosRef.current = controller;
    const miGeneracion = ++generacionDatosRef.current;
    try {
      setLoading(true);
      setError(null);
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };
      if (faenaId) params.id_faena = faenaId;
      const response = await gerencialService.getResumen(params, controller.signal);
      if (miGeneracion !== generacionDatosRef.current) return;
      if (response.success) {
        setDatos(response.data);
      } else {
        setError(response.message || 'Error al cargar datos');
      }
    } catch (err) {
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      if (miGeneracion !== generacionDatosRef.current) return;
      console.error('Error cargando datos de producción:', err);
      setError('Error de conexión con el sistema. Verifique que el backend esté activo.');
    } finally {
      if (miGeneracion === generacionDatosRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    cargarFaenas();
    cargarDatos(null);
  }, []);

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
const toISODate = (d) => d.toISOString().split('T')[0];

// Todas las fechas ISO entre desde/hasta (inclusive) — para que un día sin
// dumpadas aparezca en el eje X como barra vacía en vez de directamente
// desaparecer y hacer "saltar" las fechas visibles.
const generarRangoFechas = (desde, hasta) => {
  if (!desde || !hasta) return [];
  const dias = [];
  const cur = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (cur <= fin) {
    dias.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
};

// dd-mm (como se usa en Chile) para mostrar en ejes/etiquetas — la fecha completa
// (con año) ya se ve en el tooltip vía el filtro de fechas activo.
const formatFechaCorta = (fechaISO) => `${fechaISO.slice(8, 10)}-${fechaISO.slice(5, 7)}`;

// Accesos rápidos: cada uno calcula su propio [desde, hasta]. "activo" se
// resuelve comparando contra las fechas actuales, no se guarda como estado
// aparte — así un preset se ve marcado tanto si lo tocás vos como si llegás
// a ese rango escribiendo las fechas a mano.
const PRESETS_FECHA = [
  { id: 'hoy', label: 'Hoy', calcular: () => { const h = new Date(); return [toISODate(h), toISODate(h)]; } },
  {
    id: 'semana', label: 'Esta semana', calcular: () => {
      const hoy = new Date();
      const lunes = new Date(hoy);
      const diaSemana = (hoy.getDay() + 6) % 7; // lunes=0 ... domingo=6
      lunes.setDate(hoy.getDate() - diaSemana);
      return [toISODate(lunes), toISODate(hoy)];
    },
  },
  {
    id: 'mes', label: 'Este mes', calcular: () => {
      const hoy = new Date();
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return [toISODate(inicio), toISODate(hoy)];
    },
  },
  {
    id: 'mes-anterior', label: 'Mes anterior', calcular: () => {
      const hoy = new Date();
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return [toISODate(inicio), toISODate(fin)];
    },
  },
  {
    id: 'trimestre', label: 'Últimos 3 meses', calcular: () => {
      const hoy = new Date();
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());
      return [toISODate(inicio), toISODate(hoy)];
    },
  },
  {
    id: 'anio', label: 'Este año', calcular: () => {
      const hoy = new Date();
      const inicio = new Date(hoy.getFullYear(), 0, 1);
      return [toISODate(inicio), toISODate(hoy)];
    },
  },
];

const FiltrosProduccion = ({ fechaInicio, setFechaInicio, fechaFin, setFechaFin, loading }) => {
  const aplicarPreset = (preset) => {
    const [desde, hasta] = preset.calcular();
    setFechaInicio(desde);
    setFechaFin(hasta);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-3">
        <FiClock className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-gray-700">Período de análisis</h3>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 ml-1">
            <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
            Actualizando…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS_FECHA.map((preset) => {
          const [desde, hasta] = preset.calcular();
          const activo = desde === fechaInicio && hasta === fechaFin;
          return (
            <button
              key={preset.id}
              onClick={() => aplicarPreset(preset)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activo ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>
      </div>
    </div>
  );
};

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
  const [mostrarTendencia, setMostrarTendencia] = useState(false); // línea de promedio móvil en "Avance Diario"
  const [eficiencia, setEficiencia]         = useState(null);
  const [eficienciaLoading, setEficienciaLoading] = useState(false);
  const [lotesAnalisis, setLotesAnalisis]   = useState([]);
  const [lotesAnalisisLoading, setLotesAnalisisLoading] = useState(false);
  // Comparativa vs período anterior (mismo largo de días, inmediatamente antes
  // del rango elegido) — reutiliza los mismos 3 endpoints que ya se usan para
  // los KPIs actuales, solo con otro rango de fechas. Sin cambios de backend.
  const [comparativa, setComparativa]       = useState(null);

  const [vista, setVista] = useState('resumen');

  // Un solo asignador de color por frente para todo el dashboard (persiste
  // mientras el componente esté montado): un frente conserva su color aunque
  // cambie el filtro de fecha/faena o quede afuera y vuelva a aparecer.
  const obtenerColorFrente = useRef(crearAsignadorDeFrentes()).current;
  const obtenerColorEmpresa = useRef(crearAsignadorDeFrentes()).current; // asignador genérico, reutilizado por empresa
  const obtenerColorPlanta = useRef(crearAsignadorDeFrentes()).current; // idem, para el divisor de planta en "Por Empresa y Planta"

  // Debounce de las fechas: el input dispara onChange en cada click/tecleo del
  // date picker — sin esto, cada uno de esos cambios intermedios lanzaba las 5
  // llamadas al backend (resumen, reporte, avance diario, eficiencia, análisis
  // de lotes). Con debounce, solo se dispara una vez que el usuario deja de
  // tocar la fecha.
  //
  // Desde y Hasta se debouncean JUNTOS (un solo timer sobre los dos valores
  // combinados), no cada uno por separado — si tuvieran timers independientes,
  // cambiar "Desde" y después "Hasta" dispara la consulta con "Desde" ya nuevo
  // pero "Hasta" todavía viejo (el timer de Desde termina antes), trayendo un
  // rango mal armado por un instante antes de corregirse solo — eso se ve como
  // un salto de datos real, porque literalmente lo es.
  const debouncedFechas = useDebounce(`${fechaInicio}|${fechaFin}`, 500);
  const [debouncedFechaInicio, debouncedFechaFin] = debouncedFechas.split('|');

  // Loading coordinado, dedicado solo a la carga por filtro (fecha/faena):
  // el spinner de página completa espera a que las 6 secciones terminen
  // JUNTAS, no solo resumen() — si no, la página se "abre" apenas la primera
  // termina y las otras 5 van apareciendo de a una, corriendo el layout en
  // cada aparición (el "salto" al cambiar el filtro). Es un state aparte de
  // los loading individuales de cada sección para no afectar botones de
  // refresco manual (ej. "Actualizar" de la tabla Empresa/Planta), que deben
  // seguir mostrando solo su propio spinner in-place.
  const [cargandoFiltro, setCargandoFiltro] = useState(true);

  // Cuando exactamente una faena está seleccionada → filtrar por ella
  const faenaIdActiva = selectedFaenas.length === 1
    ? (faenasConDatos.find((f) => f.name === selectedFaenas[0])?.id ?? null)
    : null;

  // Faenas cargadas pero ninguna seleccionada → no mostrar datos
  const ningunaSeleccionada = faenasConDatos.length > 0 && selectedFaenas.length === 0;

  const didMount = useRef(false);

  // Mismo patrón de "generación" que cargarDatos: cada función tiene su propio
  // contador, así una respuesta que llega tarde (superada por una llamada más
  // nueva a la MISMA función) se descarta en vez de pisar el estado y hacer
  // que el gráfico correspondiente se re-anime con datos que ya estaban.
  const genReporteRef = useRef(0);
  const genDumpRef = useRef(0);
  const genEficienciaRef = useRef(0);
  const genLotesRef = useRef(0);

  // Un AbortController por sección: al arrancar una carga nueva, se cancela
  // la anterior en vez de dejarla terminar sola — así el servidor local (de
  // un solo hilo) no se queda procesando pedidos que ya sabemos que se van a
  // descartar cuando el usuario cambia el filtro varias veces seguidas.
  const abortReporteRef = useRef(null);
  const abortDumpRef = useRef(null);
  const abortEficienciaRef = useRef(null);
  const abortLotesRef = useRef(null);
  const genComparativaRef = useRef(0);
  const abortComparativaRef = useRef([]);
  const esCancelacion = (e) => e.code === 'ERR_CANCELED' || e.name === 'CanceledError';

  // Rango "período anterior": mismo largo de días que [fi, ff], terminando el
  // día justo antes de fi. Ej. si el rango elegido es 1-30 jun (30 días), el
  // anterior es 2-31 mayo (30 días también) — así el % de cambio compara
  // manzanas con manzanas sin importar si el usuario mira una semana o un año.
  const calcularPeriodoAnterior = (fi, ff) => {
    const inicio = new Date(`${fi}T00:00:00`);
    const fin = new Date(`${ff}T00:00:00`);
    const diasRango = Math.round((fin - inicio) / 86400000) + 1;
    const finAnterior = new Date(inicio);
    finAnterior.setDate(finAnterior.getDate() - 1);
    const inicioAnterior = new Date(finAnterior);
    inicioAnterior.setDate(inicioAnterior.getDate() - (diasRango - 1));
    return [toISODate(inicioAnterior), toISODate(finAnterior)];
  };

  const cargarReporte = async (faenaId, fi, ff) => {
    abortReporteRef.current?.abort();
    const controller = new AbortController();
    abortReporteRef.current = controller;
    const miGen = ++genReporteRef.current;
    setReporteLoading(true);
    try {
      const params = { fecha_inicio: fi, fecha_fin: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getReporteProduccion(params, controller.signal);
      if (miGen !== genReporteRef.current) return;
      if (res.success) setReporte(res.data);
    } catch (e) { if (!esCancelacion(e) && miGen === genReporteRef.current) console.error('Error reporte:', e); }
    finally {
      if (miGen === genReporteRef.current) setReporteLoading(false);
    }
  };

  const cargarDumpDiarias = async (faenaId, fi, ff) => {
    abortDumpRef.current?.abort();
    const controller = new AbortController();
    abortDumpRef.current = controller;
    const miGen = ++genDumpRef.current;
    setDumpLoading(true);
    try {
      const params = { fecha_desde: fi, fecha_hasta: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getDumpadasDiarias(params, controller.signal);
      if (miGen !== genDumpRef.current) return;
      if (res.success) setDumpDiarias(res.data ?? []);
    } catch (e) { if (!esCancelacion(e) && miGen === genDumpRef.current) console.error('Error dumpadas diarias:', e); }
    finally {
      if (miGen === genDumpRef.current) setDumpLoading(false);
    }
  };

  const cargarEficiencia = async (faenaId, fi, ff) => {
    abortEficienciaRef.current?.abort();
    const controller = new AbortController();
    abortEficienciaRef.current = controller;
    const miGen = ++genEficienciaRef.current;
    setEficienciaLoading(true);
    try {
      const params = { fecha_inicio: fi, fecha_fin: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getEficiencia(params, controller.signal);
      if (miGen !== genEficienciaRef.current) return;
      if (res.success) setEficiencia(res.data);
    } catch (e) { if (!esCancelacion(e) && miGen === genEficienciaRef.current) console.error('Error eficiencia:', e); }
    finally {
      if (miGen === genEficienciaRef.current) setEficienciaLoading(false);
    }
  };

  const cargarAnalisisLotes = async (faenaId, fi, ff) => {
    abortLotesRef.current?.abort();
    const controller = new AbortController();
    abortLotesRef.current = controller;
    const miGen = ++genLotesRef.current;
    setLotesAnalisisLoading(true);
    try {
      const params = { fecha_desde: fi, fecha_hasta: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getAnalisisLotes(params, controller.signal);
      if (miGen !== genLotesRef.current) return;
      if (res.success) setLotesAnalisis(res.data ?? []);
    } catch (e) { if (!esCancelacion(e) && miGen === genLotesRef.current) console.error('Error análisis de lotes:', e); }
    finally {
      if (miGen === genLotesRef.current) setLotesAnalisisLoading(false);
    }
  };

  const cargarComparativa = async (faenaId, fi, ff) => {
    abortComparativaRef.current.forEach((c) => c?.abort());
    const controllers = [new AbortController(), new AbortController(), new AbortController()];
    abortComparativaRef.current = controllers;
    const miGen = ++genComparativaRef.current;
    const [fiAnt, ffAnt] = calcularPeriodoAnterior(fi, ff);
    try {
      const params = { fecha_inicio: fiAnt, fecha_fin: ffAnt };
      if (faenaId) params.id_faena = faenaId;
      const [resResumen, resReporte, resEficiencia] = await Promise.all([
        gerencialService.getResumen(params, controllers[0].signal),
        gerencialService.getReporteProduccion(params, controllers[1].signal),
        gerencialService.getEficiencia(params, controllers[2].signal),
      ]);
      if (miGen !== genComparativaRef.current) return;
      setComparativa({
        tonelaje_recepcionado: resResumen?.success ? resResumen.data?.recepcion?.tonelaje_recepcionado : null,
        lotes_cerrados: resResumen?.success ? resResumen.data?.lotes?.cerrados : null,
        ley_ponderada: resReporte?.success ? resReporte.data?.total_general?.ley_ponderada : null,
        ratios: resEficiencia?.success ? resEficiencia.data?.ratios : null,
        // Valores crudos del período anterior — se necesitan aparte de "ratios"
        // porque cuando el denominador anterior es 0 (ej. sin tiros confirmados
        // ese mes) el ratio da null y no hay % que mostrar, pero igual hay que
        // poder explicar POR QUÉ no hay comparación en vez de dejar el espacio
        // vacío sin decir nada.
        tiros: resEficiencia?.success ? resEficiencia.data?.tiros : null,
        litros: resEficiencia?.success ? resEficiencia.data?.litros : null,
        periodo: { desde: fiAnt, hasta: ffAnt },
      });
    } catch (e) {
      if (!esCancelacion(e) && miGen === genComparativaRef.current) console.error('Error comparativa período anterior:', e);
    }
  };

  useEffect(() => {
    const fi = new Date(); fi.setDate(1);
    const fiStr = fi.toISOString().split('T')[0];
    const ffStr = new Date().toISOString().split('T')[0];
    setCargandoFiltro(true);
    Promise.all([
      cargarReporte(null, fiStr, ffStr),
      cargarDumpDiarias(null, fiStr, ffStr),
      cargarEficiencia(null, fiStr, ffStr),
      cargarAnalisisLotes(null, fiStr, ffStr),
      cargarComparativa(null, fiStr, ffStr),
    ]).finally(() => setCargandoFiltro(false));
  }, []);

  // Recarga automática cuando cambian fechas (ya con debounce) o selección de faenas.
  // Las 5 secciones se esperan juntas con Promise.all antes de bajar cargandoFiltro
  // (ver definición del state, arriba) para que la página se revele de una sola vez.
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (ningunaSeleccionada) return;
    cargarDatos(faenaIdActiva);
    setCargandoFiltro(true);
    Promise.all([
      cargarReporte(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarDumpDiarias(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarEficiencia(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarAnalisisLotes(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarComparativa(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
    ]).finally(() => setCargandoFiltro(false));
  }, [debouncedFechaInicio, debouncedFechaFin, faenaIdActiva, ningunaSeleccionada]);

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
            loading={loading || cargandoFiltro}
          />

          {(loading || cargandoFiltro) && <ProduccionLoading />}
          {error && <ProduccionError error={error} />}

          {!loading && !cargandoFiltro && ningunaSeleccionada && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <FaIndustry className="text-5xl opacity-30" />
              <p className="text-lg font-medium">Selecciona al menos una faena para ver datos</p>
            </div>
          )}

          {!loading && !cargandoFiltro && datos && !ningunaSeleccionada && (
            <>
              {/* 3 KPIs gerenciales grandes — fondo blanco + acento de color
                  (no gradiente sólido): más sobrio para lectura ejecutiva y
                  menos fatiga visual que 3 tarjetas de color pleno seguidas. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-emerald-500">
                  <div className="flex items-center gap-2 mb-1 text-emerald-600">
                    <FiTruck className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Tonelaje Recepcionado</span>
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <p className="text-4xl font-bold text-gray-800">{formatNumber(datos.recepcion?.tonelaje_recepcionado)} t</p>
                    <TendenciaBadge actual={datos.recepcion?.tonelaje_recepcionado} anterior={comparativa?.tonelaje_recepcionado} />
                  </div>
                  <TendenciaAnterior actual={datos.recepcion?.tonelaje_recepcionado} anterior={comparativa?.tonelaje_recepcionado} unidad=" t" />
                  <p className="text-sm text-gray-500 mt-1">peso real, confirmado al recepcionar en el período</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatNumber(datos.recepcion?.tonelaje_teorico)} t con las que salieron despachadas · {formatInteger(datos.recepcion?.total)} camionadas
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-1 text-blue-600">
                    <FiTrendingUp className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Ley Cu Ponderada</span>
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <p className="text-4xl font-bold text-gray-800">
                      {reporte?.total_general?.ley_ponderada != null
                        ? `${formatNumber(reporte.total_general.ley_ponderada)}%`
                        : '—'}
                    </p>
                    <TendenciaBadge actual={reporte?.total_general?.ley_ponderada} anterior={comparativa?.ley_ponderada} />
                  </div>
                  <TendenciaAnterior actual={reporte?.total_general?.ley_ponderada} anterior={comparativa?.ley_ponderada} unidad="%" />
                  <p className="text-sm text-gray-500 mt-1">Cu en lotes despachados</p>
                  <p className="text-xs text-gray-400 mt-2">{formatNumber(datos.dumpadas?.ley_promedio)}% en dumpadas</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-purple-500">
                  <div className="flex items-center gap-2 mb-1 text-purple-600">
                    <FiPackage className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Lotes Cerrados</span>
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <p className="text-4xl font-bold text-gray-800">{formatInteger(datos.lotes?.cerrados)}</p>
                    <TendenciaBadge actual={datos.lotes?.cerrados} anterior={comparativa?.lotes_cerrados} />
                  </div>
                  <TendenciaAnterior actual={datos.lotes?.cerrados} anterior={comparativa?.lotes_cerrados} unidad=" lotes" />
                  <p className="text-sm text-gray-500 mt-1">recepcionaron su última camionada en el período</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatInteger(datos.lotes?.total)} lotes creados en el período · {formatInteger(datos.lotes?.abiertos)} aún abiertos
                  </p>
                </div>
              </div>

              {comparativa?.periodo && (
                <p className="text-xs text-gray-400 -mt-2">
                  Comparando contra el período anterior: {comparativa.periodo.desde.split('-').reverse().join('-')} al {comparativa.periodo.hasta.split('-').reverse().join('-')}
                </p>
              )}

              {/* Eficiencia Operacional — nivel secundario a propósito: son tasas,
                  no totales, así que se les da menos peso visual que a las 3 KPI de
                  arriba para no mezclar unidades distintas en el mismo nivel. */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center gap-2">
                  <FiTarget className="text-cyan-600 w-5 h-5" />
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Eficiencia Operacional</h3>
                    <p className="text-xs text-gray-400">Tonelaje por tiro de tronadura y por litro de combustible — vendido (recepcionado, lote cerrado) vs. extraído (suma de dumpadas)</p>
                  </div>
                </div>
                {eficienciaLoading ? (
                  <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" /></div>
                ) : (
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Acento de color = Vendido (esmeralda, mismo tono que "Tonelaje
                        Despachado") vs Extraído (azul, mismo tono que "Ley Cu Ponderada")
                        — el ícono sigue marcando Tiro vs Litro, así la grilla se lee en
                        2 dimensiones sin inventar íconos nuevos sin sentido en minería. */}
                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-emerald-400 border-t border-r border-b border-gray-100">
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <FiTarget className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vendido / Tiro</span>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <p className="text-2xl font-bold text-gray-800">
                          {eficiencia?.ratios?.vendido_por_tiro != null ? `${formatNumber(eficiencia.ratios.vendido_por_tiro)} ton/tiro` : '—'}
                        </p>
                        <TendenciaBadge actual={eficiencia?.ratios?.vendido_por_tiro} anterior={comparativa?.ratios?.vendido_por_tiro} />
                      </div>
                      <TendenciaAnterior actual={eficiencia?.ratios?.vendido_por_tiro} anterior={comparativa?.ratios?.vendido_por_tiro} unidad=" ton/tiro" />
                      <TendenciaSinDato ratioAnterior={comparativa?.ratios?.vendido_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                      <p className="text-xs text-gray-400 mt-1">{formatNumber(eficiencia?.tonelaje_vendido)} t vendidas / {formatInteger(eficiencia?.tiros)} tiros</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-400 border-t border-r border-b border-gray-100">
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <FiTarget className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Extraído / Tiro</span>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <p className="text-2xl font-bold text-gray-800">
                          {eficiencia?.ratios?.extraido_por_tiro != null ? `${formatNumber(eficiencia.ratios.extraido_por_tiro)} ton/tiro` : '—'}
                        </p>
                        <TendenciaBadge actual={eficiencia?.ratios?.extraido_por_tiro} anterior={comparativa?.ratios?.extraido_por_tiro} />
                      </div>
                      <TendenciaAnterior actual={eficiencia?.ratios?.extraido_por_tiro} anterior={comparativa?.ratios?.extraido_por_tiro} unidad=" ton/tiro" />
                      <TendenciaSinDato ratioAnterior={comparativa?.ratios?.extraido_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                      <p className="text-xs text-gray-400 mt-1">{formatNumber(eficiencia?.tonelaje_extraido)} t extraídas / {formatInteger(eficiencia?.tiros)} tiros</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-emerald-400 border-t border-r border-b border-gray-100">
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <FiDroplet className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vendido / Litro</span>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <p className="text-2xl font-bold text-gray-800">
                          {eficiencia?.litros == null
                            ? '—'
                            : eficiencia.litros === 0
                            ? 'Sin consumo'
                            : eficiencia?.ratios?.vendido_por_litro != null
                            ? `${formatNumber(eficiencia.ratios.vendido_por_litro)} ton/L`
                            : '—'}
                        </p>
                        <TendenciaBadge actual={eficiencia?.ratios?.vendido_por_litro} anterior={comparativa?.ratios?.vendido_por_litro} />
                      </div>
                      <TendenciaAnterior actual={eficiencia?.ratios?.vendido_por_litro} anterior={comparativa?.ratios?.vendido_por_litro} unidad=" ton/L" />
                      <TendenciaSinDato ratioAnterior={comparativa?.ratios?.vendido_por_litro} denominadorAnterior={comparativa?.litros} etiqueta="consumo de combustible" />
                      <p className="text-xs text-gray-400 mt-1">
                        {eficiencia?.litros == null
                          ? 'Sin datos de combustible'
                          : `${formatNumber(eficiencia.tonelaje_vendido)} t vendidas / ${formatNumber(eficiencia.litros)} L`}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-400 border-t border-r border-b border-gray-100">
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <FiDroplet className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Extraído / Litro</span>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <p className="text-2xl font-bold text-gray-800">
                          {eficiencia?.litros == null
                            ? '—'
                            : eficiencia.litros === 0
                            ? 'Sin consumo'
                            : eficiencia?.ratios?.extraido_por_litro != null
                            ? `${formatNumber(eficiencia.ratios.extraido_por_litro)} ton/L`
                            : '—'}
                        </p>
                        <TendenciaBadge actual={eficiencia?.ratios?.extraido_por_litro} anterior={comparativa?.ratios?.extraido_por_litro} />
                      </div>
                      <TendenciaAnterior actual={eficiencia?.ratios?.extraido_por_litro} anterior={comparativa?.ratios?.extraido_por_litro} unidad=" ton/L" />
                      <TendenciaSinDato ratioAnterior={comparativa?.ratios?.extraido_por_litro} denominadorAnterior={comparativa?.litros} etiqueta="consumo de combustible" />
                      <p className="text-xs text-gray-400 mt-1">
                        {eficiencia?.litros == null
                          ? 'Sin datos de combustible'
                          : `${formatNumber(eficiencia.tonelaje_extraido)} t extraídas / ${formatNumber(eficiencia.litros)} L`}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-violet-400 border-t border-r border-b border-gray-100">
                      <div className="flex items-center gap-1.5 text-violet-600 mb-1">
                        <FiDroplet className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Litros / Tiro</span>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <p className="text-2xl font-bold text-gray-800">
                          {eficiencia?.litros == null
                            ? '—'
                            : eficiencia.litros === 0
                            ? 'Sin consumo'
                            : eficiencia?.ratios?.litros_por_tiro != null
                            ? `${formatNumber(eficiencia.ratios.litros_por_tiro)} L/tiro`
                            : '—'}
                        </p>
                        <TendenciaBadge actual={eficiencia?.ratios?.litros_por_tiro} anterior={comparativa?.ratios?.litros_por_tiro} />
                      </div>
                      <TendenciaAnterior actual={eficiencia?.ratios?.litros_por_tiro} anterior={comparativa?.ratios?.litros_por_tiro} unidad=" L/tiro" />
                      <TendenciaSinDato ratioAnterior={comparativa?.ratios?.litros_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                      <p className="text-xs text-gray-400 mt-1">
                        {eficiencia?.litros == null
                          ? 'Sin datos de combustible'
                          : `${formatNumber(eficiencia.litros)} L / ${formatInteger(eficiencia.tiros)} tiros`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Por Empresa y Planta */}
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
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Despachado</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Vendido</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Ley %</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Pendiente</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {reporte.filas.map((f, i) => {
                          // Divisor horizontal de color: se marca la primera fila de cada
                          // planta nueva (las filas ya vienen agrupadas por planta desde el
                          // backend) con un borde superior grueso del color asignado a esa
                          // planta, para separar visualmente los grupos sin duplicar la
                          // columna "Planta" en cada fila.
                          const esNuevaPlanta = i === 0 || reporte.filas[i - 1].planta !== f.planta;
                          const colorPlanta = obtenerColorPlanta(f.planta);
                          return (
                            <tr
                              key={i}
                              style={{
                                backgroundColor: `${colorPlanta}14`, // fondo tenue (~8% opacidad) para todo el grupo de esa planta
                                borderTop: esNuevaPlanta ? `3px solid ${colorPlanta}` : undefined,
                              }}
                            >
                              <td className="px-4 py-2 font-medium text-gray-800">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: obtenerColorEmpresa(f.empresa) }} />
                                  {f.empresa}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-600">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: colorPlanta }} />
                                  {f.planta}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-gray-700">{f.n_viajes}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{formatNumber(f.tonelaje)} t</td>
                              <td className="px-4 py-2 text-right text-gray-700">{formatNumber(f.tonelaje_vendido)} t</td>
                              <td className="px-4 py-2 text-right text-gray-700">{f.ley_ponderada != null ? `${formatNumber(f.ley_ponderada)}%` : '—'}</td>
                              <td className="px-4 py-2 text-right text-gray-700">
                                {f.tonelaje_pendiente > 0 ? `${formatNumber(f.tonelaje_pendiente)} t` : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {reporte.totales_por_planta.map((t, i) => (
                          <tr
                            key={`sub-${i}`}
                            className="bg-amber-50 border-t-2 border-b border-amber-200"
                            style={{ borderLeft: `4px solid ${obtenerColorPlanta(t.planta)}` }}
                          >
                            <td className="px-4 py-2 font-bold text-amber-800 uppercase" colSpan={2}>Total {t.planta}</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-800">{t.n_viajes}</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-800">{formatNumber(t.tonelaje)} t</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-800">{formatNumber(t.tonelaje_vendido)} t</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-800">{t.ley_ponderada != null ? `${formatNumber(t.ley_ponderada)}%` : '—'}</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-800">
                              {t.tonelaje_pendiente > 0 ? `${formatNumber(t.tonelaje_pendiente)} t` : <span className="text-gray-400 font-normal">—</span>}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-800">
                          <td className="px-4 py-3 font-bold text-white" colSpan={2}>Total General</td>
                          <td className="px-4 py-3 text-right font-bold text-white">{reporte.total_general.n_viajes}</td>
                          <td className="px-4 py-3 text-right font-bold text-white">{formatNumber(reporte.total_general.tonelaje)} t</td>
                          <td className="px-4 py-3 text-right font-bold text-white">{formatNumber(reporte.total_general.tonelaje_vendido)} t</td>
                          <td className="px-4 py-3 text-right font-bold text-white">{reporte.total_general.ley_ponderada != null ? `${formatNumber(reporte.total_general.ley_ponderada)}%` : '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-white">
                            {reporte.total_general.tonelaje_pendiente > 0 ? `${formatNumber(reporte.total_general.tonelaje_pendiente)} t` : <span className="text-gray-400 font-normal">—</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">Sin datos disponibles.</div>
                )}
              </div>

              {/* ── TENDENCIA ─────────────────────────────── */}

              {/* Avance diario por frente */}
              {(dumpDiarias.length > 0 || dumpLoading) && (() => {
                // Pivotear: [{ fecha, frente, grupo, toneladas, cantidad, ley_promedio }] → [{ fecha, Grupo1: val, ..., _detalle, _leyDia }]
                // Se apila/colorea por GRUPO (túnel/manto, calculado en el backend) y no por frente
                // individual: con más de 7 frentes distintos, todos los que exceden ese número caían
                // en el mismo gris "Otros" de la paleta y el gráfico quedaba ilegible. El detalle por
                // frente se conserva completo dentro de _detalle, para desglosarlo en el tooltip.
                // _leyDia es la ley ponderada por tonelaje de TODOS los frentes ese día (etiqueta sobre la barra).
                const grupos = [...new Set(dumpDiarias.map(d => d.grupo))].sort();

                // Se arranca con TODOS los días del rango elegido (aunque no tengan dumpadas), para que
                // un día sin producción se vea como barra vacía en vez de desaparecer del eje X.
                const byFecha = {};
                generarRangoFechas(debouncedFechaInicio, debouncedFechaFin).forEach((fechaISO) => {
                  byFecha[fechaISO] = { fechaISO, fecha: formatFechaCorta(fechaISO), _detalle: {}, _tonTotal: 0, _tonLeyTotal: 0, _total: 0 };
                });
                dumpDiarias.forEach(d => {
                  if (!byFecha[d.fecha]) {
                    byFecha[d.fecha] = { fechaISO: d.fecha, fecha: formatFechaCorta(d.fecha), _detalle: {}, _tonTotal: 0, _tonLeyTotal: 0, _total: 0 };
                  }
                  const row = byFecha[d.fecha];
                  const valor = dumpMetrica === 'toneladas' ? d.toneladas : d.cantidad;
                  row[d.grupo] = (row[d.grupo] ?? 0) + valor;
                  row._total += valor;
                  if (!row._detalle[d.grupo]) row._detalle[d.grupo] = [];
                  row._detalle[d.grupo].push({ frente: d.frente, toneladas: d.toneladas, cantidad: d.cantidad, ley_promedio: d.ley_promedio });
                  if (d.ley_promedio != null) {
                    row._tonTotal += d.toneladas;
                    row._tonLeyTotal += d.toneladas * d.ley_promedio;
                  }
                });
                const diasOrdenados = Object.values(byFecha)
                  .map((row) => ({ ...row, _leyDia: row._tonTotal > 0 ? row._tonLeyTotal / row._tonTotal : null }))
                  .sort((a, b) => a.fechaISO.localeCompare(b.fechaISO));

                // Promedio móvil de los últimos 3 días CON producción (los días en cero se
                // ignoran al calcular, para que un fin de semana sin dumpadas no arrastre la
                // línea para abajo) — suaviza el ruido diario para ver si el ritmo real de
                // trabajo viene subiendo o bajando, algo que las barras solas no muestran.
                // Los días sin producción quedan sin punto (_promedioMovil = null) y la línea
                // los salta conectando el día anterior con el siguiente (connectNulls).
                const VENTANA_PROMEDIO = 3;
                const diasConProduccion = diasOrdenados.filter((r) => r._total > 0);
                const promedioPorFecha = {};
                diasConProduccion.forEach((row, i) => {
                  const ventana = diasConProduccion.slice(Math.max(0, i - VENTANA_PROMEDIO + 1), i + 1);
                  promedioPorFecha[row.fechaISO] = ventana.reduce((s, r) => s + r._total, 0) / ventana.length;
                });
                const chartData = diasOrdenados.map((row) => ({
                  ...row,
                  _promedioMovil: promedioPorFecha[row.fechaISO] ?? null,
                }));

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
                        <button onClick={() => setMostrarTendencia((v) => !v)}
                          className={`px-3 py-1 rounded-full font-semibold transition-colors ${mostrarTendencia ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          Tendencia
                        </button>
                      </div>
                    </div>
                    {dumpLoading ? (
                      <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto" /></div>
                    ) : (
                      <div className="p-4">
                        <ResponsiveContainer width="100%" height={340}>
                          <ComposedChart data={chartData} margin={{ top: 24, right: 20, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="fecha" tick={{ fontSize: 10, angle: -35, textAnchor: 'end' }} interval={0} />
                            <YAxis tick={{ fontSize: 11 }}
                              label={{ value: dumpMetrica === 'toneladas' ? 'Toneladas' : 'Dumpadas', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const row = payload[0]?.payload;
                                const barras = payload.filter((p) => p.dataKey !== '_promedioMovil');
                                const total = barras.reduce((s, p) => s + (p.value ?? 0), 0);
                                return (
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[220px]">
                                    <p className="font-semibold text-gray-700 mb-2">{label}</p>
                                    {barras.map((p) => {
                                      const detalles = row?._detalle?.[p.dataKey] ?? [];
                                      return (
                                        <div key={p.dataKey} className="mb-1.5">
                                          <div className="flex justify-between gap-3">
                                            <span style={{ color: p.fill }} className="font-medium">{p.dataKey}</span>
                                            <span className="font-mono font-semibold">
                                              {formatNumber(p.value)} {dumpMetrica === 'toneladas' ? 't' : 'dumpadas'}
                                            </span>
                                          </div>
                                          {detalles.map((det) => (
                                            <div key={det.frente} className="flex justify-between gap-3 text-gray-500 pl-2">
                                              <span>{det.frente}</span>
                                              <span className="font-mono">
                                                {formatNumber(det.toneladas)} t{det.ley_promedio != null ? ` · ${formatNumber(det.ley_promedio)}%` : ''}
                                              </span>
                                            </div>
                                          ))}
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
                                    {mostrarTendencia && row?._promedioMovil != null && (
                                      <div className="flex justify-between text-gray-500 mt-0.5">
                                        <span>Promedio móvil (3d)</span>
                                        <span className="font-mono">
                                          {dumpMetrica === 'toneladas' ? `${formatNumber(row._promedioMovil)} t` : `${formatNumber(row._promedioMovil)} dumpadas`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            {/* La línea va ANTES que las barras a propósito: en SVG lo declarado
                                después se pinta encima, así que si la línea fuera después de las
                                barras, cruzaría por arriba de la etiqueta "Ley %" y la taparía.
                                Declarada acá, la barra (y su etiqueta) queda siempre por encima. */}
                            {mostrarTendencia && (
                              <Line
                                type="monotone"
                                dataKey="_promedioMovil"
                                name="Promedio móvil (3d)"
                                stroke="#1f2937"
                                strokeWidth={2}
                                dot={false}
                                legendType="none"
                                connectNulls
                              />
                            )}
                            {grupos.map((g, i) => (
                              <Bar key={g} dataKey={g} stackId="a" fill={obtenerColorFrente(g)}
                                radius={i === grupos.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
                                {i === grupos.length - 1 && (
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
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-3 mt-1">
                          {grupos.map((g) => (
                            <span key={g} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: obtenerColorFrente(g) }} />
                              {g}
                            </span>
                          ))}
                          {mostrarTendencia && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-3 h-0.5 rounded-sm inline-block" style={{ backgroundColor: '#1f2937' }} />
                              Promedio móvil (3 días)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── ANÁLISIS ─────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pareto de frentes */}
                {paretoFrentes.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center gap-2">
                      <FiBarChart2 className="text-indigo-600 w-5 h-5" />
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">Pareto de Frentes</h3>
                        <p className="text-xs text-gray-400">% del tonelaje total por frente + % acumulado — la ley Cu de cada frente va sobre su barra</p>
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

                {/* Scatter Ley vs Tonelaje por Lote */}
                {(() => {
                  const puntos = lotesAnalisis
                    .map(l => ({
                      ...l,
                      peso_total: Number(l.peso_total) || 0,
                      ley_ponderada: l.ley_ponderada != null ? Number(l.ley_ponderada) : null,
                    }))
                    .filter(l => l.ley_ponderada != null);
                  const abiertos = puntos.filter(l => l.estado === 'Abierto');
                  const completados = puntos.filter(l => l.estado !== 'Abierto');
                  const avgTon = puntos.length ? puntos.reduce((s, l) => s + l.peso_total, 0) / puntos.length : 0;
                  const avgLey = puntos.length ? puntos.reduce((s, l) => s + l.ley_ponderada, 0) / puntos.length : 0;

                  return (
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                      <div className="px-6 py-4 border-b flex items-center gap-2">
                        <FiTarget className="text-rose-600 w-5 h-5" />
                        <div>
                          <h3 className="text-base font-semibold text-gray-800">Ley vs Tonelaje por Lote</h3>
                          <p className="text-xs text-gray-400">Cada punto es un lote — las líneas marcan el promedio del período</p>
                        </div>
                      </div>
                      <div className="p-4">
                        {lotesAnalisisLoading ? (
                          <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-500 mx-auto" /></div>
                        ) : puntos.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm">Sin lotes con ley y tonelaje registrados en el período.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis type="number" dataKey="peso_total" name="Tonelaje" unit=" t" tick={{ fontSize: 11 }} />
                              <YAxis type="number" dataKey="ley_ponderada" name="Ley Cu" unit="%" tick={{ fontSize: 11 }} />
                              <ReferenceLine x={avgTon} stroke="#9ca3af" strokeDasharray="4 4" />
                              <ReferenceLine y={avgLey} stroke="#9ca3af" strokeDasharray="4 4" />
                              <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const l = payload[0]?.payload;
                                  return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                      <p className="font-semibold text-gray-800 mb-1">Lote {l.numero_lote}</p>
                                      <p className="text-gray-600">{l.empresa} · {l.planta}</p>
                                      <p style={{ color: l.estado === 'Abierto' ? COLOR_LOTE_ABIERTO : COLOR_LOTE_COMPLETADO }}>{l.estado}</p>
                                      <p className="text-gray-700 mt-1">Tonelaje: {formatNumber(l.peso_total)} t</p>
                                      <p className="text-gray-700">Ley Cu: {formatNumber(l.ley_ponderada)}%</p>
                                      <p className="text-gray-500">{l.n_camionadas} camionada{l.n_camionadas === 1 ? '' : 's'}</p>
                                    </div>
                                  );
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Scatter name="Abierto" data={abiertos} fill={COLOR_LOTE_ABIERTO} shape={PuntoLote} />
                              <Scatter name="Completado" data={completados} fill={COLOR_LOTE_COMPLETADO} shape={PuntoLote} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── DETALLE ─────────────────────────────── */}
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

            </>
          )}
        </>
      )}
    </div>
  );
};
