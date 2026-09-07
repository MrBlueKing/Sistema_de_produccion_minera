import { useState, useEffect, useRef, Fragment } from 'react';
import gerencialService from '../../services/gerencialService';
import { FAENA_COLORS, DEFAULT_FAENA_COLORS, getFaenaColorsById } from '../../../../contexts/faenaColor';
import SelectorFaenasGrid from '../../../../shared/components/molecules/SelectorFaenasGrid';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine, ReferenceDot, LabelList,
  ScatterChart, Scatter,
} from 'recharts';
import {
  FiTruck, FiBox, FiLayers, FiPackage, FiTrendingUp,
  FiBarChart2, FiAlertCircle, FiCheckCircle, FiClock, FiRefreshCw,
  FiDroplet, FiTarget, FiChevronRight, FiX, FiBriefcase,
} from 'react-icons/fi';
import { FaIndustry, FaMountain } from 'react-icons/fa';
import ReconstruccionLote from './ReconstruccionLote';
import InfoPopover from '../../../../shared/components/molecules/InfoPopover';
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

// Texto explicativo del cálculo de "ley promedio (lab)" en Resumen de Dumpadas
// — se muestra en el title/tooltip de la tarjeta para que quede claro que no es
// un promedio simple de porcentajes.
const LEY_PONDERADA_TOOLTIP = 'Promedio ponderado por tonelaje de Cu Insoluble (ley certificada por laboratorio): Σ(toneladas × ley) / Σ toneladas, solo dumpadas con resultado de laboratorio.';

// Mismo color por jornada en todo el dashboard (tooltips, badges de "Resumen
// de Dumpadas") — así una jornada se identifica por color sin tener que leer
// el texto cada vez.
const JORNADA_COLOR_TEXTO = {
  AM: 'text-amber-600',
  PM: 'text-sky-600',
  Noche: 'text-teal-600',
  Madrugada: 'text-rose-600',
};
// Orden cronológico del día (00:00 → 24:00), no alfabético, para que el
// detalle del tooltip se lea en la secuencia real de turnos.
const JORNADA_ORDEN = { Madrugada: 0, AM: 1, PM: 2, Noche: 3 };
// Mismos tonos que JORNADA_COLOR_TEXTO pero en hex, para usar como fill de
// barra en Recharts (no acepta clases de Tailwind).
const JORNADA_COLOR_HEX = { AM: '#fbbf24', PM: '#38bdf8', Noche: '#2dd4bf', Madrugada: '#fb7185' };

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
// anterior abajo chico. Para la mayoría de los números que las usan acá
// (tonelaje, ley, lotes cerrados, ton/tiro) "más" es mejor, pero para los
// 4 ratios de litros de combustible es al revés: "menos" es la mejora. El
// prop `invertido` marca esos casos para que la flecha y el color reflejen
// el sentido de negocio real, no solo si el número subió o bajó.
const TendenciaBadge = ({ actual, anterior, invertido = false }) => {
  if (actual == null || anterior == null || anterior === 0) return null;
  const delta = ((actual - anterior) / Math.abs(anterior)) * 100;
  const casiIgual = Math.abs(delta) < 0.5;
  const sube = delta > 0;
  const esMejora = invertido ? !sube : sube;
  return (
    <span className={`text-sm font-semibold whitespace-nowrap ${casiIgual ? 'text-gray-500' : esMejora ? 'text-emerald-600' : 'text-red-600'}`}>
      {casiIgual ? '– estable' : `${sube ? '▲' : '▼'} ${formatNumber(Math.abs(delta))}%`}
    </span>
  );
};

const TendenciaAnterior = ({ actual, anterior, unidad = '' }) => {
  if (actual == null || anterior == null) return null;
  return <p className="text-xs text-gray-500 mt-0.5">antes {formatNumber(anterior)}{unidad} (período anterior)</p>;
};

// Cuando el denominador del período anterior es 0 (ej. sin tiros confirmados
// ese mes), el ratio da null y TendenciaAnterior no muestra nada — esto explica
// por qué, en vez de dejar el espacio en blanco sin decir nada.
const TendenciaSinDato = ({ ratioAnterior, denominadorAnterior, etiqueta }) => {
  if (ratioAnterior != null) return null;
  if (denominadorAnterior == null || denominadorAnterior > 0) return null;
  return <p className="text-xs text-gray-500 mt-0.5">sin {etiqueta} en el período anterior — no se puede comparar</p>;
};

// Ícono ⓘ clickeable (InfoPopover) usado en las tarjetas de KPIs de este tab
// para explicar cómo se calcula cada número — mismo patrón que en "Resumen
// de Dumpadas": click para abrir en vez de solo hover, más descubrible.
const InfoTooltip = ({ texto }) => <InfoPopover text={texto} className="ml-auto flex-none" />;

// Punto del scatter de lotes: r=5 (≥8px de diámetro) + anillo blanco de 2px para
// que se distingan al solaparse, en vez de un stroke de color que sumaría tinta.
const PuntoLote = (props) => {
  const { cx, cy, fill } = props;
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />;
};

