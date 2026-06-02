import { useState, useEffect } from 'react';
import { HiHome, HiCheckCircle, HiInformationCircle, HiBeaker, HiArrowPath, HiDocumentText, HiDocumentArrowDown, HiPencil, HiXMark, HiCheck } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Button from '../../../shared/components/atoms/Button';
import Card from '../../../shared/components/atoms/Card';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import BulkCompleteModal from '../../../shared/components/molecules/BulkCompleteModal';
import Pagination from '../../../shared/components/molecules/Pagination';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import useDebounce from '../../../hooks/useDebounce';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../services/laboratorio';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import api from '../../../core/services/api';

export default function Laboratorio() {
  const toast = useToast();
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
  const [regenerandoCertificado, setRegenerandoCertificado] = useState(null); // Para tracking del botón específico

  // Modal "Para" antes de generar certificado
  const [paraModal, setParaModal] = useState({ show: false, para: '', pendingAction: null });

  // Edición de análisis
  const [editModal, setEditModal] = useState({ show: false, dumpada: null });
  const [editForm, setEditForm] = useState({ ley: '', cu_soluble: '', cu_insoluble: '' });
  const [savingEdit, setSavingEdit] = useState(false);

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
    id_frente_trabajo: '',
    estado_certificado: '', // 'con', 'sin', '' (todos)
    certificado: '', // búsqueda por número de certificado específico
  });

  // Debounce para la búsqueda
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const jornadas = ['AM', 'PM', 'Madrugada', 'Noche'];

  useEffect(() => {
    loadData();
    loadMaestros();
    loadFaenas();
    loadEstadisticas();
  }, []);

  // Recargar cuando cambian filtros o vista
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
        id_frente_trabajo: filters.id_frente_trabajo || undefined,
        estado_certificado: filters.estado_certificado || undefined,
        certificado: filters.certificado || undefined,
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

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
      id_frente_trabajo: '',
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

    // Si todas las sin certificado están seleccionadas, deseleccionar
    const allSinCertificadoIds = sinCertificado.map(d => d.id);
    const todasSeleccionadas = allSinCertificadoIds.every(id => selectedHistorialIds.includes(id));

    if (todasSeleccionadas && selectedHistorialIds.length > 0) {
      setSelectedHistorialIds([]);
      return;
    }

    // Seleccionar todas sin certificado
    if (sinCertificado.length > 0) {
      setSelectedHistorialIds(sinCertificado.map(d => d._key));
      const conCertificado = dumpadasList.length - sinCertificado.length;
      if (conCertificado > 0) {
        toast.info(
          'Selección parcial',
          `Se seleccionaron ${sinCertificado.length} muestras sin certificado. ${conCertificado} ya tienen certificado y solo se pueden descargar.`
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

    setParaModal({ show: true, para: '', pendingAction: 'generar' });
  };

  const ejecutarGenerarCertificado = async (para) => {
    const dumpadaIds      = selectedHistorialIds.filter(k => k.startsWith('d_')).map(k => parseInt(k.slice(2)));
    const muestraLibreIds = selectedHistorialIds.filter(k => k.startsWith('ml_')).map(k => parseInt(k.slice(3)));
    const certificadoActual = getCertificadoSeleccionado();

    setGenerandoPdf(true);

    try {
      const response = await laboratorioService.generarCertificadoPdf(dumpadaIds, null, muestraLibreIds, para);

      // Crear blob y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Usar número de certificado si existe
      const nombreArchivo = certificadoActual && certificadoActual !== 'SIN_CERTIFICADO'
        ? `certificado_${certificadoActual}.pdf`
        : `certificado_${new Date().toISOString().split('T')[0]}.pdf`;

      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        'Certificado generado',
        `Se descargó el certificado con ${selectedHistorialIds.length} muestra(s)`
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
    } else if (action?.tipo === 'regenerar') {
      ejecutarRegenerarCertificado(action.numeroCertificado, para);
    }
  };

  // Editar análisis
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
      setEditModal({ show: false, dumpada: null });
      loadData();
    } catch (error) {
      toast.error('Error al guardar', error.response?.data?.message || error.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Regenerar certificado existente (descarga directa, sin modal por defecto)
  const handleRegenerarCertificado = (numeroCertificado, e, cambiarPara = false) => {
    e?.stopPropagation();

    if (!numeroCertificado) {
      toast.warning('Sin certificado', 'Esta dumpada aún no tiene un certificado generado');
      return;
    }

    if (cambiarPara) {
      setParaModal({ show: true, para: '', pendingAction: { tipo: 'regenerar', numeroCertificado } });
    } else {
      ejecutarRegenerarCertificado(numeroCertificado, null);
    }
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
      toast.error(
        'Error al descargar',
        error.response?.data?.message || `No se pudo descargar el certificado ${numeroCertificado}`
      );
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
        type: 'select',
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
          placeholder: 'Ej: 2026-00001'
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
                label: 'Dashboard Central',
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
                <input
                  type="text"
                  value={paraModal.para}
                  onChange={e => setParaModal(prev => ({ ...prev, para: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleParaConfirm()}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Ej: Mra 3H Copper Spa"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1.5">Este valor aparecerá en el PDF como "Para:"</p>
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
                    {vistaActual === 'pendientes'
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
              <Button
                variant="secondary"
                onClick={() => setShowInfo(!showInfo)}
                icon={HiInformationCircle}
              >
                {showInfo ? 'Ocultar' : 'Ayuda'}
              </Button>
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
            </nav>
          </div>
        </div>

        {/* Panel de Información */}
        {showInfo && (
          <Card className="mb-6 border-l-4 border-orange-400 bg-orange-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <HiInformationCircle className="w-7 h-7 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-orange-900 mb-4">Información del Laboratorio</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-orange-800 mb-2">Función del Laboratorio</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>Visualizar muestras enviadas por Dispatch</li>
                      <li>Registrar resultados de análisis (Ley, Ley Cup, Certificado)</li>
                      <li>El rango se calcula automáticamente según la ley</li>
                      <li>Ver historial de análisis completados</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-orange-800 mb-2">Cómo Completar Análisis</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>Selecciona una o varias muestras</li>
                      <li>Click en "Completar Análisis"</li>
                      <li>Ingresa: Ley, Ley Cup y Certificado</li>
                      <li>El estado cambia a "Completado"</li>
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-orange-800 mb-2">Estados</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">Recibido</span>
                        <span className="text-xs">Muestra recibida desde muestreo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">Ingresado</span>
                        <span className="text-xs">Muestra pendiente de análisis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">Completado</span>
                        <span className="text-xs">Análisis completado y registrado</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-orange-800 mb-2">Rangos de Ley</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">Alta</span>
                        <span className="text-xs">Ley mayor o igual a 1%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">Media</span>
                        <span className="text-xs">Ley entre 0.5% y 1%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">Baja</span>
                        <span className="text-xs">Ley entre 0.2% y 0.5%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">Esteril</span>
                        <span className="text-xs">Ley menor a 0.2%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Listado */}
        <Card className={`border-l-4 ${vistaActual === 'pendientes' ? 'border-orange-400' : 'border-green-400'}`}>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {vistaActual === 'pendientes' ? 'Muestras Pendientes de Análisis' : 'Historial de Análisis'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Total: <span className={`font-semibold ${vistaActual === 'pendientes' ? 'text-orange-600' : 'text-green-600'}`}>{totalRecords}</span> {vistaActual === 'pendientes' ? 'muestra' : 'registro'}{totalRecords !== 1 ? 's' : ''}
            </p>
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
                            className={`border-b border-gray-200 hover:bg-orange-50 transition-all ${selectedIds.includes(dumpada._key) ? 'ring-2 ring-orange-400 bg-orange-50' : ''}`}
                          >
                            <td className="py-3 px-2 text-center">
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
                                  {dumpada.codigo || `ME-${String(dumpada.id).padStart(5, '0')}`}
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
                            <td className="py-3 px-2">
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
                          <th className="text-center py-3 px-2 font-bold text-green-900 text-xs">Editar</th>
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
                            ? (dumpada.codigo || `ME-${String(dumpada.id).padStart(5, '0')}`)
                            : (dumpada.acopios || dumpada.numero_dumpada || dumpada.id);

                          return (
                            <tr
                              key={dumpada._key}
                              style={{
                                backgroundColor: isSelected ? '#dcfce7' : (tieneCertificado ? '#fefce8' : backgroundColor),
                              }}
                              className={`border-b border-gray-200 transition-all ${
                                esSeleccionable ? 'hover:bg-green-50 cursor-pointer' : 'cursor-default'
                              } ${isSelected ? 'ring-2 ring-green-400' : ''} ${
                                tieneCertificado ? 'border-l-4 border-l-amber-400' : ''
                              }`}
                              onClick={() => esSeleccionable && handleSelectOneHistorial(dumpada._key)}
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
                                      {/* Cambiar destinatario (Para) */}
                                      <button
                                        onClick={(e) => handleRegenerarCertificado(dumpada.certificado, e, true)}
                                        disabled={regenerandoCertificado === dumpada.certificado}
                                        className="p-1.5 rounded-lg transition-all bg-orange-100 hover:bg-orange-200 text-orange-700 hover:text-orange-800 shadow-sm"
                                        title='Cambiar destinatario "Para" y re-descargar'
                                      >
                                        <HiPencil className="w-4 h-4" />
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
                                <button
                                  onClick={(e) => handleEditClick(dumpada, e)}
                                  className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
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
        {/* Modal de Edición de Análisis */}
        {editModal.show && editModal.dumpada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-green-600 to-green-500 text-white p-5 rounded-t-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <HiPencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Editar Análisis</h2>
                    <p className="text-green-100 text-xs">
                      {editModal.dumpada.tipo === 'muestra_libre'
                        ? `${editModal.dumpada.codigo || `ME-${String(editModal.dumpada.id).padStart(5, '0')}`} - ${editModal.dumpada.nombre || 'Muestra Específica'}`
                        : `Dumpada #${editModal.dumpada.numero_dumpada} - ${editModal.dumpada.frente_trabajo?.codigo_completo}`
                      }
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

              <div className="p-5 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p><strong>Fecha:</strong> {formatearFecha(editModal.dumpada.fecha)} | <strong>Jornada:</strong> {editModal.dumpada.jornada}{editModal.dumpada.numero_jornada ? `-${editModal.dumpada.numero_jornada}` : ''}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Ley - Cu Total (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editForm.ley}
                    onChange={(e) => setEditForm(prev => ({ ...prev, ley: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ej: 1.640"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cu Soluble (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editForm.cu_soluble}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cu_soluble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ej: 0.800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cu Insoluble (%) <span className="text-gray-400 text-xs font-normal">opcional, se calcula auto</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editForm.cu_insoluble}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cu_insoluble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={editForm.ley && editForm.cu_soluble ? `Auto: ${(parseFloat(editForm.ley || 0) - parseFloat(editForm.cu_soluble || 0)).toFixed(3)}` : 'Se calcula automáticamente'}
                  />
                </div>
              </div>

              <div className="px-5 pb-5 flex gap-3 justify-end">
                <button
                  onClick={() => setEditModal({ show: false, dumpada: null })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
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
      </main>
    </div>
  );
}
