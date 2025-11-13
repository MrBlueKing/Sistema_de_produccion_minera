import { useState, useEffect } from 'react';
import { HiPlus, HiHome, HiPencil, HiTrash, HiClock } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import HistorialCambios from '../../../shared/components/organisms/HistorialCambios';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import faenaService from '../../../services/faenaService';

export default function FrentesTrabajo() {
  const navigate = useNavigate();
  const toast = useToast();
  const [frentes, setFrentes] = useState([]);
  const [tiposFrente, setTiposFrente] = useState([]);
  const [faenas, setFaenas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, codigo: '' });
  const [historialModal, setHistorialModal] = useState({ show: false, frenteId: null });

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    id_tipo_frente: '',
    manto: '',
    id_faena: '',
    estado: '',
  });

  // Debounce para la búsqueda (espera 500ms después de que el usuario deje de escribir)
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [formData, setFormData] = useState({
    manto: '',
    calle: '',
    hebra: '',
    numero_frente: '',
    id_tipo_frente: '',
    id_faena: '',
    estado: 'activo',
  });

  useEffect(() => {
    loadData();
  }, [currentPage, debouncedSearchTerm, filters]); // Usar debouncedSearchTerm en lugar de searchTerm

  const loadData = async () => {
    setLoading(true);

    try {
      console.log('🔄 Cargando datos de ingeniería...');

      // Construir parámetros de la petición
      const params = {
        page: currentPage,
        per_page: perPage,
        search: debouncedSearchTerm || undefined, // Usar el valor con debounce
        id_tipo_frente: filters.id_tipo_frente || undefined,
        manto: filters.manto || undefined,
        id_faena: filters.id_faena || undefined,
        estado: filters.estado || undefined,
      };

      // Limpiar parámetros undefined
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const [frentesRes, tiposRes, faenasRes] = await Promise.all([
        ingenieriaService.getFrentesTrabajo(params),
        tiposFrente.length > 0 ? Promise.resolve({ data: tiposFrente }) : ingenieriaService.getTiposFrente(),
        faenas.length > 0 ? Promise.resolve({ data: faenas }) : faenaService.getFaenas(),
      ]);

      console.log('✅ Frentes obtenidos:', frentesRes);
      console.log('✅ Tipos obtenidos:', tiposRes);
      console.log('✅ Faenas obtenidas:', faenasRes);

      setFrentes(frentesRes.data || []);
      setTiposFrente(tiposRes.data || []);
      setFaenas(faenasRes.data || []);

      // Actualizar información de paginación
      if (frentesRes.pagination) {
        setTotalPages(frentesRes.pagination.last_page);
        setTotalRecords(frentesRes.pagination.total);
      }
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      console.error('Error completo:', error.response?.data || error.message);

      toast.error(
        'Error al cargar datos',
        error.response?.data?.message || error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // Actualizar frente existente
        await ingenieriaService.updateFrenteTrabajo(editingId, formData);
        toast.success(
          '¡Frente actualizado!',
          'Los cambios han sido guardados correctamente'
        );
      } else {
        // Crear nuevo frente
        await ingenieriaService.createFrenteTrabajo(formData);
        toast.success(
          '¡Frente creado!',
          'El nuevo frente ha sido registrado correctamente'
        );
      }

      setFormData({ manto: '', calle: '', hebra: '', numero_frente: '', id_tipo_frente: '', id_faena: '', estado: 'activo' });
      setShowForm(false);
      setEditingId(null);
      setCurrentPage(1); // Volver a la primera página
      await loadData();
    } catch (error) {
      console.error('❌ Error guardando frente:', error);

      const errorMsg = error.response?.data?.message ||
        JSON.stringify(error.response?.data?.errors) ||
        error.message ||
        'Error al guardar frente de trabajo';

      toast.error('Error al guardar', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (frente) => {
    setFormData({
      manto: frente.manto || '',
      calle: frente.calle || '',
      hebra: frente.hebra || '',
      numero_frente: frente.numero_frente || '',
      id_tipo_frente: frente.id_tipo_frente || '',
      id_faena: frente.id_faena || '',
      estado: frente.estado || 'activo',
    });
    setEditingId(frente.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const frente = frentes.find(f => f.id === id);
    setDeleteModal({
      show: true,
      id: id,
      codigo: frente?.codigo_completo || 'este frente'
    });
  };

  const confirmDelete = async () => {
    const id = deleteModal.id;
    setDeleteModal({ show: false, id: null, codigo: '' });

    setLoading(true);

    try {
      await ingenieriaService.deleteFrenteTrabajo(id);
      toast.success(
        '¡Frente eliminado!',
        'El registro ha sido removido de la base de datos'
      );
      await loadData();
    } catch (error) {
      console.error('❌ Error eliminando frente:', error);
      toast.error(
        'Error al eliminar',
        error.response?.data?.message || 'No se pudo eliminar el frente de trabajo'
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, id: null, codigo: '' });
  };

  const handleCancelEdit = () => {
    setFormData({ manto: '', calle: '', hebra: '', numero_frente: '', id_tipo_frente: '', id_faena: '', estado: 'activo' });
    setEditingId(null);
    setShowForm(false);
  };

  // Handlers para filtros
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Resetear a la primera página al buscar
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Resetear a la primera página al filtrar
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      id_tipo_frente: '',
      manto: '',
      id_faena: '',
      estado: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ NUEVO: Volver al SAC en lugar de dashboard local
  const handleGoBack = () => {
    window.location.href = 'http://localhost:5173';
  };

  // ✅ NUEVO: Loading state mejorado
  if (loading && frentes.length === 0 && tiposFrente.length === 0) {
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
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
                label: 'Frentes de Trabajo'
              }
            ]}
          />
        </div>

        {/* Modal de Confirmación de Eliminación */}
        <ConfirmModal
          show={deleteModal.show}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          title="¿Eliminar Frente de Trabajo?"
          message="Estás a punto de eliminar el frente:"
          highlightText={deleteModal.codigo}
          warningText="Podrás recuperarlo desde el historial."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          icon={HiTrash}
        />

        {/* Modal de Historial de Cambios */}
        <HistorialCambios
          show={historialModal.show}
          onClose={() => setHistorialModal({ show: false, frenteId: null })}
          frenteId={historialModal.frenteId}
          loadHistorial={ingenieriaService.getHistorialFrenteTrabajo}
          onRevertir={ingenieriaService.revertirFrenteTrabajo}
          onSuccess={() => {
            loadData(); // Recargar datos de la tabla
            toast.success('¡Frente revertido!', 'Los cambios se han aplicado correctamente');
          }}
          title="Historial de Cambios del Frente"
        />

        {/* Header de sección */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                Frentes de Trabajo
              </h2>
              <p className="text-gray-600 mt-1">Gestiona los frentes de trabajo de ingeniería</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate('/ingenieria/frentes-trabajo/historial')}
                icon={HiClock}
                disabled={loading}
              >
                Historial
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!showForm) {
                    // Al abrir el formulario, preseleccionar "Frente" si existe
                    const tipoFrente = tiposFrente.find(tipo =>
                      tipo.nombre?.toLowerCase().includes('frente') ||
                      tipo.abreviatura?.toLowerCase() === 'f'
                    );
                    if (tipoFrente) {
                      setFormData(prev => ({ ...prev, id_tipo_frente: tipoFrente.id }));
                    }
                  }
                  setShowForm(!showForm);
                }}
                icon={HiPlus}
                disabled={loading}
              >
                {showForm ? 'Cancelar' : 'Nuevo Frente'}
              </Button>
            </div>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <Card className="mb-6 border-l-4 border-orange-400">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiPlus className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Editar Frente de Trabajo' : 'Nuevo Frente de Trabajo'}
                </h3>
                <p className="text-sm text-gray-600">
                  Complete los campos para generar el código. Ejemplo: <strong className="text-orange-600">M5-1SH1AL7</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Manto *"
                  type="text"
                  value={formData.manto}
                  onChange={(e) => setFormData({ ...formData, manto: e.target.value.toUpperCase() })}
                  placeholder="Ej: M5"
                  required
                  style={{ textTransform: 'uppercase' }}
                />

                <Input
                  label="Calle"
                  type="text"
                  value={formData.calle}
                  onChange={(e) => setFormData({ ...formData, calle: e.target.value.toUpperCase() })}
                  placeholder="Ej: -1SH, 2N"
                  style={{ textTransform: 'uppercase' }}
                />

                <Input
                  label="Hebra"
                  type="text"
                  value={formData.hebra}
                  onChange={(e) => setFormData({ ...formData, hebra: e.target.value.toUpperCase() })}
                  placeholder="Ej: 1A, 2B"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Frente * <span className="text-gray-500 text-xs">(L, REC, DQ, DF, etc.)</span>
                  </label>
                  <select
                    value={formData.id_tipo_frente}
                    onChange={(e) => setFormData({ ...formData, id_tipo_frente: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Seleccione un tipo</option>
                    {tiposFrente.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre} {tipo.abreviatura && `(${tipo.abreviatura})`}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Número (opcional)"
                  type="text"
                  value={formData.numero_frente}
                  onChange={(e) => setFormData({ ...formData, numero_frente: e.target.value.toUpperCase() })}
                  placeholder="Ej: 7, -3, 3 1/2"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SearchableSelect
                  label="Faena"
                  options={faenas.map(faena => ({
                    value: faena.id,
                    label: `${faena.ubicacion}${faena.detalle ? ` - ${faena.detalle}` : ''}`
                  }))}
                  value={formData.id_faena}
                  onChange={(value) => setFormData({ ...formData, id_faena: value })}
                  placeholder="Seleccione una faena"
                  emptyMessage="No hay faenas disponibles"
                />

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado
                  </label>
                  <div className="flex items-center gap-4 h-[42px]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, estado: formData.estado === 'activo' ? 'inactivo' : 'activo' })}
                      className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                        formData.estado === 'activo' ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          formData.estado === 'activo' ? 'translate-x-9' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-semibold ${
                      formData.estado === 'activo' ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      {formData.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vista previa del código */}
              {formData.manto && (
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <p className="text-sm font-semibold text-orange-800">Vista Previa del Código:</p>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 font-mono tracking-wide">
                    {(() => {
                      const tipoSeleccionado = tiposFrente.find(t => t.id == formData.id_tipo_frente);
                      const tipoConNumero = tipoSeleccionado?.abreviatura?.trim()
                        ? (tipoSeleccionado.abreviatura.trim() + (formData.numero_frente || ''))
                        : '';

                      return [
                        formData.manto,
                        formData.calle,
                        formData.hebra,
                        tipoConNumero
                      ].filter(v => v && v !== '').join('') || 'Ingrese el manto para ver la vista previa';
                    })()}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="success"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : (editingId ? 'Actualizar Frente' : 'Guardar Frente')}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelEdit}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}

        {/* Tabla de Frentes */}
        <Card className="border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Listado de Frentes</h3>
              <p className="text-sm text-gray-600 mt-1">
                Total: <span className="font-semibold text-orange-600">{totalRecords}</span> frente{totalRecords !== 1 ? 's' : ''} registrado{totalRecords !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Componente de Filtros */}
          <TableFilters
            searchValue={searchTerm}
            searchPlaceholder="Buscar por código, manto, calle o hebra..."
            onSearchChange={handleSearchChange}
            filters={[
              {
                name: 'id_tipo_frente',
                label: 'Tipo de Frente',
                type: 'select',
                options: tiposFrente.map(tipo => ({
                  value: tipo.id,
                  label: `${tipo.nombre}${tipo.abreviatura ? ` (${tipo.abreviatura})` : ''}`
                }))
              },
              {
                name: 'id_faena',
                label: 'Faena',
                type: 'select',
                options: faenas.map(faena => ({
                  value: faena.id,
                  label: `${faena.ubicacion}${faena.detalle ? ` - ${faena.detalle}` : ''}`
                }))
              },
              {
                name: 'manto',
                label: 'Manto',
                type: 'text',
                placeholder: 'Ej: M5, M12'
              },
              {
                name: 'estado',
                label: 'Estado',
                type: 'select',
                options: [
                  { value: 'activo', label: 'Activo' },
                  { value: 'inactivo', label: 'Inactivo' }
                ]
              }
            ]}
            filterValues={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
          />

          {loading && frentes.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Cargando frentes...</p>
            </div>
          ) : frentes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiPlus className="w-10 h-10 text-orange-500" />
              </div>
              <p className="text-gray-700 font-medium mb-2">No hay frentes registrados</p>
              <p className="text-sm text-gray-500">
                Haz click en <strong className="text-orange-600">"Nuevo Frente"</strong> para crear uno
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100">
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Código Completo</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Manto</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Calle</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Hebra</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Tipo Frente</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Número</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Faena</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Estado</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Creado</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {frentes.map((frente, index) => {
                    // Obtener el color de la faena si existe
                    const backgroundColor = frente.faena?.color || (index % 2 === 0 ? '#ffffff' : '#f9fafb');

                    return (
                      <tr
                        key={frente.id}
                        style={{ backgroundColor }}
                        className="border-b border-gray-200 hover:opacity-90 transition-all"
                      >
                      <td className="py-4 px-4">
                        <span className="font-bold text-orange-900 bg-gradient-to-r from-orange-100 to-orange-200 px-4 py-2 rounded-lg shadow-sm border border-orange-300 inline-block">
                          {frente.codigo_completo || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-800">{frente.manto || '-'}</td>
                      <td className="py-4 px-4 text-gray-700">{frente.calle || '-'}</td>
                      <td className="py-4 px-4 text-gray-700">{frente.hebra || '-'}</td>
                      <td className="py-4 px-4">
                        {frente.tipo_frente ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">{frente.tipo_frente.nombre}</span>
                            {frente.tipo_frente.abreviatura && (
                              <span className="text-xs text-gray-600">({frente.tipo_frente.abreviatura})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-700">{frente.numero_frente || '-'}</td>
                      <td className="py-4 px-4">
                        {frente.faena ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">{frente.faena.ubicacion}</span>
                            {frente.faena.detalle && (
                              <span className="text-xs text-gray-600">{frente.faena.detalle}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          frente.estado === 'activo'
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}>
                          {frente.estado === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(frente.created_at).toLocaleDateString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setHistorialModal({ show: true, frenteId: frente.id })}
                            className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                            title="Ver historial"
                          >
                            <HiClock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(frente)}
                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            title="Editar"
                          >
                            <HiPencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(frente.id)}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            title="Eliminar"
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
          )}

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
        </Card>

        {/* ✅ NUEVO: Info de debugging (solo en desarrollo) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 bg-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-mono">
              Debug: {frentes.length} frentes, {tiposFrente.length} tipos cargados
            </p>
          </div>
        )}
      </main>
    </div>
  );
}