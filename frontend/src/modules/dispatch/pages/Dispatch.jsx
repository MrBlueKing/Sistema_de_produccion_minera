import { useState, useEffect } from 'react';
import { HiHome, HiPencil, HiTrash, HiInformationCircle, HiCheckCircle, HiXCircle, HiEye, HiDocumentPlus, HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
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
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import dispatchService from '../services/dispatch';
import ingenieriaService from '../../ingenieria/services/ingenieria';

export default function Dispatch() {
  const navigate = useNavigate();
  const toast = useToast();
  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [rangos, setRangos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, acopio: '' });
  const [editModal, setEditModal] = useState({ show: false, dumpada: null });

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkCompleteModal, setShowBulkCompleteModal] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Vista actual: 'ingreso' o 'historial'
  const [vistaActual, setVistaActual] = useState('ingreso');

  // Estados de filtros (solo para vista historial)
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    estado: '',
    jornada: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_frente_trabajo: '',
  });

  // Debounce para la búsqueda
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];
  const TONELADAS_CONSTANTE = 4.6;

  // Ingreso masivo: array de formularios
  const [formsIngresoMasivo, setFormsIngresoMasivo] = useState([
    {
      id: 1,
      id_frente_trabajo: '',
      jornada: '',
      ley_visual: '',
    }
  ]);


  useEffect(() => {
    loadData();
    loadMaestros();
  }, []);

  useEffect(() => {
    if (vistaActual === 'historial') {
      loadData();
    }
  }, [currentPage, vistaActual, debouncedSearchTerm, filters]);

  const loadMaestros = async () => {
    try {
      const [frentesRes, rangosRes] = await Promise.all([
        // Cargar TODAS las frentes activas sin paginación (per_page=1000 para asegurar que traiga todas)
        ingenieriaService.getFrentesTrabajo({ solo_activos: true, per_page: 1000 }),
        dispatchService.getRangos(),
      ]);

      console.log('📊 Frentes cargadas:', frentesRes.data?.length || 0);
      console.log('📋 Total en BD según paginación:', frentesRes.pagination?.total || 'N/A');

      setFrentes(frentesRes.data || []);
      setRangos(rangosRes.data || []);
    } catch (error) {
      console.error('❌ Error cargando maestros:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);

    try {
      let params = {};

      if (vistaActual === 'historial') {
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

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
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

  // Ingreso masivo - Guardar todas las filas
  const handleSubmitIngresoMasivo = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validar que todas las filas estén completas
    const filasValidas = formsIngresoMasivo.filter(f =>
      f.id_frente_trabajo && f.jornada
    );

    if (filasValidas.length === 0) {
      toast.warning('Atención', 'Debes completar al menos una fila para guardar');
      setLoading(false);
      return;
    }

    try {
      // Enviar todas las dumpadas en paralelo
      const promises = filasValidas.map(form =>
        dispatchService.createDumpada({
          id_frente_trabajo: form.id_frente_trabajo,
          jornada: form.jornada,
          ley_visual: form.ley_visual,
          ton: TONELADAS_CONSTANTE
        })
      );

      await Promise.all(promises);

      toast.success(
        `${filasValidas.length} dumpada(s) ingresadas`,
        'En espera de análisis de laboratorio'
      );

      resetFormIngreso();
      await loadData();
    } catch (error) {
      console.error('❌ Error guardando dumpadas:', error);

      const errorMsg = error.response?.data?.message ||
        JSON.stringify(error.response?.data?.errors) ||
        error.message ||
        'Error al guardar dumpadas';

      toast.error('Error al guardar', errorMsg);
    } finally {
      setLoading(false);
    }
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
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          ton: TONELADAS_CONSTANTE
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
            <div className="flex gap-3">
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
                      <li>• Registre: Punto, Jornada y Ley Visual</li>
                      <li>• Queda en estado: <strong>Ingresado</strong></li>
                      <li>• Espera resultados de laboratorio</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">🔬 Completar Análisis</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• En Historial, click en "Completar"</li>
                      <li>• Agregue: Ley, Ley Cup y Certificado</li>
                      <li>• Estado final: <strong>Completado</strong></li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">✨ Automático</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Fecha:</strong> Actual del sistema</li>
                      <li>• <strong>Toneladas:</strong> {TONELADAS_CONSTANTE} Ton</li>
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
                            />
                          </div>

                          {formsIngresoMasivo.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarFilaIngreso(form.id)}
                              className="flex-shrink-0 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                              title="Eliminar fila"
                            >
                              <HiTrash className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>ℹ️ Información:</strong> Fecha actual, {TONELADAS_CONSTANTE} Ton constante, N° Acopio automático.
                      Las filas completas se guardarán en estado "Ingresado" hasta agregar los resultados del laboratorio.
                    </p>
                  </div>


                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      variant="success"
                      disabled={loading}
                    >
                      {loading ? 'Guardando...' : `Registrar ${formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada).length} Dumpada(s)`}
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

            {/* Últimos registros ingresados */}
            <Card className="border-l-4 border-yellow-400">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Últimos Registros Ingresados</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Registros recientes en espera de análisis de laboratorio
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
                          variant="success"
                          size="sm"
                          onClick={handleBulkComplete}
                          disabled={loading}
                        >
                          Completar Seleccionadas
                        </Button>
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

              {dumpadas.filter(d => d.estado === 'Ingresado').length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No hay registros en espera</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100">
                        <th className="text-center py-2 px-2 font-bold text-yellow-900 text-xs w-10">
                          <input
                            type="checkbox"
                            onChange={() => handleSelectAll(dumpadas.filter(d => d.estado === 'Ingresado').slice(0, 10))}
                            checked={selectedIds.length === dumpadas.filter(d => d.estado === 'Ingresado').slice(0, 10).length && selectedIds.length > 0}
                            className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
                          />
                        </th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Frente</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">N° Acop</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Acopios</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Jornada</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Fecha</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Ton</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Ley</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">Ley Cup</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Certificado</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">Ley Visual</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Rango</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Estado</th>
                        <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dumpadas.filter(d => d.estado === 'Ingresado').slice(0, 10).map((dumpada, index) => {
                        // Obtener el color de la faena si existe
                        const backgroundColor = dumpada.faena_info?.color || (index % 2 === 0 ? '#ffffff' : '#f9fafb');

                        return (
                          <tr
                            key={dumpada.id}
                            style={{ backgroundColor }}
                            className={`border-b border-gray-200 hover:opacity-90 transition-all ${selectedIds.includes(dumpada.id) ? 'ring-2 ring-blue-400' : ''}`}
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
                              {dumpada.n_acop ? String(dumpada.n_acop).padStart(3, '0') : '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2" title={dumpada.acopios || '-'}>
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 block truncate max-w-[180px]">
                              {dumpada.acopios || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                              {dumpada.jornada}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-800 whitespace-nowrap">
                            {formatearFecha(dumpada.fecha)}
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
                          <td className="py-2 px-2 text-xs text-gray-700">
                            {dumpada.certificado || '-'}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-700">
                            {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-2 px-2">
                            {dumpada.rango ? (
                              <span className={`${getRangoColor(dumpada.rango)} text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap`}>
                                {dumpada.rango}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`${getEstadoColor(dumpada.estado)} text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap`}>
                              {dumpada.estado}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleCompletar(dumpada)}
                            >
                              Completar
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Vista de Historial */}
        {vistaActual === 'historial' && (
          <Card className="border-l-4 border-blue-400">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Historial de Dumpadas</h3>
              <p className="text-sm text-gray-600 mt-1">
                Total: <span className="font-semibold text-blue-600">{totalRecords}</span> registro{totalRecords !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Componente de Filtros */}
            <TableFilters
              searchValue={searchTerm}
              searchPlaceholder="Buscar por código de acopios, certificado, frente..."
              onSearchChange={handleSearchChange}
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
                          variant="success"
                          size="sm"
                          onClick={handleBulkComplete}
                          disabled={loading}
                        >
                          Completar Seleccionadas
                        </Button>
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

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100">
                        <th className="text-center py-2 px-2 font-bold text-blue-900 text-xs w-10">
                          <input
                            type="checkbox"
                            onChange={() => handleSelectAll(dumpadas)}
                            checked={selectedIds.length === dumpadas.length && selectedIds.length > 0}
                            className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Frente</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs whitespace-nowrap">N° Acop</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Acopios</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Jornada</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Fecha</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Ton</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Ley</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs whitespace-nowrap">Ley Cup</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Certificado</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs whitespace-nowrap">Ley Visual</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Rango</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Estado</th>
                        <th className="text-left py-2 px-2 font-bold text-blue-900 text-xs">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dumpadas.map((dumpada, index) => {
                        // Obtener el color de la faena si existe
                        const backgroundColor = dumpada.faena_info?.color || (index % 2 === 0 ? '#ffffff' : '#f9fafb');

                        return (
                          <tr
                            key={dumpada.id}
                            style={{ backgroundColor }}
                            className={`border-b border-gray-200 hover:opacity-90 transition-all ${selectedIds.includes(dumpada.id) ? 'ring-2 ring-blue-400' : ''}`}
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
                            <span className="font-bold text-blue-900 bg-gradient-to-r from-blue-100 to-blue-200 px-1.5 py-0.5 rounded-lg shadow-sm border border-blue-300 inline-block text-xs whitespace-nowrap">
                              {dumpada.frente_trabajo?.codigo_completo || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <span className="font-mono font-bold text-gray-800 text-xs">
                              {dumpada.n_acop ? String(dumpada.n_acop).padStart(3, '0') : '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2" title={dumpada.acopios || '-'}>
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-lg border border-blue-200 font-semibold block truncate max-w-[180px]">
                              {dumpada.acopios || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {dumpada.jornada ? (
                              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm whitespace-nowrap">
                                {dumpada.jornada}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-2 font-semibold text-gray-800 text-xs whitespace-nowrap">
                            {formatearFecha(dumpada.fecha)}
                          </td>
                          <td className="py-2 px-2 text-gray-700 font-semibold text-xs">
                            {dumpada.ton ? `${parseFloat(dumpada.ton).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-2 text-gray-700 text-xs">
                            {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-2 px-2 text-gray-700 text-xs">
                            {dumpada.ley_cup ? `${parseFloat(dumpada.ley_cup).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-2 px-2 text-gray-700 text-xs">
                            {dumpada.certificado || '-'}
                          </td>
                          <td className="py-2 px-2 text-gray-700 text-xs">
                            {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-2 px-2">
                            {dumpada.rango ? (
                              <span className={`${getRangoColor(dumpada.rango)} text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm whitespace-nowrap`}>
                                {dumpada.rango}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`${getEstadoColor(dumpada.estado)} text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm whitespace-nowrap`}>
                              {dumpada.estado}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              {dumpada.estado !== 'Completado' && (
                                <button
                                  onClick={() => handleCompletar(dumpada)}
                                  className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors text-xs whitespace-nowrap"
                                  title="Completar"
                                >
                                  Completar
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(dumpada)}
                                className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                title="Editar"
                              >
                                <HiPencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(dumpada.id)}
                                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
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
      </main>
    </div>
  );
}
