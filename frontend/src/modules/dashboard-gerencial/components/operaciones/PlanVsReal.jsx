import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { HiChevronLeft, HiChevronRight, HiChevronDown } from 'react-icons/hi2';
import { FiRefreshCw } from 'react-icons/fi';
import gerencialService from '../../services/gerencialService';
import { MESES, DIA_CORTO, diaSemana, fmt } from '../../utils/planCalculos';

// Plan vs Real — Dashboard Gerencial > Operaciones.
// El backend (PlanVsRealController) entrega, por faena, el plan PUBLICADO del mes
// y lo real sin procesar: dumpadas (fecha de extracción) y tronaduras (líneas de
// los Reportes de Perforación) por frente/día/turno. Aquí se arma todo: así
// mover el corte es inmediato. Solo se comparan las faenas con plan publicado.

// "2026-10-01" → "01-10-2026"
const fechaCorta = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const C = { plan: '#94a3b8', real: '#2563eb', bajo: '#dc2626', grid: '#e5e7eb', texto: '#6b7280', finde: '#f8fafc' };

const pct = (a, b) => (b ? (a / b) * 100 : null);
const estadoPct = (v) => (v == null ? 'gris' : v >= 95 ? 'ok' : v >= 80 ? 'atencion' : 'mal');
const BARRA = { ok: 'bg-emerald-500', atencion: 'bg-amber-500', mal: 'bg-red-500', gris: 'bg-gray-300', azul: 'bg-blue-600' };
const CHIP = { ok: 'bg-emerald-100 text-emerald-800', atencion: 'bg-amber-100 text-amber-800', mal: 'bg-red-100 text-red-700', gris: 'bg-gray-100 text-gray-600' };