// Etiqueta única en el cruce de las 2 líneas de promedio (ReferenceDot en
// x=avgTon, y=avgLey) en vez de una etiqueta por línea — más fácil de leer
// de un vistazo, y con fondo oscuro para que no se pierda entre los puntos.
const EtiquetaCruceDePromedios = ({ viewBox, texto }) => {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const ancho = texto.length * 6 + 16;
  const alto = 20;
  const lx = x + 10;
  const ly = y - alto - 8;
  return (
    <g>
      <rect x={lx} y={ly} width={ancho} height={alto} rx={5} fill="#111827" />
      <text x={lx + ancho / 2} y={ly + alto / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
        {texto}
      </text>
    </g>
  );
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
  const [dumpJornada, setDumpJornada]       = useState('Todos'); // 'Todos' | 'AM' | 'PM' | 'Madrugada' | 'Noche' — filtro instantáneo, sin recargar
  const [dumpAgrupacion, setDumpAgrupacion] = useState('grupo'); // 'grupo' (túnel/manto) | 'jornada' | 'faena' — qué apila/colorea la barra
  // Detalle completo al hacer clic en un segmento de "Avance Diario por Frente"
  // (no en el tooltip de hover — con muchos frentes esa lista no entra ni se
  // puede scrollear sin que el mouse se salga y el tooltip desaparezca).
  const [detalleClicDump, setDetalleClicDump] = useState(null); // { fecha, dataKey, etiqueta, detalles, color } | null
  const [mostrarTendencia, setMostrarTendencia] = useState(false); // línea de promedio móvil en "Avance Diario"
  const [eficiencia, setEficiencia]         = useState(null);
  const [eficienciaLoading, setEficienciaLoading] = useState(false);
  const [resumenDumpadas, setResumenDumpadas] = useState([]);
  const [resumenDumpadasLoading, setResumenDumpadasLoading] = useState(false);
  // Detalle desplegable de "Por Empresa y Planta": qué filas (empresa|||planta)
  // están expandidas ahora mismo (pueden ser varias a la vez, cada una con su
  // propio fetch independiente) y los lotes que le corresponden a cada una
  // dentro del período/faenas filtrados. A propósito NO hay un botón "abrir
  // todas" — cada fetch es liviano (una sola empresa+planta+período) y clic a
  // clic no sobrecarga nada, pero disparar las 8-10 filas de un tirón sí
  // podría saturar el servidor de desarrollo de PHP (de un solo hilo, ver el
  // comentario de cargarResumenDumpadas más abajo).
  const [filasExpandidas, setFilasExpandidas] = useState(() => new Set());
  const [lotesPorFila, setLotesPorFila] = useState({});
  const [loadingPorFila, setLoadingPorFila] = useState({});
  const [lotesAnalisis, setLotesAnalisis]   = useState([]);
  const [lotesAnalisisLoading, setLotesAnalisisLoading] = useState(false);
  const [hoverCruceLotes, setHoverCruceLotes] = useState(false); // etiqueta del cruce de promedios solo al pasar el mouse
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

  // Cierra el panel de detalle por clic de "Avance Diario por Frente" si cambia
  // cualquier filtro que afecte al gráfico — evita dejarlo mostrando datos de
  // un modo/fecha que ya no corresponden a lo que se ve arriba.
  useEffect(() => {
    setDetalleClicDump(null);
  }, [dumpAgrupacion, dumpJornada, dumpMetrica, debouncedFechaInicio, debouncedFechaFin, faenaIdActiva]);

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
  const genResumenDumpadasRef = useRef(0);

  // Un AbortController por sección: al arrancar una carga nueva, se cancela
  // la anterior en vez de dejarla terminar sola — así el servidor local (de
  // un solo hilo) no se queda procesando pedidos que ya sabemos que se van a
  // descartar cuando el usuario cambia el filtro varias veces seguidas.
  const abortReporteRef = useRef(null);
  const abortDumpRef = useRef(null);
  const abortEficienciaRef = useRef(null);
  const abortLotesRef = useRef(null);
  const abortResumenDumpadasRef = useRef(null);
  // Un AbortController y un contador de generación por fila (Map keyed por
  // "empresa_id|||planta_id") — así varias filas pueden estar cargando/abiertas
  // a la vez sin cancelarse entre sí.
  const abortFilaExpandidaRefs = useRef(new Map());
  const genFilaExpandidaRefs = useRef(new Map());
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

  const cargarResumenDumpadas = async (faenaId, fi, ff) => {
    abortResumenDumpadasRef.current?.abort();
    const controller = new AbortController();
    abortResumenDumpadasRef.current = controller;
    const miGen = ++genResumenDumpadasRef.current;
    setResumenDumpadasLoading(true);
    try {
      const params = { fecha_desde: fi, fecha_hasta: ff };
      if (faenaId) params.id_faena = faenaId;
      const res = await gerencialService.getResumenDumpadas(params, controller.signal);
      if (miGen !== genResumenDumpadasRef.current) return;
      if (res.success) setResumenDumpadas(res.data ?? []);
    } catch (e) { if (!esCancelacion(e) && miGen === genResumenDumpadasRef.current) console.error('Error resumen de dumpadas:', e); }
    finally {
      if (miGen === genResumenDumpadasRef.current) setResumenDumpadasLoading(false);
    }
  };

  // Expandir/colapsar una fila de "Por Empresa y Planta": trae los lotes (abiertos
  // Y cerrados) de esa empresa+planta dentro del mismo período/faena filtrados,
  // con el mismo desglose Real/Teórico que usan las tarjetas de lote en Dispatch.
  // Varias filas pueden estar abiertas a la vez — cada una guarda su propio
  // AbortController/generación en los Map de abajo, así cerrar o volver a abrir
  // una fila nunca cancela el fetch de otra.
  const toggleFilaExpandida = async (fila) => {
    const key = `${fila.empresa_id}|||${fila.planta_id}`;
    if (filasExpandidas.has(key)) {
      setFilasExpandidas(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    setFilasExpandidas(prev => new Set(prev).add(key));

    // Si esta fila ya se cargó antes (con el fecha/faena actuales), no se vuelve a
    // pedir al servidor al reabrirla — cerrar y volver a abrir es instantáneo. El
    // caché completo se limpia en el efecto de abajo cuando cambian fecha o faena.
    if (lotesPorFila[key] !== undefined) return;

    setLotesPorFila(prev => ({ ...prev, [key]: [] }));

    abortFilaExpandidaRefs.current.get(key)?.abort();
    const controller = new AbortController();
    abortFilaExpandidaRefs.current.set(key, controller);
    const miGen = (genFilaExpandidaRefs.current.get(key) ?? 0) + 1;
    genFilaExpandidaRefs.current.set(key, miGen);

    setLoadingPorFila(prev => ({ ...prev, [key]: true }));
    try {
      const params = {
        con_detalle: 1,
        per_page: 100,
        fecha_desde: fechaInicio,
        fecha_hasta: fechaFin,
      };
      if (fila.empresa_id) params.empresa_id = fila.empresa_id;
      if (fila.planta_id) params.planta_id = fila.planta_id;
      if (faenaIdActiva) params.id_faena = faenaIdActiva;
      else if (selectedFaenas.length > 1) {
        params.id_faena = faenasConDatos.filter(f => selectedFaenas.includes(f.name)).map(f => f.id).join(',');
      }
      const res = await gerencialService.getLotes(params, controller.signal);
      if (miGen !== genFilaExpandidaRefs.current.get(key)) return;
      setLotesPorFila(prev => ({ ...prev, [key]: res?.data ?? [] }));
    } catch (e) {
      if (!esCancelacion(e) && miGen === genFilaExpandidaRefs.current.get(key)) console.error('Error al cargar lotes de la fila:', e);
    } finally {
      if (miGen === genFilaExpandidaRefs.current.get(key)) {
        setLoadingPorFila(prev => ({ ...prev, [key]: false }));
      }
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
        tonelaje_despachado: resReporte?.success ? resReporte.data?.total_general?.tonelaje : null,
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
        tonelaje_extraido: resEficiencia?.success ? resEficiencia.data?.tonelaje_extraido : null,
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
    // Cambió fecha o faena: el caché de lotes por fila de "Por Empresa y Planta"
    // (ver toggleFilaExpandida) quedaría con datos del período/faena anterior —
    // se limpia junto con las filas expandidas para que la próxima vez que se
    // abra una fila la traiga de nuevo con los filtros correctos.
    setLotesPorFila({});
    setFilasExpandidas(new Set());
    Promise.all([
      cargarReporte(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarDumpDiarias(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarEficiencia(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarAnalisisLotes(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
      cargarComparativa(faenaIdActiva, debouncedFechaInicio, debouncedFechaFin),
    ]).finally(() => setCargandoFiltro(false));
  }, [debouncedFechaInicio, debouncedFechaFin, faenaIdActiva, ningunaSeleccionada]);

  // "Resumen de Dumpadas" es una pestaña aparte que casi nunca se abre junto
  // con "Resumen de Producción" — se carga solo cuando el usuario la abre (o
  // cambia el filtro estando en ella), no en el Promise.all de arriba. El
  // servidor de desarrollo de PHP (artisan serve) es de un solo hilo: sumar
  // una 6ª petición concurrente ahí hacía que TODAS las peticiones de esa
  // tanda quedaran en cola y varias terminaran en timeout de 30s.
  useEffect(() => {
    if (vista !== 'dumpadas') return;
    if (ningunaSeleccionada) return;
    // Igual que cargarFilaExpandida: con una sola faena seleccionada se manda su id,
    // con varias se mandan todas separadas por coma (si no, al quedar sin id_faena
    // el backend devolvería TODAS las faenas existentes, no solo las tildadas).
    const idFaenaParam = faenaIdActiva
      || (selectedFaenas.length > 1
        ? faenasConDatos.filter(f => selectedFaenas.includes(f.name)).map(f => f.id).join(',')
        : null);
    cargarResumenDumpadas(idFaenaParam, debouncedFechaInicio, debouncedFechaFin);
  }, [vista, faenaIdActiva, selectedFaenas, faenasConDatos, debouncedFechaInicio, debouncedFechaFin, ningunaSeleccionada]);

  return (
    <div className="mt-6 space-y-6">
      {/* Sub-navegación */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[
          { id: 'resumen', label: 'Resumen de Producción' },
          { id: 'dumpadas', label: 'Resumen de Dumpadas' },
          { id: 'lotes', label: 'Resumen de Lotes' },
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

      {vista === 'dumpadas' && (
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

          {!ningunaSeleccionada && (() => {
            const totalDump = resumenDumpadas.reduce((s, f) => s + f.total_dumpadas, 0);
            const totalTon  = resumenDumpadas.reduce((s, f) => s + f.ton_total, 0);
            const todasJornadas = resumenDumpadas.flatMap(f => f.jornadas);
            // Ley promedio ponderada por tonelaje: se combina el ley_promedio de cada
            // frente (ya ponderado en el backend por Σ(ton×cu_insoluble)/Σton) usando
            // ton_con_ley como peso, en vez de promediar los porcentajes tal cual —
            // así una dumpada de 40 ton pesa más que una de 4 ton en el resultado final.
            const frentesConLey = resumenDumpadas.filter(f => f.ley_promedio !== null && f.ton_con_ley > 0);
            const tonConLeyTotal = frentesConLey.reduce((s, f) => s + f.ton_con_ley, 0);
            const leyProm = tonConLeyTotal > 0
              ? (frentesConLey.reduce((s, f) => s + f.ley_promedio * f.ton_con_ley, 0) / tonConLeyTotal).toFixed(2)
              : null;
            const tonPromedioDump = totalDump > 0 ? (totalTon / totalDump).toFixed(2) : null;
            const dumpersUnicos = [...new Set(todasJornadas.flatMap(j => j.maquinas))];
            const jornadaClasses = {
              AM:         { badge: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-400' },
              PM:         { badge: 'bg-sky-100 text-sky-700',        bar: 'bg-sky-400' },
              Noche:      { badge: 'bg-indigo-100 text-indigo-700',  bar: 'bg-indigo-400' },
              Madrugada:  { badge: 'bg-purple-100 text-purple-700',  bar: 'bg-purple-400' },
            };

            // Faenas presentes en los datos (puede haber menos que las tildadas si
            // alguna no tuvo dumpadas en el período) — solo si hay más de una se
            // muestra el desglose por faena y la etiqueta de faena en cada tarjeta.
            const faenaIdsPresentes = [...new Set(resumenDumpadas.map(f => f.id_faena).filter(id => id != null))];
            const multiFaena = faenaIdsPresentes.length > 1;
            const resumenPorFaena = multiFaena ? faenaIdsPresentes.map((id) => {
              const frentesFaena = resumenDumpadas.filter(f => f.id_faena === id);
              const dumpF = frentesFaena.reduce((s, f) => s + f.total_dumpadas, 0);
              const tonF  = frentesFaena.reduce((s, f) => s + f.ton_total, 0);
              // Mismo criterio ponderado por tonelaje que el resumen combinado, pero
              // solo con los frentes de esta faena.
              const frentesFaenaConLey = frentesFaena.filter(f => f.ley_promedio !== null && f.ton_con_ley > 0);
              const tonConLeyF = frentesFaenaConLey.reduce((s, f) => s + f.ton_con_ley, 0);
              const leyPromF = tonConLeyF > 0
                ? (frentesFaenaConLey.reduce((s, f) => s + f.ley_promedio * f.ton_con_ley, 0) / tonConLeyF).toFixed(2)
                : null;
              return { id, colores: getFaenaColorsById(id), dumpF, tonF, frentesCount: frentesFaena.length, leyPromF };
            }) : [];

            return (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <FiTruck className="text-orange-600 w-5 h-5" /> Resumen de Dumpadas
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Producción por frente y jornada en el período filtrado — misma información de "Producción Mina" del módulo Dispatch, solo lectura. La ley que se muestra es la de laboratorio (certificada), no la Ley Visual del ingreso.</p>
                </div>
                {resumenDumpadasLoading ? (
                  <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto" /></div>
                ) : resumenDumpadas.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">Sin dumpadas en el período seleccionado</div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Resumen combinado — todas las faenas seleccionadas juntas */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { value: totalDump, label: multiFaena ? 'total dumpadas (todas)' : 'total dumpadas', color: 'text-gray-900' },
                        { value: totalTon.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), label: 'toneladas', color: 'text-orange-500' },
                        { value: resumenDumpadas.length, label: 'frentes activos', color: 'text-blue-500' },
                        ...(leyProm !== null ? [{
                          value: `${leyProm}%`, label: 'ley promedio (lab)', color: 'text-purple-500',
                          tooltip: LEY_PONDERADA_TOOLTIP,
                        }] : []),
                        ...(tonPromedioDump !== null ? [{ value: `${tonPromedioDump} t`, label: 'ton / dumpada', color: 'text-teal-600' }] : []),
                        ...(dumpersUnicos.length > 0 ? [{ value: dumpersUnicos.length, label: 'dumpers utilizados', color: 'text-rose-500' }] : []),
                      ].map((tile, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl border border-orange-100 px-3 py-3 text-center">
                          <p className={`text-xl font-bold tabular-nums ${tile.color}`}>{tile.value}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5 flex items-center justify-center gap-1">
                            {tile.label}
                            {tile.tooltip && <InfoPopover text={tile.tooltip} />}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Resumen separado por faena — solo aparece si hay 2+ faenas con datos en el período */}
                    {multiFaena && (
                      <div className={`grid grid-cols-1 gap-3 ${resumenPorFaena.length >= 2 ? 'sm:grid-cols-2' : ''} ${resumenPorFaena.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
                        {resumenPorFaena.map((rf) => (
                          <div key={rf.id} className={`rounded-xl border ${rf.colores.borderFull} ${rf.colores.bg} p-4`}>
                            <div className="flex items-center gap-2 mb-3">
                              <p className={`font-bold text-sm ${rf.colores.text}`}>{rf.colores.name}</p>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="text-center">
                                <p className={`text-lg font-bold tabular-nums ${rf.colores.text}`}>{rf.dumpF}</p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">dumpadas</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-lg font-bold tabular-nums ${rf.colores.text}`}>{rf.tonF.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">toneladas</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-lg font-bold tabular-nums ${rf.colores.text}`}>{rf.frentesCount}</p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">frentes</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-lg font-bold tabular-nums ${rf.colores.text}`}>{rf.leyPromF !== null ? `${rf.leyPromF}%` : '—'}</p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5 flex items-center justify-center gap-1">
                                  ley (lab)
                                  <InfoPopover text={LEY_PONDERADA_TOOLTIP} />
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {resumenDumpadas.map((frente) => {
                        const coloresFrente = multiFaena ? getFaenaColorsById(frente.id_faena) : null;
                        return (
                        <div key={frente.id_frente_trabajo} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${coloresFrente ? coloresFrente.border : 'border-l-orange-400'} shadow-sm overflow-hidden`}>
                          <div className="px-4 pt-4 pb-3 bg-orange-50/50">
                            <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                                <p className="font-bold text-gray-800 text-sm truncate">{frente.frente}</p>
                              </div>
                              {coloresFrente && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${coloresFrente.badge}`}>
                                  {coloresFrente.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-5">
                              <div>
                                <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{frente.total_dumpadas}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">dumpadas</p>
                              </div>
                              <div className="w-px h-10 bg-orange-200" />
                              <div>
                                <p className="text-3xl font-bold text-orange-500 tabular-nums leading-none">{frente.ton_total.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">toneladas</p>
                              </div>
                            </div>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {frente.jornadas.map((j) => {
                              const pct = frente.total_dumpadas > 0 ? Math.round((j.total_dumpadas / frente.total_dumpadas) * 100) : 0;
                              const cls = jornadaClasses[j.jornada] || { badge: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400' };
                              return (
                                <div key={j.jornada} className="px-4 py-2.5">
                                  <div className="flex items-center gap-3 mb-1.5">
                                    <span className={`text-[10px] font-bold w-16 text-center py-0.5 rounded-full flex-shrink-0 ${cls.badge}`}>{j.jornada}</span>
                                    <div className="flex items-center gap-2 flex-1 text-xs">
                                      <span className="font-semibold text-gray-700">{j.total_dumpadas} dump</span>
                                      <span className="text-gray-300">·</span>
                                      <span className="font-semibold text-gray-600">{j.ton_total.toLocaleString('es-CL')} t</span>
                                      {j.ley_promedio !== null && (
                                        <span className="ml-auto font-bold text-orange-500">{j.ley_promedio}%</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {frente.jornadas.some(j => j.maquinas.length > 0) && (
                            <div className="px-4 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
                              <FiTruck className="w-3 h-3 text-gray-300 flex-shrink-0" />
                              <p className="text-[10px] text-gray-400 truncate">
                                {[...new Set(frente.jornadas.flatMap(j => j.maquinas))].join(' · ') || '—'}
                              </p>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {vista === 'lotes' && (
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

          {!ningunaSeleccionada && (
            reporteLoading ? (
              <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto" /></div>
            ) : !reporte?.filas?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <FiLayers className="text-5xl opacity-30" />
                <p className="text-lg font-medium">Sin lotes en el período seleccionado</p>
              </div>
            ) : (() => {
              // Total General + agrupado por Planta > Empresa, con Ley Mezcla, lotes/viajes
              // y el desglose Real+Teórico de Despachado — mismos datos ya agregados por el
              // backend que usa la tabla "Por Empresa y Planta" de Resumen de Producción
              // (reporte.filas / total_general), cuentan lotes Abiertos y Cerrados juntos.
              const porPlanta = {};
              reporte.filas.forEach((f) => {
                if (!porPlanta[f.planta]) porPlanta[f.planta] = [];
                porPlanta[f.planta].push(f);
              });
              const tg = reporte.total_general;
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-indigo-400 p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <FiLayers className="text-indigo-500" />
                    Resumen General
                  </h3>

                  <div className="bg-white border-2 border-indigo-200 rounded-lg px-4 py-3 mb-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">Total General</p>
                      {tg?.ley_ponderada != null && (
                        <span className="text-sm font-bold whitespace-nowrap text-orange-600">Ley Mezcla: {formatNumber(tg.ley_ponderada)}%</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {tg?.n_lotes} lote{tg?.n_lotes !== 1 ? 's' : ''} | {tg?.n_viajes} cam.
                    </p>
                    <div className="mt-2 pt-2 border-t border-indigo-100 overflow-x-auto">
                      <p className="text-base font-bold whitespace-nowrap text-gray-700">
                        Despachado{' '}
                        <span className="font-extrabold text-lg text-indigo-700 tabular-nums">{formatNumber(tg?.tonelaje)} t</span>
                        {' = '}
                        <span className="text-green-600 font-extrabold">{formatNumber(tg?.tonelaje_vendido)} t</span> real
                        {' + '}
                        <span className="text-amber-600 font-extrabold">{formatNumber(tg?.tonelaje_pendiente)} t</span> teórico
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(porPlanta).map(([planta, filas]) => (
                      <div key={planta}>
                        <p className="text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                          <FaIndustry className="text-amber-600 w-3 h-3" />
                          {planta}
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 ml-4">
                          {filas.map((f) => (
                            <div key={`${f.empresa_id}|||${f.planta_id}`} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1 truncate min-w-0">
                                  <FiBriefcase className="text-purple-500 w-3.5 h-3.5 shrink-0" />
                                  {f.empresa}
                                </p>
                                {f.ley_ponderada != null && (
                                  <span className="text-sm text-orange-600 font-bold shrink-0 whitespace-nowrap">Ley Mezcla: {formatNumber(f.ley_ponderada)}%</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {f.n_lotes} lote{f.n_lotes !== 1 ? 's' : ''} | {f.n_viajes} cam.
                              </p>
                              <div className="mt-2 pt-2 border-t border-gray-200 overflow-x-auto">
                                <p className="text-sm font-semibold whitespace-nowrap">
                                  <span className="text-gray-700">Despachado</span>{' '}
                                  <span className="text-indigo-700 font-extrabold text-base tabular-nums">{formatNumber(f.tonelaje)} t</span>
                                  <span className="text-gray-500"> = </span>
                                  <span className="text-green-600 font-bold">{formatNumber(f.tonelaje_vendido)} t</span> real
                                  {' + '}
                                  <span className="text-amber-600 font-bold">{formatNumber(f.tonelaje_pendiente)} t</span> teórico
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </>
      )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-indigo-500">
                  <div className="flex items-center gap-2 mb-1 text-indigo-600">
                    <FiTruck className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Tonelaje Despachado</span>
                    <InfoTooltip texto="Real + Teórico: por cada camionada usa el peso real si ya fue recepcionada en planta (con ticket), o el peso teórico declarado en el despacho si todavía no llega. El total se mantiene estable en el tiempo — cada camionada solo cambia de teórico a real al recepcionarse, no se suma ni se resta tonelaje. Cuando todas las camionadas del período ya fueron recepcionadas, este número coincide con Tonelaje Recepcionado." />
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <p className="text-4xl font-bold text-gray-800">{formatNumber(reporte?.total_general?.tonelaje)} t</p>
                    <TendenciaBadge actual={reporte?.total_general?.tonelaje} anterior={comparativa?.tonelaje_despachado} />
                  </div>
                  <TendenciaAnterior actual={reporte?.total_general?.tonelaje} anterior={comparativa?.tonelaje_despachado} unidad=" t" />
                  <p className="text-sm text-gray-500 mt-1">peso real + teórico declarado, de los lotes creados en el período</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatNumber(reporte?.total_general?.tonelaje_vendido)} t real + {formatNumber(reporte?.total_general?.tonelaje_pendiente)} t teórico
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-emerald-500">
                  <div className="flex items-center gap-2 mb-1 text-emerald-600">
                    <FiTruck className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Tonelaje Recepcionado</span>
                    <InfoTooltip texto="Suma del peso real (con ticket de planta) de las camionadas ya recepcionadas, de lotes creados en el período — sin importar si su lote sigue Abierto o ya se cerró. Es el subconjunto 'ya con ticket' de Tonelaje Despachado: parte más bajo y va subiendo a medida que llegan los tickets, hasta emparejarse con Despachado cuando ya no queda tonelaje teórico pendiente. Es lo mismo que 'Recepcionado' en la tabla Por Empresa y Planta." />
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <p className="text-4xl font-bold text-gray-800">{formatNumber(datos.recepcion?.tonelaje_recepcionado)} t</p>
                    <TendenciaBadge actual={datos.recepcion?.tonelaje_recepcionado} anterior={comparativa?.tonelaje_recepcionado} />
                  </div>
                  <TendenciaAnterior actual={datos.recepcion?.tonelaje_recepcionado} anterior={comparativa?.tonelaje_recepcionado} unidad=" t" />
                  <p className="text-sm text-gray-500 mt-1">peso real recepcionado, de los lotes creados en el período</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatInteger(datos.recepcion?.total)} camionadas recepcionadas
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-1 text-blue-600">
                    <FiTrendingUp className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Ley Cu Ponderada</span>
                    <InfoTooltip texto="Ley Mezcla de cada camionada, ponderada por su peso Real+Teórico (Despachado) — de todos los lotes creados en el período, cerrados o no. 'en dumpadas' abajo es un dato distinto: el Cu Insoluble de las dumpadas del mismo período, del lado de la mina." />
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
                  <p className="text-xs text-gray-400 mt-2">{formatNumber(datos.dumpadas?.ley_promedio)}% Cu Insoluble en dumpadas</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-purple-500">
                  <div className="flex items-center gap-2 mb-1 text-purple-600">
                    <FiPackage className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-500">Lotes Cerrados</span>
                    <InfoTooltip texto="Lotes que pasaron a estado Completado dentro del período (fecha de cierre, o fecha de la última camionada recepcionada para lotes cerrados antes de que existiera esa columna) — sin importar cuándo se crearon." />
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
                    <p className="text-xs text-gray-400">Tonelaje por tiro de tronadura y por litro de combustible — despachado (real+teórico), recepcionado (solo real, con ticket de planta) y extraído (suma de dumpadas)</p>
                  </div>
                </div>
                {eficienciaLoading ? (
                  <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" /></div>
                ) : (
                  <div className="p-4 space-y-6">
                    {/* Acento de color = Vendido (esmeralda, mismo tono que "Tonelaje
                        Despachado") vs Extraído (azul, mismo tono que "Ley Cu Ponderada")
                        vs equipos de combustible (ámbar, categoría propia — no es ni
                        vendido ni extraído) — 3 colores con significado en vez de uno
                        distinto por tarjeta. Las 2 filas separan "por tiro" de "por
                        litro" porque son mediciones distintas, no un solo grupo de 6. */}

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">Por Tiro de Tronadura</span>
                        <div className="h-px bg-gray-100 flex-1" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-indigo-400 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[220px] max-w-xs">
                          <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                            <FiTarget className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Despachado / Tiro</span>
                            <InfoTooltip texto="Despachado = Real + Teórico de toda camionada que salió en el período (por fecha de despacho, no de recepción). Dividido por tiros de Perforación y Tronadura confirmados o cerrados." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.ratios?.despachado_por_tiro != null ? `${formatNumber(eficiencia.ratios.despachado_por_tiro)} ton/tiro` : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.despachado_por_tiro} anterior={comparativa?.ratios?.despachado_por_tiro} />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.despachado_por_tiro} anterior={comparativa?.ratios?.despachado_por_tiro} unidad=" ton/tiro" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.despachado_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                          <p className="text-xs text-gray-500 mt-1">{formatNumber(eficiencia?.tonelaje_despachado)} t despachadas / {formatInteger(eficiencia?.tiros)} tiros</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-emerald-400 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[220px] max-w-xs">
                          <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                            <FiTarget className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recepcionado / Tiro</span>
                            <InfoTooltip texto="Recepcionado = peso real de camionadas ya recepcionadas (con ticket de planta) en el período, filtrado por fecha de recepción — sin importar si su lote ya se cerró o sigue Abierto. Dividido por tiros de Perforación y Tronadura confirmados o cerrados." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.ratios?.vendido_por_tiro != null ? `${formatNumber(eficiencia.ratios.vendido_por_tiro)} ton/tiro` : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.vendido_por_tiro} anterior={comparativa?.ratios?.vendido_por_tiro} />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.vendido_por_tiro} anterior={comparativa?.ratios?.vendido_por_tiro} unidad=" ton/tiro" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.vendido_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                          <p className="text-xs text-gray-500 mt-1">{formatNumber(eficiencia?.tonelaje_vendido)} t recepcionadas / {formatInteger(eficiencia?.tiros)} tiros</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-blue-400 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[220px] max-w-xs">
                          <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                            <FiTarget className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Extraído / Tiro</span>
                            <InfoTooltip texto="Extraído = suma de toneladas de dumpadas (mineral que salió de la mina) en el período, sin importar si ya se despachó o vendió. Dividido por tiros de Perforación y Tronadura confirmados o cerrados." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.ratios?.extraido_por_tiro != null ? `${formatNumber(eficiencia.ratios.extraido_por_tiro)} ton/tiro` : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.extraido_por_tiro} anterior={comparativa?.ratios?.extraido_por_tiro} />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.extraido_por_tiro} anterior={comparativa?.ratios?.extraido_por_tiro} unidad=" ton/tiro" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.extraido_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                          <p className="text-xs text-gray-500 mt-1">{formatNumber(eficiencia?.tonelaje_extraido)} t extraídas / {formatInteger(eficiencia?.tiros)} tiros</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">Por Litro de Combustible</span>
                        <div className="h-px bg-gray-100 flex-1" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-emerald-400 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[210px] max-w-[260px]">
                          <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                            <FiDroplet className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Litros / Ton Recepcionada</span>
                            <InfoTooltip texto="Consumo total de combustible de la faena, dividido por Recepcionado (peso real de camionadas con ticket de planta) en el período." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.litros == null
                                ? '—'
                                : eficiencia.litros === 0
                                ? 'Sin consumo'
                                : eficiencia?.ratios?.litros_por_ton_vendido != null
                                ? `${formatNumber(eficiencia.ratios.litros_por_ton_vendido)} L/ton`
                                : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.litros_por_ton_vendido} anterior={comparativa?.ratios?.litros_por_ton_vendido} invertido />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.litros_por_ton_vendido} anterior={comparativa?.ratios?.litros_por_ton_vendido} unidad=" L/ton" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.litros_por_ton_vendido} denominadorAnterior={comparativa?.litros} etiqueta="consumo de combustible" />
                          <p className="text-xs text-gray-500 mt-1">
                            {eficiencia?.litros == null
                              ? 'Sin datos de combustible'
                              : `${formatNumber(eficiencia.litros)} L / ${formatNumber(eficiencia.tonelaje_vendido)} t recepcionadas`}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-blue-400 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[210px] max-w-[260px]">
                          <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                            <FiDroplet className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Litros / Ton Extraída</span>
                            <InfoTooltip texto="Consumo total de combustible de la faena, dividido por Extraído (suma de toneladas de dumpadas) en el período." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.litros == null
                                ? '—'
                                : eficiencia.litros === 0
                                ? 'Sin consumo'
                                : eficiencia?.ratios?.litros_por_ton_extraido != null
                                ? `${formatNumber(eficiencia.ratios.litros_por_ton_extraido)} L/ton`
                                : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.litros_por_ton_extraido} anterior={comparativa?.ratios?.litros_por_ton_extraido} invertido />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.litros_por_ton_extraido} anterior={comparativa?.ratios?.litros_por_ton_extraido} unidad=" L/ton" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.litros_por_ton_extraido} denominadorAnterior={comparativa?.litros} etiqueta="consumo de combustible" />
                          <p className="text-xs text-gray-500 mt-1">
                            {eficiencia?.litros == null
                              ? 'Sin datos de combustible'
                              : `${formatNumber(eficiencia.litros)} L / ${formatNumber(eficiencia.tonelaje_extraido)} t extraídas`}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-amber-500 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[210px] max-w-[260px]">
                          <div className="flex items-center gap-1.5 text-amber-700 mb-1">
                            <FiDroplet className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Litros / Tiro</span>
                            <InfoTooltip texto="Litros de Compresor de Aire y Grupo Electrógeno (equipos de Perforación), divididos por tiros confirmados." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.litros_perforacion == null
                                ? '—'
                                : eficiencia.litros_perforacion === 0
                                ? 'Sin consumo'
                                : eficiencia?.ratios?.litros_por_tiro != null
                                ? `${formatNumber(eficiencia.ratios.litros_por_tiro)} L/tiro`
                                : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.litros_por_tiro} anterior={comparativa?.ratios?.litros_por_tiro} invertido />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.litros_por_tiro} anterior={comparativa?.ratios?.litros_por_tiro} unidad=" L/tiro" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.litros_por_tiro} denominadorAnterior={comparativa?.tiros} etiqueta="tiros confirmados" />
                          <p className="text-xs text-gray-500 mt-1">
                            {eficiencia?.litros_perforacion == null
                              ? 'Sin datos de combustible'
                              : `${formatNumber(eficiencia.litros_perforacion)} L / ${formatInteger(eficiencia.tiros)} tiros`}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-t border-r border-b border-l-amber-500 border-t-gray-100 border-r-gray-100 border-b-gray-100 flex-1 min-w-[210px] max-w-[260px]">
                          <div className="flex items-center gap-1.5 text-amber-700 mb-1">
                            <FiDroplet className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Litros / Ton Movida</span>
                            <InfoTooltip texto="Litros de Pala, Excavadora y Camiones (Tolva + Dumper), divididos por tonelaje extraído." />
                          </div>
                          <div className="flex items-end justify-between gap-1">
                            <p className="text-2xl font-bold text-gray-800">
                              {eficiencia?.litros_movida == null
                                ? '—'
                                : eficiencia.litros_movida === 0
                                ? 'Sin consumo'
                                : eficiencia?.ratios?.litros_por_ton_movida != null
                                ? `${formatNumber(eficiencia.ratios.litros_por_ton_movida)} L/ton`
                                : '—'}
                            </p>
                            <TendenciaBadge actual={eficiencia?.ratios?.litros_por_ton_movida} anterior={comparativa?.ratios?.litros_por_ton_movida} invertido />
                          </div>
                          <TendenciaAnterior actual={eficiencia?.ratios?.litros_por_ton_movida} anterior={comparativa?.ratios?.litros_por_ton_movida} unidad=" L/ton" />
                          <TendenciaSinDato ratioAnterior={comparativa?.ratios?.litros_por_ton_movida} denominadorAnterior={comparativa?.tonelaje_extraido} etiqueta="tonelaje extraído" />
                          <p className="text-xs text-gray-500 mt-1">
                            {eficiencia?.litros_movida == null
                              ? 'Sin datos de combustible'
                              : `${formatNumber(eficiencia.litros_movida)} L / ${formatNumber(eficiencia.tonelaje_extraido)} t movidas`}
                          </p>
                        </div>
                      </div>
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
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wide">Recepcionado</th>
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
                          const key = `${f.empresa_id}|||${f.planta_id}`;
                          const expandida = filasExpandidas.has(key);
                          return (
                            <Fragment key={i}>
                            <tr
                              onClick={() => toggleFilaExpandida(f)}
                              className="cursor-pointer hover:brightness-95 transition-[filter]"
                              title="Ver lotes de esta empresa y planta en el período"
                              style={{
                                backgroundColor: expandida ? `${colorPlanta}28` : `${colorPlanta}14`, // fondo tenue (~8% opacidad) para todo el grupo de esa planta
                                borderTop: esNuevaPlanta ? `3px solid ${colorPlanta}` : undefined,
                              }}
                            >
                              <td className="px-4 py-2 font-medium text-gray-800">
                                <span className="inline-flex items-center gap-1.5">
                                  <FiChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${expandida ? 'rotate-90' : ''}`} />
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
                            {expandida && (
                              <tr>
                                <td colSpan={7} className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                  {loadingPorFila[key] ? (
                                    <div className="py-4 text-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500 mx-auto" /></div>
                                  ) : (lotesPorFila[key] ?? []).length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-2">Sin lotes de {f.empresa} / {f.planta} en este período</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {(lotesPorFila[key] ?? []).map((lote) => {
                                        const real = parseFloat(lote.peso_recibido || 0);
                                        const teorico = parseFloat(lote.peso_teorico_pendiente || 0);
                                        // Mismo formato compacto que las cajas de "Resumen General" de
                                        // arriba (nombre / Ley Mezcla / lote+cam. / Despachado) — no la
                                        // tarjeta completa de Dispatch con badges y barra de progreso.
                                        return (
                                          <div key={lote.id} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                              <p className="font-semibold text-gray-800 truncate min-w-0">{lote.numero_lote || `Lote #${lote.id}`}</p>
                                              {lote.ley_lote_promedio != null && (
                                                <span className="text-orange-600 font-bold shrink-0 whitespace-nowrap">Ley Mezcla: {parseFloat(lote.ley_lote_promedio).toFixed(2)}%</span>
                                              )}
                                            </div>
                                            <p className="text-gray-500 mt-0.5">1 lote | {lote.numero_camionadas || 0} cam.</p>
                                            <div className="mt-2 pt-2 border-t border-gray-200 overflow-x-auto">
                                              <p className="font-semibold whitespace-nowrap">
                                                <span className="text-gray-700">Despachado</span>{' '}
                                                <span className="text-indigo-700 font-extrabold">{(real + teorico).toFixed(2)} t</span>
                                                <span className="text-gray-500"> = </span>
                                                <span className="text-green-600">{real.toFixed(2)} t</span> real +{' '}
                                                <span className="text-amber-600">{teorico.toFixed(2)} t</span> teórico
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                            </Fragment>
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
                // Jornadas presentes en el período (para no mostrar botones de jornadas sin datos)
                const jornadasDisponibles = [...new Set(dumpDiarias.map(d => d.jornada))].sort();
                // Faenas presentes en los datos (para saber si tiene sentido ofrecer "Por Faena")
                const faenaIdsPresentes = [...new Set(dumpDiarias.map(d => d.id_faena).filter(id => id != null))];
                const nombrePorFaena = {};
                faenaIdsPresentes.forEach(id => {
                  nombrePorFaena[id] = faenasConDatos.find(f => f.id === id)?.name ?? `Faena ${id}`;
                });

                // Apilando por jornada, el filtro Todos/AM/PM/... deja de tener sentido (el
                // gráfico ya muestra las 4 jornadas como segmentos separados) — se ignora.
                const dumpDiariasFiltradas = (dumpAgrupacion === 'jornada' || dumpJornada === 'Todos')
                  ? dumpDiarias
                  : dumpDiarias.filter(d => d.jornada === dumpJornada);

                // Clave por la que se apila/colorea cada barra: túnel/manto (por defecto),
                // jornada — "jornada" arma una clave compuesta "Faena__Jornada" para que
                // CADA faena sea su propio grupo de columnas (vía stackId distinto),
                // coloreado por jornada adentro de cada una. Con una sola faena en los
                // datos, esto se ve igual que un "por jornada" simple (un solo grupo) —
                // por eso NO hay un tercer modo aparte: sería redundante con este.
                const obtenerClave = dumpAgrupacion === 'jornada'
                  ? (d) => `${nombrePorFaena[d.id_faena]}__${d.jornada}`
                  : (d) => d.grupo;
                // Solo se listan las combinaciones faena+jornada que realmente existen en
                // los datos — ordenadas por faena (id) y, adentro de cada una,
                // cronológicamente (Madrugada→AM→PM→Noche).
                const combosFaenaJornada = dumpAgrupacion === 'jornada'
                  ? faenaIdsPresentes.flatMap((id) => {
                      const nombre = nombrePorFaena[id];
                      return jornadasDisponibles
                        .filter((j) => dumpDiariasFiltradas.some((d) => d.id_faena === id && d.jornada === j))
                        .sort((a, b) => (JORNADA_ORDEN[a] ?? 99) - (JORNADA_ORDEN[b] ?? 99))
                        .map((j) => `${nombre}__${j}`);
                    })
                  : null;
                const grupos = dumpAgrupacion === 'jornada'
                  ? combosFaenaJornada
                  : [...new Set(dumpDiariasFiltradas.map(obtenerClave))].sort();
                const obtenerColorSerie = dumpAgrupacion === 'jornada'
                  ? (g) => JORNADA_COLOR_HEX[g.split('__')[1]] ?? '#9ca3af'
                  : obtenerColorFrente;
                // stackId por barra: en modo jornada, cada faena tiene su propio stackId
                // (sus jornadas se apilan JUNTAS pero quedan como grupo separado de otra
                // faena); en "por frente" todo comparte un único stack.
                const obtenerStackId = (g) => dumpAgrupacion === 'jornada' ? g.split('__')[0] : 'a';
                const ultimoIndicePorStack = {};
                grupos.forEach((g, i) => { ultimoIndicePorStack[obtenerStackId(g)] = i; });

                // Se arranca con TODOS los días del rango elegido (aunque no tengan dumpadas), para que
                // un día sin producción se vea como barra vacía en vez de desaparecer del eje X.
                const byFecha = {};
                generarRangoFechas(debouncedFechaInicio, debouncedFechaFin).forEach((fechaISO) => {
                  byFecha[fechaISO] = { fechaISO, fecha: formatFechaCorta(fechaISO), _detalle: {}, _tonTotal: 0, _tonLeyTotal: 0, _total: 0, _ton: {}, _tonLey: {} };
                });
                dumpDiariasFiltradas.forEach(d => {
                  if (!byFecha[d.fecha]) {
                    byFecha[d.fecha] = { fechaISO: d.fecha, fecha: formatFechaCorta(d.fecha), _detalle: {}, _tonTotal: 0, _tonLeyTotal: 0, _total: 0, _ton: {}, _tonLey: {} };
                  }
                  const row = byFecha[d.fecha];
                  const valor = dumpMetrica === 'toneladas' ? d.toneladas : d.cantidad;
                  const clave = obtenerClave(d);
                  row[clave] = (row[clave] ?? 0) + valor;
                  row._total += valor;
                  if (!row._detalle[clave]) row._detalle[clave] = [];
                  row._detalle[clave].push({ frente: d.frente, grupo: d.grupo, jornada: d.jornada, toneladas: d.toneladas, cantidad: d.cantidad, ley_promedio: d.ley_promedio });
                  if (d.ley_promedio != null) {
                    row._tonTotal += d.toneladas;
                    row._tonLeyTotal += d.toneladas * d.ley_promedio;
                    row._ton[clave] = (row._ton[clave] ?? 0) + d.toneladas;
                    row._tonLey[clave] = (row._tonLey[clave] ?? 0) + d.toneladas * d.ley_promedio;
                    // En modo faena, acumula TAMBIÉN bajo el nombre de faena solo (sin
                    // jornada) — es la ley que va arriba de todo el grupo de columnas.
                    if (dumpAgrupacion === 'jornada') {
                      const nombreFaena = obtenerStackId(clave);
                      row._ton[nombreFaena] = (row._ton[nombreFaena] ?? 0) + d.toneladas;
                      row._tonLey[nombreFaena] = (row._tonLey[nombreFaena] ?? 0) + d.toneladas * d.ley_promedio;
                    }
                  }
                });
                // Claves a las que calcularles ley ponderada: los grupos/combos que se
                // dibujan, más (en modo faena) el nombre de cada faena sola, para la
                // etiqueta que va arriba de todo su grupo de columnas.
                const clavesParaLey = dumpAgrupacion === 'jornada'
                  ? [...grupos, ...faenaIdsPresentes.map(id => nombrePorFaena[id])]
                  : grupos;
                const diasOrdenados = Object.values(byFecha)
                  .map((row) => {
                    const leyesPorSerie = {};
                    clavesParaLey.forEach((g) => {
                      const ton = row._ton[g] ?? 0;
                      leyesPorSerie[`_ley_${g}`] = ton > 0 ? row._tonLey[g] / ton : null;
                    });
                    return { ...row, ...leyesPorSerie, _leyDia: row._tonTotal > 0 ? row._tonLeyTotal / row._tonTotal : null };
                  })
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

                // El filtro de jornada individual no tiene efecto apilando por jornada (ahí
                // ya se ven las 4 separadas) — se deshabilita en vez de desaparecer, para que
                // el layout de controles no salte al cambiar de modo.
                const filtroJornadaDeshabilitado = dumpAgrupacion === 'jornada';
                const claseBoton = (activo, deshabilitado) => `px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  deshabilitado
                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    : activo
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`;

                return (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <FiBarChart2 className="text-emerald-600 w-5 h-5" />
                        <div>
                          <h3 className="text-base font-semibold text-gray-800">Avance Diario por Frente</h3>
                          <p className="text-xs text-gray-400">Tonelaje/cantidad por día y frente — la ley Cu de cada uno aparece en el detalle y la ley del día sobre la barra. Es el Cu Insoluble de cada dumpada, ponderado por tonelaje — no Cu Total ni la Ley Visual del ingreso.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mr-0.5">Métrica</span>
                          <button onClick={() => setDumpMetrica('toneladas')} className={claseBoton(dumpMetrica === 'toneladas', false)}>Toneladas</button>
                          <button onClick={() => setDumpMetrica('cantidad')} className={claseBoton(dumpMetrica === 'cantidad', false)}>Cantidad</button>
                        </div>

                        <button onClick={() => setMostrarTendencia((v) => !v)}
                          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${mostrarTendencia ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          Tendencia
                        </button>

                        {/* "Jornada" ya incluye la separación por faena cuando hay más de una
                            (ver comentario junto a obtenerClave) — no hace falta un tercer
                            botón aparte para eso, sería mostrar lo mismo dos veces. */}
                        {jornadasDisponibles.length > 1 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mr-0.5">Agrupar</span>
                            <button onClick={() => setDumpAgrupacion('grupo')} className={claseBoton(dumpAgrupacion === 'grupo', false)}>Frente</button>
                            <button onClick={() => setDumpAgrupacion('jornada')} className={claseBoton(dumpAgrupacion === 'jornada', false)}>Jornada</button>
                          </div>
                        )}

                        {jornadasDisponibles.length > 1 && (
                          <div className="flex items-center gap-1" title={filtroJornadaDeshabilitado ? 'No aplica agrupando por jornada — ya se ven las 4 por separado' : undefined}>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mr-0.5">Jornada</span>
                            <button disabled={filtroJornadaDeshabilitado} onClick={() => setDumpJornada('Todos')} className={claseBoton(dumpJornada === 'Todos', filtroJornadaDeshabilitado)}>
                              Todas
                            </button>
                            {jornadasDisponibles.map((j) => (
                              <button key={j} disabled={filtroJornadaDeshabilitado} onClick={() => setDumpJornada(j)} className={claseBoton(dumpJornada === j, filtroJornadaDeshabilitado)}>
                                {j}
                              </button>
                            ))}
                          </div>
                        )}
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
                                // Tooltip corto a propósito — es de hover, no se puede scrollear
                                // cómodo sin que el mouse se salga y desaparezca. El detalle
                                // completo por frente se ve haciendo CLIC en el segmento.
                                return (
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
                                    <p className="font-semibold text-gray-700 mb-2">{label}</p>
                                    {barras.map((p) => {
                                      const leySerie = row?.[`_ley_${p.dataKey}`];
                                      const etiquetaSerie = dumpAgrupacion === 'jornada' ? p.dataKey.split('__').join(' · ') : p.dataKey;
                                      return (
                                        <div key={p.dataKey} className="flex justify-between gap-3">
                                          <span style={{ color: p.fill }} className="font-medium">{etiquetaSerie}</span>
                                          <span className="font-mono font-semibold">
                                            {formatNumber(p.value)} {dumpMetrica === 'toneladas' ? 't' : 'dumpadas'}
                                            {leySerie != null && ` · ${formatNumber(leySerie)}%`}
                                          </span>
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
                                    <p className="text-gray-400 mt-1.5 pt-1.5 border-t italic">Clic en la barra → detalle por frente</p>
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
                            {/* "Por Faena" va SIN stackId (apiladoJuntas=false): columnas lado a
                                lado por faena, cada una con su propia ley encima — no una barra
                                dividida en 2. Frente/Jornada siguen apiladas, con una sola ley
                                combinada arriba de toda la barra. */}
                            {grupos.map((g, i) => {
                              const esUltimoDeSuStack = ultimoIndicePorStack[obtenerStackId(g)] === i;
                              const dataKeyLey = dumpAgrupacion === 'jornada' ? `_ley_${obtenerStackId(g)}` : '_leyDia';
                              return (
                                <Bar key={g} dataKey={g} stackId={obtenerStackId(g)} fill={obtenerColorSerie(g)}
                                  radius={esUltimoDeSuStack ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                  className="cursor-pointer"
                                  onClick={(data) => {
                                    const fila = data?.payload;
                                    if (!fila) return;
                                    setDetalleClicDump({
                                      fecha: fila.fecha,
                                      etiqueta: dumpAgrupacion === 'jornada' ? g.split('__').join(' · ') : g,
                                      color: obtenerColorSerie(g),
                                      valor: fila[g],
                                      ley: fila[`_ley_${g}`],
                                      detalles: fila._detalle?.[g] ?? [],
                                    });
                                  }}>
                                  {esUltimoDeSuStack && (
                                    <LabelList
                                      dataKey={dataKeyLey}
                                      position="top"
                                      formatter={(v) => (v != null ? `${dumpAgrupacion === 'jornada' ? '' : 'Ley '}${formatNumber(v)}%` : '')}
                                      fontSize={dumpAgrupacion === 'jornada' ? 9 : 10}
                                      fill="#374151"
                                    />
                                  )}
                                </Bar>
                              );
                            })}
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-3 mt-1">
                          {dumpAgrupacion === 'jornada' ? (
                            // El color acá es la jornada (una sola leyenda, sin repetir por
                            // faena) — a qué faena pertenece cada grupo de columnas ya se ve
                            // por posición, aclarado en la nota de abajo.
                            [...new Set(grupos.map((g) => g.split('__')[1]))]
                              .sort((a, b) => (JORNADA_ORDEN[a] ?? 99) - (JORNADA_ORDEN[b] ?? 99))
                              .map((j) => (
                                <span key={j} className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: JORNADA_COLOR_HEX[j] ?? '#9ca3af' }} />
                                  {j}
                                </span>
                              ))
                          ) : (
                            grupos.map((g) => (
                              <span key={g} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: obtenerColorSerie(g) }} />
                                {g}
                              </span>
                            ))
                          )}
                          {mostrarTendencia && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="w-3 h-0.5 rounded-sm inline-block" style={{ backgroundColor: '#1f2937' }} />
                              Promedio móvil (3 días)
                            </span>
                          )}
                        </div>
                        {dumpAgrupacion === 'jornada' && faenaIdsPresentes.length > 1 && (
                          <p className="text-[10px] text-gray-400 text-center mt-1">
                            Cada grupo de columnas es una faena, en este orden: {faenaIdsPresentes.map(id => nombrePorFaena[id]).join(' · ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Detalle completo por frente al hacer CLIC en un segmento de la barra de
                  arriba (no en el hover del tooltip, que no se puede scrollear cómodo). */}
              {detalleClicDump && (() => {
                const detallesOrdenados = [...detalleClicDump.detalles].sort((a, b) => {
                  const oa = JORNADA_ORDEN[a.jornada] ?? 99;
                  const ob = JORNADA_ORDEN[b.jornada] ?? 99;
                  return oa !== ob ? oa - ob : a.frente.localeCompare(b.frente);
                });
                return (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0 mt-1" style={{ backgroundColor: detalleClicDump.color }} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Detalle por frente — clic en la barra</p>
                          <h3 className="text-base font-semibold text-gray-800">{detalleClicDump.etiqueta} — {detalleClicDump.fecha}</h3>
                          <p className="text-xs text-gray-400">
                            {formatNumber(detalleClicDump.valor)} {dumpMetrica === 'toneladas' ? 't' : 'dumpadas'}
                            {detalleClicDump.ley != null && ` · Ley ${formatNumber(detalleClicDump.ley)}%`}
                            {' · '}{detallesOrdenados.length} frente{detallesOrdenados.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setDetalleClicDump(null)} className="text-gray-400 hover:text-gray-600 p-1" title="Cerrar">
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4 max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 uppercase text-[10px]">
                            <th className="pb-1.5 font-semibold">Frente</th>
                            <th className="pb-1.5 font-semibold">Túnel</th>
                            <th className="pb-1.5 font-semibold">Jornada</th>
                            <th className="pb-1.5 font-semibold text-right">{dumpMetrica === 'toneladas' ? 'Toneladas' : 'Dumpadas'}</th>
                            <th className="pb-1.5 font-semibold text-right">Ley</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detallesOrdenados.map((det, i) => (
                            <tr key={i}>
                              <td className="py-1.5 font-medium text-gray-700">{det.frente}</td>
                              <td className="py-1.5 text-gray-400">{det.grupo || '—'}</td>
                              <td className={`py-1.5 font-semibold ${JORNADA_COLOR_TEXTO[det.jornada] ?? 'text-gray-400'}`}>{det.jornada || '—'}</td>
                              <td className="py-1.5 text-right font-mono">{formatNumber(dumpMetrica === 'toneladas' ? det.toneladas : det.cantidad)}</td>
                              <td className="py-1.5 text-right font-mono">{det.ley_promedio != null ? `${formatNumber(det.ley_promedio)}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                        <p className="text-xs text-gray-400">% del tonelaje total por frente + % acumulado — el Cu Insoluble de cada frente va sobre su barra</p>
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
                                  {row?.ley_promedio != null && <p className="text-gray-600">Cu Insoluble: {formatNumber(row.ley_promedio)}%</p>}
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
                          <ResponsiveContainer width="100%" height={340}>
                            <ScatterChart margin={{ top: 24, right: 24, left: 4, bottom: 28 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                              <XAxis
                                type="number"
                                dataKey="peso_total"
                                name="Tonelaje"
                                unit=" t"
                                tick={{ fontSize: 11 }}
                                domain={['auto', 'auto']}
                                label={{ value: 'Tonelaje (t)', position: 'insideBottom', offset: -18, fontSize: 12, fill: '#6b7280' }}
                              />
                              <YAxis
                                type="number"
                                dataKey="ley_ponderada"
                                name="Ley Cu"
                                unit="%"
                                tick={{ fontSize: 11 }}
                                domain={['auto', 'auto']}
                                label={{ value: 'Ley Cu (%)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#6b7280' }}
                              />
                              <ReferenceLine x={avgTon} stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" />
                              <ReferenceLine y={avgLey} stroke="#e11d48" strokeWidth={2} strokeDasharray="6 3" />
                              <ReferenceDot
                                x={avgTon}
                                y={avgLey}
                                shape={(props) => (
                                  <g
                                    onMouseEnter={() => setHoverCruceLotes(true)}
                                    onMouseLeave={() => setHoverCruceLotes(false)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {/* Círculo invisible más grande: área de hover fácil de acertar con el mouse */}
                                    <circle cx={props.cx} cy={props.cy} r={14} fill="transparent" />
                                    <circle cx={props.cx} cy={props.cy} r={6} fill="#111827" stroke="#fff" strokeWidth={2} />
                                  </g>
                                )}
                                label={hoverCruceLotes ? (props) => (
                                  <EtiquetaCruceDePromedios
                                    {...props}
                                    texto={`Promedio: ${formatNumber(avgTon)} t · ${formatNumber(avgLey)}%`}
                                  />
                                ) : undefined}
                              />
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
                              {abiertos.length > 0 && (
                                <Scatter name="Abierto" data={abiertos} fill={COLOR_LOTE_ABIERTO} shape={PuntoLote} />
                              )}
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
                                {row?.ley_promedio != null && <p className="text-gray-600">Cu Insoluble: {formatNumber(row.ley_promedio)}%</p>}
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
                    <p className="text-xs text-gray-400 mt-1 text-right">Etiqueta al final de cada barra = Cu Insoluble promedio del frente</p>
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
