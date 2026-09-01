import { useState, useEffect, useCallback } from 'react';
import { HiXMark, HiCheckCircle, HiExclamationTriangle } from 'react-icons/hi2';
import Card from '../../../../shared/components/atoms/Card';
import TableFilters from '../../../../shared/components/molecules/TableFilters';
import Pagination from '../../../../shared/components/molecules/Pagination';
import useDebounce from '../../../../hooks/useDebounce';
import useToast from '../../../../hooks/useToast';
import extraerMensajeError from '../../../../core/services/apiError';
import gerencialService from '../../services/gerencialService';

const ESTADO_BADGE = {
  'Con Paquete Segunda': 'bg-slate-100 text-slate-700',
  Canjeado: 'bg-purple-100 text-purple-700',
  'En Tercero': 'bg-orange-100 text-orange-700',
  'Resuelto por Tercero': 'bg-orange-100 text-orange-700',
  Liquidado: 'bg-sky-100 text-sky-700',
  'Con Anticipo': 'bg-teal-100 text-teal-700',
  Pagado: 'bg-emerald-100 text-emerald-700',
};

// Etapas del avance comercial, en orden. "En Tercero" comparte la etapa con
// Canjeado/Resuelto por Tercero (es la misma decision, solo que via un tercero).
const ETAPAS = [
  { label: 'Paquete Segunda', estados: ['Con Paquete Segunda'] },
  { label: 'Canje / Tercero', estados: ['Canjeado', 'En Tercero', 'Resuelto por Tercero'] },
  { label: 'Liquidado', estados: ['Liquidado'] },
  { label: 'Anticipo', estados: ['Con Anticipo'] },
  { label: 'Pagado', estados: ['Pagado'] },
];

