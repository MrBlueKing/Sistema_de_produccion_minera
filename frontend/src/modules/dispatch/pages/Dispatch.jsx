import { useState, useEffect, useRef } from 'react';
import { HiHome, HiPencil, HiTrash, HiInformationCircle, HiCheckCircle, HiXCircle, HiEye, HiDocumentPlus, HiChevronLeft, HiChevronRight, HiBeaker, HiCube, HiMap, HiTruck, HiClipboardDocumentList, HiCog6Tooth, HiDocumentDuplicate } from 'react-icons/hi2';
import { HiClipboardCheck, HiFilter } from "react-icons/hi";
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import BulkCompleteModal from '../../../shared/components/molecules/BulkCompleteModal';
import EditDumpadaModal from '../../../shared/components/molecules/EditDumpadaModal';
import ProgressIndicator from '../../../shared/components/molecules/ProgressIndicator';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import RangoTooltip from '../../../shared/components/molecules/RangoTooltip';
import MezclasView from '../components/MezclasView';
import MapaTerrenoMejorado from '../components/MapaTerrenoMejorado';
import DespachosView from '../components/DespachosView';
import AcopiosView from '../components/AcopiosView';
import ConfiguracionView from '../components/ConfiguracionView';
import AcopioSelectionModal from '../../../shared/components/molecules/AcopioSelectionModal';
import { FaenaProvider, useFaena } from '../../../contexts/FaenaContext';
import FaenaMultiSelector from '../../../shared/components/molecules/FaenaMultiSelector';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import { useConfig } from '../../../hooks/useConfig';
import dispatchService from '../services/dispatch';
import mezclasService from '../services/mezclas';
import acopiosService from '../../../services/acopios';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import faenaService from '../../../services/faenaService';

// ✅ CONFIGURACIÓN: IDs de faenas que se mostrarán en el selector de Dispatch
// Para mostrar todas las faenas, dejar como null
// Para filtrar, especificar los IDs: const FAENAS_VISIBLES_DISPATCH = [1, 2, 4];
const FAENAS_VISIBLES_DISPATCH = [1, 2, 4]; // Solo mostrar faenas 1, 2 y 4

