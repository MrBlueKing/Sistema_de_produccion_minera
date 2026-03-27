import { useState, useEffect, useRef } from 'react';
import { HiHome, HiPencil, HiTrash, HiCheckCircle, HiXCircle, HiEye, HiChevronLeft, HiChevronRight, HiBeaker, HiCube, HiMap, HiTruck, HiClipboardDocumentList, HiCog6Tooth, HiDocumentPlus } from 'react-icons/hi2';
import { HiClipboardCheck, HiFilter } from "react-icons/hi";
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import BulkCompleteModal from '../../../shared/components/molecules/BulkCompleteModal';
import EditDumpadaModal from '../../../shared/components/molecules/EditDumpadaModal';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import RangoTooltip from '../../../shared/components/molecules/RangoTooltip';
import MezclasView from '../components/MezclasView';
import MapaTerrenoMejorado from '../components/MapaTerrenoMejorado';
import DespachosView from '../components/DespachosView';
import AcopiosView from '../components/AcopiosView';
import ConfiguracionView from '../components/ConfiguracionView';
import IngresoView from '../components/IngresoView';
import EnvioMuestrasView from '../components/EnvioMuestrasView';
import { FaenaProvider, useFaena } from '../../../contexts/FaenaContext';
import FaenaMultiSelector from '../../../shared/components/molecules/FaenaMultiSelector';
import useToast from '../../../hooks/useToast';
import useDebounce from '../../../hooks/useDebounce';
import { useConfig } from '../../../hooks/useConfig';
import { useAuth } from '../../../core/context/AuthContext';
import dispatchService from '../services/dispatch';
import mezclasService from '../services/mezclas';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import faenaService from '../../../services/faenaService';

// ✅ CONFIGURACIÓN: IDs de faenas que se mostrarán en el selector de Dispatch
// Para mostrar todas las faenas, dejar como null
// Para filtrar, especificar los IDs: const FAENAS_VISIBLES_DISPATCH = [1, 2, 4];
const FAENAS_VISIBLES_DISPATCH = [1, 2, 4]; // Solo mostrar faenas 1, 2 y 4

// Roles con acceso a pestañas avanzadas (Mapa de Terreno + Configuración)
const ROLES_ADMIN_DISPATCH = ['admin_dispatch'];

// Matriz de acceso por rol en el hub de Dispatch
const ACCESO_HUB = {
  ingreso:         ['admin_dispatch', 'encargado_dispatch', 'operador_dispatch', 'digitador_dispatch'],
  envio_muestras:  ['admin_dispatch', 'encargado_dispatch', 'muestreo_dispatch'],
  historial:       ['admin_dispatch', 'encargado_dispatch'],
  mezclas:         ['admin_dispatch', 'encargado_dispatch'],
  despachos:       ['admin_dispatch', 'encargado_dispatch'],
  configuracion:   ['admin_dispatch'],
};

