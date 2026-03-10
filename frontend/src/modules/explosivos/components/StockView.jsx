import { useState, useEffect } from 'react';
import {
  HiCube,
  HiMagnifyingGlass,
  HiXMark,
  HiArrowDownTray,
  HiArrowUpTray,
  HiAdjustmentsHorizontal,
  HiCheckCircle,
  HiClock,
  HiTag,
  HiInformationCircle,
  HiArchiveBox,
} from 'react-icons/hi2';

import { HiArrowTrendingUp } from "react-icons/hi2";
import { HiArrowTrendingDown } from "react-icons/hi2";
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import explosivosService from '../services/explosivos';
import useToast from '../../../hooks/useToast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNum(val, decimals = 0) {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('es-CL', { maximumFractionDigits: decimals });
}

function formatFecha(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatFechaHora(dateStr, hora) {
  if (!dateStr) return '—';
  const fecha = new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  return hora ? `${fecha} ${hora.slice(0, 5)}` : fecha;
}

function getEstado(item) {
  if (item.esta_bajo_minimo) return 'bajo';
  if (item.esta_sobre_maximo) return 'alto';
  return 'ok';
}

// ─── StockCard ────────────────────────────────────────────────────────────────

function StockCard({ item, onClick }) {
  const estado = getEstado(item);
  const tipo = item.tipo_explosivo;
  const cantidad = parseFloat(item.cantidad) || 0;
  const reservado = parseFloat(item.cantidad_reservada) || 0;
  const disponible = Math.max(0, cantidad - reservado);
  const max = parseFloat(tipo?.stock_maximo) || 0;
  const min = parseFloat(tipo?.stock_minimo) || 0;
  const pct = max > 0 ? Math.min((cantidad / max) * 100, 100) : null;
  const pctMin = max > 0 && min > 0 ? Math.min((min / max) * 100, 100) : null;

  const estadoConfig = {
    bajo: {
      border: 'border-red-300',
      badge: 'bg-red-100 text-red-700',
      badgeText: 'Bajo mínimo',
      icon: HiArrowTrendingDown,
      iconColor: 'text-red-500',
      bar: 'bg-red-500',
      ring: 'ring-red-200',
      numColor: 'text-red-700',
    },
    alto: {
      border: 'border-yellow-300',
      badge: 'bg-yellow-100 text-yellow-700',
      badgeText: 'Sobre máximo',
      icon: HiArrowTrendingUp,
      iconColor: 'text-yellow-500',
      bar: 'bg-yellow-500',
      ring: 'ring-yellow-200',
      numColor: 'text-yellow-700',
    },
    ok: {
      border: 'border-gray-200',
      badge: 'bg-green-100 text-green-700',
      badgeText: 'Normal',
      icon: HiCheckCircle,
      iconColor: 'text-green-500',
      bar: 'bg-green-500',
      ring: 'ring-green-100',
      numColor: 'text-gray-800',
    },
  }[estado];

  const Icon = estadoConfig.icon;

  return (
    <button
      onClick={() => onClick(item)}
      className={`
        w-full text-left bg-white rounded-xl border-2 ${estadoConfig.border}
        p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200
        focus:outline-none focus:ring-2 ${estadoConfig.ring} group
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              {tipo?.codigo}
            </span>
            {tipo?.categoria?.nombre && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <HiTag className="w-3 h-3" />
                {tipo.categoria.nombre}
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
            {tipo?.nombre}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${estadoConfig.badge}`}>
            <Icon className="w-3.5 h-3.5" />
            {estadoConfig.badgeText}
          </span>
        </div>
      </div>

      {/* Stock principal */}
      <div className="mb-3">
        <div className="flex items-end gap-1.5">
          <span className={`text-3xl font-bold leading-none ${estadoConfig.numColor}`}>
            {formatNum(cantidad)}
          </span>
          <span className="text-sm text-gray-500 mb-0.5">{tipo?.unidad_medida}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Stock total</p>
      </div>

      {/* Disponible / Reservado */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
          <p className="text-xs text-green-600 font-medium">Disponible</p>
          <p className="text-base font-bold text-green-700">{formatNum(disponible)}</p>
        </div>
        {reservado > 0 && (
          <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
            <p className="text-xs text-orange-600 font-medium">Reservado</p>
            <p className="text-base font-bold text-orange-700">{formatNum(reservado)}</p>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      {pct !== null ? (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Mín: {formatNum(min)}</span>
            <span>Máx: {formatNum(max)}</span>
          </div>
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${estadoConfig.bar}`}
              style={{ width: `${pct}%` }}
            />
            {pctMin !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-60"
                style={{ left: `${pctMin}%` }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400 text-center py-1">
          {min > 0 ? `Mín: ${formatNum(min)} ${tipo?.unidad_medida}` : 'Sin límites configurados'}
        </div>
      )}

      {/* Footer: ver detalle */}
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-end">
        <span className="text-xs text-gray-400 group-hover:text-red-500 transition-colors flex items-center gap-1">
          <HiInformationCircle className="w-4 h-4" />
          Ver detalle
        </span>
      </div>
    </button>
  );
}

// ─── StockDetailDrawer ────────────────────────────────────────────────────────

function StockDetailDrawer({ item, polvorin, onClose }) {
  const [lotes, setLotes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const [loadingMov, setLoadingMov] = useState(true);

  const tipo = item?.tipo_explosivo;
  const cantidad = parseFloat(item?.cantidad) || 0;
  const reservado = parseFloat(item?.cantidad_reservada) || 0;
  const disponible = Math.max(0, cantidad - reservado);

  useEffect(() => {
    if (!item || !polvorin) return;

    // Cargar lotes activos
    explosivosService.getLotes({
      id_tipo_explosivo: tipo?.id,
      id_polvorin: polvorin.id,
      estado: 'activo',
    }).then(res => {
      setLotes(Array.isArray(res) ? res : res.data || []);
    }).catch(() => setLotes([])).finally(() => setLoadingLotes(false));

    // Cargar últimos movimientos
    explosivosService.getMovimientos({
      id_tipo_explosivo: tipo?.id,
      id_polvorin: polvorin.id,
      per_page: 10,
    }).then(res => {
      setMovimientos(Array.isArray(res) ? res : res.data || []);
    }).catch(() => setMovimientos([])).finally(() => setLoadingMov(false));
  }, [item]);

  if (!item) return null;

  const tipoMovConfig = {
    entrada: { label: 'Entrada', color: 'bg-green-100 text-green-700', icon: HiArrowDownTray },
    salida: { label: 'Salida', color: 'bg-red-100 text-red-700', icon: HiArrowUpTray },
    ajuste: { label: 'Ajuste', color: 'bg-blue-100 text-blue-700', icon: HiAdjustmentsHorizontal },
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm bg-white/20 px-2 py-0.5 rounded">
                {tipo?.codigo}
              </span>
              {tipo?.categoria?.nombre && (
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded">
                  {tipo.categoria.nombre}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold leading-tight">{tipo?.nombre}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Stock resumen */}
          <div className="p-6 border-b">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Stock Actual — {polvorin?.nombre}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-800">{formatNum(cantidad)}</p>
                <p className="text-xs text-gray-400">{tipo?.unidad_medida}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 mb-1">Disponible</p>
                <p className="text-2xl font-bold text-green-700">{formatNum(disponible)}</p>
                <p className="text-xs text-green-400">{tipo?.unidad_medida}</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${reservado > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                <p className={`text-xs mb-1 ${reservado > 0 ? 'text-orange-600' : 'text-gray-400'}`}>Reservado</p>
                <p className={`text-2xl font-bold ${reservado > 0 ? 'text-orange-700' : 'text-gray-300'}`}>{formatNum(reservado)}</p>
                <p className={`text-xs ${reservado > 0 ? 'text-orange-400' : 'text-gray-300'}`}>{tipo?.unidad_medida}</p>
              </div>
            </div>

            {/* Límites */}
            {(tipo?.stock_minimo > 0 || tipo?.stock_maximo > 0) && (
              <div className="mt-3 flex gap-4 text-sm text-gray-600">
                {tipo?.stock_minimo > 0 && (
                  <span>Mínimo: <strong>{formatNum(tipo.stock_minimo)} {tipo.unidad_medida}</strong></span>
                )}
                {tipo?.stock_maximo > 0 && (
                  <span>Máximo: <strong>{formatNum(tipo.stock_maximo)} {tipo.unidad_medida}</strong></span>
                )}
              </div>
            )}
          </div>

          {/* Info del tipo */}
          {(tipo?.fabricante || tipo?.clasificacion_onu || tipo?.descripcion) && (
            <div className="p-6 border-b">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Información del Producto
              </h4>
              <div className="space-y-2 text-sm">
                {tipo?.fabricante && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fabricante</span>
                    <span className="font-medium text-gray-700">{tipo.fabricante}</span>
                  </div>
                )}
                {tipo?.clasificacion_onu && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Clasificación ONU</span>
                    <span className="font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {tipo.clasificacion_onu}
                    </span>
                  </div>
                )}
                {tipo?.unidad_medida && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unidad de medida</span>
                    <span className="font-medium text-gray-700">{tipo.unidad_medida}</span>
                  </div>
                )}
                {tipo?.descripcion && (
                  <p className="text-gray-500 text-xs mt-2 bg-gray-50 rounded-lg p-3">
                    {tipo.descripcion}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Lotes activos */}
          <div className="p-6 border-b">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HiArchiveBox className="w-4 h-4" />
              Lotes Activos
            </h4>
            {loadingLotes ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : lotes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">Sin lotes activos registrados</p>
            ) : (
              <div className="space-y-2">
                {lotes.map((lote) => {
                  const vence = lote.fecha_vencimiento ? new Date(lote.fecha_vencimiento) : null;
                  const hoy = new Date();
                  const diasParaVencer = vence ? Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24)) : null;
                  const proximoVencer = diasParaVencer !== null && diasParaVencer <= 30;

                  return (
                    <div
                      key={lote.id}
                      className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                        proximoVencer ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-700 font-mono">{lote.numero_lote || `Lote #${lote.id}`}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          {lote.fecha_ingreso && (
                            <span>Ingreso: {formatFecha(lote.fecha_ingreso)}</span>
                          )}
                          {vence && (
                            <span className={proximoVencer ? 'text-orange-600 font-medium' : ''}>
                              Vence: {formatFecha(lote.fecha_vencimiento)}
                              {proximoVencer && ` (${diasParaVencer}d)`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{formatNum(lote.cantidad_actual)}</p>
                        <p className="text-xs text-gray-400">{tipo?.unidad_medida}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Últimos movimientos */}
          <div className="p-6">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HiClock className="w-4 h-4" />
              Últimos Movimientos
            </h4>
            {loadingMov ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : movimientos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">Sin movimientos registrados</p>
            ) : (
              <div className="space-y-2">
                {movimientos.map((mov) => {
                  const tipoMov = tipoMovConfig[mov.tipo] || tipoMovConfig.ajuste;
                  const IconMov = tipoMov.icon;
                  const esPositivo = mov.tipo === 'entrada';

                  return (
                    <div key={mov.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-1.5 rounded-lg ${tipoMov.color}`}>
                        <IconMov className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${tipoMov.color}`}>
                            {tipoMov.label}
                          </span>
                          {mov.guia_despacho && (
                            <span className="text-xs text-gray-400">Guía: {mov.guia_despacho}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {formatFechaHora(mov.fecha, mov.hora)}
                          {mov.usuario?.name && ` — ${mov.usuario.name}`}
                        </p>
                        {mov.motivo && (
                          <p className="text-xs text-gray-400 truncate">{mov.motivo}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-sm ${esPositivo ? 'text-green-600' : 'text-red-600'}`}>
                          {esPositivo ? '+' : '-'}{formatNum(mov.cantidad)}
                        </p>
                        <p className="text-xs text-gray-400">{tipo?.unidad_medida}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── StockView principal ──────────────────────────────────────────────────────

export default function StockView({ polvorin, tipos, categorias, alertas, onRefresh }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [itemDetalle, setItemDetalle] = useState(null);

  useEffect(() => {
    if (polvorin?.id) {
      loadStock();
    } else {
      setLoading(false);
    }
  }, [polvorin]);

  const loadStock = async () => {
    setLoading(true);
    try {
      const response = await explosivosService.getStock({ id_polvorin: polvorin.id });
      setStock(response);
    } catch {
      toast.error('Error', 'No se pudo cargar el stock');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar stock por categoría
  const stockAgrupado = stock.reduce((acc, item) => {
    const categoria = item.tipo_explosivo?.categoria?.nombre || 'Sin Categoría';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(item);
    return acc;
  }, {});

  // Filtrar
  const stockFiltrado = Object.entries(stockAgrupado).reduce((acc, [cat, items]) => {
    if (filtroCategoria && cat !== filtroCategoria) return acc;
    const itemsFiltrados = items.filter(item => {
      if (!busqueda) return true;
      const texto = `${item.tipo_explosivo?.codigo} ${item.tipo_explosivo?.nombre}`.toLowerCase();
      return texto.includes(busqueda.toLowerCase());
    });
    if (itemsFiltrados.length > 0) acc[cat] = itemsFiltrados;
    return acc;
  }, {});

  const totalAlertas = (alertas.bajo_minimo?.length || 0) + (alertas.sobre_maximo?.length || 0);
  const totalItems = stock.length;

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">

      {/* Barra de filtros */}
      <Card className="py-3 px-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <HiXMark className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="">Todas las categorías</option>
            {Object.keys(stockAgrupado).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadStock} className="shrink-0">
            Actualizar
          </Button>
        </div>
      </Card>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tipos en stock</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{Object.keys(stockAgrupado).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Categorías</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${alertas.bajo_minimo?.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${alertas.bajo_minimo?.length > 0 ? 'text-red-700' : 'text-gray-300'}`}>
            {alertas.bajo_minimo?.length || 0}
          </p>
          <p className={`text-xs mt-0.5 ${alertas.bajo_minimo?.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>Bajo mínimo</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${alertas.sobre_maximo?.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${alertas.sobre_maximo?.length > 0 ? 'text-yellow-700' : 'text-gray-300'}`}>
            {alertas.sobre_maximo?.length || 0}
          </p>
          <p className={`text-xs mt-0.5 ${alertas.sobre_maximo?.length > 0 ? 'text-yellow-500' : 'text-gray-400'}`}>Sobre máximo</p>
        </div>
      </div>


      {/* Grid de cards por categoría */}
      {Object.keys(stockFiltrado).length === 0 ? (
        <Card className="text-center py-16">
          <HiCube className="w-16 h-16 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {busqueda || filtroCategoria ? 'No hay resultados para el filtro aplicado' : 'No hay stock registrado'}
          </p>
          {!busqueda && !filtroCategoria && (
            <p className="text-sm text-gray-400 mt-1">
              Registre entradas desde la pestaña Movimientos
            </p>
          )}
        </Card>
      ) : (
        Object.entries(stockFiltrado).map(([categoria, items]) => (
          <div key={categoria}>
            <div className="flex items-center gap-2 mb-3">
              <HiTag className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                {categoria}
              </h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {items.length} {items.length === 1 ? 'tipo' : 'tipos'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(item => (
                <StockCard
                  key={item.id}
                  item={item}
                  onClick={setItemDetalle}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Drawer de detalle */}
      {itemDetalle && (
        <StockDetailDrawer
          item={itemDetalle}
          polvorin={polvorin}
          onClose={() => setItemDetalle(null)}
        />
      )}
    </div>
  );
}
