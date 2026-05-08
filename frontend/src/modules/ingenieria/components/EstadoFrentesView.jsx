import { useState, useEffect, useCallback } from 'react';
import {
  HiPlus, HiPencil, HiTrash, HiCheck,
  HiCalendar, HiChartBar, HiTableCells, HiXMark,
  HiSquares2X2, HiExclamationTriangle, HiCheckCircle, HiClock, HiMinusCircle,
} from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import ConfirmModal from '../../../shared/components/molecules/ConfirmModal';
import Pagination from '../../../shared/components/molecules/Pagination';
import useToast from '../../../hooks/useToast';
import { useAuth } from '../../../core/context/AuthContext';
import ingenieriaService from '../services/ingenieria';

const ESTABILIDAD_LABELS = {
  FC: 'Frente Cerrada',
  PM: 'PM',
  AC: 'Acuñadura',
  CH: 'CH',
  FO: 'Frente Observación',
};

const ESTABILIDAD_COLORS = {
  FC: 'bg-red-100 text-red-700',
  PM: 'bg-yellow-100 text-yellow-700',
  AC: 'bg-orange-100 text-orange-700',
  CH: 'bg-purple-100 text-purple-700',
  FO: 'bg-blue-100 text-blue-700',
};

const VENTILACION_COLORS = [
  '',
  'bg-red-500',
  'bg-orange-400',
  'bg-yellow-400',
  'bg-lime-400',
  'bg-green-500',
];

function getEstadoSemaforo(s) {
  if (!s.fecha_inicio_real) return 'sin_iniciar';
  if (s.desvio <= 0)        return 'en_tiempo';
  if (s.desvio <= 5)        return 'atraso_leve';
  return 'atraso_grave';
}

const SEMAFORO = {
  sin_iniciar: {
    border: 'border-l-gray-300',
    bg:     'bg-gray-50',
    badge:  'bg-gray-100 text-gray-500',
    icon:   HiClock,
    label:  'Sin iniciar',
    dot:    'bg-gray-300',
  },
  en_tiempo: {
    border: 'border-l-green-400',
    bg:     'bg-green-50/50',
    badge:  'bg-green-100 text-green-700',
    icon:   HiCheckCircle,
    label:  'En tiempo',
    dot:    'bg-green-400',
  },
  atraso_leve: {
    border: 'border-l-amber-400',
    bg:     'bg-amber-50/50',
    badge:  'bg-amber-100 text-amber-700',
    icon:   HiExclamationTriangle,
    label:  'Atraso leve',
    dot:    'bg-amber-400',
  },
  atraso_grave: {
    border: 'border-l-red-400',
    bg:     'bg-red-50/50',
    badge:  'bg-red-100 text-red-700',
    icon:   HiExclamationTriangle,
    label:  'Atraso grave',
    dot:    'bg-red-500',
  },
};

function VentilacionBadge({ valor }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n}
          className={`inline-block w-2.5 h-2.5 rounded-full ${n <= valor ? VENTILACION_COLORS[valor] : 'bg-gray-200'}`}
        />
      ))}
      <span className="text-xs text-gray-400 ml-0.5">{valor}/5</span>
    </div>
  );
}

function DesvioChip({ desvio }) {
  if (desvio === null || desvio === undefined)
    return <span className="text-xs text-gray-400 italic">Sin inicio real</span>;
  if (desvio === 0)
    return <span className="text-xs font-medium text-gray-500">Puntual</span>;
  if (desvio > 0)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">+{desvio}d atraso</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{desvio}d adelanto</span>;
}

const fmtDate = (d) => d ? String(d).split('T')[0] : null;

const FORM_EMPTY = {
  frente_trabajo_id: '',
  ventilacion: '',
  estabilidad: '',
  duracion_estimada: '',
  fecha_inicio_estimada: '',
  observaciones: '',
};