function Barra({ valor, tono }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${BARRA[tono]}`} style={{ width: `${Math.max(0, Math.min(valor ?? 0, 100))}%` }} />
    </div>
  );
}

function Kpi({ titulo, valor, barra, tono, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1.5 min-w-0">
      <span className="text-xs text-gray-500">{titulo}</span>
      <span className="text-2xl font-semibold tabular-nums text-gray-900">{valor}</span>
      {barra != null && <Barra valor={barra} tono={tono} />}
      <span className="text-xs text-gray-500">{children}</span>
    </div>
  );
}

// Escala "redonda" para el eje: 0, 50, 100, 150… (o 20, 25, 100… según el máximo).
function escalaRedonda(maximo, divisiones = 4) {
  const bruto = Math.max(maximo, 1) / divisiones;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  return { paso, max: paso * Math.ceil(Math.max(maximo, 1) / paso) };
}

function GraficoDiario({ dias, corte, anio, mes, diaSel, onDia }) {
  const [hover, setHover] = useState(null); // día bajo el mouse
  const W = 1100; const H = 270; const L = 44; const R = 10; const T = 30; const B = 34;
  const n = dias.length;
  const { paso, max } = escalaRedonda(Math.max(...dias.map((d) => Math.max(d.plan, d.real ?? 0))) * 1.08);
  const bw = (W - L - R) / n;
  const x = (d) => L + (d - 1) * bw;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = Array.from({ length: Math.round(max / paso) + 1 }, (_, i) => i * paso);
  const sel = hover ? dias[hover - 1] : null;

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[760px]" role="img" aria-label="Avance diario de mineral, plan contra real" onMouseLeave={() => setHover(null)}>
        {ticks.map((v, i) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} strokeDasharray={i ? '3 3' : undefined} />
            <text x={L - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill={C.texto}>{fmt(v)}</text>
          </g>
        ))}
        <text x={L - 6} y={T - 16} fontSize="10" textAnchor="end" fill={C.texto}>t</text>
        {dias.map((d) => {
          const cx = x(d.dia);
          const centro = cx + bw / 2;
          const ds = diaSemana(anio, mes, d.dia);
          const pasado = d.real != null;
          const bajo = pasado && d.plan > 0 && d.real < d.plan * 0.8;
          const tope = Math.max(d.plan, d.real ?? 0);
          return (
            <g
              key={d.dia}
              onMouseEnter={() => setHover(d.dia)}
              onClick={() => pasado && onDia?.(diaSel === d.dia ? null : d.dia)}
              style={{ cursor: pasado ? 'pointer' : 'default' }}
            >
              {/* zona de hover / clic de todo el día */}
              <rect x={cx} y={T - 24} width={bw} height={H - T - B + 24}
                fill={diaSel === d.dia ? '#dbeafe' : hover === d.dia ? '#eef2ff' : (ds === 0 || ds === 6 ? C.finde : 'transparent')}
                stroke={diaSel === d.dia ? C.real : 'none'} strokeWidth="1.5" />
              {!pasado && d.plan > 0 && <rect x={cx + bw * 0.2} y={y(d.plan)} width={bw * 0.6} height={y(0) - y(d.plan)} rx="2" fill={C.plan} opacity="0.18" />}
              {pasado && d.real > 0 && (
                <rect x={cx + bw * 0.2} y={y(d.real)} width={bw * 0.6} height={y(0) - y(d.real)} rx="2" fill={bajo ? C.bajo : C.real} />
              )}
              {d.plan > 0 && (
                <line x1={cx + bw * 0.08} x2={cx + bw * 0.92} y1={y(d.plan)} y2={y(d.plan)} stroke={pasado ? '#475569' : C.plan} strokeWidth="2.5" strokeLinecap="round" />
              )}
              {/* Valores: real arriba (color de la barra) y plan debajo (gris) */}
              {(pasado || d.plan > 0) && (
                <text x={centro} y={y(tope) - (pasado && d.plan > 0 ? 15 : 5)} fontSize="10" textAnchor="middle" fontWeight="600"
                  fill={pasado ? (bajo ? C.bajo : C.real) : C.texto}>
                  {pasado ? fmt(d.real) : fmt(d.plan)}
                </text>
              )}
              {pasado && d.plan > 0 && (
                <text x={centro} y={y(tope) - 4} fontSize="9" textAnchor="middle" fill={C.texto}>/{fmt(d.plan)}</text>
              )}
              <text x={centro} y={H - B + 14} fontSize="10.5" textAnchor="middle" fill={d.dia === corte ? '#111827' : C.texto} fontWeight={d.dia === corte ? 600 : 400}>{d.dia}</text>
              <text x={centro} y={H - B + 27} fontSize="9.5" textAnchor="middle" fill="#9ca3af">{DIA_CORTO[ds]}</text>
            </g>
          );
        })}
        {corte < n && (
          <g pointerEvents="none">
            <line x1={x(corte + 1)} x2={x(corte + 1)} y1={T - 20} y2={H - B} stroke="#111827" strokeDasharray="2 3" opacity="0.5" />
            <text x={x(corte + 1) + 4} y={T - 12} fontSize="10.5" fill={C.texto}>corte</text>
          </g>
        )}
      </svg>

      {sel && (sel.plan > 0 || sel.real != null) && (
        <div
          className="pointer-events-none absolute top-2 z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg tabular-nums"
          style={{ left: `clamp(8px, ${((x(sel.dia) + bw / 2) / W) * 100}% - 80px, calc(100% - 180px))` }}
        >
          <div className="font-semibold mb-1">{DIAS_LARGO[diaSemana(anio, mes, sel.dia)]} {sel.dia}</div>
          <div className="flex justify-between gap-4"><span className="text-gray-300">Plan</span><span>{fmt(sel.plan)} t</span></div>
          {sel.real != null ? (
            <>
              <div className="flex justify-between gap-4"><span className="text-gray-300">Real</span><span>{fmt(sel.real, 1)} t</span></div>
              {sel.plan > 0 && (
                <>
                  <div className="flex justify-between gap-4"><span className="text-gray-300">Cumplimiento</span><span>{fmt((sel.real / sel.plan) * 100)}%</span></div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-300">Diferencia</span>
                    <span className={sel.real >= sel.plan ? 'text-emerald-300' : 'text-red-300'}>{sel.real >= sel.plan ? '+' : '−'}{fmt(Math.abs(sel.real - sel.plan), 1)} t</span>
                  </div>
                </>
              )}
              {!sel.plan && <div className="text-gray-300 mt-1">Día sin plan</div>}
            </>
          ) : (
            <div className="text-gray-300 mt-1">Día que todavía no llega</div>
          )}
          {sel.real != null && <div className="text-gray-400 mt-1">Clic para ver el detalle por frente</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Plan y real por frente y por día (para el mapa de calor). Misma clave de fila que
 * construirTabla, así un clic en una celda abre esa fila en la tabla del día.
 */
function construirMatriz(conPlan) {
  const filas = new Map();
  const fila = (f, id, frente, mineral) => {
    const k = `${f.id_faena}|${id ?? frente}|${mineral ? 'MX' : 'EX'}`;
    if (!filas.has(k)) filas.set(k, { key: k, id_faena: f.id_faena, frente: frente ?? 'Sin frente', mineral, porDia: {} });
    return filas.get(k);
  };
  const celda = (r, dia) => { r.porDia[dia] = r.porDia[dia] || { plan: 0, real: 0 }; return r.porDia[dia]; };
  conPlan.forEach((f) => {
    f.plan.frentes.forEach((fr) => {
      if (fr.actividad === 'fortificacion') return;
      const r = fila(f, fr.id_frente_trabajo, fr.frente, fr.mineral);
      fr.celdas.forEach((c) => { celda(r, c.dia).plan += c.toneladas || 0; });
    });
    f.dumpadas.forEach((d) => {
      const r = fila(f, d.id_frente_trabajo, d.frente, d.tipo_material !== 'esteril');
      celda(r, d.dia).real += d.toneladas;
    });
  });
  return [...filas.values()];
}

/** 1. Ritmo necesario para cumplir el mes + brecha acumulada día a día. */
function RitmoNecesario({ calc, corte }) {
  const restantes = calc.dias.filter((d) => d.dia > corte && d.plan > 0).length;
  const faltan = Math.max(calc.planMesMX - calc.realMX, 0);
  const necesario = restantes ? faltan / restantes : null;
  const actual = calc.ritmo;
  const subir = necesario != null && actual > 0 ? (necesario / actual - 1) * 100 : null;

  let mensaje; let tono;
  if (faltan === 0) { mensaje = 'El plan de mineral del mes ya está cumplido.'; tono = 'ok'; }
  else if (!restantes) { mensaje = `No quedan días con plan: el mes cierra con ${fmt(faltan)} t bajo el plan.`; tono = 'mal'; }
  else if (necesario <= actual) { mensaje = 'Al ritmo actual se cumple el plan del mes.'; tono = 'ok'; }
  else if (subir <= 10) { mensaje = `Hay que subir el ritmo un ${fmt(subir)} % para cumplir.`; tono = 'atencion'; }
  else { mensaje = `Hay que subir el ritmo un ${fmt(subir)} % para cumplir.`; tono = 'mal'; }

  // Brecha acumulada (real − plan) hasta el corte
  let acumPlan = 0; let acumReal = 0;
  const brecha = calc.dias.filter((d) => d.dia <= corte).map((d) => {
    acumPlan += d.plan; acumReal += d.real || 0;
    return { dia: d.dia, v: acumReal - acumPlan };
  });
  const W = 520; const H = 150; const L = 46; const R = 46; const T = 12; const B = 22;
  const maxAbs = Math.max(10, ...brecha.map((b) => Math.abs(b.v)));
  const bw = (W - L - R) / Math.max(calc.n, 1);
  const y0 = T + (H - T - B) / 2;
  const esc = (H - T - B) / 2 / maxAbs;
  const ult = brecha[brecha.length - 1];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center">
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-gray-800">¿Se llega a fin de mes? (mineral)</h4>
          <p className="text-xs text-gray-500">Lo que falta del plan del mes, repartido en los días con plan que quedan.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-gray-500">Faltan</div>
            <div className="text-xl font-semibold tabular-nums">{fmt(faltan)} t</div>
            <div className="text-xs text-gray-500">en {restantes} {restantes === 1 ? 'día' : 'días'} con plan</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Ritmo necesario</div>
            <div className={`text-xl font-semibold tabular-nums ${tono === 'mal' ? 'text-red-600' : tono === 'atencion' ? 'text-amber-600' : 'text-emerald-700'}`}>{necesario != null ? `${fmt(necesario)} t/día` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Ritmo actual</div>
            <div className="text-xl font-semibold tabular-nums text-gray-900">{fmt(actual)} t/día</div>
            <div className="text-xs text-gray-500">promedio de los días con plan</div>
          </div>
        </div>
        <div className={`text-sm rounded-lg px-3 py-2 ${CHIP[tono]}`}>{mensaje}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">Brecha acumulada día a día (real − plan): bajo la línea = atrasado</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Brecha acumulada entre real y plan">
          <line x1={L} x2={W - R} y1={y0} y2={y0} stroke="#9ca3af" />
          <text x={L - 6} y={y0 + 4} fontSize="10" textAnchor="end" fill={C.texto}>0</text>
          <text x={L - 6} y={T + 8} fontSize="10" textAnchor="end" fill={C.texto}>+{fmt(maxAbs)}</text>
          <text x={L - 6} y={H - B} fontSize="10" textAnchor="end" fill={C.texto}>−{fmt(maxAbs)}</text>
          {brecha.map((b) => {
            const h = Math.abs(b.v) * esc;
            return (
              <rect key={b.dia} x={L + (b.dia - 1) * bw + bw * 0.15} y={b.v >= 0 ? y0 - h : y0} width={bw * 0.7} height={Math.max(h, 0.5)} rx="1.5"
                fill={b.v >= 0 ? '#10b981' : '#ef4444'}>
                <title>{`Día ${b.dia}: ${b.v >= 0 ? '+' : '−'}${fmt(Math.abs(b.v))} t acumuladas`}</title>
              </rect>
            );
          })}
          {[1, 8, 15, 22, 29].filter((d) => d <= calc.n).map((d) => (
            <text key={d} x={L + (d - 0.5) * bw} y={H - 6} fontSize="10" textAnchor="middle" fill={C.texto}>{d}</text>
          ))}
          {ult && (
            <text x={L + ult.dia * bw + 4} y={ult.v >= 0 ? y0 - Math.abs(ult.v) * esc + 4 : y0 + Math.abs(ult.v) * esc} fontSize="11" fontWeight="600" fill={ult.v >= 0 ? '#047857' : '#dc2626'}>
              {ult.v >= 0 ? '+' : '−'}{fmt(Math.abs(ult.v))} t
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

/** 2. Quién explica el atraso: diferencia real − plan a la fecha por frente. */
function AtrasoPorFrente({ filas, multi, nombreFaena }) {
  const lista = filas.filter((r) => r.planCorte || r.real)
    .map((r) => ({ ...r, dif: r.real - r.planCorte }))
    .filter((r) => Math.abs(r.dif) >= 0.05)
    .sort((a, b) => a.dif - b.dif);
  const total = lista.reduce((s, r) => s + r.dif, 0);
  const maxAbs = Math.max(1, ...lista.map((r) => Math.abs(r.dif)));
  const peores = lista.filter((r) => r.dif < 0).slice(0, 3);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div>
        <h4 className="font-semibold text-gray-800">¿Quién explica el atraso?</h4>
        <p className="text-xs text-gray-500">
          Diferencia real − plan a la fecha por frente: rojo = falta, verde = va sobre el plan.
          {' '}Total <b className={total < 0 ? 'text-red-600' : 'text-emerald-700'}>{total < 0 ? '−' : '+'}{fmt(Math.abs(total))} t</b>
          {peores.length > 0 && <>; lo explican sobre todo {peores.map((r) => `${r.frente} (−${fmt(Math.abs(r.dif))})`).join(', ')}.</>}
        </p>
      </div>
      {lista.length === 0 ? (
        <div className="text-sm text-gray-500">Sin diferencias hasta el corte.</div>
      ) : (
        <div className="space-y-1">
          {lista.map((r) => {
            const w = (Math.abs(r.dif) / maxAbs) * 50;
            return (
              <div key={r.key} className="grid grid-cols-[minmax(0,150px)_1fr_64px] items-center gap-2 text-xs">
                <span className="truncate font-medium text-gray-700" title={`${multi ? `${nombreFaena(r.id_faena)} · ` : ''}${r.frente} (${r.mineral ? 'mineral' : 'estéril'})`}>
                  {r.frente}{!r.mineral && <span className="text-gray-400"> · est.</span>}
                </span>
                <div className="relative h-4">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded-sm ${r.dif < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={r.dif < 0 ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` }}
                  />
                </div>
                <span className={`text-right tabular-nums font-semibold ${r.dif < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{r.dif < 0 ? '−' : '+'}{fmt(Math.abs(r.dif))} t</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 3. Mapa de calor frente × día: % de cumplimiento de cada frente cada día. */
function MapaCalor({ matriz, orden, corte, diasMes, anio, mes, multi, nombreFaena, onCelda }) {
  const filas = [...matriz]
    .filter((r) => Object.values(r.porDia).some((c) => c.plan > 0 || c.real > 0))
    .sort((a, b) => (orden[a.key] ?? 0) - (orden[b.key] ?? 0));
  const color = (c, dia) => {
    if (!c || (!c.plan && !c.real)) return dia > corte ? 'bg-white' : 'bg-gray-100';
    if (dia > corte) return c.plan ? 'bg-gray-200' : 'bg-white';
    if (!c.plan) return 'bg-sky-400';
    if (!c.real) return 'bg-red-600';
    const p = c.real / c.plan;
    return p >= 0.95 ? 'bg-emerald-500' : p >= 0.8 ? 'bg-amber-400' : 'bg-red-400';
  };
  const dias = Array.from({ length: diasMes }, (_, i) => i + 1);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-gray-800">Mapa de cumplimiento: frente × día</h4>
          <p className="text-xs text-gray-500">Cada celda es un frente en un día. Clic en una celda con real para ver sus dumpadas en la tabla.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-emerald-500" />≥ 95 %</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-amber-400" />80–95 %</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-red-400" />&lt; 80 %</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-red-600" />Sin movimiento</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-sky-400" />Sin plan</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-gray-200" />Plan por venir</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white text-left font-medium text-gray-500 pr-2">Frente</th>
              {dias.map((d) => {
                const ds = diaSemana(anio, mes, d);
                return (
                  <th key={d} className={`w-6 text-center font-medium ${d === corte ? 'text-gray-900' : 'text-gray-400'} ${ds === 0 || ds === 6 ? 'bg-gray-50' : ''}`}>
                    {d}
                    <div className="text-[9px] font-normal">{DIA_CORTO[ds]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.key}>
                <td className="sticky left-0 bg-white pr-2 whitespace-nowrap font-medium text-gray-700 max-w-[170px] truncate" title={`${multi ? `${nombreFaena(r.id_faena)} · ` : ''}${r.frente}`}>
                  {r.frente}{!r.mineral && <span className="text-gray-400 font-normal"> · est.</span>}
                </td>
                {dias.map((d) => {
                  const c = r.porDia[d];
                  const clic = d <= corte && c?.real > 0;
                  const txt = c && (c.plan || c.real)
                    ? `${r.frente} · día ${d}: real ${fmt(c.real, 1)} t / plan ${fmt(c.plan)} t${c.plan && d <= corte ? ` (${fmt((c.real / c.plan) * 100)} %)` : ''}`
                    : `${r.frente} · día ${d}: sin plan ni movimiento`;
                  return (
                    <td key={d} className="p-0">
                      <button
                        type="button"
                        disabled={!clic}
                        onClick={() => onCelda(r.key, d)}
                        title={txt}
                        aria-label={txt}
                        className={`block w-6 h-5 rounded-sm ${color(c, d)} ${clic ? 'hover:ring-2 hover:ring-gray-800 cursor-pointer' : 'cursor-default'}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GraficoAcumulado({ dias, corte, ritmo, anio, mes }) {
  const [hover, setHover] = useState(null);
  const W = 1100; const H = 340; const L = 58; const R = 120; const T = 18; const B = 40;
  const n = dias.length;

  // Series acumuladas: plan (todo el mes), real (hasta el corte), proyección al ritmo
  // actual y lo necesario para llegar al plan (ambas desde el corte, solo días con plan).
  let ap = 0; let ar = 0;
  const serie = dias.map((d) => {
    ap += d.plan;
    if (d.dia <= corte) ar += d.real || 0;
    return { dia: d.dia, plan: ap, real: d.dia <= corte ? ar : null, planDia: d.plan, realDia: d.dia <= corte ? (d.real || 0) : null };
  });
  const planMes = ap;
  const realCorte = ar;
  const restantes = dias.filter((d) => d.dia > corte && d.plan > 0).length;
  const necesarioDia = restantes ? Math.max(planMes - realCorte, 0) / restantes : 0;
  let pr = realCorte; let nc = realCorte;
  serie.forEach((s) => {
    if (s.dia > corte) {
      if (s.planDia > 0) { pr += ritmo; nc += necesarioDia; }
      s.proy = pr; s.nec = nc;
    } else if (s.dia === corte) { s.proy = realCorte; s.nec = realCorte; }
  });

  const { paso, max } = escalaRedonda(Math.max(planMes, pr, nc, 1) * 1.05, 5);
  const ticks = Array.from({ length: Math.round(max / paso) + 1 }, (_, i) => i * paso);
  const x = (d) => L + ((d - 1) * (W - L - R)) / Math.max(n - 1, 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const linea = (campo) => serie.filter((s) => s[campo] != null).map((s, i) => `${i ? 'L' : 'M'}${x(s.dia).toFixed(1)},${y(s[campo]).toFixed(1)}`).join('');
  // Zona entre plan y real hasta el corte (roja si va atrasado, verde si va adelantado)
  const hasta = serie.filter((s) => s.dia <= corte);
  const zona = hasta.length
    ? `M${hasta.map((s) => `${x(s.dia).toFixed(1)},${y(s.real).toFixed(1)}`).join('L')}L${[...hasta].reverse().map((s) => `${x(s.dia).toFixed(1)},${y(s.plan).toFixed(1)}`).join('L')}Z`
    : '';
  const atrasado = realCorte < (serie[corte - 1]?.plan ?? 0);
  const paso_x = (W - L - R) / Math.max(n - 1, 1);
  const sel = hover ? serie[hover - 1] : null;

  // Etiquetas al final de cada línea (separadas para que no se pisen)
  const etiquetas = [
    { y: y(planMes), txt: `Plan ${fmt(planMes)} t`, color: '#475569' },
    ...(corte < n ? [
      { y: y(pr), txt: `Ritmo actual ${fmt(pr)} t`, color: C.real },
      { y: y(nc), txt: `Necesario ${fmt(nc)} t`, color: '#059669' },
    ] : [{ y: y(realCorte), txt: `Real ${fmt(realCorte)} t`, color: C.real }]),
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < etiquetas.length; i++) {
    if (etiquetas[i].y - etiquetas[i - 1].y < 14) etiquetas[i].y = etiquetas[i - 1].y + 14;
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1.5"><i className="w-5 h-0.5 bg-slate-500 inline-block" />Plan acumulado</span>
        <span className="flex items-center gap-1.5"><i className="w-5 h-1 rounded inline-block" style={{ background: C.real }} />Real acumulado</span>
        <span className="flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed inline-block" style={{ borderColor: C.real }} />Si se sigue al ritmo actual</span>
        <span className="flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed border-emerald-600 inline-block" />Lo necesario para cumplir</span>
        <span className="flex items-center gap-1.5"><i className={`w-3 h-3 rounded-sm inline-block ${atrasado ? 'bg-red-200' : 'bg-emerald-200'}`} />Diferencia a la fecha</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[760px]" role="img" aria-label="Acumulado del mes: plan, real, proyección y ritmo necesario" onMouseLeave={() => setHover(null)}>
          {ticks.map((v, i) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} strokeDasharray={i ? '3 3' : undefined} />
              <text x={L - 8} y={y(v) + 4} fontSize="11" textAnchor="end" fill={C.texto}>{fmt(v)}</text>
            </g>
          ))}
          <text x={L - 8} y={T - 6} fontSize="10" textAnchor="end" fill={C.texto}>t</text>
          {/* fines de semana y eje de días */}
          {serie.map((s) => {
            const ds = diaSemana(anio, mes, s.dia);
            return (
              <g key={s.dia}>
                {(ds === 0 || ds === 6) && <rect x={x(s.dia) - paso_x / 2} y={T} width={paso_x} height={H - T - B} fill={C.finde} />}
                <text x={x(s.dia)} y={H - B + 15} fontSize="10" textAnchor="middle" fill={s.dia === corte ? '#111827' : C.texto} fontWeight={s.dia === corte ? 600 : 400}>{s.dia}</text>
                <text x={x(s.dia)} y={H - B + 28} fontSize="9" textAnchor="middle" fill="#9ca3af">{DIA_CORTO[ds]}</text>
              </g>
            );
          })}
          {zona && <path d={zona} fill={atrasado ? '#fecaca' : '#a7f3d0'} opacity="0.6" />}
          <path d={linea('plan')} fill="none" stroke="#64748b" strokeWidth="2" />
          {corte < n && <path d={linea('nec')} fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="6 4" />}
          {corte < n && <path d={linea('proy')} fill="none" stroke={C.real} strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />}
          <path d={linea('real')} fill="none" stroke={C.real} strokeWidth="3" />
          {hasta.map((s) => <circle key={s.dia} cx={x(s.dia)} cy={y(s.real)} r="3" fill={C.real} />)}
          {corte < n && (
            <g>
              <line x1={x(corte)} x2={x(corte)} y1={T} y2={H - B} stroke="#111827" strokeDasharray="2 3" opacity="0.5" />
              <text x={x(corte) + 4} y={T + 10} fontSize="10.5" fill={C.texto}>corte {corte}</text>
            </g>
          )}
          {hasta.length > 0 && (
            <text x={x(corte) - 6} y={y(realCorte) - 10} fontSize="12" fontWeight="700" textAnchor="end" fill={C.real}>{fmt(realCorte)} t</text>
          )}
          {etiquetas.map((e) => (
            <text key={e.txt} x={W - R + 8} y={e.y + 4} fontSize="11" fontWeight="600" fill={e.color}>{e.txt}</text>
          ))}
          {/* zonas de hover */}
          {serie.map((s) => (
            <rect key={`h${s.dia}`} x={x(s.dia) - paso_x / 2} y={T} width={paso_x} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(s.dia)} />
          ))}
          {sel && <line x1={x(sel.dia)} x2={x(sel.dia)} y1={T} y2={H - B} stroke="#94a3b8" pointerEvents="none" />}
        </svg>
      </div>
      {sel && (
        <div
          className="pointer-events-none absolute top-10 z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg tabular-nums min-w-[200px]"
          style={{ left: `clamp(8px, ${(x(sel.dia) / W) * 100}% + 12px, calc(100% - 220px))` }}
        >
          <div className="font-semibold mb-1">{DIAS_LARGO[diaSemana(anio, mes, sel.dia)]} {sel.dia} · acumulado</div>
          <div className="flex justify-between gap-4"><span className="text-gray-300">Plan</span><span>{fmt(sel.plan)} t</span></div>
          {sel.real != null && (
            <>
              <div className="flex justify-between gap-4"><span className="text-gray-300">Real</span><span>{fmt(sel.real, 1)} t</span></div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-300">Diferencia</span>
                <span className={sel.real >= sel.plan ? 'text-emerald-300' : 'text-red-300'}>{sel.real >= sel.plan ? '+' : '−'}{fmt(Math.abs(sel.real - sel.plan), 1)} t</span>
              </div>
              <div className="flex justify-between gap-4"><span className="text-gray-300">Cumplimiento</span><span>{sel.plan ? `${fmt((sel.real / sel.plan) * 100)}%` : '—'}</span></div>
              <div className="flex justify-between gap-4 text-gray-400 mt-1"><span>Ese día</span><span>{fmt(sel.realDia, 1)} / {fmt(sel.planDia)} t</span></div>
            </>
          )}
          {sel.proy != null && sel.dia > corte && (
            <>
              <div className="flex justify-between gap-4"><span className="text-gray-300">Al ritmo actual</span><span>{fmt(sel.proy)} t</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-300">Necesario</span><span className="text-emerald-300">{fmt(sel.nec)} t</span></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tabla por frente y por perforista para los días que cumplan enRango(dia):
 * hasta el corte (acumulado) o un solo día (al hacer clic en el gráfico).
 * "Plan mes" es siempre el mes completo.
 */
function construirTabla(conPlan, enRango) {
  const filas = new Map();
  const fila = (f, id, frente, mineral) => {
    const k = `${f.id_faena}|${id ?? frente}|${mineral ? 'MX' : 'EX'}`;
    if (!filas.has(k)) filas.set(k, { key: k, id_faena: f.id_faena, id_frente_trabajo: id ?? null, frente: frente ?? 'Sin frente', mineral, planCorte: 0, planMes: 0, real: 0, leyPlanT: 0, leyPlanW: 0, tonLey: 0, cuW: 0, tronPlan: 0, tronReal: 0, enPlan: false });
    return filas.get(k);
  };
  const perforistas = new Map();
  conPlan.forEach((f) => {
    const p = f.plan;
    const tpd = p.ton_por_disparo || 0;
    p.frentes.forEach((fr) => {
      if (fr.actividad === 'fortificacion') return;
      const r = fila(f, fr.id_frente_trabajo, fr.frente, fr.mineral);
      if (fr.celdas.some((c) => (c.toneladas || 0) > 0)) r.enPlan = true;
      fr.celdas.forEach((c) => {
        const t = c.toneladas || 0;
        r.planMes += t;
        if (!enRango(c.dia)) return;
        r.planCorte += t;
        if (tpd) r.tronPlan += t / tpd;
        if (fr.mineral && fr.ley_esperada != null) { r.leyPlanW += t * fr.ley_esperada; r.leyPlanT += t; }
      });
    });
    f.dumpadas.forEach((d) => {
      if (!enRango(d.dia)) return;
      const r = fila(f, d.id_frente_trabajo, d.frente, d.tipo_material !== 'esteril');
      r.real += d.toneladas; r.tonLey += d.toneladas_con_ley; r.cuW += d.cu_por_ton;
    });
    f.tronaduras.forEach((t) => {
      if (!enRango(t.dia)) return;
      // Las tronaduras van a la fila de mineral del frente si existe, si no a la de estéril
      const kMx = `${f.id_faena}|${t.id_frente_trabajo ?? t.frente}|MX`;
      const r = filas.get(kMx) ?? fila(f, t.id_frente_trabajo, t.frente, !filas.has(`${f.id_faena}|${t.id_frente_trabajo ?? t.frente}|EX`));
      r.tronReal += t.disparos;
      const kp = `${f.id_faena}|${t.id_personal ?? t.perforista}`;
      if (!perforistas.has(kp)) perforistas.set(kp, { id_faena: f.id_faena, nombre: t.perforista, disparos: 0, dias: new Set(), tronPlanDia: p.tronaduras_por_perforista || 0 });
      const pe = perforistas.get(kp);
      pe.disparos += t.disparos; pe.dias.add(t.dia);
    });
  });
  return { filas: [...filas.values()], perforistas: [...perforistas.values()] };
}

export default function PlanVsReal({ faenaIds, nombreFaena }) {
  const hoy = new Date();
  const [mesSel, setMesSel] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [corte, setCorte] = useState(null);
  const [vistaTabla, setVistaTabla] = useState('frentes'); // 'frentes' | 'perforistas'
  const abortRef = useRef(null);
  const idsKey = faenaIds.join(',');

  useEffect(() => {
    if (!idsKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCargando(true);
    setError(null);
    gerencialService.getPlanVsReal({ id_faena: idsKey, anio: mesSel.anio, mes: mesSel.mes }, ctrl.signal)
      .then((r) => { setData(r.data); setCorte(r.data.corte_sugerido); })
      .catch((e) => { if (e.name !== 'CanceledError') setError(e.response?.data?.message ?? 'No se pudo cargar Plan vs Real'); })
      .finally(() => { if (!ctrl.signal.aborted) setCargando(false); });
    return () => ctrl.abort();
  }, [idsKey, mesSel]);

  const calc = useMemo(() => {
    if (!data || corte == null) return null;
    const n = data.dias_mes;
    const conPlan = data.faenas.filter((f) => f.plan);
    const sinPlan = data.faenas.filter((f) => !f.plan);

    const dias = Array.from({ length: n }, (_, i) => ({ dia: i + 1, plan: 0, real: null, planEX: 0, realEX: 0, tronPlan: 0, tronReal: 0 }));
    // Por turno: los que aparecen en el plan o en lo real (AM, PM, Noche, Turno corto…)
    const turnos = {};
    const turno = (t) => { turnos[t] = turnos[t] || { plan: 0, real: 0 }; return turnos[t]; };
    let leyPlanW = 0; let leyPlanT = 0; let leyRealW = 0; let leyRealT = 0;
    let tonReal = 0; let dispReal = 0;

    conPlan.forEach((f) => {
      const p = f.plan;
      p.dias.forEach((d) => {
        if (d.tipo !== 'libre') dias[d.dia - 1].tronPlan += (d.perforistas || 0) * (p.tronaduras_por_perforista || 0);
      });
      p.frentes.forEach((fr) => {
        if (fr.actividad === 'fortificacion') return;
        fr.celdas.forEach((c) => {
          const t = c.toneladas || 0;
          if (fr.mineral) dias[c.dia - 1].plan += t; else dias[c.dia - 1].planEX += t;
          if (c.dia <= corte) {
            if (fr.mineral) turno(c.turno).plan += t;
            if (fr.mineral && fr.ley_esperada != null) { leyPlanW += t * fr.ley_esperada; leyPlanT += t; }
          }
        });
      });

      f.dumpadas.forEach((d) => {
        const mineral = d.tipo_material !== 'esteril';
        if (d.dia <= corte) {
          const dd = dias[d.dia - 1];
          if (mineral) { dd.real = (dd.real || 0) + d.toneladas; turno(d.jornada).real += d.toneladas; } else dd.realEX += d.toneladas;
          if (mineral) { leyRealW += d.cu_por_ton; leyRealT += d.toneladas_con_ley; }
          tonReal += d.toneladas;
        }
      });
      f.tronaduras.forEach((t) => {
        if (t.dia > corte) return;
        dias[t.dia - 1].tronReal += t.disparos;
        dispReal += t.disparos;
      });
    });
    // Días sin dumpadas pero ya pasados: real = 0 (no "sin dato")
    dias.forEach((d) => { if (d.dia <= corte && d.real == null) d.real = 0; });

    const hasta = dias.filter((d) => d.dia <= corte);
    const planMX = hasta.reduce((s, d) => s + d.plan, 0);
    const realMX = hasta.reduce((s, d) => s + (d.real || 0), 0);
    const planEX = hasta.reduce((s, d) => s + d.planEX, 0);
    const realEX = hasta.reduce((s, d) => s + d.realEX, 0);
    const planMesMX = dias.reduce((s, d) => s + d.plan, 0);
    const diasPlan = hasta.filter((d) => d.plan > 0).length;
    const diasPlanMes = dias.filter((d) => d.plan > 0).length;
    const ritmo = diasPlan ? realMX / diasPlan : 0;
    const proyeccion = realMX + ritmo * (diasPlanMes - diasPlan);
    const cumplidos = hasta.filter((d) => d.plan > 0 && (d.real || 0) >= d.plan * 0.9).length;
    const tronPlan = hasta.reduce((s, d) => s + d.tronPlan, 0);
    const tronReal = hasta.reduce((s, d) => s + d.tronReal, 0);

    // Supuestos: plan vs real del mes (a la fecha) vs mes anterior
    const supuestos = conPlan.map((f) => {
      const perfDias = new Set(f.tronaduras.filter((t) => t.dia <= corte).map((t) => `${t.id_personal}|${t.dia}`)).size;
      const disp = f.tronaduras.filter((t) => t.dia <= corte).reduce((s, t) => s + t.disparos, 0);
      const ton = f.dumpadas.filter((d) => d.dia <= corte).reduce((s, d) => s + d.toneladas, 0);
      return {
        id_faena: f.id_faena,
        tpd: { plan: f.plan.ton_por_disparo, real: disp ? ton / disp : null, ant: f.referencia?.ton_por_disparo },
        tpp: { plan: f.plan.tronaduras_por_perforista, real: perfDias ? disp / perfDias : null, ant: f.referencia?.tronaduras_por_perforista },
      };
    });

    const { filas, perforistas } = construirTabla(conPlan, (dia) => dia <= corte);
    const matriz = construirMatriz(conPlan);
    // Orden de los frentes (lo que más falta primero), compartido por la tabla y el mapa de calor
    const orden = Object.fromEntries([...filas].sort((a, b) => (b.planCorte - b.real) - (a.planCorte - a.real)).map((r, i) => [r.key, i]));

    return {
      n, conPlan, sinPlan, dias, turnos, filas, perforistas, matriz, orden,
      planMX, realMX, planEX, realEX, planMesMX, ritmo, proyeccion, diasPlan, cumplidos,
      leyPlan: leyPlanT ? leyPlanW / leyPlanT : null, leyReal: leyRealT ? leyRealW / leyRealT : null,
      tronPlan, tronReal, supuestos, tonReal, dispReal,
    };
  }, [data, corte]);

  // Día elegido en el gráfico diario: la tabla muestra solo ese día
  const [diaSel, setDiaSel] = useState(null);
  useEffect(() => { setDiaSel(null); }, [data, corte]);
  // Filas desplegadas (solo en la vista de un día): clave → { cargando, error, dumpadas }
  const [abiertas, setAbiertas] = useState({});
  useEffect(() => { setAbiertas({}); }, [diaSel, data]);
  const abrirFila = async (r, dia) => {
    setAbiertas((a) => ({ ...a, [r.key]: { cargando: true } }));
    try {
      const fecha = `${mesSel.anio}-${String(mesSel.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const res = await gerencialService.getPlanVsRealDumpadas({
        id_faena: r.id_faena, fecha, id_frente_trabajo: r.id_frente_trabajo ?? undefined, mineral: r.mineral ? 1 : 0,
      });
      setAbiertas((a) => (a[r.key] ? { ...a, [r.key]: { dumpadas: res.data } } : a));
    } catch (e) {
      setAbiertas((a) => (a[r.key] ? { ...a, [r.key]: { error: e.response?.data?.message ?? 'No se pudo cargar el detalle' } } : a));
    }
  };
  const alternarFila = (r) => {
    if (abiertas[r.key]) {
      setAbiertas((a) => { const n = { ...a }; delete n[r.key]; return n; });
      return;
    }
    abrirFila(r, diaSel);
  };
  const tablaDia = useMemo(
    () => (calc && diaSel ? construirTabla(calc.conPlan, (dia) => dia === diaSel) : null),
    [calc, diaSel],
  );
  // Clic en una celda del mapa de calor: se elige ese día y se abre ese frente en la tabla.
  // Va después del efecto que limpia las filas abiertas al cambiar de día.
  const tablaRef = useRef(null);
  const [pendiente, setPendiente] = useState(null); // { key, dia }
  const clicCelda = (key, dia) => { setDiaSel(dia); setPendiente({ key, dia }); };
  useEffect(() => {
    if (!pendiente || !tablaDia || diaSel !== pendiente.dia) return;
    const r = tablaDia.filas.find((x) => x.key === pendiente.key);
    if (r && !abiertas[r.key]) abrirFila(r, pendiente.dia);
    setPendiente(null);
    tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abrirFila/abiertas se leen solo al momento del clic
  }, [pendiente, tablaDia, diaSel]);

  const cambiarMes = (delta) => {
    const d = new Date(mesSel.anio, mesSel.mes - 1 + delta, 1);
    setMesSel({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  };

  const multi = faenaIds.length > 1;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Plan vs Real · {MESES[mesSel.mes - 1]} {mesSel.anio}</h3>
          <p className="text-xs text-gray-500">
            Real = toneladas de las dumpadas por día de llegada a cancha (CyT; las que no tienen CyT, por extracción) y tronaduras de los Reportes de Perforación. El plan se compara solo hasta el día de corte.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-gray-300 rounded-md">
            <button type="button" onClick={() => cambiarMes(-1)} className="p-1.5 hover:bg-gray-50" aria-label="Mes anterior"><HiChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 text-sm font-medium w-32 text-center">{MESES[mesSel.mes - 1]} {mesSel.anio}</span>
            <button type="button" onClick={() => cambiarMes(1)} className="p-1.5 hover:bg-gray-50" aria-label="Mes siguiente"><HiChevronRight className="w-4 h-4" /></button>
          </div>
          {data && (
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              Corte
              <select value={corte ?? 0} onChange={(e) => setCorte(+e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                {Array.from({ length: data.dias_mes }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{String(d).padStart(2, '0')}-{String(mesSel.mes).padStart(2, '0')}</option>
                ))}
              </select>
            </label>
          )}
          {cargando && <FiRefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {calc && calc.sinPlan.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-2 text-sm">
          {calc.sinPlan.map((f) => `${nombreFaena(f.id_faena)} ${f.estado_plan === 'borrador' ? '(plan en borrador, sin publicar)' : '(sin plan)'}`).join(' · ')}
          {calc.conPlan.length ? ' — no entra en la comparación.' : ' — no hay nada que comparar este mes.'}
        </div>
      )}

      {calc && calc.conPlan.length > 0 && (() => {
        const cMx = pct(calc.realMX, calc.planMX);
        const cTr = pct(calc.tronReal, calc.tronPlan);
        const tabla = tablaDia ?? calc;
        const filas = [...tabla.filas].filter((r) => (diaSel ? r.planCorte || r.real || r.tronReal : r.planMes || r.real || r.tronReal))
          .sort((a, b) => (b.planCorte - b.real) - (a.planCorte - a.real));
        const nombreDia = diaSel ? `${DIAS_LARGO[diaSemana(mesSel.anio, mesSel.mes, diaSel)]} ${diaSel}` : '';
        return (
          <>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <Kpi titulo="Mineral a la fecha" valor={cMx != null ? `${fmt(cMx)}%` : '—'} barra={cMx} tono={estadoPct(cMx)}>
                <b className="tabular-nums">{fmt(calc.realMX)}</b> t de <b className="tabular-nums">{fmt(calc.planMX)}</b> t planificadas · faltan <b className="tabular-nums">{fmt(Math.max(calc.planMX - calc.realMX, 0))}</b> t
              </Kpi>
              <Kpi titulo="Proyección fin de mes (mineral)" valor={`${fmt(calc.proyeccion)} t`} barra={pct(calc.proyeccion, calc.planMesMX)} tono="azul">
                al ritmo actual ({fmt(calc.ritmo)} t por día con plan) · plan del mes {fmt(calc.planMesMX)} t → <b>{fmt(pct(calc.proyeccion, calc.planMesMX))}%</b>
              </Kpi>
              <Kpi titulo="Estéril a la fecha" valor={`${fmt(calc.realEX)} t`} barra={pct(calc.realEX, calc.planEX)} tono={estadoPct(pct(calc.realEX, calc.planEX))}>
                plan {fmt(calc.planEX)} t{calc.planEX > 0 && calc.realEX === 0 ? ' · no hay dumpadas de estéril registradas' : ''}
              </Kpi>
              <Kpi titulo="Ley Cu Insoluble · real vs esperada" valor={calc.leyReal != null ? `${fmt(calc.leyReal, 2)}%` : '—'}>
                esperada {calc.leyPlan != null ? <b>{fmt(calc.leyPlan, 2)}%</b> : '— (el plan no trae ley)'} · real solo de dumpadas con resultado de Lab
              </Kpi>
              <Kpi titulo="Tronaduras a la fecha" valor={`${fmt(calc.tronReal)} / ${fmt(calc.tronPlan)}`} barra={cTr} tono={estadoPct(cTr)}>
                {cTr != null ? `${fmt(cTr)}% de lo planificado` : 'el plan no tiene perforistas cargados'}
              </Kpi>
              <Kpi titulo="Días que cumplieron ≥ 90 %" valor={`${calc.cumplidos} / ${calc.diasPlan}`}>días con plan hasta el corte</Kpi>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Día a día</h3>
              <p className="text-xs text-gray-400">Plan contra real de cada día; clic en un día para ver su detalle por frente.</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-gray-800">Avance diario: mineral</h4>
                  <p className="text-xs text-gray-500">Barra = real del día · línea gris = plan · arriba: real / plan en toneladas · clic en un día para ver su detalle por frente en la tabla de abajo. Los días que vienen muestran solo el plan.</p>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: C.real }} />Real</span>
                  <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: C.plan }} />Plan</span>
                  <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: C.bajo }} />Bajo 80 % del plan</span>
                </div>
              </div>
              <GraficoDiario dias={calc.dias} corte={corte} anio={mesSel.anio} mes={mesSel.mes} diaSel={diaSel} onDia={setDiaSel} />
            </div>

            <div ref={tablaRef} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 scroll-mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-gray-800 flex flex-wrap items-center gap-2">
                    {vistaTabla === 'frentes' ? 'Cumplimiento por frente' : 'Tronaduras por perforista'}
                    {diaSel ? (
                      <span className="inline-flex items-center gap-2 text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-3 pr-1 py-0.5">
                        {nombreDia}
                        <button type="button" onClick={() => setDiaSel(null)} className="text-xs font-medium bg-white border border-blue-200 rounded-full px-2 hover:bg-blue-100">
                          Ver acumulado
                        </button>
                      </span>
                    ) : (
                      <span className="text-sm font-normal text-gray-500">acumulado al {String(corte).padStart(2, '0')}-{String(mesSel.mes).padStart(2, '0')}</span>
                    )}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {vistaTabla === 'frentes'
                      ? `${diaSel ? 'Solo ese día: haz clic en un frente para ver sus dumpadas. ' : 'Haz clic en un día del gráfico para ver solo ese día. '}Ordenado por lo que más falta. "Sin plan" = se trabajó un frente que no estaba en el programa. Tronaduras planificadas = toneladas ÷ ton por disparo.`
                      : 'Disparos reales hasta el corte y promedio por día trabajado, contra las tronaduras por perforista del plan.'}
                  </p>
                </div>
                <div className="inline-flex border border-gray-300 rounded-md overflow-hidden text-sm">
                  {[['frentes', 'Por frente'], ['perforistas', 'Por perforista']].map(([id, lbl]) => (
                    <button key={id} type="button" onClick={() => setVistaTabla(id)} className={`px-3 py-1 ${vistaTabla === id ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-600'}`}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                {vistaTabla === 'frentes' ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
                        {multi && <th className="text-left">Faena</th>}
                        <th className="text-left">Frente</th><th className="text-left">Tipo</th>
                        <th className="text-right">{diaSel ? 'Plan del día' : 'Plan a la fecha'}</th><th className="text-right">{diaSel ? 'Real del día' : 'Real'}</th>
                        <th className="text-left min-w-[120px]">Cumplimiento</th><th className="text-right">Diferencia</th>
                        <th className="text-right">Plan mes</th><th className="text-right">Ley esp.</th><th className="text-right">Ley real</th>
                        <th className="text-right">Tronaduras plan / real</th><th className="text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((r, i) => {
                        const c = pct(r.real, r.planCorte);
                        const est = !r.enPlan ? ['gris', 'Sin plan'] : r.planCorte && !r.real ? ['mal', 'Sin movimiento'] : !r.planCorte ? ['gris', 'Aún no parte'] : c >= 95 ? ['ok', 'En línea'] : c >= 80 ? ['atencion', 'Leve atraso'] : ['mal', 'Atrasado'];
                        const dif = r.real - r.planCorte;
                        const ab = abiertas[r.key];
                        const desplegable = !!diaSel && r.real > 0;
                        return (
                          <Fragment key={r.key ?? i}>
                          <tr
                            onClick={desplegable ? () => alternarFila(r) : undefined}
                            className={`border-t border-gray-100 hover:bg-gray-50 [&>td]:px-3 [&>td]:py-1.5 [&>td]:whitespace-nowrap ${desplegable ? 'cursor-pointer' : ''} ${ab ? 'bg-blue-50/50' : ''}`}
                          >
                            {multi && <td>{nombreFaena(r.id_faena)}</td>}
                            <td className="font-semibold text-gray-800">
                              <span className="inline-flex items-center gap-1">
                                {desplegable && <HiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${ab ? '' : '-rotate-90'}`} />}
                                {r.frente}
                              </span>
                            </td>
                            <td><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.mineral ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{r.mineral ? 'Mineral' : 'Estéril'}</span></td>
                            <td className="text-right tabular-nums">{r.planCorte ? fmt(r.planCorte) : '—'}</td>
                            <td className="text-right tabular-nums">{r.real ? fmt(r.real, 1) : '—'}</td>
                            <td><Barra valor={r.planCorte ? c : r.real ? 100 : 0} tono={est[0]} /></td>
                            <td className={`text-right tabular-nums ${dif < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{dif > 0 ? '+' : dif < 0 ? '−' : ''}{fmt(Math.abs(dif), 1)}</td>
                            <td className="text-right tabular-nums">{r.planMes ? fmt(r.planMes) : '—'}</td>
                            <td className="text-right tabular-nums">{r.leyPlanT ? `${fmt(r.leyPlanW / r.leyPlanT, 2)}%` : '—'}</td>
                            <td className="text-right tabular-nums">{r.tonLey ? `${fmt(r.cuW / r.tonLey, 2)}%` : '—'}</td>
                            <td className="text-right tabular-nums">{r.tronPlan ? fmt(r.tronPlan, 1) : '—'} / {r.tronReal || '—'}</td>
                            <td><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CHIP[est[0]]}`}>{est[1]}</span></td>
                          </tr>
                          {ab && (
                            <tr className="bg-blue-50/30">
                              <td colSpan={multi ? 12 : 11} className="px-3 py-2">
                                {ab.cargando && <div className="text-xs text-gray-500">Cargando dumpadas…</div>}
                                {ab.error && <div className="text-xs text-red-600">{ab.error}</div>}
                                {ab.dumpadas && (
                                  <table className="w-full text-xs bg-white border border-gray-200 rounded">
                                    <thead className="text-gray-500">
                                      <tr className="[&>th]:px-2 [&>th]:py-1 [&>th]:font-medium [&>th]:text-left">
                                        <th>N° dumpada</th><th>Llegada (CyT)</th><th>Extracción</th><th>Jornada</th>
                                        <th className="!text-right">Ton</th><th className="!text-right">Ley visual</th><th className="!text-right">Cu Insoluble</th>
                                        <th>Estado Lab</th><th>Dumper</th><th>Operador</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ab.dumpadas.map((d) => {
                                        const otraFecha = d.fecha_cyt && d.fecha !== d.fecha_cyt;
                                        return (
                                          <tr key={d.id} className="border-t border-gray-100 [&>td]:px-2 [&>td]:py-1 whitespace-nowrap">
                                            <td className="font-medium tabular-nums">{d.numero_dumpada}</td>
                                            <td className="tabular-nums">{d.fecha_cyt ? `${fechaCorta(d.fecha_cyt)}${d.hora_cyt ? ` ${d.hora_cyt}` : ''}` : '—'}</td>
                                            <td className={`tabular-nums ${otraFecha ? 'text-amber-700 font-semibold' : ''}`} title={otraFecha ? 'Extraída otro día: llegó a cancha este día' : undefined}>
                                              {d.fecha ? fechaCorta(d.fecha) : '—'}
                                            </td>
                                            <td>{d.jornada ?? '—'}{d.numero_jornada ? ` #${d.numero_jornada}` : ''}</td>
                                            <td className="text-right tabular-nums">{fmt(d.ton, 1)}</td>
                                            <td className="text-right tabular-nums text-gray-500">{d.ley_visual != null ? `${fmt(d.ley_visual, 2)}%` : '—'}</td>
                                            <td className="text-right tabular-nums font-semibold">{d.cu_insoluble != null ? `${fmt(d.cu_insoluble, 2)}%` : <span className="font-normal text-gray-400">esperando Lab</span>}</td>
                                            <td>{d.estado ?? '—'}</td>
                                            <td>{d.dumper ?? '—'}</td>
                                            <td className="max-w-[180px] truncate" title={d.operador ?? undefined}>{d.operador ?? '—'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      {(() => {
                                        const ton = ab.dumpadas.reduce((s2, d) => s2 + d.ton, 0);
                                        const conLey = ab.dumpadas.filter((d) => d.cu_insoluble != null);
                                        const tl = conLey.reduce((s2, d) => s2 + d.ton, 0);
                                        const ley = tl ? conLey.reduce((s2, d) => s2 + d.ton * d.cu_insoluble, 0) / tl : null;
                                        return (
                                          <tr className="border-t border-gray-200 bg-gray-50 font-semibold [&>td]:px-2 [&>td]:py-1">
                                            <td colSpan={4}>{ab.dumpadas.length} dumpadas</td>
                                            <td className="text-right tabular-nums">{fmt(ton, 1)}</td>
                                            <td />
                                            <td className="text-right tabular-nums">{ley != null ? `${fmt(ley, 2)}%` : '—'}</td>
                                            <td colSpan={3} className="font-normal text-gray-500">{conLey.length < ab.dumpadas.length ? `${ab.dumpadas.length - conLey.length} esperando Laboratorio` : 'ley ponderada por toneladas'}</td>
                                          </tr>
                                        );
                                      })()}
                                    </tfoot>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                        {multi && <th className="text-left">Faena</th>}
                        <th className="text-left">Perforista</th><th className="text-right">Disparos</th><th className="text-right">Días con disparos</th>
                        <th className="text-right">Promedio por día</th><th className="text-right">Plan por día</th><th className="text-left min-w-[120px]">vs plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabla.perforistas.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-gray-500">{diaSel ? 'Sin tronaduras registradas ese día.' : 'Sin tronaduras registradas hasta el corte.'}</td></tr>}
                      {[...tabla.perforistas].sort((a, b) => b.disparos - a.disparos).map((p, i) => {
                        const prom = p.dias.size ? p.disparos / p.dias.size : 0;
                        const c = pct(prom, p.tronPlanDia);
                        return (
                          <tr key={i} className="border-t border-gray-100 [&>td]:px-3 [&>td]:py-1.5">
                            {multi && <td>{nombreFaena(p.id_faena)}</td>}
                            <td className="font-medium text-gray-800">{p.nombre}</td>
                            <td className="text-right tabular-nums">{p.disparos}</td>
                            <td className="text-right tabular-nums">{p.dias.size}</td>
                            <td className="text-right tabular-nums font-semibold">{fmt(prom, 2)}</td>
                            <td className="text-right tabular-nums">{fmt(p.tronPlanDia, 2)}</td>
                            <td><Barra valor={c} tono={estadoPct(c)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dónde está la diferencia</h3>
              <p className="text-xs text-gray-400">Qué frentes y qué turnos explican lo que falta.</p>
            </div>
            <MapaCalor
              matriz={calc.matriz}
              orden={calc.orden}
              corte={corte}
              diasMes={calc.n}
              anio={mesSel.anio}
              mes={mesSel.mes}
              multi={multi}
              nombreFaena={nombreFaena}
              onCelda={clicCelda}
            />

            <div className="grid gap-4 lg:grid-cols-2 items-start">
              <AtrasoPorFrente filas={calc.filas} multi={multi} nombreFaena={nombreFaena} />
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-800">Por turno (mineral)</h4>
                  <p className="text-xs text-gray-500">
                    Plan vs real hasta el corte. TN del plan = jornada Noche. El turno real es la jornada registrada en cada dumpada (la de extracción).
                  </p>
                </div>
                {(() => {
                  const lista = Object.entries(calc.turnos).filter(([, v]) => v.plan > 0 || v.real > 0).sort((a, b) => b[1].plan - a[1].plan);
                  const max = Math.max(1, ...lista.map(([, v]) => Math.max(v.plan, v.real)));
                  return lista.map(([t, v]) => (
                    <div key={t} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                      <b className="text-sm">{t === 'Noche' ? 'Noche (TN)' : t}</b>
                      <div className="space-y-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${(v.plan / max) * 100}%`, background: C.plan }} /></div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${(v.real / max) * 100}%`, background: C.real }} /></div>
                      </div>
                      <span className="text-xs tabular-nums text-right">
                        {fmt(v.real)} / {fmt(v.plan)} t<br />
                        <span className="text-gray-500">{v.plan ? `${fmt(pct(v.real, v.plan))}%` : v.real ? 'sin plan' : '—'}</span>
                      </span>
                    </div>
                  ));
                })()}
                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-semibold text-gray-800 text-sm mb-2">Supuestos del plan vs realidad</h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        {multi && <th className="font-medium py-1">Faena</th>}
                        <th className="font-medium py-1">Supuesto</th>
                        <th className="font-medium py-1 text-right">Plan</th>
                        <th className="font-medium py-1 text-right">Real del mes</th>
                        <th className="font-medium py-1 text-right">Mes anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.supuestos.flatMap((s) => [
                        ['Ton por disparo', s.tpd],
                        ['Tronaduras por perforista al día', s.tpp],
                      ].map(([lbl, v]) => (
                        <tr key={`${s.id_faena}${lbl}`} className="border-t border-gray-100">
                          {multi && <td className="py-1">{nombreFaena(s.id_faena)}</td>}
                          <td className="py-1">{lbl}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(v.plan, 2)}</td>
                          <td className={`py-1 text-right tabular-nums font-semibold ${v.plan && v.real != null && v.real < v.plan * 0.9 ? 'text-red-600' : ''}`}>{fmt(v.real, 2)}</td>
                          <td className="py-1 text-right tabular-nums text-gray-500">{fmt(v.ant, 2)}</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">¿Se llega a fin de mes?</h3>
              <p className="text-xs text-gray-400">Cuánto falta, a qué ritmo hay que ir y dónde termina el mes si se sigue igual.</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <h4 className="font-semibold text-gray-800">Acumulado del mes: mineral</h4>
              <p className="text-xs text-gray-500">Toneladas sumadas día a día. Pasa el mouse sobre un día para ver plan, real y diferencia acumulados.</p>
              <GraficoAcumulado dias={calc.dias} corte={corte} ritmo={calc.ritmo} anio={mesSel.anio} mes={mesSel.mes} />
            </div>
            <RitmoNecesario calc={calc} corte={corte} />

          </>
        );
      })()}
    </div>
  );
}
