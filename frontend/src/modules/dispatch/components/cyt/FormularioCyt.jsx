import { useEffect, useMemo, useRef, useState } from 'react';
import { HiChevronDown, HiPencil } from 'react-icons/hi';
import cytService from '../../services/cyt';
import useToast from '../../../../hooks/useToast';
import useJornadas from '../../../../hooks/useJornadas';
import SearchableSelect from '../../../../shared/components/atoms/SearchableSelect';

/*
 * Report CyT como planilla: una lista de llegadas de dumper a la pala, en orden de
 * hora, con scroll propio (la página no crece aunque haya 100 llegadas). Se ingresa
 * y se corrige desde un solo panel al pie de la lista: hora + dumper + Enter; sector,
 * pala, operador de pala y paladas se arrastran de la llegada anterior, y el operador
 * del dumper se sugiere (el último que lo manejó en la hoja) pero se puede cambiar.
 *
 * PC: tabla completa + dumpers a la derecha. Tablet: se esconden columnas
 * secundarias y los dumpers pasan abajo. Celular: cada llegada en 2 líneas.
 */

// Mismos umbrales que Ciclos del Dumper.
const MIN_VALIDO = 5;
const CORTE = 60;
const ESTADOS = ['Operativo', 'Mantención', 'Falla', 'Sin operador', 'Otro'];
const COLORES_SECTOR = ['#2a78d6', '#eb6834', '#1baf7a', '#8b5cf6', '#eda100', '#0e9f8e', '#d6336c'];

let uid = 1;
const conId = (f) => ({ ...f, _id: uid++ });
const PANEL_VACIO = {
  hora_llegada: '', nombre_dumper: '', id_dumper: null, nombre_operador_dumper: '', id_operador_dumper: null,
  tiempo_carguio: '', paladas: 2, id_frente_trabajo: '', frente: null, nombre_pala: '', id_pala: null,
  nombre_operador_pala: '', id_operador_pala: null,
};

const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const horaActual = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const aMin = (h) => (/^\d{1,2}:\d{2}$/.test(h || '') ? Number(h.slice(0, -3)) * 60 + Number(h.slice(-2)) : null);
const mediana = (vals) => {
  const v = [...vals].sort((a, b) => a - b); const n = v.length;
  return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : null;
};
const fmt = (v, d = 1) => (v == null ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }));
const corto = (dumper) => (dumper || '').replace(/^DUMPER\s*/i, 'D');
// Orden por hora; antes de las 06:00 cuenta como fin de la jornada (Noche/Madrugada cruzan la medianoche).
const minOrden = (h) => { const m = aMin(h); return m == null ? 1e9 : m < 360 ? m + 1440 : m; };

function calcularCiclos(filas) {
  const porDumper = {};
  filas.forEach((f) => { if (f.nombre_dumper && aMin(f.hora_llegada) != null) (porDumper[f.nombre_dumper] ||= []).push(f); });
  const ciclo = {};
  Object.values(porDumper).forEach((vs) => {
    vs.sort((a, b) => minOrden(a.hora_llegada) - minOrden(b.hora_llegada));
    vs.forEach((f, i) => {
      if (i === 0) { ciclo[f._id] = { tipo: 'primera' }; return; }
      const g = minOrden(f.hora_llegada) - minOrden(vs[i - 1].hora_llegada);
      ciclo[f._id] = { g, tipo: g < MIN_VALIDO ? 'revisar' : g > CORTE ? 'detencion' : 'ciclo' };
    });
  });
  return { ciclo, porDumper };
}

function PillCiclo({ c }) {
  const base = 'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold';
  if (!c) return null;
  if (c.tipo === 'primera') return <span className={`${base} bg-gray-100 text-gray-500`}>primera</span>;
  if (c.tipo === 'ciclo') return <span className={`${base} bg-emerald-50 text-emerald-700`}>{c.g} min</span>;
  if (c.tipo === 'detencion') return <span className={`${base} bg-amber-50 text-amber-700`}>detención {c.g} min</span>;
  return <span className={`${base} bg-red-50 text-red-700`} title="Menos de 5 min desde la llegada anterior del mismo dumper: revisa la hora">revisar {c.g} min</span>;
}

