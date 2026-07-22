import { useState, useEffect } from 'react';
import { HiHome, HiDocumentText, HiInformationCircle, HiArrowPath, HiDocumentArrowDown, HiPencil, HiXMark, HiCheck } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import FaenaSelector from '../../../shared/components/molecules/FaenaSelector';
import { useFaena } from '../../../contexts/FaenaContext';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../services/laboratorio';
import ingenieriaService from '../../ingenieria/services/ingenieria';

// Colores suaves para faenas (pastel)
const COLORES_FAENA_SUAVES = [
  '#fef3c7', // Amarillo suave
  '#dbeafe', // Azul suave
  '#dcfce7', // Verde suave
  '#fce7f3', // Rosa suave
  '#e0e7ff', // Indigo suave
  '#fed7aa', // Naranja suave
  '#d1fae5', // Esmeralda suave
  '#ede9fe', // Violeta suave
  '#fecaca', // Rojo suave
  '#cffafe', // Cyan suave
];

export default function HistorialAnalisis() {
  const toast = useToast();
  const { faenaSeleccionada, esUsuarioGlobal, faenas } = useFaena();
  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Mapa de colores por faena
  const [coloresFaena, setColoresFaena] = useState({});

  // Paginacion
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    jornada: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_frente_trabajo: '',
    rango: '',
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];
  const rangos = ['Alta', 'Media', 'Baja', 'Esteril'];

  useEffect(() => {
    loadData();
    loadMaestros();
    asignarColoresFaenas();
  }, []);

  useEffect(() => {
    loadData();
  }, [currentPage, debouncedSearchTerm, filters, faenaSeleccionada]);

  // Asignar colores suaves a cada faena
  const asignarColoresFaenas = () => {
    const colores = {};
    faenas.forEach((faena, index) => {
      colores[faena.id] = COLORES_FAENA_SUAVES[index % COLORES_FAENA_SUAVES.length];
    });
    setColoresFaena(colores);
  };

  useEffect(() => {
    if (faenas.length > 0) {
      asignarColoresFaenas();
    }
  }, [faenas]);

  const loadMaestros = async () => {
    try {
      const frentesRes = await ingenieriaService.getFrentesTrabajo({ solo_activos: true, per_page: 1000 });
      setFrentes(frentesRes.data || []);
    } catch (error) {
      console.error('Error cargando maestros:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setDumpadas([]);

    try {
      const params = {
        page: currentPage,
        per_page: perPage,
        search: debouncedSearchTerm || undefined,
        jornada: filters.jornada || undefined,
        fecha_inicio: filters.fecha_inicio || undefined,
        fecha_fin: filters.fecha_fin || undefined,
        id_frente_trabajo: filters.id_frente_trabajo || undefined,
        id_faena: faenaSeleccionada || undefined,
        rango: filters.rango || undefined,
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await laboratorioService.getHistorialAnalisis(params);

      setDumpadas(response.data || []);

      if (response.pagination) {
        setTotalPages(response.pagination.last_page);
        setTotalRecords(response.pagination.total);
      }

    } catch (error) {
      console.error('Error cargando historial:', error);
      toast.error(
        'Error al cargar historial',
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

  // Obtener color suave para una faena
  const getColorFaena = (idFaena) => {
    if (!idFaena) return '#f3f4f6'; // Gris muy suave por defecto
    return coloresFaena[idFaena] || COLORES_FAENA_SUAVES[idFaena % COLORES_FAENA_SUAVES.length];
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
      jornada: '',
      fecha_inicio: '',
      fecha_fin: '',
      id_frente_trabajo: '',
      rango: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  const getRangoColor = (rango) => {
    const colors = {
      'Alta': 'bg-green-600',
      'Media': 'bg-yellow-500',
      'Baja': 'bg-orange-500',
      'Esteril': 'bg-red-500',
    };
    return colors[rango] || 'bg-gray-500';
  };

  // Estado para modal de edición
  const [editModal, setEditModal] = useState({ show: false, dumpada: null });
  const [editForm, setEditForm] = useState({ ley: '', cu_soluble: '', cu_insoluble: '' });
  const [saving, setSaving] = useState(false);

  const handleEditClick = (dumpada) => {
    setEditForm({
      ley: dumpada.ley || '',
      cu_soluble: dumpada.cu_soluble || '',
      cu_insoluble: dumpada.cu_insoluble || '',
    });
    setEditModal({ show: true, dumpada });
  };

  const handleEditSave = async () => {
    if (!editModal.dumpada) return;

    if (!editForm.ley || !editForm.cu_soluble) {
      toast.error('Campos requeridos', 'Ley (Cu Total) y Cu Soluble son obligatorios');
      return;
    }

    setSaving(true);
    try {
      await laboratorioService.editarAnalisis(editModal.dumpada.id, {
        ley: parseFloat(editForm.ley),
        cu_soluble: parseFloat(editForm.cu_soluble),
        cu_insoluble: editForm.cu_insoluble ? parseFloat(editForm.cu_insoluble) : undefined,
      });
      toast.success('Actualizado', 'El análisis fue editado correctamente');
      setEditModal({ show: false, dumpada: null });
      loadData();
    } catch (error) {
      toast.error('Error al guardar', error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  // TODO: Implementar generacion de PDF
  const handleGenerarPDF = () => {
    toast.info('Proximamente', 'La generacion de PDF estara disponible pronto');
  };

  if (loading && dumpadas.length === 0 && frentes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando historial de analisis...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Portal M3H',
                href: import.meta.env.VITE_CENTRAL_URL,
                onClick: (e) => {
                  e.preventDefault();
                  handleGoBack();
                },
                icon: HiHome
              },
              {
                label: 'Laboratorio - Historial de Analisis'
              }
            ]}
          />
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <HiDocumentText className="w-8 h-8 text-emerald-600" />
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                    Historial de Analisis
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {totalRecords} registro{totalRecords !== 1 ? 's' : ''} con analisis completado
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleGenerarPDF}
                icon={HiDocumentArrowDown}
                disabled={dumpadas.length === 0}
              >
                Generar PDF
              </Button>
              <Button
                variant="secondary"
                onClick={loadData}
                icon={HiArrowPath}
                disabled={loading}
              >
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  showInfo
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
                }`}
                title="Ver flujo del dato"
              >
                <HiInformationCircle className="w-4 h-4" />
                <span className="hidden sm:inline">¿Cómo funciona?</span>
              </button>
            </div>
          </div>

          {/* Selector de Faena */}
          {esUsuarioGlobal && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <FaenaSelector />
            </div>
          )}

          {/* Resumen de colores por faena */}
          {faenas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Colores por Faena:</p>
              <div className="flex flex-wrap gap-2">
                {faenas.map((faena) => (
                  <div
                    key={faena.id}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: getColorFaena(faena.id) }}
                  >
                    <span className="text-gray-800">{faena.ubicacion || faena.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel ¿Cómo funciona? */}
        {showInfo && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="mb-4 pb-4 border-b border-blue-100">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2.5">Flujo del dato</p>
              <div className="flex items-start">
                {[
                  { n: 1, label: 'Ingreso', color: 'bg-orange-500', active: true },
                  { n: 2, label: 'Envío\nMuestras', color: 'bg-teal-500', active: true },
                  { n: 3, label: 'Lab', color: 'bg-green-600', active: true },
                  { n: 4, label: 'Mezclas', color: 'bg-purple-600', active: true },
                  { n: 5, label: 'Despacho', color: 'bg-indigo-600', active: true },
                ].flatMap((p, i, arr) => [
                  <div key={`s${i}`} className="flex flex-col items-center" style={{ minWidth: '44px' }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.color}`}>{p.n}</div>
                    <span className="mt-1 text-[9px] font-semibold text-center leading-tight whitespace-pre-line text-gray-700">{p.label}</span>
                  </div>,
                  ...(i < arr.length - 1 ? [<div key={`l${i}`} className="flex-1 h-px bg-gray-200 mt-3.5 mx-0.5 min-w-[8px]" />] : [])
                ])}
              </div>
            </div>

            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2.5">¿Cómo funciona el Historial?</p>
            <div className="space-y-2">
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Qué aparece acá</p>
                <p className="text-xs text-gray-500 mt-0.5">Todos los análisis ya completados (Cu Total, Cu Soluble, rango, ley con capping), filtrables por faena, fecha o rango. Es una vista de consulta transversal a todo el proceso.</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Qué puedes hacer</p>
                <p className="text-xs text-gray-500 mt-0.5">Generar y descargar el certificado en PDF de cada análisis, y editar un análisis ya cerrado si hubo un error de digitación.</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-emerald-700">Colores por faena</p>
                <p className="text-xs text-gray-500 mt-0.5">Cada fila se pinta con el color de la faena de origen, para distinguir rápido de dónde viene cada registro cuando ves varias faenas a la vez.</p>
              </div>
            </div>
          </div>
        )}

        {/* Listado */}
        <Card className="border-l-4 border-emerald-400">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Registros Completados</h3>
            <p className="text-sm text-gray-600 mt-1">
              Total: <span className="font-semibold text-emerald-600">{totalRecords}</span> registro{totalRecords !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filtros */}
          <TableFilters
            searchValue={searchTerm}
            searchPlaceholder="Buscar por certificado, frente, acopio..."
            onSearchChange={handleSearchChange}
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
                name: 'rango',
                label: 'Rango',
                type: 'select',
                options: rangos.map(r => ({ value: r, label: r }))
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

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-14 w-14 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
              <p className="font-semibold text-emerald-700">Cargando historial de analisis...</p>
              <p className="text-gray-500 text-sm mt-1">Esto puede tomar un momento</p>
            </div>
          ) : dumpadas.length === 0 ? (
            <div className="text-center py-12">
              <HiDocumentText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700 font-medium mb-2">No hay registros</p>
              <p className="text-gray-600 text-sm">
                {faenaSeleccionada
                  ? 'No hay analisis completados para la faena seleccionada'
                  : 'No hay analisis completados con los filtros aplicados'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100">
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Faena</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Frente</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs whitespace-nowrap">N Dump</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Jornada</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Fecha</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Ton</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Ley</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs whitespace-nowrap">Ley Cup</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Certificado</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Rango</th>
                      <th className="text-left py-3 px-3 font-bold text-emerald-900 text-xs">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dumpadas.map((dumpada) => {
                      const idFaena = dumpada.id_faena || dumpada.frente_trabajo?.id_faena;
                      const backgroundColor = getColorFaena(idFaena);

                      return (
                        <tr
                          key={dumpada.id}
                          style={{ backgroundColor }}
                          className="border-b border-gray-200 hover:opacity-80 transition-all"
                        >
                          <td className="py-3 px-3">
                            <span className="text-xs font-semibold text-gray-800">
                              {dumpada.faena_info?.ubicacion || dumpada.faena_info?.nombre || 'Sin faena'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-emerald-900 bg-white/60 px-1.5 py-0.5 rounded text-xs whitespace-nowrap">
                              {dumpada.frente_trabajo?.codigo_completo || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-gray-800 text-xs">
                              {dumpada.numero_dumpada || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                              {dumpada.jornada}{dumpada.numero_jornada ? `-${dumpada.numero_jornada}` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-gray-800 whitespace-nowrap">
                            {formatearFecha(dumpada.fecha)}
                          </td>
                          <td className="py-3 px-3 text-xs text-gray-700 font-semibold">
                            {dumpada.ton ? `${parseFloat(dumpada.ton).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-gray-900 text-xs">
                              {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(3)}%` : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-gray-700">
                            {dumpada.ley_cup ? `${parseFloat(dumpada.ley_cup).toFixed(3)}%` : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs text-gray-800 bg-white/60 px-1.5 py-0.5 rounded">
                              {dumpada.certificado || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`${getRangoColor(dumpada.rango)} text-white px-2 py-0.5 rounded-full text-xs font-bold`}>
                              {dumpada.rango || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => handleEditClick(dumpada)}
                              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors"
                              title="Editar análisis"
                            >
                              <HiPencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginacion */}
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
        {/* Modal de Edición */}
        {editModal.show && editModal.dumpada && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-5 rounded-t-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <HiPencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Editar Análisis</h2>
                    <p className="text-emerald-100 text-xs">
                      Dumpada #{editModal.dumpada.numero_dumpada} - {editModal.dumpada.frente_trabajo?.codigo_completo}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditModal({ show: false, dumpada: null })}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                >
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-5 space-y-4">
                {/* Info actual */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p><strong>Faena:</strong> {editModal.dumpada.faena_info?.ubicacion || editModal.dumpada.faena || '-'}</p>
                  <p><strong>Fecha:</strong> {formatearFecha(editModal.dumpada.fecha)} | <strong>Jornada:</strong> {editModal.dumpada.jornada}{editModal.dumpada.numero_jornada ? `-${editModal.dumpada.numero_jornada}` : ''}</p>
                </div>

                {/* Ley (Cu Total) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Ley - Cu Total (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editForm.ley}
                    onChange={(e) => setEditForm(prev => ({ ...prev, ley: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Ej: 1.640"
                  />
                </div>

                {/* Cu Soluble */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cu Soluble (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editForm.cu_soluble}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cu_soluble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Ej: 0.800"
                  />
                </div>

                {/* Cu Insoluble */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cu Insoluble (%) <span className="text-gray-400 text-xs font-normal">opcional, se calcula auto</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editForm.cu_insoluble}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cu_insoluble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-900"
                    placeholder={editForm.ley && editForm.cu_soluble ? `Auto: ${(parseFloat(editForm.ley || 0) - parseFloat(editForm.cu_soluble || 0)).toFixed(3)}` : 'Se calcula automáticamente'}
                  />
                </div>

                {/* Info */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
                  <strong>Nota:</strong> El Ley Cup (capping) y el Rango se recalculan automáticamente.
                </div>
              </div>

              {/* Botones */}
              <div className="px-5 pb-5 flex gap-3 justify-end">
                <button
                  onClick={() => setEditModal({ show: false, dumpada: null })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <HiCheck className="w-4 h-4" />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