function DispatchContent() {
  const { esUsuarioGlobal, esDigitador, faenaUsuario, faenaSeleccionada } = useFaena();
  const { getRolActivo, getUserInfo } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const rolActivo = getRolActivo();
  const esAdmin = ROLES_ADMIN_DISPATCH.includes(rolActivo);
  const puedeVer = (seccion) => !rolActivo || ACCESO_HUB[seccion]?.includes(rolActivo);

  const userInfo = getUserInfo();
  const userNombre = userInfo?.nombre || '';
  const getSaludo = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [rangos, setRangos] = useState([]);
  const [faenas, setFaenas] = useState([]);
  const [selectedFaenas, setSelectedFaenas] = useState([]); // ✅ Array de faenas seleccionadas

  // Determinar la faena activa para cargar configuraciones (usado para mostrar en UI)
  // - Operador: siempre su faena asignada
  // - Encargado: usa la faena del selector si hay exactamente 1 seleccionada
  // Nota: El tonelaje real se determina en el backend según la faena del frente de trabajo
  const faenaActivaConfig = esUsuarioGlobal
    ? (selectedFaenas.length === 1 ? selectedFaenas[0] : faenaSeleccionada)
    : faenaUsuario;
  const { tonelajeDumpadaDefault, usarSistemaAcopios } = useConfig(faenaActivaConfig);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, acopio: '' });
  const [editModal, setEditModal] = useState({ show: false, dumpada: null });

  // Selección múltiple (historial)
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkCompleteModal, setShowBulkCompleteModal] = useState(false);

  // Paginación (Historial)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Vista actual: 'menu', 'ingreso', 'historial', 'acopios', 'mezclas', 'mapa', 'despachos' o 'configuracion'
  const [vistaActual, setVistaActual] = useState('menu');

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

  // Lista de máquinas/dumpers para el selector
  const [maquinas, setMaquinas] = useState([]);

  // Estados para Mezclas
  const [dumpadasDisponibles, setDumpadasDisponibles] = useState([]);
  const [mezclas, setMezclas] = useState([]);

  // Nombre de la faena activa para mostrar en el banner
  const [faenaNombreDisplay, setFaenaNombreDisplay] = useState('');

  // KPIs semanales del hub
  const [resumenSemana, setResumenSemana] = useState([]);
  const [resumenSemanaInfo, setResumenSemanaInfo] = useState(null);

  // Flag para saber si ya se inicializó (evita cargas duplicadas)
  const [initialized, setInitialized] = useState(false);

  // Flag para la carga inicial (muestra full-page loader solo una vez)
  const [isInitializing, setIsInitializing] = useState(true);

  // Ref para evitar cargas concurrentes
  const loadingRef = useRef(false);

  // Cargar máquinas disponibles desde el sistema de petróleo
  useEffect(() => {
    const loadMaquinas = async () => {
      try {
        const res = await dispatchService.getMaquinas();
        setMaquinas(res.data || []);
      } catch (error) {
        console.warn('⚠️ No se pudieron cargar máquinas:', error.message);
      }
    };
    loadMaquinas();
  }, []);

  // Resolver nombre de la faena activa para el banner
  useEffect(() => {
    if (faenas.length === 0) return;

    // Siempre mostrar la faena asignada del usuario
    const idFaena = faenaUsuario?.id ?? faenaUsuario;
    if (!idFaena) return;
    const encontrada = faenas.find(f => String(f.id) === String(idFaena));
    if (encontrada) setFaenaNombreDisplay(encontrada.ubicacion || encontrada.nombre || '');
  }, [faenas, selectedFaenas, faenaUsuario, esUsuarioGlobal]);

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
        setInitialized(true);
      }
      if (vistaActual === 'historial' || vistaActual === 'mezclas') {
        loadData();
      }
      if (vistaActual === 'menu') {
        loadResumenSemana();
      }
      loadFrentes();
    }
  }, [selectedFaenas]);

  // Cargar data cuando cambia la vista (solo si ya está inicializado)
  useEffect(() => {
    if (initialized) {
      loadData();
      if (vistaActual === 'menu') {
        loadResumenSemana();
      }
    }
  }, [vistaActual]);

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
      setIsInitializing(false);
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

      setFrentes(frentesRes.data || []);
    } catch (error) {
      console.error('❌ Error cargando frentes:', error);
    }
  };

  const loadResumenSemana = async () => {
    try {
      const params = {};
      if (esUsuarioGlobal && selectedFaenas.length > 0) {
        params.id_faena = selectedFaenas.join(',');
      }
      const res = await dispatchService.getResumenSemana(params);
      setResumenSemana(res.data || []);
      setResumenSemanaInfo(res.semana || null);
    } catch (error) {
      console.warn('⚠️ Error cargando resumen semanal:', error.message);
    }
  };

  const loadData = async () => {
    // No cargar datos en estas vistas (tienen sus propios componentes)
    if (vistaActual === 'menu' || vistaActual === 'ingreso' || vistaActual === 'envio_muestras') return;
    // Evitar cargas concurrentes
    if (loadingRef.current) {
      console.log('⏳ [DISPATCH] Carga en progreso, ignorando llamada duplicada');
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      if (vistaActual === 'mezclas') {
        // Filtrar por faena según rol
        let idFaenaParam = undefined;
        if (esUsuarioGlobal && selectedFaenas.length > 0) {
          idFaenaParam = selectedFaenas.join(',');
        } else if (!esUsuarioGlobal && faenaUsuario) {
          idFaenaParam = faenaUsuario;
        }

        const mezclaParams = idFaenaParam ? { id_faena: idFaenaParam } : {};

        // Cargar datos para vista de mezclas
        const [disponibles, mezclasRes] = await Promise.all([
          mezclasService.getDumpadasDisponibles(mezclaParams),
          mezclasService.getMezclas(),
        ]);

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

        }

        const dumpadasRes = await dispatchService.getDumpadas(params);

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
    } catch (error) {
      console.error('❌ Error eliminando dumpadas:', error);
      toast.error('Error al eliminar', error.response?.data?.message || 'No se pudieron eliminar las dumpadas');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Dashboard Central',
                href: import.meta.env.VITE_CENTRAL_URL,
                onClick: (e) => { e.preventDefault(); handleGoBack(); },
                icon: HiHome
              },
              ...(vistaActual !== 'menu'
                ? [
                    {
                      label: 'Dispatch',
                      href: '#',
                      onClick: (e) => { e.preventDefault(); setVistaActual('menu'); }
                    },
                    {
                      label:
                        vistaActual === 'ingreso' ? 'Ingreso de Dumpadas' :
                        vistaActual === 'envio_muestras' ? 'Envío de Muestras' :
                        vistaActual === 'historial' ? 'Historial' :
                        vistaActual === 'mezclas' ? 'Mezclas' :
                        vistaActual === 'despachos' ? 'Despachos' :
                        vistaActual === 'acopios' ? 'Acopios' :
                        vistaActual === 'mapa' ? 'Mapa de Terreno' :
                        vistaActual === 'configuracion' ? 'Configuración' : ''
                    }
                  ]
                : [{ label: 'Dispatch' }]
              )
            ]}
          />
        </div>

        {/* Selector Multi-Faena - Solo para encargado_dispatch */}
        {/* TEMPORALMENTE OCULTO - descomentar para restaurar
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
        */}

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

        {/* Hub de Dispatch */}
        {vistaActual === 'menu' && (
          <div className="space-y-6 mb-6">

            {/* Banner operacional */}
            <div className="bg-white rounded-2xl px-8 py-6 border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
              <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">Módulo Dispatch</p>
              <h2 className="text-2xl font-bold text-gray-900">
                {faenaNombreDisplay || 'Cargando faena...'}
              </h2>
              <p className="text-gray-400 text-sm mt-1 capitalize">
                {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Grid de módulos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

              {puedeVer('ingreso') && (
                <button
                  onClick={() => setVistaActual('ingreso')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiDocumentPlus className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Ingreso de Dumpadas</p>
                    <p className="text-xs text-gray-400 mt-0.5">Registro de nuevas dumpadas</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {puedeVer('envio_muestras') && (
                <button
                  onClick={() => setVistaActual('envio_muestras')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiClipboardDocumentList className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Envío de Muestras</p>
                    <p className="text-xs text-gray-400 mt-0.5">Pendientes y muestras libres</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {puedeVer('historial') && (
                <button
                  onClick={() => { setVistaActual('historial'); setCurrentPage(1); }}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiEye className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Historial</p>
                    <p className="text-xs text-gray-400 mt-0.5">Registros y auditoría</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {puedeVer('mezclas') && (
                <button
                  onClick={() => setVistaActual('mezclas')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiBeaker className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Mezclas</p>
                    <p className="text-xs text-gray-400 mt-0.5">Composición y análisis</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {puedeVer('despachos') && (
                <button
                  onClick={() => setVistaActual('despachos')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiTruck className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Despachos</p>
                    <p className="text-xs text-gray-400 mt-0.5">Control de despachos</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {usarSistemaAcopios && !esDigitador && (
                <button
                  onClick={() => setVistaActual('acopios')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiCube className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Acopios</p>
                    <p className="text-xs text-gray-400 mt-0.5">Gestión de acopios</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {puedeVer('configuracion') && (
                <button
                  onClick={() => setVistaActual('mapa')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiMap className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Mapa de Terreno</p>
                    <p className="text-xs text-gray-400 mt-0.5">Visualización del terreno</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {puedeVer('configuracion') && (
                <button
                  onClick={() => setVistaActual('configuracion')}
                  className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors duration-200">
                    <HiCog6Tooth className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Configuración</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ajustes del sistema</p>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                </button>
              )}

            </div>

            {/* KPIs semanales por frente de trabajo */}
            {!esDigitador && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Resumen Mensual por Frente</h3>
                    {resumenSemanaInfo && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(resumenSemanaInfo.inicio + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                {resumenSemana.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-400 text-sm">Sin registros este mes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {resumenSemana.map((frente) => (
                      <div key={frente.id_frente_trabajo} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Header del frente */}
                        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
                          <p className="text-white font-bold text-sm truncate">{frente.frente}</p>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <div className="text-right">
                              <p className="text-white font-bold text-lg leading-none">{frente.total_dumpadas}</p>
                              <p className="text-gray-400 text-xs">dumpadas</p>
                            </div>
                            <div className="w-px h-8 bg-gray-700" />
                            <div className="text-right">
                              <p className="text-orange-400 font-bold text-lg leading-none">{frente.ton_total.toLocaleString('es-CL')}</p>
                              <p className="text-gray-400 text-xs">ton</p>
                            </div>
                          </div>
                        </div>

                        {/* Filas por jornada */}
                        <div className="divide-y divide-gray-100">
                          {frente.jornadas.map((j) => (
                            <div key={j.jornada} className="px-4 py-2.5 flex items-center gap-3">
                              {/* Badge jornada */}
                              <span className={`inline-flex items-center justify-center w-20 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                                j.jornada === 'AM'        ? 'bg-yellow-100 text-yellow-700' :
                                j.jornada === 'PM'        ? 'bg-blue-100 text-blue-700' :
                                j.jornada === 'Noche'     ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-purple-100 text-purple-700'
                              }`}>{j.jornada}</span>

                              {/* Stats */}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-xs text-gray-600 font-medium">{j.total_dumpadas} dump</span>
                                <span className="text-gray-300 text-xs">·</span>
                                <span className="text-xs text-gray-600">{j.ton_total.toLocaleString('es-CL')} t</span>
                                {j.ley_promedio !== null && (
                                  <>
                                    <span className="text-gray-300 text-xs">·</span>
                                    <span className="text-xs font-semibold text-orange-600">Ley {j.ley_promedio}%</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Máquinas usadas */}
                          {frente.jornadas.some(j => j.maquinas.length > 0) && (
                            <div className="px-4 py-2 flex items-center gap-2 bg-gray-50">
                              <HiTruck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <p className="text-xs text-gray-500 truncate">
                                {[...new Set(frente.jornadas.flatMap(j => j.maquinas))].join(', ') || '—'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Header de sección activa */}
        {vistaActual !== 'menu' && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {vistaActual === 'ingreso' && 'Ingreso de Dumpadas'}
                  {vistaActual === 'envio_muestras' && 'Envío de Muestras'}
                  {vistaActual === 'historial' && 'Historial'}
                  {vistaActual === 'mezclas' && 'Mezclas'}
                  {vistaActual === 'despachos' && 'Despachos'}
                  {vistaActual === 'acopios' && 'Acopios'}
                  {vistaActual === 'mapa' && 'Mapa de Terreno'}
                  {vistaActual === 'configuracion' && 'Configuración'}
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {vistaActual === 'ingreso' && 'Registro de nuevas dumpadas'}
                  {vistaActual === 'envio_muestras' && 'Pendientes de laboratorio y muestras libres'}
                  {vistaActual === 'historial' && `${totalRecords} registros`}
                  {vistaActual === 'mezclas' && `${mezclas.length} mezclas activas`}
                  {vistaActual === 'despachos' && 'Control de despachos'}
                  {vistaActual === 'acopios' && 'Gestión de acopios'}
                  {vistaActual === 'mapa' && 'Visualización del terreno'}
                  {vistaActual === 'configuracion' && 'Ajustes del sistema'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Ingreso */}
        {vistaActual === 'ingreso' && (
          <IngresoView
            frentes={frentes}
            jornadas={jornadas}
            maquinas={maquinas}
            tonelajeDumpadaDefault={tonelajeDumpadaDefault}
            usarSistemaAcopios={usarSistemaAcopios}
          />
        )}

        {/* Vista de Envío de Muestras */}
        {vistaActual === 'envio_muestras' && (
          <EnvioMuestrasView
            frentes={frentes}
            jornadas={jornadas}
            rangos={rangos}
            esUsuarioGlobal={esUsuarioGlobal}
            selectedFaenas={selectedFaenas}
          />
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
                        // Ordenar por ID descendente (últimos registros arriba)
                        return b.id - a.id;
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

        {/* Vista de Mapa de Terreno - Solo admin */}
        {vistaActual === 'mapa' && esAdmin && (
          <MapaTerrenoMejorado
            toast={toast}
          />
        )}

        {/* Vista de Despachos */}
        {vistaActual === 'despachos' && (
          <DespachosView />
        )}

        {/* Vista de Configuración - Solo admin */}
        {vistaActual === 'configuracion' && esAdmin && (
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
