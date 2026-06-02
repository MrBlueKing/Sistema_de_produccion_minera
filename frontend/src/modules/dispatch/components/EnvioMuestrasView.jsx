import { useState, useEffect } from 'react';
import { HiCheckCircle, HiXCircle, HiTrash, HiBeaker, HiInformationCircle, HiArrowUpTray, HiArrowDownTray, HiArrowPath } from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import TableFilters from '../../../shared/components/molecules/TableFilters';
import Pagination from '../../../shared/components/molecules/Pagination';
import RangoTooltip from '../../../shared/components/molecules/RangoTooltip';
import useToast from '../../../hooks/useToast';
import useDebounce from '../../../hooks/useDebounce';
import dispatchService from '../services/dispatch';

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  if (typeof fecha === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fecha)) return fecha;
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return '-';
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${date.getFullYear()}`;
};

const getEstadoColor = (estado) => {
  const colors = { 'Ingresado': 'bg-yellow-500', 'En Análisis': 'bg-blue-500', 'Completado': 'bg-green-600' };
  return colors[estado] || 'bg-gray-500';
};

const getRangoColor = (rango) => {
  const colors = {
    'L': 'bg-purple-600', 'K': 'bg-indigo-600', 'J': 'bg-blue-600', 'I': 'bg-cyan-600',
    'H': 'bg-teal-600', 'G': 'bg-green-600', 'F': 'bg-lime-600', 'E': 'bg-yellow-600',
    'D': 'bg-orange-600', 'C': 'bg-red-600', 'B': 'bg-pink-600', 'A': 'bg-rose-600',
    'Reserva': 'bg-gray-600', 'Descarte': 'bg-slate-800',
  };
  return colors[rango] || 'bg-gray-600';
};

const getBackgroundColorByGroup = (dumpadas, currentIndex) => {
  const colors = ['#fed7aa', '#bfdbfe'];
  if (currentIndex === 0) return colors[0];
  const cur = dumpadas[currentIndex];
  const prev = dumpadas[currentIndex - 1];
  const curGroup = `${cur.id_frente_trabajo || ''}_${cur.jornada || ''}_${cur.fecha || ''}`;
  const prevGroup = `${prev.id_frente_trabajo || ''}_${prev.jornada || ''}_${prev.fecha || ''}`;
  if (curGroup === prevGroup) return getBackgroundColorByGroup(dumpadas, currentIndex - 1);
  const prevColor = getBackgroundColorByGroup(dumpadas, currentIndex - 1);
  return prevColor === colors[0] ? colors[1] : colors[0];
};

const PER_PAGE = 15;

export default function EnvioMuestrasView({
  frentes,
  jornadas,
  rangos,
  esUsuarioGlobal,
  selectedFaenas,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Pendientes
  const [pendientesData, setPendientesData] = useState([]);
  const [pendientesPage, setPendientesPage] = useState(1);
  const [pendientesTotalPages, setPendientesTotalPages] = useState(1);
  const [pendientesTotalRecords, setPendientesTotalRecords] = useState(0);
  const [pendientesSearchTerm, setPendientesSearchTerm] = useState('');
  const debouncedSearch = useDebounce(pendientesSearchTerm, 500);
  const [pendientesFilters, setPendientesFilters] = useState({
    jornada: '', fecha_inicio: '', fecha_fin: '', id_frente_trabajo: '',
  });

  // Selección
  const [selectedIds, setSelectedIds] = useState([]);

  // Muestras libres
  const [muestrasLibresPendientes, setMuestrasLibresPendientes] = useState([]);
  const [showMuestraLibreModal, setShowMuestraLibreModal] = useState(false);
  const [muestraLibreForm, setMuestraLibreForm] = useState({ nombre: '', solicitante: '', id_frente_trabajo: '' });
  const [savingMuestraLibre, setSavingMuestraLibre] = useState(false);

  // Modal eliminar
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, acopio: '' });

  const loadPendientes = async () => {
    setLoadingData(true);
    try {
      let idFaenaParam;
      if (esUsuarioGlobal && selectedFaenas.length > 0) {
        idFaenaParam = selectedFaenas.join(',');
      }
      const params = {
        page: pendientesPage,
        per_page: PER_PAGE,
        estado: 'Ingresado',
        search: debouncedSearch || undefined,
        jornada: pendientesFilters.jornada || undefined,
        fecha_inicio: pendientesFilters.fecha_inicio || undefined,
        fecha_fin: pendientesFilters.fecha_fin || undefined,
        id_frente_trabajo: pendientesFilters.id_frente_trabajo || undefined,
        id_faena: idFaenaParam || undefined,
      };
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const [response, muestrasRes] = await Promise.all([
        dispatchService.getDumpadas(params),
        dispatchService.getMuestrasLibres(),
      ]);

      setPendientesData(response.data || []);
      if (response.pagination) {
        setPendientesTotalPages(response.pagination.last_page);
        setPendientesTotalRecords(response.pagination.total);
      }
      setMuestrasLibresPendientes(muestrasRes.data || []);
    } catch (error) {
      console.error('❌ Error cargando pendientes:', error);
      toast.error('Error al cargar registros pendientes', error.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadPendientes();
  }, [pendientesPage, debouncedSearch, pendientesFilters, selectedFaenas]);

  // Handlers selección
  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleSelectAll = () => {
    const allIds = pendientesData.map(d => d.id);
    setSelectedIds(selectedIds.length === allIds.length ? [] : allIds);
  };
  const clearSelection = () => setSelectedIds([]);

  // Marcar muestreo
  const handleMarcarMuestreo = async (ids, valor) => {
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const res = await dispatchService.marcarMuestreo(ids, valor);
      toast.success(
        valor === true ? 'Marcadas para Laboratorio' : 'Marca de Laboratorio quitada',
        res.message || `${ids.length} dumpada(s) actualizadas`
      );
      clearSelection();
      await loadPendientes();
    } catch (error) {
      toast.error('Error al actualizar', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar bulk
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.warning('Atención', 'Debes seleccionar al menos una dumpada');
      return;
    }
    const selectedDumpadas = pendientesData.filter(d => selectedIds.includes(d.id));
    const acopios = selectedDumpadas.map(d => d.acopios || d.n_acop).join(', ');
    setDeleteModal({ show: true, id: null, acopio: `${selectedIds.length} dumpadas: ${acopios}` });
  };

  const confirmBulkDelete = async () => {
    setDeleteModal({ show: false, id: null, acopio: '' });
    setLoading(true);
    try {
      await Promise.all(selectedIds.map(id => dispatchService.deleteDumpada(id)));
      toast.success(`${selectedIds.length} dumpada(s) eliminadas`, 'Los registros han sido eliminados correctamente');
      clearSelection();
      await loadPendientes();
    } catch (error) {
      toast.error('Error al eliminar', error.response?.data?.message || 'No se pudieron eliminar las dumpadas');
    } finally {
      setLoading(false);
    }
  };

  // Muestras libres
  const handleSubmitMuestraLibre = async (e) => {
    e.preventDefault();
    if (!muestraLibreForm.nombre.trim()) {
      toast.warning('Atención', 'El nombre de la muestra es obligatorio');
      return;
    }
    setSavingMuestraLibre(true);
    try {
      await dispatchService.createMuestraLibre({
        nombre: muestraLibreForm.nombre.trim(),
        solicitante: muestraLibreForm.solicitante.trim() || null,
        id_frente_trabajo: muestraLibreForm.id_frente_trabajo || null,
      });
      toast.success('Muestra enviada al laboratorio', muestraLibreForm.nombre);
      setShowMuestraLibreModal(false);
      setMuestraLibreForm({ nombre: '', solicitante: '', id_frente_trabajo: '' });
      await loadPendientes();
    } catch (error) {
      toast.error('Error al enviar muestra', error.response?.data?.message || error.message);
    } finally {
      setSavingMuestraLibre(false);
    }
  };

  const handleDeleteMuestraLibre = async (id) => {
    try {
      await dispatchService.deleteMuestraLibre(id);
      toast.success('Muestra eliminada');
      await loadPendientes();
    } catch (error) {
      toast.error('Error al eliminar', error.response?.data?.message || error.message);
    }
  };

  return (
    <>
      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        show={deleteModal.show}
        onConfirm={confirmBulkDelete}
        onCancel={() => setDeleteModal({ show: false, id: null, acopio: '' })}
        title="¿Eliminar Dumpadas?"
        message="Estás a punto de eliminar:"
        highlightText={deleteModal.acopio}
        warningText="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        icon={HiTrash}
      />

      {/* Modal Muestra Libre */}
      {showMuestraLibreModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Nueva Muestra</h3>
                <p className="text-sm text-gray-500 mt-0.5">Se enviará directamente al laboratorio</p>
              </div>
              <button onClick={() => setShowMuestraLibreModal(false)} className="text-gray-400 hover:text-gray-600">
                <HiXCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmitMuestraLibre} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nombre / Descripción <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={muestraLibreForm.nombre}
                  onChange={(e) => setMuestraLibreForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Muestra geología, Muestra Operaciones, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Solicitante / Área</label>
                <input
                  type="text"
                  value={muestraLibreForm.solicitante}
                  onChange={(e) => setMuestraLibreForm(prev => ({ ...prev, solicitante: e.target.value }))}
                  placeholder="Ej: Geología, Operaciones, Gerencia..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Frente de Trabajo <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                </label>
                <SearchableSelect
                  value={muestraLibreForm.id_frente_trabajo}
                  onChange={(val) => setMuestraLibreForm(prev => ({ ...prev, id_frente_trabajo: val }))}
                  options={frentes.map(f => ({ value: f.id, label: f.codigo_completo }))}
                  placeholder="Sin frente específico"
                  emptyMessage="No hay frentes disponibles"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingMuestraLibre}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingMuestraLibre ? 'Enviando...' : 'Enviar al Laboratorio'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMuestraLibreModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registros Pendientes */}
      <Card className="border-l-4 border-yellow-400">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Registros Pendientes</h3>
              <p className="text-sm text-gray-600 mt-1">
                Total: <span className="font-semibold text-yellow-600">{pendientesTotalRecords}</span> registro{pendientesTotalRecords !== 1 ? 's' : ''} en estado Ingresado
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadPendientes()}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 transition-colors shadow-sm"
                title="Actualizar lista"
              >
                <HiArrowPath className="w-4 h-4" />
                Actualizar
              </button>
              <button
                onClick={() => setShowMuestraLibreModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                <HiBeaker className="w-4 h-4" />
                + Añadir Muestra
              </button>
              <button
                onClick={() => setShowInfo(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  showInfo
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
                }`}
                title="¿Cómo funciona?"
              >
                <HiInformationCircle className="w-4 h-4" />
                <span className="hidden sm:inline">¿Cómo funciona?</span>
              </button>
            </div>
          </div>

        </div>

        {/* Barra de acciones al seleccionar */}
        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-wrap">
            <span className="text-sm font-semibold text-blue-800">
              {selectedIds.length} dumpada{selectedIds.length !== 1 ? 's' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" size="sm" onClick={() => handleMarcarMuestreo(selectedIds, true)} disabled={loading}>
                <HiArrowUpTray className="w-4 h-4 mr-1" /> Enviar a Laboratorio
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleMarcarMuestreo(selectedIds, null)} disabled={loading}>
                <HiArrowDownTray className="w-4 h-4 mr-1" /> Desmarcar
              </Button>
              <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={loading}>
                <HiTrash className="w-4 h-4 mr-1" /> Eliminar
              </Button>
              <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar selección">
                <HiXCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Panel: Cómo funciona */}
        {showInfo && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">

            {/* ── Flujo del dato ── */}
            <div className="mb-4 pb-4 border-b border-blue-100">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2.5">Flujo del dato</p>
              <div className="flex items-start">
                {[
                  { n: 1, label: 'Ingreso', color: 'bg-orange-500', active: false },
                  { n: 2, label: 'Envío\nMuestras', color: 'bg-teal-500', active: true },
                  { n: 3, label: 'Lab', color: 'bg-green-600', active: false },
                  { n: 4, label: 'Mezclas', color: 'bg-purple-600', active: false },
                  { n: 5, label: 'Despacho', color: 'bg-indigo-600', active: false },
                ].flatMap((p, i, arr) => [
                  <div key={`s${i}`} className={`flex flex-col items-center ${!p.active ? 'opacity-35' : ''}`} style={{minWidth:'44px'}}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${p.active ? p.color : 'bg-gray-300'}`}>{p.n}</div>
                    <span className={`mt-1 text-[9px] font-semibold text-center leading-tight whitespace-pre-line ${p.active ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
                  </div>,
                  ...(i < arr.length - 1 ? [<div key={`l${i}`} className="flex-1 h-px bg-gray-200 mt-3.5 mx-0.5 min-w-[8px]" />] : [])
                ])}
              </div>
            </div>

            {/* ── Específico: Envío de Muestras ── */}
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2.5">¿Cómo funciona el Envío de Muestras?</p>
            <div className="space-y-2">
              <div className="bg-white border border-teal-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-teal-700">Seleccionar y enviar</p>
                <p className="text-xs text-gray-500 mt-0.5">Marca una o varias dumpadas usando los checkbox y presiona <strong>Enviar al Laboratorio</strong>. Las dumpadas quedan marcadas como <strong className="text-blue-600">Esperando ley</strong> y aparecen en el sistema de Laboratorio para su análisis.</p>
              </div>
              <div className="bg-white border border-teal-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-teal-700">Qué ocurre en el Laboratorio</p>
                <p className="text-xs text-gray-500 mt-0.5">El analista ingresa Cu Total y Cu Soluble. El sistema calcula automáticamente Cu Insoluble y asigna el <strong>Rango de ley</strong> (A–L). La dumpada pasa a estado <strong className="text-green-600">Completado</strong> y desaparece de esta vista.</p>
              </div>
              <div className="bg-white border border-teal-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-teal-700">Muestras libres</p>
                <p className="text-xs text-gray-500 mt-0.5">Para muestras sin dumpada asociada (geología, operaciones, calidad de materiales, etc.) usa el botón <strong>+ Añadir Muestra</strong>. Se analizan de forma independiente.</p>
              </div>
              <div className="bg-white border border-teal-200 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-teal-700">Rangos de ley</p>
                <p className="text-xs text-gray-500 mt-0.5">Los rangos (A, B, C… L) que clasifican cada dumpada según su ley son configurables. Si los rangos no se ajustan a la operación actual, contactar al administrador del sistema.</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <TableFilters
          searchValue={pendientesSearchTerm}
          searchPlaceholder="Buscar por frente, código..."
          onSearchChange={(v) => { setPendientesSearchTerm(v); setPendientesPage(1); }}
          alwaysExpanded={false}
          filters={[
            { name: 'jornada', label: 'Jornada', type: 'select', options: jornadas.map(j => ({ value: j, label: j })) },
            { name: 'id_frente_trabajo', label: 'Frente de Trabajo', type: 'select', options: frentes.map(f => ({ value: f.id, label: f.codigo_completo || `ID: ${f.id}` })) },
            { name: 'fecha_inicio', label: 'Fecha Desde', type: 'date' },
            { name: 'fecha_fin', label: 'Fecha Hasta', type: 'date' },
          ]}
          filterValues={pendientesFilters}
          onFilterChange={(name, value) => { setPendientesFilters(prev => ({ ...prev, [name]: value })); setPendientesPage(1); }}
          onClear={() => { setPendientesSearchTerm(''); setPendientesFilters({ jornada: '', fecha_inicio: '', fecha_fin: '', id_frente_trabajo: '' }); setPendientesPage(1); }}
        />

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-orange-500"></div>
            <p className="text-sm text-gray-500">Cargando registros...</p>
          </div>
        ) : pendientesData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No hay registros pendientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100">
                  <th className="text-center py-2 px-2 font-bold text-yellow-900 text-xs w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedIds.length === pendientesData.length && selectedIds.length > 0}
                      className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
                    />
                  </th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Frente</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">N° Dump</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Código</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Jornada</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Fecha</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Ton</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs whitespace-nowrap">Ley Visual</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Estado</th>
                  <th className="text-left py-2 px-2 font-bold text-yellow-900 text-xs">Muestreo</th>
                </tr>
              </thead>
              <tbody>
                {[...pendientesData].sort((a, b) => b.id - a.id).map((dumpada, index, sortedArray) => {
                  const backgroundColor = getBackgroundColorByGroup(sortedArray, index);
                  return (
                    <tr
                      key={dumpada.id}
                      style={{ backgroundColor }}
                      className={`border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150 cursor-pointer ${selectedIds.includes(dumpada.id) ? 'bg-blue-100' : ''}`}
                      onClick={() => handleSelectOne(dumpada.id)}
                    >
                      <td className="py-2 px-2 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(dumpada.id)}
                          onChange={() => handleSelectOne(dumpada.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      {/* Frente */}
                      <td className="py-2 px-2">
                        <span className="font-bold text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded text-xs whitespace-nowrap">
                          {dumpada.frente_trabajo?.codigo_completo || '-'}
                        </span>
                      </td>
                      {/* N° Dumpada */}
                      <td className="py-2 px-2">
                        <span className="font-mono font-bold text-gray-700 text-xs">
                          {dumpada.numero_dumpada ? `#${String(dumpada.numero_dumpada).padStart(3, '0')}` : '—'}
                        </span>
                      </td>
                      {/* Código acopio (ya incluye frente + jornada + numero + fecha) */}
                      <td className="py-2 px-2">
                        <span className="font-mono text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded text-xs whitespace-nowrap">
                          {dumpada.acopios || dumpada.n_acop || '—'}
                        </span>
                      </td>
                      {/* Jornada */}
                      <td className="py-2 px-2">
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                          {dumpada.jornada}{dumpada.numero_jornada ? `-${dumpada.numero_jornada}` : ''}
                        </span>
                      </td>
                      {/* Fecha */}
                      <td className="py-2 px-2 text-xs text-gray-800">
                        <div className="flex flex-col">
                          <span className="font-semibold">{formatearFecha(dumpada.fecha)}</span>
                          {dumpada.created_at && (
                            <span className="text-gray-500 text-[10px]">{dumpada.created_at.split(' ')[1]?.substring(0, 5)} hrs</span>
                          )}
                        </div>
                      </td>
                      {/* Ton */}
                      <td className="py-2 px-2 text-xs text-gray-700 font-semibold">
                        {dumpada.ton ? `${parseFloat(dumpada.ton).toFixed(2)}` : '-'}
                      </td>
                      {/* Ley Visual */}
                      <td className="py-2 px-2 text-xs text-gray-700">
                        {dumpada.ley_visual ? `${parseFloat(dumpada.ley_visual).toFixed(3)}%` : '-'}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`${getEstadoColor(dumpada.estado)} text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap`}>
                          {dumpada.estado}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        {dumpada.ley != null ? (
                          <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">Con Ley</span>
                        ) : dumpada.para_muestreo ? (
                          <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">Esperando ley</span>
                        ) : (
                          <span className="bg-gray-400 text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">Sin Muestra</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pendientesData.length > 0 && pendientesTotalPages > 1 && (
          <Pagination
            currentPage={pendientesPage}
            totalPages={pendientesTotalPages}
            totalRecords={pendientesTotalRecords}
            perPage={PER_PAGE}
            onPageChange={(page) => setPendientesPage(page)}
          />
        )}

        {/* Muestras Libres Pendientes */}
        {muestrasLibresPendientes.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-bold text-gray-800">
                Muestras Libres en Laboratorio
                <span className="ml-2 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {muestrasLibresPendientes.length}
                </span>
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100">
                    <th className="text-left py-2 px-3 font-bold text-purple-900 text-xs">Nombre / Descripción</th>
                    <th className="text-left py-2 px-3 font-bold text-purple-900 text-xs">Solicitante</th>
                    <th className="text-left py-2 px-3 font-bold text-purple-900 text-xs">Frente</th>
                    <th className="text-left py-2 px-3 font-bold text-purple-900 text-xs">Fecha</th>
                    <th className="text-left py-2 px-3 font-bold text-purple-900 text-xs">Estado</th>
                    <th className="text-center py-2 px-3 font-bold text-purple-900 text-xs">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {muestrasLibresPendientes.map(m => (
                    <tr key={m.id} className="border-b border-purple-100 hover:bg-purple-50">
                      <td className="py-2 px-3"><span className="font-semibold text-purple-900 text-xs">{m.nombre}</span></td>
                      <td className="py-2 px-3 text-xs text-gray-600">{m.solicitante || '—'}</td>
                      <td className="py-2 px-3 text-xs text-gray-600">{m.frente_trabajo?.codigo_completo || '—'}</td>
                      <td className="py-2 px-3 text-xs text-gray-600">{formatearFecha(m.fecha)}</td>
                      <td className="py-2 px-3">
                        <span className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">En Lab</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDeleteMuestraLibre(m.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Eliminar muestra"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

    </>
  );
}
