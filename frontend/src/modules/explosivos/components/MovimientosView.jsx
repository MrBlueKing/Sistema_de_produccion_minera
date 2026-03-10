import { useState, useEffect } from 'react';
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiAdjustmentsHorizontal,
  HiPlus,
  HiXMark,
  HiTrash,
  HiFunnel,
  HiDocumentText,
  HiCalendar,
  HiTag,
} from 'react-icons/hi2';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import Pagination from '../../../shared/components/molecules/Pagination';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFecha = (fecha) => {
  if (!fecha) return '-';
  const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const formatHora = (hora) => hora ? hora.slice(0, 5) : null;

const TIPO_CONFIG = {
  entrada:       { label: 'Entrada',      bg: 'bg-green-100 text-green-700',  icon: HiArrowDownTray,         dot: 'bg-green-500'  },
  salida:        { label: 'Salida',       bg: 'bg-red-100 text-red-700',      icon: HiArrowUpTray,           dot: 'bg-red-500'    },
  ajuste:        { label: 'Ajuste',       bg: 'bg-blue-100 text-blue-700',    icon: HiAdjustmentsHorizontal, dot: 'bg-blue-500'   },
  devolucion:    { label: 'Devolución',   bg: 'bg-yellow-100 text-yellow-700',icon: HiArrowDownTray,         dot: 'bg-yellow-500' },
  transferencia: { label: 'Transferencia',bg: 'bg-purple-100 text-purple-700',icon: HiAdjustmentsHorizontal, dot: 'bg-purple-500' },
};

// ─── MovimientoCard (móvil) ───────────────────────────────────────────────────

function MovimientoCard({ mov }) {
  const cfg = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.ajuste;
  const Icon = cfg.icon;
  const esPositivo = mov.es_positivo;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Fila 1: tipo + cantidad */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
          <Icon className="w-3.5 h-3.5" />
          {mov.tipo_formateado || cfg.label}
        </span>
        <div className="text-right">
          <p className={`text-2xl font-bold tabular-nums leading-none ${esPositivo ? 'text-green-600' : 'text-red-600'}`}>
            {esPositivo ? '+' : '-'}{parseFloat(mov.cantidad).toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{mov.tipo_explosivo?.unidad_medida}</p>
        </div>
      </div>

      {/* Fila 2: producto */}
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <span className="font-mono text-xs font-semibold text-gray-700">{mov.tipo_explosivo?.codigo}</span>
          <span className="text-xs text-gray-500 ml-1.5">{mov.tipo_explosivo?.nombre}</span>
          {mov.tipo_explosivo?.categoria?.nombre && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
              {mov.tipo_explosivo.categoria.nombre}
            </span>
          )}
        </div>
      </div>

      {/* Fila 3: fecha + origen */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <HiCalendar className="w-3.5 h-3.5" />
          {formatFecha(mov.fecha)}{formatHora(mov.hora) ? ` · ${formatHora(mov.hora)}` : ''}
        </span>
        {mov.reporte_perforacion ? (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
            {mov.reporte_perforacion.codigo}
          </span>
        ) : mov.guia_despacho ? (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
            Guía {mov.guia_despacho}
          </span>
        ) : (
          <span>Manual</span>
        )}
      </div>

      {/* Motivo */}
      {mov.motivo && (
        <p className="text-xs text-gray-500 italic truncate">{mov.motivo}</p>
      )}
    </div>
  );
}

// ─── MovimientosView principal ────────────────────────────────────────────────

export default function MovimientosView({ polvorin, tipos, onRefresh, faenaActual }) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [resumen, setResumen] = useState(null);

  const [filtros, setFiltros] = useState({
    tipo: '',
    fecha_desde: '',
    fecha_hasta: '',
    id_tipo_explosivo: '',
  });

  const [proveedores, setProveedores] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [guiaForm, setGuiaForm] = useState({ guia_despacho: '', id_proveedor: '', observaciones: '' });
  const [guiaItems, setGuiaItems] = useState([
    { id_tipo_explosivo: '', cantidad: '', numero_lote: '', fecha_vencimiento: '', precio_unitario: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (polvorin?.id) loadMovimientos();
    cargarProveedores();
  }, [polvorin, currentPage, filtros]);

  const cargarProveedores = async () => {
    try {
      const data = await explosivosService.getProveedores({ activo: 'true' });
      setProveedores(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
    }
  };

  const loadMovimientos = async () => {
    setLoading(true);
    try {
      const params = {
        id_polvorin: polvorin.id,
        page: currentPage,
        per_page: 15,
        ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '')),
      };
      const response = await explosivosService.getMovimientos(params);
      setMovimientos(response.data || []);
      setTotalPages(response.last_page || 1);
      setTotalRegistros(response.total || 0);
      setResumen(response.resumen || null);
    } catch {
      toast.error('Error', 'No se pudieron cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (name, value) => {
    setFiltros(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const limpiarFiltros = () => {
    setFiltros({ tipo: '', fecha_desde: '', fecha_hasta: '', id_tipo_explosivo: '' });
    setCurrentPage(1);
  };

  const abrirModalGuia = () => {
    setGuiaForm({ guia_despacho: '', id_proveedor: '', observaciones: '' });
    setGuiaItems([{ id_tipo_explosivo: '', cantidad: '', numero_lote: '', fecha_vencimiento: '', precio_unitario: '' }]);
    setShowModal(true);
  };

  const agregarItemGuia = () => {
    setGuiaItems(prev => [...prev, { id_tipo_explosivo: '', cantidad: '', numero_lote: '', fecha_vencimiento: '', precio_unitario: '' }]);
  };

  const eliminarItemGuia = (index) => {
    if (guiaItems.length <= 1) return;
    setGuiaItems(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarItemGuia = (index, campo, valor) => {
    setGuiaItems(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };

  const calcularTotalItem = (item) => (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0);
  const calcularTotalGuia = () => guiaItems.reduce((acc, item) => acc + calcularTotalItem(item), 0);

  const handleSubmitGuia = async (e) => {
    e.preventDefault();
    const itemsValidos = guiaItems.filter(item => item.id_tipo_explosivo && item.cantidad);
    if (itemsValidos.length === 0) {
      toast.error('Error', 'Agregue al menos un producto con tipo y cantidad');
      return;
    }
    setSubmitting(true);
    try {
      const ahora = new Date();
      const provSeleccionado = proveedores.find(p => p.id === parseInt(guiaForm.id_proveedor));
      await explosivosService.registrarEntradaGuia({
        id_polvorin: polvorin.id,
        id_faena: faenaActual.id,
        fecha: ahora.toISOString().split('T')[0],
        hora: ahora.toTimeString().slice(0, 5),
        guia_despacho: guiaForm.guia_despacho,
        proveedor: provSeleccionado?.nombre || '',
        rut_proveedor: provSeleccionado?.rut || '',
        observaciones: guiaForm.observaciones,
        items: itemsValidos.map(item => ({
          id_tipo_explosivo: parseInt(item.id_tipo_explosivo),
          cantidad: parseFloat(item.cantidad),
          numero_lote: item.numero_lote || null,
          fecha_vencimiento: item.fecha_vencimiento || null,
          precio_unitario: item.precio_unitario ? parseFloat(item.precio_unitario) : null,
        })),
      });
      toast.success('Guía registrada', 'La guía de despacho fue registrada correctamente');
      setShowModal(false);
      loadMovimientos();
      onRefresh?.();
    } catch (error) {
      toast.error('Error', error.response?.data?.mensaje || 'No se pudo registrar la guía de despacho');
    } finally {
      setSubmitting(false);
    }
  };

  const hayFiltros = Object.values(filtros).some(v => v !== '');

  return (
    <div className="space-y-5">

      {/* ── Header + Filtros unificados ───────────────────────────────────── */}
      <Card className="py-4 px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Movimientos de Explosivos</h3>
            <p className="text-xs text-gray-500 mt-0.5">{polvorin?.nombre}</p>
          </div>
          <Button variant="success" icon={HiDocumentText} onClick={abrirModalGuia} className="shrink-0">
            Registrar Guía de Despacho
          </Button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={filtros.tipo}
            onChange={(e) => handleFiltroChange('tipo', e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="">Todos los tipos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
            <option value="ajuste">Ajustes</option>
            <option value="devolucion">Devoluciones</option>
          </select>
          <select
            value={filtros.id_tipo_explosivo}
            onChange={(e) => handleFiltroChange('id_tipo_explosivo', e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white col-span-1"
          >
            <option value="">Todos los explosivos</option>
            {tipos.map(tipo => (
              <option key={tipo.id} value={tipo.id}>{tipo.codigo} — {tipo.nombre}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
        {hayFiltros && (
          <div className="mt-3">
            <button
              onClick={limpiarFiltros}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <HiXMark className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {/* ── Stats de resumen ──────────────────────────────────────────────── */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: totalRegistros, sub: 'movimientos',  color: 'border-gray-400',   text: 'text-gray-800'   },
            { label: 'Entradas',  value: resumen.count_entradas ?? 0,   sub: 'ingresos',      color: 'border-green-500',  text: 'text-green-600'  },
            { label: 'Salidas',   value: resumen.count_salidas ?? 0,    sub: 'consumos',      color: 'border-red-500',    text: 'text-red-600'    },
            { label: 'Dev. / Ajustes', value: (parseInt(resumen.count_devoluciones ?? 0) + parseInt(resumen.count_ajustes ?? 0)), sub: 'correcciones', color: 'border-yellow-500', text: 'text-yellow-600' },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-xl p-4 border-l-4 shadow-sm ${s.color}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Lista de movimientos ──────────────────────────────────────────── */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600" />
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12">
            <HiArrowDownTray className="w-16 h-16 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay movimientos registrados</p>
            <p className="text-sm text-gray-400 mt-1">Registre su primera guía de despacho</p>
          </div>
        ) : (
          <>
            {/* Tabla — solo en sm+ */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 bg-gradient-to-r from-red-50 to-orange-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Cantidad</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Motivo</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => {
                    const cfg = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.ajuste;
                    const Icon = cfg.icon;
                    return (
                      <tr key={mov.id} className="border-b hover:bg-red-50/50 even:bg-gray-50/30">
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{formatFecha(mov.fecha)}</div>
                          {mov.hora && <div className="text-xs text-gray-400">{formatHora(mov.hora)}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {mov.tipo_formateado || cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{mov.tipo_explosivo?.codigo}</div>
                          <div className="text-xs text-gray-500">{mov.tipo_explosivo?.nombre}</div>
                          {mov.tipo_explosivo?.categoria?.nombre && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                              {mov.tipo_explosivo.categoria.nombre}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${mov.es_positivo ? 'text-green-600' : 'text-red-600'}`}>
                            {mov.es_positivo ? '+' : '-'}{parseFloat(mov.cantidad).toLocaleString('es-CL')}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">{mov.tipo_explosivo?.unidad_medida}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm max-w-[200px] truncate" title={mov.motivo || ''}>
                          {mov.motivo || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {mov.reporte_perforacion ? (
                            <span className="inline-flex px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              {mov.reporte_perforacion.codigo}
                            </span>
                          ) : mov.guia_despacho ? (
                            <span className="inline-flex px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Guía {mov.guia_despacho}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Manual</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards — solo en móvil */}
            <div className="sm:hidden space-y-3">
              {movimientos.map(mov => (
                <MovimientoCard key={mov.id} mov={mov} />
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRegistros}
              perPage={15}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* ── Modal Guía de Despacho ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-2xl max-h-[95vh] flex flex-col rounded-t-2xl">

            {/* Header */}
            <div className="px-5 py-4 border-b bg-green-50 rounded-t-2xl sm:rounded-t-xl flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-base font-semibold text-green-800">Registrar Guía de Despacho</h3>
                <p className="text-xs text-green-600 mt-0.5">Ingreso de explosivos al polvorín</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/60">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <form onSubmit={handleSubmitGuia} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* Guía + Proveedor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° Guía de Despacho *</label>
                    <input
                      type="text"
                      value={guiaForm.guia_despacho}
                      onChange={(e) => setGuiaForm(prev => ({ ...prev, guia_despacho: e.target.value }))}
                      required
                      placeholder="0025087"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                    <select
                      value={guiaForm.id_proveedor}
                      onChange={(e) => setGuiaForm(prev => ({ ...prev, id_proveedor: e.target.value }))}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">Seleccione un proveedor...</option>
                      {proveedores.map(prov => (
                        <option key={prov.id} value={prov.id}>
                          {prov.nombre}{prov.rut ? ` — ${prov.rut}` : ''}
                        </option>
                      ))}
                    </select>
                    {proveedores.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">Sin proveedores. Agréguelos en Configuración.</p>
                    )}
                  </div>
                </div>

                {/* Productos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Productos</p>
                    <button
                      type="button"
                      onClick={agregarItemGuia}
                      className="flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium"
                    >
                      <HiPlus className="w-4 h-4" /> Agregar
                    </button>
                  </div>

                  <div className="space-y-3">
                    {guiaItems.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                        {/* Header del item */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Producto {index + 1}
                          </span>
                          {guiaItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarItemGuia(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <HiTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Tipo explosivo */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tipo de Explosivo *</label>
                          <select
                            value={item.id_tipo_explosivo}
                            onChange={(e) => actualizarItemGuia(index, 'id_tipo_explosivo', e.target.value)}
                            required
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                          >
                            <option value="">Seleccione...</option>
                            {tipos.map(tipo => (
                              <option key={tipo.id} value={tipo.id}>
                                {tipo.codigo} — {tipo.nombre} ({tipo.unidad_medida})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad + Lote */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Cantidad *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={item.cantidad}
                              onChange={(e) => actualizarItemGuia(index, 'cantidad', e.target.value)}
                              required
                              placeholder="0"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">N° Lote</label>
                            <input
                              type="text"
                              value={item.numero_lote}
                              onChange={(e) => actualizarItemGuia(index, 'numero_lote', e.target.value)}
                              placeholder="Opcional"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                        </div>

                        {/* Vencimiento + Precio */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">F. Vencimiento</label>
                            <input
                              type="date"
                              value={item.fecha_vencimiento}
                              onChange={(e) => actualizarItemGuia(index, 'fecha_vencimiento', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Precio Unitario</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.precio_unitario}
                              onChange={(e) => actualizarItemGuia(index, 'precio_unitario', e.target.value)}
                              placeholder="$0"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                        </div>

                        {/* Total del item */}
                        {calcularTotalItem(item) > 0 && (
                          <div className="flex justify-end">
                            <span className="text-xs text-gray-500">Total: </span>
                            <span className="text-sm font-semibold text-gray-700 ml-1">
                              ${calcularTotalItem(item).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Total guía */}
                  {calcularTotalGuia() > 0 && (
                    <div className="flex justify-end mt-3 px-1">
                      <span className="text-sm text-gray-600 font-semibold">NETO: </span>
                      <span className="text-sm font-bold text-gray-800 ml-2">
                        ${calcularTotalGuia().toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    value={guiaForm.observaciones}
                    onChange={(e) => setGuiaForm(prev => ({ ...prev, observaciones: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-5 py-4 border-t bg-gray-50 flex gap-3 shrink-0">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" variant="success" disabled={submitting} onClick={handleSubmitGuia} className="flex-1 justify-center">
                {submitting
                  ? 'Registrando...'
                  : `Registrar (${guiaItems.filter(i => i.id_tipo_explosivo && i.cantidad).length} producto${guiaItems.filter(i => i.id_tipo_explosivo && i.cantidad).length !== 1 ? 's' : ''})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
