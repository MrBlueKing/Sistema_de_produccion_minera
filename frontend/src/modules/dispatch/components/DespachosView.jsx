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
  HiXCircle,
  HiChevronUp,
  HiChevronDown
} from 'react-icons/hi';
import { HiScale } from 'react-icons/hi2';
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

const DespachosView = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('lotes'); // 'lotes', 'camionadas', 'plantas'

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

  // Estados para camiones
  const [camionesLista, setCamionesLista] = useState([]);
  const [formCamion, setFormCamion] = useState({
    patente: '',
    nombre: '',
    categoria: '',
    tonelaje: '',
    activo: true
  });

  // Estados para lotes
  const [lotes, setLotes] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tabLotesActivo, setTabLotesActivo] = useState('abiertos'); // 'abiertos' o 'completados'
  const [filtrosLotes, setFiltrosLotes] = useState({
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

  // Estados para crear lote manual
  const [mostrarFormLote, setMostrarFormLote] = useState(false);
  const [formLote, setFormLote] = useState({ planta_id: '', empresa_id: '' });
  const [creandoLote, setCreandoLote] = useState(false);

  // Estado para agregar camionada desde card de lote
  const [loteIdParaCamionada, setLoteIdParaCamionada] = useState(null);

  // Lotes abiertos con camionadas (para vista cards)
  const [lotesAbiertosCards, setLotesAbiertosCards] = useState([]);

  // Recepción inline en cards de lotes
  const [recepcionandoId, setRecepcionandoId] = useState(null);
  const [formRecepcionInline, setFormRecepcionInline] = useState({ peso_real: '' });
  const [submittingRecepcion, setSubmittingRecepcion] = useState(false);
  const [showModalRecepcion, setShowModalRecepcion] = useState(false);
  const [camionadaParaRecepcion, setCamionadaParaRecepcion] = useState(null);
  const [formRecepcionModal, setFormRecepcionModal] = useState({
    fecha_recepcion: '',
    hora_recepcion: '',
    peso_real: '',
    observaciones_recepcion: ''
  });

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
        const [plantasRes, empresasRes, camionesRes] = await Promise.all([
          laboratorioService.getPlantas({ activas: 1 }),
          laboratorioService.getEmpresas(),
          laboratorioService.getCamiones()
        ]);
        setPlantas(plantasRes || []);
        setEmpresas(empresasRes || []);
        setCamionesLista(camionesRes || []);
      } else if (vistaActiva === 'lotes') {
        const [plantasRes, empresasRes, lotesAbRes] = await Promise.all([
          laboratorioService.getPlantas({ activas: true }),
          laboratorioService.getEmpresas({ activas: true }),
          laboratorioService.getLotesAbiertosConCamionadas()
        ]);
        setPlantas(plantasRes || []);
        setEmpresas(empresasRes || []);
        setLotesAbiertosCards(lotesAbRes || []);
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

  const handleCamionadaCreada = async (camionada) => {
    toast.success('Camionada creada exitosamente');
    setMostrarFormCamionada(false);
    await cargarDatos();
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

  const handleEliminarCamionada = (id) => {
    setDeleteModal({ show: true, id, nombre: `camionada #${id}`, tipo: 'camionada' });
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

  const resetFormCamion = () => {
    setFormCamion({
      patente: '',
      nombre: '',
      categoria: '',
      tonelaje: '',
      activo: true
    });
  };

  const handleNuevoClick = () => {
    setModoFormPlanta('crear');
    setPlantaSeleccionada(null);
    if (vistaPlantasActiva === 'plantas') {
      resetFormPlanta();
    } else if (vistaPlantasActiva === 'empresas') {
      resetFormEmpresa();
    } else {
      resetFormCamion();
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
    } else if (vistaPlantasActiva === 'empresas') {
      setFormEmpresa({
        nombre: item.nombre || '',
        codigo: item.codigo || '',
        rut: item.rut || '',
        contacto: item.contacto || '',
        telefono: item.telefono || '',
        email: item.email || '',
        activo: item.activo !== undefined ? item.activo : true
      });
    } else {
      setFormCamion({
        patente: item.patente || '',
        nombre: item.nombre || '',
        categoria: item.categoria || '',
        tonelaje: item.tonelaje || '',
        activo: item.activo !== undefined ? item.activo : true
      });
    }
    setMostrarFormPlanta(true);
  };

  const handleEliminarClick = (item, tipo) => {
    setDeleteModal({
      show: true,
      id: item.id,
      nombre: item.nombre || item.patente,
      tipo
    });
  };

  const handleFormChange = (e, tipo) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    if (tipo === 'planta') {
      setFormPlanta(prev => ({ ...prev, [name]: val }));
    } else if (tipo === 'empresa') {
      setFormEmpresa(prev => ({ ...prev, [name]: val }));
    } else if (tipo === 'camion') {
      setFormCamion(prev => ({ ...prev, [name]: val }));
    }
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      if (deleteModal.tipo === 'planta') {
        await laboratorioService.deletePlanta(deleteModal.id);
        toast.success('Planta eliminada exitosamente');
      } else if (deleteModal.tipo === 'empresa') {
        await laboratorioService.deleteEmpresa(deleteModal.id);
        toast.success('Empresa eliminada exitosamente');
      } else if (deleteModal.tipo === 'camion') {
        await laboratorioService.deleteCamion(deleteModal.id);
        toast.success('Camión eliminado exitosamente');
      } else if (deleteModal.tipo === 'camionada') {
        await laboratorioService.deleteCamionada(deleteModal.id);
        toast.success('Camionada eliminada');
        cargarDatos();
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
      // Recargar cards de lotes abiertos
      const lotesAbRes = await laboratorioService.getLotesAbiertosConCamionadas();
      setLotesAbiertosCards(lotesAbRes || []);
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
        await laboratorioService.createEmpresa(dataToSend);
        toast.success('Empresa creada exitosamente');
      } else {
        await laboratorioService.updateEmpresa(plantaSeleccionada.id, dataToSend);
        toast.success('Empresa actualizada exitosamente');
      }

      setMostrarFormPlanta(false);
      resetFormEmpresa();
      await cargarDatos();
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


  // ============== FUNCIONES CAMIONES ==============

  const handleSubmitCamion = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSend = {
        ...formCamion,
        tonelaje: formCamion.tonelaje ? parseFloat(formCamion.tonelaje) : null,
        patente: formCamion.patente.toUpperCase(),
      };

      if (modoFormPlanta === 'crear') {
        await laboratorioService.createCamion(dataToSend);
        toast.success('Camión creado exitosamente');
      } else {
        await laboratorioService.updateCamion(plantaSeleccionada.id, dataToSend);
        toast.success('Camión actualizado exitosamente');
      }

      setMostrarFormPlanta(false);
      resetFormCamion();
      await cargarDatos();
    } catch (error) {
      console.error('Error al guardar camión:', error);
      toast.error(
        'Error al guardar',
        error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo guardar el camión'
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

  const handleCrearLote = async () => {
    if (!formLote.planta_id || !formLote.empresa_id) {
      toast.warning('Seleccione planta y empresa');
      return;
    }
    setCreandoLote(true);
    try {
      const response = await laboratorioService.createLote({
        planta_id: parseInt(formLote.planta_id),
        empresa_id: parseInt(formLote.empresa_id),
      });
      toast.success('Lote creado', `Lote ${response.lote?.numero_lote || ''} creado exitosamente`);
      setMostrarFormLote(false);
      setFormLote({ planta_id: '', empresa_id: '' });
      // Recargar lotes abiertos cards
      const lotesAbRes = await laboratorioService.getLotesAbiertosConCamionadas();
      setLotesAbiertosCards(lotesAbRes || []);
      await cargarLotes();
    } catch (error) {
      console.error('Error creando lote:', error);
      toast.error('Error al crear lote', error.response?.data?.mensaje || error.message);
    } finally {
      setCreandoLote(false);
    }
  };

  const handleAgregarCamionadaALote = (loteId) => {
    setLoteIdParaCamionada(loteId);
    setMostrarFormCamionada(true);
  };

  const handleCamionadaCreadaDesdeLote = async () => {
    setMostrarFormCamionada(false);
    setLoteIdParaCamionada(null);
    // Recargar cards
    const lotesAbRes = await laboratorioService.getLotesAbiertosConCamionadas();
    setLotesAbiertosCards(lotesAbRes || []);
    await cargarLotes();
  };

  const handleCerrarLote = (lote) => {
    setLoteACerrar(lote);
    setMostrarModalCerrarLote(true);
  };

  // ============== FUNCIONES RECEPCIÓN EN CARDS ==============

  const handleRecepcionRapida = (camionada) => {
    setRecepcionandoId(camionada.id);
    setFormRecepcionInline({ peso_real: camionada.peso || '' });
  };

  const cancelarRecepcionRapida = () => {
    setRecepcionandoId(null);
    setFormRecepcionInline({ peso_real: '' });
  };

  const confirmarRecepcionRapida = async (camionada) => {
    const pesoReal = parseFloat(formRecepcionInline.peso_real);
    if (!pesoReal || pesoReal <= 0) {
      toast.error('El peso real debe ser mayor a 0');
      return;
    }

    setSubmittingRecepcion(true);
    try {
      await laboratorioService.recepcionarCamionada(camionada.id, {
        fecha_recepcion: new Date().toISOString().split('T')[0],
        hora_recepcion: new Date().toTimeString().slice(0, 5),
        peso_real: pesoReal,
      });

      toast.success('Recepcionada', `${camionada.patente} - ${pesoReal.toFixed(2)} t`);
      setRecepcionandoId(null);
      // Recargar cards
      const lotesAbRes = await laboratorioService.getLotesAbiertosConCamionadas();
      setLotesAbiertosCards(lotesAbRes || []);
      await cargarLotes();
    } catch (error) {
      console.error('Error al recepcionar:', error);
      toast.error('Error', error.response?.data?.mensaje || error.message);
    } finally {
      setSubmittingRecepcion(false);
    }
  };

  const handleRecepcionModal = (camionada) => {
    setCamionadaParaRecepcion(camionada);
    setFormRecepcionModal({
      fecha_recepcion: new Date().toISOString().split('T')[0],
      hora_recepcion: new Date().toTimeString().slice(0, 5),
      peso_real: camionada.peso || '',
      observaciones_recepcion: '',
      numero_lote: '',
    });
    setShowModalRecepcion(true);
  };

  const handleSubmitRecepcionModal = async (e) => {
    e.preventDefault();
    if (!formRecepcionModal.peso_real || parseFloat(formRecepcionModal.peso_real) <= 0) {
      toast.error('El peso real debe ser mayor a 0');
      return;
    }

    // Validar nombre del lote si es requerido
    if (!camionadaParaRecepcion.lote?.numero_lote && !formRecepcionModal.numero_lote?.trim()) {
      toast.error('Debe asignar un nombre al lote');
      return;
    }

    setSubmittingRecepcion(true);
    try {
      const datosRecepcion = {
        fecha_recepcion: formRecepcionModal.fecha_recepcion,
        hora_recepcion: formRecepcionModal.hora_recepcion,
        peso_real: parseFloat(formRecepcionModal.peso_real),
        observaciones_recepcion: formRecepcionModal.observaciones_recepcion?.trim() || null,
      };

      // Enviar nombre del lote si se ingresó
      if (formRecepcionModal.numero_lote?.trim()) {
        datosRecepcion.numero_lote = formRecepcionModal.numero_lote.trim();
      }

      await laboratorioService.recepcionarCamionada(camionadaParaRecepcion.id, datosRecepcion);

      toast.success('Camionada recepcionada', `Patente ${camionadaParaRecepcion.patente} recibida`);
      setShowModalRecepcion(false);
      setCamionadaParaRecepcion(null);
      // Recargar cards
      const lotesAbRes = await laboratorioService.getLotesAbiertosConCamionadas();
      setLotesAbiertosCards(lotesAbRes || []);
      await cargarLotes();
    } catch (error) {
      console.error('Error al recepcionar:', error);
      toast.error('Error', error.response?.data?.mensaje || error.response?.data?.message || 'No se pudo recepcionar');
    } finally {
      setSubmittingRecepcion(false);
    }
  };

  const handleReordenarCamionada = async (camionadaId, direccion) => {
    try {
      await laboratorioService.reordenarCamionada(camionadaId, direccion);
      // Recargar cards
      const lotesAbRes = await laboratorioService.getLotesAbiertosConCamionadas();
      setLotesAbiertosCards(lotesAbRes || []);
    } catch (error) {
      console.error('Error al reordenar:', error);
      toast.error('Error', error.response?.data?.mensaje || error.message);
    }
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
            return `${r.codigo} (${toneladas} t, Ley Visual: ${leyVisual}%, Ley Mezcla: ${leyLote}%)`;
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
          ? `${remanenteCreado.codigo} (${toneladasRemanente} t - ${paladas} paladas, Ley Visual: ${leyVisual}%, Ley Mezcla: ${leyLote}%)`
          : `${remanenteCreado.codigo} (${toneladasRemanente} t, Ley Visual: ${leyVisual}%, Ley Mezcla: ${leyLote}%)`;
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
                      <p className="text-xs text-gray-500 mb-1">Ley Mezcla</p>
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
              {tabLotesActivo === 'abiertos' && (
                <Button
                  variant="success"
                  icon={HiPlus}
                  onClick={() => setMostrarFormLote(true)}
                >
                  Abrir Lote
                </Button>
              )}
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
                <span>Lote Venta</span>
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
                <span>Venta</span>
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

          {/* Modal Crear Lote */}
          {mostrarFormLote && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <Card className="max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <HiCube className="text-blue-600" />
                    Abrir Nuevo Lote
                  </h3>
                  <button onClick={() => setMostrarFormLote(false)} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">
                    <HiX />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Planta *</label>
                    <select
                      value={formLote.planta_id}
                      onChange={(e) => setFormLote({ ...formLote, planta_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar planta...</option>
                      {plantas.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
                    <select
                      value={formLote.empresa_id}
                      onChange={(e) => setFormLote({ ...formLote, empresa_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar empresa...</option>
                      {empresas.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre} ({e.codigo})</option>
                      ))}
                    </select>
                  </div>
                  {formLote.planta_id && formLote.empresa_id && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        El nombre del lote se asignará al recepcionar la primera camionada.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <Button variant="secondary" onClick={() => setMostrarFormLote(false)} disabled={creandoLote}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={handleCrearLote} disabled={creandoLote}>
                    {creandoLote ? 'Creando...' : 'Crear Lote'}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Form Camionada desde Card de Lote */}
          {mostrarFormCamionada && loteIdParaCamionada && tabLotesActivo === 'abiertos' && (
            <CamionadasMultiplesForm
              loteIdPreseleccionado={loteIdParaCamionada}
              onSuccess={handleCamionadaCreadaDesdeLote}
              onCancel={() => {
                setMostrarFormCamionada(false);
                setLoteIdParaCamionada(null);
              }}
            />
          )}

          {/* Resumen General por Planta > Empresa */}
          {tabLotesActivo === 'abiertos' && lotesAbiertosCards.length > 0 && (() => {
            // Agrupar lotes por planta > empresa
            const resumen = {};
            lotesAbiertosCards.forEach(lote => {
              const plantaNombre = lote.planta?.nombre || lote.planta_nombre || 'Sin Planta';
              const empresaNombre = lote.empresa?.nombre || lote.empresa_nombre || 'Sin Empresa';
              const key = `${plantaNombre}|||${empresaNombre}`;

              if (!resumen[key]) {
                resumen[key] = {
                  planta: plantaNombre,
                  empresa: empresaNombre,
                  lotes: 0,
                  totalPeso: 0,
                  totalCamionadas: 0,
                  pendientesRecepcion: 0,
                  sumProductoLey: 0,
                  sumPesoConLey: 0,
                };
              }
              resumen[key].lotes += 1;
              const pesoRecibido = parseFloat(lote.peso_recibido || 0);
              resumen[key].totalPeso += pesoRecibido;
              resumen[key].totalCamionadas += (lote.numero_camionadas || lote.camionadas?.length || 0);
              const recep = lote.camionadas_recepcionadas || 0;
              const total = lote.numero_camionadas || lote.camionadas?.length || 0;
              resumen[key].pendientesRecepcion += (total - recep);

              if (lote.ley_lab_promedio != null && pesoRecibido > 0) {
                resumen[key].sumProductoLey += pesoRecibido * parseFloat(lote.ley_lab_promedio);
                resumen[key].sumPesoConLey += pesoRecibido;
              }
            });

            const grupos = Object.values(resumen);
            // Agrupar por planta
            const porPlanta = {};
            grupos.forEach(g => {
              if (!porPlanta[g.planta]) porPlanta[g.planta] = [];
              porPlanta[g.planta].push(g);
            });

            return (
              <Card className="border-l-4 border-indigo-400">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <HiChartBar className="text-indigo-500" />
                  Resumen General
                </h3>
                <div className="space-y-3">
                  {Object.entries(porPlanta).map(([planta, empresas]) => (
                    <div key={planta}>
                      <p className="text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                        <HiOfficeBuilding className="text-blue-500" />
                        {planta}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 ml-4">
                        {empresas.map((emp) => {
                          const leyProm = emp.sumPesoConLey > 0
                            ? (emp.sumProductoLey / emp.sumPesoConLey).toFixed(2)
                            : null;
                          return (
                            <div key={emp.empresa} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                                  <HiBriefcase className="text-purple-500 w-3.5 h-3.5" />
                                  {emp.empresa}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  {emp.lotes} lote{emp.lotes !== 1 ? 's' : ''} | {emp.totalCamionadas} cam.
                                  {emp.pendientesRecepcion > 0 && (
                                    <span className="text-yellow-600 font-semibold"> | {emp.pendientesRecepcion} pend.</span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-green-700">{emp.totalPeso.toFixed(2)} t</p>
                                {leyProm && (
                                  <p className="text-[10px] text-orange-600 font-semibold">Ley Mezcla: {leyProm}%</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* Vista de Lotes */}
          {tabLotesActivo === 'abiertos' ? (
            /* === CARDS DE LOTES ABIERTOS === */
            loading ? (
              <Card>
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Cargando lotes...</p>
                </div>
              </Card>
            ) : lotesAbiertosCards.length === 0 ? (
              <Card>
                <div className="text-center py-12">
                  <HiCube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 font-medium mb-2">No hay lotes abiertos</p>
                  <p className="text-gray-500 text-sm mb-4">
                    Crea un lote manualmente con el botón "Abrir Lote"
                  </p>
                  <Button variant="success" icon={HiPlus} onClick={() => setMostrarFormLote(true)}>
                    Abrir Lote
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {lotesAbiertosCards.map((lote) => {
                  const totalCamionadas = lote.numero_camionadas || lote.camionadas?.length || 0;
                  const camionadasRecepcionadas = lote.camionadas_recepcionadas || 0;
                  const pendientesRecepcion = totalCamionadas - camionadasRecepcionadas;
                  const progresoRecepcion = totalCamionadas > 0
                    ? Math.round((camionadasRecepcionadas / totalCamionadas) * 100)
                    : 0;
                  const pesoRecibido = parseFloat(lote.peso_recibido || 0);
                  const pesoTeorico = parseFloat(lote.peso_total || 0);
                  const todasRecepcionadas = lote.todas_recepcionadas || (camionadasRecepcionadas === totalCamionadas && totalCamionadas > 0);

                  return (
                    <Card key={lote.id} className="border-2 border-blue-200 hover:border-blue-400 transition-all">
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <HiCube className="text-blue-600" />
                            {lote.numero_lote
                              ? <>Lote: {lote.numero_lote}</>
                              : <span className="text-yellow-600 italic">Sin número de Lote</span>
                            }
                            <span className="text-sm font-normal text-gray-500">
                              ({lote.empresa?.nombre || lote.empresa_nombre || '-'})
                            </span>
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            <HiOfficeBuilding className="inline mr-1" />
                            {lote.planta?.nombre || lote.planta_nombre || '-'}
                            {' | '}
                            {totalCamionadas} camionada(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {pendientesRecepcion > 0 && (
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
                              {pendientesRecepcion} pendiente{pendientesRecepcion !== 1 ? 's' : ''}
                            </span>
                          )}
                          <Badge color={todasRecepcionadas ? 'green' : 'blue'} size="sm">
                            {todasRecepcionadas ? 'Listo para cerrar' : 'Abierto'}
                          </Badge>
                        </div>
                      </div>

                      {/* Stats del lote */}
                      {totalCamionadas > 0 && (
                        <div className="mb-3 space-y-2">
                          {/* Peso y leyes */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-green-50 rounded-lg px-3 py-2 text-center border border-green-100">
                              <p className="text-[10px] text-gray-500 uppercase font-semibold">Peso Real</p>
                              <p className="text-sm font-bold text-green-700">
                                {pesoRecibido > 0 ? `${pesoRecibido.toFixed(2)} t` : '-'}
                              </p>
                              {pesoTeorico > 0 && (
                                <p className="text-[10px] text-gray-400">Teórico: {pesoTeorico.toFixed(2)} t</p>
                              )}
                            </div>
                            <div className="bg-orange-50 rounded-lg px-3 py-2 text-center border border-orange-100">
                              <p className="text-[10px] text-gray-500 uppercase font-semibold">Ley Mezcla</p>
                              <p className="text-sm font-bold text-orange-700">
                                {lote.ley_lab_promedio != null ? `${parseFloat(lote.ley_lab_promedio).toFixed(2)}%` : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-amber-50 rounded-lg px-3 py-2 text-center border border-amber-100">
                              <p className="text-[10px] text-gray-500 uppercase font-semibold">Ley Visual</p>
                              <p className="text-sm font-bold text-amber-700">
                                {lote.ley_visual_promedio != null ? `${parseFloat(lote.ley_visual_promedio).toFixed(2)}%` : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Barra de progreso recepción */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">Recepcionadas: {camionadasRecepcionadas}/{totalCamionadas}</span>
                              <span className={`font-bold ${progresoRecepcion === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                {progresoRecepcion}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${progresoRecepcion === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${progresoRecepcion}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Camionadas con recepción inline */}
                      {lote.camionadas && lote.camionadas.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {lote.camionadas.map((cam) => {
                            const esDespachado = cam.estado === 'Despachado';
                            const isRecepcionando = recepcionandoId === cam.id;
                            const yaRecepcionado = cam.peso_real !== null && cam.peso_real !== undefined;
                            const loteNecesitaNombre = !lote.numero_lote;

                            return (
                              <div
                                key={cam.id}
                                className={`rounded-lg border p-2.5 transition-all ${
                                  isRecepcionando
                                    ? 'border-green-400 bg-green-50 shadow-sm'
                                    : yaRecepcionado
                                      ? 'border-green-200 bg-green-50/50'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  {/* Info camionada */}
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Orden + flechas */}
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <div className="flex flex-col">
                                        <button
                                          onClick={() => handleReordenarCamionada(cam.id, 'subir')}
                                          className="text-gray-300 hover:text-blue-600 transition-colors p-0 leading-none"
                                          title="Subir"
                                        >
                                          <HiChevronUp className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleReordenarCamionada(cam.id, 'bajar')}
                                          className="text-gray-300 hover:text-blue-600 transition-colors p-0 leading-none"
                                          title="Bajar"
                                        >
                                          <HiChevronDown className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                                        {cam.numero_camionada}
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-gray-900 text-sm">{cam.patente}</span>
                                    <span className="text-xs text-gray-500 hidden sm:inline">
                                      <HiScale className="inline text-gray-400 mr-0.5" />
                                      {parseFloat(cam.peso).toFixed(2)} t
                                    </span>
                                    <span className="text-xs text-blue-600 font-mono hidden md:inline">{cam.mezcla?.codigo || '-'}</span>
                                    {cam.mezcla?.ley_lab != null && (
                                      <span className="text-xs text-orange-600 font-semibold hidden sm:inline">
                                        {parseFloat(cam.mezcla.ley_lab).toFixed(2)}%
                                      </span>
                                    )}
                                    {yaRecepcionado && (
                                      <span className="text-xs font-bold text-green-600">
                                        <HiCheckCircle className="inline mr-0.5" />
                                        {parseFloat(cam.peso_real).toFixed(2)} t
                                      </span>
                                    )}
                                  </div>

                                  {/* Estado o acciones de recepción */}
                                  {!esDespachado ? (
                                    <span className={`${getEstadoColor(cam.estado)} text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0`}>
                                      {cam.estado}
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleRecepcionModal({ ...cam, lote })}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-md transition-colors flex-shrink-0"
                                    >
                                      <HiCheckCircle className="w-3.5 h-3.5" />
                                      Recepcionar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg mb-3">
                          Sin camionadas
                        </div>
                      )}

                      {/* Card Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={HiPlus}
                          onClick={() => handleAgregarCamionadaALote(lote.id)}
                        >
                          Agregar Recargo
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={HiEye}
                          onClick={() => handleVerDetalleLote(lote.id)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          icon={HiCheckCircle}
                          onClick={() => handleCerrarLote(lote)}
                          disabled={!todasRecepcionadas}
                          title={!todasRecepcionadas ? 'Debes recepcionar todas las camionadas' : 'Cerrar lote'}
                        >
                          Cerrar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={HiTrash}
                          onClick={() => {
                            setLoteAEliminar(lote);
                            setMostrarModalEliminarLote(true);
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            /* === TABLA DE LOTES COMPLETADOS === */
            loading ? (
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
                  <p className="text-gray-700 font-medium mb-2">No hay lotes completados</p>
                  <p className="text-gray-500 text-sm">
                    Los lotes completados aparecerán aquí una vez que cierres lotes abiertos
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="border-l-4 border-green-500">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-bold text-green-900">Número Lote</th>
                        <th className="text-left py-3 px-4 font-bold text-green-900">Planta</th>
                        <th className="text-left py-3 px-4 font-bold text-green-900">Empresa</th>
                        <th className="text-center py-3 px-4 font-bold text-green-900">Camionadas</th>
                        <th className="text-right py-3 px-4 font-bold text-green-900">Peso Total</th>
                        <th className="text-center py-3 px-4 font-bold text-green-900">Ley Mezcla</th>
                        <th className="text-center py-3 px-4 font-bold text-green-900">Ley Visual</th>
                        <th className="text-center py-3 px-4 font-bold text-green-900">Fecha</th>
                        <th className="text-center py-3 px-4 font-bold text-green-900">Estado</th>
                        <th className="text-center py-3 px-4 font-bold text-green-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lotes.map((lote, index) => {
                        const totalCamionadas = lote.numero_camionadas || lote.camionadas?.length || 0;
                        const totalPeso = lote.peso_total || 0;

                        return (
                          <tr
                            key={lote.id}
                            className={`hover:bg-green-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                            onClick={() => handleVerDetalleLote(lote.id)}
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-gray-900">{lote.numero_lote}</div>
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
                              {lote.ley_lab_promedio !== null && lote.ley_lab_promedio !== undefined
                                ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-semibold text-xs">
                                    {lote.ley_lab_promedio.toFixed(2)}%
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
                            <td className="py-3 px-4 text-center text-gray-600">
                              {lote.fecha_creacion ? new Date(lote.fecha_creacion).toLocaleDateString('es-CL') : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge color="green" size="sm">Completado</Badge>
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
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {paginacionLotes.last_page > 1 && (
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
                        Anterior
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
                                  ? 'bg-green-600 text-white font-bold'
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
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
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
                      <p className="text-xs text-gray-600 mb-1">Ley Lab Prom.</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {loteSeleccionado.ley_lab_promedio !== null && loteSeleccionado.ley_lab_promedio !== undefined
                          ? `${loteSeleccionado.ley_lab_promedio.toFixed(2)}%`
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
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Ley Lab</th>
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
                                  {camionada.mezcla?.ley_lab !== null && camionada.mezcla?.ley_lab !== undefined
                                    ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold text-xs">
                                        {parseFloat(camionada.mezcla.ley_lab).toFixed(2)}%
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
                                {loteSeleccionado.ley_lab_promedio !== null && loteSeleccionado.ley_lab_promedio !== undefined
                                  ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-200 text-orange-900 font-bold text-xs">
                                      {loteSeleccionado.ley_lab_promedio.toFixed(2)}%
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
                <button
                  onClick={() => setVistaPlantasActiva('camiones')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${vistaPlantasActiva === 'camiones'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <HiTruck className="w-5 h-5" />
                  <span>Camiones</span>
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

          {/* Vista de Camiones */}
          {vistaPlantasActiva === 'camiones' && (
            <Card className="border-l-4 border-orange-400">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Camiones</h3>
                <Button variant="primary" icon={HiPlus} onClick={handleNuevoClick}>
                  Nuevo Camión
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader size="lg" />
                </div>
              ) : camionesLista.length === 0 ? (
                <div className="text-center py-12">
                  <HiTruck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay camiones registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b-2 border-orange-200">
                        <th className="text-left py-3 px-3 font-bold text-orange-900">ID</th>
                        <th className="text-left py-3 px-3 font-bold text-orange-900">Patente</th>
                        <th className="text-left py-3 px-3 font-bold text-orange-900">Nombre</th>
                        <th className="text-left py-3 px-3 font-bold text-orange-900">Categoría</th>
                        <th className="text-left py-3 px-3 font-bold text-orange-900">Tonelaje</th>
                        <th className="text-left py-3 px-3 font-bold text-orange-900">Estado</th>
                        <th className="text-left py-3 px-3 font-bold text-orange-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {camionesLista.map((camion, index) => (
                        <tr
                          key={camion.id}
                          className={`border-b hover:bg-orange-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <td className="py-3 px-3 font-bold text-orange-700">#{camion.id}</td>
                          <td className="py-3 px-3 font-mono font-bold">{camion.patente}</td>
                          <td className="py-3 px-3">{camion.nombre}</td>
                          <td className="py-3 px-3 text-xs">{camion.categoria || '-'}</td>
                          <td className="py-3 px-3">{camion.tonelaje ? `${camion.tonelaje} t` : '-'}</td>
                          <td className="py-3 px-3">
                            <Badge color={camion.activo ? 'green' : 'gray'} size="sm">
                              {camion.activo ? (
                                <>
                                  <HiCheckCircle className="inline mr-1" />
                                  Activo
                                </>
                              ) : (
                                <>
                                  <HiXCircle className="inline mr-1" />
                                  Inactivo
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
                                onClick={() => handleEditarClick(camion)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={HiTrash}
                                onClick={() => handleEliminarClick(camion, 'camion')}
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

      {/* Modal de Formulario de Camión */}
      {mostrarFormPlanta && vistaPlantasActiva === 'camiones' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <form onSubmit={handleSubmitCamion}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {modoFormPlanta === 'crear' ? 'Nuevo Camión' : 'Editar Camión'}
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
                      Patente *
                    </label>
                    <input
                      type="text"
                      name="patente"
                      value={formCamion.patente}
                      onChange={(e) => handleFormChange(e, 'camion')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 uppercase font-mono"
                      required
                      placeholder="ABC-1234"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formCamion.nombre}
                      onChange={(e) => handleFormChange(e, 'camion')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      required
                      placeholder="Camión Tolva 01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <input
                      type="text"
                      name="categoria"
                      value={formCamion.categoria}
                      onChange={(e) => handleFormChange(e, 'camion')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      placeholder="Tolva"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tonelaje (t)
                    </label>
                    <input
                      type="number"
                      name="tonelaje"
                      value={formCamion.tonelaje}
                      onChange={(e) => handleFormChange(e, 'camion')}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                      placeholder="29.00"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={formCamion.activo}
                    onChange={(e) => handleFormChange(e, 'camion')}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Camión activo
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
                  {loading ? 'Guardando...' : modoFormPlanta === 'crear' ? 'Crear Camión' : 'Actualizar Camión'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmModal
        show={deleteModal.show}
        title={`Eliminar ${deleteModal.tipo === 'planta' ? 'Planta' : deleteModal.tipo === 'empresa' ? 'Empresa' : deleteModal.tipo === 'camionada' ? 'Camionada' : 'Camión'}`}
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

      {/* Modal de Recepción Completa */}
      {showModalRecepcion && camionadaParaRecepcion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full">
            <form onSubmit={handleSubmitRecepcionModal}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <HiTruck className="text-green-600" />
                    Recepcionar Camionada
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-mono font-bold">{camionadaParaRecepcion.patente}</span>
                    {' '}| Lote {camionadaParaRecepcion.lote?.numero_lote || '-'}
                    {' '}| Peso teórico: {parseFloat(camionadaParaRecepcion.peso).toFixed(2)} t
                  </p>
                </div>
                <button type="button" onClick={() => setShowModalRecepcion(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                  <HiX />
                </button>
              </div>

              <div className="space-y-4">
                {/* Campo nombre del lote - solo si el lote no tiene nombre */}
                {!camionadaParaRecepcion.lote?.numero_lote && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                    <label className="block text-sm font-bold text-yellow-800 mb-1">
                      Nombre del Lote *
                    </label>
                    <input
                      type="text"
                      value={formRecepcionModal.numero_lote}
                      onChange={(e) => setFormRecepcionModal(prev => ({ ...prev, numero_lote: e.target.value }))}
                      placeholder="Ej: CN-001, Lote Enero..."
                      className="w-full px-3 py-2 border-2 border-yellow-400 rounded-md focus:ring-2 focus:ring-yellow-500 font-bold"
                      required
                    />
                    <p className="text-xs text-yellow-600 mt-1">Este es el primer despacho recepcionado. Asigne un nombre al lote.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={formRecepcionModal.fecha_recepcion}
                      onChange={(e) => setFormRecepcionModal(prev => ({ ...prev, fecha_recepcion: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                    <input
                      type="time"
                      value={formRecepcionModal.hora_recepcion}
                      onChange={(e) => setFormRecepcionModal(prev => ({ ...prev, hora_recepcion: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso Real (toneladas) *</label>
                  <input
                    type="number"
                    value={formRecepcionModal.peso_real}
                    onChange={(e) => setFormRecepcionModal(prev => ({ ...prev, peso_real: e.target.value }))}
                    step="0.01"
                    min="0"
                    placeholder="Peso pesado en destino"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  />
                  {formRecepcionModal.peso_real && (
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="text-gray-600">
                        Diferencia:{' '}
                        <span className={`font-bold ${
                          (parseFloat(formRecepcionModal.peso_real) - parseFloat(camionadaParaRecepcion.peso)) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(parseFloat(formRecepcionModal.peso_real) - parseFloat(camionadaParaRecepcion.peso)).toFixed(2)} t
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Error:{' '}
                        <span className="text-orange-600 font-bold">
                          {((Math.abs(parseFloat(formRecepcionModal.peso_real) - parseFloat(camionadaParaRecepcion.peso)) / parseFloat(camionadaParaRecepcion.peso)) * 100).toFixed(2)}%
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    value={formRecepcionModal.observaciones_recepcion}
                    onChange={(e) => setFormRecepcionModal(prev => ({ ...prev, observaciones_recepcion: e.target.value }))}
                    rows="2"
                    placeholder="Notas adicionales..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button type="button" variant="secondary" onClick={() => setShowModalRecepcion(false)} disabled={submittingRecepcion}>
                  Cancelar
                </Button>
                <Button type="submit" variant="success" icon={HiCheckCircle} disabled={submittingRecepcion}>
                  {submittingRecepcion ? 'Recepcionando...' : 'Confirmar Recepción'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DespachosView;
