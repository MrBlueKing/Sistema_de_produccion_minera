import { useState, useEffect } from 'react';
import { HiArrowLeft, HiHome, HiArrowPath, HiTrash } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import AlertMessage from '../../../shared/components/molecules/AlertMessage';
import ingenieriaService from '../../ingenieria/services/ingenieria';

export default function FrentesTrabajoHistorial() {
  const navigate = useNavigate();
  const [frentesEliminados, setFrentesEliminados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [restoreModal, setRestoreModal] = useState({ show: false, id: null, codigo: '' });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, codigo: '' });

  useEffect(() => {
    loadDeletedFrente();
  }, []);

  const loadDeletedFrente = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ingenieriaService.getTrashedFrentesTrabajo();
      setFrentesEliminados(response.data || []);
    } catch (error) {
      console.error('❌ Error cargando frentes eliminados:', error);
      setError(error.response?.data?.message || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (frente) => {
    setRestoreModal({
      show: true,
      id: frente.id,
      codigo: frente.codigo_completo || 'este frente'
    });
  };

  const confirmRestore = async () => {
    const id = restoreModal.id;
    setRestoreModal({ show: false, id: null, codigo: '' });

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await ingenieriaService.restoreFrenteTrabajo(id);
      setSuccess('¡Frente de trabajo restaurado con éxito! Ya está disponible nuevamente.');
      await loadDeletedFrente();
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('❌ Error restaurando frente:', error);
      setError(error.response?.data?.message || 'Error al restaurar frente de trabajo');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleForceDelete = (frente) => {
    setDeleteModal({
      show: true,
      id: frente.id,
      codigo: frente.codigo_completo || 'este frente'
    });
  };

  const confirmForceDelete = async () => {
    const id = deleteModal.id;
    setDeleteModal({ show: false, id: null, codigo: '' });

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await ingenieriaService.forceDeleteFrenteTrabajo(id);
      setSuccess('¡Frente de trabajo eliminado permanentemente! Esta acción no se puede deshacer.');
      await loadDeletedFrente();
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('❌ Error eliminando permanentemente:', error);
      setError(error.response?.data?.message || 'Error al eliminar permanentemente');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.href = 'http://localhost:5173';
  };

  if (loading && frentesEliminados.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando historial...</p>
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
                label: 'Frentes de Trabajo',
                href: '/ingenieria/frentes-trabajo',
                onClick: (e) => {
                  e.preventDefault();
                  navigate('/ingenieria/frentes-trabajo');
                }
              },
              {
                label: 'Historial de Eliminados'
              }
            ]}
          />
        </div>

        {/* Mensajes */}
        {success && (
          <AlertMessage
            type="success"
            title="¡Operación Exitosa!"
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

        {error && (
          <AlertMessage
            type="error"
            title="Error en la Operación"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {/* Modales */}
        <ConfirmModal
          show={restoreModal.show}
          onConfirm={confirmRestore}
          onCancel={() => setRestoreModal({ show: false, id: null, codigo: '' })}
          title="¿Restaurar Frente de Trabajo?"
          message="Estás a punto de restaurar el frente:"
          highlightText={restoreModal.codigo}
          warningText="El frente volverá a estar disponible en el listado principal."
          confirmText="Restaurar"
          cancelText="Cancelar"
          variant="info"
          icon={HiArrowPath}
        />

        <ConfirmModal
          show={deleteModal.show}
          onConfirm={confirmForceDelete}
          onCancel={() => setDeleteModal({ show: false, id: null, codigo: '' })}
          title="¿Eliminar Permanentemente?"
          message="Estás a punto de eliminar permanentemente el frente:"
          highlightText={deleteModal.codigo}
          warningText="Esta acción NO se puede deshacer. El frente será eliminado de la base de datos."
          confirmText="Eliminar Permanentemente"
          cancelText="Cancelar"
          variant="danger"
          icon={HiTrash}
        />

        {/* Header de sección */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">
                Historial de Frentes Eliminados
              </h2>
              <p className="text-gray-600 mt-1">Frentes de trabajo que han sido eliminados</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate('/ingenieria/frentes-trabajo')}
              icon={HiArrowLeft}
              disabled={loading}
            >
              Volver
            </Button>
          </div>
        </div>

        {/* Tabla de Frentes Eliminados */}
        <Card className="border-l-4 border-red-400">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Frentes Eliminados</h3>
              <p className="text-sm text-gray-600 mt-1">
                Total: <span className="font-semibold text-red-600">{frentesEliminados.length}</span> frente{frentesEliminados.length !== 1 ? 's' : ''} eliminado{frentesEliminados.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {loading && frentesEliminados.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Cargando historial...</p>
            </div>
          ) : frentesEliminados.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiArrowPath className="w-10 h-10 text-green-500" />
              </div>
              <p className="text-gray-700 font-medium mb-2">No hay frentes eliminados</p>
              <p className="text-sm text-gray-500">
                Todos los frentes están activos
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-red-200 bg-gradient-to-r from-red-50 to-red-100">
                    <th className="text-left py-4 px-4 font-bold text-red-900">Código Completo</th>
                    <th className="text-left py-4 px-4 font-bold text-red-900">Manto</th>
                    <th className="text-left py-4 px-4 font-bold text-red-900">Tipo Frente</th>
                    <th className="text-left py-4 px-4 font-bold text-red-900">Eliminado Por</th>
                    <th className="text-left py-4 px-4 font-bold text-red-900">Fecha Eliminación</th>
                    <th className="text-left py-4 px-4 font-bold text-red-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {frentesEliminados.map((frente, index) => (
                    <tr
                      key={frente.id}
                      className={`border-b border-gray-200 hover:bg-red-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <span className="font-bold text-red-900 bg-gradient-to-r from-red-100 to-red-200 px-4 py-2 rounded-lg shadow-sm border border-red-300 inline-block">
                          {frente.codigo_completo || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-800">{frente.manto || '-'}</td>
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
                      <td className="py-4 px-4 text-gray-700">{frente.deleted_by || 'Sistema'}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(frente.deleted_at).toLocaleString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestore(frente)}
                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                            title="Restaurar"
                          >
                            <HiArrowPath className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleForceDelete(frente)}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            title="Eliminar permanentemente"
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
