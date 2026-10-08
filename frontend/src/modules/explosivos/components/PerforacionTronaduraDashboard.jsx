import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import InfoPopover from '../../../shared/components/molecules/InfoPopover';
import useJornadas from '../../../hooks/useJornadas';

// Dashboard de Perforación y Tronadura — mismo componente en:
//  - Dashboard Gerencial > Operaciones > Perforación y Tronadura (varias faenas)
//  - Ingeniería > Reportes P&T > Dashboard (una faena)
// Solo muestra; cada pantalla trae sus datos y sus filtros. Los datos vienen
// de PerforacionTronaduraService (backend) con una fila por faena, y aquí se
// suman según lo que llegue.

// Paleta validada (daltonismo) — la misma que ya usaba el Dashboard de Ingeniería.
// Respaldo: los turnos reales (y sus colores) vienen de Configuración General.
const TURNOS_BASE = [
  { id: 'AM', color: '#2a78d6' },
  { id: 'PM', color: '#eb6834' },
  { id: 'Noche', color: '#1baf7a' },
  { id: 'Madrugada', color: '#eda100' },
];

// Mapa de calor: 6 pasos de índigo (0 = sin tiros).
const HEAT = [
  { bg: '#F9FAFB', fg: 'transparent' },
  { bg: '#EEF2FF', fg: '#4338CA' },
  { bg: '#C7D2FE', fg: '#3730A3' },
  { bg: '#A5B4FC', fg: '#312E81' },
  { bg: '#818CF8', fg: '#FFFFFF' },
  { bg: '#6366F1', fg: '#FFFFFF' },
  { bg: '#4338CA', fg: '#FFFFFF' },
];

const UNIDAD = { kg: 'kg', metros: 'm', unidades: 'u' };
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MAX_FRENTES = 12;

const fmt = (v, dec = 0) =>
  (Number(v) || 0).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const ddmm = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

function listaDias(desde, hasta) {
  const out = [];
  const c = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  while (c <= fin) {
    out.push(c.toISOString().slice(0, 10));
    c.setDate(c.getDate() + 1);
  }
  return out;
}

function Kpi({ titulo, valor, detalle, info, alerta = false }) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-0.5 min-w-0 ${alerta ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-white'}`}>
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
        {info && <InfoPopover text={info} className="ml-auto flex-none" />}
      </span>
      <span className={`text-2xl font-bold font-mono tabular-nums ${alerta ? 'text-red-600' : 'text-gray-900'}`}>{valor}</span>
      <span className="text-xs text-gray-500">{detalle}</span>
    </div>
  );
}

