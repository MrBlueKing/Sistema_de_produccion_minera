import { useState, useEffect } from 'react';
import { HiPlus, HiHome, HiPencil, HiTrash, HiTag } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import useToast from '../../../hooks/useToast';
import ingenieriaService from '../../ingenieria/services/ingenieria';

export default function TiposFrente() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tiposFrente, setTiposFrente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nombre: '' });

  const [formData, setFormData] = useState({
    nombre: '',
    abreviatura: '',
    descripcion: '',
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadTiposFrente();
  }, []);

  const loadTiposFrente = async () => {
    setLoading(true);
    try {
      const response = await ingenieriaService.getTiposFrente();
      setTiposFrente(response.data || []);
    } catch (error) {
      console.error('Error cargando tipos de frente:', error);
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
        await ingenieriaService.updateTipoFrente(editingId, formData);
        toast.success(
          '¡Tipo actualizado!',
          'Los cambios han sido guardados correctamente'
        );
      } else {
        await ingenieriaService.createTipoFrente(formData);
        toast.success(
          '¡Tipo creado!',
          'El nuevo tipo de frente ha sido registrado'
        );
      }

      setFormData({ nombre: '', abreviatura: '', descripcion: '' });
      setShowForm(false);
      setEditingId(null);
      await loadTiposFrente();
    } catch (error) {
      console.error('Error guardando tipo de frente:', error);
      const errorMsg = error.response?.data?.message ||
        JSON.stringify(error.response?.data?.errors) ||
        error.message ||
        'Error al guardar tipo de frente';
      toast.error('Error al guardar', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tipo) => {
    setFormData({
      nombre: tipo.nombre || '',
      abreviatura: tipo.abreviatura || '',
      descripcion: tipo.descripcion || '',
    });
    setEditingId(tipo.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (tipo) => {
    setDeleteModal({
      show: true,
      id: tipo.id,
      nombre: tipo.nombre
    });
  };

  const confirmDelete = async () => {
    const id = deleteModal.id;
    setDeleteModal({ show: false, id: null, nombre: '' });
    setLoading(true);

    try {
      await ingenieriaService.deleteTipoFrente(id);
      toast.success(
        '¡Tipo eliminado!',
        'El registro ha sido removido correctamente'
      );
      await loadTiposFrente();
    } catch (error) {
      console.error('Error eliminando tipo de frente:', error);
      const errorMsg = error.response?.data?.message || 'No se pudo eliminar el tipo de frente';

      // Si tiene frentes asociados, mostrar mensaje especial
      if (errorMsg.includes('frentes asociados') || error.response?.status === 409) {
        toast.error(
          'No se puede eliminar',
          'Este tipo tiene frentes de trabajo asociados. Primero elimine o reasigne los frentes.'
        );
      } else {
        toast.error('Error al eliminar', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, id: null, nombre: '' });
  };

  const handleCancelEdit = () => {
    setFormData({ nombre: '', abreviatura: '', descripcion: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleGoBack = () => {
    window.location.href = 'http://localhost:5173';
  };

  if (loading && tiposFrente.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-6">
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
                label: 'Frentes de Trabajo',
                href: '/ingenieria/frentes-trabajo',
                onClick: (e) => {
                  e.preventDefault();
                  navigate('/ingenieria/frentes-trabajo');
                }
              },
              {
                label: 'Tipos de Frente'
              }
            ]}
          />
        </div>

        {/* Modal de Confirmacion de Eliminacion */}
        <ConfirmModal
          show={deleteModal.show}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          title="¿Eliminar Tipo de Frente?"
          message="Estás a punto de eliminar el tipo:"
          highlightText={deleteModal.nombre}
          warningText="Si tiene frentes asociados, no se podrá eliminar."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          icon={HiTrash}
        />

        {/* Header de seccion */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                Tipos de Frente
              </h2>
              <p className="text-gray-600 mt-1">Administra los tipos de frente de trabajo (L, REC, DQ, DF, etc.)</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate('/ingenieria/frentes-trabajo')}
                disabled={loading}
              >
                Ver Frentes
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowForm(!showForm)}
                icon={HiPlus}
                disabled={loading}
              >
                {showForm ? 'Cancelar' : 'Nuevo Tipo'}
              </Button>
            </div>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <Card className="mb-6 border-l-4 border-orange-400">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiTag className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Editar Tipo de Frente' : 'Nuevo Tipo de Frente'}
                </h3>
                <p className="text-sm text-gray-600">
                  Define un tipo de frente con su abreviatura para el código
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre *"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Frente, Recuperación, Descuelgue"
                  required
                  maxLength={100}
                />

                <Input
                  label="Abreviatura *"
                  type="text"
                  value={formData.abreviatura}
                  onChange={(e) => setFormData({ ...formData, abreviatura: e.target.value.toUpperCase() })}
                  placeholder="Ej: F, L, REC, DQ"
                  required
                  maxLength={10}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <Input
                label="Descripcion (opcional)"
                type="text"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripcion breve del tipo de frente..."
                maxLength={255}
              />

              {/* Vista previa */}
              {formData.abreviatura && (
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <p className="text-sm font-semibold text-orange-800">Vista Previa en Codigo:</p>
                  </div>
                  <p className="text-xl font-bold text-orange-900 font-mono">
                    M5-1SH1A<span className="bg-orange-300 px-1 rounded">{formData.abreviatura}</span>7
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Ejemplo: El codigo del frente usara "{formData.abreviatura}" como identificador de tipo
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="success"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : (editingId ? 'Actualizar Tipo' : 'Guardar Tipo')}
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

        {/* Tabla de Tipos */}
        <Card className="border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Listado de Tipos</h3>
              <p className="text-sm text-gray-600 mt-1">
                Total: <span className="font-semibold text-orange-600">{tiposFrente.length}</span> tipo{tiposFrente.length !== 1 ? 's' : ''} registrado{tiposFrente.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {loading && tiposFrente.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Cargando tipos...</p>
            </div>
          ) : tiposFrente.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiTag className="w-10 h-10 text-orange-500" />
              </div>
              <p className="text-gray-700 font-medium mb-2">No hay tipos de frente registrados</p>
              <p className="text-sm text-gray-500">
                Haz click en <strong className="text-orange-600">"Nuevo Tipo"</strong> para crear uno
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100">
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Nombre</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Abreviatura</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Descripcion</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Frentes</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Creado</th>
                    <th className="text-left py-4 px-4 font-bold text-orange-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposFrente.map((tipo) => (
                    <tr
                      key={tipo.id}
                      className="border-b border-gray-200 hover:bg-orange-50 hover:shadow-md transition-all duration-200"
                    >
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-800">{tipo.nombre}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-orange-900 bg-gradient-to-r from-orange-100 to-orange-200 px-3 py-1 rounded-lg shadow-sm border border-orange-300 inline-block font-mono">
                          {tipo.abreviatura}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {tipo.descripcion || <span className="text-gray-400 italic">Sin descripcion</span>}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          tipo.frentes_trabajo?.length > 0
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}>
                          {tipo.frentes_trabajo?.length || 0} frente{(tipo.frentes_trabajo?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(tipo.created_at).toLocaleDateString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(tipo)}
                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            title="Editar"
                          >
                            <HiPencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tipo)}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            title="Eliminar"
                            disabled={tipo.frentes_trabajo?.length > 0}
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
