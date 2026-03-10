import { useState, useEffect } from 'react';
import { HiHome, HiCheckCircle, HiInformationCircle, HiClipboardDocumentList, HiArrowPath } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../services/laboratorio';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import api from '../../../core/services/api';

// Estados de muestreo (simplificados)
const ESTADOS_MUESTREO = {
  INGRESADO: 'Ingresado', // Estado inicial cuando se crea la dumpada
  RECIBIDO: 'Recibido',   // Cuando la muestra llega al laboratorio
};

export default function Muestreo() {
  const toast = useToast();
  const [faenas, setFaenas] = useState([]);
  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);

  // Vista actual: 'por_recibir' o 'recibidas'
  const [vistaActual, setVistaActual] = useState('por_recibir');

  // Seleccion multiple (solo para vista por_recibir)
  const [selectedIds, setSelectedIds] = useState([]);

  // Paginacion
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

  // Estados de filtros (sin estado, se maneja con pestañas)
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    id_faena: '',
    jornada: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_frente_trabajo: '',
  });

  // Debounce para la busqueda
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];

  useEffect(() => {
    loadData();
    loadMaestros();
    loadFaenas();
    loadEstadisticas();
  }, []);

  useEffect(() => {
    loadData();
  }, [currentPage, debouncedSearchTerm, filters, vistaActual]);

  // Cambiar vista y resetear página
  const handleCambiarVista = (nuevaVista) => {
    if (nuevaVista === vistaActual) return; // Evitar recargar si es la misma vista

    // Limpiar datos antes de cambiar para evitar flash de datos incorrectos
    setDumpadas([]);
    setTotalRecords(0);
    setTotalPages(1);
    setVistaActual(nuevaVista);
    setCurrentPage(1);
    clearSelection();
  };

  const loadFaenas = async () => {
    try {
      const response = await api.get('/faenas');
      setFaenas(response.data.data || []);
    } catch (error) {
      console.error('Error cargando faenas:', error);
      setFaenas([]);
    }
  };

  const loadMaestros = async () => {
    try {
      const frentesRes = await ingenieriaService.getFrentesTrabajo({ solo_activos: true, per_page: 1000 });
      setFrentes(frentesRes.data || []);
    } catch (error) {
      console.error('Error cargando maestros:', error);
    }
  };

  const loadEstadisticas = async () => {
    try {
      const statsRes = await laboratorioService.getEstadisticasMuestreo();
      setEstadisticas(statsRes.data);
    } catch (error) {
      console.error('Error cargando estadisticas:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);

    try {
      // Determinar el estado según la vista actual
      const estadoFiltro = vistaActual === 'por_recibir'
        ? ESTADOS_MUESTREO.INGRESADO
        : ESTADOS_MUESTREO.RECIBIDO;

      const params = {
        page: currentPage,
        per_page: perPage,
        search: debouncedSearchTerm || undefined,
        id_faena: filters.id_faena || undefined,
        jornada: filters.jornada || undefined,
        fecha_inicio: filters.fecha_inicio || undefined,
        fecha_fin: filters.fecha_fin || undefined,
        id_frente_trabajo: filters.id_frente_trabajo || undefined,
        estado: estadoFiltro, // Estado automático según vista
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const dumpadasRes = await laboratorioService.getDumpadasMuestreo(params);

      setDumpadas(dumpadasRes.data || []);

      if (dumpadasRes.pagination) {
        setTotalPages(dumpadasRes.pagination.last_page);
        setTotalRecords(dumpadasRes.pagination.total);
      }

    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error(
        'Error al cargar datos',
        error.response?.data?.message || error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';

    if (typeof fecha === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fecha)) {
      return fecha;
    }

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return '-';

    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();

    return `${dia}-${mes}-${anio}`;
  };

  const esHoy = (fecha) => {
    if (!fecha) return false;
    const hoy = new Date();
    const fechaDumpada = new Date(fecha);
    return hoy.toDateString() === fechaDumpada.toDateString();
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
      id_faena: '',
      jornada: '',
      fecha_inicio: '',
      fecha_fin: '',
      id_frente_trabajo: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Funciones de seleccion multiple
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

  // Cambiar estado individual
  const handleCambiarEstado = async (dumpada, nuevoEstado) => {
    try {
      await laboratorioService.actualizarEstadoMuestreo(dumpada.id, nuevoEstado);
      toast.success('Estado actualizado', `Dumpada #${dumpada.numero_dumpada} marcada como "${nuevoEstado}"`);
      await loadData();
      await loadEstadisticas();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error', error.response?.data?.message || 'No se pudo actualizar el estado');
    }
  };

  // Cambiar estado multiple
  const handleCambiarEstadoMultiple = async (nuevoEstado) => {
    if (selectedIds.length === 0) {
      toast.warning('Atencion', 'Debes seleccionar al menos una dumpada');
      return;
    }

    setLoading(true);
    try {
      await laboratorioService.actualizarEstadoMuestreoMultiple(selectedIds, nuevoEstado);
      toast.success(
        `${selectedIds.length} muestra(s) recibida(s)`,
        'Las muestras han sido marcadas como recibidas'
      );
      clearSelection();
      await loadData();
      await loadEstadisticas();
    } catch (error) {
      console.error('Error actualizando estados:', error);
      toast.error('Error', error.response?.data?.message || 'No se pudieron actualizar los estados');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  const getEstadoColor = (estado) => {
    const colors = {
      'Ingresado': 'bg-gray-500',    // Estado inicial - Por Recibir
      'Recibido': 'bg-blue-500',     // Muestra recibida en laboratorio
    };
    return colors[estado] || 'bg-gray-400';
  };

  // Ordenar dumpadas por fecha desc, frente, jornada y numero_jornada asc
  const dumpadasOrdenadas = [...dumpadas].sort((a, b) => {
    // Ordenar por fecha desc, luego frente, jornada, y numero_jornada asc
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.id_frente_trabajo !== b.id_frente_trabajo) return a.id_frente_trabajo - b.id_frente_trabajo;
    if (a.jornada !== b.jornada) return a.jornada.localeCompare(b.jornada);
    return (a.numero_jornada || 0) - (b.numero_jornada || 0);
  });

  // Calcular colores de grupo (cambia cuando cambia el frente de trabajo)
  // Usa los mismos colores que Dispatch: naranja durazno y azul cielo
  const calcularColoresGrupo = () => {
    const colores = [];
    const paletaColores = ['#fed7aa', '#bfdbfe']; // Naranja durazno y azul cielo
    let colorActual = paletaColores[0];
    let grupoAnterior = null;

    dumpadasOrdenadas.forEach((dumpada, index) => {
      const grupoActual = dumpada.id_frente_trabajo || '';

      if (index === 0) {
        colores.push(colorActual);
        grupoAnterior = grupoActual;
        return;
      }

      if (grupoActual !== grupoAnterior) {
        colorActual = colorActual === paletaColores[0] ? paletaColores[1] : paletaColores[0];
      }

      colores.push(colorActual);
      grupoAnterior = grupoActual;
    });

    return colores;
  };

  const coloresGrupo = calcularColoresGrupo();

  if (loading && dumpadas.length === 0 && frentes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos de muestreo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Dashboard Central',
                href: import.meta.env.VITE_CENTRAL_URL,
                onClick: (e) => {
                  e.preventDefault();
                  handleGoBack();
                },
                icon: HiHome
              },
              {
                label: 'Laboratorio - Muestreo'
              }
            ]}
          />
        </div>

        {/* Header con estadisticas */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <HiClipboardDocumentList className="w-8 h-8 text-teal-600" />
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">
                    Laboratorio - Muestreo
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {totalRecords} muestra{totalRecords !== 1 ? 's' : ''} pendiente{totalRecords !== 1 ? 's' : ''} de muestreo
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={loadData}
                icon={HiArrowPath}
                disabled={loading}
              >
                Actualizar
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowInfo(!showInfo)}
                icon={HiInformationCircle}
              >
                {showInfo ? 'Ocultar' : 'Ayuda'}
              </Button>
            </div>
          </div>

          {/* Estadisticas simplificadas */}
          {estadisticas && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-200">
                <div className="text-sm font-semibold text-orange-800 mb-1">Hoy</div>
                <div className="text-3xl font-bold text-orange-900">{estadisticas.hoy}</div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border-2 border-gray-200">
                <div className="text-sm font-semibold text-gray-800 mb-1">Por Recibir</div>
                <div className="text-3xl font-bold text-gray-900">{estadisticas.ingresadas}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
                <div className="text-sm font-semibold text-blue-800 mb-1">Recibidas</div>
                <div className="text-3xl font-bold text-blue-900">{estadisticas.recibidas}</div>
              </div>
            </div>
          )}

          {/* Pestañas de navegación */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="flex gap-4" aria-label="Tabs">
              <button
                onClick={() => handleCambiarVista('por_recibir')}
                disabled={loading}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  vistaActual === 'por_recibir'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${loading ? 'cursor-wait' : ''}`}
              >
                {loading && vistaActual === 'por_recibir' && (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-teal-200 border-t-teal-600"></div>
                )}
                Por Recibir
                {estadisticas && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    vistaActual === 'por_recibir' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {estadisticas.ingresadas}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleCambiarVista('recibidas')}
                disabled={loading}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  vistaActual === 'recibidas'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${loading ? 'cursor-wait' : ''}`}
              >
                {loading && vistaActual === 'recibidas' && (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-200 border-t-blue-600"></div>
                )}
                Recibidas
                {estadisticas && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    vistaActual === 'recibidas' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {estadisticas.recibidas}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Panel de Informacion */}
        {showInfo && (
          <Card className="mb-6 border-l-4 border-teal-400 bg-teal-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <HiInformationCircle className="w-7 h-7 text-teal-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-teal-900 mb-4">Informacion del Modulo de Muestreo</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-teal-800 mb-2">Funcion del Muestreo</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>Visualizar dumpadas sin leyes ingresadas</li>
                      <li>Gestionar el estado del proceso de muestreo</li>
                      <li>Las del dia actual aparecen primero</li>
                      <li>Se agrupan visualmente por frente de trabajo</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-teal-800 mb-2">Estados del Muestreo</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-500 text-white px-2 py-1 rounded text-xs font-bold">Ingresado</span>
                        <span className="text-xs">Muestra pendiente de recibir</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">Recibido</span>
                        <span className="text-xs">Muestra recibida en laboratorio</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Listado de muestras */}
        <Card className={`border-l-4 ${vistaActual === 'por_recibir' ? 'border-teal-400' : 'border-blue-400'}`}>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {vistaActual === 'por_recibir' ? 'Muestras Por Recibir' : 'Muestras Recibidas'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Total: <span className={`font-semibold ${vistaActual === 'por_recibir' ? 'text-teal-600' : 'text-blue-600'}`}>{totalRecords}</span> muestra{totalRecords !== 1 ? 's' : ''}
              {vistaActual === 'por_recibir' ? ' pendientes de recibir' : ' ya recibidas'}
            </p>
          </div>

          {/* Componente de Filtros - Siempre visible */}
          <TableFilters
            searchValue={searchTerm}
            searchPlaceholder="Buscar por codigo, numero dumpada, frente..."
            onSearchChange={handleSearchChange}
            filters={[
              {
                name: 'id_faena',
                label: 'Faena',
                type: 'select',
                options: faenas.map(f => ({
                  value: f.id,
                  label: f.ubicacion || f.nombre || `Faena ${f.id}`
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
                name: 'jornada',
                label: 'Jornada',
                type: 'select',
                options: jornadas.map(j => ({ value: j, label: j }))
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
            alwaysExpanded={true}
          />

          {loading ? (
            <div className="text-center py-16">
              <div className={`animate-spin rounded-full h-14 w-14 border-4 ${vistaActual === 'por_recibir' ? 'border-teal-200 border-t-teal-600' : 'border-blue-200 border-t-blue-600'} mx-auto mb-4`}></div>
              <p className={`font-semibold ${vistaActual === 'por_recibir' ? 'text-teal-700' : 'text-blue-700'}`}>
                {vistaActual === 'por_recibir' ? 'Cargando muestras por recibir...' : 'Cargando muestras recibidas...'}
              </p>
              <p className="text-gray-500 text-sm mt-1">Esto puede tomar un momento</p>
            </div>
          ) : dumpadas.length === 0 ? (
            <div className="text-center py-12">
              <HiCheckCircle className={`w-16 h-16 ${vistaActual === 'por_recibir' ? 'text-green-500' : 'text-blue-500'} mx-auto mb-4`} />
              <p className="text-gray-700 font-medium mb-2">
                {vistaActual === 'por_recibir' ? 'No hay muestras pendientes de recibir' : 'No hay muestras recibidas'}
              </p>
              <p className="text-gray-600 text-sm">
                {vistaActual === 'por_recibir' ? 'Todas las muestras han sido recibidas' : 'Aún no se han recibido muestras'}
              </p>
            </div>
          ) : (
            <>
              {/* Barra de acciones multiples - Solo en vista "por_recibir" */}
              {vistaActual === 'por_recibir' && selectedIds.length > 0 && (
                <div className="mb-4 bg-gradient-to-r from-teal-50 to-teal-100 border-2 border-teal-300 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <HiCheckCircle className="w-5 h-5 text-teal-600" />
                      <span className="font-semibold text-teal-900">
                        {selectedIds.length} muestra{selectedIds.length !== 1 ? 's' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleCambiarEstadoMultiple(ESTADOS_MUESTREO.RECIBIDO)}
                        disabled={loading}
                      >
                        Recibir Seleccionadas
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

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b-2 ${vistaActual === 'por_recibir' ? 'border-teal-200 bg-gradient-to-r from-teal-50 to-teal-100' : 'border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100'}`}>
                      {vistaActual === 'por_recibir' && (
                        <th className="text-center py-3 px-2 font-bold text-teal-900 text-xs w-10">
                          <input
                            type="checkbox"
                            onChange={() => handleSelectAll(dumpadasOrdenadas)}
                            checked={selectedIds.length === dumpadasOrdenadas.length && selectedIds.length > 0}
                            className="w-4 h-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                          />
                        </th>
                      )}
                      <th className={`text-left py-3 px-2 font-bold ${vistaActual === 'por_recibir' ? 'text-teal-900' : 'text-blue-900'} text-xs`}>Faena</th>
                      <th className={`text-left py-3 px-2 font-bold ${vistaActual === 'por_recibir' ? 'text-teal-900' : 'text-blue-900'} text-xs`}>Frente</th>
                      <th className={`text-left py-3 px-2 font-bold ${vistaActual === 'por_recibir' ? 'text-teal-900' : 'text-blue-900'} text-xs`}>Fecha</th>
                      <th className={`text-left py-3 px-2 font-bold ${vistaActual === 'por_recibir' ? 'text-teal-900' : 'text-blue-900'} text-xs`}>Jornada</th>
                      <th className={`text-left py-3 px-2 font-bold ${vistaActual === 'por_recibir' ? 'text-teal-900' : 'text-blue-900'} text-xs`}>Estado</th>
                      {vistaActual === 'por_recibir' && (
                        <th className="text-left py-3 px-2 font-bold text-teal-900 text-xs">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {dumpadasOrdenadas.map((dumpada, index) => {
                      const isHoy = esHoy(dumpada.fecha);
                      const backgroundColor = isHoy ? '#fef3c7' : coloresGrupo[index];

                      return (
                        <tr
                          key={dumpada.id}
                          style={{ backgroundColor }}
                          data-group-index={index}
                          data-bg-color={backgroundColor}
                          className={`border-b border-gray-200 hover:opacity-90 transition-all ${vistaActual === 'por_recibir' && selectedIds.includes(dumpada.id) ? 'ring-2 ring-teal-400' : ''} ${isHoy ? 'border-l-4 border-l-orange-400' : ''}`}
                        >
                          {/* Checkbox - Solo en vista por_recibir */}
                          {vistaActual === 'por_recibir' && (
                            <td className="py-3 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(dumpada.id)}
                                onChange={() => handleSelectOne(dumpada.id)}
                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                            </td>
                          )}

                          {/* Faena */}
                          <td className="py-3 px-2">
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {dumpada.faena || dumpada.faena_info?.nombre || '-'}
                            </span>
                          </td>

                          {/* Frente de Trabajo */}
                          <td className="py-3 px-2" title={dumpada.frente_trabajo?.codigo_completo || '-'}>
                            <span className={`font-bold ${vistaActual === 'por_recibir' ? 'text-teal-900 bg-teal-100' : 'text-blue-900 bg-blue-100'} px-2 py-1 rounded text-xs whitespace-nowrap`}>
                              {dumpada.frente_trabajo?.codigo_completo || '-'}
                            </span>
                          </td>

                          {/* Fecha */}
                          <td className="py-3 px-2 text-xs text-gray-800">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                {isHoy && (
                                  <span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[9px] font-bold">HOY</span>
                                )}
                                <span className="font-semibold">{formatearFecha(dumpada.fecha)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Jornada */}
                          <td className="py-3 px-2">
                            <span className={`${vistaActual === 'por_recibir' ? 'bg-teal-600' : 'bg-blue-600'} text-white px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap`}>
                              {dumpada.jornada}{dumpada.numero_jornada ? `-${dumpada.numero_jornada}` : ''}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="py-3 px-2">
                            <span className={`${getEstadoColor(dumpada.estado)} text-white px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap`}>
                              {dumpada.estado || 'Ingresado'}
                            </span>
                          </td>

                          {/* Acción - Solo en vista por_recibir */}
                          {vistaActual === 'por_recibir' && (
                            <td className="py-3 px-2">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleCambiarEstado(dumpada, ESTADOS_MUESTREO.RECIBIDO)}
                                title="Marcar como Recibido"
                              >
                                Recibir
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Componente de Paginacion */}
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
      </main>
    </div>
  );
}