function Seccion({ titulo, descripcion, derecha, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
          {descripcion && <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">{descripcion}</p>}
        </div>
        {derecha}
      </div>
      {children}
    </div>
  );
}

function Chip({ tono, children }) {
  const cls = {
    ok: 'bg-emerald-100 text-emerald-700',
    warn: 'bg-amber-100 text-amber-700',
    crit: 'bg-red-100 text-red-700',
    mut: 'bg-gray-100 text-gray-500',
  }[tono];
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

// Etiqueta del eje X: día del mes y, debajo, inicial del día de la semana.
// Sábado y domingo en gris claro; el primer día de cada mes lleva el mes.
const INICIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
function TickDia({ x, y, payload, mostrarMes }) {
  const iso = payload.value;
  const dow = new Date(`${iso}T12:00:00`).getDay();
  const finde = dow === 0 || dow === 6;
  const dia = iso.slice(8, 10);
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={11} textAnchor="middle" fontSize={11} fontWeight={600} fill={finde ? '#9CA3AF' : '#374151'}>
        {mostrarMes || dia === '01' ? `${dia}/${iso.slice(5, 7)}` : dia}
      </text>
      <text dy={24} textAnchor="middle" fontSize={10} fill={finde ? '#C4C8CE' : '#9CA3AF'}>{INICIAL[dow]}</text>
    </g>
  );
}

// Detalle del día al pasar el cursor: tiros por turno + total, metros y lo extraído.
function TooltipDia({ active, payload, turnos }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const dt = new Date(`${row.fecha}T12:00:00`);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[190px]">
      <p className="font-semibold text-gray-700 mb-2">{DOW[dt.getDay()]} {ddmm(row.fecha)}</p>
      {row.total > 0 ? (
        <>
          {turnos.map((t) => (
            <div key={t.id} className="flex justify-between gap-3 mb-0.5">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />{t.id}
              </span>
              <span className="font-mono font-semibold">{row[t.id] ? fmt(row[t.id]) : '—'}</span>
            </div>
          ))}
          <div className="border-t mt-1 pt-1 flex justify-between font-semibold text-gray-800">
            <span>Total</span><span className="font-mono">{fmt(row.total)} tiros</span>
          </div>
          <div className="flex justify-between text-gray-500 mt-0.5">
            <span>Metros perforados</span><span className="font-mono">{fmt(row.metros)} m</span>
          </div>
          {row.frentes?.length > 0 && (
            <div className="border-t mt-1.5 pt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Frentes perforados</p>
              {row.frentes.map((f) => (
                <div key={f.id} className="mb-1 last:mb-0">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-gray-700">{f.frente}</span>
                    <span className="font-mono font-semibold">{fmt(f.tiros)} tiros</span>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right">{f.turnos.join(' · ')}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">Sin reportes</p>
      )}
      <div className="flex justify-between text-gray-500 mt-0.5">
        <span>Toneladas extraídas</span><span className="font-mono">{row.ton ? `${fmt(row.ton)} t` : '—'}</span>
      </div>
    </div>
  );
}

export default function PerforacionTronaduraDashboard({ data, loading = false, nombreFaena = (id) => `Faena ${id}` }) {
  // Turnos de P&T desde Configuración General (también los apagados, que pueden
  // tener reportes), más cualquier turno que venga en los datos y no esté en la tabla.
  const cfg = useJornadas('perforacion');
  const TURNOS = useMemo(() => {
    const ids = [...cfg.nombresFiltro];
    (data?.turnos || []).forEach((r) => { if (r.turno && !ids.includes(r.turno)) ids.push(r.turno); });
    return ids.map((id) => ({ id, color: cfg.color(id) || TURNOS_BASE.find((t) => t.id === id)?.color || '#94a3b8' }));
  }, [cfg, data]);

  const d = useMemo(() => {
    if (!data) return null;
    const dias = listaDias(data.periodo.desde, data.periodo.hasta);
    const faenas = new Set([
      ...data.turnos.map((r) => r.id_faena),
      ...data.estados.map((r) => r.id_faena),
    ]);
    const multiFaena = faenas.size > 1;

    // KPIs
    const tiros = data.turnos.reduce((s, r) => s + r.tiros, 0);
    const metros = data.turnos.reduce((s, r) => s + r.metros, 0);
    const ton = data.ton_dia.reduce((s, r) => s + r.ton, 0);
    const diasConReporte = new Set(data.turnos.map((r) => r.fecha)).size;
    const anfo = data.explosivos.filter((r) => r.tipo === 'ANFO-AL').reduce((s, r) => s + r.real, 0);
    const reportes = data.estados.reduce((s, r) => s + r.total, 0);
    const cerrados = data.estados.filter((r) => r.estado === 'cerrado').reduce((s, r) => s + r.total, 0);

    // Tiros por día y turno
    const porDia = Object.fromEntries(dias.map((f) => [f, { fecha: f, ...Object.fromEntries(TURNOS.map((t) => [t.id, 0])), total: 0, metros: 0, ton: 0 }]));
    data.turnos.forEach((r) => {
      const x = porDia[r.fecha];
      if (!x) return;
      if (x[r.turno] !== undefined) x[r.turno] += r.tiros;
      x.total += r.tiros;
      x.metros += r.metros;
    });
    data.ton_dia.forEach((r) => { if (porDia[r.fecha]) porDia[r.fecha].ton += r.ton; });

    // Frentes perforados cada día (detalle del tooltip), con los turnos en que se perforó.
    const ordenTurno = (t) => { const i = TURNOS.findIndex((x) => x.id === t); return i < 0 ? 99 : i; };
    const frentesDia = {};
    data.frente_dia.forEach((r) => {
      if (!porDia[r.fecha]) return;
      const dia = (frentesDia[r.fecha] ||= {});
      const f = (dia[r.id_frente_trabajo] ||= { id: r.id_frente_trabajo, frente: r.frente, tiros: 0, turnos: new Set() });
      f.tiros += r.tiros;
      if (r.turno) f.turnos.add(r.turno);
    });
    Object.entries(frentesDia).forEach(([fecha, dia]) => {
      porDia[fecha].frentes = Object.values(dia)
        .map((f) => ({ ...f, turnos: [...f.turnos].sort((a, b) => ordenTurno(a) - ordenTurno(b)) }))
        .sort((a, b) => b.tiros - a.tiros);
    });

    // Participación por turno
    const turnos = TURNOS.map((t) => {
      const filas = data.turnos.filter((r) => r.turno === t.id);
      const tt = filas.reduce((s, r) => s + r.tiros, 0);
      return { ...t, tiros: tt, jornadas: filas.length, pct: tiros ? (tt / tiros) * 100 : 0 };
    });

    // Mapa frente × día
    const tonFrente = Object.fromEntries(data.ton_frente.map((r) => [r.id_frente_trabajo, r]));
    const frentes = {};
    data.frente_dia.forEach((r) => {
      const f = (frentes[r.id_frente_trabajo] ||= { id: r.id_frente_trabajo, frente: r.frente, id_faena: r.id_faena, total: 0, dias: {} });
      f.total += r.tiros;
      f.dias[r.fecha] = (f.dias[r.fecha] || 0) + r.tiros;
    });
    const topFrentes = Object.values(frentes).sort((a, b) => b.total - a.total).slice(0, MAX_FRENTES)
      .map((f) => ({ ...f, ton: tonFrente[f.id]?.ton || 0, ley: tonFrente[f.id]?.ley ?? null }));
    const maxCelda = Math.max(1, ...topFrentes.flatMap((f) => Object.values(f.dias)));

    // Explosivos real vs calculado + cobertura del stock
    const stock = {};
    data.stock.forEach((r) => { stock[r.tipo] = (stock[r.tipo] || 0) + r.stock; });
    const exp = {};
    data.explosivos.forEach((r) => {
      const e = (exp[r.tipo] ||= { tipo: r.tipo, unidad: r.unidad, calculado: 0, real: 0 });
      e.calculado += r.calculado;
      e.real += r.real;
    });
    const explosivos = Object.values(exp).sort((a, b) => b.real - a.real).map((e) => {
      const diario = e.real / data.periodo.dias;
      return {
        ...e,
        dif: e.calculado > 0 ? ((e.real - e.calculado) / e.calculado) * 100 : null,
        cobertura: diario > 0 ? (stock[e.tipo] || 0) / diario : null,
      };
    });

    // Estado de los reportes por faena
    const estados = [...faenas].sort((a, b) => a - b).map((id) => {
      const filas = data.estados.filter((r) => r.id_faena === id);
      const total = filas.reduce((s, r) => s + r.total, 0);
      const cerr = filas.filter((r) => r.estado === 'cerrado').reduce((s, r) => s + r.total, 0);
      return { id, total, cerrados: cerr };
    }).filter((e) => e.total > 0);

    // Perforistas: una fila por persona (por RUT) aunque haya trabajado en las dos faenas.
    const pm = {};
    data.perforistas.forEach((r) => {
      const p = (pm[r.rut] ||= { rut: r.rut, nombre: r.nombre, faenas: new Set(), tiros: 0, metros: 0, dias: 0, reportes: 0 });
      p.faenas.add(r.id_faena);
      p.tiros += r.tiros;
      p.metros += r.metros;
      p.dias += r.dias;
      p.reportes += r.reportes;
    });
    const perforistas = Object.values(pm).sort((a, b) => b.tiros - a.tiros);

    return {
      dias, multiFaena, tiros, metros, ton, diasConReporte, anfo, reportes, cerrados,
      serie: dias.map((f) => porDia[f]), turnos, topFrentes, maxCelda, explosivos, estados, perforistas,
    };
  }, [data, TURNOS]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }
  if (!d) return null;
  if (d.tiros === 0 && d.reportes === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-500">
        No hay reportes de Perforación y Tronadura en este período.
      </div>
    );
  }

  const sinCerrar = d.reportes - d.cerrados;
  const maxTurno = Math.max(1, ...d.turnos.map((t) => t.tiros));
  const maxPerf = Math.max(1, ...d.perforistas.map((p) => p.tiros));
  const nivel = (v) => (!v ? 0 : Math.min(6, Math.max(1, Math.ceil((v / d.maxCelda) * 6))));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi titulo="Tiros quemados" valor={fmt(d.tiros)} detalle={`${fmt(d.tiros / Math.max(d.diasConReporte, 1))} por día · ${d.diasConReporte} días con reporte`}
          info="Suma del N° de tiros de todas las líneas de los reportes de Perforación y Tronadura del período (confirmados o cerrados; los borradores no cuentan). 'Por día' es el promedio de los días que tuvieron al menos un reporte, no de todos los días del calendario." />
        <Kpi titulo="Metros perforados" valor={fmt(d.metros)} detalle={`${fmt(d.metros / Math.max(d.tiros, 1), 2)} m por tiro`}
          info="Metros de roca perforados: en cada línea del reporte, N° de tiros × largo de perforación (el largo de cada tiro, normalmente 1,6 o 1,8 m), sumado en todo el período. 'm por tiro' es el largo promedio de los tiros." />
        <Kpi titulo="Toneladas extraídas" valor={fmt(d.ton)} detalle="suma de dumpadas del período"
          info="Toneladas de todas las dumpadas ingresadas en Dispatch con fecha dentro del período. Es lo que salió de la mina, no lo despachado a planta." />
        <Kpi titulo="Toneladas por tiro" valor={fmt(d.ton / Math.max(d.tiros, 1), 2)} detalle="extraído ÷ tiros"
          info="Toneladas extraídas ÷ tiros del período. Indica cuánto material rinde cada tiro. Es un promedio del período: lo tronado un día puede sacarse días después, sobre todo en Catemu." />
        <Kpi titulo="kg ANFO por tonelada" valor={d.ton > 0 ? fmt(d.anfo / d.ton, 2) : '—'} detalle={`${fmt(d.anfo)} kg de ANFO en total`}
          info="kg de ANFO usados (cantidad real de los reportes) ÷ toneladas extraídas. Es el factor de carga: cuánto explosivo se gasta por tonelada. Solo considera ANFO, que es el único explosivo que se mide en kg." />
        <Kpi titulo="Reportes sin cerrar" valor={fmt(sinCerrar)} detalle={`de ${fmt(d.reportes)} del período`} alerta={sinCerrar > 0}
          info="Reportes confirmados que todavía no se cierran. Mientras no se cierren, sus explosivos no se descuentan del stock del polvorín, así que el stock que muestra el sistema sale más alto que el real." />
      </div>

      {/* Tiros por día y turno + participación */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Seccion
          className="xl:col-span-2"
          titulo="Tiros por día y turno"
          descripcion="Tiros quemados cada día, separados por turno. Pasa el cursor sobre una barra para ver el detalle del día."
          derecha={(
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              {TURNOS.map((t) => (
                <span key={t.id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />{t.id}</span>
              ))}
            </div>
          )}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.serie} margin={{ top: 20, right: 8, left: -12, bottom: 4 }} barCategoryGap="18%">
              <CartesianGrid stroke="#EEF0F3" vertical={false} />
              <XAxis
                dataKey="fecha"
                height={34}
                interval={d.serie.length <= 45 ? 0 : 'preserveStartEnd'}
                minTickGap={4}
                tick={(props) => <TickDia {...props} mostrarMes={props.index === 0} />}
                tickLine={false}
                axisLine={{ stroke: '#D1D5DB' }}
              />
              {/* ~15% de aire sobre la barra más alta para que el total no toque el borde */}
              <YAxis
                tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false}
                domain={[0, (max) => { const paso = max > 200 ? 50 : 10; return Math.ceil((max * 1.15) / paso) * paso; }]}
              />
              <Tooltip content={<TooltipDia turnos={TURNOS} />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              {TURNOS.map((t, i) => (
                <Bar key={t.id} dataKey={t.id} stackId="t" fill={t.color} stroke="#fff" strokeWidth={1}
                  radius={i === TURNOS.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false}>
                  {/* Total del día sobre la barra: va en la última serie del
                      apilado, que siempre queda arriba aunque valga 0. Con
                      períodos largos no caben, se ven en el tooltip. */}
                  {i === TURNOS.length - 1 && d.serie.length <= 45 && (
                    <LabelList
                      dataKey="total"
                      content={({ x, y, width, value }) => (value > 0 ? (
                        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#374151">
                          {fmt(value)}
                        </text>
                      ) : null)}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Seccion>

        <Seccion titulo="Participación por turno" descripcion="Qué parte de los tiros hace cada turno y cuántos tiros promedia cada vez que trabaja.">
          <div className="flex flex-col gap-3">
            {d.turnos.map((t) => (
              <div key={t.id}>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-800"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />{t.id}</span>
                  <span className="font-mono text-gray-700">{fmt(t.tiros)} · {fmt(t.pct, 1)}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded mt-1 overflow-hidden">
                  <div className="h-full rounded-r" style={{ width: `${(t.tiros / maxTurno) * 100}%`, background: t.color }} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.jornadas} jornadas con reporte · {fmt(t.jornadas ? t.tiros / t.jornadas : 0)} tiros por jornada
                </p>
              </div>
            ))}
          </div>
        </Seccion>
      </div>

      {/* Mapa frente × día */}
      <Seccion
        titulo="Tiros por frente, día a día"
        descripcion={`Los ${MAX_FRENTES} frentes con más tiros del período. Más oscuro, más tiros ese día. A la derecha, lo que se extrajo del frente (dumpadas), toneladas por tiro y ley Cu Insoluble.`}
        derecha={(
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="mr-1">Menos</span>
            {HEAT.slice(1).map((h) => <span key={h.bg} className="w-3 h-3 rounded-sm" style={{ background: h.bg }} />)}
            <span className="ml-1">Más</span>
          </div>
        )}
      >
        <div className="overflow-x-auto">
          <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr className="text-[10px] text-gray-500">
                <th className="text-left font-semibold uppercase tracking-wide px-2 sticky left-0 bg-white">Frente</th>
                {d.dias.map((f, i) => <th key={f} className="font-normal w-6 min-w-[22px]">{i % 3 === 0 ? f.slice(8, 10) : ''}</th>)}
                <th className="text-right font-semibold uppercase tracking-wide px-2">Tiros</th>
                <th className="text-right font-semibold uppercase tracking-wide px-2">Extraído</th>
                <th className="text-right font-semibold uppercase tracking-wide px-2">t/tiro</th>
                <th className="text-right font-semibold uppercase tracking-wide px-2">Ley Cu</th>
              </tr>
            </thead>
            <tbody>
              {d.topFrentes.map((f) => (
                <tr key={f.id}>
                  <td className="font-mono text-gray-800 px-2 whitespace-nowrap sticky left-0 bg-white">
                    {f.frente}
                    {d.multiFaena && <span className="ml-1.5 text-[10px] font-sans font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{nombreFaena(f.id_faena)}</span>}
                  </td>
                  {d.dias.map((fecha) => {
                    const v = f.dias[fecha] || 0;
                    const h = HEAT[nivel(v)];
                    return (
                      <td key={fecha} title={`${f.frente} · ${ddmm(fecha)}: ${v ? `${v} tiros` : 'sin tiros'}`}
                        className="h-7 w-6 min-w-[22px] rounded text-center text-[10px] font-mono"
                        style={{ background: h.bg, color: h.fg }}>
                        {v || ''}
                      </td>
                    );
                  })}
                  <td className="text-right font-mono px-2">{fmt(f.total)}</td>
                  <td className="text-right font-mono px-2 whitespace-nowrap">{f.ton > 0 ? `${fmt(f.ton)} t` : <Chip tono="warn">sin dumpadas</Chip>}</td>
                  <td className="text-right font-mono px-2">{f.ton > 0 ? fmt(f.ton / f.total, 2) : '—'}</td>
                  <td className="text-right font-mono px-2">{f.ley != null ? `${fmt(f.ley, 2)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* Explosivos + estado de reportes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Seccion
          className="xl:col-span-2"
          titulo="Explosivos: real contra calculado"
          descripcion="La barra es lo que se usó según los reportes; la marca negra, lo que calculaba la fórmula. A la derecha, cuántos días dura el stock del polvorín a este ritmo."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="text-left font-semibold px-2 py-2">Tipo</th>
                  <th className="text-left font-semibold px-2 py-2">Real vs calculado</th>
                  <th className="text-right font-semibold px-2 py-2">Real</th>
                  <th className="text-right font-semibold px-2 py-2">Calculado</th>
                  <th className="text-right font-semibold px-2 py-2">Dif.</th>
                  <th className="text-right font-semibold px-2 py-2">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {d.explosivos.map((e) => {
                  const max = Math.max(e.real, e.calculado) * 1.08 || 1;
                  const u = UNIDAD[e.unidad] || '';
                  const tonoDif = e.dif == null ? 'mut' : Math.abs(e.dif) <= 10 ? 'ok' : Math.abs(e.dif) <= 25 ? 'warn' : 'crit';
                  const tonoCob = e.cobertura == null ? 'mut' : e.cobertura < 7 ? 'crit' : e.cobertura < 14 ? 'warn' : 'ok';
                  return (
                    <tr key={e.tipo} className="border-b border-gray-100">
                      <td className="px-2 py-2 font-semibold text-gray-800">{e.tipo}</td>
                      <td className="px-2 py-2 min-w-[150px]">
                        <div className="relative h-3.5 bg-gray-100 rounded">
                          <div className="absolute inset-y-0 left-0 bg-indigo-600 rounded-r" style={{ width: `${(e.real / max) * 100}%` }} />
                          {e.calculado > 0 && <div className="absolute -top-1 -bottom-1 w-0.5 bg-gray-900" style={{ left: `${(e.calculado / max) * 100}%` }} />}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono whitespace-nowrap">{fmt(e.real)} {u}</td>
                      <td className="px-2 py-2 text-right font-mono whitespace-nowrap">{e.calculado > 0 ? `${fmt(e.calculado)} ${u}` : '—'}</td>
                      <td className="px-2 py-2 text-right"><Chip tono={tonoDif}>{e.dif == null ? 'sin fórmula' : `${e.dif > 0 ? '+' : ''}${fmt(e.dif)}%`}</Chip></td>
                      <td className="px-2 py-2 text-right"><Chip tono={tonoCob}>{e.cobertura == null ? 'sin consumo' : `${fmt(e.cobertura)} días`}</Chip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Seccion>

        <Seccion titulo="Estado de los reportes" descripcion="Un reporte sin cerrar todavía no descontó sus explosivos del stock.">
          <div className="flex flex-col gap-4">
            {d.estados.map((e) => {
              const pct = (e.cerrados / e.total) * 100;
              const pend = e.total - e.cerrados;
              return (
                <div key={e.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">{nombreFaena(e.id)}</span>
                    <span className="font-mono text-gray-700">{fmt(e.cerrados)} de {fmt(e.total)} cerrados</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded mt-1 overflow-hidden">
                    <div className={`h-full rounded-r ${pct >= 90 ? 'bg-emerald-600' : pct >= 50 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {pend > 0 ? <><Chip tono={pct >= 90 ? 'warn' : 'crit'}>{fmt(pend)} sin cerrar</Chip> Sus explosivos todavía no se descuentan del stock.</> : 'Todos cerrados.'}
                  </p>
                </div>
              );
            })}
          </div>
        </Seccion>
      </div>

      {/* Perforistas */}
      <Seccion titulo="Perforistas" descripcion="Ordenados por tiros del período. Metros por tiro = metros perforados ÷ tiros.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="text-left font-semibold px-2 py-2">Perforista</th>
                {d.multiFaena && <th className="text-left font-semibold px-2 py-2">Faena</th>}
                <th className="text-right font-semibold px-2 py-2">Tiros</th>
                <th className="text-right font-semibold px-2 py-2">Metros</th>
                <th className="text-right font-semibold px-2 py-2">m por tiro</th>
                <th className="text-right font-semibold px-2 py-2">Días</th>
                <th className="text-right font-semibold px-2 py-2">Tiros por día</th>
                <th className="text-right font-semibold px-2 py-2">Reportes</th>
              </tr>
            </thead>
            <tbody>
              {d.perforistas.map((p, i) => (
                <tr key={p.rut} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-800 whitespace-nowrap">{i + 1}. {p.nombre}</td>
                  {d.multiFaena && <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{[...p.faenas].map(nombreFaena).join(' + ')}</td>}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="h-2 bg-indigo-400 rounded-r" style={{ width: `${(p.tiros / maxPerf) * 90}px` }} />
                      <span className="font-mono">{fmt(p.tiros)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.metros)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.metros / Math.max(p.tiros, 1), 2)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.dias)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.tiros / Math.max(p.dias, 1))}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.reportes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