// Opciones para SearchableSelect; conserva un valor guardado aunque ya no esté en la lista.
const opcionesDe = (lista, valor) => [...lista, ...(valor && !lista.includes(valor) ? [valor] : [])].map((x) => ({ value: x, label: x }));

const campo = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-teal-600 focus:ring-1 focus:ring-teal-600';
const etiqueta = 'mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';

export default function FormularioCyt({
  idFaena, nombreFaena, puedeCambiarFaena, onCambiarFaena,
  fecha, setFecha, jornada, setJornada,
  catalogos, operadoresPala, onPedirAutorizarPala, onGuardado,
}) {
  const toast = useToast();
  const { nombres: jornadas } = useJornadas('cyt');
  const [filas, setFilas] = useState([]);
  const [estados, setEstados] = useState({});
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [sucio, setSucio] = useState(false);
  // Panel limpio para una llegada nueva. En la hoja de hoy parte con la hora actual;
  // en una fecha pasada (digitando desde el papel) queda vacía, para no guardar la hora
  // de hoy por descuido.
  const panelNuevo = (base = {}) => ({ ...PANEL_VACIO, ...base, hora_llegada: fecha === hoyIso() ? horaActual() : '', _horaAuto: fecha === hoyIso() });
  const [panel, setPanel] = useState(() => panelNuevo());

  // Mientras nadie la toque, la hora sugerida sigue al reloj (si no, quedaría la de
  // la llegada anterior).
  useEffect(() => {
    const t = setInterval(() => {
      setPanel((p) => (p._horaAuto && p.hora_llegada !== horaActual() ? { ...p, hora_llegada: horaActual() } : p));
    }, 20000);
    return () => clearInterval(t);
  }, []);
  const [editId, setEditId] = useState(null);
  const [verPunto, setVerPunto] = useState(false); // celular: sector/pala/operador desplegados
  const [filtroDumper, setFiltroDumper] = useState('');
  const [filtroSector, setFiltroSector] = useState('');
  const [verDumpers, setVerDumpers] = useState(false);
  const ultimaClave = useRef(null);
  const lista = useRef(null);
  const irArriba = useRef(false);

  const { frentes, palas, dumpers, operadoresDumper, pesoPalada, petroleoSinPalas, reintentarMaquinas } = catalogos;
  const [reintentando, setReintentando] = useState(false);
  const nombresPalas = palas.map((p) => p.nombre);
  const nombresDumpers = dumpers.map((d) => d.nombre);
  const nombresOpPala = operadoresPala.map((o) => o.nombre);
  const nombresOpDumper = operadoresDumper.map((o) => o.nombre);
  const nombreFrente = (id, guardado) => frentes.find((f) => f.id === id)?.codigo_completo || guardado || (id ? `Frente ${id}` : '');

  useEffect(() => { if (!jornada && jornadas.length) setJornada(jornadas[0]); }, [jornada, jornadas, setJornada]);

  // Cada faena + fecha + jornada es una hoja: si ya existe, se abre esa.
  useEffect(() => {
    if (!idFaena || !fecha || !jornada) return;
    const clave = `${idFaena}|${fecha}|${jornada}`;
    if (ultimaClave.current === clave) return;
    ultimaClave.current = clave;
    setCargando(true);
    cytService.buscar(idFaena, fecha, jornada)
      .then((r) => {
        const d = r.data;
        const cargadas = (d?.cargas || []).map((c) => conId({
          ...c,
          id_frente_trabajo: c.id_frente_trabajo ?? '', hora_llegada: c.hora_llegada || '', tiempo_carguio: c.tiempo_carguio ?? '', paladas: c.paladas ?? '',
          nombre_pala: c.nombre_pala || '', nombre_dumper: c.nombre_dumper || '', nombre_operador_pala: c.nombre_operador_pala || '', nombre_operador_dumper: c.nombre_operador_dumper || '',
        }));
        setFilas(cargadas);
        setEstados(d ? Object.fromEntries(d.dumpers.map((x) => [x.nombre_dumper, { id_dumper: x.id_dumper, estado: x.estado, horas_fuera: x.horas_fuera ?? '', motivo: x.motivo || '' }])) : {});
        setReporte(d ? { id: d.id, estado: d.estado, supervisor_nombre: d.supervisor_nombre } : null);
        const u = cargadas[cargadas.length - 1];
        setPanel(panelNuevo(u ? arrastre(u) : {}));
        setEditId(null);
        setSucio(false);
        irArriba.current = true;
      })
      .catch(() => toast.error('No se pudo abrir el report de esa jornada'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFaena, fecha, jornada]);

  useEffect(() => {
    if (irArriba.current && lista.current) {
      lista.current.scrollTop = 0;
      irArriba.current = false;
    }
  });

  const ordenadas = useMemo(() => [...filas].sort((a, b) => minOrden(a.hora_llegada) - minOrden(b.hora_llegada)), [filas]);
  const { ciclo, porDumper } = useMemo(() => calcularCiclos(filas), [filas]);
  const coloresSector = useMemo(() => {
    const ids = [...new Set(ordenadas.map((f) => f.id_frente_trabajo).filter(Boolean))];
    return Object.fromEntries(ids.map((id, i) => [id, COLORES_SECTOR[i % COLORES_SECTOR.length]]));
  }, [ordenadas]);
  // La más reciente arriba, justo bajo el panel de ingreso (el # sigue el orden por hora).
  const visibles = [...ordenadas].reverse().filter((f) => (!filtroDumper || f.nombre_dumper === filtroDumper) && (!filtroSector || String(f.id_frente_trabajo) === filtroSector));

  // Lo que pasa de una llegada a la siguiente sin volver a elegirlo.
  function arrastre(f) {
    return {
      id_frente_trabajo: f.id_frente_trabajo, frente: f.frente, nombre_pala: f.nombre_pala, id_pala: f.id_pala,
      nombre_operador_pala: f.nombre_operador_pala, id_operador_pala: f.id_operador_pala, paladas: f.paladas === '' ? 2 : f.paladas,
    };
  }
  // Sugerencia: el último operador que manejó ese dumper en esta hoja.
  const operadorSugerido = (dumper) => {
    const previas = ordenadas.filter((f) => f.nombre_dumper === dumper && f.nombre_operador_dumper);
    const u = previas[previas.length - 1];
    return u ? { nombre_operador_dumper: u.nombre_operador_dumper, id_operador_dumper: u.id_operador_dumper } : { nombre_operador_dumper: '', id_operador_dumper: null };
  };

  const cambiarPanel = (cambios) => setPanel((p) => ({ ...p, ...cambios }));
  const elegirDumper = (nombre) => cambiarPanel({ nombre_dumper: nombre, id_dumper: dumpers.find((d) => d.nombre === nombre)?.id ?? null, ...(nombre ? operadorSugerido(nombre) : {}) });

  const faltaPunto = !panel.id_frente_trabajo || !panel.nombre_pala;
  const confirmarPanel = () => {
    if (!panel.hora_llegada) { document.getElementById('cyt-hora')?.focus(); return; }
    if (!panel.nombre_dumper) { document.getElementById('cyt-dumper')?.focus(); return; }
    if (faltaPunto) { setVerPunto(true); setTimeout(() => document.getElementById(!panel.id_frente_trabajo ? 'cyt-sector' : 'cyt-pala')?.focus(), 0); return; }
    const { _horaAuto, ...datos } = panel;
    if (editId) {
      setFilas((fs) => fs.map((f) => (f._id === editId ? { ...f, ...datos } : f)));
      setEditId(null);
      const u = ordenadas[ordenadas.length - 1];
      setPanel(panelNuevo(arrastre(u ? (u._id === editId ? datos : u) : datos)));
    } else {
      setFilas((fs) => [...fs, conId(datos)]);
      setPanel(panelNuevo(arrastre(datos)));
      irArriba.current = true;
    }
    setSucio(true);
    setTimeout(() => document.getElementById('cyt-hora')?.focus(), 0);
  };
  const editar = (f) => { setEditId(f._id); setPanel({ ...PANEL_VACIO, ...f, _horaAuto: false }); setTimeout(() => document.getElementById('cyt-hora')?.focus(), 0); };
  const cancelarEdicion = () => { setEditId(null); const u = ordenadas[ordenadas.length - 1]; setPanel(panelNuevo(u ? arrastre(u) : {})); };
  const eliminarFila = () => { setFilas((fs) => fs.filter((f) => f._id !== editId)); setSucio(true); cancelarEdicion(); };

  // Dumpers de la jornada = los que tienen llegadas + los agregados a mano.
  const listaDumpers = useMemo(() => {
    const nombres = new Set([...Object.keys(porDumper), ...Object.keys(estados)]);
    return [...nombres].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((n) => ({
      nombre_dumper: n, llegadas: porDumper[n] || [], id_dumper: dumpers.find((d) => d.nombre === n)?.id ?? null,
      estado: 'Operativo', horas_fuera: '', motivo: '', ...estados[n],
    }));
  }, [porDumper, estados, dumpers]);
  const cambiarEstado = (d, cambios) => {
    setEstados((e) => ({ ...e, [d.nombre_dumper]: { id_dumper: d.id_dumper, estado: d.estado, horas_fuera: d.horas_fuera, motivo: d.motivo, ...cambios } }));
    setSucio(true);
  };

  const guardar = async (estado) => {
    const cargas = ordenadas.map((f) => ({
      id_frente_trabajo: f.id_frente_trabajo || null, id_pala: f.id_pala, nombre_pala: f.nombre_pala || null,
      id_operador_pala: f.id_operador_pala, nombre_operador_pala: f.nombre_operador_pala || null,
      hora_llegada: f.hora_llegada || null,
      tiempo_carguio: f.tiempo_carguio === '' ? null : Number(f.tiempo_carguio),
      paladas: f.paladas === '' ? null : Number(f.paladas),
      id_dumper: f.id_dumper, nombre_dumper: f.nombre_dumper || null,
      id_operador_dumper: f.id_operador_dumper, nombre_operador_dumper: f.nombre_operador_dumper || null,
    }));
    const dumpersEstado = listaDumpers
      .filter((d) => d.llegadas.length || estados[d.nombre_dumper])
      .map((d) => ({ id_dumper: d.id_dumper, nombre_dumper: d.nombre_dumper, estado: d.estado, horas_fuera: d.horas_fuera === '' ? null : Number(d.horas_fuera), motivo: d.motivo || null }));

    setGuardando(true);
    try {
      const r = await cytService.guardar({ id_faena: idFaena, fecha, jornada, estado, cargas, dumpers: dumpersEstado });
      setReporte({ id: r.data.id, estado: r.data.estado, supervisor_nombre: r.data.supervisor_nombre });
      setSucio(false);
      toast.success(r.message);
      onGuardado?.();
    } catch (e) {
      toast.error('No se guardó el report', e.response?.data?.message || 'Revisa los datos e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarBorrador = async () => {
    if (!reporte?.id || !window.confirm('¿Eliminar este borrador? No se puede deshacer.')) return;
    try {
      await cytService.eliminar(reporte.id);
      toast.success('Borrador eliminado');
      setFilas([]); setEstados({}); setReporte(null); setPanel(panelNuevo()); setEditId(null); setSucio(false);
      onGuardado?.();
    } catch (e) {
      toast.error('No se pudo eliminar', e.response?.data?.message);
    }
  };

  const cambiarHoja = (fn) => {
    if (sucio && !window.confirm('Hay cambios sin guardar en esta hoja. ¿Cambiar de todas formas?')) return;
    fn();
  };

  const paladasTot = filas.reduce((s, f) => s + (Number(f.paladas) || 0), 0);
  const ciclos = Object.values(ciclo).filter((c) => c.tipo === 'ciclo').map((c) => c.g);
  const revisar = Object.values(ciclo).filter((c) => c.tipo === 'revisar').length;
  const dumpersLibres = nombresDumpers.filter((n) => !listaDumpers.some((d) => d.nombre_dumper === n));
  const sectoresUsados = [...new Set(ordenadas.map((f) => f.id_frente_trabajo).filter(Boolean))];
  // Frentes activos de la faena; los ya usados en esta hoja van primero.
  const opcionesSector = [
    ...sectoresUsados.map((id) => ({ value: id, label: nombreFrente(id) })),
    ...frentes.filter((f) => !sectoresUsados.includes(f.id)).map((f) => ({ value: f.id, label: f.codigo_completo })),
    ...(panel.id_frente_trabajo && !sectoresUsados.includes(panel.id_frente_trabajo) && !frentes.some((f) => f.id === panel.id_frente_trabajo)
      ? [{ value: panel.id_frente_trabajo, label: nombreFrente(panel.id_frente_trabajo, panel.frente) }] : []),
  ];

  const PanelDumpers = (
    <div className="divide-y divide-gray-100">
      {listaDumpers.map((d) => {
        const fuera = d.estado !== 'Operativo';
        const cs = d.llegadas.map((f) => ciclo[f._id]).filter((c) => c?.tipo === 'ciclo').map((c) => c.g);
        return (
          <div key={d.nombre_dumper} className={`flex flex-col gap-1.5 px-3 py-2.5 ${fuera ? 'bg-amber-50' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-sm text-gray-900">{d.nombre_dumper}</b>
              <span className="text-xs text-gray-500">{d.llegadas.length} lleg. · {cs.length ? `${fmt(mediana(cs))} min` : '—'}</span>
            </div>
            <div className="flex gap-1.5">
              <select aria-label={`Estado ${d.nombre_dumper}`} value={d.estado} onChange={(e) => cambiarEstado(d, { estado: e.target.value, ...(e.target.value === 'Operativo' ? { horas_fuera: '' } : {}) })} className={`${campo} py-1 text-[13px]`}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
              {!d.llegadas.length && (
                <button type="button" title="Quitar" onClick={() => { setEstados((e) => { const { [d.nombre_dumper]: _, ...r } = e; return r; }); setSucio(true); }} className="shrink-0 rounded px-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
              )}
            </div>
            {fuera && (
              <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-1.5">
                <input type="number" min="0" max="24" step="0.5" placeholder="horas" aria-label={`Horas fuera ${d.nombre_dumper}`} value={d.horas_fuera} onChange={(e) => cambiarEstado(d, { horas_fuera: e.target.value })} className={`${campo} py-1 text-[13px]`} />
                <input placeholder="Motivo" aria-label={`Motivo ${d.nombre_dumper}`} value={d.motivo} onChange={(e) => cambiarEstado(d, { motivo: e.target.value })} className={`${campo} py-1 text-[13px]`} />
              </div>
            )}
          </div>
        );
      })}
      <div className="px-3 py-2.5">
        <select aria-label="Agregar dumper que no operó" value="" onChange={(e) => { if (e.target.value) cambiarEstado({ nombre_dumper: e.target.value, id_dumper: dumpers.find((x) => x.nombre === e.target.value)?.id ?? null, estado: 'Sin operador', horas_fuera: '', motivo: '' }, {}); }} className={`${campo} py-1 text-[13px]`}>
          <option value="">+ Dumper que no operó</option>
          {dumpersLibres.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Encabezado de la hoja + números */}
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <label htmlFor="cyt-fecha" className="text-[11px] font-semibold uppercase text-gray-500">Fecha</label>
          <input id="cyt-fecha" type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => cambiarHoja(() => setFecha(e.target.value))} className={`${campo} w-auto py-1`} />
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor="cyt-jornada" className="text-[11px] font-semibold uppercase text-gray-500">Jornada</label>
          <select id="cyt-jornada" value={jornada} onChange={(e) => cambiarHoja(() => setJornada(e.target.value))} className={`${campo} w-auto py-1`}>
            {[...jornadas, ...(jornada && !jornadas.includes(jornada) ? [jornada] : [])].map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-teal-50 px-2.5 py-1 text-sm font-bold text-teal-800">{nombreFaena}</span>
          {puedeCambiarFaena && <button type="button" onClick={() => cambiarHoja(onCambiarFaena)} className="text-xs font-medium text-blue-600 underline">cambiar</button>}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cargando ? 'bg-gray-100 text-gray-500' : reporte?.estado === 'guardado' ? 'bg-emerald-50 text-emerald-700' : reporte ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
          {cargando ? 'Buscando…' : reporte?.estado === 'guardado' ? 'Guardado' : reporte ? 'Borrador' : 'Hoja nueva'}
        </span>
        <dl className="flex w-full flex-wrap gap-x-5 gap-y-1 sm:ml-auto sm:w-auto">
          {[
            ['Llegadas', filas.length],
            ['Paladas', paladasTot],
            ['Toneladas', `${fmt(paladasTot * pesoPalada)} t`],
            ['Ciclo mediano', ciclos.length ? `${fmt(mediana(ciclos))} min` : '—'],
            ['Revisar', revisar],
          ].map(([k, v], i) => (
            <div key={k} className="leading-tight">
              <dt className="text-[10px] uppercase tracking-wide text-gray-500">{k}</dt>
              <dd className={`font-mono text-[15px] font-semibold ${i === 4 && revisar ? 'text-red-600' : 'text-gray-900'}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {petroleoSinPalas && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No se pudo cargar la lista de palas desde Petróleo.
          {reintentarMaquinas && (
            <button type="button" disabled={reintentando} onClick={() => { setReintentando(true); reintentarMaquinas().finally(() => setReintentando(false)); }}
              className="rounded-md border border-amber-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
              {reintentando ? 'Reintentando…' : 'Reintentar'}
            </button>
          )}
        </p>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
        {/* Planilla */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
          {/* Acciones */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {sucio ? <span className="font-semibold text-amber-700">Cambios sin guardar</span> : <span className="hidden sm:inline">Peso por palada {fmt(pesoPalada, 2)} t</span>}
              {reporte?.estado === 'borrador' && <button type="button" onClick={eliminarBorrador} className="font-medium text-red-600 underline">Eliminar borrador</button>}
            </div>
            <div className="flex flex-1 justify-end gap-2 sm:flex-none">
              <button type="button" disabled={guardando || cargando} onClick={() => guardar('borrador')} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:flex-none">Guardar borrador</button>
              <button type="button" disabled={guardando || cargando} onClick={() => guardar('guardado')} className="flex-1 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 sm:flex-none">{guardando ? 'Guardando…' : 'Guardar report'}</button>
            </div>
          </div>
          {/* Panel de ingreso / corrección */}
          <div className={`border-b-2 border-teal-600 px-3 py-2.5 ${editId ? 'bg-teal-50' : 'bg-gray-50'}`}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); confirmarPanel(); } }}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-teal-800">{editId ? `Corrigiendo llegada #${ordenadas.findIndex((f) => f._id === editId) + 1}` : 'Nueva llegada'}</span>
              <button type="button" onClick={() => setVerPunto((v) => !v)} className="flex min-w-0 items-center gap-1 text-xs text-gray-600 md:hidden">
                <HiPencil className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{faltaPunto ? 'Elegir sector y pala' : `${nombreFrente(panel.id_frente_trabajo, panel.frente)} · ${panel.nombre_pala}`}</span>
                <HiChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${verPunto ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:items-end xl:grid-cols-[96px_130px_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_76px_70px_auto]">
              <div>
                <label htmlFor="cyt-hora" className={etiqueta}>Hora</label>
                <input id="cyt-hora" type="time" value={panel.hora_llegada} onChange={(e) => cambiarPanel({ hora_llegada: e.target.value, _horaAuto: false })} className={campo} />
              </div>
              <div>
                <label htmlFor="cyt-dumper" className={etiqueta}>Dumper</label>
                <SearchableSelect id="cyt-dumper" size="md" placeholder="Dumper" options={opcionesDe(nombresDumpers, panel.nombre_dumper)} value={panel.nombre_dumper} onChange={elegirDumper} />
              </div>
              <div className="col-span-2 md:col-span-2 xl:col-span-1">
                <label htmlFor="cyt-opdumper" className={etiqueta}>Operador dumper</label>
                <SearchableSelect id="cyt-opdumper" size="md" placeholder="Elegir operador" options={opcionesDe(nombresOpDumper, panel.nombre_operador_dumper)} value={panel.nombre_operador_dumper}
                  onChange={(v) => cambiarPanel({ nombre_operador_dumper: v, id_operador_dumper: operadoresDumper.find((o) => o.nombre === v)?.id_operador ?? null })} />
              </div>
              <div className={`${verPunto ? '' : 'hidden'} col-span-2 md:col-span-1 md:block`}>
                <label htmlFor="cyt-sector" className={etiqueta}>Sector</label>
                <SearchableSelect id="cyt-sector" size="md" placeholder="Buscar frente" options={opcionesSector} value={panel.id_frente_trabajo}
                  onChange={(v) => cambiarPanel({ id_frente_trabajo: v ? Number(v) : '', frente: null })} emptyMessage="No hay frentes activos en esta faena" />
              </div>
              <div className={`${verPunto ? '' : 'hidden'} md:block`}>
                <label htmlFor="cyt-pala" className={etiqueta}>Pala</label>
                <SearchableSelect id="cyt-pala" size="md" placeholder="Pala" options={opcionesDe(nombresPalas, panel.nombre_pala)} value={panel.nombre_pala}
                  onChange={(v) => cambiarPanel({ nombre_pala: v, id_pala: palas.find((x) => x.nombre === v)?.id ?? null })} emptyMessage="Sin palas: revisa la conexión con Petróleo" />
              </div>
              <div className={`${verPunto ? '' : 'hidden'} md:block`}>
                <label htmlFor="cyt-oppala" className={etiqueta}>Operador pala</label>
                <SearchableSelect id="cyt-oppala" size="md" placeholder="Elegir operador" value={panel.nombre_operador_pala}
                  options={[...opcionesDe(nombresOpPala, panel.nombre_operador_pala), { value: '__nuevo', label: '+ Autorizar operador de pala…' }]}
                  onChange={(v) => {
                    if (v === '__nuevo') { onPedirAutorizarPala(); return; }
                    cambiarPanel({ nombre_operador_pala: v, id_operador_pala: operadoresPala.find((o) => o.nombre === v)?.id_operador ?? null });
                  }} />
              </div>
              <div>
                <label htmlFor="cyt-carguio" className={etiqueta}>Carguío</label>
                <input id="cyt-carguio" type="number" min="0" step="0.5" inputMode="decimal" placeholder="min" value={panel.tiempo_carguio} onChange={(e) => cambiarPanel({ tiempo_carguio: e.target.value })} className={campo} />
              </div>
              <div>
                <label htmlFor="cyt-paladas" className={etiqueta}>Paladas</label>
                <input id="cyt-paladas" type="number" min="0" inputMode="numeric" value={panel.paladas} onChange={(e) => cambiarPanel({ paladas: e.target.value })} className={campo} />
              </div>
              <div className="col-span-2 flex gap-1.5 md:col-span-2 xl:col-span-1">
                <button type="button" onClick={confirmarPanel} className="flex-1 whitespace-nowrap rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 md:flex-none">
                  {editId ? 'Listo' : 'Agregar ↵'}
                </button>
                {editId && (
                  <>
                    <button type="button" onClick={eliminarFila} className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">Eliminar</button>
                    <button type="button" onClick={cancelarEdicion} className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
            <b className="text-sm text-gray-900">Llegadas a la pala <span className="font-normal text-gray-500">· la más reciente arriba</span></b>
            <div className="flex gap-1.5">
              <select aria-label="Filtrar por dumper" value={filtroDumper} onChange={(e) => setFiltroDumper(e.target.value)} className={`${campo} w-auto py-1 text-xs`}>
                <option value="">Todos los dumpers</option>
                {Object.keys(porDumper).sort().map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select aria-label="Filtrar por sector" value={filtroSector} onChange={(e) => setFiltroSector(e.target.value)} className={`${campo} w-auto py-1 text-xs`}>
                <option value="">Todos los sectores</option>
                {sectoresUsados.map((id) => <option key={id} value={String(id)}>{nombreFrente(id)}</option>)}
              </select>
            </div>
          </div>

          <div ref={lista} className="h-[48vh] overflow-auto md:h-[calc(100vh-430px)] md:min-h-[300px]">
            {visibles.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">{filas.length ? 'Ninguna llegada con ese filtro.' : 'Todavía no hay llegadas. Ingresa la primera arriba.'}</p>
            )}

            {/* Tablet y PC */}
            {visibles.length > 0 && (
              <table className="hidden w-full text-sm md:table">
                <thead className="sticky top-0 z-10 bg-gray-50 text-left text-[11px] font-semibold text-gray-500">
                  <tr>
                    <th className="w-9 px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Hora</th>
                    <th className="px-2 py-1.5">Dumper</th>
                    <th className="hidden px-2 py-1.5 xl:table-cell">Operador dumper</th>
                    <th className="px-2 py-1.5">Sector</th>
                    <th className="px-2 py-1.5">Pala</th>
                    <th className="hidden px-2 py-1.5 xl:table-cell">Operador pala</th>
                    <th className="px-2 py-1.5">Carguío</th>
                    <th className="px-2 py-1.5">Paladas</th>
                    <th className="px-2 py-1.5">Ciclo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibles.map((f, i) => {
                    const prev = visibles[i + 1]; // la llegada anterior en hora (la lista va al revés)
                    const rep = (k) => (prev && prev[k] === f[k] ? 'text-gray-300' : '');
                    return (
                      <tr key={f._id} onClick={() => editar(f)} className={`cursor-pointer ${editId === f._id ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-gray-400">{ordenadas.indexOf(f) + 1}</td>
                        <td className="px-2 py-1.5 font-mono">{f.hora_llegada || '—'}</td>
                        <td className="px-2 py-1.5 font-semibold text-gray-900">{corto(f.nombre_dumper)}</td>
                        <td className="hidden max-w-[180px] truncate px-2 py-1.5 text-gray-500 xl:table-cell">{f.nombre_operador_dumper || '—'}</td>
                        <td className="max-w-[170px] truncate px-2 py-1.5">
                          <span className="mr-1.5 inline-block h-3.5 w-1 rounded-sm align-middle" style={{ background: coloresSector[f.id_frente_trabajo] || '#d1d5db' }} />
                          <span className={rep('id_frente_trabajo')}>{nombreFrente(f.id_frente_trabajo, f.frente) || '—'}</span>
                        </td>
                        <td className={`max-w-[130px] truncate px-2 py-1.5 ${rep('nombre_pala')}`}>{f.nombre_pala || '—'}</td>
                        <td className={`hidden max-w-[170px] truncate px-2 py-1.5 xl:table-cell ${rep('nombre_operador_pala')}`}>{f.nombre_operador_pala || '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{f.tiempo_carguio !== '' ? `${f.tiempo_carguio} min` : '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{f.paladas !== '' ? f.paladas : '—'}</td>
                        <td className="px-2 py-1.5"><PillCiclo c={ciclo[f._id]} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Celular */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {visibles.map((f) => (
                <li key={f._id}>
                  <button type="button" onClick={() => editar(f)} className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${editId === f._id ? 'bg-teal-50' : 'active:bg-gray-50'}`}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm">{f.hora_llegada || '—'}</span>
                      <b className="text-sm text-gray-900">{corto(f.nombre_dumper)}</b>
                      <span className="truncate text-xs text-gray-500">{f.nombre_operador_dumper}</span>
                      <span className="ml-auto"><PillCiclo c={ciclo[f._id]} /></span>
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                      <span className="inline-block h-3 w-1 shrink-0 rounded-sm" style={{ background: coloresSector[f.id_frente_trabajo] || '#d1d5db' }} />
                      {nombreFrente(f.id_frente_trabajo, f.frente)} · {f.nombre_pala} · {f.paladas !== '' ? `${f.paladas} pal.` : '—'}{f.tiempo_carguio !== '' ? ` · ${f.tiempo_carguio} min` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

        </section>

        {/* Dumpers: columna en PC, plegable en tablet/celular */}
        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <button type="button" onClick={() => setVerDumpers((v) => !v)} className="flex w-full items-center justify-between border-b border-gray-200 px-3 py-2 text-left lg:pointer-events-none">
            <b className="text-sm text-gray-900">Dumpers de la jornada <span className="font-normal text-gray-500">({listaDumpers.length})</span></b>
            <HiChevronDown className={`h-4 w-4 text-gray-500 transition-transform lg:hidden ${verDumpers ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${verDumpers ? '' : 'hidden'} lg:block lg:max-h-[calc(100vh-300px)] lg:overflow-auto`}>{PanelDumpers}</div>
        </aside>
      </div>
    </div>
  );
}
