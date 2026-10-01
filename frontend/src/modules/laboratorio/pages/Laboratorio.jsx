import { useState, useEffect } from 'react';
import { HiHome, HiCheckCircle, HiInformationCircle, HiBeaker, HiArrowPath, HiDocumentText, HiDocumentArrowDown, HiPencil, HiXMark, HiCheck, HiCube } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import NumeroInput from '../../../shared/components/atoms/NumeroInput';
import BulkCompleteModal from '../../../shared/components/molecules/BulkCompleteModal';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../services/laboratorio';
import extraerMensajeError from '../../../core/services/apiError';
import configuracionService from '../../../services/configuracion';
import CertificadosGenerados from '../components/CertificadosGenerados';
import LotesLaboratorio from '../components/LotesLaboratorio';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import api from '../../../core/services/api';
import { useAuth } from '../../../core/context/AuthContext';

export default function Laboratorio() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  // La pestaña Lotes es solo para Jefe de Laboratorio y el rol "Laboratorio y
  // Lotes" (permiso del SAC). El resto de Análisis de Muestras no la ve.
  const puedeVerLotes = hasPermission('ver_lotes_laboratorio');
  const [faenas, setFaenas] = useState([]);
  const [dumpadas, setDumpadas] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);

  // Vista actual: 'pendientes' o 'historial'
  const [vistaActual, setVistaActual] = useState('pendientes');

  // Selección múltiple (para vista pendientes)
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDumpadas, setSelectedDumpadas] = useState([]); // objetos completos cross-página
  const [showBulkCompleteModal, setShowBulkCompleteModal] = useState(false);

  // Selección múltiple (para vista historial - certificados)
  const [selectedHistorialIds, setSelectedHistorialIds] = useState([]);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [regenerandoCertificado, setRegenerandoCertificado] = useState(null); // Para tracking del botón específico

  // Modal "Para" antes de generar certificado
  const [paraModal, setParaModal] = useState({ show: false, para: '', pendingAction: null });
  const [destinatariosFrecuentes, setDestinatariosFrecuentes] = useState([]);
  const [paraEsOtro, setParaEsOtro] = useState(false);
  const [mostrarGestionDestinatarios, setMostrarGestionDestinatarios] = useState(false);
  const [nuevoDestinatario, setNuevoDestinatario] = useState('');
  const [guardandoDestinatarios, setGuardandoDestinatarios] = useState(false);

  // Modal independiente para gestionar destinatarios (accesible sin pasar por generar certificado)
  const [destinatariosModalOpen, setDestinatariosModalOpen] = useState(false);
  const [editandoDestinatario, setEditandoDestinatario] = useState(null);
  const [valorEditado, setValorEditado] = useState('');

  // Edición de análisis
  const [editModal, setEditModal] = useState({ show: false, dumpada: null });
  const [editForm, setEditForm] = useState({ ley: '', cu_soluble: '', cu_insoluble: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Revertir análisis a Pendiente
  const [revertModal, setRevertModal] = useState({ show: false, dumpada: null });
  const [revirtiendo, setRevirtiendo] = useState(false);

  // Edición en secuencia (varias filas de Historial)
  const [modoSeleccionEdicion, setModoSeleccionEdicion] = useState(false);
  const [selectedEditIds, setSelectedEditIds] = useState([]);
  const [colaEdicion, setColaEdicion] = useState([]);
  const [progresoEdicion, setProgresoEdicion] = useState({ actual: 0, total: 0 });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 15;

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    id_faena: '',
    jornada: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_frente_trabajo: [],
    estado_certificado: '', // 'con', 'sin', '' (todos)
    certificado: '', // búsqueda por número de certificado específico
  });

  // Debounce para la búsqueda
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];

  useEffect(() => {
    loadMaestros();
    loadFaenas();
    loadEstadisticas();
    loadDestinatariosFrecuentes();
  }, []);

  const loadDestinatariosFrecuentes = async () => {
    try {
      const lista = await configuracionService.get('certificado_destinatarios_frecuentes');
      setDestinatariosFrecuentes(Array.isArray(lista) ? lista : []);
    } catch (error) {
      console.error('Error cargando destinatarios frecuentes:', error);
    }
  };

  // Recargar cuando cambian filtros, página o vista (también corre en el montaje inicial)
  useEffect(() => {
    loadData();
  }, [currentPage, debouncedSearchTerm, filters, vistaActual]);

  // Cambiar vista y resetear página
  const handleCambiarVista = (nuevaVista) => {
    if (nuevaVista === vistaActual) return;

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
      const statsRes = await laboratorioService.getEstadisticas();
      setEstadisticas(statsRes.data);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
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
        id_faena: filters.id_faena || undefined,
        jornada: filters.jornada || undefined,
        fecha_inicio: filters.fecha_inicio || undefined,
        fecha_fin: filters.fecha_fin || undefined,
        id_frente_trabajo: filters.id_frente_trabajo?.length ? filters.id_frente_trabajo : undefined,
        estado_certificado: filters.estado_certificado || undefined,
        certificado: filters.certificado || undefined,
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      if (vistaActual === 'certificados' || vistaActual === 'lotes') {
        // Estas vistas cargan sus propios datos en su componente
        setLoading(false);
        return;
      }

      let response;
      if (vistaActual === 'pendientes') {
        response = await laboratorioService.getDumpadasPendientes(params);
      } else {
        response = await laboratorioService.getHistorialAnalisis(params);
      }

      // Agregar _key compuesto para evitar colisión de IDs entre dumpadas y muestras_libres
      const items = (response.data || []).map(item => ({
        ...item,
        _key: item.tipo === 'muestra_libre' ? `ml_${item.id}` : `d_${item.id}`,
      }));
      setDumpadas(items);

      if (response.pagination) {
        setTotalPages(response.pagination.last_page);
        setTotalRecords(response.pagination.total);
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

  // Color estable por N° de certificado (para distinguir de un vistazo qué filas
  // pertenecen al mismo certificado en Historial — no son consecutivas, se mezclan
  // con filas "Pendiente" sin certificado, así que no sirve alternar por índice).
  const PALETA_CERTIFICADOS = ['#fef3c7', '#dbeafe', '#fce7f3', '#e0e7ff', '#d1fae5', '#fed7aa'];
  const indicePorCertificado = (numeroCertificado) => {
    const texto = String(numeroCertificado);
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      hash = (hash * 31 + texto.charCodeAt(i)) % PALETA_CERTIFICADOS.length;
    }
    return hash;
  };

  // Colores ya resueltos por fila: el hash de arriba es estable por certificado, pero
  // no garantiza que 2 certificados *distintos* que caen uno justo al lado del otro se
  // vean diferentes (ej. 289002 y 289011 podían "hashear" al mismo color por casualidad).
  // Acá se recorre en orden y, si un certificado nuevo empieza con el mismo color que la
  // fila anterior, se corre al siguiente color de la paleta — sin romper que el mismo
  // certificado mantenga su color mientras se repite en filas consecutivas.
  const coloresPorCertificado = (() => {
    const colores = [];
    let certificadoAnterior = null;
    let colorAnterior = null;
    dumpadas.forEach((d) => {
      if (!d.certificado) {
        colores.push(null);
        certificadoAnterior = null;
        colorAnterior = null;
        return;
      }
      let color;
      if (d.certificado === certificadoAnterior) {
        // Sigue el mismo bloque de certificado: mantener el color ya asignado,
        // no recalcularlo (si no, un bloque largo del mismo certificado podía
        // "perder" el color corrido a mitad de camino).
        color = colorAnterior;
      } else {
        let idx = indicePorCertificado(d.certificado);
        color = PALETA_CERTIFICADOS[idx];
        if (color === colorAnterior) {
          idx = (idx + 1) % PALETA_CERTIFICADOS.length;
          color = PALETA_CERTIFICADOS[idx];
        }
      }
      colores.push(color);
      certificadoAnterior = d.certificado;
      colorAnterior = color;
    });
    return colores;
  })();

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
      id_frente_trabajo: [],
      estado_certificado: '',
      certificado: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Funciones de selección múltiple
  const handleSelectOne = (id) => {
    const dumpada = dumpadas.find(d => d._key === id);
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
    setSelectedDumpadas(prev => {
      if (prev.some(d => d._key === id)) {
        return prev.filter(d => d._key !== id);
      } else {
        return dumpada ? [...prev, dumpada] : prev;
      }
    });
  };

  const handleSelectAll = (dumpadasList) => {
    const allKeys = dumpadasList.map(d => d._key);
    const allSelected = allKeys.every(k => selectedIds.includes(k));
    if (allSelected) {
      // Deseleccionar solo los de esta página
      setSelectedIds(prev => prev.filter(id => !allKeys.includes(id)));
      setSelectedDumpadas(prev => prev.filter(d => !allKeys.includes(d._key)));
    } else {
      // Agregar los de esta página que no estén ya seleccionados
      const nuevosIds = allKeys.filter(k => !selectedIds.includes(k));
      const nuevasDumpadas = dumpadasList.filter(d => !selectedIds.includes(d._key));
      setSelectedIds(prev => [...prev, ...nuevosIds]);
      setSelectedDumpadas(prev => [...prev, ...nuevasDumpadas]);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectedDumpadas([]);
    setSelectedHistorialIds([]);
  };

  // Obtener el certificado actual de los ítems seleccionados en historial
  const getCertificadoSeleccionado = () => {
    if (selectedHistorialIds.length === 0) return null;

    const seleccionadas = dumpadas.filter(d => selectedHistorialIds.includes(d._key));
    const certificados = [...new Set(seleccionadas.map(d => d.certificado).filter(Boolean))];

    if (certificados.length === 1) return certificados[0];
    if (certificados.length > 1) return 'CONFLICTO';

    const algunaSinCertificado = seleccionadas.some(d => !d.certificado);
    if (algunaSinCertificado) return 'SIN_CERTIFICADO';

    return null;
  };

  // Verificar si un ítem del historial es seleccionable (no tiene certificado)
  // Tanto dumpadas como muestras específicas pueden generar certificados
  const isDumpadaSeleccionable = (dumpada) => {
    if (dumpada.certificado) return false;
    return true;
  };

  // Compatible = sin certificado (tipo no restringe)
  const isDumpadaCompatible = (dumpada) => {
    if (dumpada.certificado) return false;
    return true;
  };

  // Obtener mensaje de tooltip para filas deshabilitadas
  const getTooltipMessage = (dumpada) => {
    // Si tiene certificado, mostrar mensaje específico
    if (dumpada.certificado) {
      return `Esta dumpada ya tiene el certificado ${dumpada.certificado}. Usa el botón de descarga para obtener el PDF.`;
    }

    if (isDumpadaCompatible(dumpada)) return null;

    return 'Selección incompatible';
  };

  // Funciones de selección para historial (certificados)
  const handleSelectOneHistorial = (key) => {
    const dumpada = dumpadas.find(d => d._key === key);

    if (selectedHistorialIds.includes(key)) {
      setSelectedHistorialIds(prev => prev.filter(k => k !== key));
      return;
    }

    if (!isDumpadaSeleccionable(dumpada)) {
      toast.info('Certificado existente', getTooltipMessage(dumpada));
      return;
    }

    setSelectedHistorialIds(prev => [...prev, key]);
  };

  const handleSelectAllHistorial = (dumpadasList) => {
    const sinCertificado = dumpadasList.filter(d => !d.certificado);

    // "Seleccionar todo" agrega/quita SOLO las muestras de la página actual,
    // sin pisar lo que ya se marcó en otras páginas (comparar por _key para no
    // colisionar entre dumpadas y muestras libres).
    const keysPagina = sinCertificado.map(d => d._key);
    const todasEnEstaPagina = keysPagina.length > 0 && keysPagina.every(key => selectedHistorialIds.includes(key));

    if (todasEnEstaPagina) {
      setSelectedHistorialIds(prev => prev.filter(k => !keysPagina.includes(k)));
      return;
    }

    // Agregar las de esta página a lo ya seleccionado
    if (keysPagina.length > 0) {
      setSelectedHistorialIds(prev => [...new Set([...prev, ...keysPagina])]);
      const conCertificado = dumpadasList.length - sinCertificado.length;
      if (conCertificado > 0) {
        toast.info(
          'Selección parcial',
          `Se agregaron ${sinCertificado.length} muestras sin certificado. ${conCertificado} ya tienen certificado y solo se pueden descargar.`
        );
      }
    } else {
      toast.info(
        'Sin muestras seleccionables',
        'Todas las muestras en esta página ya tienen certificado. Usa el botón de descarga en cada fila.'
      );
    }
  };

  // Generar certificado PDF
  const handleGenerarCertificado = () => {
    if (selectedHistorialIds.length === 0) {
      toast.warning('Atención', 'Selecciona al menos una muestra para generar el certificado');
      return;
    }

    const certificadoActual = getCertificadoSeleccionado();
    if (certificadoActual === 'CONFLICTO') {
      const seleccionadas = dumpadas.filter(d => selectedHistorialIds.includes(d._key));
      const certificados = [...new Set(seleccionadas.map(d => d.certificado).filter(Boolean))];
      toast.error(
        'Certificados diferentes',
        `Has seleccionado muestras de ${certificados.length} certificados distintos: ${certificados.join(', ')}. Selecciona muestras del mismo certificado o sin certificado.`
      );
      return;
    }

    setParaEsOtro(false);
    setMostrarGestionDestinatarios(false);
    setParaModal({ show: true, para: '', pendingAction: 'generar' });
  };

  // Vista previa del certificado (PDF real, sin guardar número ni descargar)
  const handlePreviewCertificado = async () => {
    if (selectedHistorialIds.length === 0) {
      toast.warning('Atención', 'Selecciona al menos una muestra para previsualizar el certificado');
      return;
    }

    const certificadoActual = getCertificadoSeleccionado();
    if (certificadoActual === 'CONFLICTO') {
      const seleccionadas = dumpadas.filter(d => selectedHistorialIds.includes(d._key));
      const certificados = [...new Set(seleccionadas.map(d => d.certificado).filter(Boolean))];
      toast.error(
        'Certificados diferentes',
        `Has seleccionado muestras de ${certificados.length} certificados distintos: ${certificados.join(', ')}. Selecciona muestras del mismo certificado o sin certificado.`
      );
      return;
    }

    const dumpadaIds      = selectedHistorialIds.filter(k => k.startsWith('d_')).map(k => parseInt(k.slice(2)));
    const muestraLibreIds = selectedHistorialIds.filter(k => k.startsWith('ml_')).map(k => parseInt(k.slice(3)));
    const numeroCertificado = certificadoActual && certificadoActual !== 'SIN_CERTIFICADO' ? certificadoActual : null;

    setPrevisualizando(true);
    try {
      const response = await laboratorioService.previsualizarCertificadoPdf(dumpadaIds, numeroCertificado, muestraLibreIds);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Se revoca después de un rato para darle tiempo a la pestaña nueva a cargar el PDF
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error previsualizando certificado:', error);
      const mensaje = await extraerMensajeError(error, 'No se pudo generar la vista previa');
      toast.error('Error al previsualizar', mensaje);
    } finally {
      setPrevisualizando(false);
    }
  };

  const ejecutarGenerarCertificado = async (para) => {
    const dumpadaIds      = selectedHistorialIds.filter(k => k.startsWith('d_')).map(k => parseInt(k.slice(2)));
    const muestraLibreIds = selectedHistorialIds.filter(k => k.startsWith('ml_')).map(k => parseInt(k.slice(3)));

    setGenerandoPdf(true);

    try {
      const data = await laboratorioService.generarCertificadoPdf(dumpadaIds, null, muestraLibreIds, para);

      toast.success(
        'Certificado generado',
        `Certificado ${data.numero_certificado} listo — revísalo en la pestaña Certificados.`
      );

      setSelectedHistorialIds([]);
      loadData(); // Recargar para mostrar el nuevo número de certificado
    } catch (error) {
      console.error('Error generando certificado:', error);

      // Mensaje de error mejorado
      let mensajeError = 'No se pudo generar el PDF';
      const errorData = error.response?.data;

      if (errorData?.message) {
        mensajeError = errorData.message;
      } else if (error.response?.status === 400) {
        mensajeError = 'Hay un conflicto con los certificados seleccionados. Revisa que todas las dumpadas sean compatibles.';
      }

      toast.error('Error al generar certificado', mensajeError);
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Confirmar modal "Para"
  const handleParaConfirm = () => {
    const para = paraModal.para.trim() || null;
    const action = paraModal.pendingAction;
    setParaModal(prev => ({ ...prev, show: false }));

    if (action === 'generar') {
      ejecutarGenerarCertificado(para);
    }
  };

  // Gestión de la lista de destinatarios frecuentes ("Para")
  const handleAgregarDestinatario = async () => {
    const valor = nuevoDestinatario.trim();
    if (!valor || destinatariosFrecuentes.includes(valor)) return;

    const nuevaLista = [...destinatariosFrecuentes, valor];
    setGuardandoDestinatarios(true);
    try {
      await configuracionService.update('certificado_destinatarios_frecuentes', JSON.stringify(nuevaLista));
      setDestinatariosFrecuentes(nuevaLista);
      setNuevoDestinatario('');
    } catch (error) {
      toast.error('Error al guardar', error.response?.data?.message || error.message);
    } finally {
      setGuardandoDestinatarios(false);
    }
  };

  const handleIniciarRenombrar = (valor) => {
    setEditandoDestinatario(valor);
    setValorEditado(valor);
  };

  const handleGuardarRenombrar = async () => {
    const valorNuevo = valorEditado.trim();
    if (!valorNuevo || valorNuevo === editandoDestinatario) {
      setEditandoDestinatario(null);
      return;
    }
    if (destinatariosFrecuentes.includes(valorNuevo)) {
      toast.error('Ya existe', 'Ese destinatario ya está en la lista');
      return;
    }

    const nuevaLista = destinatariosFrecuentes.map(d => d === editandoDestinatario ? valorNuevo : d);
    setGuardandoDestinatarios(true);
    try {
      await configuracionService.update('certificado_destinatarios_frecuentes', JSON.stringify(nuevaLista));
      setDestinatariosFrecuentes(nuevaLista);
      setEditandoDestinatario(null);
    } catch (error) {
      toast.error('Error al guardar', error.response?.data?.message || error.message);
    } finally {
      setGuardandoDestinatarios(false);
    }
  };

  const handleEliminarDestinatario = async (valor) => {
    const nuevaLista = destinatariosFrecuentes.filter(d => d !== valor);
    setGuardandoDestinatarios(true);
    try {
      await configuracionService.update('certificado_destinatarios_frecuentes', JSON.stringify(nuevaLista));
      setDestinatariosFrecuentes(nuevaLista);
    } catch (error) {
      toast.error('Error al guardar', error.response?.data?.message || error.message);
    } finally {
      setGuardandoDestinatarios(false);
    }
  };

  // Editar análisis (solo disponible mientras la dumpada no tiene certificado generado)
  const handleEditClick = (dumpada, e) => {
    e?.stopPropagation();
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
    setSavingEdit(true);
    try {
      const payload = {
        ley: parseFloat(editForm.ley),
        cu_soluble: parseFloat(editForm.cu_soluble),
        cu_insoluble: editForm.cu_insoluble ? parseFloat(editForm.cu_insoluble) : undefined,
      };

      if (editModal.dumpada.tipo === 'muestra_libre') {
        await laboratorioService.editarMuestraLibre(editModal.dumpada.id, payload);
      } else {
        await laboratorioService.editarAnalisis(editModal.dumpada.id, payload);
      }

      toast.success('Actualizado', 'El análisis fue editado correctamente');
      loadData();

      // Edición en secuencia: si hay más ítems en la cola, avanzar al siguiente
      if (colaEdicion.length > 0) {
        const [siguiente, ...resto] = colaEdicion;
        setColaEdicion(resto);
        setProgresoEdicion(prev => ({ ...prev, actual: prev.actual + 1 }));
        handleEditClick(siguiente);
      } else {
        setEditModal({ show: false, dumpada: null });
        setProgresoEdicion({ actual: 0, total: 0 });
      }
    } catch (error) {
      toast.error('Error al guardar', error.response?.data?.message || error.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Detener la edición en lote a mitad de camino (no guarda el ítem que estaba abierto)
  const handleDetenerEdicionLote = () => {
    setColaEdicion([]);
    setProgresoEdicion({ actual: 0, total: 0 });
    setEditModal({ show: false, dumpada: null });
  };

  // Selección para edición en secuencia (Historial)
  const handleSelectOneEdit = (key) => {
    setSelectedEditIds(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSelectAllEdit = (items) => {
    const allKeys = items.filter(d => !d.certificado).map(d => d._key);
    const allSelected = allKeys.length > 0 && allKeys.every(k => selectedEditIds.includes(k));
    setSelectedEditIds(allSelected ? [] : allKeys);
  };

  const iniciarEdicionSecuencial = () => {
    const items = dumpadas.filter(d => selectedEditIds.includes(d._key));
    if (items.length === 0) {
      toast.warning('Atención', 'Selecciona al menos una muestra para editar');
      return;
    }
    setColaEdicion(items.slice(1));
    setProgresoEdicion({ actual: 1, total: items.length });
    setSelectedEditIds([]);
    setModoSeleccionEdicion(false);
    handleEditClick(items[0]);
  };

  // Revertir análisis a Pendiente
  const handleRevertirClick = (dumpada, e) => {
    e?.stopPropagation();
    setRevertModal({ show: true, dumpada });
  };

  const handleRevertirConfirm = async () => {
    if (!revertModal.dumpada) return;
    setRevirtiendo(true);
    try {
      if (revertModal.dumpada.tipo === 'muestra_libre') {
        await laboratorioService.revertirMuestraLibre(revertModal.dumpada.id);
      } else {
        await laboratorioService.revertirAnalisis(revertModal.dumpada.id);
      }
      toast.success('Revertido', 'El análisis volvió a Pendiente');
      setRevertModal({ show: false, dumpada: null });
      loadData();
      loadEstadisticas();
    } catch (error) {
      toast.error('Error al revertir', error.response?.data?.message || error.message);
    } finally {
      setRevirtiendo(false);
    }
  };

  // Regenerar certificado existente (descarga directa)
  const handleRegenerarCertificado = (numeroCertificado, e) => {
    e?.stopPropagation();

    if (!numeroCertificado) {
      toast.warning('Sin certificado', 'Esta dumpada aún no tiene un certificado generado');
      return;
    }

    ejecutarRegenerarCertificado(numeroCertificado, null);
  };

  const ejecutarRegenerarCertificado = async (numeroCertificado, para) => {
    setRegenerandoCertificado(numeroCertificado);

    try {
      const response = await laboratorioService.regenerarCertificado(numeroCertificado, para);

      // Crear blob y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificado_${numeroCertificado}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('PDF descargado', `Certificado ${numeroCertificado} descargado correctamente`);
    } catch (error) {
      console.error('Error regenerando certificado:', error);
      const mensaje = await extraerMensajeError(error, `No se pudo descargar el certificado ${numeroCertificado}`);
      toast.error('Error al descargar', mensaje);
    } finally {
      setRegenerandoCertificado(null);
    }
  };

  // Completar análisis
  const handleCompletar = (dumpada) => {
    setSelectedIds([dumpada._key]);
    setSelectedDumpadas([dumpada]);
    setShowBulkCompleteModal(true);
  };

  const handleBulkComplete = () => {
    if (selectedIds.length === 0) {
      toast.warning('Atención', 'Debes seleccionar al menos una dumpada');
      return;
    }

    setShowBulkCompleteModal(true);
  };

  const handleBulkCompleteConfirm = async (completedDataMap) => {
    setShowBulkCompleteModal(false);
    setLoading(true);

    try {
      const dumpadasAnalisis = [];
      const muestrasLibresPromises = [];

      // Las claves del map son _key compuestos: "ml_3" para muestra libre, "d_7" para dumpada
      for (const [key, data] of Object.entries(completedDataMap)) {
        const isMuestraLibre = key.startsWith('ml_');
        const realId = parseInt(key.replace(/^(ml_|d_)/, ''));

        if (isMuestraLibre) {
          muestrasLibresPromises.push(
            laboratorioService.completarMuestraLibre(realId, {
              ley: data.ley,
              cu_soluble: data.cu_soluble,
              cu_insoluble: data.cu_insoluble,
            })
          );
        } else {
          dumpadasAnalisis.push({
            id: realId,
            ley: data.ley,
            cu_soluble: data.cu_soluble,
            cu_insoluble: data.cu_insoluble,
            certificado: data.certificado,
          });
        }
      }

      const promises = [];
      if (dumpadasAnalisis.length > 0) {
        promises.push(laboratorioService.completarMultiplesAnalisis(dumpadasAnalisis));
      }
      if (muestrasLibresPromises.length > 0) {
        promises.push(...muestrasLibresPromises);
      }

      await Promise.all(promises);

      const total = Object.keys(completedDataMap).length;
      toast.success(
        `${total} análisis completado${total !== 1 ? 's' : ''}`,
        'Los valores de Cu han sido registrados correctamente'
      );

      clearSelection();
      await loadData();
      await loadEstadisticas();
    } catch (error) {
      console.error('Error completando análisis:', error);
      toast.error('Error al completar', error.response?.data?.message || 'No se pudieron completar los análisis');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCompleteCancel = () => {
    setShowBulkCompleteModal(false);
  };

  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  const getEstadoColor = (estado) => {
    const colors = {
      'Recibido': 'bg-blue-500',
      'Ingresado': 'bg-yellow-500',
      'En Análisis': 'bg-orange-500',
      'Completado': 'bg-green-600'
    };
    return colors[estado] || 'bg-gray-500';
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

  // Filtros (diferentes para cada vista)
  const getFiltersConfig = () => {
    const baseFilters = [
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
        type: 'multiselect',
        placeholder: 'Todos los frentes',
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
    ];

    // Filtros adicionales solo para historial
    if (vistaActual === 'historial') {
      return [
        ...baseFilters,
        {
          name: 'estado_certificado',
          label: 'Estado Certificado',
          type: 'select',
          options: [
            { value: 'sin', label: 'Sin certificado' },
            { value: 'con', label: 'Con certificado' }
          ]
        },
        {
          name: 'certificado',
          label: 'N° Certificado',
          type: 'text',
          placeholder: 'Ej: 289002'
        }
      ];
    }

    return baseFilters;
  };

  if (loading && dumpadas.length === 0 && frentes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos del laboratorio...</p>
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
                label: 'Portal M3H',
                href: import.meta.env.VITE_CENTRAL_URL,
                onClick: (e) => {
                  e.preventDefault();
                  handleGoBack();
                },
                icon: HiHome
              },
              {
                label: 'Laboratorio - Análisis de Muestras'
              }
            ]}
          />
        </div>

        {/* Modal de Completar Análisis (Wizard) */}
        <BulkCompleteModal
          show={showBulkCompleteModal}
          dumpadas={selectedDumpadas.map(d => ({ ...d, id: d._key }))}
          onConfirm={handleBulkCompleteConfirm}
          onCancel={handleBulkCompleteCancel}
        />

        {/* Modal "Para" — editar destinatario del certificado */}
        {paraModal.show && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-4 rounded-t-2xl">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <HiDocumentText className="w-5 h-5" />
                  Destinatario del certificado
                </h3>
                <p className="text-green-100 text-xs mt-0.5">Puedes modificar el campo "Para" antes de generar el PDF</p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Para: <span className="text-red-500">*</span>
                </label>

                {!paraEsOtro ? (
                  <select
                    value={paraModal.para}
                    onChange={e => {
                      if (e.target.value === '__otro__') {
                        setParaEsOtro(true);
                        setParaModal(prev => ({ ...prev, para: '' }));
                      } else {
                        setParaModal(prev => ({ ...prev, para: e.target.value }));
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                    autoFocus
                  >
                    <option value="">Seleccionar destinatario...</option>
                    {destinatariosFrecuentes.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="__otro__">Otro (escribir manualmente)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={paraModal.para}
                    onChange={e => setParaModal(prev => ({ ...prev, para: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleParaConfirm()}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    placeholder="Ej: Mra 3H Copper Spa"
                    autoFocus
                  />
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-gray-500">Este valor aparecerá en el PDF como "Para:"</p>
                  {paraEsOtro && (
                    <button
                      type="button"
                      onClick={() => { setParaEsOtro(false); setParaModal(prev => ({ ...prev, para: '' })); }}
                      className="text-xs text-green-700 underline font-medium whitespace-nowrap ml-2"
                    >
                      Elegir de la lista
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarGestionDestinatarios(prev => !prev)}
                  className="text-xs text-gray-500 underline mt-3"
                >
                  {mostrarGestionDestinatarios ? 'Ocultar' : 'Gestionar'} lista de destinatarios
                </button>

                {mostrarGestionDestinatarios && (
                  <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {destinatariosFrecuentes.length === 0 && (
                      <p className="text-xs text-gray-400 italic mb-2">Sin destinatarios guardados</p>
                    )}
                    <ul className="space-y-1 mb-2">
                      {destinatariosFrecuentes.map(d => (
                        <li key={d} className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1.5 text-xs">
                          <span className="text-gray-800">{d}</span>
                          <button
                            type="button"
                            onClick={() => handleEliminarDestinatario(d)}
                            disabled={guardandoDestinatarios}
                            className="text-red-500 hover:text-red-700"
                            title="Eliminar de la lista"
                          >
                            <HiXMark className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nuevoDestinatario}
                        onChange={e => setNuevoDestinatario(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAgregarDestinatario()}
                        placeholder="Nuevo destinatario..."
                        className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={handleAgregarDestinatario}
                        disabled={guardandoDestinatarios || !nuevoDestinatario.trim()}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 pb-5 flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setParaModal(prev => ({ ...prev, show: false }))}>
                  Cancelar
                </Button>
                <Button variant="success" icon={HiDocumentText} onClick={handleParaConfirm}>
                  Generar PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal independiente: gestionar destinatarios frecuentes ("Para") */}
        {destinatariosModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <HiDocumentText className="w-5 h-5" />
                  Destinatarios frecuentes
                </h3>
                <button
                  onClick={() => { setDestinatariosModalOpen(false); setEditandoDestinatario(null); }}
                  className="text-white/80 hover:text-white"
                >
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-xs text-gray-500 mb-3">
                  Esta lista aparece como opciones del campo "Para" al generar un certificado. Los cambios se guardan de inmediato.
                </p>
                {destinatariosFrecuentes.length === 0 && (
                  <p className="text-sm text-gray-400 italic mb-2">Sin destinatarios guardados todavía.</p>
                )}
                <ul className="space-y-1.5 mb-3">
                  {destinatariosFrecuentes.map(d => (
                    <li key={d} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {editandoDestinatario === d ? (
                        <>
                          <input
                            type="text"
                            value={valorEditado}
                            onChange={e => setValorEditado(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleGuardarRenombrar()}
                            className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm mr-2"
                            autoFocus
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={handleGuardarRenombrar}
                              disabled={guardandoDestinatarios || !valorEditado.trim()}
                              className="text-green-600 hover:text-green-800"
                              title="Guardar"
                            >
                              <HiCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditandoDestinatario(null)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Cancelar"
                            >
                              <HiXMark className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-800">{d}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleIniciarRenombrar(d)}
                              disabled={guardandoDestinatarios}
                              className="text-blue-500 hover:text-blue-700"
                              title="Renombrar"
                            >
                              <HiPencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEliminarDestinatario(d)}
                              disabled={guardandoDestinatarios}
                              className="text-red-500 hover:text-red-700"
                              title="Eliminar de la lista"
                            >
                              <HiXMark className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevoDestinatario}
                    onChange={e => setNuevoDestinatario(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAgregarDestinatario()}
                    placeholder="Nuevo destinatario..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAgregarDestinatario}
                    disabled={guardandoDestinatarios || !nuevoDestinatario.trim()}
                  >
                    + Agregar
                  </Button>
                </div>
              </div>
              <div className="px-6 pb-5 flex justify-end">
                <Button variant="secondary" onClick={() => { setDestinatariosModalOpen(false); setEditandoDestinatario(null); }}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header con estadísticas */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <HiBeaker className="w-8 h-8 text-orange-600" />
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                    Laboratorio - Análisis de Muestras
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {loading
                      ? 'Cargando...'
                      : vistaActual === 'pendientes'
                        ? `${totalRecords} muestra${totalRecords !== 1 ? 's' : ''} pendiente${totalRecords !== 1 ? 's' : ''} de análisis`
                        : `${totalRecords} análisis completado${totalRecords !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { loadData(); loadEstadisticas(); }}
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

          {/* Estadísticas */}
          {estadisticas && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
                <div className="text-sm font-semibold text-blue-800 mb-1">Recibidas</div>
                <div className="text-3xl font-bold text-blue-900">{estadisticas.recibidas || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border-2 border-yellow-200">
                <div className="text-sm font-semibold text-yellow-800 mb-1">Pendientes</div>
                <div className="text-3xl font-bold text-yellow-900">{estadisticas.pendientes}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-200">
                <div className="text-sm font-semibold text-green-800 mb-1">Completadas</div>
                <div className="text-3xl font-bold text-green-900">{estadisticas.completadas}</div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border-2 border-gray-200">
                <div className="text-sm font-semibold text-gray-800 mb-1">Total</div>
                <div className="text-3xl font-bold text-gray-900">{estadisticas.total}</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-200">
                <div className="text-sm font-semibold text-orange-800 mb-1">% Completado</div>
                <div className="text-3xl font-bold text-orange-900">{estadisticas.porcentaje_completado}%</div>
              </div>
            </div>
          )}

          {/* Pestañas de navegación */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="flex gap-4" aria-label="Tabs">
              <button
                onClick={() => handleCambiarVista('pendientes')}
                disabled={loading}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  vistaActual === 'pendientes'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${loading ? 'cursor-wait' : ''}`}
              >
                {loading && vistaActual === 'pendientes' && (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-orange-200 border-t-orange-600"></div>
                )}
                <HiBeaker className="w-4 h-4" />
                Pendientes
                {estadisticas && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    vistaActual === 'pendientes' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {estadisticas.pendientes}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleCambiarVista('historial')}
                disabled={loading}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  vistaActual === 'historial'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${loading ? 'cursor-wait' : ''}`}
              >
                {loading && vistaActual === 'historial' && (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-green-200 border-t-green-600"></div>
                )}
                <HiDocumentText className="w-4 h-4" />
                Historial
                {estadisticas && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    vistaActual === 'historial' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {estadisticas.completadas}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleCambiarVista('certificados')}
                disabled={loading}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  vistaActual === 'certificados'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${loading ? 'cursor-wait' : ''}`}
              >
                <HiDocumentArrowDown className="w-4 h-4" />
                Certificados
              </button>
              {puedeVerLotes && (
              <button
                onClick={() => handleCambiarVista('lotes')}
                disabled={loading}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  vistaActual === 'lotes'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${loading ? 'cursor-wait' : ''}`}
              >
                <HiCube className="w-4 h-4" />
                Lotes
              </button>
              )}
            </nav>
          </div>
        </div>

        {/* Panel ¿Cómo funciona? */}
        {showInfo && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="mb-4 pb-4 border-b border-blue-100">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2.5">Flujo del dato</p>
              <div className="flex items-start">
                {[
                  { n: 1, label: 'Ingreso', color: 'bg-orange-500', active: false },
                  { n: 2, label: 'Envío\nMuestras', color: 'bg-teal-500', active: false },
                  { n: 3, label: 'Lab', color: 'bg-green-600', active: true },
                  { n: 4, label: 'Mezclas', color: 'bg-purple-600', active: false },
                  { n: 5, label: 'Despacho', color: 'bg-indigo-600', active: false },
                ].flatMap((p, i, arr) => [
                  <div key={`s${i}`} className={`flex flex-col items-center ${!p.active ? 'opacity-35' : ''}`} style={{ minWidth: '44px' }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.active ? p.color : 'bg-gray-300'}`}>{p.n}</div>
                    <span className={`mt-1 text-[9px] font-semibold text-center leading-tight whitespace-pre-line ${p.active ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
                  </div>,
                  ...(i < arr.length - 1 ? [<div key={`l${i}`} className="flex-1 h-px bg-gray-200 mt-3.5 mx-0.5 min-w-[8px]" />] : [])
                ])}
              </div>
            </div>

            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2.5">¿Cómo funciona el Análisis?</p>
            <div className="space-y-2">
              <div className="bg-white border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-orange-700">Qué aparece acá</p>
                <p className="text-xs text-gray-500 mt-0.5">En "Pendientes": muestras ya recibidas en el laboratorio (desde Muestreo) más muestras libres, todas esperando resultado. En "Historial": análisis ya completados.</p>
              </div>
              <div className="bg-white border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-orange-700">Qué ingresas tú</p>
                <p className="text-xs text-gray-500 mt-0.5">Solo <strong>Cu Total</strong> y <strong>Cu Soluble</strong>. El sistema calcula automáticamente el Cu Insoluble — no se ingresa a mano.</p>
              </div>
              <div className="bg-white border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-orange-700">Siguiente paso</p>
                <p className="text-xs text-gray-500 mt-0.5">Al completar el análisis la dumpada queda habilitada para Mezclas, y disponible en Historial para generar su certificado en PDF.</p>
              </div>
            </div>
          </div>
        )}

        {/* Listado */}
        {vistaActual === 'certificados' ? (
          <CertificadosGenerados idFaena={filters.id_faena} />
        ) : vistaActual === 'lotes' && puedeVerLotes ? (
          <LotesLaboratorio />
        ) : (
        <Card className={`border-l-4 ${vistaActual === 'pendientes' ? 'border-orange-400' : 'border-green-400'}`}>
          <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {vistaActual === 'pendientes' ? 'Muestras Pendientes de Análisis' : 'Historial de Análisis'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {loading ? (
                  'Cargando...'
                ) : (
                  <>Total: <span className={`font-semibold ${vistaActual === 'pendientes' ? 'text-orange-600' : 'text-green-600'}`}>{totalRecords}</span> {vistaActual === 'pendientes' ? 'muestra' : 'registro'}{totalRecords !== 1 ? 's' : ''}</>
                )}
              </p>
            </div>
            {vistaActual === 'historial' && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={HiDocumentText}
                  onClick={() => setDestinatariosModalOpen(true)}
                >
                  Gestionar destinatarios
                </Button>
                <Button
                  variant={modoSeleccionEdicion ? 'primary' : 'secondary'}
                  size="sm"
                  icon={HiPencil}
                  onClick={() => {
                    setModoSeleccionEdicion(prev => !prev);
                    setSelectedEditIds([]);
                  }}
                >
                  {modoSeleccionEdicion ? 'Cancelar selección' : 'Editar varias'}
                </Button>
              </div>
            )}
          </div>

          {/* Componente de Filtros - Siempre visible */}
          <TableFilters
            searchValue={searchTerm}
            searchPlaceholder={vistaActual === 'pendientes'
              ? "Buscar por código, certificado, frente..."
              : "Buscar por certificado, frente, código..."
            }
            onSearchChange={handleSearchChange}
            filters={getFiltersConfig()}
            filterValues={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
            alwaysExpanded={true}
          />

          {loading ? (
            <div className="text-center py-16">
              <div className={`animate-spin rounded-full h-14 w-14 border-4 ${vistaActual === 'pendientes' ? 'border-orange-200 border-t-orange-600' : 'border-green-200 border-t-green-600'} mx-auto mb-4`}></div>
              <p className={`font-semibold ${vistaActual === 'pendientes' ? 'text-orange-700' : 'text-green-700'}`}>
                {vistaActual === 'pendientes' ? 'Cargando muestras pendientes...' : 'Cargando historial...'}
              </p>
              <p className="text-gray-500 text-sm mt-1">Esto puede tomar un momento</p>
            </div>
          ) : dumpadas.length === 0 ? (
            <div className="text-center py-12">
              {vistaActual === 'pendientes' ? (
                <>
                  <HiCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-700 font-medium mb-2">¡No hay muestras pendientes!</p>
                  <p className="text-gray-600 text-sm">
                    {filters.id_faena
                      ? 'No hay muestras pendientes para la faena seleccionada'
                      : 'Todas las muestras han sido analizadas o no hay registros con los filtros aplicados'}
                  </p>
                </>
              ) : (
                <>
                  <HiDocumentText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 font-medium mb-2">No hay registros en el historial</p>
                  <p className="text-gray-600 text-sm">
                    {filters.id_faena
                      ? 'No hay análisis completados para la faena seleccionada'
                      : 'No hay análisis completados con los filtros aplicados'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Barra de acciones múltiples - Solo en vista pendientes */}
              {vistaActual === 'pendientes' && selectedIds.length > 0 && (
                <div className="mb-4 bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <HiCheckCircle className="w-5 h-5 text-orange-600" />
                      <span className="font-semibold text-orange-900">
                        {selectedIds.length} muestra{selectedIds.length !== 1 ? 's' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={handleBulkComplete}
                        disabled={loading}
                      >
                        Completar Análisis
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
                {vistaActual === 'pendientes' ? (
                  // Tabla de Pendientes
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100">
                        <th className="text-center py-3 px-2 font-bold text-orange-900 text-xs w-10">
                          <input
                            type="checkbox"
                            onChange={() => handleSelectAll(dumpadas)}
                            checked={dumpadas.length > 0 && dumpadas.every(d => selectedIds.includes(d._key))}
                            className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                          />
                        </th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Tipo</th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Frente</th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Fecha</th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Jornada</th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Código</th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Estado</th>
                        <th className="text-left py-3 px-2 font-bold text-orange-900 text-xs">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dumpadas.map((dumpada, index) => {
                        const backgroundColor = index % 2 === 0 ? '#ffffff' : '#fff7ed';
                        const esMuestraLibre = dumpada.tipo === 'muestra_libre';

                        return (
                          <tr
                            key={dumpada._key}
                            style={{ backgroundColor }}
                            className={`border-b border-gray-200 hover:bg-orange-50 transition-all cursor-pointer ${selectedIds.includes(dumpada._key) ? 'ring-2 ring-orange-400 bg-orange-50' : ''}`}
                            onClick={() => handleSelectOne(dumpada._key)}
                          >
                            <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(dumpada._key)}
                                onChange={() => handleSelectOne(dumpada._key)}
                                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              />
                            </td>
                            <td className="py-3 px-2">
                              {esMuestraLibre ? (
                                <span className="bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                  Muestra Específica
                                </span>
                              ) : (
                                <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                  Muestra Dumpada
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              <span className={`text-xs ${dumpada.frente_trabajo?.codigo_completo ? 'font-semibold text-gray-800' : 'text-gray-400 italic'}`}>
                                {dumpada.frente_trabajo?.codigo_completo || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-xs text-gray-800 whitespace-nowrap">
                              {formatearFecha(dumpada.fecha)}
                            </td>
                            <td className="py-3 px-2">
                              {esMuestraLibre ? (
                                <span className="text-xs text-gray-400 italic">—</span>
                              ) : (
                                <span className="text-xs font-semibold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  {dumpada.jornada || '—'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              {esMuestraLibre ? (
                                <span className="font-bold text-purple-900 bg-purple-100 px-3 py-1.5 rounded-lg text-xs font-mono">
                                  {dumpada.codigo || `ME-${String(dumpada.id).padStart(5, '0')}`}{dumpada.nombre ? `-${dumpada.nombre}` : ''}
                                </span>
                              ) : (
                                <span className="font-bold text-orange-900 bg-orange-100 px-3 py-1.5 rounded-lg text-xs font-mono">
                                  {dumpada.acopios || dumpada.numero_dumpada || dumpada.id}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              <span className={`${getEstadoColor(dumpada.estado)} text-white px-2 py-1 rounded-full text-xs font-bold`}>
                                {dumpada.estado}
                              </span>
                            </td>
                            <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleCompletar(dumpada)}
                              >
                                Analizar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <>
                    {/* Barra de acciones para edición en lote - Solo en modo selección de edición */}
                    {modoSeleccionEdicion && (
                      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-100 border-2 border-blue-300 rounded-lg p-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <span className="font-semibold text-blue-900">
                            {selectedEditIds.length} muestra{selectedEditIds.length !== 1 ? 's' : ''} seleccionada{selectedEditIds.length !== 1 ? 's' : ''} para editar en secuencia
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              icon={HiPencil}
                              onClick={iniciarEdicionSecuencial}
                              disabled={selectedEditIds.length === 0}
                            >
                              Editar seleccionadas
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => { setModoSeleccionEdicion(false); setSelectedEditIds([]); }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Barra de acciones para certificado - Solo en vista historial */}
                    {selectedHistorialIds.length > 0 && (
                      <div className="mb-4 bg-gradient-to-r from-green-50 to-emerald-100 border-2 border-green-300 rounded-lg p-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <HiDocumentArrowDown className="w-5 h-5 text-green-600" />
                              <span className="font-semibold text-green-900">
                                {selectedHistorialIds.length} muestra{selectedHistorialIds.length !== 1 ? 's' : ''} seleccionada{selectedHistorialIds.length !== 1 ? 's' : ''} para nuevo certificado
                              </span>
                            </div>
                            <div className="text-xs ml-7 text-green-700">
                              Se generará un nuevo número de certificado para estas muestras
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handlePreviewCertificado}
                              disabled={previsualizando}
                              icon={HiDocumentText}
                            >
                              {previsualizando ? 'Abriendo...' : 'Vista previa'}
                            </Button>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={handleGenerarCertificado}
                              disabled={generandoPdf}
                              icon={HiDocumentArrowDown}
                            >
                              {generandoPdf ? 'Generando...' : 'Generar Certificado PDF'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedHistorialIds([])}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tabla de Historial - Con Cu Total, Cu Soluble, Cu Insoluble */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-green-200 bg-gradient-to-r from-green-50 to-green-100">
                          <th className="text-center py-3 px-2 font-bold text-green-900 text-xs w-10">
                            {(() => {
                              const seleccionables = dumpadas.filter(d => !d.certificado);
                              const allSelected = seleccionables.length > 0 &&
                                seleccionables.every(d => selectedHistorialIds.includes(d._key));
                              return (
                                <input
                                  type="checkbox"
                                  onChange={() => handleSelectAllHistorial(dumpadas)}
                                  checked={allSelected}
                                  disabled={seleccionables.length === 0}
                                  title={seleccionables.length === 0
                                    ? 'No hay muestras seleccionables'
                                    : `Seleccionar ${seleccionables.length} muestras sin certificado`
                                  }
                                  className={`w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500 ${
                                    seleccionables.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                />
                              );
                            })()}
                          </th>
                          <th className="text-left py-3 px-2 font-bold text-green-900 text-xs">Código</th>
                          <th className="text-left py-3 px-2 font-bold text-green-900 text-xs">Fecha</th>
                          <th className="text-left py-3 px-2 font-bold text-green-900 text-xs">Cu Total</th>
                          <th className="text-left py-3 px-2 font-bold text-green-900 text-xs">Cu Sol</th>
                          <th className="text-left py-3 px-2 font-bold text-green-900 text-xs">Cu Insol</th>
                          <th className="text-left py-3 px-2 font-bold text-green-900 text-xs">Certificado</th>
                          <th className="text-center py-3 px-2 font-bold text-green-900 text-xs">
                            {modoSeleccionEdicion ? (
                              <input
                                type="checkbox"
                                onChange={() => handleSelectAllEdit(dumpadas)}
                                checked={(() => {
                                  const seleccionables = dumpadas.filter(d => !d.certificado);
                                  return seleccionables.length > 0 && seleccionables.every(d => selectedEditIds.includes(d._key));
                                })()}
                                disabled={dumpadas.every(d => d.certificado)}
                                title="Seleccionar todas para editar (excluye las que ya tienen certificado)"
                                className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                              />
                            ) : 'Editar'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dumpadas.map((dumpada, index) => {
                          const backgroundColor = index % 2 === 0 ? '#ffffff' : '#f0fdf4';
                          const esMuestraLibre = dumpada.tipo === 'muestra_libre';
                          const isSelected = selectedHistorialIds.includes(dumpada._key);
                          const tieneCertificado = !!dumpada.certificado;
                          const esSeleccionable = !tieneCertificado;

                          // Código a mostrar
                          const codigoMuestra = esMuestraLibre
                            ? (dumpada.codigo || `ME-${String(dumpada.id).padStart(5, '0')}`) + (dumpada.nombre ? `-${dumpada.nombre}` : '')
                            : (dumpada.acopios || dumpada.numero_dumpada || dumpada.id);

                          return (
                            <tr
                              key={dumpada._key}
                              style={{
                                backgroundColor: isSelected ? '#dcfce7' : (tieneCertificado ? coloresPorCertificado[index] : backgroundColor),
                              }}
                              className={`border-b border-gray-200 transition-all ${
                                esSeleccionable ? 'hover:bg-green-50 cursor-pointer' : 'cursor-default'
                              } ${isSelected ? 'ring-2 ring-green-400' : ''} ${
                                tieneCertificado ? 'border-l-4 border-l-amber-400' : ''
                              }`}
                              onClick={() => !modoSeleccionEdicion && esSeleccionable && handleSelectOneHistorial(dumpada._key)}
                              title={getTooltipMessage(dumpada) || undefined}
                            >
                              <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                {esSeleccionable ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleSelectOneHistorial(dumpada._key)}
                                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                ) : (
                                  <span className="text-amber-500" title="Ya tiene certificado - usa el botón de descarga">
                                    <HiCheckCircle className="w-4 h-4 mx-auto" />
                                  </span>
                                )}
                              </td>
                              {/* Código */}
                              <td className="py-3 px-2">
                                <span className={`font-bold font-mono px-2 py-1 rounded text-xs ${
                                  esMuestraLibre
                                    ? 'text-purple-900 bg-purple-100'
                                    : tieneCertificado ? 'text-amber-800 bg-amber-100' : 'text-green-900 bg-green-100'
                                }`}>
                                  {codigoMuestra}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-xs text-gray-800">
                                {formatearFecha(dumpada.fecha)}
                              </td>
                              <td className="py-3 px-2">
                                <span className={`font-bold text-sm ${tieneCertificado ? 'text-amber-700' : 'text-green-800'}`}>
                                  {dumpada.ley ? `${parseFloat(dumpada.ley).toFixed(2)}%` : '-'}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-sm font-semibold text-blue-700">
                                {dumpada.cu_soluble ? `${parseFloat(dumpada.cu_soluble).toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-3 px-2 text-sm font-semibold text-orange-700">
                                {dumpada.cu_insoluble ? `${parseFloat(dumpada.cu_insoluble).toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  {tieneCertificado ? (
                                    <>
                                      <span className="font-mono text-xs text-amber-800 bg-amber-100 px-2 py-1 rounded font-semibold">
                                        {dumpada.certificado}
                                      </span>
                                      {/* Descargar PDF */}
                                      <button
                                        onClick={(e) => handleRegenerarCertificado(dumpada.certificado, e)}
                                        disabled={regenerandoCertificado === dumpada.certificado}
                                        className={`p-1.5 rounded-lg transition-all ${
                                          regenerandoCertificado === dumpada.certificado
                                            ? 'bg-gray-200 cursor-wait'
                                            : 'bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-800 shadow-sm'
                                        }`}
                                        title="Descargar PDF"
                                      >
                                        {regenerandoCertificado === dumpada.certificado ? (
                                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
                                        ) : (
                                          <HiDocumentArrowDown className="w-4 h-4" />
                                        )}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                                      Pendiente
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                {modoSeleccionEdicion ? (
                                  tieneCertificado ? (
                                    <span className="text-gray-300" title="Ya tiene certificado generado, no se puede editar">
                                      <HiPencil className="w-4 h-4 mx-auto" />
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={selectedEditIds.includes(dumpada._key)}
                                      onChange={() => handleSelectOneEdit(dumpada._key)}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  )
                                ) : tieneCertificado ? (
                                  <span className="text-xs text-gray-400 italic" title="Certificado ya generado: los valores quedan bloqueados. Si hay un error, rechaza el certificado desde la pestaña Certificados para poder corregirlo.">
                                    Bloqueado
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={(e) => handleEditClick(dumpada, e)}
                                      className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                                      title="Editar análisis"
                                    >
                                      <HiPencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => handleRevertirClick(dumpada, e)}
                                      className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                                      title="Revertir a Pendiente (borra los valores ingresados)"
                                    >
                                      <HiArrowPath className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
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
        {/* Modal de Edición de Análisis */}
        {editModal.show && editModal.dumpada && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-green-600 to-green-500 text-white p-5 rounded-t-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <HiPencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      Editar Análisis
                      {progresoEdicion.total > 0 && ` (${progresoEdicion.actual} de ${progresoEdicion.total})`}
                    </h2>
                    <p className="text-green-100 text-xs">
                      {editModal.dumpada.tipo === 'muestra_libre'
                        ? `${editModal.dumpada.codigo || `ME-${String(editModal.dumpada.id).padStart(5, '0')}`} - ${editModal.dumpada.nombre || 'Muestra Específica'}`
                        : `Dumpada #${editModal.dumpada.numero_dumpada} - ${editModal.dumpada.frente_trabajo?.codigo_completo}`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDetenerEdicionLote}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  title={progresoEdicion.total > 0 ? 'Detener edición en lote' : 'Cerrar'}
                >
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {progresoEdicion.total > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800 flex items-center justify-between">
                    <span>Editando {progresoEdicion.actual} de {progresoEdicion.total} — al guardar avanza automáticamente a la siguiente.</span>
                    <button onClick={handleDetenerEdicionLote} className="font-semibold underline whitespace-nowrap ml-2">
                      Detener
                    </button>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p><strong>Fecha:</strong> {formatearFecha(editModal.dumpada.fecha)} | <strong>Jornada:</strong> {editModal.dumpada.jornada}{editModal.dumpada.numero_jornada ? `-${editModal.dumpada.numero_jornada}` : ''}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Ley - Cu Total (%) <span className="text-red-500">*</span>
                  </label>
                  <NumeroInput
                    value={editForm.ley}
                    onChange={(e) => setEditForm(prev => ({ ...prev, ley: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Ej: 1.640"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cu Soluble (%) <span className="text-red-500">*</span>
                  </label>
                  <NumeroInput
                    value={editForm.cu_soluble}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cu_soluble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Ej: 0.800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cu Insoluble (%) <span className="text-gray-400 text-xs font-normal">opcional, se calcula auto</span>
                  </label>
                  <NumeroInput
                    value={editForm.cu_insoluble}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cu_insoluble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                    placeholder={editForm.ley && editForm.cu_soluble ? `Auto: ${(parseFloat(editForm.ley || 0) - parseFloat(editForm.cu_soluble || 0)).toFixed(3)}` : 'Se calcula automáticamente'}
                  />
                </div>
              </div>

              <div className="px-5 pb-5 flex gap-3 justify-end">
                <button
                  onClick={handleDetenerEdicionLote}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {progresoEdicion.total > 0 ? 'Detener' : 'Cancelar'}
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={savingEdit}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingEdit ? (
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

        {/* Modal confirmación "Revertir a Pendiente" */}
        {revertModal.show && revertModal.dumpada && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-4 rounded-t-2xl">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <HiArrowPath className="w-5 h-5" />
                  Revertir a Pendiente
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700">
                  ¿Revertir este análisis a Pendiente? Se perderán los valores de Ley, Cu Soluble y Cu Insoluble
                  ingresados y la muestra volverá a aparecer en la pestaña Pendientes para reingresarla de cero.
                </p>
              </div>
              <div className="px-6 pb-5 flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setRevertModal({ show: false, dumpada: null })} disabled={revirtiendo}>
                  Cancelar
                </Button>
                <Button variant="danger" icon={HiArrowPath} onClick={handleRevertirConfirm} disabled={revirtiendo}>
                  {revirtiendo ? 'Revirtiendo...' : 'Sí, revertir'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
