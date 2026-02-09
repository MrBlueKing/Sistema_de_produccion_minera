import { useState, useEffect } from 'react';
import {
  HiCog6Tooth,
  HiPlus,
  HiPencil,
  HiTrash,
  HiArchiveBox,
  HiTag,
  HiCube,
  HiXMark,
  HiCheckCircle,
  HiUserGroup,
  HiMagnifyingGlass,
  HiUserPlus,
  HiUserMinus,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import ConfirmDialog from '../../../shared/components/molecules/ConfirmDialog';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

export default function ConfiguracionView({ polvorin, categorias, tipos, faenaActual, onPolvorinCreated, onRefresh }) {
  const toast = useToast();

  // Tabs de configuración
  const [tabActual, setTabActual] = useState(polvorin ? 'categorias' : 'polvorin');

  // Estados de modales
  const [showModalPolvorin, setShowModalPolvorin] = useState(false);
  const [showModalCategoria, setShowModalCategoria] = useState(false);
  const [showModalTipo, setShowModalTipo] = useState(false);

  // Estados de edición
  const [editandoPolvorin, setEditandoPolvorin] = useState(null);
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  const [editandoTipo, setEditandoTipo] = useState(null);

  // Confirmar eliminación
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemAEliminar, setItemAEliminar] = useState(null);
  const [tipoItemAEliminar, setTipoItemAEliminar] = useState('');

  // Form data
  const [formPolvorin, setFormPolvorin] = useState({
    nombre: '',
    ubicacion: '',
    capacidad_maxima_kg: '',
    responsable: '',
    telefono_responsable: '',
    observaciones: '',
  });

  const [formCategoria, setFormCategoria] = useState({
    nombre: '',
    descripcion: '',
    orden: 0,
  });

  const [formTipo, setFormTipo] = useState({
    codigo: '',
    nombre: '',
    id_categoria: '',
    unidad_medida: 'kg',
    requiere_lote: true,
    dias_alerta_vencimiento: 30,
    stock_minimo: 0,
    stock_maximo: '',
    fabricante: '',
    clasificacion_onu: '',
    descripcion: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const tabs = [
    { id: 'polvorin', label: 'Polvorín', icon: HiArchiveBox },
    { id: 'categorias', label: 'Categorías', icon: HiTag },
    { id: 'tipos', label: 'Tipos de Explosivos', icon: HiCube },
    { id: 'personal', label: 'Personal Autorizado', icon: HiUserGroup },
  ];

  // Estados para Personal Autorizado
  const [personalAutorizado, setPersonalAutorizado] = useState([]);
  const [personalDisponible, setPersonalDisponible] = useState([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [showModalPersonal, setShowModalPersonal] = useState(false);
  const [busquedaPersonal, setBusquedaPersonal] = useState('');

  // Cargar personal autorizado cuando se cambia a la pestaña
  useEffect(() => {
    if (tabActual === 'personal' && faenaActual) {
      cargarPersonalAutorizado();
    }
  }, [tabActual, faenaActual]);

  const cargarPersonalAutorizado = async () => {
    try {
      const data = await explosivosService.getPersonalAutorizado({ activo: 'true' });
      setPersonalAutorizado(data);
    } catch (error) {
      console.error('Error al cargar personal autorizado:', error);
    }
  };

  const cargarPersonalDisponible = async () => {
    setLoadingPersonal(true);
    try {
      const response = await explosivosService.getPersonalDisponible();
      setPersonalDisponible(response.data || []);
    } catch (error) {
      toast.error('Error', 'No se pudo conectar con el sistema de petroleo');
      setPersonalDisponible([]);
    } finally {
      setLoadingPersonal(false);
    }
  };

  const abrirModalPersonal = () => {
    setShowModalPersonal(true);
    cargarPersonalDisponible();
  };

  const autorizarPersona = async (persona) => {
    try {
      await explosivosService.autorizarPersonal({
        id_personal_externo: persona.id_personal_interno,
        rut: persona.rut,
        nombre: persona.nombre,
        apellido: persona.apellido,
        cargo: persona.cargo,
      });
      toast.success('Personal autorizado', `${persona.nombre_completo} fue autorizado`);
      cargarPersonalAutorizado();
      cargarPersonalDisponible();
    } catch (error) {
      toast.error('Error', error.response?.data?.error || 'No se pudo autorizar');
    }
  };

  const desautorizarPersona = async (persona) => {
    try {
      await explosivosService.desautorizarPersonal(persona.id);
      toast.success('Autorización removida', `${persona.nombre} fue removido de la lista`);
      cargarPersonalAutorizado();
    } catch (error) {
      toast.error('Error', 'No se pudo remover la autorización');
    }
  };

  const personalFiltrado = personalDisponible.filter(p => {
    if (!busquedaPersonal) return true;
    const busqueda = busquedaPersonal.toLowerCase();
    return (
      p.nombre_completo?.toLowerCase().includes(busqueda) ||
      p.rut?.toLowerCase().includes(busqueda) ||
      p.cargo?.toLowerCase().includes(busqueda)
    );
  });

  // Abrir modal de edición
  const editarPolvorin = () => {
    setEditandoPolvorin(polvorin);
    setFormPolvorin({
      nombre: polvorin.nombre || '',
      ubicacion: polvorin.ubicacion || '',
      capacidad_maxima_kg: polvorin.capacidad_maxima_kg || '',
      responsable: polvorin.responsable || '',
      telefono_responsable: polvorin.telefono_responsable || '',
      observaciones: polvorin.observaciones || '',
    });
    setShowModalPolvorin(true);
  };

  const editarCategoria = (cat) => {
    setEditandoCategoria(cat);
    setFormCategoria({
      nombre: cat.nombre,
      descripcion: cat.descripcion || '',
      orden: cat.orden || 0,
    });
    setShowModalCategoria(true);
  };

  const editarTipo = (tipo) => {
    setEditandoTipo(tipo);
    setFormTipo({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      id_categoria: tipo.id_categoria,
      unidad_medida: tipo.unidad_medida,
      requiere_lote: tipo.requiere_lote,
      dias_alerta_vencimiento: tipo.dias_alerta_vencimiento,
      stock_minimo: tipo.stock_minimo || 0,
      stock_maximo: tipo.stock_maximo || '',
      fabricante: tipo.fabricante || '',
      clasificacion_onu: tipo.clasificacion_onu || '',
      descripcion: tipo.descripcion || '',
    });
    setShowModalTipo(true);
  };

  // Crear nuevo
  const nuevaCategoria = () => {
    setEditandoCategoria(null);
    setFormCategoria({ nombre: '', descripcion: '', orden: categorias.length });
    setShowModalCategoria(true);
  };

  const nuevoTipo = () => {
    setEditandoTipo(null);
    setFormTipo({
      codigo: '',
      nombre: '',
      id_categoria: categorias[0]?.id || '',
      unidad_medida: 'kg',
      requiere_lote: true,
      dias_alerta_vencimiento: 30,
      stock_minimo: 0,
      stock_maximo: '',
      fabricante: '',
      clasificacion_onu: '',
      descripcion: '',
    });
    setShowModalTipo(true);
  };

  const nuevoPolvorin = () => {
    setEditandoPolvorin(null);
    setFormPolvorin({
      nombre: `Polvorín ${faenaActual?.nombre || ''}`,
      ubicacion: '',
      capacidad_maxima_kg: '',
      responsable: '',
      telefono_responsable: '',
      observaciones: '',
    });
    setShowModalPolvorin(true);
  };

  // Guardar
  const guardarPolvorin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editandoPolvorin) {
        await explosivosService.updatePolvorin(editandoPolvorin.id, formPolvorin);
        toast.success('Polvorín actualizado', 'Los datos del polvorín fueron actualizados');
      } else {
        const nuevo = await explosivosService.createPolvorin({
          ...formPolvorin,
          id_faena: faenaActual.id,
        });
        toast.success('Polvorín creado', 'El polvorín fue creado exitosamente');
        onPolvorinCreated?.(nuevo.polvorin);
      }
      setShowModalPolvorin(false);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo guardar el polvorín');
    } finally {
      setSubmitting(false);
    }
  };

  const guardarCategoria = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editandoCategoria) {
        await explosivosService.updateCategoria(editandoCategoria.id, formCategoria);
        toast.success('Categoría actualizada', 'La categoría fue actualizada');
      } else {
        await explosivosService.createCategoria(formCategoria);
        toast.success('Categoría creada', 'La categoría fue creada exitosamente');
      }
      setShowModalCategoria(false);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo guardar la categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const guardarTipo = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editandoTipo) {
        await explosivosService.updateTipo(editandoTipo.id, formTipo);
        toast.success('Tipo actualizado', 'El tipo de explosivo fue actualizado');
      } else {
        await explosivosService.createTipo(formTipo);
        toast.success('Tipo creado', 'El tipo de explosivo fue creado exitosamente');
      }
      setShowModalTipo(false);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo guardar el tipo');
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar
  const confirmarEliminar = (item, tipo) => {
    setItemAEliminar(item);
    setTipoItemAEliminar(tipo);
    setShowConfirmDelete(true);
  };

  const eliminarItem = async () => {
    try {
      if (tipoItemAEliminar === 'categoria') {
        await explosivosService.deleteCategoria(itemAEliminar.id);
        toast.success('Categoría eliminada', 'La categoría fue eliminada');
      } else if (tipoItemAEliminar === 'tipo') {
        await explosivosService.deleteTipo(itemAEliminar.id);
        toast.success('Tipo eliminado', 'El tipo de explosivo fue eliminado');
      }
      setShowConfirmDelete(false);
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo eliminar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tabActual === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabActual(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                ${isActive
                  ? 'bg-gray-800 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido del tab */}
      {tabActual === 'polvorin' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Polvorín de la Faena</h3>
            {!polvorin && (
              <Button variant="primary" icon={HiPlus} onClick={nuevoPolvorin}>
                Crear Polvorín
              </Button>
            )}
          </div>

          {polvorin ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Código</p>
                  <p className="font-mono font-medium text-lg">{polvorin.codigo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium text-lg">{polvorin.nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ubicación</p>
                  <p className="text-gray-700">{polvorin.ubicacion || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Capacidad Máxima</p>
                  <p className="text-gray-700">
                    {polvorin.capacidad_maxima_kg
                      ? `${parseFloat(polvorin.capacidad_maxima_kg).toLocaleString('es-CL')} kg`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Responsable (Polvorinero)</p>
                  <p className="text-gray-700">{polvorin.responsable || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="text-gray-700">{polvorin.telefono_responsable || '-'}</p>
                </div>
              </div>
              {polvorin.observaciones && (
                <div>
                  <p className="text-sm text-gray-500">Observaciones</p>
                  <p className="text-gray-700">{polvorin.observaciones}</p>
                </div>
              )}
              <div className="pt-4 border-t">
                <Button variant="outline" icon={HiPencil} onClick={editarPolvorin}>
                  Editar Polvorín
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <HiArchiveBox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay polvorín configurado para esta faena</p>
              <p className="text-sm text-gray-400 mt-1">Cree un polvorín para comenzar a gestionar explosivos</p>
            </div>
          )}
        </Card>
      )}

      {tabActual === 'categorias' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Categorías de Explosivos</h3>
            <Button variant="primary" icon={HiPlus} onClick={nuevaCategoria}>
              Nueva Categoría
            </Button>
          </div>

          {categorias.length === 0 ? (
            <div className="text-center py-8">
              <HiTag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay categorías definidas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categorias.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{cat.nombre}</p>
                    {cat.descripcion && <p className="text-sm text-gray-500">{cat.descripcion}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {cat.tipos_explosivos_count || 0} tipos de explosivos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editarCategoria(cat)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <HiPencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => confirmarEliminar(cat, 'categoria')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      disabled={cat.tipos_explosivos_count > 0}
                      title={cat.tipos_explosivos_count > 0 ? 'No se puede eliminar, tiene tipos asociados' : ''}
                    >
                      <HiTrash className={`w-5 h-5 ${cat.tipos_explosivos_count > 0 ? 'opacity-30' : ''}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tabActual === 'tipos' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Catálogo de Explosivos</h3>
            <Button variant="primary" icon={HiPlus} onClick={nuevoTipo}>
              Nuevo Tipo
            </Button>
          </div>

          {tipos.length === 0 ? (
            <div className="text-center py-8">
              <HiCube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay tipos de explosivos definidos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold">Código</th>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                    <th className="px-4 py-3 text-center font-semibold">Unidad</th>
                    <th className="px-4 py-3 text-center font-semibold">Stock Mín/Máx</th>
                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((tipo) => (
                    <tr key={tipo.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium">{tipo.codigo}</span>
                      </td>
                      <td className="px-4 py-3">{tipo.nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{tipo.categoria?.nombre || '-'}</td>
                      <td className="px-4 py-3 text-center">{tipo.unidad_medida}</td>
                      <td className="px-4 py-3 text-center text-sm">
                        {tipo.stock_minimo || 0} / {tipo.stock_maximo || '∞'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => editarTipo(tipo)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <HiPencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => confirmarEliminar(tipo, 'tipo')}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <HiTrash className="w-5 h-5" />
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
      )}

      {tabActual === 'personal' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Personal Autorizado para Solicitar Explosivos</h3>
              <p className="text-sm text-gray-500 mt-1">
                Solo el personal autorizado puede solicitar explosivos del polvorín
              </p>
            </div>
            <Button variant="primary" icon={HiUserPlus} onClick={abrirModalPersonal}>
              Agregar Personal
            </Button>
          </div>

          {personalAutorizado.length === 0 ? (
            <div className="text-center py-8">
              <HiUserGroup className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay personal autorizado</p>
              <p className="text-sm text-gray-400 mt-1">Agregue personal desde el sistema de petroleo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {personalAutorizado.map((persona) => (
                <div key={persona.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <HiCheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{persona.nombre} {persona.apellido}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>{persona.rut}</span>
                        {persona.cargo && (
                          <>
                            <span>•</span>
                            <span>{persona.cargo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => desautorizarPersona(persona)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Quitar autorización"
                  >
                    <HiUserMinus className="w-5 h-5" />
                    <span className="hidden sm:inline">Quitar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modal Agregar Personal */}
      {showModalPersonal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Agregar Personal Autorizado</h3>
              <button onClick={() => setShowModalPersonal(false)} className="text-gray-500 hover:text-gray-700">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, RUT o cargo..."
                  value={busquedaPersonal}
                  onChange={(e) => setBusquedaPersonal(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingPersonal ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-500 mt-2">Cargando personal...</p>
                </div>
              ) : personalFiltrado.length === 0 ? (
                <div className="text-center py-8">
                  <HiUserGroup className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">
                    {busquedaPersonal ? 'No se encontraron resultados' : 'No hay personal disponible'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {personalFiltrado.map((persona) => (
                    <div
                      key={persona.id_personal_interno}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        persona.ya_autorizado
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{persona.nombre_completo}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>{persona.rut}</span>
                          {persona.cargo && (
                            <>
                              <span>•</span>
                              <span>{persona.cargo}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {persona.ya_autorizado ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                          <HiCheckCircle className="w-5 h-5" />
                          Autorizado
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={HiPlus}
                          onClick={() => autorizarPersona(persona)}
                        >
                          Autorizar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {personalFiltrado.length} personas disponibles
                </span>
                <Button variant="secondary" onClick={() => setShowModalPersonal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Polvorín */}
      {showModalPolvorin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editandoPolvorin ? 'Editar Polvorín' : 'Crear Polvorín'}
              </h3>
              <button onClick={() => setShowModalPolvorin(false)} className="text-gray-500 hover:text-gray-700">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={guardarPolvorin} className="p-6 space-y-4">
              <Input
                label="Nombre"
                required
                value={formPolvorin.nombre}
                onChange={(e) => setFormPolvorin(prev => ({ ...prev, nombre: e.target.value }))}
              />
              <Input
                label="Ubicación"
                value={formPolvorin.ubicacion}
                onChange={(e) => setFormPolvorin(prev => ({ ...prev, ubicacion: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Capacidad Máxima (kg)"
                  type="number"
                  value={formPolvorin.capacidad_maxima_kg}
                  onChange={(e) => setFormPolvorin(prev => ({ ...prev, capacidad_maxima_kg: e.target.value }))}
                />
                <Input
                  label="Responsable"
                  value={formPolvorin.responsable}
                  onChange={(e) => setFormPolvorin(prev => ({ ...prev, responsable: e.target.value }))}
                />
              </div>
              <Input
                label="Teléfono Responsable"
                value={formPolvorin.telefono_responsable}
                onChange={(e) => setFormPolvorin(prev => ({ ...prev, telefono_responsable: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={formPolvorin.observaciones}
                  onChange={(e) => setFormPolvorin(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModalPolvorin(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Categoría */}
      {showModalCategoria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editandoCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button onClick={() => setShowModalCategoria(false)} className="text-gray-500 hover:text-gray-700">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={guardarCategoria} className="p-6 space-y-4">
              <Input
                label="Nombre"
                required
                value={formCategoria.nombre}
                onChange={(e) => setFormCategoria(prev => ({ ...prev, nombre: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formCategoria.descripcion}
                  onChange={(e) => setFormCategoria(prev => ({ ...prev, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <Input
                label="Orden"
                type="number"
                value={formCategoria.orden}
                onChange={(e) => setFormCategoria(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))}
              />
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModalCategoria(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tipo */}
      {showModalTipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {editandoTipo ? 'Editar Tipo de Explosivo' : 'Nuevo Tipo de Explosivo'}
              </h3>
              <button onClick={() => setShowModalTipo(false)} className="text-gray-500 hover:text-gray-700">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={guardarTipo} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Código"
                  required
                  value={formTipo.codigo}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  placeholder="ANFO-STD"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                  <select
                    value={formTipo.id_categoria}
                    onChange={(e) => setFormTipo(prev => ({ ...prev, id_categoria: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Seleccione...</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                label="Nombre"
                required
                value={formTipo.nombre}
                onChange={(e) => setFormTipo(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="ANFO Standard"
              />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida *</label>
                  <select
                    value={formTipo.unidad_medida}
                    onChange={(e) => setFormTipo(prev => ({ ...prev, unidad_medida: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="unidades">Unidades</option>
                    <option value="metros">Metros</option>
                  </select>
                </div>
                <Input
                  label="Stock Mínimo"
                  type="number"
                  min="0"
                  value={formTipo.stock_minimo}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, stock_minimo: e.target.value }))}
                />
                <Input
                  label="Stock Máximo"
                  type="number"
                  min="0"
                  value={formTipo.stock_maximo}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, stock_maximo: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Días Alerta Vencimiento"
                  type="number"
                  min="1"
                  value={formTipo.dias_alerta_vencimiento}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, dias_alerta_vencimiento: e.target.value }))}
                />
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="requiere_lote"
                    checked={formTipo.requiere_lote}
                    onChange={(e) => setFormTipo(prev => ({ ...prev, requiere_lote: e.target.checked }))}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <label htmlFor="requiere_lote" className="text-sm text-gray-700">
                    Requiere control por lote
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Fabricante"
                  value={formTipo.fabricante}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, fabricante: e.target.value }))}
                />
                <Input
                  label="Clasificación ONU"
                  value={formTipo.clasificacion_onu}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, clasificacion_onu: e.target.value }))}
                  placeholder="1.1D"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formTipo.descripcion}
                  onChange={(e) => setFormTipo(prev => ({ ...prev, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModalTipo(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={eliminarItem}
        title={`Eliminar ${tipoItemAEliminar}`}
        message={`¿Está seguro de eliminar "${itemAEliminar?.nombre || itemAEliminar?.codigo}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}