export default function EstadoFrentesView({ frentes = [], faenaFiltro = null }) {
  const toast = useToast();
  const { getUserInfo } = useAuth();
  const userInfo = getUserInfo();

  const [seguimientos, setSeguimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 15;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, label: '' });
  const [marcarModal, setMarcarModal] = useState({ show: false, id: null, fechaActual: '' });

  // Todos los registros sin paginar (para resumen)
  const [todosLosSeguimientos, setTodosLosSeguimientos] = useState([]);
  const [loadingResumen, setLoadingResumen] = useState(true);

  // Estadísticas para gráfico
  const [estadisticas, setEstadisticas] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadSeguimientos = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (faenaFiltro) params.id_faena = faenaFiltro;
      const res = await ingenieriaService.getSeguimientos(params);
      setSeguimientos(res.data || []);
      setTotalPages(res.last_page || 1);
    } catch {
      toast.error('Error', 'No se pudieron cargar los registros');
    } finally {
      setLoading(false);
    }
  }, [faenaFiltro]);

  const loadTodos = useCallback(async () => {
    setLoadingResumen(true);
    try {
      const params = { per_page: 999 };
      if (faenaFiltro) params.id_faena = faenaFiltro;
      const res = await ingenieriaService.getSeguimientos(params);
      setTodosLosSeguimientos(res.data || []);
    } catch {
      // silencioso
    } finally {
      setLoadingResumen(false);
    }
  }, [faenaFiltro]);

  const loadEstadisticas = useCallback(async () => {
    setLoadingStats(true);
    try {
      const params = {};
      if (faenaFiltro) params.id_faena = faenaFiltro;
      const res = await ingenieriaService.getEstadisticasSeguimiento(params);
      setEstadisticas(res.data || []);
    } catch {
      toast.error('Error', 'No se pudieron cargar las estadísticas');
    } finally {
      setLoadingStats(false);
    }
  }, [faenaFiltro]);

  useEffect(() => {
    loadSeguimientos(1);
    loadTodos();
    setCurrentPage(1);
  }, [loadSeguimientos, loadTodos]);

  useEffect(() => {
    if (tab === 'grafico') loadEstadisticas();
  }, [tab, loadEstadisticas]);

  // Último registro por frente (estado actual)
  const ultimoPorFrente = Object.values(
    todosLosSeguimientos.reduce((acc, s) => {
      const key = s.frente_trabajo_id;
      if (!acc[key] || new Date(s.created_at) > new Date(acc[key].created_at)) {
        acc[key] = s;
      }
      return acc;
    }, {})
  );

  const kpis = {
    total:        ultimoPorFrente.length,
    sin_iniciar:  ultimoPorFrente.filter(s => !s.fecha_inicio_real).length,
    en_tiempo:    ultimoPorFrente.filter(s => s.fecha_inicio_real && s.desvio <= 0).length,
    atraso_leve:  ultimoPorFrente.filter(s => s.fecha_inicio_real && s.desvio > 0 && s.desvio <= 5).length,
    atraso_grave: ultimoPorFrente.filter(s => s.fecha_inicio_real && s.desvio > 5).length,
  };

  // Distribución de estabilidad (último por frente)
  const estabilidadDist = Object.entries(ESTABILIDAD_LABELS).map(([key, label]) => ({
    key,
    label,
    count: ultimoPorFrente.filter(s => s.estabilidad === key).length,
  })).filter(e => e.count > 0);

  const handlePageChange = (p) => {
    setCurrentPage(p);
    loadSeguimientos(p);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(FORM_EMPTY);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setFormData({
      frente_trabajo_id: String(s.frente_trabajo_id),
      ventilacion: String(s.ventilacion),
      estabilidad: s.estabilidad,
      duracion_estimada: String(s.duracion_estimada),
      fecha_inicio_estimada: fmtDate(s.fecha_inicio_estimada),
      observaciones: s.observaciones ?? '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!formData.frente_trabajo_id || !formData.ventilacion || !formData.estabilidad ||
        !formData.duracion_estimada || !formData.fecha_inicio_estimada) {
      toast.warning('Campos requeridos', 'Completa todos los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        frente_trabajo_id: parseInt(formData.frente_trabajo_id),
        ventilacion: parseInt(formData.ventilacion),
        estabilidad: formData.estabilidad,
        duracion_estimada: parseInt(formData.duracion_estimada),
        fecha_inicio_estimada: formData.fecha_inicio_estimada,
        observaciones: formData.observaciones || null,
        registrado_por: userInfo?.nombre || userInfo?.email || 'Ingeniero',
      };
      if (editingId) {
        await ingenieriaService.updateSeguimiento(editingId, payload);
        toast.success('Actualizado', 'Registro actualizado correctamente');
      } else {
        await ingenieriaService.createSeguimiento(payload);
        toast.success('Creado', 'Registro creado correctamente');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(FORM_EMPTY);
      loadSeguimientos(currentPage);
      loadTodos();
    } catch (err) {
      toast.error('Error', err.response?.data?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await ingenieriaService.deleteSeguimiento(deleteModal.id);
      toast.success('Eliminado', 'Registro eliminado');
      setDeleteModal({ show: false, id: null, label: '' });
      loadSeguimientos(currentPage);
      loadTodos();
    } catch {
      toast.error('Error', 'No se pudo eliminar');
    }
  };

  const handleMarcarInicio = async () => {
    if (!marcarModal.fechaActual) {
      toast.warning('Requerido', 'Ingresa la fecha de inicio real');
      return;
    }
    try {
      await ingenieriaService.marcarInicioReal(marcarModal.id, marcarModal.fechaActual);
      toast.success('Registrado', 'Inicio real marcado correctamente');
      setMarcarModal({ show: false, id: null, fechaActual: '' });
      loadSeguimientos(currentPage);
      loadTodos();
    } catch {
      toast.error('Error', 'No se pudo registrar el inicio');
    }
  };

  const frentesOptions = frentes.map(f => ({ value: String(f.id), label: f.codigo_completo || `Frente #${f.id}` }));
  const ventilacionOptions = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} / 5` }));
  const estabilidadOptions = Object.entries(ESTABILIDAD_LABELS).map(([k, v]) => ({ value: k, label: `${k} — ${v}` }));

  const maxAbs = estadisticas.length > 0 ? Math.max(...estadisticas.map(s => Math.abs(s.desvio)), 1) : 1;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Estado de Frentes</h2>
          <p className="text-sm text-gray-500">Seguimiento histórico — estimado vs real</p>
        </div>
        <Button onClick={openCreate} variant="primary" size="sm">
          <HiPlus className="w-4 h-4 mr-1" /> Nuevo registro
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="border border-blue-200 bg-blue-50/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {editingId ? 'Editar registro' : 'Nuevo registro de estado'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
              <HiXMark className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Frente de trabajo *</label>
              <SearchableSelect options={frentesOptions} value={formData.frente_trabajo_id}
                onChange={v => setFormData(p => ({ ...p, frente_trabajo_id: v }))} placeholder="Seleccionar frente..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ventilación (1–5) *</label>
              <SearchableSelect options={ventilacionOptions} value={formData.ventilacion}
                onChange={v => setFormData(p => ({ ...p, ventilacion: v }))} placeholder="Seleccionar nivel..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estabilidad *</label>
              <SearchableSelect options={estabilidadOptions} value={formData.estabilidad}
                onChange={v => setFormData(p => ({ ...p, estabilidad: v }))} placeholder="Seleccionar estado..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Duración estimada (días) *</label>
              <Input type="number" min="1" value={formData.duracion_estimada}
                onChange={e => setFormData(p => ({ ...p, duracion_estimada: e.target.value }))} placeholder="Ej: 7" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha inicio estimada *</label>
              <Input type="date" value={formData.fecha_inicio_estimada}
                onChange={e => setFormData(p => ({ ...p, fecha_inicio_estimada: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea value={formData.observaciones}
                onChange={e => setFormData(p => ({ ...p, observaciones: e.target.value }))}
                rows={2} placeholder="Notas adicionales..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} variant="primary" size="sm" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
            </Button>
            <Button onClick={() => { setShowForm(false); setEditingId(null); }} variant="secondary" size="sm">
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'resumen',  icon: HiSquares2X2,  label: 'Resumen'   },
          { key: 'tabla',    icon: HiTableCells,  label: 'Registros' },
          { key: 'grafico',  icon: HiChartBar,    label: 'Análisis'  },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          {loadingResumen ? (
            <div className="text-center py-10 text-gray-400">Cargando resumen...</div>
          ) : ultimoPorFrente.length === 0 ? (
            <Card>
              <div className="text-center py-10 text-gray-400">
                <HiSquares2X2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin registros aún. Crea el primero con "Nuevo registro".</p>
              </div>
            </Card>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Frentes registradas', value: kpis.total,        color: 'text-gray-800',  bg: 'bg-white',        border: 'border-gray-200',  icon: HiSquares2X2 },
                  { label: 'En tiempo',            value: kpis.en_tiempo,   color: 'text-green-600', bg: 'bg-green-50',     border: 'border-green-200', icon: HiCheckCircle },
                  { label: 'Con atraso',           value: kpis.atraso_leve + kpis.atraso_grave, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: HiExclamationTriangle },
                  { label: 'Sin iniciar',          value: kpis.sin_iniciar, color: 'text-gray-500',  bg: 'bg-gray-50',      border: 'border-gray-200',  icon: HiMinusCircle },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 flex items-center gap-3`}>
                    <k.icon className={`w-8 h-8 ${k.color} opacity-80 shrink-0`} />
                    <div>
                      <p className={`text-3xl font-bold ${k.color} leading-none`}>{k.value}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-tight">{k.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Distribución de estabilidad */}
              {estabilidadDist.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500 font-medium">Estabilidad actual:</span>
                  {estabilidadDist.map(e => (
                    <span key={e.key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ESTABILIDAD_COLORS[e.key]}`}>
                      <span className="text-base font-bold">{e.count}</span>
                      {e.key} — {e.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Grid de cards por frente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ultimoPorFrente.map(s => {
                  const estado = getEstadoSemaforo(s);
                  const sem = SEMAFORO[estado];
                  const IconSem = sem.icon;
                  return (
                    <div key={s.id}
                      className={`border-l-4 ${sem.border} ${sem.bg} border border-gray-200 rounded-xl p-4 space-y-3`}>

                      {/* Nombre + estado */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-900 text-sm leading-tight">
                          {s.frente_trabajo?.codigo_completo ?? `Frente #${s.frente_trabajo_id}`}
                        </p>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${sem.badge}`}>
                          <IconSem className="w-3.5 h-3.5" />
                          {sem.label}
                        </span>
                      </div>

                      {/* Estabilidad + ventilación */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTABILIDAD_COLORS[s.estabilidad] || 'bg-gray-100 text-gray-600'}`}>
                          {s.estabilidad} — {ESTABILIDAD_LABELS[s.estabilidad]}
                        </span>
                        <VentilacionBadge valor={s.ventilacion} />
                      </div>

                      {/* Fechas + desvío */}
                      <div className="space-y-1 text-xs text-gray-500">
                        <div className="flex justify-between">
                          <span>Inicio estimado</span>
                          <span className="font-medium text-gray-700">{fmtDate(s.fecha_inicio_estimada)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Inicio real</span>
                          {s.fecha_inicio_real
                            ? <span className="font-medium text-gray-700">{fmtDate(s.fecha_inicio_real)}</span>
                            : <button
                                onClick={() => setMarcarModal({ show: true, id: s.id, fechaActual: new Date().toISOString().split('T')[0] })}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded px-1.5 hover:bg-blue-50 transition-colors">
                                <HiCheck className="w-3 h-3" /> Marcar
                              </button>
                          }
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                          <span>Desvío</span>
                          <DesvioChip desvio={s.desvio} />
                        </div>
                        <div className="flex justify-between">
                          <span>Duración estimada</span>
                          <span className="font-medium text-gray-700">{s.duracion_estimada}d</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── REGISTROS ── */}
      {tab === 'tabla' && (
        <Card>
          {loading ? (
            <div className="text-center py-10 text-gray-400">Cargando registros...</div>
          ) : seguimientos.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <HiCalendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin registros aún.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-3 px-3">Frente</th>
                      <th className="text-left py-3 px-3">Ventilación</th>
                      <th className="text-left py-3 px-3">Estabilidad</th>
                      <th className="text-left py-3 px-3">Duración est.</th>
                      <th className="text-left py-3 px-3">Inicio estimado</th>
                      <th className="text-left py-3 px-3">Inicio real</th>
                      <th className="text-left py-3 px-3">Desvío</th>
                      <th className="text-left py-3 px-3">Registrado por</th>
                      <th className="py-3 px-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {seguimientos.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3 font-medium text-gray-800">
                          {s.frente_trabajo?.codigo_completo ?? `#${s.frente_trabajo_id}`}
                        </td>
                        <td className="py-3 px-3"><VentilacionBadge valor={s.ventilacion} /></td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTABILIDAD_COLORS[s.estabilidad] || 'bg-gray-100 text-gray-600'}`}>
                            {s.estabilidad} — {ESTABILIDAD_LABELS[s.estabilidad]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{s.duracion_estimada}d</td>
                        <td className="py-3 px-3 text-gray-600">{s.fecha_inicio_estimada}</td>
                        <td className="py-3 px-3">
                          {s.fecha_inicio_real
                            ? <span className="text-gray-600">{fmtDate(s.fecha_inicio_real)}</span>
                            : <button
                                onClick={() => setMarcarModal({ show: true, id: s.id, fechaActual: new Date().toISOString().split('T')[0] })}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors">
                                <HiCheck className="w-3.5 h-3.5" /> Marcar inicio
                              </button>
                          }
                        </td>
                        <td className="py-3 px-3"><DesvioChip desvio={s.desvio} /></td>
                        <td className="py-3 px-3 text-gray-500 text-xs">{s.registrado_por}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(s)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                              <HiPencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteModal({ show: true, id: s.id, label: s.frente_trabajo?.codigo_completo ?? `#${s.id}` })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                              <HiTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ── ANÁLISIS ── */}
      {tab === 'grafico' && (
        <div className="space-y-4">
          {loadingStats ? (
            <div className="text-center py-10 text-gray-400">Cargando estadísticas...</div>
          ) : estadisticas.length === 0 ? (
            <Card>
              <div className="text-center py-10 text-gray-400">
                <HiChartBar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin datos con inicio real registrado aún.</p>
              </div>
            </Card>
          ) : (() => {
            const total      = estadisticas.length;
            const enTiempo   = estadisticas.filter(s => s.desvio <= 0).length;
            const pctCumpl   = Math.round((enTiempo / total) * 100);
            const promedio   = (estadisticas.reduce((a, s) => a + s.desvio, 0) / total).toFixed(1);
            const peorCaso   = Math.max(...estadisticas.map(s => s.desvio));
            const mejorCaso  = Math.min(...estadisticas.map(s => s.desvio));
            const peorFrente = estadisticas.find(s => s.desvio === peorCaso)?.frente ?? '—';

            // Desvío promedio por estabilidad
            const porEstabilidad = Object.entries(ESTABILIDAD_LABELS).map(([key, label]) => {
              const grupo = estadisticas.filter(s => {
                const seg = todosLosSeguimientos.find(t => t.id === s.id);
                return seg?.estabilidad === key;
              });
              if (grupo.length === 0) return null;
              const avg = (grupo.reduce((a, s) => a + s.desvio, 0) / grupo.length).toFixed(1);
              return { key, label, avg: parseFloat(avg), count: grupo.length };
            }).filter(Boolean);

            const maxEstAbs = porEstabilidad.length > 0
              ? Math.max(...porEstabilidad.map(e => Math.abs(e.avg)), 1)
              : 1;

            return (
              <>
                {/* Métricas resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Cumplimiento',
                      value: `${pctCumpl}%`,
                      sub: `${enTiempo} de ${total} frentes`,
                      color: pctCumpl >= 70 ? 'text-green-600' : pctCumpl >= 40 ? 'text-amber-500' : 'text-red-500',
                      bg:    pctCumpl >= 70 ? 'bg-green-50 border-green-200' : pctCumpl >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
                    },
                    {
                      label: 'Promedio desvío',
                      value: `${promedio > 0 ? '+' : ''}${promedio}d`,
                      sub: 'días sobre lo estimado',
                      color: promedio <= 0 ? 'text-green-600' : 'text-red-500',
                      bg: promedio <= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200',
                    },
                    {
                      label: 'Peor caso',
                      value: peorCaso > 0 ? `+${peorCaso}d` : `${peorCaso}d`,
                      sub: peorFrente,
                      color: 'text-red-600',
                      bg: 'bg-red-50 border-red-200',
                    },
                    {
                      label: 'Mejor caso',
                      value: mejorCaso > 0 ? `+${mejorCaso}d` : `${mejorCaso}d`,
                      sub: 'días de adelanto',
                      color: mejorCaso <= 0 ? 'text-green-600' : 'text-amber-500',
                      bg: mejorCaso <= 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
                    },
                  ].map(m => (
                    <div key={m.label} className={`border rounded-xl p-4 ${m.bg}`}>
                      <p className={`text-2xl font-bold ${m.color} leading-none`}>{m.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate" title={m.sub}>{m.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Gráfico por frente */}
                <Card>
                  <h3 className="font-semibold text-gray-800 mb-1">Desvío por frente</h3>
                  <p className="text-xs text-gray-500 mb-4">Días de diferencia entre inicio estimado y real.</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Adelanto</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" /> Puntual</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Atraso</span>
                  </div>
                  <div className="space-y-3">
                    {estadisticas.map(s => {
                      const pct = Math.abs(s.desvio) / maxAbs * 100;
                      const barColor = s.desvio > 0 ? 'bg-red-400' : s.desvio < 0 ? 'bg-green-400' : 'bg-gray-300';
                      return (
                        <div key={s.id} className="flex items-center gap-3">
                          <div className="w-36 shrink-0 text-right text-xs font-medium text-gray-700 truncate" title={s.frente}>
                            {s.frente}
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                            <DesvioChip desvio={s.desvio} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Desvío promedio por estabilidad */}
                {porEstabilidad.length > 0 && (
                  <Card>
                    <h3 className="font-semibold text-gray-800 mb-1">Desvío promedio por estabilidad</h3>
                    <p className="text-xs text-gray-500 mb-4">¿Qué tipo de frente se atrasa más?</p>
                    <div className="space-y-3">
                      {porEstabilidad.map(e => {
                        const pct = Math.abs(e.avg) / maxEstAbs * 100;
                        const barColor = e.avg > 0 ? 'bg-red-400' : e.avg < 0 ? 'bg-green-400' : 'bg-gray-300';
                        return (
                          <div key={e.key} className="flex items-center gap-3">
                            <div className="w-36 shrink-0 flex items-center justify-end gap-1.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ESTABILIDAD_COLORS[e.key]}`}>
                                {e.key}
                              </span>
                              <span className="text-xs text-gray-400">({e.count})</span>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor}`}
                                  style={{ width: `${Math.max(pct, 2)}%` }} />
                              </div>
                              <DesvioChip desvio={e.avg} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Modal eliminar */}
      <ConfirmModal
        show={deleteModal.show}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ show: false, id: null, label: '' })}
        title="¿Eliminar registro?"
        message="Estás a punto de eliminar el registro de:"
        highlightText={deleteModal.label}
        warningText="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        icon={HiTrash}
      />

      {/* Modal marcar inicio real */}
      {marcarModal.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-1">Marcar inicio real</h3>
            <p className="text-sm text-gray-500 mb-4">¿En qué fecha comenzó realmente esta tarea?</p>
            <Input type="date" value={marcarModal.fechaActual}
              onChange={e => setMarcarModal(p => ({ ...p, fechaActual: e.target.value }))} />
            <div className="flex gap-2 mt-4">
              <Button onClick={handleMarcarInicio} variant="primary" size="sm" className="flex-1">
                <HiCheck className="w-4 h-4 mr-1" /> Confirmar
              </Button>
              <Button onClick={() => setMarcarModal({ show: false, id: null, fechaActual: '' })} variant="secondary" size="sm" className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
