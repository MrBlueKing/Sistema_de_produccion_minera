import React, { useState, useEffect } from 'react';
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiBriefcase,
  HiCheckCircle,
  HiXCircle
} from 'react-icons/hi2';
import { HiOfficeBuilding } from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Badge from '../../../shared/components/atoms/Badge';
import Button from '../../../shared/components/atoms/Button';
import Loader from '../../../shared/components/atoms/Loader';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import laboratorioService from '../../../services/laboratorio';
import useToast from '../../../hooks/useToast';

const MaestrosManagement = () => {
  const toast = useToast();
  const [vistaActual, setVistaActual] = useState('plantas'); // 'plantas' o 'empresas'
  const [loading, setLoading] = useState(true);

  // Datos
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  // Modales
  const [showFormModal, setShowFormModal] = useState(false);
  const [modoForm, setModoForm] = useState('crear'); // 'crear' o 'editar'
  const [itemEditar, setItemEditar] = useState(null);

  // Confirmación de eliminación
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nombre: '', tipo: '' });

  // Formulario de Planta
  const [formPlanta, setFormPlanta] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    activo: true
  });

  // Formulario de Empresa
  const [formEmpresa, setFormEmpresa] = useState({
    nombre: '',
    codigo: '',
    rut: '',
    contacto: '',
    telefono: '',
    email: '',
    activo: true
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [plantasRes, empresasRes] = await Promise.all([
        laboratorioService.getPlantas(),
        laboratorioService.getEmpresas()
      ]);

      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
    } catch (error) {
      console.error('Error cargando maestros:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const resetFormPlanta = () => {
    setFormPlanta({
      nombre: '',
      codigo: '',
      descripcion: '',
      activo: true
    });
  };

  const resetFormEmpresa = () => {
    setFormEmpresa({
      nombre: '',
      codigo: '',
      rut: '',
      contacto: '',
      telefono: '',
      email: '',
      activo: true
    });
  };

  const handleNuevoClick = () => {
    setModoForm('crear');
    setItemEditar(null);
    if (vistaActual === 'plantas') {
      resetFormPlanta();
    } else {
      resetFormEmpresa();
    }
    setShowFormModal(true);
  };

  const handleEditarClick = (item) => {
    setModoForm('editar');
    setItemEditar(item);
    if (vistaActual === 'plantas') {
      setFormPlanta({
        nombre: item.nombre || '',
        codigo: item.codigo || '',
        descripcion: item.descripcion || '',
        activo: item.activo !== undefined ? item.activo : true
      });
    } else {
      setFormEmpresa({
        nombre: item.nombre || '',
        codigo: item.codigo || '',
        rut: item.rut || '',
        contacto: item.contacto || '',
        telefono: item.telefono || '',
        email: item.email || '',
        activo: item.activo !== undefined ? item.activo : true
      });
    }
    setShowFormModal(true);
  };

  const handleEliminarClick = (item, tipo) => {
    setDeleteModal({
      show: true,
      id: item.id,
      nombre: item.nombre,
      tipo
    });
  };

  const handleFormChange = (e, tipo) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    if (tipo === 'planta') {
      setFormPlanta(prev => ({ ...prev, [name]: val }));
    } else {
      setFormEmpresa(prev => ({ ...prev, [name]: val }));
    }
  };

  const handleSubmitPlanta = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (modoForm === 'crear') {
        await laboratorioService.createPlanta(formPlanta);
        toast.success('Planta creada exitosamente');
      } else {
        await laboratorioService.updatePlanta(itemEditar.id, formPlanta);
        toast.success('Planta actualizada exitosamente');
      }

      setShowFormModal(false);
      resetFormPlanta();
      await cargarDatos();
    } catch (error) {
      console.error('Error al guardar planta:', error);
      toast.error(
        'Error al guardar',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo guardar la planta'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEmpresa = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSend = { ...formEmpresa };

      if (modoForm === 'crear') {
        // await laboratorioService.createEmpresa(dataToSend);
        toast.warning('Función no implementada', 'La creación de empresas aún no está disponible en el backend');
      } else {
        // await laboratorioService.updateEmpresa(itemEditar.id, dataToSend);
        toast.warning('Función no implementada', 'La actualización de empresas aún no está disponible en el backend');
      }

      setShowFormModal(false);
      resetFormEmpresa();
      // await cargarDatos();
    } catch (error) {
      console.error('Error al guardar empresa:', error);
      toast.error(
        'Error al guardar',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo guardar la empresa'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      if (deleteModal.tipo === 'planta') {
        await laboratorioService.deletePlanta(deleteModal.id);
        toast.success('Planta eliminada exitosamente');
      } else {
        // await laboratorioService.deleteEmpresa(deleteModal.id);
        toast.warning('Función no implementada', 'La eliminación de empresas aún no está disponible en el backend');
      }

      setDeleteModal({ show: false, id: null, nombre: '', tipo: '' });
      await cargarDatos();
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error(
        'Error al eliminar',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo eliminar el registro'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-l-4 border-purple-500">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">⚙️ Gestión de Maestros</h2>
            <p className="text-gray-600">Administración de Plantas y Empresas</p>
          </div>

          {/* Botones de navegación */}
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActual('plantas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                vistaActual === 'plantas'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <HiOfficeBuilding className="w-5 h-5" />
              <span>Plantas</span>
            </button>
            <button
              onClick={() => setVistaActual('empresas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                vistaActual === 'empresas'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <HiBriefcase className="w-5 h-5" />
              <span>Empresas</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Vista de Plantas */}
      {vistaActual === 'plantas' && (
        <Card className="border-l-4 border-blue-400">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Plantas</h3>
            <Button variant="primary" icon={HiPlus} onClick={handleNuevoClick}>
              Nueva Planta
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : plantas.length === 0 ? (
            <div className="text-center py-12">
              <HiOfficeBuilding className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay plantas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                    <th className="text-left py-3 px-3 font-bold text-blue-900">ID</th>
                    <th className="text-left py-3 px-3 font-bold text-blue-900">Código</th>
                    <th className="text-left py-3 px-3 font-bold text-blue-900">Nombre</th>
                    <th className="text-left py-3 px-3 font-bold text-blue-900">Descripción</th>
                    <th className="text-left py-3 px-3 font-bold text-blue-900">Estado</th>
                    <th className="text-left py-3 px-3 font-bold text-blue-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plantas.map((planta, index) => (
                    <tr
                      key={planta.id}
                      className={`border-b hover:bg-blue-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-blue-700">#{planta.id}</td>
                      <td className="py-3 px-3 font-mono font-bold">{planta.codigo}</td>
                      <td className="py-3 px-3">{planta.nombre}</td>
                      <td className="py-3 px-3 text-xs text-gray-600">
                        {planta.descripcion || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge color={planta.activo ? 'green' : 'gray'} size="sm">
                          {planta.activo ? (
                            <>
                              <HiCheckCircle className="inline mr-1" />
                              Activa
                            </>
                          ) : (
                            <>
                              <HiXCircle className="inline mr-1" />
                              Inactiva
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={HiPencil}
                            onClick={() => handleEditarClick(planta)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={HiTrash}
                            onClick={() => handleEliminarClick(planta, 'planta')}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Vista de Empresas */}
      {vistaActual === 'empresas' && (
        <Card className="border-l-4 border-purple-400">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Empresas</h3>
            <Button variant="primary" icon={HiPlus} onClick={handleNuevoClick}>
              Nueva Empresa
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : empresas.length === 0 ? (
            <div className="text-center py-12">
              <HiBriefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay empresas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-purple-200">
                    <th className="text-left py-3 px-3 font-bold text-purple-900">ID</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">Código</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">Nombre</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">RUT</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">Contacto</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">Email</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">Estado</th>
                    <th className="text-left py-3 px-3 font-bold text-purple-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((empresa, index) => (
                    <tr
                      key={empresa.id}
                      className={`border-b hover:bg-purple-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-purple-700">#{empresa.id}</td>
                      <td className="py-3 px-3 font-mono font-bold">{empresa.codigo}</td>
                      <td className="py-3 px-3">{empresa.nombre}</td>
                      <td className="py-3 px-3 text-xs">{empresa.rut || '-'}</td>
                      <td className="py-3 px-3 text-xs">{empresa.contacto || '-'}</td>
                      <td className="py-3 px-3 text-xs">{empresa.email || '-'}</td>
                      <td className="py-3 px-3">
                        <Badge color={empresa.activo ? 'green' : 'gray'} size="sm">
                          {empresa.activo ? (
                            <>
                              <HiCheckCircle className="inline mr-1" />
                              Activa
                            </>
                          ) : (
                            <>
                              <HiXCircle className="inline mr-1" />
                              Inactiva
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={HiPencil}
                            onClick={() => handleEditarClick(empresa)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={HiTrash}
                            onClick={() => handleEliminarClick(empresa, 'empresa')}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal de Formulario de Planta */}
      {showFormModal && vistaActual === 'plantas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <form onSubmit={handleSubmitPlanta}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {modoForm === 'crear' ? 'Nueva Planta' : 'Editar Planta'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formPlanta.nombre}
                      onChange={(e) => handleFormChange(e, 'planta')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código *
                    </label>
                    <input
                      type="text"
                      name="codigo"
                      value={formPlanta.codigo}
                      onChange={(e) => handleFormChange(e, 'planta')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 uppercase"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    name="descripcion"
                    value={formPlanta.descripcion}
                    onChange={(e) => handleFormChange(e, 'planta')}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={formPlanta.activo}
                    onChange={(e) => handleFormChange(e, 'planta')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Planta activa
                  </label>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowFormModal(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : modoForm === 'crear' ? 'Crear Planta' : 'Actualizar Planta'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Formulario de Empresa */}
      {showFormModal && vistaActual === 'empresas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <form onSubmit={handleSubmitEmpresa}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {modoForm === 'crear' ? 'Nueva Empresa' : 'Editar Empresa'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formEmpresa.nombre}
                      onChange={(e) => handleFormChange(e, 'empresa')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código *
                    </label>
                    <input
                      type="text"
                      name="codigo"
                      value={formEmpresa.codigo}
                      onChange={(e) => handleFormChange(e, 'empresa')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 uppercase"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RUT
                    </label>
                    <input
                      type="text"
                      name="rut"
                      value={formEmpresa.rut}
                      onChange={(e) => handleFormChange(e, 'empresa')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contacto
                    </label>
                    <input
                      type="text"
                      name="contacto"
                      value={formEmpresa.contacto}
                      onChange={(e) => handleFormChange(e, 'empresa')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formEmpresa.telefono}
                      onChange={(e) => handleFormChange(e, 'empresa')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formEmpresa.email}
                      onChange={(e) => handleFormChange(e, 'empresa')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={formEmpresa.activo}
                    onChange={(e) => handleFormChange(e, 'empresa')}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Empresa activa
                  </label>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowFormModal(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : modoForm === 'crear' ? 'Crear Empresa' : 'Actualizar Empresa'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmModal
        show={deleteModal.show}
        title={`Eliminar ${deleteModal.tipo === 'planta' ? 'Planta' : 'Empresa'}`}
        message={`¿Está seguro que desea eliminar "${deleteModal.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ show: false, id: null, nombre: '', tipo: '' })}
        variant="danger"
      />
    </div>
  );
};

export default MaestrosManagement;
