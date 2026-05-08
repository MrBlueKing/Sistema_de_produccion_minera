import { useState, useEffect } from 'react';
import {
  HiMagnifyingGlass, HiChevronDown, HiChevronRight,
  HiTruck, HiBeaker, HiArrowPath, HiCheckCircle, HiXCircle,
  HiPrinter, HiArrowsPointingOut, HiArrowsPointingIn,
} from 'react-icons/hi2';
import laboratorioService from '../../../services/laboratorio';
import useDebounce from '../../../hooks/useDebounce';

// ─── utilidades ──────────────────────────────────────────────────────────────

const fmt = (v, d = 3) =>
  v != null ? parseFloat(v).toFixed(d) + '%' : '—';

const fmtTon = (v) =>
  v != null ? parseFloat(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' t' : '—';

const descuentoPct = (lote, base) => {
  if (!lote || !base || base === 0) return null;
  return ((lote / base - 1) * 100).toFixed(0);
};

// Para dumpadas con lab: ley_efectiva = ley_dump_ajustada / 0.90
// Para dumpadas sin lab: ley_efectiva = ley_visual (ley_dump_ajustada = ley_visual)
const leyEfectiva = (comp) => {
  if (comp.tiene_lab && comp.ley_dump_ajustada) {
    return parseFloat((comp.ley_dump_ajustada / 0.90).toFixed(3));
  }
  return comp.ley_visual ?? comp.ley_visual_mezcla ?? null;
};

const estadoBadge = (estado) => {
  const map = {
    'Despachado':  'bg-amber-100 text-amber-700',
    'En Tránsito': 'bg-blue-100 text-blue-700',
    'Recibido':    'bg-emerald-100 text-emerald-700',
    'Completado':  'bg-gray-100 text-gray-600',
  };
  return map[estado] ?? 'bg-gray-100 text-gray-500';
};

// ─── SubComponente: chip de dumpada en la línea de tiempo ───────────────────

function DumpadaChip({ comp, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 rounded-xl px-3 py-2 border-2 transition-all text-left min-w-[88px] ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-100'
          : comp.tiene_lab
            ? 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
            : 'border-yellow-200 bg-yellow-50/40 hover:border-yellow-400'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono font-bold text-sm text-gray-800">#{comp.numero_dumpada ?? '—'}</span>
        {comp.numero_paladas != null && (
          <span className="text-[9px] text-blue-400 font-bold">{comp.numero_paladas}p</span>
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{comp.jornada} · {fmtTon(comp.toneladas)}</div>
      <div className={`text-[11px] font-bold mt-1 ${comp.tiene_lab ? 'text-indigo-600' : 'text-yellow-600'}`}>
        {comp.ley_lote != null ? fmt(comp.ley_lote) : comp.ley_visual != null ? fmt(comp.ley_visual) : '—'}
      </div>
    </button>
  );
}

// ─── SubComponente: panel de detalle de una dumpada ─────────────────────────

function DumpadaDetalle({ comp }) {
  const efectiva = leyEfectiva(comp);
  const cuIns    = comp.cu_insoluble;
  const cuSol    = comp.cu_soluble;
  const insUsada = cuIns != null && (cuSol == null || cuIns >= cuSol);

  return (
    <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-xl text-gray-800">#{comp.numero_dumpada ?? '—'}</span>
            {comp.jornada && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-medium">{comp.jornada}</span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${comp.tiene_lab ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {comp.tiene_lab ? '✓ Lab' : 'Visual'}
            </span>
            {comp.certificado && (
              <span className="text-xs text-gray-300">cert. {comp.certificado}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{comp.frente ?? '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-700">{fmtTon(comp.toneladas)}</p>
          {comp.numero_paladas != null && (
            <p className="text-xs text-blue-500">{comp.numero_paladas} paladas</p>
          )}
        </div>
      </div>

      {comp.tiene_lab ? (
        <div className="space-y-4">
          {/* Fracciones brutas */}
          {(cuIns != null || cuSol != null) && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Fracciones del laboratorio
              </p>
              <div className="flex gap-3 flex-wrap">
                {cuIns != null && (
                  <div className={`rounded-lg px-3 py-2 border ${insUsada ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-400">Cu Insoluble (sulfuro)</p>
                    <p className={`text-lg font-bold ${insUsada ? 'text-amber-700' : 'text-gray-400'}`}>
                      {parseFloat(cuIns).toFixed(3)}%
                      {insUsada && <span className="ml-1 text-amber-500">★</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">no se disuelve en ácido</p>
                  </div>
                )}
                {cuSol != null && (
                  <div className={`rounded-lg px-3 py-2 border ${!insUsada ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-400">Cu Soluble (óxido)</p>
                    <p className={`text-lg font-bold ${!insUsada ? 'text-amber-700' : 'text-gray-400'}`}>
                      {parseFloat(cuSol).toFixed(3)}%
                      {!insUsada && <span className="ml-1 text-amber-500">★</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">sí se disuelve en ácido</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cadena de cálculo */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Cadena de cálculo
              {comp.rango && <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded normal-case font-normal">{comp.rango}</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {efectiva != null && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                    <p className="text-[10px] text-amber-600 font-semibold">Ley efectiva ★</p>
                    <p className="text-lg font-bold text-amber-700">{efectiva.toFixed(3)}%</p>
                    <p className="text-[10px] text-amber-400">fracción mayor, post-capping</p>
                  </div>
                  <span className="text-gray-300 font-bold text-xl">→</span>
                </>
              )}
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500 font-semibold">× 0.9 = Ley Dump</p>
                <p className="text-lg font-bold text-gray-700">{fmt(comp.ley_dump_ajustada)}</p>
                <p className="text-[10px] text-gray-400">−10% operacional</p>
              </div>
              <span className="text-gray-300 font-bold text-xl">→</span>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-indigo-600 font-semibold">× 0.81 = Ley Lote</p>
                <p className="text-xl font-bold text-indigo-700">{fmt(comp.ley_lote)}</p>
                <p className="text-[10px] text-indigo-400">−19% base de venta</p>
              </div>
            </div>
          </div>

          {/* Visual referencial */}
          {comp.ley_visual != null && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <span className="text-[10px] text-yellow-600 font-semibold">Visual referencial</span>
              <span className="text-sm font-bold text-yellow-700">{fmt(comp.ley_visual)}</span>
              <span className="text-[10px] text-yellow-400">estimación en terreno, no afecta el cálculo</span>
            </div>
          )}
        </div>
      ) : (
        /* Sin lab */
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Sin análisis de laboratorio</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-yellow-600 font-semibold">Ley Visual</p>
              <p className="text-lg font-bold text-yellow-700">{fmt(comp.ley_visual)}</p>
              <p className="text-[10px] text-yellow-400">estimación en terreno</p>
            </div>
            <span className="text-gray-300 font-bold text-xl">→</span>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-indigo-600 font-semibold">× 0.9 = Ley Lote</p>
              <p className="text-xl font-bold text-indigo-700">{fmt(comp.ley_lote)}</p>
              <p className="text-[10px] text-indigo-400">−10% base de venta</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SubComponente: panel de detalle de un remanente ────────────────────────

function RemDetalle({ comp }) {
  const esPaladas = comp.numero_paladas != null;
  const tonReal   = comp.toneladas_reales_origen;
  const delta     = esPaladas && tonReal != null ? parseFloat(comp.toneladas) - tonReal : null;

  return (
    <div className="bg-purple-50 rounded-xl border border-purple-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">REM</span>
            <span className="font-semibold text-purple-800">{comp.origen || '—'}</span>
          </div>
          {esPaladas && (
            <p className="text-xs text-purple-500 mt-1">{comp.numero_paladas} paladas tomadas físicamente</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-700">{fmtTon(comp.toneladas)}</p>
          {esPaladas && tonReal != null && (
            <p className="text-xs text-gray-400">real registrado: {fmtTon(tonReal)}</p>
          )}
          {delta !== null && (
            <p className={`text-xs font-bold ${delta >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
              delta: {delta >= 0 ? '+' : ''}{delta.toFixed(2)} t
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-white border border-purple-200 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] text-gray-500 font-semibold">Ley Dump</p>
          <p className="text-lg font-bold text-gray-700">{fmt(comp.ley_dump_ajustada)}</p>
          <p className="text-[10px] text-gray-400">heredado de mezcla origen</p>
        </div>
        <span className="text-gray-300 font-bold text-xl">→</span>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] text-indigo-600 font-semibold">Ley Lote</p>
          <p className="text-xl font-bold text-indigo-700">{fmt(comp.ley_lote)}</p>
          <p className="text-[10px] text-indigo-400">heredado de mezcla origen</p>
        </div>
      </div>
    </div>
  );
}

// ─── SubComponente: chips + detalle (reemplaza tabla y grid) ─────────────────

function TablaComponentes({ componentes }) {
  const [selIdx, setSelIdx] = useState(null);

  if (!componentes?.length) {
    return <p className="text-xs text-gray-400 italic px-3 pb-3">Sin componentes registrados.</p>;
  }

  const dumps   = componentes.filter(c => c.tipo === 'DUMP');
  const rems    = componentes.filter(c => c.tipo === 'REM');
  const allComps = [...dumps, ...rems];
  const selComp  = selIdx != null ? allComps[selIdx] : null;

  return (
    <div className="p-3 space-y-3">
      {/* ── Línea de chips horizontal ── */}
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {dumps.map((comp, idx) => (
          <DumpadaChip
            key={idx}
            comp={comp}
            isSelected={selIdx === idx}
            onClick={() => setSelIdx(selIdx === idx ? null : idx)}
          />
        ))}
        {rems.map((comp, idx) => {
          const remIdx   = dumps.length + idx;
          const isSelected = selIdx === remIdx;
          return (
            <button
              key={remIdx}
              onClick={() => setSelIdx(isSelected ? null : remIdx)}
              className={`flex-shrink-0 rounded-xl px-3 py-2 border-2 transition-all text-left min-w-[88px] ${
                isSelected
                  ? 'border-purple-500 bg-purple-100 shadow-md ring-2 ring-purple-200'
                  : 'border-purple-200 bg-purple-50/60 hover:border-purple-400'
              }`}
            >
              <div className="text-[10px] font-bold text-purple-600">REM</div>
              <div className="text-[10px] text-purple-500 mt-0.5 max-w-[80px] truncate">
                {comp.origen?.replace('Remanente de ', '') || '—'}
              </div>
              <div className="text-[11px] font-bold text-indigo-600 mt-1">{fmtTon(comp.toneladas)}</div>
            </button>
          );
        })}
      </div>

      {/* ── Hint / panel de detalle ── */}
      {selComp ? (
        selComp.tipo === 'DUMP'
          ? <DumpadaDetalle comp={selComp} />
          : <RemDetalle comp={selComp} />
      ) : (
        <p className="text-[11px] text-gray-300 text-center py-2 select-none">
          ← Toca una dumpada para ver su detalle →
        </p>
      )}
    </div>
  );
}


// ─── SubComponente: bloque de una mezcla ─────────────────────────────────────

function MezclaBloque({ mezcla, open, onToggle }) {
  return (
    <div className="border border-purple-100 rounded-xl overflow-hidden mb-2">
      {/* Header mezcla */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <HiBeaker className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="font-bold text-purple-800 text-sm">{mezcla.codigo}</span>
          {mezcla.es_remanente && (
            <span className="text-[10px] font-bold bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full flex-shrink-0">REM</span>
          )}
          <span className="text-xs text-purple-500">{fmtTon(mezcla.toneladas_pivot)} aportadas</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {mezcla.ley_prom_lote != null && (
            <span className="text-xs font-bold text-indigo-600">
              ley lote {parseFloat(mezcla.ley_prom_lote).toFixed(3)}%
            </span>
          )}
          {mezcla.ley_lab != null && (
            <span className="text-xs text-gray-400">
              lab {parseFloat(mezcla.ley_lab).toFixed(3)}%
            </span>
          )}
          {open ? (
            <HiChevronDown className="w-4 h-4 text-purple-400" />
          ) : (
            <HiChevronRight className="w-4 h-4 text-purple-400" />
          )}
        </div>
      </button>

      {/* Cuerpo con componentes */}
      {open && (
        <div className="border-t border-purple-100 bg-white">
          <TablaComponentes componentes={mezcla.componentes} />
        </div>
      )}
    </div>
  );
}

// ─── SubComponente: fila de camionada ────────────────────────────────────────

function CamionadaBloque({ camionada, openMezclas, onToggleCamionada, onToggleMezcla, isOpen }) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden mb-3">
      {/* Header camionada */}
      <button
        onClick={onToggleCamionada}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <HiTruck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div>
            <span className="font-bold text-indigo-800 text-sm">Cam. {camionada.numero_camionada}</span>
            <span className="mx-2 text-indigo-300">—</span>
            <span className="font-mono font-semibold text-gray-700 text-sm">{camionada.patente ?? '—'}</span>
          </div>
          {camionada.estado && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${estadoBadge(camionada.estado)}`}>
              {camionada.estado}
            </span>
          )}
        </div>
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">
              {fmtTon(camionada.peso)}
              {camionada.peso_real != null && (
                <> <span className="text-gray-300">/</span> <span className="text-emerald-600 font-semibold">{fmtTon(camionada.peso_real)} real</span></>
              )}
            </p>
          </div>
          {camionada.ley_mezcla != null && (
            <span className="text-xs font-bold text-indigo-600">{parseFloat(camionada.ley_mezcla).toFixed(3)}%</span>
          )}
          {isOpen ? (
            <HiChevronDown className="w-4 h-4 text-indigo-400" />
          ) : (
            <HiChevronRight className="w-4 h-4 text-indigo-400" />
          )}
        </div>
      </button>

      {/* Cuerpo con mezclas */}
      {isOpen && (
        <div className="border-t border-indigo-100 bg-white p-3 space-y-1">
          {camionada.mezclas?.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">Sin mezclas asociadas.</p>
          ) : (
            camionada.mezclas.map((mezcla) => (
              <MezclaBloque
                key={mezcla.id}
                mezcla={mezcla}
                open={openMezclas.has(`${camionada.id}-${mezcla.id}`)}
                onToggle={() => onToggleMezcla(`${camionada.id}-${mezcla.id}`)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────

export default function ReconstruccionLoteView() {
  const [busqueda, setBusqueda] = useState('');
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [reconstruccion, setReconstruccion] = useState(null);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [loadingArbol, setLoadingArbol] = useState(false);
  const [openCamionadas, setOpenCamionadas] = useState(new Set());
  const [openMezclas, setOpenMezclas] = useState(new Set());

  const debouncedBusqueda = useDebounce(busqueda, 400);

  // Cargar lotes cuando cambia la búsqueda
  useEffect(() => {
    buscarLotes(debouncedBusqueda);
  }, [debouncedBusqueda]);

  // Carga inicial
  useEffect(() => {
    buscarLotes('');
  }, []);

  const buscarLotes = async (term) => {
    setLoadingLotes(true);
    try {
      const res = await laboratorioService.getLotes({ search: term || '', per_page: 30 });
      const data = res?.data || res || [];
      setLotes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error buscando lotes:', e);
    } finally {
      setLoadingLotes(false);
    }
  };

  const seleccionarLote = async (lote) => {
    setLoadingArbol(true);
    setReconstruccion(null);
    setLoteSeleccionado(lote);
    setOpenCamionadas(new Set());
    setOpenMezclas(new Set());
    try {
      const data = await laboratorioService.getReconstruccionLote(lote.id);
      setReconstruccion(data);
      // Abrir todas las camionadas por defecto
      setOpenCamionadas(new Set(data.camionadas.map((c) => c.id)));
    } catch (e) {
      console.error('Error cargando reconstrucción:', e);
    } finally {
      setLoadingArbol(false);
    }
  };

  const toggleCamionada = (id) => {
    setOpenCamionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMezcla = (key) => {
    setOpenMezclas((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const expandirTodo = () => {
    if (!reconstruccion) return;
    setOpenCamionadas(new Set(reconstruccion.camionadas.map((c) => c.id)));
    const keys = new Set();
    reconstruccion.camionadas.forEach((c) =>
      c.mezclas.forEach((m) => keys.add(`${c.id}-${m.id}`))
    );
    setOpenMezclas(keys);
  };

  const colapsarTodo = () => {
    setOpenCamionadas(new Set());
    setOpenMezclas(new Set());
  };

  const lote = reconstruccion?.lote;

  return (
    <div className="space-y-5">

      {/* ── Buscador ── */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Seleccionar lote</p>
        <div className="relative">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número de lote, planta o empresa…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
          />
        </div>

        {/* Lista de lotes */}
        <div className="mt-3 max-h-52 overflow-y-auto divide-y divide-gray-100">
          {loadingLotes ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full" />
            </div>
          ) : lotes.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-4">Sin lotes encontrados.</p>
          ) : (
            lotes.map((l) => {
              const seleccionado = loteSeleccionado?.id === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => seleccionarLote(l)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-amber-50 transition-colors ${
                    seleccionado ? 'bg-amber-50 border-l-2 border-amber-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-gray-800 text-sm">
                      {l.numero_lote || `Lote #${l.id}`}
                    </span>
                    {l.planta?.nombre && (
                      <span className="text-xs text-gray-500 truncate">{l.planta.nombre}</span>
                    )}
                    {l.empresa?.nombre && (
                      <span className="text-xs text-gray-400 truncate hidden sm:block">· {l.empresa.nombre}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      l.estado === 'Abierto' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {l.estado}
                    </span>
                    {seleccionado && <HiCheckCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Estado de carga del árbol ── */}
      {loadingArbol && (
        <div className="flex items-center justify-center py-10">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">Construyendo árbol de trazabilidad…</p>
          </div>
        </div>
      )}

      {/* ── Árbol de reconstrucción ── */}
      {reconstruccion && !loadingArbol && (
        <div>
          {/* Header del lote */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 mb-4">
            <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-500/10" />
            <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Reconstrucción del Lote</span>
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {lote.numero_lote || `Lote #${lote.id}`}
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {lote.planta?.nombre} · {lote.empresa?.nombre}
                  {lote.fecha_creacion && (
                    <> · {new Date(lote.fecha_creacion + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-0 flex-shrink-0 bg-white/5 rounded-2xl border border-white/10 divide-x divide-white/10 overflow-hidden">
                <div className="px-5 py-3 text-center">
                  <p className="text-xl font-bold text-white tabular-nums">{lote.numero_camionadas ?? '—'}</p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">camionadas</p>
                </div>
                <div className="px-5 py-3 text-center">
                  <p className="text-xl font-bold text-amber-400 tabular-nums">
                    {lote.peso_total != null ? parseFloat(lote.peso_total).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                  </p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">ton despacho</p>
                </div>
                {lote.peso_recibido != null && (
                  <div className="px-5 py-3 text-center">
                    <p className="text-xl font-bold text-emerald-400 tabular-nums">
                      {parseFloat(lote.peso_recibido).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </p>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">ton real</p>
                  </div>
                )}
                {lote.ley_lote_promedio != null && (
                  <div className="px-5 py-3 text-center">
                    <p className="text-xl font-bold text-indigo-300 tabular-nums">
                      {parseFloat(lote.ley_lote_promedio).toFixed(3)}%
                    </p>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">ley lote</p>
                  </div>
                )}
                {lote.ley_lab_promedio != null && (
                  <div className="px-5 py-3 text-center">
                    <p className="text-xl font-bold text-green-300 tabular-nums">
                      {parseFloat(lote.ley_lab_promedio).toFixed(3)}%
                    </p>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">ley lab</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra de acciones */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium">
              {reconstruccion.camionadas.length} camionada{reconstruccion.camionadas.length !== 1 ? 's' : ''} · haz clic para expandir
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={expandirTodo}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-amber-300 transition-colors"
              >
                <HiArrowsPointingOut className="w-3.5 h-3.5" />
                Expandir todo
              </button>
              <button
                onClick={colapsarTodo}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-amber-300 transition-colors"
              >
                <HiArrowsPointingIn className="w-3.5 h-3.5" />
                Colapsar todo
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs text-white bg-amber-500 hover:bg-amber-600 rounded-lg px-3 py-1.5 transition-colors"
              >
                <HiPrinter className="w-3.5 h-3.5" />
                Imprimir
              </button>
            </div>
          </div>

          {/* Leyenda de columnas */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] text-gray-400">
            <span><span className="font-bold text-amber-500">★ Cu Ins / Cu Sol</span> — fracción del cert. de laboratorio con mayor ley (la usada en el cálculo)</span>
            <span><span className="font-bold text-gray-500">Ley dump</span> = fracción ★ × 0.9 — descuento operacional del 10%</span>
            <span><span className="font-bold text-indigo-600">Ley lote</span> = fracción ★ × 0.81 — descuento total del 19% (base de venta)</span>
            <span><span className="font-bold text-yellow-600">Visual ref.</span> — estimación en terreno, sin descuento, solo referencial</span>
            <span><span className="font-bold text-purple-600">REM</span> — remanente de otra mezcla; hereda sus leyes ya ajustadas</span>
            <span><span className="font-bold text-green-600">Lab</span> / <span className="font-bold text-yellow-600">Visual</span> — indica si la ley viene de laboratorio o estimación visual</span>
          </div>

          {/* Árbol de camionadas */}
          <div>
            {reconstruccion.camionadas.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
                <HiTruck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Este lote no tiene camionadas registradas.</p>
              </div>
            ) : (
              reconstruccion.camionadas.map((cam) => (
                <CamionadaBloque
                  key={cam.id}
                  camionada={cam}
                  isOpen={openCamionadas.has(cam.id)}
                  openMezclas={openMezclas}
                  onToggleCamionada={() => toggleCamionada(cam.id)}
                  onToggleMezcla={toggleMezcla}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Placeholder cuando no hay lote seleccionado */}
      {!reconstruccion && !loadingArbol && !loteSeleccionado && (
        <div className="bg-white rounded-xl border border-dashed border-amber-200 p-12 text-center">
          <HiArrowPath className="w-10 h-10 text-amber-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Selecciona un lote para ver su reconstrucción</p>
          <p className="text-gray-400 text-sm mt-1">Verás el árbol completo: camionadas → mezclas → dumpadas con todas las fórmulas de ley aplicadas.</p>
        </div>
      )}

    </div>
  );
}
