import { useState, useEffect } from 'react';
import { HiMagnifyingGlass, HiCheckCircle, HiChevronDown, HiChevronRight, HiXMark } from 'react-icons/hi2';
import gerencialService from '../../services/gerencialService';
import useDebounce from '../../../../hooks/useDebounce';
import { FAENA_COLORS, DEFAULT_FAENA_COLORS } from '../../../../contexts/faenaColor';

const fmtTon = (v) => v != null
  ? parseFloat(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t'
  : '—';
const fmtLey = (v, d = 3) => v != null ? parseFloat(v).toFixed(d) + '%' : '—';

// ── Fila Camionada ────────────────────────────────────────────────────
function FilaCamionada({ cam, open, onToggle, tieneHijos }) {
  const fecha = cam.fecha
    ? new Date(cam.fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—';

  return (
    <button
      onClick={tieneHijos ? onToggle : undefined}
      className={`w-full flex items-center gap-3 px-4 py-2.5 bg-white border-l-4 border-blue-500 transition-colors text-left ${tieneHijos ? 'hover:bg-blue-50/40 cursor-pointer' : 'cursor-default'}`}
    >
      {tieneHijos
        ? (open ? <HiChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <HiChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />)
        : <span className="w-3.5 flex-shrink-0" />
      }
      <span className="text-blue-400 text-base flex-shrink-0">🚛</span>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-blue-900 text-sm">Camionada {cam.numero_camionada}</span>
        {cam.patente && <span className="ml-2 font-mono text-gray-500 text-xs">{cam.patente}</span>}
      </div>
      <span className="text-gray-400 text-xs hidden sm:block w-16 text-right">{fecha}</span>
      <span className="text-gray-700 text-sm font-semibold w-24 text-right">{fmtTon(cam.peso)}</span>
      <span className="text-blue-700 font-bold text-sm w-20 text-right">{fmtLey(cam.ley_mezcla)}</span>
    </button>
  );
}

// ── Fila Mezcla ───────────────────────────────────────────────────────
function FilaMezcla({ mezcla, open, onToggle, tieneHijos }) {
  return (
    <button
      onClick={tieneHijos ? onToggle : undefined}
      className={`w-full flex items-center gap-3 pl-8 pr-4 py-2 bg-purple-50/50 border-l-4 border-purple-400 transition-colors text-left ${tieneHijos ? 'hover:bg-purple-50 cursor-pointer' : 'cursor-default'}`}
    >
      {tieneHijos
        ? (open ? <HiChevronDown className="w-3 h-3 text-purple-400 flex-shrink-0" /> : <HiChevronRight className="w-3 h-3 text-purple-400 flex-shrink-0" />)
        : <span className="w-3 flex-shrink-0" />
      }
      <span className="text-purple-400 text-sm flex-shrink-0">🧪</span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-semibold text-purple-900 text-sm">{mezcla.codigo}</span>
        {mezcla.es_remanente && (
          <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">REM</span>
        )}
      </div>
      <span className="text-gray-400 text-xs hidden sm:block w-16 text-right">
        {mezcla.es_remanente ? 'remanente' : 'aportadas'}
      </span>
      <span className="text-gray-600 text-sm w-24 text-right">{fmtTon(mezcla.toneladas_pivot)}</span>
      <span className="text-purple-700 font-semibold text-sm w-20 text-right">{fmtLey(mezcla.ley_prom_lote)}</span>
    </button>
  );
}

// ── Fila Dumpada ──────────────────────────────────────────────────────
function FilaDumpada({ comp }) {
  const ley = comp.ley_lote ?? comp.ley_visual_mezcla ?? comp.ley_visual ?? null;
  const tieneLab = comp.tiene_lab;

  return (
    <div className="flex items-center gap-3 pl-16 pr-4 py-1.5 bg-white border-l-4 border-emerald-300 hover:bg-emerald-50/30 transition-colors">
      <span className="w-3 flex-shrink-0" />
      <span className="text-emerald-400 text-xs flex-shrink-0">🪨</span>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-gray-700 text-xs font-semibold">#{comp.numero_dumpada ?? '—'}</span>
        {comp.frente && <span className="ml-2 text-gray-400 text-xs truncate hidden sm:inline">{comp.frente}</span>}
      </div>
      <span className="text-gray-400 text-xs hidden sm:block w-16 text-right">{comp.jornada ?? '—'}</span>
      <span className="text-gray-600 text-xs w-24 text-right">{fmtTon(comp.toneladas)}</span>
      <div className="flex items-center justify-end gap-1 w-20">
        <span className={`text-xs font-semibold ${tieneLab ? 'text-emerald-700' : 'text-amber-600'}`}>
          {fmtLey(ley)}
        </span>
        <span className={`text-[9px] px-1 rounded font-bold ${tieneLab ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          {tieneLab ? 'lab' : 'vis'}
        </span>
      </div>
    </div>
  );
}

// ── Fila Remanente ────────────────────────────────────────────────────
function FilaRem({ comp }) {
  return (
    <div className="flex items-center gap-3 pl-16 pr-4 py-1.5 bg-white border-l-4 border-violet-300 hover:bg-violet-50/30 transition-colors">
      <span className="w-3 flex-shrink-0" />
      <span className="text-violet-400 text-xs flex-shrink-0">♻️</span>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-[10px] text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded mr-2">REM</span>
        <span className="text-gray-500 text-xs truncate">{comp.origen || '—'}</span>
      </div>
      <span className="text-gray-400 text-xs hidden sm:block w-16 text-right">—</span>
      <span className="text-gray-600 text-xs w-24 text-right">{fmtTon(comp.toneladas)}</span>
      <span className="text-violet-700 text-xs font-semibold w-20 text-right">{fmtLey(comp.ley_dump_ajustada)}</span>
    </div>
  );
}

// ── Árbol principal ───────────────────────────────────────────────────
function ArbolLote({ reconstruccion }) {
  const lote = reconstruccion.lote;
  const camionadas = reconstruccion.camionadas;

  const [openCams, setOpenCams] = useState(() => new Set(camionadas.map(c => c.id)));
  const [openMezclas, setOpenMezclas] = useState(new Set());

  const toggleCam = (id) => setOpenCams(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleMezcla = (k) => setOpenMezclas(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const expandirTodo = () => {
    setOpenCams(new Set(camionadas.map(c => c.id)));
    const keys = new Set();
    camionadas.forEach(c => c.mezclas?.forEach(m => keys.add(`${c.id}-${m.id}`)));
    setOpenMezclas(keys);
  };
  const colapsarTodo = () => { setOpenCams(new Set()); setOpenMezclas(new Set()); };

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header del lote */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Lote</p>
            <h2 className="text-white font-bold text-xl">{lote.numero_lote || `#${lote.id}`}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {[lote.empresa?.nombre, lote.planta?.nombre].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex gap-px rounded-xl overflow-hidden border border-white/10">
            {[
              { label: 'camionadas', value: lote.numero_camionadas },
              { label: 'despacho', value: lote.peso_total != null ? fmtTon(lote.peso_total) : '—' },
              lote.peso_recibido != null && { label: 'recibido', value: fmtTon(lote.peso_recibido), color: 'text-emerald-300' },
              lote.ley_lote_promedio != null && { label: 'ley lote', value: fmtLey(lote.ley_lote_promedio), color: 'text-indigo-300' },
              lote.ley_lab_promedio != null && { label: 'ley lab', value: fmtLey(lote.ley_lab_promedio), color: 'text-green-300' },
            ].filter(Boolean).map((kpi, i) => (
              <div key={i} className="px-4 py-2.5 text-center bg-white/5">
                <p className={`text-base font-bold ${kpi.color ?? 'text-amber-300'}`}>{kpi.value}</p>
                <p className="text-slate-500 text-[9px] uppercase tracking-widest mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cabecera de columnas + controles */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50 border-b border-gray-200">
        <div className="flex-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</div>
        <span className="hidden sm:block w-16 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha / Info</span>
        <span className="w-24 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tonelaje</span>
        <span className="w-20 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ley Cu</span>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={expandirTodo} className="text-[10px] text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">+ todo</button>
          <button onClick={colapsarTodo} className="text-[10px] text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">− todo</button>
        </div>
      </div>

      {/* Filas */}
      {camionadas.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">Sin camionadas registradas.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {camionadas.map((cam) => {
            const camOpen = openCams.has(cam.id);
            return (
              <div key={cam.id}>
                <FilaCamionada
                  cam={cam}
                  open={camOpen}
                  onToggle={() => toggleCam(cam.id)}
                  tieneHijos={cam.mezclas?.length > 0}
                />
                {camOpen && cam.mezclas?.map((mezcla) => {
                  const key = `${cam.id}-${mezcla.id}`;
                  const mOpen = openMezclas.has(key);
                  return (
                    <div key={mezcla.id} className="border-t border-gray-50">
                      <FilaMezcla
                        mezcla={mezcla}
                        open={mOpen}
                        onToggle={() => toggleMezcla(key)}
                        tieneHijos={mezcla.componentes?.length > 0}
                      />
                      {mOpen && mezcla.componentes?.map((comp, i) =>
                        comp.tipo === 'DUMP'
                          ? <FilaDumpada key={i} comp={comp} />
                          : <FilaRem key={i} comp={comp} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Camionada</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-400 inline-block" />Mezcla</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-300 inline-block" />Dumpada</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-300 inline-block" />Remanente</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-600 px-1.5 rounded font-bold">lab</span> laboratorio
          <span className="bg-amber-100 text-amber-600 px-1.5 rounded font-bold">vis</span> visual
        </span>
      </div>
    </div>
  );
}

const FILTROS_INIT = { estado: '', id_faena: '', planta_id: '', empresa_id: '', fecha_desde: '', fecha_hasta: '' };

// ── Componente principal ──────────────────────────────────────────────
export default function ReconstruccionLote() {
  const [busqueda, setBusqueda]           = useState('');
  const [filtros, setFiltros]             = useState(FILTROS_INIT);
  const [lotes, setLotes]                 = useState([]);
  const [loadingLotes, setLoadingLotes]   = useState(false);
  const [plantas, setPlantas]             = useState([]);
  const [empresas, setEmpresas]           = useState([]);
  const [faenas, setFaenas]               = useState([]);
  const [reconstruccion, setReconstruccion] = useState(null);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [loadingArbol, setLoadingArbol]   = useState(false);

  const debouncedBusqueda = useDebounce(busqueda, 400);

  // Cargar catálogos al montar
  useEffect(() => {
    gerencialService.getPlantas().then(r => setPlantas(r?.data ?? [])).catch(() => {});
    gerencialService.getEmpresas().then(r => setEmpresas(r?.data ?? [])).catch(() => {});
    gerencialService.getFaenas().then(r => {
      const ids = Array.isArray(r) ? r : (r?.data ?? []);
      setFaenas(ids.filter(Boolean).map(id => FAENA_COLORS[id] ?? { ...DEFAULT_FAENA_COLORS, id }));
    }).catch(() => {});
  }, []);

  // Re-buscar cuando cambia búsqueda o filtros
  useEffect(() => { buscarLotes(); }, [debouncedBusqueda, filtros]);

  const buscarLotes = async () => {
    setLoadingLotes(true);
    try {
      const params = { search: debouncedBusqueda || '', per_page: 50 };
      if (filtros.estado)     params.estado     = filtros.estado;
      if (filtros.id_faena)   params.id_faena   = filtros.id_faena;
      if (filtros.planta_id)  params.planta_id  = filtros.planta_id;
      if (filtros.empresa_id) params.empresa_id = filtros.empresa_id;
      if (filtros.fecha_desde) params.fecha_desde = filtros.fecha_desde;
      if (filtros.fecha_hasta) params.fecha_hasta = filtros.fecha_hasta;
      const res = await gerencialService.getLotes(params);
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      setLotes(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Error buscando lotes:', e); }
    finally { setLoadingLotes(false); }
  };

  const setFiltro = (key, val) => setFiltros(prev => ({ ...prev, [key]: val }));

  const limpiarFiltros = () => { setFiltros(FILTROS_INIT); setBusqueda(''); };

  const hayFiltrosActivos = busqueda || Object.values(filtros).some(v => v !== '');

  const seleccionarLote = async (lote) => {
    setLoadingArbol(true);
    setReconstruccion(null);
    setLoteSeleccionado(lote);
    try {
      const data = await gerencialService.getReconstruccionLote(lote.id);
      setReconstruccion(data);
    } catch (e) { console.error('Error cargando reconstrucción:', e); }
    finally { setLoadingArbol(false); }
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Panel de búsqueda y filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">

        {/* Barra de búsqueda */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Número de lote, planta o empresa…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {hayFiltrosActivos && (
            <button onClick={limpiarFiltros} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-2">
              <HiXMark className="w-4 h-4" /> Limpiar
            </button>
          )}
        </div>

        {/* Filtros siempre visibles */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-4">

            {/* Estado */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Estado</p>
              <div className="flex gap-2 flex-wrap">
                {[{ value: '', label: 'Todos' }, { value: 'Abierto', label: 'Abierto' }, { value: 'Completado', label: 'Completado' }].map(op => (
                  <button key={op.value} onClick={() => setFiltro('estado', op.value)}
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${filtros.estado === op.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Faena */}
            {faenas.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Faena</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setFiltro('id_faena', '')}
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${!filtros.id_faena ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    Todas
                  </button>
                  {faenas.map(f => {
                    const activa = filtros.id_faena === String(f.id);
                    return (
                      <button key={f.id} onClick={() => setFiltro('id_faena', activa ? '' : String(f.id))}
                        className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors border ${activa ? 'text-white' : 'bg-white text-gray-600 hover:border-blue-300'}`}
                        style={activa ? { backgroundColor: f.primary ?? '#2563eb', borderColor: f.primary ?? '#2563eb' } : { borderColor: f.primary ?? '#e5e7eb' }}>
                        {f.emoji ?? ''} {f.name ?? `Faena ${f.id}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Planta y Empresa en grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Planta</p>
                <select value={filtros.planta_id} onChange={e => setFiltro('planta_id', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                  <option value="">Todas las plantas</option>
                  {plantas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Empresa (padrón)</p>
                <select value={filtros.empresa_id} onChange={e => setFiltro('empresa_id', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                  <option value="">Todas las empresas</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Fecha desde</p>
                <input type="date" value={filtros.fecha_desde} onChange={e => setFiltro('fecha_desde', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Fecha hasta</p>
                <input type="date" value={filtros.fecha_hasta} onChange={e => setFiltro('fecha_hasta', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white" />
              </div>
            </div>
          </div>

        {/* Lista de lotes */}
        <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
          {loadingLotes ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
            </div>
          ) : lotes.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">Sin lotes encontrados.</p>
          ) : lotes.map(l => {
            const sel = loteSeleccionado?.id === l.id;
            const faenaColor = FAENA_COLORS[l.id_faena];
            return (
              <button key={l.id} onClick={() => seleccionarLote(l)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${sel ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {faenaColor?.emoji && <span className="text-sm">{faenaColor.emoji}</span>}
                  <span className="font-mono font-bold text-gray-800 text-sm">{l.numero_lote || `#${l.id}`}</span>
                  {l.planta?.nombre && <span className="text-xs text-gray-500 truncate">{l.planta.nombre}</span>}
                  {l.empresa?.nombre && <span className="text-xs text-gray-400 hidden sm:block truncate">· {l.empresa.nombre}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {l.fecha_creacion && (
                    <span className="text-[10px] text-gray-400 hidden sm:block">
                      {new Date(l.fecha_creacion).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.estado === 'Abierto' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {l.estado}
                  </span>
                  {sel && <HiCheckCircle className="w-4 h-4 text-blue-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cargando árbol */}
      {loadingArbol && (
        <div className="flex items-center justify-center py-10">
          <div className="text-center">
            <div className="animate-spin w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando trazabilidad…</p>
          </div>
        </div>
      )}

      {/* Árbol del lote */}
      {reconstruccion && !loadingArbol && (
        <ArbolLote reconstruccion={reconstruccion} />
      )}

      {/* Estado inicial */}
      {!reconstruccion && !loadingArbol && !loteSeleccionado && (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center bg-white">
          <p className="text-2xl mb-2">📦</p>
          <p className="text-gray-500 font-semibold">Selecciona un lote para ver su trazabilidad</p>
          <p className="text-gray-400 text-sm mt-1">Camionadas → Mezclas → Dumpadas</p>
        </div>
      )}
    </div>
  );
}