function DispatchContent() {
  const { esUsuarioGlobal, faenaUsuario, faenaSeleccionada } = useFaena();
  const navigate = useNavigate();
  const toast = useToast();

  // Determinar la faena activa para cargar configuraciones
  // - Operador: siempre su faena asignada
  // - Encargado: la faena seleccionada en el header (o null si ve todas)
  const faenaActivaConfig = esUsuarioGlobal ? faenaSeleccionada : faenaUsuario;
  const { tonelajeDumpadaDefault, usarSistemaAcopios } = useConfig(faenaActivaConfig);
  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [rangos, setRangos] = useState([]);
  const [faenas, setFaenas] = useState([]);
  const [selectedFaenas, setSelectedFaenas] = useState([]); // ✅ Array de faenas seleccionadas
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, acopio: '' });
  const [editModal, setEditModal] = useState({ show: false, dumpada: null });

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkCompleteModal, setShowBulkCompleteModal] = useState(false);

  // Paginación (Historial)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Estados para Registros Pendientes (vista ingreso)
  const [pendientesData, setPendientesData] = useState([]);
  const [pendientesPage, setPendientesPage] = useState(1);
  const [pendientesTotalPages, setPendientesTotalPages] = useState(1);
  const [pendientesTotalRecords, setPendientesTotalRecords] = useState(0);
  const pendientesPerPage = 15;
  const [pendientesFilters, setPendientesFilters] = useState({
    jornada: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_frente_trabajo: '',
  });
  const [pendientesSearchTerm, setPendientesSearchTerm] = useState('');
  const debouncedPendientesSearch = useDebounce(pendientesSearchTerm, 500);

  // Vista actual: 'ingreso', 'historial', 'acopios', 'mezclas', 'mapa', 'despachos' o 'configuracion'
  const [vistaActual, setVistaActual] = useState('ingreso');

  // Estados de filtros (solo para vista historial)
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    estado: '',
    jornada: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_frente_trabajo: '',
    id_faena: '',
  });

  // Debounce para la búsqueda
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];

  // Ingreso masivo: array de formularios
  const [formsIngresoMasivo, setFormsIngresoMasivo] = useState([
    {
      id: 1,
      id_frente_trabajo: '',
      jornada: '',
      ley_visual: '',
    }
  ]);

  // Ingreso rápido por lotes
  const [ingresoRapido, setIngresoRapido] = useState({
    id_frente_trabajo: '',
    jornada: '',
    cantidad: 1,
    ley_visual: '',
  });

  // Estados para Mezclas
  const [dumpadasDisponibles, setDumpadasDisponibles] = useState([]);
  const [mezclas, setMezclas] = useState([]);

  // Estados para Modal de Acopios
  const [showAcopioModal, setShowAcopioModal] = useState(false);
  const [gruposDetectados, setGruposDetectados] = useState([]);
  const [dumpadasPendientes, setDumpadasPendientes] = useState([]);

  // Estados para indicador de progreso
  const [progressInfo, setProgressInfo] = useState({
    show: false,
    steps: []
  });


  // Flag para saber si ya se inicializó (evita cargas duplicadas)
  const [initialized, setInitialized] = useState(false);

  // Ref para evitar cargas concurrentes
  const loadingRef = useRef(false);

  // Cargar maestros iniciales (faenas, rangos) - solo una vez
  useEffect(() => {
    loadMaestrosIniciales();

    // Listener para cambiar a vista de mezclas desde el mapa
    const handleCambiarVistaMezclas = () => {
      setVistaActual('mezclas');
    };

    window.addEventListener('cambiarVistaMezclas', handleCambiarVistaMezclas);

    return () => {
      window.removeEventListener('cambiarVistaMezclas', handleCambiarVistaMezclas);
    };
  }, []);

  // Cargar data cuando cambian filtros (solo en historial y ya inicializado)
  useEffect(() => {
    if (initialized && vistaActual === 'historial') {
      loadData();
    }
  }, [currentPage, debouncedSearchTerm, filters]);

  // Cargar data cuando cambian las faenas seleccionadas (después de inicialización)
  useEffect(() => {
    if (faenas.length > 0 && selectedFaenas.length > 0) {
      if (!initialized) {
        // Primera carga después de tener faenas
        setInitialized(true);
      }
      if (vistaActual === 'historial' || vistaActual === 'ingreso') {
        loadData();
      }
      // Cargar pendientes si estamos en vista de ingreso
      if (vistaActual === 'ingreso') {
        loadPendientes();
      }
      // También recargar frentes cuando cambian las faenas
      loadFrentes();
    }
  }, [selectedFaenas]);

  // Cargar data cuando cambia la vista (solo si ya está inicializado)
  useEffect(() => {
    if (initialized) {
      loadData();
      // Cargar pendientes si cambiamos a vista de ingreso
      if (vistaActual === 'ingreso') {
        loadPendientes();
      }
    }
  }, [vistaActual]);

  // Cargar pendientes cuando cambian los filtros de pendientes o la página (solo en vista ingreso)
  useEffect(() => {
    if (initialized && vistaActual === 'ingreso') {
      loadPendientes();
    }
  }, [pendientesPage, debouncedPendientesSearch, pendientesFilters, vistaActual, initialized, selectedFaenas]);

  // Función para cargar maestros iniciales (faenas, rangos) - solo una vez
  const loadMaestrosIniciales = async () => {
    setLoading(true);

    try {
      const [rangosRes, faenasRes] = await Promise.all([
        dispatchService.getRangos(),
        faenaService.getFaenas(),
      ]);

      setRangos(rangosRes.data || []);

      const faenasData = faenasRes.data || [];
      setFaenas(faenasData);

      // ✅ Inicializar faenas seleccionadas
      if (faenasData.length > 0) {
        let faenasASeleccionar;

        if (esUsuarioGlobal) {
          // ENCARGADO DISTPACH: Inicializar con faenas visibles configuradas
          faenasASeleccionar = FAENAS_VISIBLES_DISPATCH
            ? faenasData.filter(f => FAENAS_VISIBLES_DISPATCH.includes(f.id)).map(f => f.id)
            : faenasData.map(f => f.id);
        } else {
          // OPERADOR DISPATCH: Solo su faena asignada
          faenasASeleccionar = faenaUsuario ? [faenaUsuario] : [];
        }

        setSelectedFaenas(faenasASeleccionar);
      }
    } catch (error) {
      console.error('❌ Error cargando maestros iniciales:', error);
      toast.error('Error al cargar datos', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar solo frentes según faenas seleccionadas
  const loadFrentes = async () => {
    try {
      // ✅ MULTI-FAENA: Parámetros para frentes según rol y faenas seleccionadas
      let frentesParams = { solo_activos: true, per_page: 1000 };

      if (esUsuarioGlobal && selectedFaenas.length > 0) {
        // ENCARGADO DISPATCH: Filtrar por faenas seleccionadas
        frentesParams.id_faena = selectedFaenas.join(',');
      } else if (!esUsuarioGlobal && faenaUsuario) {
        // OPERADOR DISPATCH: Filtrar por su faena asignada
        frentesParams.id_faena = faenaUsuario;
      }

      const frentesRes = await ingenieriaService.getFrentesTrabajo(frentesParams);

      console.log('✅ [DISPATCH] Frentes cargados:', frentesRes.data?.length || 0);
      setFrentes(frentesRes.data || []);
    } catch (error) {
      console.error('❌ Error cargando frentes:', error);
    }
  };

  const loadData = async () => {
    // Evitar cargas concurrentes
    if (loadingRef.current) {
      console.log('⏳ [DISPATCH] Carga en progreso, ignorando llamada duplicada');
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      if (vistaActual === 'mezclas') {
        console.log('🔄 [DISPATCH] Cargando datos de mezclas...');

        // Cargar datos para vista de mezclas
        const [disponibles, mezclasRes] = await Promise.all([
          mezclasService.getDumpadasDisponibles(),
          mezclasService.getMezclas(),
        ]);

        console.log("DATOS AQUI--------------------------------------------");
        console.log('📦 [DISPATCH] Datos cargados:', {
          dumpadasDisponibles: disponibles?.length || 0,
          mezclas: mezclasRes?.data?.length || 0,
          mezclasRes_completo: mezclasRes
        });

        setDumpadasDisponibles(disponibles || []);
        // Laravel paginate devuelve {data: [], current_page: ..., total: ...}
        setMezclas(mezclasRes?.data || []);
      } else {
        // Cargar dumpadas (para ingreso e historial)
        let params = {};

        if (vistaActual === 'historial') {
          // ✅ MULTI-FAENA: Enviar faenas según rol
          let idFaenaParam = undefined;

          if (esUsuarioGlobal && selectedFaenas.length > 0) {
            // ENCARGADO DISTPACH: Enviar faenas seleccionadas del selector
            idFaenaParam = selectedFaenas.join(',');
          }
          // OPERADOR DISPATCH: No enviar nada, backend fuerza su faena

          console.log('🔍 [DISPATCH] Preparando carga de dumpadas:', {
            esUsuarioGlobal,
            selectedFaenas,
            idFaenaParam,
            filters
          });

          // Construir parámetros con filtros
          params = {
            page: currentPage,
            per_page: perPage,
            search: debouncedSearchTerm || undefined,
            estado: filters.estado || undefined,
            jornada: filters.jornada || undefined,
            fecha_inicio: filters.fecha_inicio || undefined,
            fecha_fin: filters.fecha_fin || undefined,
            id_frente_trabajo: filters.id_frente_trabajo || undefined,
            id_faena: idFaenaParam || filters.id_faena || undefined,
          };

          // Limpiar parámetros undefined
          Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

          console.log('📤 [DISPATCH] Parámetros finales enviados:', params);
        }

        const dumpadasRes = await dispatchService.getDumpadas(params);

        console.log('📥 [DISPATCH] Respuesta recibida:', {
          total_en_backend: dumpadasRes.pagination?.total,
          registros_recibidos: dumpadasRes.data?.length,
          primeras_3_dumpadas: dumpadasRes.data?.slice(0, 3).map(d => ({
            id: d.id,
            numero_dumpada: d.numero_dumpada,
            id_faena: d.id_faena,
            faena_info: d.faena_info
          }))
        });

        setDumpadas(dumpadasRes.data || []);

        if (dumpadasRes.pagination) {
          setTotalPages(dumpadasRes.pagination.last_page);
          setTotalRecords(dumpadasRes.pagination.total);
        }
      }

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      toast.error(
        'Error al cargar datos',
        error.response?.data?.message || error.message
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  // Función para cargar registros pendientes (estado = 'Ingresado')
  const loadPendientes = async () => {
    try {
      // Construir parámetros con filtros - siempre estado 'Ingresado'
      let idFaenaParam = undefined;
      if (esUsuarioGlobal && selectedFaenas.length > 0) {
        idFaenaParam = selectedFaenas.join(',');
      }

      const params = {
        page: pendientesPage,
        per_page: pendientesPerPage,
        estado: 'Ingresado', // Siempre filtrar por estado Ingresado
        search: debouncedPendientesSearch || undefined,
        jornada: pendientesFilters.jornada || undefined,
        fecha_inicio: pendientesFilters.fecha_inicio || undefined,
        fecha_fin: pendientesFilters.fecha_fin || undefined,
        id_frente_trabajo: pendientesFilters.id_frente_trabajo || undefined,
        id_faena: idFaenaParam || undefined,
      };

      // Limpiar parámetros undefined
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await dispatchService.getDumpadas(params);

      setPendientesData(response.data || []);
      if (response.pagination) {
        setPendientesTotalPages(response.pagination.last_page);
        setPendientesTotalRecords(response.pagination.total);
      }
    } catch (error) {
      console.error('❌ Error cargando pendientes:', error);
      toast.error('Error al cargar registros pendientes', error.message);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';

    // Si la fecha viene en formato DD-MM-YYYY, retornarla tal cual
    if (typeof fecha === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fecha)) {
      return fecha;
    }

    // Si es otro formato, convertirla a DD-MM-YYYY
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return '-';

    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();

    return `${dia}-${mes}-${anio}`;
  };

  const resetFormIngreso = () => {
    setFormsIngresoMasivo([
      {
        id: 1,
        id_frente_trabajo: '',
        jornada: '',
        ley_visual: '',
      }
    ]);
  };

  const agregarFilaIngreso = () => {
    const newId = Math.max(...formsIngresoMasivo.map(f => f.id)) + 1;
    setFormsIngresoMasivo([...formsIngresoMasivo, {
      id: newId,
      id_frente_trabajo: '',
      jornada: '',
      ley_visual: '',
    }]);
  };

  const eliminarFilaIngreso = (id) => {
    if (formsIngresoMasivo.length > 1) {
      setFormsIngresoMasivo(formsIngresoMasivo.filter(f => f.id !== id));
    }
  };

  const actualizarFilaIngreso = (id, field, value) => {
    setFormsIngresoMasivo(formsIngresoMasivo.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  // Duplicar una fila específica
  const duplicarFilaIngreso = (id) => {
    const filaToDuplicate = formsIngresoMasivo.find(f => f.id === id);
    if (filaToDuplicate) {
      const newId = Math.max(...formsIngresoMasivo.map(f => f.id)) + 1;
      const newFila = {
        id: newId,
        id_frente_trabajo: filaToDuplicate.id_frente_trabajo,
        jornada: filaToDuplicate.jornada,
        ley_visual: filaToDuplicate.ley_visual,
      };
      setFormsIngresoMasivo([...formsIngresoMasivo, newFila]);
      toast.success('Fila duplicada', 'Se ha agregado una nueva fila con los mismos datos');
    }
  };

  // Ingreso rápido por lotes: crear múltiples filas con los mismos datos
  const handleIngresoRapido = () => {
    if (!ingresoRapido.id_frente_trabajo || !ingresoRapido.jornada || !ingresoRapido.ley_visual) {
      toast.warning('Atención', 'Debes completar Frente, Jornada y Ley Visual para el ingreso rápido');
      return;
    }

    const cantidad = parseInt(ingresoRapido.cantidad) || 1;
    if (cantidad < 1 || cantidad > 50) {
      toast.warning('Atención', 'La cantidad debe estar entre 1 y 50');
      return;
    }

    // Obtener el ID máximo actual
    const maxId = formsIngresoMasivo.length > 0
      ? Math.max(...formsIngresoMasivo.map(f => f.id))
      : 0;

    // Crear las nuevas filas
    const nuevasFilas = [];
    for (let i = 1; i <= cantidad; i++) {
      nuevasFilas.push({
        id: maxId + i,
        id_frente_trabajo: ingresoRapido.id_frente_trabajo,
        jornada: ingresoRapido.jornada,
        ley_visual: ingresoRapido.ley_visual,
      });
    }

    // Agregar al formulario existente
    setFormsIngresoMasivo([...formsIngresoMasivo, ...nuevasFilas]);

    toast.success(
      `${cantidad} dumpada(s) agregadas`,
      `Se agregaron ${cantidad} fila(s) con Frente: ${frentes.find(f => f.id === ingresoRapido.id_frente_trabajo)?.codigo_completo || ''}, Jornada: ${ingresoRapido.jornada}`
    );

    // Limpiar el formulario de ingreso rápido
    setIngresoRapido({
      id_frente_trabajo: '',
      jornada: '',
      cantidad: 1,
      ley_visual: '',
    });
  };

  // Ingreso masivo - Guardar todas las filas
  const handleSubmitIngresoMasivo = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validar que todas las filas estén completas
    const filasValidas = formsIngresoMasivo.filter(f =>
      f.id_frente_trabajo && f.jornada && f.ley_visual
    );

    if (filasValidas.length === 0) {
      toast.warning('Atención', 'Debes completar al menos una fila para guardar');
      setLoading(false);
      return;
    }

    // Inicializar indicador de progreso
    // Si NO se usan acopios, solo mostrar paso de creación
    const steps = usarSistemaAcopios
      ? [
          { id: 1, label: `Creando ${filasValidas.length} dumpada(s)...`, status: 'loading' },
          { id: 2, label: 'Detectando acopios existentes...', status: 'pending' },
          { id: 3, label: 'Asignando a acopios...', status: 'pending' }
        ]
      : [
          { id: 1, label: `Creando ${filasValidas.length} dumpada(s)...`, status: 'loading' }
        ];

    setProgressInfo({
      show: true,
      steps
    });

    try {
      // PASO 1: Crear las dumpadas usando endpoint BULK (1 request en lugar de N)
      const dumpadasData = filasValidas.map(form => ({
        id_frente_trabajo: form.id_frente_trabajo,
        jornada: form.jornada,
        ley_visual: form.ley_visual,
        ton: tonelajeDumpadaDefault
      }));

      const bulkResponse = await dispatchService.createDumpadasBulk(dumpadasData);
      const dumpadasCreadas = bulkResponse.data;

      console.log(`✅ ${dumpadasCreadas.length} dumpada(s) creadas en bulk:`, dumpadasCreadas);

      // Si NO se usan acopios, terminar aquí
      if (!usarSistemaAcopios) {
        // Marcar paso 1 como completado
        setProgressInfo(prev => ({
          ...prev,
          steps: prev.steps.map(s => ({ ...s, status: 'completed' }))
        }));

        toast.success('Éxito', `${dumpadasCreadas.length} dumpada(s) creadas correctamente`);

        // Ocultar progreso después de 1.5 segundos
        setTimeout(() => {
          setProgressInfo({ show: false, steps: [] });
        }, 1500);

        // Reiniciar formulario y recargar datos
        resetFormIngreso();
        loadData();
        loadPendientes(); // Refrescar pendientes
        setLoading(false);
        return;
      }

      // SISTEMA DE ACOPIOS ACTIVADO: Continuar con pasos 2 y 3

      // Actualizar paso 1 como completado
      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.id === 1 ? { ...s, status: 'completed' } :
          s.id === 2 ? { ...s, status: 'loading' } : s
        )
      }));

      // PASO 2: Detectar acopios existentes
      const dumpadasParaDeteccion = filasValidas.map(form => ({
        id_frente_trabajo: form.id_frente_trabajo,
        jornada: form.jornada,
        fecha: new Date().toISOString().split('T')[0] // Fecha actual en formato YYYY-MM-DD
      }));

      const deteccionResponse = await acopiosService.detectarAcopiosExistentes(dumpadasParaDeteccion);
      const grupos = deteccionResponse.data || [];

      console.log('🔍 Grupos detectados:', grupos);

      // Actualizar paso 2 como completado
      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.id === 2 ? { ...s, status: 'completed' } :
          s.id === 3 ? { ...s, status: 'loading' } : s
        )
      }));

      // PASO 3: Verificar si hay acopios existentes
      const hayAcopiosExistentes = grupos.some(g => g.acopio_existente);

      if (hayAcopiosExistentes) {
        // Mostrar modal de selección - ocultar progreso temporalmente
        setProgressInfo({ show: false, steps: [] });
        setGruposDetectados(grupos);
        setDumpadasPendientes(dumpadasCreadas);
        setShowAcopioModal(true);
        setLoading(false);
      } else {
        // No hay acopios existentes, crear nuevos acopios automáticamente
        await crearAcopiosAutomaticos(grupos, dumpadasCreadas);
      }

    } catch (error) {
      console.error('❌ Error guardando dumpadas:', error);

      const errorMsg = error.response?.data?.message ||
        JSON.stringify(error.response?.data?.errors) ||
        error.message ||
        'Error al guardar dumpadas';

      toast.error('Error al guardar', errorMsg);
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    }
  };

  // Crear acopios automáticos cuando no hay existentes
  const crearAcopiosAutomaticos = async (grupos, dumpadasCreadas) => {
    try {
      for (const grupo of grupos) {
        // Crear acopio automático
        const acopioResponse = await acopiosService.crearAcopioAutomatico({
          id_frente_trabajo: grupo.id_frente_trabajo,
          jornada: grupo.jornada,
          fecha: grupo.fecha
        });

        const acopio = acopioResponse.data;

        // Obtener IDs de dumpadas de este grupo
        const dumpadaIds = dumpadasCreadas
          .filter((_, index) => {
            const filaValida = formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual)[index];
            return filaValida.id_frente_trabajo === grupo.id_frente_trabajo &&
                   filaValida.jornada === grupo.jornada;
          })
          .map(d => d.id);

        // Agregar dumpadas al acopio
        if (dumpadaIds.length > 0) {
          await acopiosService.agregarDumpadas(acopio.id, dumpadaIds);
        }

        console.log(`✅ Acopio ${acopio.codigo_acopio} creado con ${dumpadaIds.length} dumpadas`);
      }

      // Actualizar paso 3 como completado
      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.id === 3 ? { ...s, status: 'completed' } : s
        )
      }));

      // Esperar un momento para que el usuario vea todos los pasos completados
      await new Promise(resolve => setTimeout(resolve, 800));

      toast.success(
        `${dumpadasCreadas.length} dumpada(s) ingresadas`,
        `Agrupadas en ${grupos.length} acopio(s) automático(s)`
      );

      resetFormIngreso();
      await loadData();
      await loadPendientes(); // Refrescar pendientes
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);

    } catch (error) {
      console.error('❌ Error creando acopios automáticos:', error);
      toast.error('Error al crear acopios', error.response?.data?.message || error.message);
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    }
  };

  // Manejar confirmación del modal de acopios
  const handleAcopioModalConfirm = async (decisiones) => {
    setShowAcopioModal(false);
    setLoading(true);

    // Mostrar indicador de progreso
    setProgressInfo({
      show: true,
      steps: [
        { id: 1, label: 'Procesando decisiones de acopios...', status: 'loading' }
      ]
    });

    try {
      for (let grupoIndex = 0; grupoIndex < gruposDetectados.length; grupoIndex++) {
        const grupo = gruposDetectados[grupoIndex];
        const decision = decisiones[grupoIndex];

        // Obtener IDs de dumpadas de este grupo
        const filasValidas = formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual);
        const dumpadaIds = dumpadasPendientes
          .filter((_, index) => {
            const filaValida = filasValidas[index];
            return filaValida.id_frente_trabajo === grupo.id_frente_trabajo &&
                   filaValida.jornada === grupo.jornada;
          })
          .map(d => d.id);

        if (decision === 'AGREGAR_EXISTENTE' && grupo.acopio_existente) {
          // Agregar a acopio existente
          await acopiosService.agregarDumpadas(grupo.acopio_existente.id, dumpadaIds);
          console.log(`✅ ${dumpadaIds.length} dumpadas agregadas al acopio ${grupo.acopio_existente.codigo_acopio}`);

        } else if (decision === 'CREAR_NUEVO') {
          // Crear nuevo acopio
          const acopioResponse = await acopiosService.crearAcopioAutomatico({
            id_frente_trabajo: grupo.id_frente_trabajo,
            jornada: grupo.jornada,
            fecha: grupo.fecha
          });

          await acopiosService.agregarDumpadas(acopioResponse.data.id, dumpadaIds);
          console.log(`✅ Nuevo acopio ${acopioResponse.data.codigo_acopio} creado con ${dumpadaIds.length} dumpadas`);

        } else if (decision === 'SIN_ACOPIO') {
          // Dejar sin acopio
          console.log(`ℹ️ ${dumpadaIds.length} dumpadas dejadas sin acopio`);
        }
      }

      // Marcar proceso como completado
      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s => ({ ...s, status: 'completed' }))
      }));

      // Esperar un momento para que el usuario vea el paso completado
      await new Promise(resolve => setTimeout(resolve, 600));

      toast.success(
        `${dumpadasPendientes.length} dumpada(s) procesadas`,
        'Acopios configurados correctamente'
      );

      resetFormIngreso();
      setGruposDetectados([]);
      setDumpadasPendientes([]);
      await loadData();
      await loadPendientes(); // Refrescar pendientes

    } catch (error) {
      console.error('❌ Error procesando acopios:', error);
      toast.error('Error al procesar acopios', error.response?.data?.message || error.message);
    } finally {
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    }
  };

  // Manejar cancelación del modal de acopios
  const handleAcopioModalCancel = () => {
    setShowAcopioModal(false);
    setGruposDetectados([]);
    setDumpadasPendientes([]);
    toast.info('Cancelado', 'Las dumpadas fueron creadas pero no se asignaron a acopios');
    resetFormIngreso();
    loadData();
    loadPendientes(); // Refrescar pendientes
  };

  const handleCompletar = (dumpada) => {
    // Seleccionar solo esta dumpada y abrir el modal de completar múltiple
    setSelectedIds([dumpada.id]);
    setShowBulkCompleteModal(true);
  };

  const handleEdit = (dumpada) => {
    setEditModal({ show: true, dumpada });
  };

  const handleEditConfirm = async (updatedData) => {
    setEditModal({ show: false, dumpada: null });
    setLoading(true);

    try {
      await dispatchService.updateDumpada(updatedData.id, updatedData);
      toast.success('¡Dumpada actualizada!', 'Los cambios han sido guardados correctamente');
      await loadData();
      // Refrescar pendientes si estamos en vista de ingreso
      if (vistaActual === 'ingreso') {
        await loadPendientes();
      }
    } catch (error) {
      console.error('❌ Error actualizando dumpada:', error);
      toast.error('Error al actualizar', error.response?.data?.message || 'No se pudo actualizar la dumpada');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditModal({ show: false, dumpada: null });
  };

  // Handlers para filtros
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      estado: '',
      jornada: '',
      fecha_inicio: '',
      fecha_fin: '',
      id_frente_trabajo: '',
      id_faena: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers para filtros de Pendientes
  const handlePendientesSearchChange = (value) => {
    setPendientesSearchTerm(value);
    setPendientesPage(1);
  };

  const handlePendientesFilterChange = (name, value) => {
    setPendientesFilters(prev => ({ ...prev, [name]: value }));
    setPendientesPage(1);
  };

  const handleClearPendientesFilters = () => {
    setPendientesSearchTerm('');
    setPendientesFilters({
      jornada: '',
      fecha_inicio: '',
      fecha_fin: '',
      id_frente_trabajo: '',
    });
    setPendientesPage(1);
  };

  const handlePendientesPageChange = (page) => {
    setPendientesPage(page);
  };

  // ✅ NUEVO: Manejar selección/deselección de faenas (solo para encargado)
  const handleToggleFaena = (faenaId, isSelected) => {
    setSelectedFaenas(prev => {
      if (isSelected) {
        // Agregar faena si no está en la lista
        return prev.includes(faenaId) ? prev : [...prev, faenaId];
      } else {
        // Remover faena de la lista
        return prev.filter(id => id !== faenaId);
      }
    });
    // Resetear a la primera página cuando cambian las faenas
    setCurrentPage(1);
  };

  const handleDelete = async (id) => {
    const dumpada = dumpadas.find(d => d.id === id);
    setDeleteModal({
      show: true,
      id: id,
      acopio: dumpada?.acopios || dumpada?.n_acop || 'esta dumpada'
    });
  };

  const confirmDelete = async () => {
    const id = deleteModal.id;

    // Si id es null, es eliminación múltiple
    if (id === null) {
      confirmBulkDelete();
      return;
    }

    // Eliminación individual
    setDeleteModal({ show: false, id: null, acopio: '' });
    setLoading(true);

    try {
      await dispatchService.deleteDumpada(id);
      toast.success('¡Dumpada eliminada!', 'El registro ha sido eliminado correctamente');
      await loadData();
      // Refrescar pendientes si estamos en vista de ingreso
      if (vistaActual === 'ingreso') {
        await loadPendientes();
      }
    } catch (error) {
      console.error('❌ Error eliminando dumpada:', error);
      toast.error('Error al eliminar', error.response?.data?.message || 'No se pudo eliminar la dumpada');
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, id: null, acopio: '' });
  };

  // Funciones de selección múltiple
  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = (dumpadasList) => {
    const allIds = dumpadasList.map(d => d.id);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Completar múltiples dumpadas con wizard
  const handleBulkComplete = () => {
    if (selectedIds.length === 0) {
      toast.warning('Atención', 'Debes seleccionar al menos una dumpada');
      return;
    }

    const selectedDumpadas = dumpadas.filter(d => selectedIds.includes(d.id));
    const alreadyCompleted = selectedDumpadas.filter(d => d.estado === 'Completado');

    if (alreadyCompleted.length > 0) {
      toast.warning(
        'Algunas ya completadas',
        `${alreadyCompleted.length} dumpada(s) ya están completadas y serán omitidas`
      );
    }

    // Filtrar solo las que están en estado "Ingresado"
    const dumpadasToComplete = selectedDumpadas.filter(d => d.estado !== 'Completado');

    if (dumpadasToComplete.length === 0) {
      toast.info('Sin pendientes', 'Todas las dumpadas seleccionadas ya están completadas');
      return;
    }

    setShowBulkCompleteModal(true);
  };

  const handleBulkCompleteConfirm = async (completedDataMap) => {
    setShowBulkCompleteModal(false);
    setLoading(true);

    try {
      const promises = Object.entries(completedDataMap).map(([id, data]) => {
        const dumpada = dumpadas.find(d => d.id === parseInt(id));
        return dispatchService.updateDumpada(parseInt(id), {
          ley: data.ley,
          ley_cup: data.ley_cup,
          certificado: data.certificado,
          id_frente_trabajo: dumpada.id_frente_trabajo,
          jornada: dumpada.jornada,
          ley_visual: dumpada.ley_visual,
          ton: tonelajeDumpadaDefault
        });
      });

      await Promise.all(promises);

      toast.success(
        `${Object.keys(completedDataMap).length} dumpada(s) completadas`,
        'Los resultados del laboratorio han sido registrados'
      );

      clearSelection();
      await loadData();
      // Refrescar pendientes si estamos en vista de ingreso
      if (vistaActual === 'ingreso') {
        await loadPendientes();
      }
    } catch (error) {
      console.error('❌ Error completando dumpadas:', error);
      toast.error('Error al completar', error.response?.data?.message || 'No se pudieron completar las dumpadas');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCompleteCancel = () => {
    setShowBulkCompleteModal(false);
  };

  // Eliminar múltiples dumpadas
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.warning('Atención', 'Debes seleccionar al menos una dumpada');
      return;
    }

    const selectedDumpadas = dumpadas.filter(d => selectedIds.includes(d.id));
    const acopios = selectedDumpadas.map(d => d.acopios || d.n_acop).join(', ');

    setDeleteModal({
      show: true,
      id: null, // null indica que es eliminación múltiple
      acopio: `${selectedIds.length} dumpadas: ${acopios}`
    });
  };

  const confirmBulkDelete = async () => {
    setDeleteModal({ show: false, id: null, acopio: '' });
    setLoading(true);

    try {
      const promises = selectedIds.map(id => dispatchService.deleteDumpada(id));
      await Promise.all(promises);

      toast.success(
        `${selectedIds.length} dumpada(s) eliminadas`,
        'Los registros han sido eliminados correctamente'
      );

      clearSelection();
      await loadData();
      // Refrescar pendientes si estamos en vista de ingreso
      if (vistaActual === 'ingreso') {
        await loadPendientes();
      }
    } catch (error) {
      console.error('❌ Error eliminando dumpadas:', error);
      toast.error('Error al eliminar', error.response?.data?.message || 'No se pudieron eliminar las dumpadas');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.href = 'http://localhost:5173';
  };


  const getEstadoColor = (estado) => {
    const colors = {
      'Ingresado': 'bg-yellow-500',
      'En Análisis': 'bg-blue-500',
      'Completado': 'bg-green-600'
    };
    return colors[estado] || 'bg-gray-500';
  };

  const getRangoColor = (rango) => {
    const colors = {
      'L': 'bg-purple-600',
      'K': 'bg-indigo-600',
      'J': 'bg-blue-600',
      'I': 'bg-cyan-600',
      'H': 'bg-teal-600',
      'G': 'bg-green-600',
      'F': 'bg-lime-600',
      'E': 'bg-yellow-600',
      'D': 'bg-orange-600',
      'C': 'bg-red-600',
      'B': 'bg-pink-600',
      'A': 'bg-rose-600',
      'Reserva': 'bg-gray-600',
      'Descarte': 'bg-slate-800'
    };
    return colors[rango] || 'bg-gray-600';
  };

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

  if (loading && dumpadas.length === 0 && frentes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Dashboard Central',
                href: 'http://localhost:5173',
                onClick: (e) => {
                  e.preventDefault();
                  handleGoBack();
                },
                icon: HiHome
              },
              {
                label: 'Dispatch - Dumpadas'
              }
            ]}
          />
        </div>

        {/* Selector Multi-Faena - Solo para encargado_dispatch */}
        {esUsuarioGlobal && (
          <FaenaMultiSelector
            selectedFaenas={selectedFaenas}
            onToggleFaena={handleToggleFaena}
            faenas={faenas}
            faenasVisibles={FAENAS_VISIBLES_DISPATCH}
            loading={loading}
            className="mb-6"
          />
        )}

        {/* Modal de Confirmación de Eliminación */}
        <ConfirmModal
          show={deleteModal.show}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          title="¿Eliminar Dumpada?"
          message="Estás a punto de eliminar la dumpada:"
          highlightText={deleteModal.acopio}
          warningText="Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          icon={HiTrash}
        />

        {/* Modal de Edición */}
        <EditDumpadaModal
          show={editModal.show}
          dumpada={editModal.dumpada}
          frentes={frentes}
          jornadas={jornadas}
          onConfirm={handleEditConfirm}
          onCancel={handleEditCancel}
        />

        {/* Modal de Completar Múltiples (Wizard) */}
        <BulkCompleteModal
          show={showBulkCompleteModal}
          dumpadas={dumpadas.filter(d => selectedIds.includes(d.id) && d.estado !== 'Completado')}
          onConfirm={handleBulkCompleteConfirm}
          onCancel={handleBulkCompleteCancel}
        />

        {/* Modal de Selección de Acopios */}
        <AcopioSelectionModal
          show={showAcopioModal}
          grupos={gruposDetectados}
          onConfirm={handleAcopioModalConfirm}
          onCancel={handleAcopioModalCancel}
        />

        {/* Indicador de Progreso */}
        <ProgressIndicator
          show={progressInfo.show}
          steps={progressInfo.steps}
        />

        {/* Header con Switch de Vista */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                Gestión de Dumpadas
              </h2>
              <p className="text-gray-600 mt-1">
                {vistaActual === 'ingreso' ? 'Modo: Ingreso de nuevas dumpadas' : `Modo: Historial (${totalRecords} registros)`}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <Button
                variant="secondary"
                onClick={() => setShowInfo(!showInfo)}
                icon={HiInformationCircle}
              >
                {showInfo ? 'Ocultar' : 'Ayuda'}
              </Button>
            </div>
          </div>

          {/* Tabs Mejorados */}
          <div className="mt-6 border-b-2 border-gray-200">
            <div className="flex gap-1 -mb-0.5">
              <button
                onClick={() => {
                  setVistaActual('ingreso');
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'ingreso'
                  ? 'bg-blue-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiDocumentPlus className="w-5 h-5" />
                <span>Ingreso de Dumpadas</span>
                {vistaActual === 'ingreso' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
              <button
                onClick={() => {
                  setVistaActual('historial');
                  setCurrentPage(1);
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'historial'
                  ? 'bg-blue-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiEye className="w-5 h-5" />
                <span>Historial</span>
                {totalRecords > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${vistaActual === 'historial'
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-100 text-blue-700'
                    }`}>
                    {totalRecords}
                  </span>
                )}
                {vistaActual === 'historial' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
              {/* Tab de Acopios - Solo visible si el sistema de acopios está activado */}
              {usarSistemaAcopios && (
                <button
                  onClick={() => {
                    setVistaActual('acopios');
                  }}
                  className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'acopios'
                    ? 'bg-indigo-600 text-white shadow-lg transform translate-y-0.5'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <HiCube className="w-5 h-5" />
                  <span>Acopios</span>
                  {vistaActual === 'acopios' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setVistaActual('mezclas');
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'mezclas'
                  ? 'bg-purple-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiBeaker className="w-5 h-5" />
                <span>Mezclas</span>
                {mezclas.length > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${vistaActual === 'mezclas'
                    ? 'bg-white text-purple-600'
                    : 'bg-purple-100 text-purple-700'
                    }`}>
                    {mezclas.length}
                  </span>
                )}
                {vistaActual === 'mezclas' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
              <button
                onClick={() => {
                  setVistaActual('mapa');
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'mapa'
                  ? 'bg-green-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiMap className="w-5 h-5" />
                <span>Mapa de Terreno</span>
                {vistaActual === 'mapa' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
              <button
                onClick={() => {
                  setVistaActual('despachos');
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'despachos'
                  ? 'bg-orange-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiTruck className="w-5 h-5" />
                <span>Despachos</span>
                {vistaActual === 'despachos' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
              <button
                onClick={() => {
                  setVistaActual('configuracion');
                }}
                className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActual === 'configuracion'
                  ? 'bg-gray-600 text-white shadow-lg transform translate-y-0.5'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <HiCog6Tooth className="w-5 h-5" />
                <span>Configuracion</span>
                {vistaActual === 'configuracion' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Panel de Información */}
        {showInfo && (
          <Card className="mb-6 border-l-4 border-blue-400 bg-blue-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <HiInformationCircle className="w-7 h-7 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-900 mb-4">Información del Sistema</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">📝 Ingreso Inicial</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Registre: Punto, Jornada y Ley Visual (obligatorio)</li>
                      <li>• Queda en estado: <strong>Ingresado</strong></li>
                      <li>• Espera resultados de laboratorio</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">🔬 Resultados de Laboratorio</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Use el módulo de <strong>Laboratorio</strong></li>
                      <li>• O edite la dumpada para agregar leyes</li>
                      <li>• Estado final: <strong>Completado</strong></li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">✨ Automático</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Fecha:</strong> Actual del sistema</li>
                      <li>• <strong>Toneladas:</strong> {tonelajeDumpadaDefault} Ton</li>
                      <li>• <strong>N° Acopio:</strong> Auto-incremental</li>
                      <li>• <strong>Rango:</strong> Según ley ingresada</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">🎯 Estados</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">Ingresado</span>
                        <span className="text-xs">Muestra enviada al laboratorio</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">Completado</span>
                        <span className="text-xs">Resultados recibidos del laboratorio</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Vista de Ingreso */}
        {vistaActual === 'ingreso' && (
          <>
            {/* Formulario de Ingreso Rápido por Lotes */}
            <Card className="mb-6 border-l-4 border-green-500 bg-gradient-to-br from-green-50 to-white">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  Ingreso Rápido por Lotes
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Cree múltiples dumpadas de la misma frente y jornada en un solo paso
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <SearchableSelect
                    label="Frente de Trabajo *"
                    options={frentes.map(frente => ({
                      value: frente.id,
                      label: frente.codigo_completo
                    }))}
                    value={ingresoRapido.id_frente_trabajo}
                    onChange={(value) => setIngresoRapido({ ...ingresoRapido, id_frente_trabajo: value })}
                    placeholder="Buscar frente..."
                    emptyMessage="No hay frentes disponibles"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jornada <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={ingresoRapido.jornada}
                    onChange={(e) => setIngresoRapido({ ...ingresoRapido, jornada: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  >
                    <option value="">Seleccione...</option>
                    {jornadas.map((jornada) => (
                      <option key={jornada} value={jornada}>
                        {jornada}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Cantidad *"
                  type="number"
                  min="1"
                  max="50"
                  value={ingresoRapido.cantidad}
                  onChange={(e) => setIngresoRapido({ ...ingresoRapido, cantidad: e.target.value })}
                  placeholder="Ej: 10"
                />

                <Input
                  label="Ley Visual (%)"
                  type="number"
                  step="0.001"
                  value={ingresoRapido.ley_visual}
                  onChange={(e) => setIngresoRapido({ ...ingresoRapido, ley_visual: e.target.value })}
                  placeholder="Ej: 2.300"
                  required
                />

                <Button
                  type="button"
                  variant="success"
                  onClick={handleIngresoRapido}
                  disabled={loading}
                  className="h-[42px]"
                >
                  ⚡ Crear {ingresoRapido.cantidad || 1} Dumpada(s)
                </Button>
              </div>

              <div className="mt-4 bg-green-50 border-2 border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-900">
                  <strong>💡 Tip:</strong> Use esta opción cuando tenga múltiples dumpadas de la misma frente y jornada.
                  Las filas se agregarán al formulario manual abajo donde puede modificarlas antes de guardar.
                </p>
              </div>
            </Card>

            {/* Separador visual */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              <span className="text-gray-500 font-semibold text-sm">o usar ingreso manual</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            </div>

            {/* Formulario de ingreso masivo */}
            <Card className="mb-6 border-l-4 border-blue-400">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    📝 Ingreso Masivo de Dumpadas
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Registre múltiples dumpadas a la vez • Agregue o elimine filas según necesite
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={agregarFilaIngreso}
                    icon={HiDocumentPlus}
                  >
                    Agregar Fila
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSubmitIngresoMasivo} className="space-y-4">
                <div className="space-y-4">
                  {formsIngresoMasivo.map((form, index) => (
                    <div key={form.id} className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border-2 border-blue-200 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="font-bold text-white">{index + 1}</span>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <SearchableSelect
                            label="Frente de Trabajo *"
                            options={frentes.map(frente => ({
                              value: frente.id,
                              label: frente.codigo_completo
                            }))}
                            value={form.id_frente_trabajo}
                            onChange={(value) => actualizarFilaIngreso(form.id, 'id_frente_trabajo', value)}
                            placeholder="Buscar frente..."
                            emptyMessage="No hay frentes disponibles"
                            required
                          />

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Jornada <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={form.jornada}
                              onChange={(e) => actualizarFilaIngreso(form.id, 'jornada', e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              <option value="">Seleccione...</option>
                              {jornadas.map((jornada) => (
                                <option key={jornada} value={jornada}>
                                  {jornada}
                                </option>
                              ))}
                            </select>
                          </div>

                          <Input
                            label="Ley Visual (%)"
                            type="number"
                            step="0.001"
                            value={form.ley_visual}
                            onChange={(e) => actualizarFilaIngreso(form.id, 'ley_visual', e.target.value)}
                            placeholder="Ej: 2.300"
                            required
                          />
                        </div>

                        {/* Botones de acción */}
                        <div className="flex-shrink-0 flex gap-2">
                          {/* Botón Duplicar - siempre visible */}
                          <button
                            type="button"
                            onClick={() => duplicarFilaIngreso(form.id)}
                            className="w-10 h-10 bg-purple-500 hover:bg-purple-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                            title="Duplicar fila"
                          >
                            <HiDocumentDuplicate className="w-5 h-5" />
                          </button>

                          {/* Botón Eliminar - solo si hay más de 1 fila */}
                          {formsIngresoMasivo.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarFilaIngreso(form.id)}
                              className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                              title="Eliminar fila"
                            >
                              <HiTrash className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>ℹ️ Información:</strong> Fecha actual, {tonelajeDumpadaDefault} Ton constante, N° Acopio automático.
                    Los campos Frente, Jornada y Ley Visual son obligatorios. Las filas completas se guardarán en estado "Ingresado" hasta agregar los resultados del laboratorio.
                  </p>
                </div>


                <div className="flex gap-3">
                  <Button
                    type="submit"
                    variant="success"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : `Registrar ${formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual).length} Dumpada(s)`}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetFormIngreso}
                  >
                    Limpiar Todo
                  </Button>
                </div>
              </form>
            </Card>

            {/* Registros Pendientes */}
            <Card className="border-l-4 border-yellow-400">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Registros Pendientes</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Total: <span className="font-semibold text-yellow-600">{pendientesTotalRecords}</span> registro{pendientesTotalRecords !== 1 ? 's' : ''} en espera de análisis de laboratorio
                    </p>
                  </div>

                  {/* Contador de selección */}
                  {selectedIds.length > 0 && (
                    <div className="bg-blue-100 border-2 border-blue-500 rounded-lg px-4 py-2">
                      <span className="text-blue-800 font-semibold">
                        {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Barra de acciones múltiples */}
                {selectedIds.length > 0 && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <HiCheckCircle className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-900">
                          {selectedIds.length} dumpada{selectedIds.length !== 1 ? 's' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleBulkDelete}
                          disabled={loading}
                        >
                          Eliminar Seleccionadas
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={clearSelection}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Filtros básicos para Registros Pendientes */}
              <TableFilters
                searchValue={pendientesSearchTerm}
                searchPlaceholder="Buscar por certificado, frente..."
                onSearchChange={handlePendientesSearchChange}
                alwaysExpanded={false}
                filters={[
                  {
                    name: 'jornada',
                    label: 'Jornada',
                    type: 'select',
                    options: jornadas.map(j => ({ value: j, label: j }))
                  },
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
                    name: 'fecha_inicio',
                    label: 'Fecha Desde',
                    type: 'date'
                  },
                  {
                    name: 'fecha_fin',
                    label: 'Fecha Hasta',
                    type: 'date'
                  }
                ]}
                filterValues={pendientesFilters}
                onFilterChange={handlePendientesFilterChange}
                onClear={handleClearPendientesFilters}
              />

              {pendientesData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No hay registros pendientes</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100">
                        <th className="text-center py-2 px-2 font-bold text-yellow-900 text-xs w-10">
                          <input
                            type="checkbox"
                            onChange={() => handleSelectAll(pendientesData)}
                            checked={selectedIds.length === pendientesData.length && selectedIds.length > 0}
                            className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
                          />
                        </th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Frente</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">N° Dump</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Jornada</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Fecha</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Ton</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Ley</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">Ley Cup</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Certificado</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">Ley Visual</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Rango</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...pendientesData].sort((a, b) => {
                        // Ordenar por fecha asc, luego frente, jornada, y numero_jornada asc
                        if (a.fecha !== b.fecha) return a.fecha > b.fecha ? 1 : -1;
                        if (a.id_frente_trabajo !== b.id_frente_trabajo) return a.id_frente_trabajo - b.id_frente_trabajo;
                        if (a.jornada !== b.jornada) return a.jornada.localeCompare(b.jornada);
                        return (a.numero_jornada || 0) - (b.numero_jornada || 0);
                      }).map((dumpada, index, sortedArray) => {
                        // Obtener el color según grupo (frente + jornada + fecha)
                        const backgroundColor = getBackgroundColorByGroup(sortedArray, index);

                        return (
                          <tr
                            key={dumpada.id}
                            style={{ backgroundColor }}
                            className={`border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150 ${selectedIds.includes(dumpada.id) ? 'bg-blue-100' : ''}`}
                          >
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(dumpada.id)}
                                onChange={() => handleSelectOne(dumpada.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-2" title={dumpada.frente_trabajo?.codigo_completo || '-'}>
                              <span className="font-bold text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded text-xs whitespace-nowrap">
                                {dumpada.frente_trabajo?.codigo_completo || '-'}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="font-mono font-bold text-gray-800 text-xs">
                                {dumpada.numero_dumpada ? String(dumpada.numero_dumpada) : '-'}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                                {dumpada.jornada}{dumpada.numero_jornada ? `-${dumpada.numero_jornada}` : ''}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-800">
                              <div className="flex flex-col">
                                <span className="font-semibold">{formatearFecha(dumpada.fecha)}</span>
                                {dumpada.created_at && (
                                  <span className="text-gray-500 text-[10px]">
                                    {dumpada.created_at.split(' ')[1]?.substring(0, 5)} hrs
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-700 font-semibold">
                              {dumpada.ton ? `${parseFloat(dumpada.ton).toFixed(2)}` : '-'}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-700">
                              {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(3)}%` : '-'}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-700">
                              {dumpada.ley_cup ? `${parseFloat(dumpada.ley_cup).toFixed(3)}%` : '-'}
                            </td>
                            <td className="py-2 px-2 text-xs">
                              {dumpada.certificado ? (
                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-mono border border-green-300" title={`Certificado: ${dumpada.certificado}`}>
                                  <HiCheckCircle className="w-3 h-3" />
                                  {dumpada.certificado}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-gray-400 text-[10px]">
                                  <HiXCircle className="w-3 h-3" />
                                  Sin cert.
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-700">
                              {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(3)}%` : '-'}
                            </td>
                            <td className="py-2 px-2">
                              {dumpada.rango ? (
                                <RangoTooltip rangoActual={dumpada.rango} rangos={rangos}>
                                  <span className={`${getRangoColor(dumpada.rango)} text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap`}>
                                    {dumpada.rango}
                                  </span>
                                </RangoTooltip>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-2">
                              <span className={`${getEstadoColor(dumpada.estado)} text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap`}>
                                {dumpada.estado}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación para Registros Pendientes */}
              {pendientesData.length > 0 && pendientesTotalPages > 1 && (
                <Pagination
                  currentPage={pendientesPage}
                  totalPages={pendientesTotalPages}
                  totalRecords={pendientesTotalRecords}
                  perPage={pendientesPerPage}
                  onPageChange={handlePendientesPageChange}
                />
              )}
            </Card>
          </>
        )}

        {/* Vista de Historial */}
        {vistaActual === 'historial' && (
          <Card className="border-l-4 border-blue-400">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Historial de Dumpadas</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Total: <span className="font-semibold text-blue-600">{totalRecords}</span> registro{totalRecords !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Indicador de filtros activos */}
            {(searchTerm || Object.values(filters).some(v => v)) && (
              <div className="mb-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-300 rounded-lg p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                      <HiFilter className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">
                        Filtros Activos
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Mostrando {dumpadas.length} de {totalRecords} registros • {Object.values({searchTerm, ...filters}).filter(v => v).length} filtro(s) aplicado(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Componente de Filtros - Siempre expandido */}
            <TableFilters
              searchValue={searchTerm}
              searchPlaceholder="Buscar por código de acopios, certificado, frente..."
              onSearchChange={handleSearchChange}
              alwaysExpanded={true}
              filters={[
                {
                  name: 'estado',
                  label: 'Estado',
                  type: 'select',
                  options: [
                    { value: 'Ingresado', label: 'Ingresado' },
                    { value: 'Completado', label: 'Completado' }
                  ]
                },
                {
                  name: 'jornada',
                  label: 'Jornada',
                  type: 'select',
                  options: jornadas.map(j => ({ value: j, label: j }))
                },
                {
                  name: 'id_faena',
                  label: 'Faena',
                  type: 'select',
                  options: faenas.map(f => ({
                    value: f.id,
                    label: f.ubicacion || f.nombre || `ID: ${f.id}`
                  }))
                },
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
                  name: 'fecha_inicio',
                  label: 'Fecha Desde',
                  type: 'date'
                },
                {
                  name: 'fecha_fin',
                  label: 'Fecha Hasta',
                  type: 'date'
                }
              ]}
              filterValues={filters}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
            />

            {loading && dumpadas.length === 0 ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Cargando historial...</p>
              </div>
            ) : dumpadas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-700 font-medium mb-2">No hay registros</p>
              </div>
            ) : (
              <>
                {/* Barra de acciones múltiples para historial */}
                {selectedIds.length > 0 && (
                  <div className="mb-4 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <HiCheckCircle className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-900">
                          {selectedIds.length} dumpada{selectedIds.length !== 1 ? 's' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleBulkDelete}
                          disabled={loading}
                        >
                          Eliminar Seleccionadas
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={clearSelection}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border-2 border-gray-200 shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="border-b-2 border-blue-300 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100">
                        <th className="text-center py-2 px-2 font-bold text-blue-900 text-xs w-10">
                          <input
                            type="checkbox"
                            onChange={() => handleSelectAll(dumpadas)}
                            checked={selectedIds.length === dumpadas.length && selectedIds.length > 0}
                            className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Código del frente de trabajo">Frente</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Faena de origen">Faena</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs whitespace-nowrap" title="Número de dumpada">N° Dump</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Jornada laboral">Jornada</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Fecha de registro">Fecha</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Toneladas">Ton</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Ley de laboratorio">Ley</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs whitespace-nowrap" title="Ley Cup de laboratorio">Ley Cup</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Número de certificado (se asigna al generar PDF)">Certificado</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs whitespace-nowrap" title="Ley visual en terreno">Ley Visual</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Rango calculado">Rango</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs" title="Estado del análisis">Estado</th>
                        <th className="text-left py-3 px-3 font-bold text-blue-900 text-xs">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...dumpadas].sort((a, b) => {
                        // Ordenar por fecha desc, luego frente, jornada, y numero_jornada asc
                        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
                        if (a.id_frente_trabajo !== b.id_frente_trabajo) return a.id_frente_trabajo - b.id_frente_trabajo;
                        if (a.jornada !== b.jornada) return a.jornada.localeCompare(b.jornada);
                        return (a.numero_jornada || 0) - (b.numero_jornada || 0);
                      }).map((dumpada, index, sortedArray) => {
                        // Obtener el color según grupo (frente + jornada + fecha)
                        const backgroundColor = getBackgroundColorByGroup(sortedArray, index);

                        return (
                          <tr
                            key={dumpada.id}
                            style={{ backgroundColor }}
                            className={`border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150 ${selectedIds.includes(dumpada.id) ? 'bg-blue-100' : ''}`}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(dumpada.id)}
                                onChange={() => handleSelectOne(dumpada.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3" title={dumpada.frente_trabajo?.codigo_completo || '-'}>
                              <span className="font-bold text-blue-900 bg-gradient-to-r from-blue-100 to-blue-200 px-2 py-1 rounded-md shadow-sm border border-blue-300 inline-block text-xs whitespace-nowrap">
                                {dumpada.frente_trabajo?.codigo_completo || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-3" title={dumpada.faena_info?.nombre || '-'}>
                              <span className="font-semibold text-purple-900 bg-gradient-to-r from-purple-100 to-purple-200 px-2 py-1 rounded-md shadow-sm border border-purple-300 inline-block text-xs whitespace-nowrap">
                                {dumpada.faena_info?.nombre || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-gray-900 text-xs">
                                {dumpada.numero_dumpada ? String(dumpada.numero_dumpada) : '-'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {dumpada.jornada ? (
                                <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm whitespace-nowrap">
                                  {dumpada.jornada}{dumpada.numero_jornada ? `-${dumpada.numero_jornada}` : ''}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-3 text-gray-800 text-xs">
                              <div className="flex flex-col">
                                <span className="font-semibold">{formatearFecha(dumpada.fecha)}</span>
                                {dumpada.created_at && (
                                  <span className="text-gray-500 text-[10px]">
                                    {dumpada.created_at.split(' ')[1]?.substring(0, 5)} hrs
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-gray-800 font-semibold text-xs">
                              {dumpada.ton ? `${parseFloat(dumpada.ton).toFixed(2)}` : '-'}
                            </td>
                            <td className="py-3 px-3 text-gray-700 text-xs">
                              {dumpada.ley ? (
                                <span className="font-medium">{parseFloat(dumpada.ley).toFixed(3)}%</span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-3 text-gray-700 text-xs">
                              {dumpada.ley_cup ? (
                                <span className="font-medium">{parseFloat(dumpada.ley_cup).toFixed(3)}%</span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-3 text-xs">
                              {dumpada.certificado ? (
                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded-md font-mono text-[10px] border border-green-300 shadow-sm" title={`Certificado: ${dumpada.certificado}`}>
                                  <HiCheckCircle className="w-3.5 h-3.5 text-green-600" />
                                  {dumpada.certificado}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-gray-400 text-[10px]">
                                  <HiXCircle className="w-3.5 h-3.5" />
                                  Sin cert.
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-gray-700 text-xs">
                              {dumpada.ley_visual ? (
                                <span className="font-medium text-purple-700">{parseFloat(dumpada.ley_visual).toFixed(3)}%</span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-3">
                              {dumpada.rango ? (
                                <RangoTooltip rangoActual={dumpada.rango} rangos={rangos}>
                                  <span className={`${getRangoColor(dumpada.rango)} text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm whitespace-nowrap cursor-help`}>
                                    {dumpada.rango}
                                  </span>
                                </RangoTooltip>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {dumpada.estado === 'Completado' ? (
                                <div className="flex items-center justify-center">
                                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-sm" title="Completado">
                                    <HiCheckCircle className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm" title="Ingresado">
                                    <HiXCircle className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEdit(dumpada)}
                                  className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                                  title="Editar dumpada"
                                >
                                  <HiPencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(dumpada.id)}
                                  className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                                  title="Eliminar dumpada"
                                >
                                  <HiTrash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Componente de Paginación */}
                {totalRecords > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalRecords={totalRecords}
                    perPage={perPage}
                    onPageChange={handlePageChange}
                    showInfo={true}
                    showFirstLast={true}
                  />
                )}
              </>
            )}
          </Card>
        )}

        {/* Vista de Acopios - Solo visible si el sistema de acopios está activado */}
        {vistaActual === 'acopios' && usarSistemaAcopios && (
          <AcopiosView
            toast={toast}
            formatearFecha={formatearFecha}
          />
        )}

        {/* Vista de Mezclas */}
        {vistaActual === 'mezclas' && (
          <MezclasView
            loading={loading}
            setLoading={setLoading}
            toast={toast}
            formatearFecha={formatearFecha}
            dumpadasDisponibles={dumpadasDisponibles}
            setDumpadasDisponibles={setDumpadasDisponibles}
            mezclas={mezclas}
            setMezclas={setMezclas}
            loadData={loadData}
            frentes={frentes}
            jornadas={jornadas}
          />
        )}

        {/* Vista de Mapa de Terreno */}
        {vistaActual === 'mapa' && (
          <MapaTerrenoMejorado
            toast={toast}
          />
        )}

        {/* Vista de Despachos */}
        {vistaActual === 'despachos' && (
          <DespachosView />
        )}

        {/* Vista de Configuracion */}
        {vistaActual === 'configuracion' && (
          <ConfiguracionView />
        )}
      </main>
    </div>
  );
}

// Wrapper con Provider de Faena
export default function Dispatch() {
  return (
    <FaenaProvider>
      <DispatchContent />
    </FaenaProvider>
  );
}
