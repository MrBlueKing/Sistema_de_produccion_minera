import { useState, useEffect, useRef } from 'react';
import { HiBeaker, HiCube, HiEye, HiTrash, HiPencil, HiCheck, HiXMark, HiChevronDown, HiChevronUp, HiInformationCircle, HiCalendar } from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Pagination from '../../../shared/components/molecules/Pagination';
import Loader from '../../../shared/components/atoms/Loader';
import LoadingOverlay from '../../../shared/components/molecules/LoadingOverlay';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import mezclasService from '../services/mezclas';
import acopiosService from '../../../services/acopios';
import { useConfig } from '../../../hooks/useConfig';
import { useFaena } from '../../../contexts/FaenaContext';

export default function MezclasView({
  loading,
  setLoading,
  toast,
  formatearFecha,
  dumpadasDisponibles,
  setDumpadasDisponibles,
  mezclas,
  setMezclas,
  loadData,
  frentes = [],
  jornadas = ['AM', 'PM', 'Madrugada', 'Noche']
}) {
  // Obtener configuraciones desde BD
  const { factorAjusteLey, factorRemanenteVisual, leyCappingMaximo, usarSistemaAcopios, toneladas_por_palada } = useConfig();
  const { faenaUsuario } = useFaena();
  const [showInfo, setShowInfo] = useState(false);
  const [vistaTab, setVistaTab] = useState('crear'); // 'crear' | 'historial'

  // Mezclas disponibles (con toneladas_disponibles > 0) para el panel inferior
  const [mezclasDisponibles, setMezclasDisponibles] = useState([]);
  const [mezclasDispLoading, setMezclasDispLoading] = useState(false);
  const [dispPagina, setDispPagina] = useState(1);
  const dispPerPage = 15;

  // Evitar flash de "sin datos" antes del primer ciclo de carga
  const hasEverLoaded = useRef(false);
  useEffect(() => {
    if (!loading) hasEverLoaded.current = true;
  }, [loading]);
  const showSpinner = loading || !hasEverLoaded.current;

  // Cambiar de dumpadas a acopios
  const [acopiosDisponibles, setAcopiosDisponibles] = useState([]);
  const [acopiosSeleccionados, setAcopiosSeleccionados] = useState([]);

  // Estado para toggle de composición en modal detalle
  const [mostrarComposicion, setMostrarComposicion] = useState(true);

  // Estados para dumpadas directas (cuando NO se usan acopios)
  const [dumpadasSeleccionadas, setDumpadasSeleccionadas] = useState([]);
  const [formDataMezcla, setFormDataMezcla] = useState({
    codigo: '',
    fecha: new Date().toISOString().split('T')[0],
    planta_id: '',
    ley_base: 'auto',
    observaciones: '',
  });
  const [plantas, setPlantas] = useState([]);
  const [mezclaSeleccionada, setMezclaSeleccionada] = useState(null);
  const [loteRemanenteSeleccionado, setLoteRemanenteSeleccionado] = useState('');

  // Historial paginado (independiente del prop mezclas)
  const [historial, setHistorial] = useState([]);
  const [histPagina, setHistPagina] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [histLastPage, setHistLastPage] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [histSearch, setHistSearch] = useState('');
  const [histPerPage, setHistPerPage] = useState(20);
  const [histEstado, setHistEstado] = useState('');
  const [histFechaDesde, setHistFechaDesde] = useState('');
  const [histFechaHasta, setHistFechaHasta] = useState('');

  // Estados para remanentes de mezclas
  const [remanentesDisponibles, setRemanentesDisponibles] = useState([]);
  const [remanentesSeleccionados, setRemanentesSeleccionados] = useState([]); // Array de {mezcla_id, toneladas, numero_paladas?}
  const [remanenteModos, setRemanenteModos] = useState({}); // {[mezcla_id]: 'ton' | 'paladas'}

  // Estados para edición de mezcla (agregar/quitar dumpadas)
  const [modoAgregarDumpadas, setModoAgregarDumpadas] = useState(false);
  // dumpadasAgregar: array de {id, numero_paladas}
  // numero_paladas = null → dumpada completa; > 0 → paladas parciales
  const [dumpadasAgregar, setDumpadasAgregar] = useState([]);
  const [searchAgregar, setSearchAgregar] = useState('');
  const [pageAgregar, setPageAgregar] = useState(1);

  // Estados para diálogo de confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning'
  });

  // Estados para ajuste de toneladas
  const [mostrarModalAjuste, setMostrarModalAjuste] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({
    toneladas_reales_remanente: '',
    motivo: ''
  });

  // Estados para revertir ajuste
  const [mostrarModalRevertir, setMostrarModalRevertir] = useState(false);
  const [revertirForm, setRevertirForm] = useState({
    motivo: ''
  });

  // Paginación de dumpadas disponibles
  const [currentPageDumpadas, setCurrentPageDumpadas] = useState(1);
  const perPageDumpadas = 25; // 25 dumpadas por página

  // Filtros profesionales para dumpadas
  const [searchDumpada, setSearchDumpada] = useState('');
  const [filtersDumpada, setFiltersDumpada] = useState({
    id_frente_trabajo: '',
    jornada: '',
    fecha_desde: '',
    fecha_hasta: ''
  });

  // Cargar plantas y acopios al montar el componente
  useEffect(() => {
    const cargarPlantas = async () => {
      try {
        const response = await mezclasService.getPlantas();
        setPlantas(response.data || response);
      } catch (error) {
        console.error('Error cargando plantas:', error);
      }
    };

    const cargarAcopios = async () => {
      try {
        const response = await acopiosService.getAcopiosParaMezclas();
        setAcopiosDisponibles(response.data || []);
        console.log('📦 [MEZCLAS] Acopios disponibles cargados:', response.data);
      } catch (error) {
        console.error('Error cargando acopios:', error);
        toast?.error('Error', 'No se pudieron cargar los acopios disponibles');
      }
    };

    cargarPlantas();

    // Solo cargar acopios si el sistema de acopios está activado
    if (usarSistemaAcopios) {
      cargarAcopios();
    }
  }, [usarSistemaAcopios]);

  // Cargar remanentes disponibles al montar el componente
  // ── Historial paginado ───────────────────────────────────────────────────
  const cargarHistorial = async (
    page = 1,
    search = histSearch,
    perPage = histPerPage,
    estado = histEstado,
    fechaDesde = histFechaDesde,
    fechaHasta = histFechaHasta,
  ) => {
    setHistLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (search.trim())   params.codigo       = search.trim();
      if (estado)          params.estado       = estado;
      if (fechaDesde)      params.fecha_desde  = fechaDesde;
      if (fechaHasta)      params.fecha_hasta  = fechaHasta;
      const res = await mezclasService.getMezclas(params);
      setHistorial(res?.data || []);
      setHistPagina(res?.current_page || 1);
      setHistTotal(res?.total || 0);
      setHistLastPage(res?.last_page || 1);
    } catch (e) {
      console.error('Error cargando historial mezclas:', e);
    } finally {
      setHistLoading(false);
    }
  };

  // Carga inicial del historial
  useEffect(() => { cargarHistorial(1); }, []);

  // Recargar historial cuando el padre actualiza mezclas (nueva creada/eliminada)
  useEffect(() => { cargarHistorial(1, '', histPerPage); }, [mezclas]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Mezclas disponibles (panel inferior) ─────────────────────────────────
  const cargarMezclasDisponibles = async () => {
    setMezclasDispLoading(true);
    try {
      const res = await mezclasService.getMezclasDisponiblesParaDespacho();
      setMezclasDisponibles(res || []);
    } catch (e) {
      console.error('Error cargando mezclas disponibles:', e);
    } finally {
      setMezclasDispLoading(false);
    }
  };
  useEffect(() => { cargarMezclasDisponibles(); }, [mezclas]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const cargarRemanentes = async () => {
      try {
        const remanentes = await mezclasService.getRemanentesDisponibles();
        setRemanentesDisponibles(remanentes || []);
        console.log('📦 [MEZCLAS] Remanentes disponibles cargados:', remanentes);
      } catch (error) {
        console.error('Error cargando remanentes disponibles:', error);
      }
    };
    cargarRemanentes();
  }, [mezclas]); // Recargar cuando cambian las mezclas

  // Recargar acopios cuando cambian las mezclas (solo si sistema de acopios está activado)
  useEffect(() => {
    if (!usarSistemaAcopios) return;

    const recargarAcopios = async () => {
      try {
        const response = await acopiosService.getAcopiosParaMezclas();
        setAcopiosDisponibles(response.data || []);
      } catch (error) {
        console.error('Error recargando acopios:', error);
      }
    };
    recargarAcopios();
  }, [mezclas, usarSistemaAcopios]);

  
  const handleSelectAcopio = (id) => {
    if (acopiosSeleccionados.includes(id)) {
      setAcopiosSeleccionados(acopiosSeleccionados.filter(a => a !== id));
    } else {
      setAcopiosSeleccionados([...acopiosSeleccionados, id]);
    }
  };

  // Seleccionar/Deseleccionar todos los acopios
  const handleSelectAllAcopios = () => {
    if (acopiosSeleccionados.length === acopiosDisponibles.length) {
      setAcopiosSeleccionados([]);
    } else {
      setAcopiosSeleccionados(acopiosDisponibles.map(a => a.id));
    }
  };

  // Filtrar acopios
  const acopiosFiltrados = acopiosDisponibles.filter(a => {
    if (!searchDumpada) return true;
    const busqueda = searchDumpada.toLowerCase();
    return (
      a.codigo_acopio?.toLowerCase().includes(busqueda) ||
      a.nombre?.toLowerCase().includes(busqueda) ||
      a.frente_trabajo?.codigo_completo?.toLowerCase().includes(busqueda)
    );
  });

  // Calcular paginación de acopios
  const totalAcopios = acopiosFiltrados.length;
  const totalPagesAcopios = Math.ceil(totalAcopios / perPageDumpadas);
  const acopiosPaginados = acopiosFiltrados.slice(
    (currentPageDumpadas - 1) * perPageDumpadas,
    currentPageDumpadas * perPageDumpadas
  );

  const handlePageChangeDumpadas = (page) => {
    setCurrentPageDumpadas(page);
  };

  // Funciones para dumpadas directas (cuando NO se usan acopios)
  // dumpadasSeleccionadas: [{id, numero_paladas}]
  // numero_paladas = null → dumpada completa; > 0 → paladas parciales
  const handleSelectDumpada = (dumpada) => {
    const existe = dumpadasSeleccionadas.some(d => d.id === dumpada.id);
    if (existe) {
      setDumpadasSeleccionadas(dumpadasSeleccionadas.filter(d => d.id !== dumpada.id));
    } else {
      setDumpadasSeleccionadas([...dumpadasSeleccionadas, { id: dumpada.id, numero_paladas: null }]);
    }
  };

  const handleSetPaladasCrear = (dumpadaId, numeroPaladas) => {
    setDumpadasSeleccionadas(dumpadasSeleccionadas.map(d =>
      d.id === dumpadaId ? { ...d, numero_paladas: numeroPaladas } : d
    ));
  };

  const handleSelectAllDumpadas = () => {
    if (dumpadasSeleccionadas.length === dumpadasDisponibles.length) {
      setDumpadasSeleccionadas([]);
    } else {
      setDumpadasSeleccionadas(dumpadasDisponibles.map(d => ({ id: d.id, numero_paladas: null })));
    }
  };

  // Handlers para filtros
  const handleSearchDumpadaChange = (value) => {
    setSearchDumpada(value);
    setCurrentPageDumpadas(1);
  };

  const handleFilterDumpadaChange = (name, value) => {
    setFiltersDumpada(prev => ({ ...prev, [name]: value }));
    setCurrentPageDumpadas(1);
  };

  const handleClearFiltersDumpada = () => {
    setSearchDumpada('');
    setFiltersDumpada({
      id_frente_trabajo: '',
      jornada: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
    setCurrentPageDumpadas(1);
  };

  // Función auxiliar para convertir fecha del backend (puede ser DD-MM-YYYY o YYYY-MM-DD) a formato comparable YYYY-MM-DD
  const normalizarFecha = (fecha) => {
    if (!fecha) return null;

    // Si es un string en formato DD-MM-YYYY, convertir a YYYY-MM-DD
    if (typeof fecha === 'string' && fecha.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [dia, mes, anio] = fecha.split('-');
      return `${anio}-${mes}-${dia}`;
    }

    // Si ya está en formato YYYY-MM-DD o es un objeto Date, usar como está
    if (fecha instanceof Date) {
      return fecha.toISOString().split('T')[0];
    }

    // Si es YYYY-MM-DD, retornar tal cual
    if (typeof fecha === 'string' && fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return fecha;
    }

    return fecha;
  };

  // Filtrar dumpadas con filtros profesionales
  const dumpadasFiltradas = dumpadasDisponibles.filter(d => {
    // Filtro de búsqueda
    if (searchDumpada) {
      const busqueda = searchDumpada.toLowerCase();
      const matchBusqueda = (
        d.numero_dumpada?.toString().includes(busqueda) ||
        d.frente_trabajo?.codigo_completo?.toLowerCase().includes(busqueda) ||
        d.jornada?.toLowerCase().includes(busqueda)
      );
      if (!matchBusqueda) return false;
    }

    // Filtro por frente de trabajo
    if (filtersDumpada.id_frente_trabajo && d.id_frente_trabajo !== parseInt(filtersDumpada.id_frente_trabajo)) {
      return false;
    }

    // Filtro por jornada
    if (filtersDumpada.jornada && d.jornada !== filtersDumpada.jornada) {
      return false;
    }

    // Filtro por fecha desde
    if (filtersDumpada.fecha_desde) {
      const fechaDumpada = normalizarFecha(d.fecha);
      if (fechaDumpada && fechaDumpada < filtersDumpada.fecha_desde) {
        return false;
      }
    }

    // Filtro por fecha hasta
    if (filtersDumpada.fecha_hasta) {
      const fechaDumpada = normalizarFecha(d.fecha);
      if (fechaDumpada && fechaDumpada > filtersDumpada.fecha_hasta) {
        return false;
      }
    }

    return true;
  });

  // Función para obtener el color de fondo por grupo (frente + jornada + fecha)
  const getBackgroundColorByGroup = (dumpadas, currentIndex) => {
    const colors = ['#fed7aa', '#bfdbfe']; // Naranja durazno y azul cielo

    if (currentIndex === 0) return colors[0];

    const currentDumpada = dumpadas[currentIndex];
    const previousDumpada = dumpadas[currentIndex - 1];

    // Crear identificador de grupo (frente + jornada + fecha)
    const currentGroup = `${currentDumpada.id_frente_trabajo || ''}_${currentDumpada.jornada || ''}_${currentDumpada.fecha || ''}`;
    const previousGroup = `${previousDumpada.id_frente_trabajo || ''}_${previousDumpada.jornada || ''}_${previousDumpada.fecha || ''}`;

    // Si es del mismo grupo, mantener el color anterior
    if (currentGroup === previousGroup) {
      return getBackgroundColorByGroup(dumpadas, currentIndex - 1);
    }

    // Si cambió el grupo, alternar color
    const previousColor = getBackgroundColorByGroup(dumpadas, currentIndex - 1);
    return previousColor === colors[0] ? colors[1] : colors[0];
  };

  // Paginación de dumpadas directas
  const dumpadasPaginadas = dumpadasFiltradas.slice(
    (currentPageDumpadas - 1) * perPageDumpadas,
    currentPageDumpadas * perPageDumpadas
  );

  const calcularTotalesMezcla = () => {
    // Determinar si estamos usando acopios o dumpadas directas
    const usandoDumpadasDirectas = !usarSistemaAcopios;

    let totalToneladas = 0;
    let cantidadDumpadas = 0;
    let sumaPonderadaLey = 0;
    let sumaPonderadaLeyVisual = 0;
    let detallesOrigen = [];

    if (usandoDumpadasDirectas) {
      // MODO DUMPADAS DIRECTAS — soporta paladas parciales
      const dumpadasSel = dumpadasSeleccionadas.map(sel => {
        const d = dumpadasDisponibles.find(x => x.id === sel.id);
        if (!d) return null;
        const tonAUsar = sel.numero_paladas != null
          ? sel.numero_paladas * (d.ton_por_palada || toneladas_por_palada)
          : parseFloat(d.ton || 0);
        return { ...d, _tonAUsar: tonAUsar };
      }).filter(Boolean);

      totalToneladas = dumpadasSel.reduce((sum, d) => sum + d._tonAUsar, 0);
      cantidadDumpadas = dumpadasSel.length;

      // Calcular promedios ponderados usando toneladas reales a usar
      sumaPonderadaLey = dumpadasSel.reduce((sum, d) => {
        const ton = d._tonAUsar;
        const ley = parseFloat(d.ley || d.ley_visual || 0);
        return sum + (ton * ley);
      }, 0);

      sumaPonderadaLeyVisual = dumpadasSel.reduce((sum, d) => {
        const ton = d._tonAUsar;
        const leyVisual = d.ley_visual != null ? parseFloat(d.ley_visual) : 0;
        return sum + (ton * leyVisual);
      }, 0);

      detallesOrigen = dumpadasSel;
    } else {
      // MODO ACOPIOS (código original)
      const acopiosSel = acopiosDisponibles.filter(a => acopiosSeleccionados.includes(a.id));
      totalToneladas = acopiosSel.reduce((sum, a) => sum + parseFloat(a.total_toneladas || 0), 0);
      cantidadDumpadas = acopiosSel.reduce((sum, a) => sum + parseInt(a.cantidad_dumpadas || 0), 0);

      sumaPonderadaLey = acopiosSel.reduce((sum, a) => {
        const ton = parseFloat(a.total_toneladas || 0);
        const ley = parseFloat(a.ley_promedio || 0);
        return sum + (ton * ley);
      }, 0);

      sumaPonderadaLeyVisual = acopiosSel.reduce((sum, a) => {
        const ton = parseFloat(a.total_toneladas || 0);
        const leyVisual = parseFloat(a.ley_visual_promedio || 0);
        return sum + (ton * leyVisual);
      }, 0);

      detallesOrigen = acopiosSel;
    }

    // Sumar toneladas de remanentes seleccionados
    const totalTonRemanentes = remanentesSeleccionados.reduce((sum, r) => sum + parseFloat(r.toneladas || 0), 0);
    const totalTon = totalToneladas + totalTonRemanentes;

    const cantidadRemanentes = remanentesSeleccionados.length;

    // Para compatibilidad con código existente
    const acopiosSel = usandoDumpadasDirectas ? [] : acopiosDisponibles.filter(a => acopiosSeleccionados.includes(a.id));

    // ============ LEY LOTE y LEY DUMP AJUSTADA ============
    // REGLA: ley_lab → ley_dump = lab×0.9, ley_lote = lab×0.81
    //        ley_visual → ley_dump = visual (sin descuento), ley_lote = visual×0.9
    let sumaPonderadaLoteOrigen = 0;
    let sumaPonderadaDumpOrigen = 0;

    if (usandoDumpadasDirectas) {
      // DUMPADAS: calcular por cada dumpada según si tiene ley lab o visual
      const dumpadasSel = dumpadasSeleccionadas.map(sel => {
        const d = dumpadasDisponibles.find(x => x.id === sel.id);
        if (!d) return null;
        const tonAUsar = sel.numero_paladas != null
          ? sel.numero_paladas * (d.ton_por_palada || toneladas_por_palada)
          : parseFloat(d.ton || 0);
        return { ...d, _tonAUsar: tonAUsar };
      }).filter(Boolean);
      const leyBase = formDataMezcla.ley_base || 'auto';
      dumpadasSel.forEach(d => {
        const ton = d._tonAUsar;

        // Seleccionar fracción efectiva según ley_base (espeja MezclaDumpada::desdeDumpada)
        const cuInsoluble = d.cu_insoluble != null ? parseFloat(d.cu_insoluble) : null;
        const cuSoluble   = d.cu_soluble   != null ? parseFloat(d.cu_soluble)   : null;
        const tieneFraccion = cuInsoluble !== null || cuSoluble !== null;
        let leyLabRaw;
        if (tieneFraccion) {
          switch (leyBase) {
            case 'cu_insoluble': leyLabRaw = cuInsoluble; break;
            case 'cu_soluble':   leyLabRaw = cuSoluble;   break;
            case 'cu_total':     leyLabRaw = d.ley ? parseFloat(d.ley) : null; break;
            case 'auto':
            default: {
              const ins = cuInsoluble ?? 0;
              const sol = cuSoluble   ?? 0;
              leyLabRaw = ins >= sol
                ? (cuInsoluble ?? (d.ley ? parseFloat(d.ley) : null))
                : (cuSoluble   ?? (d.ley ? parseFloat(d.ley) : null));
            }
          }
        } else {
          // Dumpada sin fracciones: usar ley (Cu Total) — comportamiento legacy
          leyLabRaw = d.ley ? parseFloat(d.ley) : null;
        }

        const leyLab = leyLabRaw ? Math.min(leyLabRaw, leyCappingMaximo) : null;
        const leyVisual = d.ley_visual ? parseFloat(d.ley_visual) : null;

        if (leyLab) {
          sumaPonderadaDumpOrigen += ton * leyLab * factorAjusteLey;                    // lab × 0.9
          sumaPonderadaLoteOrigen += ton * leyLab * factorAjusteLey * factorAjusteLey; // lab × 0.81
        } else if (leyVisual) {
          sumaPonderadaDumpOrigen += ton * leyVisual;                      // visual directo
          sumaPonderadaLoteOrigen += ton * leyVisual * factorAjusteLey;   // visual × 0.9
        }
      });
    } else {
      // ACOPIOS: ley_lote_promedio ya viene con factores correctos del backend
      sumaPonderadaLoteOrigen = acopiosSel.reduce((sum, a) => {
        const ton = parseFloat(a.total_toneladas || 0);
        const leyLote = parseFloat(a.ley_lote_promedio || 0);
        return sum + (ton * leyLote);
      }, 0);
      // ley_dump para acopios: ley_lote / 0.9 sigue siendo válido como aproximación
      // porque el acopio ya calcula ley_lote con los factores correctos por dumpada
      sumaPonderadaDumpOrigen = sumaPonderadaLoteOrigen / factorAjusteLey;
    }

    // REMANENTES: ley_prom_lote y ley_prom_dump ya vienen con factores correctos
    let sumaPonderadaLoteRemanentes = 0;
    let sumaPonderadaDumpRemanentes = 0;
    remanentesSeleccionados.forEach(rem => {
      const mezcla = remanentesDisponibles.find(m => m.id === rem.mezcla_id);
      if (mezcla) {
        const ton = parseFloat(rem.toneladas || 0);
        sumaPonderadaLoteRemanentes += ton * parseFloat(mezcla.ley_prom_lote || 0);
        sumaPonderadaDumpRemanentes += ton * parseFloat(mezcla.ley_prom_dump || 0);
      }
    });

    // Combinar
    const sumaTotalLote = sumaPonderadaLoteOrigen + sumaPonderadaLoteRemanentes;
    const leyLote = totalTon > 0 ? (sumaTotalLote / totalTon) : 0;

    const sumaTotalDump = sumaPonderadaDumpOrigen + sumaPonderadaDumpRemanentes;
    const leyAjustada = totalTon > 0 ? (sumaTotalDump / totalTon) : 0;


    // ============ LEY VISUAL ============
    // LÓGICA: Sumar todas las contribuciones SIN factor, luego aplicar 0.9 al final
    // Para ACOPIOS: usar ley_visual_promedio (sin ajustar)
    // Para DUMPADAS DIRECTAS: usar ley_visual cruda (sin ajustar)
    let sumaPonderadaVisualOrigen = 0;

    if (usandoDumpadasDirectas) {
      // DUMPADAS: ley_visual ya calculada arriba (sumaPonderadaLeyVisual)
      sumaPonderadaVisualOrigen = sumaPonderadaLeyVisual;
    } else {
      // ACOPIOS: usar ley_visual_promedio SIN factor
      sumaPonderadaVisualOrigen = acopiosSel.reduce((sum, a) => {
        const ton = parseFloat(a.total_toneladas || 0);
        const leyVisualOriginal = parseFloat(a.ley_visual_promedio || 0);
        return sum + (ton * leyVisualOriginal);
      }, 0);
    }

    // REMANENTES: ley_prom_lote viene CON factor 0.9
    // Fórmula: ley_prom_lote × factor_remanente_visual (1.11)
    // El resultado (ej: 0.86×1.11=0.95%) se trata como "ley original" para este cálculo
    let sumaPonderadaVisualRemanentes = 0;
    remanentesSeleccionados.forEach(rem => {
      const mezcla = remanentesDisponibles.find(m => m.id === rem.mezcla_id);
      if (mezcla) {
        const ton = parseFloat(rem.toneladas || 0);
        const leyVisualOriginal = parseFloat(mezcla.ley_prom_lote || 0) * factorRemanenteVisual; // 0.86×1.11=0.95%
        sumaPonderadaVisualRemanentes += (ton * leyVisualOriginal); // Tratar como original
      }
    });

    // Combinar leyes "originales" y aplicar factor 0.9 AL FINAL
    const sumaTotalVisualOriginal = sumaPonderadaVisualOrigen + sumaPonderadaVisualRemanentes;
    const leyVisualPromedio = totalTon > 0 ? (sumaTotalVisualOriginal / totalTon) : 0;
    const leyVisual = leyVisualPromedio * factorAjusteLey; // Aplicar factor 0.9 al final

    // ============ LEY LAB ============
    // Representa la ley original sin descuentos = ley_lote / 0.81
    const leyLab = leyLote > 0 ? leyLote / (factorAjusteLey * factorAjusteLey) : 0;

    return {
      totalTon: totalTon.toFixed(2),
      cantidadDumpadas: cantidadDumpadas,
      cantidadRemanentes,
      leyAjustada: leyAjustada.toFixed(2),
      leyVisual: leyVisual.toFixed(2),
      leyLote: leyLote.toFixed(2),
      leyLab: leyLab.toFixed(2),
      acopiosDetalle: acopiosSel,
      dumpadasDetalle: usandoDumpadasDirectas ? detallesOrigen : [],
    };
  };

  const handleCrearMezcla = async () => {
    // Validar que haya selección (acopios o dumpadas según el modo)
    const tieneSeleccion = usarSistemaAcopios
      ? (acopiosSeleccionados.length > 0 || remanentesSeleccionados.length > 0)
      : (dumpadasSeleccionadas.length > 0 || remanentesSeleccionados.length > 0);

    if (!tieneSeleccion) {
      const mensaje = usarSistemaAcopios
        ? 'Debes seleccionar al menos un acopio o remanente'
        : 'Debes seleccionar al menos una dumpada o remanente';
      toast.warning('Atención', mensaje);
      return;
    }

    if (!formDataMezcla.planta_id) {
      toast.warning('Atención', 'Debes seleccionar una planta destino');
      return;
    }

    setLoading(true);

    try {
      const data = {
        codigo: formDataMezcla.codigo || null,
        fecha: new Date().toISOString().split('T')[0], // Siempre usar fecha actual
        planta_id: parseInt(formDataMezcla.planta_id),
        id_faena: faenaUsuario ?? null,
        ley_base: formDataMezcla.ley_base || 'auto',
        observaciones: formDataMezcla.observaciones || null,
      };

      // Agregar acopios O dumpadas según configuración
      if (usarSistemaAcopios) {
        data.acopios = acopiosSeleccionados;
      } else {
        data.dumpadas = dumpadasSeleccionadas;
      }

      // Agregar lote remanente si fue seleccionado (legacy)
      if (loteRemanenteSeleccionado) {
        data.lotes_venta_remanentes = [parseInt(loteRemanenteSeleccionado)];
      }

      // Agregar remanentes de mezclas si fueron seleccionados
      if (remanentesSeleccionados.length > 0) {
        data.remanentes_mezclas = remanentesSeleccionados.map(r => {
          const modo = remanenteModos[r.mezcla_id] || 'ton';
          if (modo === 'paladas' && r.numero_paladas) {
            return { mezcla_id: parseInt(r.mezcla_id), numero_paladas: parseFloat(r.numero_paladas) };
          }
          return { mezcla_id: parseInt(r.mezcla_id), toneladas: parseFloat(r.toneladas) };
        });
      }

      const response = await mezclasService.createMezcla(data);

      toast.success(
        `Mezcla ${response.mezcla.codigo} creada`,
        `${response.mezcla.total_ton} toneladas`
      );

      // Resetear formulario
      setFormDataMezcla({
        codigo: '',
        fecha: new Date().toISOString().split('T')[0],
        planta_id: '',
        observaciones: '',
      });
      setAcopiosSeleccionados([]);
      setDumpadasSeleccionadas([]);
      setLoteRemanenteSeleccionado('');
      setRemanentesSeleccionados([]);
      setRemanenteModos({});

      // Recargar datos
      await loadData();
    } catch (error) {
      console.error('Error creando mezcla:', error);
      toast.error(
        'Error al crear mezcla',
        error.response?.data?.mensaje || error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalleMezcla = async (mezclaId) => {
    try {
      const mezcla = await mezclasService.getMezcla(mezclaId);
      setMostrarComposicion(false);
      setMezclaSeleccionada(mezcla);
    } catch (error) {
      console.error('Error cargando detalle:', error);
      toast.error('Error', 'No se pudo cargar el detalle de la mezcla');
    }
  };

  const handleEliminarMezcla = (mezclaId, mezclacodigo) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar mezcla?',
      message: `¿Estás seguro de que deseas eliminar la mezcla ${mezclacodigo}? Esta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          await mezclasService.deleteMezcla(mezclaId);
          toast.success('Mezcla eliminada', 'La mezcla ha sido eliminada correctamente');
          await loadData();
        } catch (error) {
          console.error('Error eliminando mezcla:', error);
          toast.error(
            'Error al eliminar',
            error.response?.data?.mensaje || 'No se pudo eliminar la mezcla'
          );
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAbrirAgregarDumpadas = () => {
    setModoAgregarDumpadas(true);
    setDumpadasAgregar([]);
    setSearchAgregar('');
    setPageAgregar(1);
  };

  const handleCerrarAgregarDumpadas = () => {
    setModoAgregarDumpadas(false);
    setDumpadasAgregar([]);
    setSearchAgregar('');
    setPageAgregar(1);
  };

  // Toggle de dumpada en el modal de agregar: añade con numero_paladas = null (dumpada completa por defecto)
  const handleToggleDumpadaAgregar = (dumpada) => {
    const existe = dumpadasAgregar.some(d => d.id === dumpada.id);
    if (existe) {
      setDumpadasAgregar(dumpadasAgregar.filter(d => d.id !== dumpada.id));
    } else {
      // Por defecto: dumpada completa (null). El usuario puede ingresar paladas manualmente si quiere uso parcial.
      setDumpadasAgregar([...dumpadasAgregar, { id: dumpada.id, numero_paladas: null }]);
    }
  };

  // Actualizar número de paladas de una dumpada ya seleccionada
  const handleSetPaladasAgregar = (dumpadaId, numeroPaladas) => {
    setDumpadasAgregar(dumpadasAgregar.map(d =>
      d.id === dumpadaId ? { ...d, numero_paladas: numeroPaladas } : d
    ));
  };

  const handleAgregarDumpadasAMezcla = async () => {
    if (dumpadasAgregar.length === 0) {
      toast.warning('Atención', 'Debes seleccionar al menos una dumpada');
      return;
    }

    try {
      setLoading(true);

      await mezclasService.agregarDumpadas(mezclaSeleccionada.id, dumpadasAgregar);

      toast.success(
        'Dumpadas agregadas',
        `${dumpadasAgregar.length} dumpada(s) agregada(s) a la mezcla`
      );

      // Recargar el detalle de la mezcla
      const mezclaActualizada = await mezclasService.getMezcla(mezclaSeleccionada.id);
      setMezclaSeleccionada(mezclaActualizada);

      // Cerrar modal
      handleCerrarAgregarDumpadas();

      // Recargar datos
      await loadData();
    } catch (error) {
      console.error('Error agregando dumpadas:', error);
      toast.error(
        'Error al agregar dumpadas',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudieron agregar las dumpadas'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarDetalleMezcla = (detalleId, origen) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar componente?',
      message: `¿Estás seguro de que deseas eliminar "${origen}" de esta mezcla? Los totales se recalcularán automáticamente.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setLoading(true);

          await mezclasService.eliminarDetalle(mezclaSeleccionada.id, detalleId);

          toast.success('Detalle eliminado', 'El detalle ha sido eliminado de la mezcla');

          // Recargar el detalle de la mezcla
          const mezclaActualizada = await mezclasService.getMezcla(mezclaSeleccionada.id);
          setMezclaSeleccionada(mezclaActualizada);

          // Recargar datos
          await loadData();
        } catch (error) {
          console.error('Error eliminando detalle:', error);
          toast.error(
            'Error al eliminar',
            error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo eliminar el detalle'
          );
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Abrir modal de ajuste de toneladas
  const handleAbrirModalAjuste = () => {
    // Pre-llenar con el valor del remanente actual
    setAjusteForm({
      toneladas_reales_remanente: mezclaSeleccionada.toneladas_disponibles || '',
      motivo: ''
    });
    setMostrarModalAjuste(true);
  };

  // Aplicar ajuste de toneladas
  const handleAplicarAjuste = async () => {
    try {
      // Validaciones
      if (!ajusteForm.toneladas_reales_remanente || parseFloat(ajusteForm.toneladas_reales_remanente) < 0) {
        toast.error('Error de validación', 'Las toneladas reales deben ser un número positivo');
        return;
      }

      if (!ajusteForm.motivo || ajusteForm.motivo.trim().length < 10) {
        toast.error('Error de validación', 'El motivo debe tener al menos 10 caracteres');
        return;
      }

      setLoading(true);

      const response = await mezclasService.aplicarAjusteToneladas(mezclaSeleccionada.id, {
        toneladas_reales_remanente: parseFloat(ajusteForm.toneladas_reales_remanente),
        motivo: ajusteForm.motivo.trim()
      });

      toast.success('Ajuste aplicado', 'El ajuste de toneladas se ha aplicado exitosamente');

      // Cerrar modal
      setMostrarModalAjuste(false);
      setAjusteForm({ toneladas_reales_remanente: '', motivo: '' });

      // Recargar el detalle de la mezcla
      const mezclaActualizada = await mezclasService.getMezcla(mezclaSeleccionada.id);
      setMezclaSeleccionada(mezclaActualizada);

      // Recargar datos
      await loadData();

    } catch (error) {
      console.error('Error aplicando ajuste:', error);
      toast.error(
        'Error al aplicar ajuste',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo aplicar el ajuste'
      );
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de revertir ajuste
  const handleAbrirModalRevertir = () => {
    setRevertirForm({
      motivo: ''
    });
    setMostrarModalRevertir(true);
  };

  // Revertir ajuste de toneladas
  const handleRevertirAjuste = async () => {
    try {
      // Validación
      if (!revertirForm.motivo || revertirForm.motivo.trim().length < 10) {
        toast.error('Error de validación', 'El motivo debe tener al menos 10 caracteres');
        return;
      }

      setLoading(true);

      const response = await mezclasService.revertirAjusteToneladas(mezclaSeleccionada.id, {
        motivo: revertirForm.motivo.trim()
      });

      toast.success('Ajuste revertido', 'El ajuste se ha revertido exitosamente y se restauraron los valores originales');

      // Cerrar modal
      setMostrarModalRevertir(false);
      setRevertirForm({ motivo: '' });

      // Recargar el detalle de la mezcla
      const mezclaActualizada = await mezclasService.getMezcla(mezclaSeleccionada.id);
      setMezclaSeleccionada(mezclaActualizada);

      // Recargar datos
      await loadData();

    } catch (error) {
      console.error('Error revirtiendo ajuste:', error);
      toast.error(
        'Error al revertir ajuste',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo revertir el ajuste'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        {/* ── ¿Cómo funciona? ── */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowInfo(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              showInfo ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
            }`}
            title="¿Cómo funciona?"
          >
            <HiInformationCircle className="w-4 h-4" />
            <span className="hidden sm:inline">¿Cómo funciona?</span>
          </button>
        </div>

        {showInfo && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">

            {/* ── Flujo del dato ── */}
            <div className="mb-4 pb-4 border-b border-blue-100">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2.5">Flujo del dato</p>
              <div className="flex items-start">
                {[
                  { n: 1, label: 'Ingreso', color: 'bg-orange-500', active: false },
                  { n: 2, label: 'Envío\nMuestras', color: 'bg-teal-500', active: false },
                  { n: 3, label: 'Lab', color: 'bg-green-600', active: false },
                  { n: 4, label: 'Mezclas', color: 'bg-purple-600', active: true },
                  { n: 5, label: 'Despacho', color: 'bg-indigo-600', active: false },
                ].flatMap((p, i, arr) => [
                  <div key={`s${i}`} className={`flex flex-col items-center ${!p.active ? 'opacity-35' : ''}`} style={{minWidth:'44px'}}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.active ? p.color : 'bg-gray-300'}`}>{p.n}</div>
                    <span className={`mt-1 text-[9px] font-semibold text-center leading-tight whitespace-pre-line ${p.active ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
                  </div>,
                  ...(i < arr.length - 1 ? [<div key={`l${i}`} className="flex-1 h-px bg-gray-200 mt-3.5 mx-0.5 min-w-[8px]" />] : [])
                ])}
              </div>
            </div>

            {/* ── Específico: Mezclas ── */}
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2.5">¿Cómo funciona el módulo de Mezclas?</p>
            <div className="space-y-2">
              <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-purple-700">Qué es una mezcla</p>
                <p className="text-xs text-gray-500 mt-0.5">Una mezcla combina dumpadas completadas (con ley de laboratorio) para generar un lote de material homogéneo. El sistema calcula el <strong>promedio ponderado de ley por tonelaje</strong> automáticamente.</p>
              </div>
              <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-purple-700">Dumpadas con solo ley visual</p>
                <p className="text-xs text-gray-500 mt-0.5">También se pueden incluir dumpadas sin ley de laboratorio, usando únicamente su ley visual. El sistema aplica un <strong>factor de ajuste</strong> sobre esa ley. Tanto el factor de ajuste como el capping máximo de ley son modificables — contactar al administrador del sistema.</p>
              </div>
              {usarSistemaAcopios && (
                <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-purple-700">Modo Acopios</p>
                  <p className="text-xs text-gray-500 mt-0.5">En esta faena está activo el sistema de acopios. Las mezclas se construyen desde <strong>acopios cerrados</strong> en lugar de dumpadas individuales. El sistema de acopios es configurable por faena — contactar al administrador del sistema.</p>
                </div>
              )}
              <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-purple-700">Remanentes y paladas</p>
                <p className="text-xs text-gray-500 mt-0.5">Si solo se usa parte de una dumpada o acopio, el resto queda como <strong>remanente</strong> disponible para futuras mezclas. El peso de cada palada utilizada es configurable — contactar al administrador del sistema.</p>
              </div>
              <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-purple-700">Plantas de destino</p>
                <p className="text-xs text-gray-500 mt-0.5">Al crear una mezcla se debe indicar la <strong>planta de destino</strong>. Las plantas disponibles se gestionan desde el módulo de Despachos.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs: Crear Mezcla / Historial ── */}
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setVistaTab('crear')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vistaTab === 'crear'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🧪 Crear Mezcla
          </button>
          <button
            onClick={() => setVistaTab('historial')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vistaTab === 'historial'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 Historial
            {histTotal > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${vistaTab === 'historial' ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                {histTotal}
              </span>
            )}
          </button>
        </div>

        {/* ── Contenido tab "Crear Mezcla" ── */}
        {vistaTab === 'crear' && (<>

        {/* Selección de Acopios O Dumpadas según configuración */}
        {usarSistemaAcopios ? (
          // ============ MODO ACOPIOS ============
        <LoadingOverlay isLoading={loading} text="Cargando acopios disponibles...">
          <Card className="mb-6 border-l-4 border-green-400">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  ✅ Seleccionar Acopios ({acopiosSeleccionados.length} seleccionados)
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Acopios disponibles: {acopiosDisponibles.length} • Mostrando: {totalAcopios} • Total seleccionado: {calcularTotalesMezcla().totalTon} t
                </p>
              </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  const paginadosIds = acopiosPaginados.map(a => a.id);
                  const todosSeleccionados = paginadosIds.every(id => acopiosSeleccionados.includes(id));
                  if (todosSeleccionados) {
                    setAcopiosSeleccionados(acopiosSeleccionados.filter(id => !paginadosIds.includes(id)));
                  } else {
                    setAcopiosSeleccionados([...new Set([...acopiosSeleccionados, ...paginadosIds])]);
                  }
                }}
              >
                {acopiosPaginados.every(a => acopiosSeleccionados.includes(a.id)) && acopiosPaginados.length > 0
                  ? 'Deseleccionar Página'
                  : 'Seleccionar Página'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSelectAllAcopios}
              >
                {acopiosSeleccionados.length === acopiosDisponibles.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </Button>
            </div>
          </div>

          {/* Filtros y ordenamiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                🔍 Buscar
              </label>
              <input
                type="text"
                placeholder="Buscar por código de acopio, frente..."
                value={searchDumpada}
                onChange={(e) => {
                  setSearchDumpada(e.target.value);
                  setCurrentPageDumpadas(1); // Resetear a página 1 al buscar
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {acopiosDisponibles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No hay acopios disponibles para mezclar</p>
              <p className="text-sm text-gray-500 mt-1">Los acopios deben estar cerrados y no asignados a otra mezcla</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-green-200 bg-gradient-to-r from-green-50 to-green-100">
                    <th className="text-center py-2 px-2 font-bold text-green-900 text-xs w-10">
                      <input
                        type="checkbox"
                        onChange={() => {
                          const paginadosIds = acopiosPaginados.map(a => a.id);
                          const todosSeleccionados = paginadosIds.every(id => acopiosSeleccionados.includes(id));
                          if (todosSeleccionados) {
                            setAcopiosSeleccionados(acopiosSeleccionados.filter(id => !paginadosIds.includes(id)));
                          } else {
                            setAcopiosSeleccionados([...new Set([...acopiosSeleccionados, ...paginadosIds])]);
                          }
                        }}
                        checked={acopiosPaginados.length > 0 && acopiosPaginados.every(a => acopiosSeleccionados.includes(a.id))}
                        className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                        title="Seleccionar/Deseleccionar página actual"
                      />
                    </th>
                    <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Código Acopio</th>
                    <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Frente</th>
                    <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Dumpadas</th>
                    <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Toneladas</th>
                    <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Ley Prom</th>
                  </tr>
                </thead>
                <tbody>
                  {acopiosPaginados.map((acopio, index) => (
                    <tr
                      key={acopio.id}
                      className={`border-b border-gray-200 hover:bg-green-50 transition-all ${acopiosSeleccionados.includes(acopio.id) ? 'bg-green-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                    >
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={acopiosSeleccionados.includes(acopio.id)}
                          onChange={() => handleSelectAcopio(acopio.id)}
                          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-blue-800 text-xs">
                        {acopio.codigo_acopio}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {acopio.frente_trabajo?.codigo_completo || acopio.nombre || 'Manual'}
                      </td>
                      <td className="py-2 px-2 text-xs font-semibold text-orange-700">
                        {acopio.cantidad_dumpadas || 0}
                      </td>
                      <td className="py-2 px-2 text-xs font-semibold text-orange-700">
                        {acopio.total_toneladas ? parseFloat(acopio.total_toneladas).toFixed(2) : '0.00'} t
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {acopio.ley_promedio ? `${parseFloat(acopio.ley_promedio).toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación de acopios */}
          {totalAcopios > perPageDumpadas && (
            <Pagination
              currentPage={currentPageDumpadas}
              totalPages={totalPagesAcopios}
              totalRecords={totalAcopios}
              perPage={perPageDumpadas}
              onPageChange={handlePageChangeDumpadas}
              showInfo={true}
              showFirstLast={false}
            />
          )}
        </Card>
        </LoadingOverlay>
        ) : (
          // ============ MODO DUMPADAS DIRECTAS ============
          <Card className="mb-6 border-l-4 border-blue-400">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  ✅ Seleccionar Dumpadas ({dumpadasSeleccionadas.length} seleccionadas)
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mostrando: {dumpadasDisponibles.length} dumpadas disponibles • Total seleccionado: {dumpadasSeleccionadas.reduce((sum, sel) => {
                    const d = dumpadasDisponibles.find(x => x.id === sel.id);
                    if (!d) return sum;
                    const ton = sel.numero_paladas != null ? sel.numero_paladas * (d.ton_por_palada || toneladas_por_palada) : parseFloat(d.ton || 0);
                    return sum + ton;
                  }, 0).toFixed(2)} t
                </p>
                {dumpadasDisponibles.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Desde #{dumpadasDisponibles[0]?.numero_dumpada} hasta #{dumpadasDisponibles[dumpadasDisponibles.length - 1]?.numero_dumpada}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const paginadosIds = dumpadasPaginadas.map(d => d.id);
                    const todosSeleccionados = paginadosIds.every(id => dumpadasSeleccionadas.some(d => d.id === id));
                    if (todosSeleccionados) {
                      setDumpadasSeleccionadas(dumpadasSeleccionadas.filter(d => !paginadosIds.includes(d.id)));
                    } else {
                      const nuevas = dumpadasPaginadas
                        .filter(d => !dumpadasSeleccionadas.some(s => s.id === d.id))
                        .map(d => ({ id: d.id, numero_paladas: null }));
                      setDumpadasSeleccionadas([...dumpadasSeleccionadas, ...nuevas]);
                    }
                  }}
                >
                  {dumpadasPaginadas.every(d => dumpadasSeleccionadas.some(s => s.id === d.id)) && dumpadasPaginadas.length > 0
                    ? 'Deseleccionar Página'
                    : 'Seleccionar Página'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSelectAllDumpadas}
                >
                  {dumpadasSeleccionadas.length === dumpadasDisponibles.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                </Button>
              </div>
            </div>

            {/* Filtros Profesionales */}
            <TableFilters
              alwaysExpanded
              searchValue={searchDumpada}
              searchPlaceholder="Buscar por número, frente, jornada..."
              onSearchChange={handleSearchDumpadaChange}
              filters={[
                {
                  name: 'id_frente_trabajo',
                  label: 'Frente de Trabajo',
                  type: 'select',
                  options: frentes.map(f => ({
                    value: f.id,
                    label: f.codigo_completo || `ID: ${f.id}`
                  }))
                },
                {
                  name: 'jornada',
                  label: 'Jornada',
                  type: 'select',
                  options: jornadas.map(j => ({ value: j, label: j }))
                },
                {
                  name: 'fecha_desde',
                  label: 'Fecha Desde',
                  type: 'date'
                },
                {
                  name: 'fecha_hasta',
                  label: 'Fecha Hasta',
                  type: 'date'
                }
              ]}
              filterValues={filtersDumpada}
              onFilterChange={handleFilterDumpadaChange}
              onClear={handleClearFiltersDumpada}
            />

            {showSpinner ? (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-gray-500 text-sm">Cargando dumpadas disponibles…</p>
              </div>
            ) : dumpadasDisponibles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No hay dumpadas disponibles para mezclas</p>
                <p className="text-sm text-gray-500 mt-1">Las dumpadas deben estar completadas y no asignadas a otra mezcla</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 border-b-2 border-blue-200">
                      <th className="py-2 px-3 text-left">
                        <input
                          type="checkbox"
                          onChange={() => {
                            const paginadosIds = dumpadasPaginadas.map(d => d.id);
                            const todosSeleccionados = paginadosIds.every(id => dumpadasSeleccionadas.some(d => d.id === id));
                            if (todosSeleccionados) {
                              setDumpadasSeleccionadas(dumpadasSeleccionadas.filter(d => !paginadosIds.includes(d.id)));
                            } else {
                              const nuevas = dumpadasPaginadas
                                .filter(d => !dumpadasSeleccionadas.some(s => s.id === d.id))
                                .map(d => ({ id: d.id, numero_paladas: null }));
                              setDumpadasSeleccionadas([...dumpadasSeleccionadas, ...nuevas]);
                            }
                          }}
                          checked={dumpadasPaginadas.length > 0 && dumpadasPaginadas.every(d => dumpadasSeleccionadas.some(s => s.id === d.id))}
                          className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="py-2 px-3 text-left font-bold text-gray-700">#</th>
                      <th className="py-2 px-3 text-left font-bold text-gray-700">Frente</th>
                      <th className="py-2 px-3 text-left font-bold text-gray-700">Jornada</th>
                      <th className="py-2 px-3 text-left font-bold text-gray-700">Fecha</th>
                      <th className="py-2 px-3 text-right font-bold text-gray-700">Ton total</th>
                      <th className="py-2 px-3 text-center font-bold text-gray-700">Paladas disp.</th>
                      <th className="py-2 px-3 text-center font-bold text-gray-700">Paladas a usar</th>
                      <th className="py-2 px-3 text-right font-bold text-gray-700">Cu Total</th>
                      <th className="py-2 px-3 text-right font-bold text-blue-700">Cu Ins.</th>
                      <th className="py-2 px-3 text-right font-bold text-green-700">Cu Sol.</th>
                      <th className="py-2 px-3 text-right font-bold text-gray-700">Ley Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dumpadasPaginadas.map((dumpada, index) => {
                      // Obtener el color según grupo (frente + jornada + fecha)
                      const backgroundColor = getBackgroundColorByGroup(dumpadasFiltradas, dumpadasFiltradas.indexOf(dumpada));
                      const seleccion = dumpadasSeleccionadas.find(s => s.id === dumpada.id);
                      const estaSeleccionada = !!seleccion;
                      const tonPalada = dumpada.ton_por_palada || toneladas_por_palada;
                      const paladasDisp = dumpada.paladas_disponibles ?? (dumpada.ton / tonPalada);

                      return (
                            <tr
                              key={dumpada.id}
                              onClick={() => handleSelectDumpada(dumpada)}
                              style={{ backgroundColor: estaSeleccionada ? '#dbeafe' : backgroundColor }}
                              className={`border-b border-gray-200 hover:opacity-90 transition-all cursor-pointer ${estaSeleccionada ? 'ring-2 ring-blue-400' : ''}`}
                            >
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={estaSeleccionada}
                                  onChange={() => handleSelectDumpada(dumpada)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3 font-bold text-blue-700">{dumpada.numero_dumpada}</td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-blue-900 bg-gradient-to-r from-blue-100 to-blue-200 px-1.5 py-0.5 rounded-lg shadow-sm border border-blue-300 inline-block text-xs whitespace-nowrap">
                                  {dumpada.frente_trabajo?.codigo_completo || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <Badge variant={dumpada.jornada === 'AM' ? 'warning' : dumpada.jornada === 'PM' ? 'info' : 'default'}>
                                  {dumpada.jornada}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-xs text-gray-600">
                                {dumpada.fecha ? formatearFecha(dumpada.fecha) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">{parseFloat(dumpada.ton || 0).toFixed(2)}</td>
                              <td className="py-2 px-3 text-center text-xs">
                                {dumpada.paladas_disponibles != null ? (
                                  <span className={`font-semibold ${dumpada.tiene_uso_parcial ? 'text-amber-600' : 'text-green-700'}`}>
                                    {parseFloat(dumpada.paladas_disponibles).toFixed(1)}/{dumpada.paladas_totales}
                                    {dumpada.tiene_uso_parcial && <span className="ml-1 text-[9px] text-amber-500">(parcial)</span>}
                                  </span>
                                ) : <span className="text-gray-400">-</span>}
                              </td>
                              {/* Paladas a usar — solo editable cuando está seleccionada */}
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                {estaSeleccionada ? (
                                  <input
                                    type="number"
                                    min="0.5"
                                    max={parseFloat(paladasDisp)}
                                    step="0.5"
                                    value={seleccion.numero_paladas ?? ''}
                                    placeholder="Todas"
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                      if (val !== null && val > parseFloat(paladasDisp)) {
                                        toast.warning('Paladas excedidas', `Máximo ${parseFloat(paladasDisp).toFixed(1)} paladas disponibles`);
                                        return;
                                      }
                                      handleSetPaladasCrear(dumpada.id, val);
                                    }}
                                    className="w-20 px-1 py-1 border border-blue-300 rounded text-xs text-center focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="text-gray-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-gray-700">
                                {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(2)}%` : <span className="text-gray-400">-</span>}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">
                                {dumpada.cu_insoluble != null ? (
                                  (() => {
                                    const ins = parseFloat(dumpada.cu_insoluble);
                                    const sol = parseFloat(dumpada.cu_soluble ?? 0);
                                    const esAlta = formDataMezcla.ley_base === 'cu_insoluble' || (formDataMezcla.ley_base === 'auto' && ins >= sol);
                                    return <span className={esAlta ? 'text-blue-700 font-bold bg-blue-50 px-1 rounded' : 'text-blue-500'}>{ins.toFixed(2)}%{esAlta && ' ↑'}</span>;
                                  })()
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">
                                {dumpada.cu_soluble != null ? (
                                  (() => {
                                    const sol = parseFloat(dumpada.cu_soluble);
                                    const ins = parseFloat(dumpada.cu_insoluble ?? 0);
                                    const esAlta = formDataMezcla.ley_base === 'cu_soluble' || (formDataMezcla.ley_base === 'auto' && sol > ins);
                                    return <span className={esAlta ? 'text-green-700 font-bold bg-green-50 px-1 rounded' : 'text-green-600'}>{sol.toFixed(2)}%{esAlta && ' ↑'}</span>;
                                  })()
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">
                                {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(2)}%` : <span className="text-gray-400">-</span>}
                              </td>
                            </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            {dumpadasFiltradas.length > perPageDumpadas && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPageDumpadas}
                  totalPages={Math.ceil(dumpadasFiltradas.length / perPageDumpadas)}
                  totalRecords={dumpadasFiltradas.length}
                  perPage={perPageDumpadas}
                  onPageChange={handlePageChangeDumpadas}
                  showInfo={true}
                  showFirstLast={true}
                />
                <div className="mt-2 text-center text-sm text-gray-600">
                  Mostrando {((currentPageDumpadas - 1) * perPageDumpadas) + 1} - {Math.min(currentPageDumpadas * perPageDumpadas, dumpadasFiltradas.length)} de {dumpadasFiltradas.length} dumpadas filtradas
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Selección de Remanentes (Mezclas con toneladas disponibles) */}
        {remanentesDisponibles.length > 0 && (
          <Card className="mb-6 border-l-4 border-orange-400">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  🔄 Remanentes Disponibles ({remanentesSeleccionados.length} seleccionados)
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mezclas con toneladas disponibles que puedes usar en la nueva mezcla
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100">
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Código</th>
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Fecha</th>
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Disponibles</th>
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Ley Dump</th>
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Ley Visual</th>
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Ley Lote</th>
                    <th className="text-left py-2 px-2 font-bold text-orange-900 text-xs">Modo / Usar</th>
                    <th className="text-center py-2 px-2 font-bold text-orange-900 text-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {remanentesDisponibles.map((mezcla, index) => {
                    const remanenteSeleccionado = remanentesSeleccionados.find(r => r.mezcla_id === mezcla.id);
                    const modoActual = remanenteModos[mezcla.id] || 'ton';
                    const toneladasUsadas = remanenteSeleccionado ? parseFloat(remanenteSeleccionado.toneladas) : 0;
                    const paladasActuales = remanenteSeleccionado?.numero_paladas ?? '';
                    const tonDisponibles = parseFloat(mezcla.toneladas_disponibles);
                    const tonEstimadas = paladasActuales !== '' && parseFloat(paladasActuales) > 0
                      ? parseFloat(paladasActuales) * toneladas_por_palada
                      : 0;
                    const deltaPaladas = tonEstimadas - tonDisponibles;

                    return (
                      <tr
                        key={mezcla.id}
                        className={`border-b border-gray-200 hover:bg-orange-50 transition-all ${
                          (modoActual === 'ton' ? toneladasUsadas > 0 : paladasActuales !== '' && parseFloat(paladasActuales) > 0)
                            ? 'bg-orange-100'
                            : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-orange-900">{mezcla.codigo}</span>
                            {mezcla.ajuste_aplicado && (
                              <span
                                className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded"
                                title="Este remanente tiene un ajuste de toneladas aplicado"
                              >
                                AJUSTADO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-xs">{formatearFecha(mezcla.fecha)}</td>
                        <td className="py-2 px-2 text-xs font-semibold text-green-700">
                          {parseFloat(mezcla.toneladas_disponibles).toFixed(2)} t
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {mezcla.ley_prom_dump ? `${parseFloat(mezcla.ley_prom_dump).toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-2 px-2 text-xs text-orange-700 font-semibold">
                          {(() => {
                            // FÓRMULA: Ley Visual para remanentes = ley_prom_lote × 1.11
                            // NO revertir el factor 0.9, la fórmula trabaja con leyes ajustadas
                            const leyLote = parseFloat(mezcla.ley_prom_lote || 0);
                            const leyVisualCalculada = leyLote * factorRemanenteVisual; // × 1.11
                            return leyLote > 0 ? `${leyVisualCalculada.toFixed(2)}%` : '-';
                          })()}
                        </td>
                        <td className="py-2 px-2 text-xs text-blue-700 font-semibold">
                          {mezcla.ley_prom_lote ? `${parseFloat(mezcla.ley_prom_lote).toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-2 px-2">
                          {/* Toggle de modo */}
                          <div className="flex gap-1 mb-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (modoActual !== 'ton') {
                                  setRemanenteModos({ ...remanenteModos, [mezcla.id]: 'ton' });
                                  setRemanentesSeleccionados(remanentesSeleccionados.filter(r => r.mezcla_id !== mezcla.id));
                                }
                              }}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${modoActual === 'ton' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                              title="Ingresar toneladas directas"
                            >
                              Ton
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (modoActual !== 'paladas') {
                                  setRemanenteModos({ ...remanenteModos, [mezcla.id]: 'paladas' });
                                  setRemanentesSeleccionados(remanentesSeleccionados.filter(r => r.mezcla_id !== mezcla.id));
                                }
                              }}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${modoActual === 'paladas' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                              title="Ingresar número de paladas tomadas"
                            >
                              Paladas
                            </button>
                          </div>

                          {modoActual === 'ton' ? (
                            /* Modo toneladas: input directo */
                            <input
                              type="number"
                              min="0"
                              max={tonDisponibles}
                              step="0.01"
                              value={toneladasUsadas || ''}
                              onChange={(e) => {
                                const valor = parseFloat(e.target.value) || 0;
                                if (valor > tonDisponibles) {
                                  toast.warning('Toneladas excedidas', `Solo hay ${tonDisponibles.toFixed(2)} t disponibles en ${mezcla.codigo}`);
                                  return;
                                }
                                if (valor <= 0) {
                                  setRemanentesSeleccionados(remanentesSeleccionados.filter(r => r.mezcla_id !== mezcla.id));
                                } else {
                                  const existe = remanentesSeleccionados.find(r => r.mezcla_id === mezcla.id);
                                  if (existe) {
                                    setRemanentesSeleccionados(remanentesSeleccionados.map(r =>
                                      r.mezcla_id === mezcla.id ? { ...r, toneladas: valor, numero_paladas: undefined } : r
                                    ));
                                  } else {
                                    setRemanentesSeleccionados([...remanentesSeleccionados, { mezcla_id: mezcla.id, toneladas: valor }]);
                                  }
                                }
                              }}
                              className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                              placeholder="0.00"
                            />
                          ) : (
                            /* Modo paladas: input de paladas con preview */
                            <div className="flex flex-col gap-0.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={paladasActuales}
                                onChange={(e) => {
                                  const valor = parseInt(e.target.value) || 0;
                                  if (valor <= 0) {
                                    setRemanentesSeleccionados(remanentesSeleccionados.filter(r => r.mezcla_id !== mezcla.id));
                                  } else {
                                    const tonEst = Math.round(valor * toneladas_por_palada * 100) / 100;
                                    const existe = remanentesSeleccionados.find(r => r.mezcla_id === mezcla.id);
                                    if (existe) {
                                      setRemanentesSeleccionados(remanentesSeleccionados.map(r =>
                                        r.mezcla_id === mezcla.id ? { ...r, numero_paladas: valor, toneladas: tonEst } : r
                                      ));
                                    } else {
                                      setRemanentesSeleccionados([...remanentesSeleccionados, { mezcla_id: mezcla.id, numero_paladas: valor, toneladas: tonEst }]);
                                    }
                                  }
                                }}
                                className="w-20 px-2 py-1 border border-orange-400 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                                placeholder="# paladas"
                              />
                              {paladasActuales !== '' && parseFloat(paladasActuales) > 0 && (
                                <div className="text-[10px] leading-tight">
                                  <span className="text-gray-500">≈ {tonEstimadas.toFixed(2)} t</span>
                                  {' '}
                                  <span className={`font-bold ${deltaPaladas >= 0 ? 'text-amber-600' : 'text-blue-600'}`}
                                    title={deltaPaladas >= 0
                                      ? `${deltaPaladas.toFixed(2)} t estimadas de más (quedaron en el suelo)`
                                      : `${Math.abs(deltaPaladas).toFixed(2)} t menos que lo registrado`}
                                  >
                                    ({deltaPaladas >= 0 ? '+' : ''}{deltaPaladas.toFixed(2)} t)
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={async () => {
                              if (window.confirm(`¿Estás seguro de marcar ${mezcla.codigo} (${parseFloat(mezcla.toneladas_disponibles).toFixed(2)} t) como descarte?\n\nEsto hará que ya no aparezca en remanentes disponibles.`)) {
                                try {
                                  await mezclasService.marcarDescarte(mezcla.id);
                                  toast.success(
                                    'Remanente descartado',
                                    `${mezcla.codigo} marcado como descarte`
                                  );
                                  // Recargar remanentes
                                  const nuevosRemanentes = await mezclasService.getRemanentesDisponibles();
                                  setRemanentesDisponibles(nuevosRemanentes || []);
                                  // Remover de seleccionados si estaba
                                  setRemanentesSeleccionados(remanentesSeleccionados.filter(r => r.mezcla_id !== mezcla.id));
                                } catch (error) {
                                  toast.error(
                                    'Error al descartar',
                                    error.response?.data?.mensaje || error.message
                                  );
                                }
                              }
                            }}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                            title="Marcar como descarte (no utilizable)"
                          >
                            Descartar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {remanentesSeleccionados.length > 0 && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-orange-800">
                  Total remanentes: {remanentesSeleccionados.reduce((sum, r) => sum + parseFloat(r.toneladas), 0).toFixed(2)} t estimadas
                  ({remanentesSeleccionados.length} mezcla{remanentesSeleccionados.length !== 1 ? 's' : ''})
                  {remanentesSeleccionados.some(r => remanenteModos[r.mezcla_id] === 'paladas') && (
                    <span className="ml-2 text-amber-700 text-xs font-normal">
                      · {remanentesSeleccionados.filter(r => remanenteModos[r.mezcla_id] === 'paladas').length} por paladas
                    </span>
                  )}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Preview de la Mezcla - Solo aparece cuando hay acopios/dumpadas o remanentes seleccionados */}
        {((usarSistemaAcopios ? acopiosSeleccionados.length > 0 : dumpadasSeleccionadas.length > 0) || remanentesSeleccionados.length > 0) && (
          <Card className="mb-6 border-2 border-orange-500 bg-gradient-to-br from-orange-50 via-white to-blue-50 shadow-lg">
            {/* Header con título y botones */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
              <div>
                <h4 className="text-2xl font-bold text-orange-900 flex items-center gap-2">
                  <HiBeaker className="w-7 h-7" />
                  Nueva Mezcla
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Fecha: <span className="font-semibold">{new Date().toLocaleDateString('es-CL')}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="success"
                  icon={HiBeaker}
                  disabled={loading || !formDataMezcla.planta_id}
                  onClick={handleCrearMezcla}
                  className="shadow-md"
                >
                  {loading ? 'Creando...' : 'Crear Mezcla'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAcopiosSeleccionados([]);
                    setDumpadasSeleccionadas([]);
                    setRemanentesSeleccionados([]);
                    setLoteRemanenteSeleccionado('');
                    setFormDataMezcla({ ...formDataMezcla, planta_id: '', observaciones: '' });
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>

            {/* Configuración: Planta, Ley Base y Observaciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4 border-2 border-orange-200 shadow-sm">
                <label className="block text-sm font-bold text-orange-800 mb-2">
                  🏭 Planta Destino <span className="text-red-500">*</span>
                </label>
                <select
                  value={formDataMezcla.planta_id}
                  onChange={(e) => setFormDataMezcla({ ...formDataMezcla, planta_id: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                    formDataMezcla.planta_id
                      ? 'border-green-400 bg-green-50 text-green-800'
                      : 'border-orange-300 bg-orange-50 text-gray-700'
                  }`}
                >
                  <option value="">⚠️ Seleccionar planta...</option>
                  {plantas.map((planta) => (
                    <option key={planta.id} value={planta.id}>
                      {planta.nombre} {planta.prefijo_codigo && `(${planta.prefijo_codigo})`}
                    </option>
                  ))}
                </select>
                {!formDataMezcla.planta_id && (
                  <p className="text-xs text-orange-600 mt-1 font-medium">
                    Debes seleccionar una planta para crear la mezcla
                  </p>
                )}
              </div>

              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                <label className="block text-sm font-bold text-blue-800 mb-2">
                  ⚗️ Ley base para cálculos
                </label>
                <select
                  value={formDataMezcla.ley_base}
                  onChange={(e) => setFormDataMezcla({ ...formDataMezcla, ley_base: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-300 bg-blue-50 rounded-lg text-sm font-medium text-blue-900"
                >
                  <option value="auto">Auto (usar la fracción más alta)</option>
                  <option value="cu_insoluble">Cu Insoluble (sulfuro)</option>
                  <option value="cu_soluble">Cu Soluble (óxido)</option>
                  <option value="cu_total">Cu Total</option>
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  {formDataMezcla.ley_base === 'auto' && 'El sistema compara Cu Ins. vs Cu Sol. y usa la más alta'}
                  {formDataMezcla.ley_base === 'cu_insoluble' && 'Usa Cu Insoluble para ley_dump y ley_lote'}
                  {formDataMezcla.ley_base === 'cu_soluble' && 'Usa Cu Soluble para ley_dump y ley_lote'}
                  {formDataMezcla.ley_base === 'cu_total' && 'Usa Cu Total (comportamiento clásico)'}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📝 Observaciones (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Notas adicionales..."
                  value={formDataMezcla.observaciones}
                  onChange={(e) => setFormDataMezcla({ ...formDataMezcla, observaciones: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Resumen de totales */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
              <div className="bg-white rounded-xl p-3 border border-orange-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">
                  {usarSistemaAcopios ? 'Dumpadas' : 'Seleccionadas'}
                </p>
                <p className="text-2xl font-bold text-orange-700">{calcularTotalesMezcla().cantidadDumpadas}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-orange-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">Remanentes</p>
                <p className="text-2xl font-bold text-orange-700">{calcularTotalesMezcla().cantidadRemanentes}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-blue-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">Toneladas</p>
                <p className="text-2xl font-bold text-blue-700">{calcularTotalesMezcla().totalTon} t</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-amber-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">Ley Dumpada</p>
                <p className="text-2xl font-bold text-amber-600">{calcularTotalesMezcla().leyAjustada}%</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-green-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">Ley Visual</p>
                <p className="text-2xl font-bold text-green-700">{calcularTotalesMezcla().leyVisual}%</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-indigo-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">Ley Lote</p>
                <p className="text-2xl font-bold text-indigo-700">{calcularTotalesMezcla().leyLote}%</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-red-200 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium">Ley Lab</p>
                <p className="text-2xl font-bold text-red-700">{calcularTotalesMezcla().leyLab}%</p>
              </div>
            </div>

            {/* Tabla de acopios o dumpadas seleccionados */}
            <div className="bg-white rounded-lg border border-orange-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-orange-100 to-orange-50 px-4 py-2 border-b border-orange-200">
                <p className="text-sm font-bold text-orange-800">
                  📦 s ({usarSistemaAcopios ? 'Acopios' : 'Dumpadas'})
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">
                        {usarSistemaAcopios ? 'Código Acopio' : '# Dumpada'}
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Frente</th>
                      {usarSistemaAcopios && (
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Dumpadas</th>
                      )}
                      {!usarSistemaAcopios && (
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Jornada</th>
                      )}
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Ton</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Ley Lab</th>
                      {!usarSistemaAcopios && (
                        <>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Ley Dump</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Ley Lote</th>
                        </>
                      )}
                      <th className="text-center py-2 px-3 font-semibold text-gray-700">Quitar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usarSistemaAcopios ? (
                      // MODO ACOPIOS
                      calcularTotalesMezcla().acopiosDetalle.map((acopio, idx) => (
                        <tr key={acopio.id} className={`border-b border-gray-100 hover:bg-orange-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="py-2 px-3 font-mono font-bold text-orange-700">
                            {acopio.codigo_acopio}
                          </td>
                          <td className="py-2 px-3 text-gray-600">{acopio.frente_trabajo?.codigo_completo || acopio.nombre || 'Manual'}</td>
                          <td className="py-2 px-3 text-right font-semibold text-orange-600">{acopio.cantidad_dumpadas || 0}</td>
                          <td className="py-2 px-3 text-right font-semibold">{acopio.total_toneladas ? parseFloat(acopio.total_toneladas).toFixed(2) : '0.00'}</td>
                          <td className="py-2 px-3 text-right">{acopio.ley_promedio ? `${parseFloat(acopio.ley_promedio).toFixed(2)}%` : '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleSelectAcopio(acopio.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-colors"
                              title="Quitar de la mezcla"
                            >
                              <HiXMark className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      // MODO DUMPADAS DIRECTAS
                      dumpadasSeleccionadas.map(sel => {
                        const d = dumpadasDisponibles.find(x => x.id === sel.id);
                        if (!d) return null;
                        const tonAUsar = sel.numero_paladas != null
                          ? (sel.numero_paladas * (d.ton_por_palada || toneladas_por_palada)).toFixed(2)
                          : parseFloat(d.ton || 0).toFixed(2);
                        return { ...d, _tonAUsar: tonAUsar, _paladas: sel.numero_paladas };
                      }).filter(Boolean).map((dumpada, idx) => (
                        <tr key={dumpada.id} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">
                            #{dumpada.numero_dumpada}
                            {dumpada._paladas != null && (
                              <span className="ml-1 text-[10px] text-blue-500 font-normal">({dumpada._paladas} pal.)</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-600">{dumpada.frente_trabajo?.codigo_completo || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant={dumpada.jornada === 'AM' ? 'warning' : dumpada.jornada === 'PM' ? 'info' : 'default'} size="sm">
                              {dumpada.jornada}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">{dumpada._tonAUsar}</td>
                          <td className="py-2 px-3 text-right">
                            {parseFloat(dumpada.ley || dumpada.ley_visual || 0).toFixed(2)}%
                            {!dumpada.ley && dumpada.ley_visual && (
                              <span className="text-xs text-gray-500 ml-1">(vis)</span>
                            )}
                          </td>
                          {(() => {
                            // Espeja MezclaDumpada::desdeDumpada: usa cu_insoluble/cu_soluble si están disponibles
                            const cuIns = dumpada.cu_insoluble != null ? parseFloat(dumpada.cu_insoluble) : null;
                            const cuSol = dumpada.cu_soluble   != null ? parseFloat(dumpada.cu_soluble)   : null;
                            const tieneFraccion = cuIns !== null || cuSol !== null;
                            let leyLabRaw;
                            if (tieneFraccion) {
                              const leyBase = formDataMezcla.ley_base || 'auto';
                              if (leyBase === 'cu_insoluble') leyLabRaw = cuIns;
                              else if (leyBase === 'cu_soluble') leyLabRaw = cuSol;
                              else if (leyBase === 'cu_total') leyLabRaw = dumpada.ley ? parseFloat(dumpada.ley) : null;
                              else { // auto
                                const ins = cuIns ?? 0, sol = cuSol ?? 0;
                                leyLabRaw = ins >= sol ? (cuIns ?? (dumpada.ley ? parseFloat(dumpada.ley) : null))
                                                       : (cuSol ?? (dumpada.ley ? parseFloat(dumpada.ley) : null));
                              }
                            } else {
                              leyLabRaw = dumpada.ley ? parseFloat(dumpada.ley) : null;
                            }
                            const leyLab = leyLabRaw ? Math.min(leyLabRaw, leyCappingMaximo) : null;
                            const leyVisual = dumpada.ley_visual ? parseFloat(dumpada.ley_visual) : null;
                            let leyDump, leyLote;
                            if (leyLab) {
                              leyDump = leyLab * factorAjusteLey;
                              leyLote = leyLab * factorAjusteLey * factorAjusteLey;
                            } else if (leyVisual) {
                              leyDump = leyVisual;
                              leyLote = leyVisual * factorAjusteLey;
                            }
                            return (
                              <>
                                <td className="py-2 px-3 text-right text-orange-600 font-medium">
                                  {leyDump ? `${leyDump.toFixed(2)}%` : '-'}
                                </td>
                                <td className="py-2 px-3 text-right text-indigo-600 font-medium">
                                  {leyLote ? `${leyLote.toFixed(2)}%` : '-'}
                                </td>
                              </>
                            );
                          })()}
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleSelectDumpada(dumpada)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-colors"
                              title="Quitar de la mezcla"
                            >
                              <HiXMark className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla de remanentes seleccionados */}
            {remanentesSeleccionados.length > 0 && (
              <div className="bg-white rounded-lg border border-orange-200 overflow-hidden shadow-sm mt-4">
                <div className="bg-gradient-to-r from-orange-100 to-orange-50 px-4 py-2 border-b border-orange-200">
                  <p className="text-sm font-bold text-orange-800">🔄 Remanentes incluidos</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Código Mezcla</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Ton</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">Ley</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Quitar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remanentesSeleccionados.map((rem, idx) => {
                        const mezcla = remanentesDisponibles.find(m => m.id === rem.mezcla_id);
                        const modo = remanenteModos[rem.mezcla_id] || 'ton';
                        const esPaladas = modo === 'paladas' && rem.numero_paladas;
                        const tonDisp = mezcla ? parseFloat(mezcla.toneladas_disponibles) : 0;
                        const delta = esPaladas ? parseFloat(rem.toneladas) - tonDisp : null;
                        return (
                          <tr key={rem.mezcla_id} className={`border-b border-gray-100 hover:bg-orange-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="py-2 px-3 font-mono font-bold text-orange-700">
                              {mezcla?.codigo || `ID: ${rem.mezcla_id}`}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold">
                              {esPaladas ? (
                                <div className="leading-tight">
                                  <div>{rem.numero_paladas} pal</div>
                                  <div className="text-gray-500 text-[10px]">≈ {parseFloat(rem.toneladas).toFixed(2)} t</div>
                                  {delta !== null && (
                                    <div className={`text-[10px] font-bold ${delta >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                                      Δ {delta >= 0 ? '+' : ''}{delta.toFixed(2)} t
                                    </div>
                                  )}
                                </div>
                              ) : (
                                parseFloat(rem.toneladas).toFixed(2)
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">{mezcla?.ley_prom_dump ? `${parseFloat(mezcla.ley_prom_dump).toFixed(2)}%` : '-'}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => {
                                  setRemanentesSeleccionados(remanentesSeleccionados.filter(r => r.mezcla_id !== rem.mezcla_id));
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-colors"
                                title="Quitar remanente"
                              >
                                <HiXMark className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {loteRemanenteSeleccionado && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2 text-sm text-orange-700">
                + Remanente de lote seleccionado (legacy)
              </div>
            )}
          </Card>
        )}
        </>)}

      {/* Historial de Mezclas — solo visible en tab historial */}
      {vistaTab === 'historial' && (
      <Card className="border-l-4 border-orange-400 mt-6 pb-20">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            📦 Historial de Mezclas
            {histTotal > 0 && (
              <span className="text-sm font-normal text-gray-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                {histTotal} total
              </span>
            )}
          </h3>
        </div>

        {/* Filtros */}
        {(() => {
          const hayFiltros = histSearch || histEstado || histFechaDesde || histFechaHasta;
          const aplicar = () => cargarHistorial(1, histSearch, histPerPage, histEstado, histFechaDesde, histFechaHasta);
          const limpiar = () => {
            setHistSearch('');
            setHistEstado('');
            setHistFechaDesde('');
            setHistFechaHasta('');
            cargarHistorial(1, '', histPerPage, '', '', '');
          };
          const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-shadow placeholder-gray-400";
          const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1";
          return (
            <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-white p-4 mb-5 shadow-sm">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Código */}
                <div className="flex-1 min-w-[130px]">
                  <label className={labelCls}>Código</label>
                  <input
                    type="text"
                    value={histSearch}
                    onChange={e => setHistSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && aplicar()}
                    placeholder="Ej: MZ-001…"
                    className={inputCls}
                  />
                </div>

                {/* Estado */}
                <div className="flex-1 min-w-[140px]">
                  <label className={labelCls}>Estado</label>
                  <select value={histEstado} onChange={e => setHistEstado(e.target.value)} className={inputCls}>
                    <option value="">Todos los estados</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="En Despacho">En Despacho</option>
                    <option value="Despachado">Despachado</option>
                  </select>
                </div>

                {/* Fechas */}
                <div className="flex-1 min-w-[120px]">
                  <label className={labelCls}>Desde</label>
                  <input type="date" value={histFechaDesde} onChange={e => setHistFechaDesde(e.target.value)} className={inputCls} />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className={labelCls}>Hasta</label>
                  <input type="date" value={histFechaHasta} onChange={e => setHistFechaHasta(e.target.value)} className={inputCls} />
                </div>

                {/* Botones */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={aplicar}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all"
                  >
                    Buscar
                  </button>
                  {hayFiltros && (
                    <button
                      onClick={limpiar}
                      className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-orange-600 bg-white border border-gray-200 hover:border-orange-300 rounded-lg transition-all"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Pills de filtros activos */}
              {hayFiltros && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-orange-100">
                  {histSearch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                      Código: {histSearch}
                      <button onClick={() => { setHistSearch(''); cargarHistorial(1, '', histPerPage, histEstado, histFechaDesde, histFechaHasta); }} className="hover:text-orange-900 ml-0.5">×</button>
                    </span>
                  )}
                  {histEstado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                      {histEstado}
                      <button onClick={() => { setHistEstado(''); cargarHistorial(1, histSearch, histPerPage, '', histFechaDesde, histFechaHasta); }} className="hover:text-orange-900 ml-0.5">×</button>
                    </span>
                  )}
                  {histFechaDesde && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                      Desde: {histFechaDesde}
                      <button onClick={() => { setHistFechaDesde(''); cargarHistorial(1, histSearch, histPerPage, histEstado, '', histFechaHasta); }} className="hover:text-orange-900 ml-0.5">×</button>
                    </span>
                  )}
                  {histFechaHasta && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                      Hasta: {histFechaHasta}
                      <button onClick={() => { setHistFechaHasta(''); cargarHistorial(1, histSearch, histPerPage, histEstado, histFechaDesde, ''); }} className="hover:text-orange-900 ml-0.5">×</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {histLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-200 border-t-orange-500 mx-auto" />
            <p className="text-gray-400 text-sm mt-3">Cargando historial…</p>
          </div>
        ) : historial.length === 0 ? (
          (() => {
            const hayFiltros = histSearch || histEstado || histFechaDesde || histFechaHasta;
            return (
              <div className="text-center py-12">
                <HiCube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">
                  {hayFiltros ? 'Sin resultados con los filtros aplicados' : 'No hay mezclas registradas'}
                </p>
                <p className="text-gray-400 text-sm">
                  {hayFiltros ? 'Prueba ajustando o limpiando los filtros' : 'Crea tu primera mezcla en la pestaña Crear Mezcla'}
                </p>
              </div>
            );
          })()
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white text-xs uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-left font-semibold">Código</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Total Ton</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Ton. Disp.</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Ley Prom</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Estado</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historial.map((mezcla) => {
                    const estadoColor =
                      mezcla.estado === 'Despachado'  ? 'bg-green-100 text-green-700 border-green-200' :
                      mezcla.estado === 'En Despacho' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                      'bg-blue-100 text-blue-700 border-blue-200';
                    const dispPct = mezcla.total_ton > 0
                      ? Math.round((mezcla.toneladas_disponibles / mezcla.total_ton) * 100)
                      : 0;
                    return (
                      <tr key={mezcla.id} className="hover:bg-orange-50/50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-orange-800">{mezcla.codigo}</td>
                        <td className="py-2 px-3 text-xs text-gray-500 tabular-nums">{formatearFecha(mezcla.fecha)}</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-gray-800">
                          {parseFloat(mezcla.total_ton).toFixed(2)} <span className="text-gray-400 font-normal">t</span>
                        </td>
                        <td className="py-2 px-3 text-right text-xs tabular-nums">
                          <span className={`font-semibold ${dispPct < 20 ? 'text-red-500' : dispPct < 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {parseFloat(mezcla.toneladas_disponibles ?? 0).toFixed(2)} t
                          </span>
                          <span className="text-gray-300 ml-1">({dispPct}%)</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {mezcla.ley_prom_dump
                            ? <span className="font-semibold text-orange-700 tabular-nums">{parseFloat(mezcla.ley_prom_dump).toFixed(3)}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${estadoColor}`}>
                            {mezcla.estado}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleVerDetalleMezcla(mezcla.id)}
                              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                              title="Ver Detalle"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEliminarMezcla(mezcla.id, mezcla.codigo)}
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
                              title="Eliminar"
                            >
                              <HiTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer paginación — solo si hay más de una página o más de 20 */}
            {(histLastPage > 1 || histTotal > 20) && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Por página:</span>
                  {[20, 50, 100].map(n => (
                    <button
                      key={n}
                      onClick={() => { setHistPerPage(n); cargarHistorial(1, histSearch, n); }}
                      className={`w-8 h-7 rounded font-semibold transition-colors ${histPerPage === n ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}
                    >
                      {n}
                    </button>
                  ))}
                  {histTotal > 0 && (
                    <span className="ml-2 text-gray-400 tabular-nums">
                      {((histPagina - 1) * histPerPage) + 1}–{Math.min(histPagina * histPerPage, histTotal)} de {histTotal}
                    </span>
                  )}
                </div>

                {histLastPage > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => cargarHistorial(histPagina - 1)}
                      disabled={histPagina === 1}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ‹
                    </button>
                    {(() => {
                      const total = histLastPage, cur = histPagina;
                      let pages = total <= 7
                        ? [...Array(total)].map((_, i) => i + 1)
                        : cur <= 4 ? [1,2,3,4,5,'…',total]
                        : cur >= total - 3 ? [1,'…',total-4,total-3,total-2,total-1,total]
                        : [1,'…',cur-1,cur,cur+1,'…',total];
                      return pages.map((p, i) =>
                        p === '…'
                          ? <span key={`d${i}`} className="px-1 text-gray-400 text-xs">…</span>
                          : <button key={p} onClick={() => cargarHistorial(p)}
                              className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${cur === p ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                              {p}
                            </button>
                      );
                    })()}
                    <button
                      onClick={() => cargarHistorial(histPagina + 1)}
                      disabled={histPagina === histLastPage}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>
      )}

      {/* ── Panel: Mezclas con tonelaje disponible ── */}
      {(() => {
        const dispLastPage = Math.ceil(mezclasDisponibles.length / dispPerPage) || 1;
        const dispSlice = mezclasDisponibles.slice((dispPagina - 1) * dispPerPage, dispPagina * dispPerPage);
        return (
          <Card className="border-l-4 border-purple-400 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Mezclas con tonelaje disponible
                {mezclasDisponibles.length > 0 && (
                  <span className="text-xs font-normal bg-purple-50 border border-purple-200 text-purple-600 px-2 py-0.5 rounded-full">
                    {mezclasDisponibles.length}
                  </span>
                )}
              </h3>
              <button
                onClick={() => { setDispPagina(1); cargarMezclasDisponibles(); }}
                className="text-xs text-purple-500 hover:text-purple-700 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
              >
                ↻ Actualizar
              </button>
            </div>
            {mezclasDispLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-7 w-7 border-4 border-purple-100 border-t-purple-500 mx-auto" />
              </div>
            ) : mezclasDisponibles.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay mezclas con tonelaje disponible</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-purple-50 text-purple-700 text-xs uppercase tracking-wide">
                        <th className="py-2 px-3 text-left font-semibold">Código</th>
                        <th className="py-2 px-3 text-left font-semibold">Fecha</th>
                        <th className="py-2 px-3 text-right font-semibold">Total</th>
                        <th className="py-2 px-3 text-right font-semibold">Disponible</th>
                        <th className="py-2 px-3 text-right font-semibold">Despachado</th>
                        <th className="py-2 px-3 text-center font-semibold">Ley</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dispSlice.map(m => {
                        const pct = m.total_ton > 0 ? Math.round((m.toneladas_disponibles / m.total_ton) * 100) : 0;
                        return (
                          <tr key={m.id} className="hover:bg-purple-50/40 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-purple-800">{m.codigo}</td>
                            <td className="py-2 px-3 text-xs text-gray-500 tabular-nums">{formatearFecha(m.fecha)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                              {parseFloat(m.total_ton).toFixed(2)} <span className="text-gray-400">t</span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              <span className={`font-semibold ${pct < 20 ? 'text-red-500' : pct < 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {parseFloat(m.toneladas_disponibles).toFixed(2)} t
                              </span>
                              <span className="text-gray-300 text-xs ml-1">({pct}%)</span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-500 text-xs">
                              {parseFloat(m.toneladas_despachadas ?? 0).toFixed(2)} t
                            </td>
                            <td className="py-2 px-3 text-center">
                              {m.ley_lab
                                ? <span className="font-semibold text-purple-700 tabular-nums">{parseFloat(m.ley_lab).toFixed(3)}%</span>
                                : m.ley_visual
                                ? <span className="font-semibold text-yellow-600 tabular-nums">{parseFloat(m.ley_visual).toFixed(3)}% <span className="text-gray-400 font-normal text-xs">vis</span></span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación — solo si hay más de una página */}
                {dispLastPage > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400 tabular-nums">
                      {((dispPagina - 1) * dispPerPage) + 1}–{Math.min(dispPagina * dispPerPage, mezclasDisponibles.length)} de {mezclasDisponibles.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDispPagina(p => Math.max(1, p - 1))}
                        disabled={dispPagina === 1}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >‹</button>
                      {(() => {
                        const total = dispLastPage, cur = dispPagina;
                        const pages = total <= 7
                          ? [...Array(total)].map((_, i) => i + 1)
                          : cur <= 4 ? [1,2,3,4,5,'…',total]
                          : cur >= total - 3 ? [1,'…',total-4,total-3,total-2,total-1,total]
                          : [1,'…',cur-1,cur,cur+1,'…',total];
                        return pages.map((p, i) =>
                          p === '…'
                            ? <span key={`d${i}`} className="px-1 text-gray-400 text-xs">…</span>
                            : <button key={p} onClick={() => setDispPagina(p)}
                                className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${cur === p ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                {p}
                              </button>
                        );
                      })()}
                      <button
                        onClick={() => setDispPagina(p => Math.min(dispLastPage, p + 1))}
                        disabled={dispPagina === dispLastPage}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >›</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })()}

      {/* Modal de detalle de mezcla */}
      {mezclaSeleccionada && (
        <div className="fixed inset-0 bg-transparent bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del modal con gradiente */}
            <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                  <HiBeaker className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    Mezcla {mezclaSeleccionada.codigo}
                  </h3>
                  <p className="text-orange-100 text-sm mt-1">
                    {formatearFecha(mezclaSeleccionada.fecha)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {mezclaSeleccionada.estado !== 'Despachado' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAbrirAgregarDumpadas}
                    disabled={loading}
                    className="bg-white text-orange-600 hover:bg-orange-50 border-2 border-white"
                  >
                    + Agregar Dumpadas
                  </Button>
                )}
                {/* Botón de ajuste de toneladas - solo si hay despachos y no se ha aplicado ajuste */}
                {mezclaSeleccionada.toneladas_despachadas > 0 && !mezclaSeleccionada.ajuste_aplicado && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAbrirModalAjuste}
                    disabled={loading}
                    className="bg-amber-500 text-white hover:bg-amber-600 border-2 border-amber-400"
                    title="Ajustar toneladas según inventario real"
                  >
                    ⚖️ Ajustar Toneladas
                  </Button>
                )}
                {/* Botón de revertir ajuste - solo si ya se aplicó ajuste */}
                {mezclaSeleccionada.ajuste_aplicado && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleAbrirModalRevertir}
                    disabled={loading}
                    className="bg-red-500 text-white hover:bg-red-600 border-2 border-red-400"
                    title="Revertir el ajuste aplicado"
                  >
                    🔄 Revertir Ajuste
                  </Button>
                )}
                <button
                  onClick={() => setMezclaSeleccionada(null)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                  title="Cerrar"
                >
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Contenido scrolleable */}
            <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6 bg-gray-50">
              {/* Indicador de Remanente */}
              {mezclaSeleccionada.es_remanente && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                    <HiCube className="w-5 h-5" />
                    Esta mezcla es un remanente
                    {mezclaSeleccionada.mezcla_origen && (
                      <span className="text-xs"> - Origen: {mezclaSeleccionada.mezcla_origen.codigo}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Indicador de Ajuste Aplicado */}
              {mezclaSeleccionada.ajuste_aplicado && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-600 p-4 rounded-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="text-amber-700 mt-0.5">⚖️</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-2">
                        Ajuste de Toneladas Aplicado
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-amber-600 font-semibold">Original:</span>
                          <p className="font-bold text-amber-900">{parseFloat(mezclaSeleccionada.total_ton_original || 0).toFixed(2)} t</p>
                        </div>
                        <div>
                          <span className="text-amber-600 font-semibold">Ajustado:</span>
                          <p className="font-bold text-amber-900">{parseFloat(mezclaSeleccionada.total_ton || 0).toFixed(2)} t</p>
                        </div>
                        <div>
                          <span className="text-amber-600 font-semibold">Diferencia:</span>
                          <p className={`font-bold ${mezclaSeleccionada.ajuste_toneladas >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {mezclaSeleccionada.ajuste_toneladas > 0 ? '+' : ''}{parseFloat(mezclaSeleccionada.ajuste_toneladas || 0).toFixed(2)} t
                          </p>
                        </div>
                        <div>
                          <span className="text-amber-600 font-semibold">Fecha:</span>
                          <p className="font-bold text-amber-900">
                            {mezclaSeleccionada.fecha_ajuste ? formatearFecha(mezclaSeleccionada.fecha_ajuste) : '-'}
                          </p>
                        </div>
                      </div>
                      {mezclaSeleccionada.motivo_ajuste && (
                        <div className="mt-2 text-xs">
                          <span className="text-amber-600 font-semibold">Motivo:</span>
                          <p className="text-amber-800 italic mt-1">{mezclaSeleccionada.motivo_ajuste}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tarjetas de resumen principal */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Total Toneladas */}
                <div className="bg-white rounded-xl shadow-md p-4 border-t-4 border-orange-500">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {parseFloat(mezclaSeleccionada.total_ton).toFixed(2)}
                    <span className="text-sm text-gray-500 ml-1">t</span>
                  </p>
                </div>

                {/* Disponibles */}
                <div className="bg-white rounded-xl shadow-md p-4 border-t-4 border-green-500">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Disponibles</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {mezclaSeleccionada.toneladas_disponibles
                      ? parseFloat(mezclaSeleccionada.toneladas_disponibles).toFixed(2)
                      : parseFloat(mezclaSeleccionada.total_ton).toFixed(2)}
                    <span className="text-sm text-gray-500 ml-1">t</span>
                  </p>
                </div>

                {/* Despachadas */}
                <div className="bg-white rounded-xl shadow-md p-4 border-t-4 border-blue-500">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Despachadas</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {mezclaSeleccionada.toneladas_despachadas
                      ? parseFloat(mezclaSeleccionada.toneladas_despachadas).toFixed(2)
                      : '0.00'}
                    <span className="text-sm text-gray-500 ml-1">t</span>
                  </p>
                </div>

                {/* Dumpadas */}
                <div className="bg-white rounded-xl shadow-md p-4 border-t-4 border-indigo-500">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Componentes</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">
                    {mezclaSeleccionada.detalles?.length || 0}
                  </p>
                </div>
              </div>

              {/* Tarjetas de leyes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg shadow p-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Ley Dump</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">
                    {mezclaSeleccionada.ley_prom_dump ? `${parseFloat(mezclaSeleccionada.ley_prom_dump).toFixed(2)}%` : '-'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Ley Visual</p>
                  <p className="text-xl font-bold text-cyan-600 mt-1">
                    {mezclaSeleccionada.ley_prom_visual ? `${parseFloat(mezclaSeleccionada.ley_prom_visual).toFixed(2)}%` : '-'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Ley Lote</p>
                  <p className="text-xl font-bold text-indigo-600 mt-1">
                    {mezclaSeleccionada.ley_prom_lote ? `${parseFloat(mezclaSeleccionada.ley_prom_lote).toFixed(2)}%` : '-'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Ley Lab</p>
                  <p className="text-xl font-bold text-rose-600 mt-1">
                    {mezclaSeleccionada.ley_prom_lote
                      ? `${(parseFloat(mezclaSeleccionada.ley_prom_lote) / (factorAjusteLey * factorAjusteLey)).toFixed(2)}%`
                      : '-'}
                  </p>
                </div>
              </div>

              {mezclaSeleccionada.detalles && mezclaSeleccionada.detalles.length > 0 && (
                <div className="bg-white rounded-xl shadow-md">
                  {/* Header colapsable */}
                  <button
                    onClick={() => setMostrarComposicion(!mostrarComposicion)}
                    className="w-full bg-gradient-to-r from-indigo-500 to-orange-600 px-5 py-3 flex items-center justify-between rounded-t-xl hover:from-indigo-600 hover:to-orange-700 transition-all"
                  >
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <HiCube className="w-5 h-5" />
                      Composición ({mezclaSeleccionada.detalles.length} componentes)
                    </h4>
                    {mostrarComposicion
                      ? <HiChevronUp className="w-5 h-5 text-white" />
                      : <HiChevronDown className="w-5 h-5 text-white" />
                    }
                  </button>

                  {/* Tabla colapsable */}
                  {mostrarComposicion && (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto bg-gradient-to-r from-indigo-50 to-orange-50 border-b-2 border-indigo-200">
                    {(() => {
                      // Separar dumpadas y remanentes
                      const dumps = (mezclaSeleccionada.detalles || []).filter(d => d.tipo === 'DUMP');
                      const rems  = (mezclaSeleccionada.detalles || []).filter(d => d.tipo !== 'DUMP');

                      // Ordenar dumps por fecha (formato dd-mm-yyyy del backend)
                      const parseFecha = (s) => {
                        if (!s) return null;
                        const p = String(s).split('-');
                        return p.length === 3 ? new Date(`${p[2]}-${p[1]}-${p[0]}`) : new Date(s);
                      };
                      const dumpsOrdenados = [...dumps].sort((a, b) => {
                        const fa = parseFecha(a.dumpada?.fecha);
                        const fb = parseFecha(b.dumpada?.fecha);
                        if (!fa && !fb) return 0;
                        if (!fa) return 1;
                        if (!fb) return -1;
                        return fa - fb;
                      });

                      // Agrupar dumps por fecha
                      const porFecha = new Map();
                      for (const d of dumpsOrdenados) {
                        const k = d.dumpada?.fecha ?? 'Sin fecha';
                        if (!porFecha.has(k)) porFecha.set(k, []);
                        porFecha.get(k).push(d);
                      }

                      const colCount = mezclaSeleccionada.estado !== 'Despachado' ? 8 : 7;

                      const FilaDetalle = ({ detalle, bg }) => (
                        <tr className={`border-b border-gray-200 ${bg}`}>
                          <td className="py-2 px-3 text-xs font-mono text-blue-700">
                            {detalle.origen || detalle.dumpada?.acopios || '-'}
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold text-right tabular-nums">
                            {parseFloat(detalle.toneladas).toFixed(2)} t
                          </td>
                          <td className="py-2 px-3 text-xs text-right tabular-nums">
                            {detalle.ley_dump_ajustada ? `${parseFloat(detalle.ley_dump_ajustada).toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-xs text-right tabular-nums">
                            {detalle.ley_visual ? `${(parseFloat(detalle.ley_visual) * factorAjusteLey).toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-xs text-right tabular-nums">
                            {detalle.ley_lote ? `${parseFloat(detalle.ley_lote).toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-xs text-right tabular-nums">
                            {(() => {
                              const leyLote = parseFloat(detalle.ley_lote || 0);
                              const leyLab = leyLote / (factorAjusteLey * factorAjusteLey);
                              return leyLote > 0 ? `${leyLab.toFixed(2)}%` : '-';
                            })()}
                          </td>
                          {mezclaSeleccionada.estado !== 'Despachado' && (
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleEliminarDetalleMezcla(detalle.id, detalle.origen || detalle.dumpada?.acopios)}
                                disabled={loading}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors text-xs disabled:opacity-50"
                                title="Eliminar de la mezcla"
                              >
                                <HiTrash className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );

                      return (
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-indigo-100 shadow-sm">
                              <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs">Acopios / Origen</th>
                              <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Toneladas</th>
                              <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Ley Dump</th>
                              <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Ley Visual</th>
                              <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Ley Lote</th>
                              <th className="text-right py-3 px-3 font-bold text-blue-900 text-xs">Ley Lab</th>
                              {mezclaSeleccionada.estado !== 'Despachado' && (
                                <th className="text-center py-3 px-3 font-bold text-blue-900 text-xs">Eliminar</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {/* ── Dumpadas agrupadas por fecha ── */}
                            {dumps.length > 0 && (
                              <tr className="bg-green-50 border-t-2 border-green-300">
                                <td colSpan={colCount} className="py-1.5 px-3 text-xs font-bold text-green-800 uppercase tracking-wide">
                                  Dumpadas ({dumps.length})
                                </td>
                              </tr>
                            )}
                            {[...porFecha.entries()].map(([fecha, detalles]) => {
                              const tonFecha = detalles.reduce((s, d) => s + parseFloat(d.toneladas || 0), 0);
                              return (
                                <>
                                  <tr key={`fecha-${fecha}`} className="bg-blue-50 border-t border-blue-200">
                                    <td colSpan={colCount} className="py-1.5 px-4">
                                      <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                                        <HiCalendar className="w-3.5 h-3.5 flex-shrink-0" />
                                        {fecha}
                                        <span className="font-normal text-blue-400 ml-1">
                                          · {detalles.length} dumpada{detalles.length !== 1 ? 's' : ''} · {tonFecha.toFixed(2)} t
                                        </span>
                                      </span>
                                    </td>
                                  </tr>
                                  {detalles.map((d, i) => (
                                    <FilaDetalle key={d.id} detalle={d} bg={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} />
                                  ))}
                                </>
                              );
                            })}

                            {/* ── Remanentes ── */}
                            {rems.length > 0 && (
                              <>
                                <tr className="bg-orange-50 border-t-2 border-orange-300">
                                  <td colSpan={colCount} className="py-1.5 px-3 text-xs font-bold text-orange-800 uppercase tracking-wide">
                                    Remanentes ({rems.length})
                                  </td>
                                </tr>
                                {rems.map((d, i) => (
                                  <FilaDetalle key={d.id} detalle={d} bg={i % 2 === 0 ? 'bg-orange-50/30' : 'bg-white'} />
                                ))}
                              </>
                            )}
                            {/* Fila de totales */}
                            <tr className="bg-gradient-to-r from-indigo-100 via-orange-100 to-pink-100 border-t-4 border-indigo-400 font-bold">
                              <td className="py-4 px-4 text-sm text-indigo-900">
                                <div className="flex items-center gap-2">
                                  <HiBeaker className="w-5 h-5" />
                                  TOTALES DE LA MEZCLA
                                </div>
                              </td>
                              <td className="py-4 px-4 text-base text-indigo-900 text-right font-extrabold">
                                {mezclaSeleccionada.detalles.reduce((sum, d) => sum + parseFloat(d.toneladas || 0), 0).toFixed(2)} t
                              </td>
                              <td className="py-4 px-4 text-sm text-indigo-900 text-right font-bold">
                                {mezclaSeleccionada.ley_prom_dump ? `${parseFloat(mezclaSeleccionada.ley_prom_dump).toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-4 px-4 text-sm text-indigo-900 text-right font-bold">
                                {mezclaSeleccionada.ley_prom_visual ? `${parseFloat(mezclaSeleccionada.ley_prom_visual).toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-4 px-4 text-sm text-indigo-900 text-right font-bold">
                                {mezclaSeleccionada.ley_prom_lote ? `${parseFloat(mezclaSeleccionada.ley_prom_lote).toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-4 px-4 text-sm text-indigo-900 text-right font-bold">
                                {mezclaSeleccionada.ley_prom_lote
                                  ? `${(parseFloat(mezclaSeleccionada.ley_prom_lote) / (factorAjusteLey * factorAjusteLey)).toFixed(2)}%`
                                  : '-'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setMezclaSeleccionada(null)}
                className="shadow-sm hover:shadow-md transition-all"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar dumpadas a mezcla existente */}
      {modoAgregarDumpadas && mezclaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-5xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Agregar Dumpadas a Mezcla {mezclaSeleccionada.codigo}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Selecciona dumpadas e indica cuántas paladas incluir. Las paladas parciales permiten distribuir una dumpada entre varias mezclas.
                </p>
              </div>
              <button
                onClick={handleCerrarAgregarDumpadas}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Resumen de selección */}
            {dumpadasAgregar.length > 0 && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-800">
                  {dumpadasAgregar.length} dumpada(s) seleccionada(s) —{' '}
                  Toneladas estimadas:{' '}
                  {dumpadasAgregar.reduce((sum, d) => {
                    const dump = dumpadasDisponibles.find(x => x.id === d.id);
                    if (!dump) return sum;
                    if (d.numero_paladas != null) {
                      return sum + (d.numero_paladas * (dump.ton_por_palada || toneladas_por_palada));
                    }
                    return sum + parseFloat(dump.ton || 0);
                  }, 0).toFixed(2)} t
                </p>
              </div>
            )}

            {/* Filtro y contador */}
            {(() => {
              const perPageAgregar2 = 20;

              const filtradas = dumpadasDisponibles.filter(d => {
                if (!searchAgregar) return true;
                const search = searchAgregar.toLowerCase();
                return (
                  String(d.numero_dumpada || '').toLowerCase().includes(search) ||
                  String(d.acopios || '').toLowerCase().includes(search) ||
                  String(d.frente_trabajo?.codigo_completo || '').toLowerCase().includes(search) ||
                  String(d.fecha || '').includes(search)
                );
              });

              const totalPages = Math.ceil(filtradas.length / perPageAgregar2);
              const paginadas = filtradas.slice((pageAgregar - 1) * perPageAgregar2, pageAgregar * perPageAgregar2);

              return (
                <>
                  <div className="mb-3 flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Buscar por N° dumpada, acopio, frente, fecha..."
                      value={searchAgregar}
                      onChange={(e) => { setSearchAgregar(e.target.value); setPageAgregar(1); }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="text-sm text-gray-600 whitespace-nowrap">
                      {dumpadasAgregar.length} seleccionadas de {filtradas.length}
                    </p>
                  </div>

                  {filtradas.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600">
                        {searchAgregar ? 'No se encontraron dumpadas con ese filtro' : 'No hay dumpadas disponibles para agregar'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto mb-4">
                      <div className="max-h-[420px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gradient-to-r from-green-50 to-green-100 sticky top-0">
                            <tr className="border-b-2 border-green-200">
                              <th className="text-center py-2 px-2 font-bold text-green-900 text-xs w-10">
                                <input
                                  type="checkbox"
                                  onChange={() => {
                                    const filtradasIds = filtradas.map(d => d.id);
                                    const todasSeleccionadas = filtradasIds.every(id => dumpadasAgregar.some(d => d.id === id));
                                    if (todasSeleccionadas) {
                                      setDumpadasAgregar(dumpadasAgregar.filter(d => !filtradasIds.includes(d.id)));
                                    } else {
                                      const nuevas = filtradas
                                        .filter(d => !dumpadasAgregar.some(da => da.id === d.id))
                                        .map(d => ({
                                          id: d.id,
                                          numero_paladas: null
                                        }));
                                      setDumpadasAgregar([...dumpadasAgregar, ...nuevas]);
                                    }
                                  }}
                                  checked={filtradas.length > 0 && filtradas.every(d => dumpadasAgregar.some(da => da.id === d.id))}
                                  className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                                />
                              </th>
                              <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">N° Dump</th>
                              <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Acopios</th>
                              <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Frente</th>
                              <th className="text-left py-2 px-2 font-bold text-green-900 text-xs">Fecha</th>
                              <th className="text-right py-2 px-2 font-bold text-green-900 text-xs">Ton total</th>
                              <th className="text-center py-2 px-2 font-bold text-green-900 text-xs">Paladas disp.</th>
                              <th className="text-center py-2 px-2 font-bold text-green-900 text-xs">Paladas a usar</th>
                              <th className="text-right py-2 px-2 font-bold text-green-900 text-xs">Ton a usar</th>
                              <th className="text-right py-2 px-2 font-bold text-green-900 text-xs">Ley</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginadas.map((dumpada, index) => {
                              const seleccionada = dumpadasAgregar.find(d => d.id === dumpada.id);
                              const estaSeleccionada = !!seleccionada;
                              const tonPalada = dumpada.ton_por_palada || toneladas_por_palada;
                              const paladasDisp = dumpada.paladas_disponibles ?? (dumpada.ton / tonPalada);
                              const numeroPaladas = seleccionada?.numero_paladas ?? null;
                              const tonAUsar = numeroPaladas != null
                                ? (numeroPaladas * tonPalada).toFixed(2)
                                : parseFloat(dumpada.ton || 0).toFixed(2);

                              return (
                                <tr
                                  key={dumpada.id}
                                  className={`border-b border-gray-200 hover:bg-green-50 transition-all ${estaSeleccionada ? 'bg-green-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                >
                                  <td className="py-2 px-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={estaSeleccionada}
                                      onChange={() => handleToggleDumpadaAgregar(dumpada)}
                                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                  </td>
                                  <td
                                    className="py-2 px-2 font-mono font-bold text-gray-800 text-xs cursor-pointer"
                                    onClick={() => handleToggleDumpadaAgregar(dumpada)}
                                  >
                                    #{dumpada.numero_dumpada}
                                    {dumpada.tiene_uso_parcial && (
                                      <span className="ml-1 px-1 py-0.5 bg-amber-100 text-amber-700 text-[9px] rounded border border-amber-300 font-normal">
                                        parcial
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 font-mono text-xs text-blue-700">
                                    {dumpada.acopios || '-'}
                                  </td>
                                  <td className="py-2 px-2 text-xs">
                                    {dumpada.frente_trabajo?.codigo_completo || '-'}
                                  </td>
                                  <td className="py-2 px-2 text-xs">
                                    {formatearFecha(dumpada.fecha)}
                                  </td>
                                  <td className="py-2 px-2 text-xs font-semibold text-right">
                                    {parseFloat(dumpada.ton).toFixed(2)} t
                                  </td>
                                  {/* Paladas disponibles */}
                                  <td className="py-2 px-2 text-xs text-center">
                                    {dumpada.paladas_disponibles != null ? (
                                      <span className={`font-semibold ${dumpada.tiene_uso_parcial ? 'text-amber-600' : 'text-green-700'}`}>
                                        {parseFloat(dumpada.paladas_disponibles).toFixed(1)} / {dumpada.paladas_totales}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  {/* Input de paladas a usar */}
                                  <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    {estaSeleccionada ? (
                                      <input
                                        type="number"
                                        min="0.5"
                                        max={parseFloat(paladasDisp)}
                                        step="0.5"
                                        value={numeroPaladas ?? ''}
                                        placeholder="Todas"
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                          if (val !== null && val > parseFloat(paladasDisp)) {
                                            toast.warning('Paladas excedidas', `Máximo ${parseFloat(paladasDisp).toFixed(1)} paladas disponibles`);
                                            return;
                                          }
                                          handleSetPaladasAgregar(dumpada.id, val);
                                        }}
                                        className="w-20 px-1 py-1 border border-green-300 rounded text-xs text-center focus:ring-1 focus:ring-green-500"
                                      />
                                    ) : (
                                      <span className="text-gray-300 text-xs">-</span>
                                    )}
                                  </td>
                                  {/* Toneladas a usar */}
                                  <td className="py-2 px-2 text-xs font-semibold text-right text-green-700">
                                    {estaSeleccionada ? `${tonAUsar} t` : <span className="text-gray-300">-</span>}
                                  </td>
                                  <td className="py-2 px-2 text-xs text-right">
                                    {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(2)}%` : dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(2)}% (vis)` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Paginacion */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-3 px-1">
                          <p className="text-xs text-gray-500">
                            Pagina {pageAgregar} de {totalPages} ({filtradas.length} dumpadas)
                          </p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPageAgregar(Math.max(1, pageAgregar - 1))}
                              disabled={pageAgregar === 1}
                              className="px-3 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anterior
                            </button>
                            <button
                              onClick={() => setPageAgregar(Math.min(totalPages, pageAgregar + 1))}
                              disabled={pageAgregar === totalPages}
                              className="px-3 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Siguiente
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={handleCerrarAgregarDumpadas}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleAgregarDumpadasAMezcla}
                disabled={loading || dumpadasAgregar.length === 0}
              >
                {loading ? 'Agregando...' : `Agregar ${dumpadasAgregar.length} Dumpada(s)`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Ajuste de Toneladas */}
      {mostrarModalAjuste && mezclaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 text-white rounded-t-lg">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                ⚖️ Ajustar Toneladas de Remanente
              </h3>
              <p className="text-sm text-amber-50 mt-2">
                Mezcla: <span className="font-bold">{mezclaSeleccionada.codigo}</span>
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Información actual */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Resumen Actual</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium">Total Teórico</p>
                    <p className="text-lg font-bold text-gray-900">{parseFloat(mezclaSeleccionada.total_ton).toFixed(2)} t</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Despachado</p>
                    <p className="text-lg font-bold text-blue-700">{parseFloat(mezclaSeleccionada.toneladas_despachadas || 0).toFixed(2)} t</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Remanente Teórico</p>
                    <p className="text-lg font-bold text-green-700">{parseFloat(mezclaSeleccionada.toneladas_disponibles || 0).toFixed(2)} t</p>
                  </div>
                </div>
              </div>

              {/* Explicación */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">💡 Explicación:</span> Este ajuste permite corregir el total de toneladas
                  basándose en el inventario físico real del remanente. Ingresa el peso real confirmado del material sobrante.
                </p>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Toneladas Reales del Remanente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ajusteForm.toneladas_reales_remanente}
                    onChange={(e) => setAjusteForm({ ...ajusteForm, toneladas_reales_remanente: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Ej: 14.50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ingresa el peso real confirmado del material sobrante después de los despachos
                  </p>
                </div>

                {/* Vista previa del ajuste */}
                {ajusteForm.toneladas_reales_remanente && !isNaN(ajusteForm.toneladas_reales_remanente) && (
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-amber-900 mb-2">Vista Previa del Ajuste</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-amber-700">Total Nuevo</p>
                        <p className="text-lg font-bold text-amber-900">
                          {(parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente)).toFixed(2)} t
                        </p>
                      </div>
                      <div>
                        <p className="text-amber-700">Diferencia</p>
                        <p className={`text-lg font-bold ${
                          (parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente) - parseFloat(mezclaSeleccionada.total_ton)) >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                        }`}>
                          {((parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente) - parseFloat(mezclaSeleccionada.total_ton)) > 0 ? '+' : '')}
                          {(parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente) - parseFloat(mezclaSeleccionada.total_ton)).toFixed(2)} t
                        </p>
                      </div>
                      <div>
                        <p className="text-amber-700">% Variación</p>
                        <p className={`text-lg font-bold ${
                          (((parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente)) / parseFloat(mezclaSeleccionada.total_ton) - 1) * 100) >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                        }`}>
                          {(((parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente)) / parseFloat(mezclaSeleccionada.total_ton) - 1) * 100) > 0 ? '+' : ''}
                          {(((parseFloat(mezclaSeleccionada.toneladas_despachadas || 0) + parseFloat(ajusteForm.toneladas_reales_remanente)) / parseFloat(mezclaSeleccionada.total_ton) - 1) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Motivo del Ajuste <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={ajusteForm.motivo}
                    onChange={(e) => setAjusteForm({ ...ajusteForm, motivo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Ej: Inventario físico confirma más material del calculado teóricamente"
                    rows="3"
                    minLength="10"
                    maxLength="500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mínimo 10 caracteres. Describe por qué se realiza este ajuste.
                  </p>
                </div>
              </div>

              {/* Advertencia */}
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-900">
                  <span className="font-semibold">⚠️ Advertencia:</span> Esta acción es irreversible. Una vez aplicado el ajuste,
                  no se podrán agregar más dumpadas ni modificar la composición de la mezcla.
                </p>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMostrarModalAjuste(false);
                    setAjusteForm({ toneladas_reales_remanente: '', motivo: '' });
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAplicarAjuste}
                  disabled={
                    loading ||
                    !ajusteForm.toneladas_reales_remanente ||
                    isNaN(ajusteForm.toneladas_reales_remanente) ||
                    parseFloat(ajusteForm.toneladas_reales_remanente) < 0 ||
                    !ajusteForm.motivo ||
                    ajusteForm.motivo.length < 10
                  }
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {loading ? 'Aplicando...' : 'Aplicar Ajuste'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Revertir Ajuste */}
      {mostrarModalRevertir && mezclaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white rounded-t-lg">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                🔄 Revertir Ajuste de Toneladas
              </h3>
              <p className="text-sm text-red-50 mt-2">
                Mezcla: <span className="font-bold">{mezclaSeleccionada.codigo}</span>
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Información actual del ajuste */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Ajuste Actual</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium">Total Original</p>
                    <p className="text-lg font-bold text-gray-900">{parseFloat(mezclaSeleccionada.total_ton_original || 0).toFixed(2)} t</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Total Ajustado</p>
                    <p className="text-lg font-bold text-blue-700">{parseFloat(mezclaSeleccionada.total_ton).toFixed(2)} t</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Diferencia</p>
                    <p className={`text-lg font-bold ${mezclaSeleccionada.ajuste_toneladas >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {mezclaSeleccionada.ajuste_toneladas > 0 ? '+' : ''}{parseFloat(mezclaSeleccionada.ajuste_toneladas || 0).toFixed(2)} t
                    </p>
                  </div>
                </div>
                {mezclaSeleccionada.motivo_ajuste && (
                  <div className="mt-3 text-xs">
                    <p className="text-gray-600 font-medium">Motivo del ajuste original:</p>
                    <p className="text-gray-700 italic mt-1">{mezclaSeleccionada.motivo_ajuste}</p>
                  </div>
                )}
              </div>

              {/* Explicación */}
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-sm text-yellow-900">
                  <span className="font-semibold">⚠️ Atención:</span> Al revertir el ajuste se restaurarán los valores originales
                  antes del ajuste. Los valores despachados no cambiarán, solo el total y disponible.
                </p>
              </div>

              {/* Vista previa de la reversión */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Resultado Después de Revertir</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-blue-700">Total</p>
                    <p className="text-lg font-bold text-blue-900">
                      {parseFloat(mezclaSeleccionada.total_ton_original || 0).toFixed(2)} t
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700">Despachado</p>
                    <p className="text-lg font-bold text-blue-900">
                      {parseFloat(mezclaSeleccionada.toneladas_despachadas || 0).toFixed(2)} t
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700">Disponible</p>
                    <p className="text-lg font-bold text-blue-900">
                      {(parseFloat(mezclaSeleccionada.total_ton_original || 0) - parseFloat(mezclaSeleccionada.toneladas_despachadas || 0)).toFixed(2)} t
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Motivo de la Reversión <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revertirForm.motivo}
                  onChange={(e) => setRevertirForm({ ...revertirForm, motivo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Ej: Error en la medición inicial, se corrige según nuevo inventario"
                  rows="3"
                  minLength="10"
                  maxLength="500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo 10 caracteres. Explica por qué necesitas revertir el ajuste.
                </p>
              </div>

              {/* Advertencia */}
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-900">
                  <span className="font-semibold">⚠️ Importante:</span> Esta acción guardará un registro en las observaciones
                  de la mezcla con el historial completo del ajuste y su reversión. Después de revertir podrás
                  aplicar un nuevo ajuste si es necesario.
                </p>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMostrarModalRevertir(false);
                    setRevertirForm({ motivo: '' });
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleRevertirAjuste}
                  disabled={
                    loading ||
                    !revertirForm.motivo ||
                    revertirForm.motivo.length < 10
                  }
                  className="bg-red-500 hover:bg-red-600"
                >
                  {loading ? 'Revirtiendo...' : 'Confirmar Reversión'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Diálogo de Confirmación */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* ===== BARRA STICKY DE MEZCLA EN PROGRESO ===== */}
      {((usarSistemaAcopios ? acopiosSeleccionados.length > 0 : dumpadasSeleccionadas.length > 0) || remanentesSeleccionados.length > 0) && (() => {
        const totales = calcularTotalesMezcla();
        return (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-orange-900 text-white shadow-2xl border-t-2 border-orange-400">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-4">

                {/* Etiqueta */}
                <div className="flex-shrink-0">
                  <HiBeaker className="w-5 h-5 text-orange-300" />
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-2 sm:gap-5 flex-1 min-w-0 overflow-x-auto">

                  <div className="flex-shrink-0 text-center">
                    <p className="text-[10px] text-orange-300 uppercase font-semibold leading-none">Dump</p>
                    <p className="text-sm sm:text-base font-bold leading-tight">{totales.cantidadDumpadas}</p>
                  </div>

                  {totales.cantidadRemanentes > 0 && (
                    <div className="flex-shrink-0 text-center">
                      <p className="text-[10px] text-orange-200 uppercase font-semibold leading-none">Rem</p>
                      <p className="text-sm sm:text-base font-bold text-orange-200 leading-tight">{totales.cantidadRemanentes}</p>
                    </div>
                  )}

                  <div className="w-px h-6 bg-orange-700 flex-shrink-0" />

                  <div className="flex-shrink-0 text-center">
                    <p className="text-[10px] text-orange-300 uppercase font-semibold leading-none">Ton</p>
                    <p className="text-sm sm:text-base font-bold text-blue-300 leading-tight">{totales.totalTon} t</p>
                  </div>

                  <div className="w-px h-6 bg-orange-700 flex-shrink-0" />

                  <div className="flex-shrink-0 text-center">
                    <p className="text-[10px] text-orange-300 uppercase font-semibold leading-none">Ley Dump</p>
                    <p className="text-sm sm:text-base font-bold text-amber-300 leading-tight">{totales.leyAjustada}%</p>
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-orange-700 flex-shrink-0" />

                  <div className="hidden sm:block flex-shrink-0 text-center">
                    <p className="text-[10px] text-orange-300 uppercase font-semibold leading-none">Ley Visual</p>
                    <p className="text-sm sm:text-base font-bold text-green-300 leading-tight">{totales.leyVisual}%</p>
                  </div>

                  <div className="w-px h-6 bg-orange-700 flex-shrink-0" />

                  <div className="flex-shrink-0 text-center">
                    <p className="text-[10px] text-orange-300 uppercase font-semibold leading-none">Ley Lote</p>
                    <p className="text-sm sm:text-base font-bold text-yellow-300 leading-tight">{totales.leyLote}%</p>
                  </div>

                </div>

                {/* Botón Crear */}
                <button
                  onClick={handleCrearMezcla}
                  disabled={loading || !formDataMezcla.planta_id}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-800 disabled:text-orange-600 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition-colors"
                  title={!formDataMezcla.planta_id ? 'Selecciona una planta primero' : 'Crear mezcla'}
                >
                  <HiBeaker className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden xs:inline">{loading ? 'Creando...' : 'Crear'}</span>
                </button>

              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