function StepperAvance({ estado }) {
  const indiceActual = ETAPAS.findIndex((e) => e.estados.includes(estado));
  const enTramite = estado === 'En Tercero';

  return (
    <div className="flex items-center">
      {ETAPAS.map((etapa, i) => {
        const completada = i < indiceActual;
        const actual = i === indiceActual;
        return (
          <div key={etapa.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 ${
                  completada
                    ? 'bg-emerald-500 border-emerald-500'
                    : actual
                      ? enTramite
                        ? 'bg-orange-400 border-orange-400 animate-pulse'
                        : 'bg-amber-400 border-amber-400'
                      : 'bg-white border-gray-300'
                }`}
              />
              <span className={`text-[10px] whitespace-nowrap ${actual ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                {etapa.label}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < indiceActual ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Línea de saldo de la tarjeta/modal: real > estimado con ley resuelta > preliminar
// (antes de Canje, con Segunda/Primera lo que haya) > sin datos todavía.
function SaldoTexto({ lote }) {
  if (lote.liquidacion_saldo_real_usd) {
    return <>${formatMoney(lote.liquidacion_saldo_real_usd)} USD</>;
  }
  if (lote.saldo_liquido_estimado_usd) {
    return <>~${formatMoney(lote.saldo_liquido_estimado_usd)} USD</>;
  }
  const prelim = lote.saldo_preliminar;
  if (prelim?.tipo === 'rango') {
    return (
      <>
        ~${formatMoney(prelim.min.saldo_liquido_usd, 0)} – ${formatMoney(prelim.max.saldo_liquido_usd, 0)} USD
        <span className="block text-[10px] font-normal text-gray-400">antes de Canje (Segunda–Primera)</span>
      </>
    );
  }
  if (prelim?.tipo === 'unico') {
    return (
      <>
        ~${formatMoney(prelim.valor.saldo_liquido_usd, 0)} USD
        <span className="block text-[10px] font-normal text-gray-400">con Ley {prelim.etapa}, antes de Canje</span>
      </>
    );
  }
  return 'Sin datos suficientes aún';
}

const formatMoney = (v, decimals = 2) => {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// Desglose paso a paso del Valor Unitario Cobre y el Saldo Líquido — mismo orden y
// misma lógica que el Excel de verificación del usuario (Calculo_Cobre_Resumido_1.xlsx),
// para que se pueda seguir la cuenta igual que ahí. "v1 solo Cobre": no incluye Oro/Plata.
function DesgloseCalculo({ tarifa, pesoRecibido, valor, etapaLabel }) {
  const paso = (n, texto, cuenta, resultado) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-[11px] font-semibold text-gray-500">Paso {n}</p>
        <p className="text-xs text-gray-600">{texto}</p>
        <p className="text-[11px] text-gray-400 italic">{cuenta}</p>
      </div>
      <span className="text-xs font-bold text-gray-800 tabular-nums shrink-0 whitespace-nowrap">{resultado}</span>
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      {etapaLabel && <p className="text-[11px] font-semibold text-purple-700 mb-1.5">Con Ley {etapaLabel}</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mb-2 pb-2 border-b border-gray-200">
        <span>Ley usada: <b className="text-gray-700">{valor.ley?.toFixed(3) ?? valor.ley}%</b></span>
        <span>Peso recibido: <b className="text-gray-700">{formatMoney(pesoRecibido)} t</b></span>
        <span>Tarifa base / Escala: <b className="text-gray-700">{formatMoney(tarifa.tarifa_base)} / {formatMoney(tarifa.escala)}</b></span>
        <span>Ley base / Fondo Estab.: <b className="text-gray-700">{tarifa.ley_base}% / {formatMoney(tarifa.fondo_estabilizacion)}</b></span>
      </div>
      {paso(1, 'Diferencia entre la Ley Base y la ley del lote', `${tarifa.ley_base}% − ${valor.ley?.toFixed(3)}%`, `${valor.diferencia_ley}%`)}
      {paso(2, 'Se multiplica por la Escala (premio/castigo por cada 1%)', `${formatMoney(tarifa.escala)} × ${valor.diferencia_ley}%`, `$${formatMoney(valor.ajuste_escala)}`)}
      {paso(3, 'Se resta el ajuste a la Tarifa Base → Valor Unitario Cobre', `${formatMoney(tarifa.tarifa_base)} − ${formatMoney(valor.ajuste_escala)}`, `$${formatMoney(valor.valor_unitario_cobre)}/tms`)}
      {paso(4, 'Importe = Valor Unitario × Peso Recibido', `${formatMoney(valor.valor_unitario_cobre)} × ${formatMoney(pesoRecibido)}`, `$${formatMoney(valor.importe_usd)}`)}
      {paso(5, 'I.V.A. = Importe × IVA%', `${formatMoney(valor.importe_usd)} × ${(tarifa.iva_porcentaje * 100).toFixed(0)}%`, `$${formatMoney(valor.iva_usd)}`)}
      {paso(6, 'Total Factura = Importe + I.V.A.', `${formatMoney(valor.importe_usd)} + ${formatMoney(valor.iva_usd)}`, `$${formatMoney(valor.total_factura_usd)}`)}
      {paso(7, 'Descuento Fondo Estabilización = Ley × Fondo × Peso', `${valor.ley?.toFixed(3)}% × ${formatMoney(tarifa.fondo_estabilizacion)} × ${formatMoney(pesoRecibido)}`, `−$${formatMoney(valor.fondo_estabilizacion_usd)}`)}
      <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-gray-300">
        <span className="text-xs font-bold text-gray-800">Saldo Líquido</span>
        <span className="text-sm font-extrabold text-purple-700 tabular-nums">${formatMoney(valor.saldo_liquido_usd)} USD</span>
      </div>
    </div>
  );
}

// Envoltorio: arma 1 o 2 desgloses según venga saldo_detalle (ley resuelta) o
// saldo_preliminar (rango Segunda/Primera, o una sola etapa disponible).
function DetalleCalculoLote({ lote }) {
  if (lote.saldo_detalle) {
    return <DesgloseCalculo tarifa={lote.saldo_detalle.tarifa} pesoRecibido={lote.saldo_detalle.peso_recibido} valor={lote.saldo_detalle} etapaLabel={null} />;
  }
  const prelim = lote.saldo_preliminar;
  if (!prelim) return null;
  if (prelim.tipo === 'rango') {
    return (
      <div className="space-y-2">
        <DesgloseCalculo tarifa={prelim.tarifa} pesoRecibido={prelim.peso_recibido} valor={prelim.min} etapaLabel={prelim.min.etapa} />
        <DesgloseCalculo tarifa={prelim.tarifa} pesoRecibido={prelim.peso_recibido} valor={prelim.max} etapaLabel={prelim.max.etapa} />
      </div>
    );
  }
  return <DesgloseCalculo tarifa={prelim.tarifa} pesoRecibido={prelim.peso_recibido} valor={prelim.valor} etapaLabel={prelim.etapa} />;
}

const formatearFechaHora = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function CampoMonto({ label, value, onChange, onSave, saving, fecha, disabled, placeholder }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        {fecha && <span className="text-[11px] text-gray-400">Cargado {formatearFechaHora(fecha)}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
        />
        <button
          onClick={onSave}
          disabled={saving || disabled}
          className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 shrink-0"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

export default function LotesComercial() {
  const toast = useToast();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [verModal, setVerModal] = useState({ show: false, lote: null });
  const [form, setForm] = useState({ numero: '', tasa_cambio: '', saldo_real_usd: '', saldo_real_clp: '', anticipo_monto: '', pago_monto: '' });
  const [guardando, setGuardando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, per_page: perPage, search: debouncedSearchTerm || undefined };
      Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

      const response = await gerencialService.getLotesComercial(params);
      const data = response.data || [];
      setLotes(data);
      if (response.total !== undefined) {
        setTotalPages(response.last_page || 1);
        setTotalRecords(response.total || data.length);
      } else {
        setTotalPages(1);
        setTotalRecords(data.length);
      }
    } catch (error) {
      toast.error('Error al cargar lotes', await extraerMensajeError(error, error.message));
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const abrirModal = (lote) => {
    setForm({
      numero: lote.liquidacion_numero || '',
      tasa_cambio: lote.liquidacion_tasa_cambio ?? '',
      saldo_real_usd: lote.liquidacion_saldo_real_usd ?? '',
      saldo_real_clp: lote.liquidacion_saldo_real_clp ?? '',
      anticipo_monto: lote.anticipo_monto ?? '',
      pago_monto: lote.pago_monto ?? '',
    });
    setVerModal({ show: true, lote });
  };

  const patchLote = (loteActualizado) => {
    setLotes((prev) => prev.map((l) => (l.id === loteActualizado.id ? loteActualizado : l)));
    setVerModal((prev) => ({ ...prev, lote: loteActualizado }));
  };

  const guardarLiquidacion = async () => {
    if (!form.numero || !form.tasa_cambio) {
      toast.error('Faltan datos', 'N° de Liquidación y Tasa de Cambio son obligatorios.');
      return;
    }
    setGuardando('liquidacion');
    try {
      const response = await gerencialService.actualizarLiquidacion(verModal.lote.id, {
        numero: form.numero,
        tasa_cambio: parseFloat(form.tasa_cambio),
        saldo_real_usd: form.saldo_real_usd === '' ? null : parseFloat(form.saldo_real_usd),
        saldo_real_clp: form.saldo_real_clp === '' ? null : parseFloat(form.saldo_real_clp),
      });
      patchLote(response.lote);
      toast.success('Liquidación registrada');
    } catch (error) {
      toast.error('Error al registrar la liquidación', await extraerMensajeError(error, error.message));
    } finally {
      setGuardando(null);
    }
  };

  const guardarAnticipo = async () => {
    if (form.anticipo_monto === '') return;
    setGuardando('anticipo');
    try {
      const response = await gerencialService.registrarAnticipo(verModal.lote.id, { monto: parseFloat(form.anticipo_monto) });
      patchLote(response.lote);
      toast.success('Anticipo registrado');
    } catch (error) {
      toast.error('Error al registrar el anticipo', await extraerMensajeError(error, error.message));
    } finally {
      setGuardando(null);
    }
  };

  const guardarPago = async () => {
    if (form.pago_monto === '') return;
    setGuardando('pago');
    try {
      const response = await gerencialService.registrarPago(verModal.lote.id, { monto: parseFloat(form.pago_monto) });
      patchLote(response.lote);
      toast.success('Pago registrado');
    } catch (error) {
      toast.error('Error al registrar el pago', await extraerMensajeError(error, error.message));
    } finally {
      setGuardando(null);
    }
  };

  const lote = verModal.lote;
  const hasLeyResuelta = lote?.ley_resuelta !== null && lote?.ley_resuelta !== undefined;
  const tieneLiquidacion = !!lote?.liquidacion_numero;
  const tieneAnticipo = !!lote?.anticipo_monto;

  // Diferencia entre lo calculado por el sistema y lo real del PDF, para la alerta visual.
  let diferenciaPct = null;
  if (lote?.liquidacion_saldo_calculado_usd && lote?.liquidacion_saldo_real_usd) {
    diferenciaPct = Math.abs(lote.liquidacion_saldo_calculado_usd - lote.liquidacion_saldo_real_usd) / lote.liquidacion_saldo_real_usd * 100;
  }

  return (
    <Card className="border-l-4 border-amber-400">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Lotes en seguimiento comercial</h3>
        <p className="text-sm text-gray-600 mt-1">
          {loading ? 'Cargando...' : <>Total: <span className="font-semibold text-amber-600">{totalRecords}</span> lote{totalRecords !== 1 ? 's' : ''}</>}
        </p>
      </div>

      <TableFilters
        searchValue={searchTerm}
        searchPlaceholder="Buscar por N° de lote, planta o empresa..."
        onSearchChange={handleSearchChange}
        filters={[]}
        filterValues={{}}
        onFilterChange={() => {}}
        onClear={() => setSearchTerm('')}
        alwaysExpanded={false}
      />

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : lotes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Todavía no hay lotes con Ley Paquete Segunda cargada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lotes.map((l) => (
            <button
              key={l.id}
              onClick={() => abrirModal(l)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">{l.numero_lote}</p>
                  <p className="text-xs text-gray-500">{l.planta_nombre || '-'} · {l.empresa_nombre || '-'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${ESTADO_BADGE[l.estado_laboratorio] || 'bg-gray-100 text-gray-600'}`}>
                  {l.estado_laboratorio}
                </span>
              </div>

              <div className="my-4 px-1">
                <StepperAvance estado={l.estado_laboratorio} />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span>{formatMoney(l.peso_recibido)} t recibidas</span>
                <span className="font-medium text-gray-700 text-right">
                  <SaldoTexto lote={l} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {totalRecords > perPage && (
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

      {verModal.show && lote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Lote {lote.numero_lote}</h3>
              <button onClick={() => setVerModal({ show: false, lote: null })} className="text-gray-400 hover:text-gray-600">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Planta:</span> <span className="font-medium">{lote.planta_nombre || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Empresa:</span> <span className="font-medium">{lote.empresa_nombre || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Ley resuelta:</span> <span className="font-medium">{lote.ley_canje ?? lote.ley_paquete_tercera ?? '-'}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Peso recibido:</span> <span className="font-medium">{formatMoney(lote.peso_recibido)} t</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">Estado:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[lote.estado_laboratorio] || 'bg-gray-100 text-gray-600'}`}>
                    {lote.estado_laboratorio}
                  </span>
                </div>
                <StepperAvance estado={lote.estado_laboratorio} />
              </div>

              {/* Paso 1: Liquidación */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-gray-800 text-sm">Liquidación</h4>

                {!hasLeyResuelta && (
                  <div className="text-xs text-gray-500 space-y-1.5">
                    <p>Todavía no hay una ley resuelta (falta el Canje o la resolución de Tercero) — la liquidación se habilita una vez que eso se decida en Laboratorio.</p>
                    {lote.saldo_preliminar && (
                      <>
                        <p className="text-gray-600">
                          Saldo preliminar con lo que ya hay cargado: <span className="font-semibold text-gray-800"><SaldoTexto lote={lote} /></span>
                        </p>
                        <div className="mt-2"><DetalleCalculoLote lote={lote} /></div>
                      </>
                    )}
                  </div>
                )}

                {hasLeyResuelta && !tieneLiquidacion && lote.saldo_liquido_estimado_usd && (
                  <div className="text-xs text-gray-500 space-y-1.5">
                    <p>
                      Saldo estimado por el sistema (solo Cobre): <span className="font-semibold">${formatMoney(lote.saldo_liquido_estimado_usd)} USD</span>
                    </p>
                    <div className="mt-2"><DetalleCalculoLote lote={lote} /></div>
                  </div>
                )}
                {hasLeyResuelta && !tieneLiquidacion && !lote.saldo_liquido_estimado_usd && (
                  <p className="text-xs text-amber-600">No se pudo estimar el saldo (falta la Tarifa del mes de cierre del lote).</p>
                )}

                {hasLeyResuelta && (!tieneLiquidacion ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">N° Liquidación</label>
                      <input type="text" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" placeholder="Ej: L 41356" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tasa de Cambio</label>
                      <input type="number" step="0.01" value={form.tasa_cambio} onChange={(e) => setForm((f) => ({ ...f, tasa_cambio: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" placeholder="Ej: 913.86" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Saldo Líquido real (USD)</label>
                      <input type="number" step="0.01" value={form.saldo_real_usd} onChange={(e) => setForm((f) => ({ ...f, saldo_real_usd: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Saldo Líquido real ($)</label>
                      <input type="number" step="0.01" value={form.saldo_real_clp} onChange={(e) => setForm((f) => ({ ...f, saldo_real_clp: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div className="col-span-2">
                      <button onClick={guardarLiquidacion} disabled={guardando === 'liquidacion'}
                        className="w-full px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                        {guardando === 'liquidacion' ? 'Guardando...' : 'Guardar Liquidación'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">N°:</span> <span className="font-medium">{lote.liquidacion_numero}</span> — Cargado {formatearFechaHora(lote.fecha_liquidacion)}</p>
                    <p><span className="text-gray-500">Calculado por el sistema:</span> ${formatMoney(lote.liquidacion_saldo_calculado_usd)} USD</p>
                    <p><span className="text-gray-500">Real (PDF):</span> ${formatMoney(lote.liquidacion_saldo_real_usd)} USD / ${formatMoney(lote.liquidacion_saldo_real_clp, 0)}</p>
                    {diferenciaPct !== null && (
                      <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${diferenciaPct <= 0.5 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {diferenciaPct <= 0.5 ? <HiCheckCircle className="w-4 h-4" /> : <HiExclamationTriangle className="w-4 h-4" />}
                        {diferenciaPct <= 0.5 ? 'Calza con la liquidación real' : `Diferencia de ${diferenciaPct.toFixed(2)}% respecto a lo esperado`}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Paso 2: Anticipo */}
              {tieneLiquidacion && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-800 text-sm mb-3">Anticipo</h4>
                  {!tieneAnticipo ? (
                    <CampoMonto
                      label="Monto del anticipo ($)"
                      value={form.anticipo_monto}
                      onChange={(v) => setForm((f) => ({ ...f, anticipo_monto: v }))}
                      onSave={guardarAnticipo}
                      saving={guardando === 'anticipo'}
                    />
                  ) : (
                    <p className="text-sm"><span className="text-gray-500">Monto:</span> <span className="font-medium">${formatMoney(lote.anticipo_monto, 0)}</span> — Cargado {formatearFechaHora(lote.fecha_anticipo)}</p>
                  )}
                </div>
              )}

              {/* Paso 3: Pago */}
              {tieneAnticipo && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-800 text-sm mb-3">Pago</h4>
                  {!lote.pago_monto ? (
                    <CampoMonto
                      label="Monto del pago ($)"
                      value={form.pago_monto}
                      onChange={(v) => setForm((f) => ({ ...f, pago_monto: v }))}
                      onSave={guardarPago}
                      saving={guardando === 'pago'}
                    />
                  ) : (
                    <p className="text-sm"><span className="text-gray-500">Monto:</span> <span className="font-medium">${formatMoney(lote.pago_monto, 0)}</span> — Cargado {formatearFechaHora(lote.fecha_pago)}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
