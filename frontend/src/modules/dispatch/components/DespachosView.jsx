import React, { useState, useEffect } from 'react';
import {
  HiPlus,
  HiRefresh,
  HiTruck,
  HiOfficeBuilding,
  HiCube,
  HiCheckCircle,
  HiClock,
  HiArrowRight,
  HiPencil,
  HiTrash,
  HiEye,
  HiX,
  HiBriefcase,
  HiChartBar,
  HiXCircle
} from 'react-icons/hi';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../../../services/laboratorio';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import Loader from '../../../shared/components/atoms/Loader';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import EliminarLoteModal from '../../../shared/components/molecules/EliminarLoteModal';
import CamionadaFormMejorado from './CamionadaFormMejorado';
import CamionadasMultiplesForm from './CamionadasMultiplesForm';
import CerrarLoteModal from './CerrarLoteModal';
import Badge from '../../../shared/components/atoms/Badge';
import RecepcionPanel from './RecepcionPanel';

const DespachosView = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('camionadas'); // 'camionadas', 'recepcion', 'lotes', 'plantas'

  // Estados para camionadas
  const [camionadas, setCamionadas] = useState([]);
  const [mezclas, setMezclas] = useState([]);
  const [mostrarFormCamionada, setMostrarFormCamionada] = useState(false);
  const [camionadaSeleccionada, setCamionadaSeleccionada] = useState(null);
  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState('hoy');
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  // Estados para plantas
  const [plantas, setPlantas] = useState([]);
  const [mostrarFormPlanta, setMostrarFormPlanta] = useState(false);
  const [plantaSeleccionada, setPlantaSeleccionada] = useState(null);
  const [vistaPlantasActiva, setVistaPlantasActiva] = useState('plantas'); // 'plantas' o 'empresas'
  const [modoFormPlanta, setModoFormPlanta] = useState('crear'); // 'crear' o 'editar'
  const [formPlanta, setFormPlanta] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    activo: true
  });
  const [formEmpresa, setFormEmpresa] = useState({
    nombre: '',
    codigo: '',
    rut: '',
    contacto: '',
    telefono: '',
    email: '',
    activo: true
  });

  // Estados para lotes
  const [lotes, setLotes] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tabLotesActivo, setTabLotesActivo] = useState('abiertos'); // 'abiertos' o 'completados'
  const [filtrosLotes, setFiltros
    
  ] = useState({
    planta_id: '',
    empresa_id: '',
    search: '',
    fecha_desde: '',
    fecha_hasta: '',
  });
  const [paginacionLotes, setPaginacionLotes] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    last_page: 1
  });
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [loadingDetalleLote, setLoadingDetalleLote] = useState(false);
  const [mostrarModalDetalleLote, setMostrarModalDetalleLote] = useState(false);
  const [mostrarModalCerrarLote, setMostrarModalCerrarLote] = useState(false);
  const [loteACerrar, setLoteACerrar] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nombre: '', tipo: '' });
  const [mostrarModalEliminarLote, setMostrarModalEliminarLote] = useState(false);
  const [loteAEliminar, setLoteAEliminar] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, [vistaActiva]);

  useEffect(() => {
    if (vistaActiva === 'lotes') {
      cargarLotes(1); // Reset a página 1 cuando cambian filtros o tab
    }
  }, [vistaActiva, tabLotesActivo, filtrosLotes]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      if (vistaActiva === 'camionadas') {
        const [camionadasRes, mezclasRes] = await Promise.all([
          laboratorioService.getCamionadas(),
          laboratorioService.getMezclasDisponibles()
        ]);
        setCamionadas(camionadasRes || []);
        setMezclas(mezclasRes || []);
      } else if (vistaActiva === 'plantas') {
        const plantasRes = await laboratorioService.getPlantas({ activas: 1 });
        setPlantas(plantasRes || []);
      } else if (vistaActiva === 'lotes') {
        const [plantasRes, empresasRes] = await Promise.all([
          laboratorioService.getPlantas({ activas: true }),
          laboratorioService.getEmpresas({ activas: true })
        ]);
        setPlantas(plantasRes || []);
        setEmpresas(empresasRes || []);
        await cargarLotes();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar datos', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarLotes = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        estado: tabLotesActivo === 'abiertos' ? 'Abierto' : 'Completado',
      };

      // Solo agregar paginación para completados
      if (tabLotesActivo === 'completados') {
        params.page = page;
        params.per_page = paginacionLotes.per_page;
      }

      // Filtros
      if (filtrosLotes.planta_id) params.planta_id = filtrosLotes.planta_id;
      if (filtrosLotes.empresa_id) params.empresa_id = filtrosLotes.empresa_id;
      if (filtrosLotes.search) params.search = filtrosLotes.search;
      if (filtrosLotes.fecha_desde) params.fecha_desde = filtrosLotes.fecha_desde;
      if (filtrosLotes.fecha_hasta) params.fecha_hasta = filtrosLotes.fecha_hasta;

      const response = await laboratorioService.getLotes(params);

      // Si la respuesta es paginada (solo para completados)
      if (response.data && Array.isArray(response.data)) {
        setLotes(response.data);
        if (response.meta) {
          setPaginacionLotes({
            page: response.meta.current_page || 1,
            per_page: response.meta.per_page || 20,
            total: response.meta.total || 0,
            last_page: response.meta.last_page || 1
          });
        }
      } else if (Array.isArray(response)) {
        setLotes(response);
      } else {
        setLotes([]);
      }
    } catch (error) {
      console.error('Error cargando lotes:', error);
      toast.error('Error al cargar los lotes');
    } finally {
      setLoading(false);
    }
  };

  // ============== FUNCIONES CAMIONADAS ==============

  const handleCamionadaCreada = (camionada) => {
    toast.success('Camionada creada exitosamente');
    setMostrarFormCamionada(false);
    cargarDatos();
  };

  const handleRecepcionarCamionada = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const data = {
      peso_real: parseFloat(formData.get('peso_real')),
      fecha_recepcion: formData.get('fecha_recepcion'),
      hora_recepcion: formData.get('hora_recepcion'),
      ley_lab_camion: formData.get('ley_lab_camion') ? parseFloat(formData.get('ley_lab_camion')) : null,
      ticket: formData.get('ticket') || null
    };

    try {
      await laboratorioService.recepcionarCamionada(camionadaSeleccionada.id, data);
      toast.success('Camionada recepcionada exitosamente');
      setMostrarRecepcion(false);
      setCamionadaSeleccionada(null);
      cargarDatos();
    } catch (error) {
      console.error('Error recepcionando camionada:', error);
      toast.error('Error al recepcionar', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarCamionada = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta camionada?')) return;

    try {
      await laboratorioService.deleteCamionada(id);
      toast.success('Camionada eliminada');
      cargarDatos();
    } catch (error) {
      toast.error('Error al eliminar', error.response?.data?.message || error.message);
    }
  };

  // ============== FUNCIONES HELPER PARA FORMULARIOS ==============

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
    setModoFormPlanta('crear');
    setPlantaSeleccionada(null);
    if (vistaPlantasActiva === 'plantas') {
      resetFormPlanta();
    } else {
      resetFormEmpresa();
    }
    setMostrarFormPlanta(true);
  };

  const handleEditarClick = (item) => {
    setModoFormPlanta('editar');
    setPlantaSeleccionada(item);
    if (vistaPlantasActiva === 'plantas') {
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
    setMostrarFormPlanta(true);
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

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      if (deleteModal.tipo === 'planta') {
        await laboratorioService.deletePlanta(deleteModal.id);
        toast.success('Planta eliminada exitosamente');
      } else {
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

  // Manejar eliminación de lote con opción
  const handleEliminarLote = async (opcion) => {
    if (!loteAEliminar) return;

    try {
      const response = await laboratorioService.deleteLote(loteAEliminar.id, opcion);
      toast.success('Lote eliminado', response.mensaje || 'Lote eliminado exitosamente');
      setMostrarModalEliminarLote(false);
      setLoteAEliminar(null);
      await cargarLotes();
    } catch (error) {
      console.error('Error al eliminar lote:', error);
      toast.error(
        'Error al eliminar',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo eliminar el lote'
      );
    }
  };

  // ============== FUNCIONES PLANTAS ==============

  const handleSubmitPlanta = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (modoFormPlanta === 'crear') {
        await laboratorioService.createPlanta(formPlanta);
        toast.success('Planta creada exitosamente');
      } else {
        await laboratorioService.updatePlanta(plantaSeleccionada.id, formPlanta);
        toast.success('Planta actualizada exitosamente');
      }

      setMostrarFormPlanta(false);
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

      if (modoFormPlanta === 'crear') {
        toast.warning('Función no implementada', 'La creación de empresas aún no está disponible en el backend');
      } else {
        toast.warning('Función no implementada', 'La actualización de empresas aún no está disponible en el backend');
      }

      setMostrarFormPlanta(false);
      resetFormEmpresa();
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


  // ============== FUNCIONES LOTES ==============

  const handleVerDetalleLote = async (loteId) => {
    setLoadingDetalleLote(true);
    setMostrarModalDetalleLote(true);
    try {
      const lote = await laboratorioService.getLote(loteId);
      setLoteSeleccionado(lote);
    } catch (error) {
      console.error('Error cargando detalle:', error);
      toast.error('Error al cargar el detalle del lote');
      setMostrarModalDetalleLote(false);
    } finally {
      setLoadingDetalleLote(false);
    }
  };

  const handleFiltroLoteChange = (e) => {
    const { name, value } = e.target;
    setFiltrosLotes(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const limpiarFiltrosLotes = () => {
    setFiltrosLotes({
      planta_id: '',
      empresa_id: '',
      search: '',
      fecha_desde: '',
      fecha_hasta: '',
    });
  };

  const handlePaginaLotesChange = (newPage) => {
    cargarLotes(newPage);
  };

  const handleCerrarLote = (lote) => {
    setLoteACerrar(lote);
    setMostrarModalCerrarLote(true);
  };

  const confirmarCerrarLote = async (datos) => {
    setLoading(true);
    setMostrarModalCerrarLote(false);

    try {
      const response = await laboratorioService.cerrarLote(loteACerrar.id, datos);

      console.log("Respuesta cierre lote:", response);
      const remanentesDisponibles = response.remanentes_disponibles || [];
      const remanenteCreado = response.remanente_creado;

      let mensaje = 'Lote cerrado exitosamente';
      let detalles = [];

      // Mostrar remanentes de mezclas existentes con leyes
      if (remanentesDisponibles.length > 0) {
        const resumen = remanentesDisponibles
          .map(r => {
            const toneladas = parseFloat(r.toneladas_disponibles).toFixed(2);
            const leyVisual = r.ley_prom_visual ? parseFloat(r.ley_prom_visual).toFixed(2) : 'N/A';
            const leyLote = r.ley_prom_lote ? parseFloat(r.ley_prom_lote).toFixed(2) : 'N/A';
            return `${r.codigo} (${toneladas} t, Ley Visual: ${leyVisual}%, Ley Lote: ${leyLote}%)`;
          })
          .join(', ');
        detalles.push(`${remanentesDisponibles.length} mezcla(s) con remanente: ${resumen}`);
      }

      // Mostrar remanente creado por paladas con leyes
      if (remanenteCreado) {
        const toneladasRemanente = parseFloat(remanenteCreado.total_ton || 0).toFixed(2);
        const paladas = remanenteCreado.numero_paladas;
        const leyVisual = remanenteCreado.ley_prom_visual ? parseFloat(remanenteCreado.ley_prom_visual).toFixed(2) : 'N/A';
        const leyLote = remanenteCreado.ley_prom_lote ? parseFloat(remanenteCreado.ley_prom_lote).toFixed(2) : 'N/A';

        const infoRemanente = paladas
          ? `${remanenteCreado.codigo} (${toneladasRemanente} t - ${paladas} paladas, Ley Visual: ${leyVisual}%, Ley Lote: ${leyLote}%)`
          : `${remanenteCreado.codigo} (${toneladasRemanente} t, Ley Visual: ${leyVisual}%, Ley Lote: ${leyLote}%)`;
        detalles.push(`Remanente nuevo creado: ${infoRemanente}`);
      }

      if (detalles.length > 0) {
        toast.success(mensaje, detalles.join('. '));
      } else {
        toast.success(mensaje, 'No hay remanentes disponibles');
      }

      // Recargar datos
      setLoteSeleccionado(null);
      setLoteACerrar(null);
      cargarDatos();
    } catch (error) {
      console.error('Error cerrando lote:', error);
      toast.error('Error al cerrar lote', error.response?.data?.mensaje || error.message);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado) => {
    const colors = {
      'Despachado': 'bg-yellow-500',
      'En Tránsito': 'bg-blue-500',
      'Recibido': 'bg-green-500',
      'Completado': 'bg-green-700',
      'En Preparación': 'bg-gray-400'
    };
    return colors[estado] || 'bg-gray-500';
  };

  const getEstadoVariant = (estado) => {
    const variants = {
      'Completado': 'success',
      'Recibido': 'primary',
      'Despachado': 'warning',
      'En Tránsito': 'primary',
      'En Preparación': 'default'
    };
    return variants[estado] || 'default';
  };

  // Agrupar camionadas por día
  const agruparPorDia = () => {
    const hoy = new Date();
    const grupos = {
      hoy: [],
      ayer: [],
      hace2dias: [],
      hace3dias: [],
      mas: []
    };

    camionadas.forEach(cam => {
      const fecha = new Date(cam.fecha_despacho);
      const diffTime = hoy.getTime() - fecha.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) grupos.hoy.push(cam);
      else if (diffDays === 1) grupos.ayer.push(cam);
      else if (diffDays === 2) grupos.hace2dias.push(cam);
      else if (diffDays === 3) grupos.hace3dias.push(cam);
      else grupos.mas.push(cam);
    });

    return grupos;
  };

  const camionadasPorDia = agruparPorDia();
  const camionadasFiltradas = camionadasPorDia[diaSeleccionado] || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <HiTruck className="text-orange-600" />
            Sistema de Despacho
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Gestión completa de plantas, lotes y camionadas
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={cargarDatos}
          disabled={loading}
          icon={HiRefresh}
        >
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-gray-200">
        <div className="flex gap-1 -mb-0.5">
          <button
            onClick={() => setVistaActiva('camionadas')}
            className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActiva === 'camionadas'
                ? 'bg-orange-600 text-white shadow-lg transform translate-y-0.5'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            <HiTruck className="w-5 h-5" />
            <span>Camionadas</span>
            {camionadas.length > 0 && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${vistaActiva === 'camionadas' ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-700'
                }`}>
                {camionadas.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setVistaActiva('recepcion')}
            className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActiva === 'recepcion'
                ? 'bg-green-600 text-white shadow-lg transform translate-y-0.5'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            <HiCheckCircle className="w-5 h-5" />
            <span>Recepción</span>
          </button>

          <button
            onClick={() => setVistaActiva('lotes')}
            className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActiva === 'lotes'
                ? 'bg-blue-600 text-white shadow-lg transform translate-y-0.5'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            <HiCube className="w-5 h-5" />
            <span>Lotes</span>
          </button>

          <button
            onClick={() => setVistaActiva('plantas')}
            className={`relative flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${vistaActiva === 'plantas'
                ? 'bg-purple-600 text-white shadow-lg transform translate-y-0.5'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            <HiOfficeBuilding className="w-5 h-5" />
            <span>Plantas</span>
            {plantas.length > 0 && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${vistaActiva === 'plantas' ? 'bg-white text-purple-600' : 'bg-purple-100 text-purple-700'
                }`}>
                {plantas.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VISTA DE CAMIONADAS */}
      {vistaActiva === 'camionadas' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">Gestión de Camionadas</h3>
            <Button
              variant="success"
              onClick={() => setMostrarFormCamionada(!mostrarFormCamionada)}
              icon={HiPlus}
            >
              Nueva Camionada
            </Button>
          </div>

          {/* Formulario de Nueva(s) Camionada(s) */}
          {mostrarFormCamionada && (
            <CamionadasMultiplesForm
              onSuccess={handleCamionadaCreada}
              onCancel={() => setMostrarFormCamionada(false)}
            />
          )}

          {/* Modal de Recepción */}
          {mostrarRecepcion && camionadaSeleccionada && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold mb-4">Recepcionar Camionada</h3>
                <div className="mb-4 bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">
                    <strong>Patente:</strong> {camionadaSeleccionada.patente}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Peso Teórico:</strong> {camionadaSeleccionada.peso} ton
                  </p>
                </div>

                <form onSubmit={handleRecepcionarCamionada} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso Real (ton) *
                    </label>
                    <input
                      type="number"
                      name="peso_real"
                      step="0.01"
                      required
                      placeholder="29"
                      defaultValue={camionadaSeleccionada.peso}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Peso medido en romana (puede diferir del teórico)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Recepción *
                    </label>
                    <input
                      type="date"
                      name="fecha_recepcion"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora Recepción *
                    </label>
                    <input
                      type="time"
                      name="hora_recepcion"
                      required
                      defaultValue={new Date().toTimeString().slice(0, 5)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ley Laboratorio
                    </label>
                    <input
                      type="number"
                      name="ley_lab_camion"
                      step="0.001"
                      placeholder="1.250"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ticket
                    </label>
                    <input
                      type="text"
                      name="ticket"
                      placeholder="12345"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Número de ticket de romana</p>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" variant="success" disabled={loading}>
                      {loading ? 'Guardando...' : 'Recepcionar'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setMostrarRecepcion(false);
                        setCamionadaSeleccionada(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tabs por Día */}
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            {[
              { key: 'hoy', label: 'Hoy', count: camionadasPorDia.hoy.length },
              { key: 'ayer', label: 'Ayer', count: camionadasPorDia.ayer.length },
              { key: 'hace2dias', label: 'Hace 2 días', count: camionadasPorDia.hace2dias.length },
              { key: 'hace3dias', label: 'Hace 3 días', count: camionadasPorDia.hace3dias.length },
              { key: 'mas', label: 'Más antiguos', count: camionadasPorDia.mas.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setDiaSeleccionado(tab.key)}
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${diaSeleccionado === tab.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Tabla de Camionadas */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando...</p>
            </div>
          ) : camionadasFiltradas.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <HiTruck className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No hay camionadas para este día</p>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Hora</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Patente</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Mezcla</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Planta</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Empresa</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Peso T.</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Peso R.</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Estado</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {camionadasFiltradas.map((camionada) => (
                      <tr
                        key={camionada.id}
                        className="hover:bg-orange-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setCamionadaSeleccionada(camionada);
                          setMostrarDetalles(true);
                        }}
                      >
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {camionada.hora_despacho || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-semibold">
                          {camionada.patente}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {camionada.mezcla?.codigo || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {camionada.planta || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {camionada.cliente || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {camionada.peso} t
                        </td>
                        <td className="px-4 py-3 text-right">
                          {camionada.peso_real ? (
                            <span className="text-green-600 font-semibold">{camionada.peso_real} t</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <span className={`${getEstadoColor(camionada.estado)} text-white px-2 py-1 rounded-full text-xs font-bold inline-block`}>
                            {camionada.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => {
                                setCamionadaSeleccionada(camionada);
                                setMostrarDetalles(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <HiEye className="w-5 h-5" />
                            </button>
                            {camionada.estado === 'Despachado' && (
                              <button
                                onClick={() => {
                                  setCamionadaSeleccionada(camionada);
                                  setMostrarRecepcion(true);
                                }}
                                className="text-green-600 hover:text-green-800"
                                title="Recepcionar"
                              >
                                <HiCheckCircle className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEliminarCamionada(camionada.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar"
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
            </Card>
          )}

          {/* Modal de Detalles */}
          {mostrarDetalles && camionadaSeleccionada && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setMostrarDetalles(false)}>
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-bold text-gray-800">Detalles de Camionada</h3>
                  <button onClick={() => setMostrarDetalles(false)} className="text-gray-400 hover:text-gray-600">
                    <HiX className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Patente</p>
                    <p className="text-lg font-bold text-gray-900">{camionadaSeleccionada.patente}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Estado</p>
                    <span className={`${getEstadoColor(camionadaSeleccionada.estado)} text-white px-3 py-1 rounded-full text-sm font-bold`}>
                      {camionadaSeleccionada.estado}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Mezcla</p>
                    <p className="font-semibold text-gray-900">{camionadaSeleccionada.mezcla?.codigo || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Planta</p>
                    <p className="font-semibold text-gray-900">{camionadaSeleccionada.planta || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Empresa</p>
                    <p className="font-semibold text-gray-900">{camionadaSeleccionada.cliente || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Fecha/Hora Despacho</p>
                    <p className="font-semibold text-gray-900">
                      {camionadaSeleccionada.fecha_despacho} {camionadaSeleccionada.hora_despacho}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-xs text-blue-600 mb-1">Peso Teórico</p>
                    <p className="text-xl font-bold text-blue-700">{camionadaSeleccionada.peso} t</p>
                  </div>
                  {camionadaSeleccionada.peso_real && (
                    <>
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-xs text-green-600 mb-1">Peso Real</p>
                        <p className="text-xl font-bold text-green-700">{camionadaSeleccionada.peso_real} t</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 mb-1">Diferencia</p>
                        <p className={`text-lg font-bold ${camionadaSeleccionada.diferencia > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {camionadaSeleccionada.diferencia > 0 ? '+' : ''}{camionadaSeleccionada.diferencia} t
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 mb-1">Fecha/Hora Recepción</p>
                        <p className="font-semibold text-gray-900">
                          {camionadaSeleccionada.fecha_recepcion} {camionadaSeleccionada.hora_recepcion}
                        </p>
                      </div>
                    </>
                  )}
                  {camionadaSeleccionada.ley_visual && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500 mb-1">Ley Visual</p>
                      <p className="font-semibold text-gray-900">{camionadaSeleccionada.ley_visual}%</p>
                    </div>
                  )}
                  {camionadaSeleccionada.ley_mezcla && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500 mb-1">Ley Lote</p>
                      <p className="font-semibold text-gray-900">{camionadaSeleccionada.ley_mezcla}%</p>
                    </div>
                  )}
                  {camionadaSeleccionada.ley_lab_camion && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500 mb-1">Ley Laboratorio</p>
                      <p className="font-semibold text-gray-900">{camionadaSeleccionada.ley_lab_camion}%</p>
                    </div>
                  )}
                  {camionadaSeleccionada.ticket && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500 mb-1">Ticket</p>
                      <p className="font-semibold text-gray-900">{camionadaSeleccionada.ticket}</p>
                    </div>
                  )}
                  {camionadaSeleccionada.observaciones && (
                    <div className="bg-gray-50 p-3 rounded col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Observaciones</p>
                      <p className="text-gray-900">{camionadaSeleccionada.observaciones}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3 justify-end">
                  {camionadaSeleccionada.estado === 'Despachado' && (
                    <Button
                      variant="success"
                      onClick={() => {
                        setMostrarDetalles(false);
                        setMostrarRecepcion(true);
                      }}
                      icon={HiCheckCircle}
                    >
                      Recepcionar
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setMostrarDetalles(false)}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA DE RECEPCIÓN */}
      {vistaActiva === 'recepcion' && (
        <RecepcionPanel />
      )}

      {/* VISTA DE LOTES - TABS */}
      {vistaActiva === 'lotes' && (
        <div className="space-y-4">
          {/* Header con Tabs */}
          <Card className="border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <HiCube className="w-7 h-7 text-blue-600" />
                Gestión de Lotes
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b-2 border-gray-200 pb-2">
              <button
                onClick={() => setTabLotesActivo('abiertos')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${tabLotesActivo === 'abiertos'
                    ? 'bg-blue-600 text-white shadow-lg transform translate-y-0.5'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <HiClock className="w-5 h-5" />
                <span>Abiertos</span>
                {lotes.length > 0 && tabLotesActivo === 'abiertos' && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white text-blue-600">
                    {lotes.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setTabLotesActivo('completados')}
                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all rounded-t-lg ${tabLotesActivo === 'completados'
                    ? 'bg-green-600 text-white shadow-lg transform translate-y-0.5'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <HiCheckCircle className="w-5 h-5" />
                <span>Completados</span>
                {paginacionLotes.total > 0 && tabLotesActivo === 'completados' && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white text-green-600">
                    {paginacionLotes.total}
                  </span>
                )}
              </button>
            </div>
          </Card>

          {/* Filtros y Búsqueda */}
          <Card className="border-l-4 border-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Búsqueda */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🔍 Buscar
                </label>
                <input
                  type="text"
                  name="search"
                  value={filtrosLotes.search}
                  onChange={handleFiltroLoteChange}
                  placeholder="Número de lote, planta, empresa..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Planta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiOfficeBuilding className="inline mr-1" />
                  Planta
                </label>
                <select
                  name="planta_id"
                  value={filtrosLotes.planta_id}
                  onChange={handleFiltroLoteChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {plantas.map(planta => (
                    <option key={planta.id} value={planta.id}>
                      {planta.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Empresa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiBriefcase className="inline mr-1" />
                  Empresa
                </label>
                <select
                  name="empresa_id"
                  value={filtrosLotes.empresa_id}
                  onChange={handleFiltroLoteChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {empresas.map(empresa => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtros de Fecha (solo para completados) */}
            {tabLotesActivo === 'completados' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Desde
                  </label>
                  <input
                    type="date"
                    name="fecha_desde"
                    value={filtrosLotes.fecha_desde}
                    onChange={handleFiltroLoteChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Hasta
                  </label>
                  <input
                    type="date"
                    name="fecha_hasta"
                    value={filtrosLotes.fecha_hasta}
                    onChange={handleFiltroLoteChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="secondary"
                    onClick={limpiarFiltrosLotes}
                    className="w-full"
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            )}

            {/* Botón limpiar (para tab abiertos) */}
            {tabLotesActivo === 'abiertos' && (
              <div className="mt-4">
                <Button
                  variant="secondary"
                  onClick={limpiarFiltrosLotes}
                  size="sm"
                >
                  Limpiar Filtros
                </Button>
              </div>
            )}
          </Card>

          {/* Tabla de Lotes */}
          {loading ? (
            <Card>
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Cargando lotes...</p>
              </div>
            </Card>
          ) : lotes.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <HiCube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium mb-2">
                  {tabLotesActivo === 'abiertos' ? 'No hay lotes abiertos' : 'No hay lotes completados'}
                </p>
                <p className="text-gray-500 text-sm">
                  {tabLotesActivo === 'abiertos'
                    ? 'Los lotes se crean automáticamente al registrar camionadas'
                    : 'Los lotes completados aparecerán aquí una vez que cierres lotes abiertos'}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="border-l-4 border-blue-500">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-bold text-blue-900">Número Lote</th>
                      <th className="text-left py-3 px-4 font-bold text-blue-900">Planta</th>
                      <th className="text-left py-3 px-4 font-bold text-blue-900">Empresa</th>
                      <th className="text-center py-3 px-4 font-bold text-blue-900">Camionadas</th>
                      <th className="text-right py-3 px-4 font-bold text-blue-900">Peso Total</th>
                      <th className="text-center py-3 px-4 font-bold text-blue-900">Ley Lote</th>
                      <th className="text-center py-3 px-4 font-bold text-blue-900">Ley Visual</th>
                      {tabLotesActivo === 'abiertos' && (
                        <th className="text-center py-3 px-4 font-bold text-blue-900">Progreso</th>
                      )}
                      {tabLotesActivo === 'completados' && (
                        <th className="text-center py-3 px-4 font-bold text-blue-900">Fecha</th>
                      )}
                      <th className="text-center py-3 px-4 font-bold text-blue-900">Estado</th>
                      <th className="text-center py-3 px-4 font-bold text-blue-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lotes.map((lote, index) => {
                      const totalCamionadas = lote.numero_camionadas || lote.camionadas?.length || 0;
                      const camionadasRecepcionadas = lote.camionadas_recepcionadas || 0;
                      const progresoRecepcion = totalCamionadas > 0
                        ? Math.round((camionadasRecepcionadas / totalCamionadas) * 100)
                        : 0;
                      const totalPeso = lote.peso_total || 0;
                      const todasRecepcionadas = lote.todas_recepcionadas || (camionadasRecepcionadas === totalCamionadas && totalCamionadas > 0);

                      return (
                        <tr
                          key={lote.id}
                          className={`hover:bg-blue-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                          onClick={() => handleVerDetalleLote(lote.id)}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900">{lote.numero_lote}</div>
                            {tabLotesActivo === 'abiertos' && !todasRecepcionadas && (
                              <div className="text-xs text-yellow-600 mt-1">
                                ⚠️ Faltan recepciones
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <HiOfficeBuilding className="w-4 h-4 text-blue-600" />
                              <span className="text-gray-700">{lote.planta?.nombre || lote.planta_nombre || '-'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <HiBriefcase className="w-4 h-4 text-purple-600" />
                              <span className="text-gray-700">{lote.empresa?.nombre || lote.empresa_nombre || '-'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                              <HiTruck className="w-4 h-4 mr-1" />
                              {totalCamionadas}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">
                            {parseFloat(totalPeso).toFixed(2)} t
                          </td>
                          <td className="py-3 px-4 text-center">
                            {lote.ley_lote_promedio !== null && lote.ley_lote_promedio !== undefined
                              ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-semibold text-xs">
                                  {lote.ley_lote_promedio.toFixed(2)}%
                                </span>
                              )
                              : <span className="text-gray-400 text-xs">N/A</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {lote.ley_visual_promedio !== null && lote.ley_visual_promedio !== undefined
                              ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs">
                                  {lote.ley_visual_promedio.toFixed(2)}%
                                </span>
                              )
                              : <span className="text-gray-400 text-xs">N/A</span>}
                          </td>
                          {tabLotesActivo === 'abiertos' && (
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">{camionadasRecepcionadas}/{totalCamionadas}</span>
                                  <span className={`font-bold ${progresoRecepcion === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                    {progresoRecepcion}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${progresoRecepcion === 100 ? 'bg-green-500' : 'bg-blue-500'
                                      }`}
                                    style={{ width: `${progresoRecepcion}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          )}
                          {tabLotesActivo === 'completados' && (
                            <td className="py-3 px-4 text-center text-gray-600">
                              {lote.fecha_creacion ? new Date(lote.fecha_creacion).toLocaleDateString('es-CL') : '-'}
                            </td>
                          )}
                          <td className="py-3 px-4 text-center">
                            <Badge color={lote.estado === 'Abierto' ? 'blue' : 'green'} size="sm">
                              {lote.estado === 'Abierto' ? '🔓 Abierto' : '✅ Completado'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={HiEye}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerDetalleLote(lote.id);
                                }}
                              >
                                Ver
                              </Button>
                              {lote.estado === 'Abierto' && (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    icon={HiCheckCircle}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCerrarLote(lote);
                                    }}
                                    disabled={!todasRecepcionadas}
                                    title={!todasRecepcionadas ? 'Debes recepcionar todas las camionadas primero' : 'Cerrar lote'}
                                  >
                                    Cerrar
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    icon={HiTrash}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLoteAEliminar(lote);
                                      setMostrarModalEliminarLote(true);
                                    }}
                                    title="Eliminar lote con opciones para las camionadas"
                                  >
                                    Eliminar
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación (solo para completados) */}
              {tabLotesActivo === 'completados' && paginacionLotes.last_page > 1 && (
                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Mostrando {((paginacionLotes.page - 1) * paginacionLotes.per_page) + 1} - {Math.min(paginacionLotes.page * paginacionLotes.per_page, paginacionLotes.total)} de {paginacionLotes.total} lotes
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePaginaLotesChange(paginacionLotes.page - 1)}
                      disabled={paginacionLotes.page === 1}
                    >
                      ◄ Anterior
                    </Button>
                    <div className="flex gap-1">
                      {[...Array(Math.min(5, paginacionLotes.last_page))].map((_, i) => {
                        let pageNum;
                        if (paginacionLotes.last_page <= 5) {
                          pageNum = i + 1;
                        } else if (paginacionLotes.page <= 3) {
                          pageNum = i + 1;
                        } else if (paginacionLotes.page >= paginacionLotes.last_page - 2) {
                          pageNum = paginacionLotes.last_page - 4 + i;
                        } else {
                          pageNum = paginacionLotes.page - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePaginaLotesChange(pageNum)}
                            className={`px-3 py-1 rounded ${paginacionLotes.page === pageNum
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePaginaLotesChange(paginacionLotes.page + 1)}
                      disabled={paginacionLotes.page === paginacionLotes.last_page}
                    >
                      Siguiente ►
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Modal de Detalle de Lote */}
      {mostrarModalDetalleLote && loteSeleccionado && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setMostrarModalDetalleLote(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Sticky */}
            <div className="sticky top-0 bg-white border-b-4 border-blue-500 px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-2xl font-bold text-gray-900">Detalle del Lote</h2>
              <button
                onClick={() => setMostrarModalDetalleLote(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {loadingDetalleLote ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Cargando detalles...</p>
                </div>
              ) : (
                <>
                  {/* Header del Lote */}
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {loteSeleccionado.numero_lote}
                      </h3>
                      <Badge variant={getEstadoVariant(loteSeleccionado.estado)}>
                        {loteSeleccionado.estado}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                        <HiOfficeBuilding className="inline mr-1" />
                        {loteSeleccionado.planta?.nombre}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                        <HiBriefcase className="inline mr-1" />
                        {loteSeleccionado.empresa?.nombre}
                      </span>
                    </div>
                  </div>

                  {/* Estadísticas */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-gray-600 mb-1">Total Camionadas</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {loteSeleccionado.camionadas?.length || 0}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-xs text-gray-600 mb-1">Peso Total</p>
                      <p className="text-2xl font-bold text-green-700">
                        {loteSeleccionado.camionadas?.reduce((sum, c) => {
                          const peso = c.peso_real !== null && c.peso_real !== undefined ? c.peso_real : c.peso;
                          return sum + parseFloat(peso || 0);
                        }, 0).toFixed(2)} t
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-gray-600 mb-1">Mezclas</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {new Set(loteSeleccionado.camionadas?.map(c => c.mezcla_id)).size || 0}
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <p className="text-xs text-gray-600 mb-1">Ley Lote Prom.</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {loteSeleccionado.ley_lote_promedio !== null && loteSeleccionado.ley_lote_promedio !== undefined
                          ? `${loteSeleccionado.ley_lote_promedio.toFixed(2)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <p className="text-xs text-gray-600 mb-1">Ley Visual Prom.</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {loteSeleccionado.ley_visual_promedio !== null && loteSeleccionado.ley_visual_promedio !== undefined
                          ? `${loteSeleccionado.ley_visual_promedio.toFixed(2)}%`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Tabla de Camionadas */}
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <HiTruck />
                      Camionadas del Lote
                    </h4>

                    {loteSeleccionado.camionadas && loteSeleccionado.camionadas.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">#</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Mezcla</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Patente</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Fecha</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Peso</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Ley Lote</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Ley Visual</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {loteSeleccionado.camionadas.map((camionada, index) => (
                              <tr
                                key={camionada.id}
                                className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  }`}
                              >
                                <td className="px-3 py-2 font-bold text-gray-700">{camionada.numero_camionada}</td>
                                <td className="px-3 py-2 font-mono text-blue-600">
                                  {camionada.mezcla?.codigo || '-'}
                                </td>
                                <td className="px-3 py-2 font-mono">{camionada.patente}</td>
                                <td className="px-3 py-2">
                                  {new Date(camionada.fecha_despacho).toLocaleDateString('es-CL')}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold">
                                  {(() => {
                                    const peso = camionada.peso_real !== null && camionada.peso_real !== undefined
                                      ? camionada.peso_real
                                      : camionada.peso;
                                    return parseFloat(peso).toFixed(2);
                                  })()} t
                                  {camionada.peso_real !== null && camionada.peso_real !== undefined && (
                                    <span className="text-xs text-green-600 ml-1">✓</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {camionada.mezcla?.ley_prom_lote !== null && camionada.mezcla?.ley_prom_lote !== undefined
                                    ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold text-xs">
                                        {parseFloat(camionada.mezcla.ley_prom_lote).toFixed(2)}%
                                      </span>
                                    )
                                    : <span className="text-gray-400 text-xs">N/A</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {camionada.mezcla?.ley_prom_visual !== null && camionada.mezcla?.ley_prom_visual !== undefined
                                    ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs">
                                        {parseFloat(camionada.mezcla.ley_prom_visual).toFixed(2)}%
                                      </span>
                                    )
                                    : <span className="text-gray-400 text-xs">N/A</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Badge variant={getEstadoVariant(camionada.estado)}>
                                    {camionada.estado}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gradient-to-r from-gray-100 to-gray-50 border-t-2 border-gray-400">
                            <tr>
                              <td colSpan="4" className="px-3 py-3 text-gray-900 font-bold text-sm">TOTALES</td>
                              <td className="px-3 py-3 text-right text-gray-900 font-bold">
                                {loteSeleccionado.camionadas.reduce((sum, c) => {
                                  const peso = c.peso_real !== null && c.peso_real !== undefined ? c.peso_real : c.peso;
                                  return sum + parseFloat(peso || 0);
                                }, 0).toFixed(2)} t
                              </td>
                              <td className="px-3 py-3 text-center">
                                {loteSeleccionado.ley_lote_promedio !== null && loteSeleccionado.ley_lote_promedio !== undefined
                                  ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-200 text-orange-900 font-bold text-xs">
                                      {loteSeleccionado.ley_lote_promedio.toFixed(2)}%
                                    </span>
                                  )
                                  : <span className="text-gray-500 text-xs">N/A</span>}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {loteSeleccionado.ley_visual_promedio !== null && loteSeleccionado.ley_visual_promedio !== undefined
                                  ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-200 text-amber-900 font-bold text-xs">
                                      {loteSeleccionado.ley_visual_promedio.toFixed(2)}%
                                    </span>
                                  )
                                  : <span className="text-gray-500 text-xs">N/A</span>}
                              </td>
                              <td className="px-3 py-3"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                        No hay camionadas en este lote
                      </div>
                    )}
                  </div>

                  {/* Observaciones */}
                  {loteSeleccionado.observaciones && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <p className="text-sm font-semibold text-yellow-900 mb-1">Observaciones:</p>
                      <p className="text-sm text-yellow-800">{loteSeleccionado.observaciones}</p>
                    </div>
                  )}

                  {/* Botones de acción */}
                  {loteSeleccionado.estado === 'Abierto' && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <Button
                        variant="success"
                        onClick={() => handleCerrarLote(loteSeleccionado)}
                        disabled={loading || !loteSeleccionado.todas_recepcionadas}
                        icon={HiCheckCircle}
                      >
                        {loteSeleccionado.todas_recepcionadas
                          ? 'Cerrar Lote y Generar Remanentes'
                          : 'No se puede cerrar (hay camionadas sin recepcionar)'}
                      </Button>
                      {!loteSeleccionado.todas_recepcionadas && (
                        <p className="text-xs text-yellow-600 mt-2">
                          ⚠️ Debes recepcionar todas las camionadas antes de cerrar el lote.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Metadatos */}
                  <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    Creado: {new Date(loteSeleccionado.fecha_creacion).toLocaleDateString('es-CL')} •
                    Actualizado: {new Date(loteSeleccionado.updated_at).toLocaleDateString('es-CL')}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE PLANTAS Y EMPRESAS */}
      {vistaActiva === 'plantas' && (
        <div className="space-y-6">
          {/* Header con sub-tabs */}
          <Card className="border-l-4 border-purple-500">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">⚙️ Gestión de Maestros</h2>
                <p className="text-gray-600">Administración de Plantas y Empresas</p>
              </div>

              {/* Botones de navegación */}
              <div className="flex gap-2">
                <button
                  onClick={() => setVistaPlantasActiva('plantas')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${vistaPlantasActiva === 'plantas'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <HiOfficeBuilding className="w-5 h-5" />
                  <span>Plantas</span>
                </button>
                <button
                  onClick={() => setVistaPlantasActiva('empresas')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${vistaPlantasActiva === 'empresas'
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
          {vistaPlantasActiva === 'plantas' && (
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
                          className={`border-b hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
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
          {vistaPlantasActiva === 'empresas' && (
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
                          className={`border-b hover:bg-purple-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
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
        </div>
      )}

      {/* Modal de Formulario de Planta */}
      {mostrarFormPlanta && vistaPlantasActiva === 'plantas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <form onSubmit={handleSubmitPlanta}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {modoFormPlanta === 'crear' ? 'Nueva Planta' : 'Editar Planta'}
                </h3>
                <button
                  type="button"
                  onClick={() => setMostrarFormPlanta(false)}
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
                  onClick={() => setMostrarFormPlanta(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : modoFormPlanta === 'crear' ? 'Crear Planta' : 'Actualizar Planta'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Formulario de Empresa */}
      {mostrarFormPlanta && vistaPlantasActiva === 'empresas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <form onSubmit={handleSubmitEmpresa}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {modoFormPlanta === 'crear' ? 'Nueva Empresa' : 'Editar Empresa'}
                </h3>
                <button
                  type="button"
                  onClick={() => setMostrarFormPlanta(false)}
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
                  onClick={() => setMostrarFormPlanta(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : modoFormPlanta === 'crear' ? 'Crear Empresa' : 'Actualizar Empresa'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación (solo para plantas/empresas) */}
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

      {/* Modal para cerrar lote */}
      {mostrarModalCerrarLote && loteACerrar && (
        <CerrarLoteModal
          lote={loteACerrar}
          onConfirm={confirmarCerrarLote}
          onCancel={() => {
            setMostrarModalCerrarLote(false);
            setLoteACerrar(null);
          }}
        />
      )}

      {/* Modal para eliminar lote con opciones */}
      <EliminarLoteModal
        show={mostrarModalEliminarLote}
        lote={loteAEliminar}
        onConfirm={handleEliminarLote}
        onCancel={() => {
          setMostrarModalEliminarLote(false);
          setLoteAEliminar(null);
        }}
      />
    </div>
  );
};

export default DespachosView;
