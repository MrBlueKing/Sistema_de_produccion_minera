import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import InfoPopover from '../../../../shared/components/molecules/InfoPopover';
import { getFaenaColorsById } from '../../../../contexts/faenaColor';
import { crearAsignadorDeFrentes } from '../../utils/chartColors';
import { revisarHoraCyt } from '../../../../utils/revisarHoraCyt';

// Ciclos del Dumper — Dashboard Gerencial > Operaciones.
// El backend (GerencialController::ciclosDumper) solo entrega las vueltas
// (una por dumpada, con hora de CyT y dumper). Aquí se arman los ciclos:
// cada par de vueltas seguidas del mismo dumper en el mismo día de CyT es un
// intervalo; si dura más que el corte es una detención (colación, cambio de
// turno, espera) y no se promedia; si dura menos de MIN_VALIDO es casi seguro
// un error de tipeo y queda "a revisar". Se calcula en el navegador para que
// mover el corte sea inmediato.

const CORTE_DEFECTO = 60;   // min — ver distribución real 29-09..01-10: ciclos ≤48, detenciones ≥74
const MIN_VALIDO = 5;       // min — menos que esto no es una vuelta posible
const FIN_DIA_OPERATIVO = 6; // h — en Cabildo el turno de noche/madrugada cruza la medianoche con la misma fecha de CyT

// Primer mes con hora de vuelta (desde el 07-09-2026): antes no hay nada que mostrar.
const MES_MIN = '2026-09';

const fmt = (v, dec = 1) =>
  v == null || Number.isNaN(v)
    ? '—'
    : Number(v).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dObj = (iso) => new Date(`${iso}T12:00:00`);
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tituloDia = (iso) => { const d = dObj(iso); return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const nombreMes = (ym) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const sumarMes = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return isoLocal(d).slice(0, 7); };
const diasDelMes = (ym) => {
  const n = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
};
const hhmm = (m) => {
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
};
const duracion = (m) =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.round(m)} min`;
const numDumper = (d) => d.replace(/^DUMPER\s*/i, '');

// Minuto dentro del día operativo: lo de antes de las 06:00 va después de las 23:59.
const minutoOperativo = (hora) => {
  const h = +hora.slice(0, 2);
  const m = +hora.slice(3, 5);
  return (h < FIN_DIA_OPERATIVO ? h + 24 : h) * 60 + m;
};

// Vueltas con la hora en duda (solo las con CyT, que traen su `registro`):
//  - hora posterior a su registro, o ~12 h antes (AM/PM cruzado) → utils/revisarHoraCyt;
//  - fuera de orden: el número de dumpada sigue el orden en que se ingresaron
//    las filas de la hoja, así que dentro de un mismo día y faena las horas
//    deberían ir subiendo. Las que no caben en la secuencia creciente más larga
//    quedan marcadas (02-10 AM: 13973 y 13976).
// Los tramos que tocan una vuelta en duda quedan "a revisar" y no se promedian.
function marcarSospechas(vueltas) {
  const out = vueltas.map((v) => ({ ...v, sospechas: [] }));
  out.forEach((v) => {
    if (v.origen !== 'cyt' || !v.registro) return;
    const r = revisarHoraCyt(v.fecha, v.hora, v.registro);
    if (!r) return;
    if (r.tipo === 'am_pm') {
      v.sospechas.push(`Queda 12 h antes de su registro (${r.referencia}): ¿era ${r.sugerencia}?`);
      v.sugerencia = r.sugerencia;
    } else {
      v.sospechas.push(`Hora posterior a su registro (${r.referencia}): imposible`);
    }
  });
  const grupos = {};
  out.forEach((v) => { if (v.origen === 'cyt') (grupos[`${v.id_faena}|${v.fecha}`] ||= []).push(v); });
  Object.values(grupos).forEach((vs) => {
    vs.sort((a, b) => String(a.numero_dumpada).localeCompare(String(b.numero_dumpada), undefined, { numeric: true }));
    const m = vs.map((v) => minutoOperativo(v.hora));
    const largo = m.map(() => 1);
    const previo = m.map(() => -1);
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < i; j++) {
        if (m[j] <= m[i] && largo[j] + 1 > largo[i]) { largo[i] = largo[j] + 1; previo[i] = j; }
      }
    }
    const enOrden = new Set();
    for (let i = largo.indexOf(Math.max(...largo)); i >= 0; i = previo[i]) enOrden.add(i);
    vs.forEach((v, i) => {
      if (enOrden.has(i)) return;
      const antes = vs[i - 1]?.hora; const despues = vs[i + 1]?.hora;
      v.sospechas.push(`Fuera de orden: se ingresó entre vueltas de ${antes ?? '—'} y ${despues ?? '—'}`);
    });
  });
  return out;
}

function armarSeries(vueltas, corte) {
  const grupos = {};
  vueltas.forEach((v) => {
    const k = `${v.id_faena}|${v.fecha}|${v.dumper}`;
    (grupos[k] ||= []).push({ ...v, min: minutoOperativo(v.hora) });
  });
  return Object.values(grupos)
    .map((vs) => {
      vs.sort((a, b) => a.min - b.min || String(a.numero_dumpada).localeCompare(String(b.numero_dumpada), undefined, { numeric: true }));
      const tramos = [];
      for (let i = 1; i < vs.length; i++) {
        const g = vs[i].min - vs[i - 1].min;
        const enDuda = vs[i - 1].sospechas?.length || vs[i].sospechas?.length;
        tramos.push({ a: vs[i - 1], b: vs[i], g, tipo: g < MIN_VALIDO || enDuda ? 'revisar' : g <= corte ? 'ciclo' : 'detencion' });
      }
      return { id_faena: vs[0].id_faena, fecha: vs[0].fecha, dumper: vs[0].dumper, vueltas: vs, tramos };
    })
    .sort((a, b) => a.id_faena - b.id_faena
      || a.dumper.localeCompare(b.dumper, undefined, { numeric: true })
      || a.fecha.localeCompare(b.fecha));
}

function resumir(series) {
  const tramos = series.flatMap((s) => s.tramos);
  const ciclos = tramos.filter((t) => t.tipo === 'ciclo');
  const det = tramos.filter((t) => t.tipo === 'detencion');
  const minCiclo = ciclos.reduce((s, t) => s + t.g, 0);
  const tonCiclo = ciclos.reduce((s, t) => s + t.b.ton, 0);
  const vals = ciclos.map((t) => t.g).sort((a, b) => a - b);
  const n = vals.length;
  return {
    vueltas: series.reduce((s, x) => s + x.vueltas.length, 0),
    ton: series.reduce((s, x) => s + x.vueltas.reduce((a, v) => a + v.ton, 0), 0),
    ciclos: n,
    prom: n ? minCiclo / n : null,
    mediana: n ? (n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2) : null,
    rapido: n ? vals[0] : null,
    lento: n ? vals[n - 1] : null,
    horasCiclo: minCiclo / 60,
    tph: minCiclo ? tonCiclo / (minCiclo / 60) : null,
    detenido: det.reduce((s, t) => s + t.g, 0),
    detenciones: det.length,
    revisar: tramos.filter((t) => t.tipo === 'revisar').length,
  };
}

function useAncho(ref, minimo = 720) {
  const [ancho, setAncho] = useState(minimo);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(minimo, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref, minimo]);
  return ancho;
}

function Kpi({ titulo, valor, unidad, detalle, info }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
        {info && <InfoPopover text={info} className="ml-auto flex-none" />}
      </span>
      <span className="text-2xl font-bold font-mono tabular-nums text-gray-900">
        {valor}{unidad && <span className="text-sm font-medium text-gray-500 ml-1">{unidad}</span>}
      </span>
      {detalle && <span className="text-xs text-gray-500">{detalle}</span>}
    </div>
  );
}

const COLOR_TRAMO = { ciclo: '#059669', detencion: '#9ca3af', revisar: '#dc2626' };

const mediana = (vals) => {
  const v = [...vals].sort((a, b) => a - b); const n = v.length;
  return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : null;
};

// Desglose de un dumper por frente: sus vueltas en cada frente y los ciclos
// que empiezan y terminan en ese frente. Un ciclo en que el dumper cambia de
// frente no es de ninguno de los dos: queda solo en la fila del dumper.
function desglosePorFrente(s) {
  const frentes = [...new Set(s.vueltas.map((v) => v.frente))];
  return frentes.map((frente) => {
    const tramos = s.tramos.filter((t) => t.a.frente === frente && t.b.frente === frente);
    const ciclos = tramos.filter((t) => t.tipo === 'ciclo').map((t) => t.g);
    return {
      frente,
      vueltas: s.vueltas.filter((v) => v.frente === frente),
      tramos,
      ciclos: ciclos.length,
      mediana: mediana(ciclos),
    };
  });
}

function Timeline({ series, colorFrente, nombreFaena }) {
  const caja = useRef(null);
  const W = useAncho(caja);
  const [hover, setHover] = useState(null);
  if (!series.length) {
    return <div ref={caja} className="py-8 text-center text-sm text-gray-400">Sin vueltas registradas este día.</div>;
  }
  const mins = series.flatMap((s) => s.vueltas.map((v) => v.min));
  const t0 = Math.floor((Math.min(...mins) - 15) / 60) * 60;
  const t1 = Math.ceil((Math.max(...mins) + 15) / 60) * 60;
  const L = 190; const R = 16; const fila = 36; const filaFrente = 28; const top = 26;
  // Filas: cada dumper y, debajo, una por cada frente donde cargó ese día.
  const filas = [];
  let yAcum = top;
  series.forEach((s, i) => {
    filas.push({ tipo: 'dumper', s, i, y0: yAcum, alto: fila });
    yAcum += fila;
    desglosePorFrente(s).forEach((d) => {
      filas.push({ tipo: 'frente', s, d, y0: yAcum, alto: filaFrente });
      yAcum += filaFrente;
    });
  });
  const H = yAcum + 6;
  const x = (m) => L + ((m - t0) / (t1 - t0)) * (W - L - R);
  const paso = (t1 - t0) / 60 > 14 ? 120 : 60;
  const horas = [];
  for (let h = t0; h <= t1; h += paso) horas.push(h);

  return (
    <div ref={caja} className="relative overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Vueltas por dumper en el día">
        {horas.map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1={top - 6} y2={H - 4} stroke="#e5e7eb" />
            <text x={x(h)} y={top - 11} textAnchor="middle" fontSize="10" fill="#6b7280">{hhmm(h)}</text>
          </g>
        ))}
        {filas.map((f) => {
          const y = f.y0 + f.alto / 2;
          if (f.tipo === 'frente') {
            const { d } = f;
            return (
              <g key={`${f.s.id_faena}-${f.s.dumper}-${d.frente}`}>
                <rect x={0} y={f.y0} width={W} height={f.alto} fill="#f9fafb" />
                <circle cx={14} cy={y - 4} r={4} fill={colorFrente(d.frente)} />
                <text x={24} y={y - 1} fontSize="10.5" fontWeight="600" fill="#374151">
                  {d.frente.length > 24 ? `${d.frente.slice(0, 23)}…` : d.frente}
                </text>
                <text x={24} y={y + 10} fontSize="9.5" fill="#6b7280">
                  {d.vueltas.length} {d.vueltas.length === 1 ? 'vuelta' : 'vueltas'} · {d.mediana != null ? `ciclo ${fmt(d.mediana)} min` : 'sin ciclo'}
                </text>
                {d.tramos.map((t) => (
                  <line key={`${t.a.id}-${t.b.id}`} x1={x(t.a.min)} x2={x(t.b.min)} y1={y} y2={y}
                    stroke={COLOR_TRAMO[t.tipo]} strokeWidth={t.tipo === 'ciclo' ? 2.5 : 1.5}
                    strokeDasharray={t.tipo === 'detencion' ? '3 4' : undefined} opacity={0.8} />
                ))}
                {d.vueltas.map((v) => (
                  <circle key={v.id} cx={x(v.min)} cy={y} r={4} fill={colorFrente(v.frente)} stroke="#fff" strokeWidth={1}
                    onMouseEnter={(e) => setHover({ px: e.clientX, py: e.clientY, vuelta: v })}
                    onMouseLeave={() => setHover(null)} />
                ))}
              </g>
            );
          }
          const { s, i } = f;
          const cambioFaena = i > 0 && series[i - 1].id_faena !== s.id_faena;
          return (
            <g key={`${s.id_faena}-${s.dumper}`}>
              {i > 0 && <line x1={0} x2={W} y1={f.y0} y2={f.y0} stroke={cambioFaena ? '#9ca3af' : '#e5e7eb'} />}
              <text x={0} y={y - 2} fontSize="12" fontWeight="600" fill="#1f2937">Dumper {numDumper(s.dumper)}</text>
              <text x={0} y={y + 11} fontSize="10" fill={getFaenaColorsById(s.id_faena).primary}>{nombreFaena(s.id_faena)}</text>
              {s.tramos.map((t) => {
                const x1 = x(t.a.min); const x2 = x(t.b.min);
                return (
                  <g key={`${t.a.id}-${t.b.id}`}>
                    <line
                      x1={x1} x2={x2} y1={y} y2={y}
                      stroke={COLOR_TRAMO[t.tipo]}
                      strokeWidth={t.tipo === 'ciclo' ? 3 : 2}
                      strokeDasharray={t.tipo === 'detencion' ? '3 4' : undefined}
                    />
                    {t.tipo === 'detencion' && x2 - x1 > 64 && (
                      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize="9" fill="#6b7280">{duracion(t.g)}</text>
                    )}
                    <line
                      x1={x1} x2={x2} y1={y} y2={y} stroke="transparent" strokeWidth={12}
                      onMouseEnter={(e) => setHover({ px: e.clientX, py: e.clientY, tramo: t })}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
              {s.vueltas.map((v) => (
                <circle
                  key={v.id} cx={x(v.min)} cy={y} r={v.sospechas?.length ? 6 : 5}
                  fill={colorFrente(v.frente)}
                  stroke={v.sospechas?.length ? '#dc2626' : '#fff'} strokeWidth={v.sospechas?.length ? 2.5 : 1.5}
                  onMouseEnter={(e) => setHover({ px: e.clientX, py: e.clientY, vuelta: v })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'default' }}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {hover && (
        <TipFijo px={hover.px} py={hover.py}>
          {hover.vuelta ? (
            <>
              <div className="font-semibold">{hover.vuelta.hora} · Dumpada {hover.vuelta.numero_dumpada}</div>
              <div>{hover.vuelta.frente} · {fmt(hover.vuelta.ton)} t</div>
              <div className="text-gray-300">{hover.vuelta.operador || 'Sin operador'}</div>
              <div className="text-gray-400">{hover.vuelta.codigo}</div>
              {hover.vuelta.origen === 'reconstruida' && (
                <div className="text-amber-300">Hora reconstruida (antes del CyT): hora de la dumpada + día de registro</div>
              )}
              {hover.vuelta.sospechas?.map((t) => <div key={t} className="text-red-300">{t}</div>)}
            </>
          ) : (
            <>
              <div className="font-semibold">{hhmm(hover.tramo.a.min)} → {hhmm(hover.tramo.b.min)} · {duracion(hover.tramo.g)}</div>
              <div>{hover.tramo.tipo === 'ciclo' ? 'Ciclo' : hover.tramo.tipo === 'detencion' ? 'Detención (sobre el corte)' : hover.tramo.g < MIN_VALIDO ? 'Revisar: menos de 5 min entre vueltas' : 'Revisar: una de las dos vueltas tiene la hora en duda'}</div>
              {hover.tramo.a.frente !== hover.tramo.b.frente && (
                <div className="text-amber-300">Cambio de frente: {hover.tramo.a.frente} → {hover.tramo.b.frente} (no se cuenta en ningún frente)</div>
              )}
            </>
          )}
        </TipFijo>
      )}
    </div>
  );
}

function Distribucion({ series, corte, faenas, nombreFaena }) {
  const caja = useRef(null);
  const W = useAncho(caja);
  const B = 5; const MAX = 150; const nb = MAX / B + 1;
  const cnt = {};
  faenas.forEach((f) => { cnt[f] = Array(nb).fill(0); });
  series.forEach((s) => s.tramos.forEach((t) => {
    if (cnt[s.id_faena]) cnt[s.id_faena][Math.min(Math.floor(t.g / B), nb - 1)] += 1;
  }));
  const mx = Math.max(1, ...faenas.flatMap((f) => cnt[f]));
  const H = 170; const L = 34; const R = 10; const T = 16; const Bt = 30;
  const bw = (W - L - R) / nb;
  const y = (v) => T + (1 - v / mx) * (H - T - Bt);
  const pasoY = mx > 12 ? Math.ceil(mx / 4) : mx > 4 ? 2 : 1;
  const ticks = [];
  for (let v = 0; v <= mx; v += pasoY) ticks.push(v);
  const xc = L + (corte / B) * bw;

  return (
    <div ref={caja} className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Distribución de minutos entre vueltas">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e5e7eb" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{v}</text>
          </g>
        ))}
        {Array.from({ length: nb }, (_, i) => {
          const lo = i * B; const x0 = L + i * bw; const w = (bw - 2) / faenas.length;
          return (
            <g key={i}>
              {faenas.map((f, j) => {
                const c = cnt[f][i];
                if (!c) return null;
                return (
                  <rect key={f} x={x0 + 1 + j * w} y={y(c)} width={w} height={H - Bt - y(c)} rx={1.5}
                    fill={getFaenaColorsById(f).primary} fillOpacity={lo >= corte ? 0.3 : 0.85}>
                    <title>{`${nombreFaena(f)}: ${c} intervalos de ${i === nb - 1 ? `${lo} min o más` : `${lo}–${lo + B} min`}`}</title>
                  </rect>
                );
              })}
              {(i % 2 === 0 || i === nb - 1) && (
                <text x={x0 + bw / 2} y={H - Bt + 14} textAnchor="middle" fontSize="10" fill="#6b7280">{i === nb - 1 ? `≥${lo}` : lo}</text>
              )}
            </g>
          );
        })}
        <line x1={xc} x2={xc} y1={T - 8} y2={H - Bt} stroke="#1f2937" strokeWidth={2} strokeDasharray="5 3" />
        <text x={xc + 5} y={T} fontSize="11" fontWeight="700" fill="#1f2937">corte {corte} min</text>
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="#6b7280">minutos entre una vuelta y la siguiente del mismo dumper</text>
      </svg>
    </div>
  );
}

// Un ciclo se le atribuye al operador de la vuelta que lo cierra (la que
// llega). Si en el día cambió el operador del dumper, el ciclo del cambio
// queda para el que entra. Las vueltas sin operador (todo lo anterior al
// 29-09, cuando el campo se hizo obligatorio) no aparecen aquí.
function porOperador(series) {
  const g = {};
  series.forEach((s) => {
    s.vueltas.forEach((v) => {
      if (!v.operador) return;
      const k = `${s.id_faena}|${v.operador}`;
      const o = (g[k] ||= { id_faena: s.id_faena, operador: v.operador, vueltas: 0, ton: 0, dumpers: new Set(), dias: new Set(), ciclos: [], tonCiclo: 0 });
      o.vueltas += 1;
      o.ton += v.ton;
      o.dumpers.add(s.dumper);
      o.dias.add(s.fecha);
    });
    s.tramos.forEach((t) => {
      if (t.tipo !== 'ciclo' || !t.b.operador) return;
      const o = g[`${s.id_faena}|${t.b.operador}`];
      o.ciclos.push(t.g);
      o.tonCiclo += t.b.ton;
    });
  });
  return Object.values(g).map((o) => {
    const min = o.ciclos.reduce((a, b) => a + b, 0);
    return {
      ...o,
      dumpers: [...o.dumpers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      dias: o.dias.size,
      nCiclos: o.ciclos.length,
      prom: o.ciclos.length ? min / o.ciclos.length : null,
      tph: min ? o.tonCiclo / (min / 60) : null,
    };
  }).sort((a, b) => a.id_faena - b.id_faena || (a.prom ?? 1e9) - (b.prom ?? 1e9));
}

function Operadores({ series, nombreFaena }) {
  const filas = porOperador(series);
  const sinOperador = series.reduce((s, x) => s + x.vueltas.filter((v) => !v.operador).length, 0);
  if (!filas.length) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Ninguna vuelta del período tiene operador. El operador se registra desde el 29-09-2026.
      </p>
    );
  }
  const escala = Math.max(...filas.map((f) => f.prom ?? 0)) * 1.1 || 1;
  const medianaFaena = {};
  [...new Set(filas.map((f) => f.id_faena))].forEach((id) => {
    const v = series.filter((s) => s.id_faena === id).flatMap((s) => s.tramos.filter((t) => t.tipo === 'ciclo' && t.b.operador).map((t) => t.g)).sort((a, b) => a - b);
    const n = v.length;
    medianaFaena[id] = n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : null;
  });
  let faenaPrev = null;

  return (
    <div className="flex flex-col gap-1.5">
      {filas.map((f) => {
        const color = getFaenaColorsById(f.id_faena).primary;
        const titulo = f.id_faena !== faenaPrev;
        faenaPrev = f.id_faena;
        const med = medianaFaena[f.id_faena];
        return (
          <div key={`${f.id_faena}-${f.operador}`}>
            {titulo && (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 mt-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {nombreFaena(f.id_faena)}
                {med != null && <span className="font-normal text-gray-400">· mediana de la faena {fmt(med, 0)} min (línea punteada)</span>}
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-gray-800 truncate" title={f.operador}>{f.operador}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {f.dumpers.map((d) => `D${numDumper(d)}`).join(', ')} · {f.dias} día{f.dias === 1 ? '' : 's'}
                </div>
              </div>
              <div className="relative h-5 bg-gray-50 rounded">
                {f.prom != null && (
                  <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(f.prom / escala) * 100}%`, backgroundColor: color, opacity: 0.8 }} />
                )}
                {med != null && (
                  <div className="absolute -inset-y-0.5 border-l-2 border-dashed border-gray-700" style={{ left: `${(med / escala) * 100}%` }} />
                )}
                <span className="absolute inset-y-0 left-2 flex items-center font-mono font-semibold text-white text-[11px] drop-shadow">
                  {f.prom != null ? `${fmt(f.prom)} min` : ''}
                </span>
              </div>
              <div className="text-right tabular-nums text-gray-500 whitespace-nowrap w-40">
                <span className="text-gray-800 font-semibold">{f.vueltas}</span> vueltas · {f.nCiclos} ciclos · {fmt(f.tph)} t/h
              </div>
            </div>
          </div>
        );
      })}
      {sinOperador > 0 && (
        <p className="text-[11px] text-gray-400 mt-2">
          {sinOperador.toLocaleString('es-CL')} vueltas del período no tienen operador (se registra desde el 29-09) y no entran en este gráfico.
        </p>
      )}
    </div>
  );
}

// Tooltip sobre la pantalla (position: fixed), fuera del contenedor con scroll del
// gráfico: dibujado adentro, al salirse por abajo o por la derecha hacía aparecer
// barras de scroll y la página saltaba. Se mide y se da vuelta hacia arriba / se
// corre hacia adentro si no cabe en la ventana.
function TipFijo({ px, py, children }) {
  const el = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!el.current) return;
    const { width: w, height: h } = el.current.getBoundingClientRect();
    const left = Math.min(Math.max(px - w / 2, 8), window.innerWidth - w - 8);
    const abajo = py + 14;
    const top = abajo + h > window.innerHeight - 8 ? py - h - 14 : abajo;
    setPos({ left, top: Math.max(top, 8) });
  }, [px, py, children]);
  return (
    <div
      ref={el}
      className="pointer-events-none fixed z-50 rounded-md bg-gray-900 text-white text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {children}
    </div>
  );
}

function Tip({ x, y, ancho, children }) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md bg-gray-900 text-white text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap"
      style={{ left: Math.min(Math.max(x - 110, 0), Math.max(ancho - 260, 0)), top: y }}
    >
      {children}
    </div>
  );
}

// Indicadores de una faena (día o mes). `refMes` = resumen del mes, para comparar el día contra él.
function KpisFaena({ r, refMes }) {
  const dif = refMes && r.prom != null && refMes.prom != null ? r.prom - refMes.prom : null;
  const comparacion = dif == null ? null : Math.abs(dif) < 0.5
    ? <> · igual al mes</>
    : <> · <span className={`font-semibold ${dif > 0 ? 'text-orange-600' : 'text-blue-600'}`}>{dif > 0 ? '+' : '−'}{fmt(Math.abs(dif))} vs mes</span></>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Kpi titulo="Min/vuelta" valor={fmt(r.prom)} unidad="min" detalle={<>mediana {fmt(r.mediana, 0)}{comparacion}</>} />
      <Kpi titulo="Vueltas" valor={r.vueltas.toLocaleString('es-CL')} detalle={`${r.ciclos} ciclos · ${fmt(r.prom ? 60 / r.prom : null)}/h`} />
      <Kpi titulo="Ton/hora" valor={fmt(r.tph)} unidad="t/h" detalle="en ciclo" />
      <Kpi
        titulo="Detenido" valor={fmt(r.detenido / 60)} unidad="h"
        detalle={<>{r.detenciones} detenciones{r.revisar > 0 && <> · <span className="font-semibold text-red-600">{r.revisar} a revisar</span></>}</>}
      />
    </div>
  );
}

function Calendario({ mes, series, faenas, diaActivo, onDia }) {
  const conteo = {};
  series.forEach((s) => { const c = (conteo[s.fecha] ||= {}); c[s.id_faena] = (c[s.id_faena] || 0) + s.vueltas.length; });
  const dias = diasDelMes(mes);
  const offset = (dObj(dias[0]).getDay() + 6) % 7; // la semana parte el lunes
  const hoy = isoLocal(new Date());
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-[3px]">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="text-[10px] font-bold text-gray-400 text-center">{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {dias.map((d) => {
          const c = conteo[d];
          const tot = c ? Object.values(c).reduce((a, b) => a + b, 0) : 0;
          const activo = d === diaActivo;
          return (
            <button
              key={d} type="button" disabled={!tot} onClick={() => onDia(d)}
              title={tot ? `${tituloDia(d)}: ${tot} vueltas` : 'Sin vueltas'}
              className={`relative h-11 rounded-md border flex flex-col items-center justify-center gap-0.5 ${
                !tot ? 'border-transparent cursor-default'
                  : activo ? 'border-emerald-600 ring-1 ring-inset ring-emerald-600 bg-emerald-50'
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
            >
              <span className={`text-[13px] leading-none ${tot ? 'font-semibold text-gray-900' : 'text-gray-300'}`}>{+d.slice(8)}</span>
              {tot > 0 && (
                <>
                  <span className="text-[9.5px] leading-none text-gray-500 tabular-nums">{tot} v</span>
                  <span className="flex gap-0.5 h-1">
                    {faenas.filter((f) => c[f]).map((f) => (
                      <i key={f} className="w-[5px] h-1 rounded-sm" style={{ backgroundColor: getFaenaColorsById(f).primary }} />
                    ))}
                  </span>
                </>
              )}
              {d === hoy && <span className="absolute top-[3px] right-1 w-[5px] h-[5px] rounded-full bg-blue-600" title="Hoy" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Mapa de calor: color = min/vuelta del día contra la mediana de la faena en el mes.
const TRAMOS_CALOR = [
  { max: 0.85, bg: '#2563eb', fg: '#ffffff', texto: '15% o más rápido' },
  { max: 0.95, bg: '#bfdbfe', fg: '#1e3a8a', texto: '5–15% más rápido' },
  { max: 1.05, bg: '#e5e7eb', fg: '#374151', texto: 'normal (±5%)' },
  { max: 1.15, bg: '#fed7aa', fg: '#7c2d12', texto: '5–15% más lento' },
  { max: Infinity, bg: '#ea580c', fg: '#ffffff', texto: '15% o más lento' },
];
const RAYADO = 'repeating-linear-gradient(135deg, transparent 0 4px, #f3f4f6 4px 6px)';

function MapaCalor({ series, mes, medianaFaena, nombreFaena, onDia }) {
  const caja = useRef(null);
  const [hover, setHover] = useState(null);
  const dias = diasDelMes(mes);
  const filas = useMemo(() => {
    const g = {};
    series.forEach((s) => { ((g[`${s.id_faena}|${s.dumper}`] ||= { id_faena: s.id_faena, dumper: s.dumper, dias: {} }).dias[s.fecha] = s); });
    return Object.values(g)
      .map((f) => ({ ...f, total: resumir(Object.values(f.dias)) }))
      .sort((a, b) => a.id_faena - b.id_faena || a.dumper.localeCompare(b.dumper, undefined, { numeric: true }));
  }, [series]);

  const mostrar = (e, contenido) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ px: r.left + r.width / 2, py: r.bottom - 8, contenido });
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={caja} className="relative overflow-x-auto">
        <table className="border-separate [border-spacing:2px] tabular-nums">
          <thead>
            <tr>
              <th />
              {dias.map((d) => {
                const wd = dObj(d).getDay();
                return (
                  <th key={d} className={`min-w-[28px] text-[10px] font-semibold text-center ${wd === 0 || wd === 6 ? 'text-gray-400' : 'text-gray-500'}`}>
                    {+d.slice(8)}<span className="block text-[9px] font-normal text-gray-400">{'DLMMJVS'[wd]}</span>
                  </th>
                );
              })}
              <th className="pl-2.5 text-right text-[10px] font-semibold text-gray-500">Mes</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={`${f.id_faena}-${f.dumper}`}>
                <th className={`text-left pr-2 whitespace-nowrap min-w-[92px] ${i > 0 && filas[i - 1].id_faena !== f.id_faena ? 'pt-2.5' : ''}`}>
                  <span className="block text-xs font-semibold text-gray-800">Dumper {numDumper(f.dumper)}</span>
                  <span className="block text-[10px] font-semibold" style={{ color: getFaenaColorsById(f.id_faena).primary }}>{nombreFaena(f.id_faena)}</span>
                </th>
                {dias.map((d) => {
                  const s = f.dias[d];
                  const r = s ? resumir([s]) : null;
                  const sep = i > 0 && filas[i - 1].id_faena !== f.id_faena ? 'pt-2.5' : '';
                  if (!r || r.prom == null) {
                    return (
                      <td key={d} className={sep}>
                        <div className="h-[30px] rounded" style={{ background: RAYADO }} title={s ? `${s.vueltas.length} vueltas, sin ciclos` : 'Sin vueltas'} />
                      </td>
                    );
                  }
                  const med = medianaFaena[f.id_faena];
                  const t = TRAMOS_CALOR.find((x) => r.prom / med <= x.max);
                  return (
                    <td key={d} className={sep}>
                      <button
                        type="button" onClick={() => onDia(d)}
                        onMouseEnter={(e) => mostrar(e, (
                          <>
                            <div className="font-semibold">Dumper {numDumper(f.dumper)} · {tituloDia(d)}</div>
                            <div>{fmt(r.prom)} min/vuelta · {r.vueltas} vueltas</div>
                            <div className="text-gray-300">mediana {nombreFaena(f.id_faena)} del mes: {fmt(med, 0)} min · {t.texto}</div>
                            <div className="text-gray-400">detenido {fmt(r.detenido / 60)} h · clic para ver el día</div>
                          </>
                        ))}
                        onMouseLeave={() => setHover(null)}
                        className="w-full min-w-[28px] h-[30px] rounded font-mono text-[11px] font-semibold hover:outline hover:outline-2 hover:-outline-offset-1 hover:outline-gray-900"
                        style={{ backgroundColor: t.bg, color: t.fg }}
                      >
                        {Math.round(r.prom)}
                      </button>
                    </td>
                  );
                })}
                <td className={`pl-2.5 text-right font-mono text-xs font-bold whitespace-nowrap ${i > 0 && filas[i - 1].id_faena !== f.id_faena ? 'pt-2.5' : ''}`}>
                  {fmt(f.total.prom)} <span className="font-normal text-gray-500">min</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hover && <TipFijo px={hover.px} py={hover.py}>{hover.contenido}</TipFijo>}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
        {TRAMOS_CALOR.map((t) => (
          <span key={t.texto} className="inline-flex items-center gap-1 mr-2">
            <i className="inline-block w-6 h-3 rounded-sm" style={{ backgroundColor: t.bg }} />{t.texto}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <i className="inline-block w-6 h-3 rounded-sm" style={{ background: 'repeating-linear-gradient(135deg, transparent 0 4px, #e5e7eb 4px 6px)' }} />sin vueltas
        </span>
      </div>
    </div>
  );
}

// Eje X compartido por los dos gráficos diarios: día 1, múltiplos de 5 y el último.
function EjeDias({ diario, x, y }) {
  return diario.map((o, i) => {
    const n = +o.d.slice(8);
    if (!(n === 1 || n % 5 === 0 || i === diario.length - 1)) return null;
    return <text key={o.d} x={x(i)} y={y} textAnchor="middle" fontSize="10" fill="#6b7280">{n}</text>;
  });
}

// Hover/clic por columna de día, para los gráficos diarios.
function useColumnaDia(diario, faenas, L, paso) {
  const [hi, setHi] = useState(null);
  const indice = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - L) / paso);
    return i >= 0 && i < diario.length && faenas.some((f) => diario[i][f]) ? i : null;
  };
  return { hi, setHi, indice };
}

function LineaDiaria({ diario, faenas, medianaFaena, nombreFaena, onDia }) {
  const caja = useRef(null);
  const W = useAncho(caja, 640);
  const H = 220; const L = 40; const R = 96; const T = 14; const B = 26;
  const paso = (W - L - R) / diario.length;
  const { hi, setHi, indice } = useColumnaDia(diario, faenas, L, paso);
  const vals = diario.flatMap((o) => faenas.map((f) => o[f]?.prom)).filter((v) => v != null);
  const yMax = Math.ceil((Math.max(10, ...vals) + 2) / 10) * 10;
  const x = (i) => L + (i + 0.5) * paso;
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const ticks = [];
  for (let v = 0; v <= yMax; v += 10) ticks.push(v);

  return (
    <div ref={caja} className="relative overflow-x-auto">
      <svg
        width={W} height={H} role="img" aria-label="Minutos por vuelta por día y faena"
        onMouseMove={(e) => setHi(indice(e))} onMouseLeave={() => setHi(null)}
        onClick={(e) => { const i = indice(e); if (i != null) onDia(diario[i].d); }}
        style={{ cursor: hi != null ? 'pointer' : 'default' }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eef0f2" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{v}</text>
          </g>
        ))}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="#9ca3af" strokeDasharray="2 3" />}
        {faenas.map((f) => {
          const c = getFaenaColorsById(f).primary;
          let d = ''; let previo = false;
          diario.forEach((o, i) => {
            const v = o[f]?.prom;
            if (v == null) { previo = false; return; }
            d += `${previo ? 'L' : 'M'}${x(i)},${y(v)} `;
            previo = true;
          });
          const med = medianaFaena[f];
          return (
            <g key={f}>
              {med != null && (
                <>
                  <line x1={L} x2={W - R} y1={y(med)} y2={y(med)} stroke={c} strokeDasharray="4 4" opacity={0.55} />
                  <text x={W - R + 8} y={y(med) + 4} fontSize="11" fontWeight="600" fill="#374151">{nombreFaena(f)} {fmt(med, 0)}</text>
                </>
              )}
              <path d={d} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
              {diario.map((o, i) => (o[f]?.prom != null
                ? <circle key={o.d} cx={x(i)} cy={y(o[f].prom)} r={hi === i ? 5 : 4} fill={c} stroke="#fff" strokeWidth={2} />
                : null))}
            </g>
          );
        })}
        <EjeDias diario={diario} x={x} y={H - B + 16} />
      </svg>
      {hi != null && (
        <Tip x={x(hi)} y={4} ancho={W}>
          <div className="font-semibold">{tituloDia(diario[hi].d)}</div>
          {faenas.map((f) => diario[hi][f] && (
            <div key={f}>{nombreFaena(f)}: {fmt(diario[hi][f].prom)} min/vuelta · {diario[hi][f].vueltas} vueltas</div>
          ))}
          <div className="text-gray-400">clic para ver el día</div>
        </Tip>
      )}
    </div>
  );
}

function BarrasDiarias({ diario, faenas, nombreFaena, onDia }) {
  const caja = useRef(null);
  const W = useAncho(caja, 640);
  const H = 170; const L = 40; const R = 96; const T = 10; const B = 26;
  const paso = (W - L - R) / diario.length;
  const { hi, setHi, indice } = useColumnaDia(diario, faenas, L, paso);
  const totales = diario.map((o) => faenas.reduce((a, f) => a + (o[f]?.vueltas || 0), 0));
  const yMax = Math.ceil(Math.max(10, ...totales) / 20) * 20;
  const bw = Math.min(18, paso - 4);
  const x = (i) => L + (i + 0.5) * paso;
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const ticks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];

  return (
    <div ref={caja} className="relative overflow-x-auto">
      <svg
        width={W} height={H} role="img" aria-label="Vueltas por día y faena"
        onMouseMove={(e) => setHi(indice(e))} onMouseLeave={() => setHi(null)}
        onClick={(e) => { const i = indice(e); if (i != null) onDia(diario[i].d); }}
        style={{ cursor: hi != null ? 'pointer' : 'default' }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eef0f2" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{v}</text>
          </g>
        ))}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="#9ca3af" strokeDasharray="2 3" />}
        {diario.map((o, i) => {
          let base = 0;
          const presentes = faenas.filter((f) => o[f]?.vueltas);
          return (
            <g key={o.d}>
              {presentes.map((f, j) => {
                const v = o[f].vueltas;
                const y0 = y(base); const y1 = y(base + v);
                base += v;
                return (
                  <rect
                    key={f} x={x(i) - bw / 2} y={y1} width={bw}
                    height={Math.max(0, y0 - y1 - (j > 0 ? 2 : 0))}
                    rx={j === presentes.length - 1 ? 3 : 0}
                    fill={getFaenaColorsById(f).primary}
                  />
                );
              })}
            </g>
          );
        })}
        <EjeDias diario={diario} x={x} y={H - B + 16} />
      </svg>
      {hi != null && (
        <Tip x={x(hi)} y={4} ancho={W}>
          <div className="font-semibold">{tituloDia(diario[hi].d)}</div>
          {faenas.map((f) => diario[hi][f] && <div key={f}>{nombreFaena(f)}: {diario[hi][f].vueltas} vueltas</div>)}
          <div className="text-gray-400">clic para ver el día</div>
        </Tip>
      )}
    </div>
  );
}

function LeyendaFaenas({ faenas, nombreFaena, linea = false }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {faenas.map((f) => (
        <span key={f} className="inline-flex items-center gap-1.5">
          <i className={linea ? 'inline-block w-4 h-0.5 rounded' : 'inline-block w-2.5 h-2.5 rounded-sm'} style={{ backgroundColor: getFaenaColorsById(f).primary }} />
          {nombreFaena(f)}
        </span>
      ))}
    </div>
  );
}

function VueltasARevisar({ vueltas, nombreFaena, conFecha = false }) {
  if (!vueltas.length) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 flex flex-col gap-2 min-w-0">
      <div>
        <h4 className="text-sm font-semibold text-red-800">Vueltas con la hora en duda ({vueltas.length})</h4>
        <p className="text-xs text-red-700/80">
          No entran al promedio. Compáralas con la hoja de Dispatch y corrígelas con el lápiz de la dumpada.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs tabular-nums">
          <thead className="text-[10px] uppercase tracking-wide text-gray-500">
            <tr className="border-b border-red-200">
              <th className="px-2 py-1.5 text-left">N°</th>
              <th className="px-2 py-1.5 text-left">Faena</th>
              <th className="px-2 py-1.5 text-left">Dumper</th>
              {conFecha && <th className="px-2 py-1.5 text-left">Fecha CyT</th>}
              <th className="px-2 py-1.5 text-right">Hora CyT</th>
              <th className="px-2 py-1.5 text-right">Registrada</th>
              <th className="px-2 py-1.5 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {vueltas.map((v) => (
              <tr key={v.id}>
                <td className="px-2 py-1.5 font-mono font-semibold">{v.numero_dumpada}</td>
                <td className="px-2 py-1.5">{nombreFaena(v.id_faena)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">Dumper {numDumper(v.dumper)}</td>
                {conFecha && <td className="px-2 py-1.5 whitespace-nowrap">{v.fecha.slice(8, 10)}-{v.fecha.slice(5, 7)}</td>}
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-red-700">{v.hora}</td>
                <td className="px-2 py-1.5 text-right font-mono text-gray-600 whitespace-nowrap">{v.registro ? `${v.registro.slice(8, 10)}-${v.registro.slice(5, 7)} ${v.registro.slice(11, 16)}` : '—'}</td>
                <td className="px-2 py-1.5 text-gray-700">{v.sospechas.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bloque({ titulo, detalle, children }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-2 min-w-0">
      <div>
        <h4 className="text-sm font-semibold text-gray-800">{titulo}</h4>
        {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
      </div>
      {children}
    </div>
  );
}

// `mes` (YYYY-MM) lo maneja ProduccionDashboard, que trae las vueltas de ese mes.
export default function CiclosDumper({ data, loading = false, nombreFaena = (id) => `Faena ${id}`, mes, onCambiarMes }) {
  const [corte, setCorte] = useState(CORTE_DEFECTO);
  const [vista, setVista] = useState('dia');
  const [dia, setDia] = useState(null);
  const [verTablaDiaria, setVerTablaDiaria] = useState(false);
  const asignadorRef = useRef(null);
  if (!asignadorRef.current) asignadorRef.current = crearAsignadorDeFrentes();

  const vueltas = useMemo(() => data?.vueltas ?? [], [data]);
  const reconstruidas = vueltas.filter((v) => v.origen === 'reconstruida').length;

  const vueltasMarcadas = useMemo(() => marcarSospechas(vueltas), [vueltas]);
  const enDuda = useMemo(
    () => vueltasMarcadas.filter((v) => v.sospechas.length)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.numero_dumpada).localeCompare(String(b.numero_dumpada), undefined, { numeric: true })),
    [vueltasMarcadas],
  );
  const series = useMemo(() => armarSeries(vueltasMarcadas, corte), [vueltasMarcadas, corte]);
  const faenas = useMemo(() => [...new Set(series.map((s) => s.id_faena))].sort(), [series]);
  const dias = useMemo(() => [...new Set(series.map((s) => s.fecha))].sort(), [series]);
  // Si el día elegido no está en el mes cargado, se muestra el último con vueltas.
  const diaActivo = dias.includes(dia) ? dia : dias[dias.length - 1];
  const iDia = dias.indexOf(diaActivo);
  const seriesDia = series.filter((s) => s.fecha === diaActivo);
  const frentesDia = [...new Set(seriesDia.flatMap((s) => s.vueltas.map((v) => v.frente)))].sort();
  const irDia = (d) => { setDia(d); setVista('dia'); };

  const resumenMes = useMemo(
    () => Object.fromEntries(faenas.map((f) => [f, resumir(series.filter((s) => s.id_faena === f))])),
    [series, faenas],
  );
  const medianaFaena = useMemo(
    () => Object.fromEntries(faenas.map((f) => [f, resumenMes[f].mediana])),
    [faenas, resumenMes],
  );
  const diario = useMemo(() => diasDelMes(mes).map((d) => {
    const o = { d };
    faenas.forEach((f) => {
      const ss = series.filter((s) => s.id_faena === f && s.fecha === d);
      o[f] = ss.length ? resumir(ss) : null;
    });
    return o;
  }), [mes, series, faenas]);

  const porDumper = useMemo(() => {
    const g = {};
    series.forEach((s) => { (g[`${s.id_faena}|${s.dumper}`] ||= []).push(s); });
    return Object.values(g).map((ss) => ({
      id_faena: ss[0].id_faena,
      dumper: ss[0].dumper,
      operadores: [...new Set(ss.flatMap((s) => s.vueltas.map((v) => v.operador).filter(Boolean)))],
      dias: ss.length,
      ...resumir(ss),
    }));
  }, [series]);
  const total = useMemo(() => resumir(series), [series]);
  const mesActual = isoLocal(new Date()).slice(0, 7);

  const botonVista = (id, label) => (
    <button
      type="button" onClick={() => setVista(id)} aria-pressed={vista === id}
      className={`px-4 py-1.5 text-xs ${vista === id ? 'bg-emerald-600 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  );
  const botonFlecha = 'w-[30px] h-[30px] rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white';

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FiRefreshCw className="text-emerald-600 w-5 h-5" />
          <h3 className="text-base font-semibold text-gray-800">Ciclos del Dumper</h3>
          <InfoPopover
            className="ml-1"
            text={`Se ordenan las dumpadas de cada dumper por día y hora de la vuelta (la hora de la fila en la hoja de Dispatch: desde el 29-09 es la hora de CyT; entre el 07-09 y el 28-09 es la hora de la dumpada, con el día en que se registró). El tiempo entre una vuelta y la siguiente es un ciclo si no supera el corte; si lo supera es una detención (colación, cambio de turno, espera) y no entra al promedio. Menos de ${MIN_VALIDO} min entre vueltas no es posible y queda "a revisar"; también quedan a revisar las vueltas con la hora en duda (posterior a su registro, 12 h antes de su registro, o fuera del orden en que se ingresaron). Min/vuelta = minutos en ciclo ÷ cantidad de ciclos. Ton/h = toneladas de las vueltas que cierran un ciclo ÷ horas en ciclo. Las vueltas antes de las 06:00 cuentan como parte de la noche del mismo día de CyT.`}
          />
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          Tiempo entre vueltas de cada dumper. Desde el 29-09-2026 la hora sale del CyT; entre el 07-09 y el 28-09 se reconstruye con la hora de la dumpada y el día en que se registró. Antes del 07-09 no se guardaba la hora de la vuelta.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden divide-x divide-gray-300" role="group" aria-label="Vista">
            {botonVista('dia', 'Día')}
            {botonVista('mes', 'Mes')}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <button type="button" className={botonFlecha} disabled={mes <= MES_MIN} onClick={() => onCambiarMes(sumarMes(mes, -1))} aria-label="Mes anterior">‹</button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-gray-800 first-letter:uppercase">{nombreMes(mes)}</span>
            <button type="button" className={botonFlecha} disabled={mes >= mesActual} onClick={() => onCambiarMes(sumarMes(mes, 1))} aria-label="Mes siguiente">›</button>
          </div>
          <label className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Corte</span>
            <input
              type="range" min={20} max={120} step={5} value={corte}
              onChange={(e) => setCorte(+e.target.value)}
              className="w-32 accent-emerald-600"
              aria-label="Corte en minutos"
            />
            <span className="font-mono font-bold text-gray-800 w-14">{corte} min</span>
            {corte !== CORTE_DEFECTO && (
              <button type="button" onClick={() => setCorte(CORTE_DEFECTO)} className="text-emerald-700 hover:underline">
                volver a {CORTE_DEFECTO}
              </button>
            )}
          </label>
        </div>
        {(reconstruidas > 0 || (data?.sin_datos ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            {reconstruidas > 0 && (
              <span className="text-gray-500">
                {reconstruidas.toLocaleString('es-CL')} de {vueltas.length.toLocaleString('es-CL')} vueltas reconstruidas (antes del 29-09)
              </span>
            )}
            {(data?.sin_datos ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-700">
                <FiAlertCircle className="w-3.5 h-3.5" />
                {data.sin_datos} dumpada{data.sin_datos === 1 ? '' : 's'} del mes sin hora de vuelta o sin dumper (no entran al cálculo)
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto" /></div>
      ) : !vueltas.length ? (
        <div className="p-10 text-center text-gray-400 text-sm">Sin vueltas con hora de CyT y dumper en {nombreMes(mes)}</div>
      ) : (
        <>
        {vista === 'dia' ? (
        <div className="p-4 flex flex-col gap-5">
          <div className="grid gap-6 md:grid-cols-[minmax(250px,290px)_minmax(0,1fr)] items-start">
            <div className="flex flex-col gap-2">
              <Calendario mes={mes} series={series} faenas={faenas} diaActivo={diaActivo} onDia={setDia} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                {faenas.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1">
                    <i className="inline-block w-2.5 h-1 rounded-sm" style={{ backgroundColor: getFaenaColorsById(f).primary }} />{nombreFaena(f)}
                  </span>
                ))}
                <span>número = vueltas del día</span>
              </div>
            </div>
            <div className="flex flex-col gap-3.5 min-w-0">
              <div className="flex items-center gap-2">
                <button type="button" className={botonFlecha} disabled={iDia <= 0} onClick={() => setDia(dias[iDia - 1])} aria-label="Día anterior con vueltas">‹</button>
                <h4 className="text-lg font-semibold text-gray-900 first-letter:uppercase">{tituloDia(diaActivo)}</h4>
                <button type="button" className={botonFlecha} disabled={iDia >= dias.length - 1} onClick={() => setDia(dias[iDia + 1])} aria-label="Día siguiente con vueltas">›</button>
              </div>
              {faenas.map((f) => {
                const ss = seriesDia.filter((s) => s.id_faena === f);
                if (!ss.length) return null;
                const reconstruido = ss.some((s) => s.vueltas.some((v) => v.origen === 'reconstruida'));
                return (
                  <div key={f} className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getFaenaColorsById(f).primary }} />
                      <span className="font-semibold text-gray-800">{nombreFaena(f)}</span>
                      · {ss.length} dumper{ss.length === 1 ? '' : 's'}
                      {reconstruido && <span className="text-amber-700">· hora reconstruida</span>}
                    </div>
                    <KpisFaena r={resumir(ss)} refMes={resumenMes[f]} />
                  </div>
                );
              })}
            </div>
          </div>

          <Bloque titulo="Vueltas por dumper" detalle="Cada punto es una dumpada (color = frente). Verde = ciclo · gris punteado = detención · rojo = revisar. Debajo de cada dumper, sus vueltas separadas por frente con la mediana del ciclo en ese frente; un ciclo en que cambió de frente solo se ve en la fila del dumper.">
            <Timeline series={seriesDia} colorFrente={asignadorRef.current} nombreFaena={nombreFaena} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
              {frentesDia.map((f) => (
                <span key={f} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: asignadorRef.current(f) }} />{f}
                </span>
              ))}
            </div>
          </Bloque>

          <VueltasARevisar vueltas={enDuda.filter((v) => v.fecha === diaActivo)} nombreFaena={nombreFaena} />
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-5">
          {/* KPIs del mes por faena */}
          <div className={`grid gap-4 ${faenas.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {faenas.map((f) => {
              const ss = series.filter((s) => s.id_faena === f);
              const nDias = new Set(ss.map((s) => s.fecha)).size;
              const nDumpers = new Set(ss.map((s) => s.dumper)).size;
              return (
                <div key={f} className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getFaenaColorsById(f).primary }} />
                    <span className="font-semibold text-gray-800">{nombreFaena(f)}</span>
                    <span className="text-gray-500">· {nDias} día{nDias === 1 ? '' : 's'} con vueltas · {nDumpers} dumper{nDumpers === 1 ? '' : 's'}</span>
                  </div>
                  <KpisFaena r={resumenMes[f]} />
                </div>
              );
            })}
          </div>

          <VueltasARevisar vueltas={enDuda} nombreFaena={nombreFaena} conFecha />

          <Bloque titulo="Min/vuelta por dumper y día" detalle="Cada celda es el promedio del día, coloreado contra la mediana de su faena en el mes. Clic en una celda abre ese día.">
            <MapaCalor series={series} mes={mes} medianaFaena={medianaFaena} nombreFaena={nombreFaena} onDia={irDia} />
          </Bloque>

          <Bloque titulo="Min/vuelta por día" detalle="Promedio de cada faena. La línea punteada es la mediana del mes.">
            <LeyendaFaenas faenas={faenas} nombreFaena={nombreFaena} linea />
            <LineaDiaria diario={diario} faenas={faenas} medianaFaena={medianaFaena} nombreFaena={nombreFaena} onDia={irDia} />
          </Bloque>

          <Bloque titulo="Vueltas por día" detalle="Apiladas por faena.">
            <LeyendaFaenas faenas={faenas} nombreFaena={nombreFaena} />
            <BarrasDiarias diario={diario} faenas={faenas} nombreFaena={nombreFaena} onDia={irDia} />
            <button type="button" onClick={() => setVerTablaDiaria((v) => !v)} className="self-start text-xs text-emerald-700 hover:underline">
              {verTablaDiaria ? 'Ocultar' : 'Ver'} tabla con los números del mes
            </button>
            {verTablaDiaria && (
              <div className="overflow-x-auto">
                <table className="text-xs tabular-nums">
                  <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Día</th>
                      {faenas.map((f) => (
                        <th key={f} colSpan={3} className="px-3 py-1.5 text-center">{nombreFaena(f)}</th>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-200">
                      <th />
                      {faenas.map((f) => ['Vueltas', 'Min/vuelta', 'Detenido (h)'].map((c) => (
                        <th key={`${f}-${c}`} className="px-3 py-1.5 text-right font-medium">{c}</th>
                      )))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {diario.filter((o) => faenas.some((f) => o[f])).map((o) => (
                      <tr key={o.d} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 whitespace-nowrap first-letter:uppercase">{tituloDia(o.d)}</td>
                        {faenas.map((f) => (o[f] ? (
                          <Fragment key={f}>
                            <td className="px-3 py-1.5 text-right">{o[f].vueltas}</td>
                            <td className="px-3 py-1.5 text-right font-semibold">{fmt(o[f].prom)}</td>
                            <td className="px-3 py-1.5 text-right">{fmt(o[f].detenido / 60)}</td>
                          </Fragment>
                        ) : (
                          <Fragment key={f}>
                            <td className="px-3 py-1.5 text-right text-gray-300">—</td>
                            <td className="px-3 py-1.5 text-right text-gray-300">—</td>
                            <td className="px-3 py-1.5 text-right text-gray-300">—</td>
                          </Fragment>
                        )))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloque>
        </div>
        )}

        {/* Comunes a Día y Mes: siempre sobre todo el mes */}
        <div className="px-4 pb-4 flex flex-col gap-5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 border-t pt-4 first-letter:uppercase">Todo {nombreMes(mes)}</h4>
          <Bloque
            titulo="Ciclos por operador"
            detalle="Min/vuelta de cada operador en el mes. Cada ciclo se cuenta para quien hizo la vuelta que lo cierra. Ojo: el frente influye (un frente más lejos da ciclos más largos), compara dentro de la misma faena."
          >
            <Operadores series={series} nombreFaena={nombreFaena} />
          </Bloque>

          <Bloque titulo="Distribución del tiempo entre vueltas" detalle="Todo el mes. A la izquierda del corte cuentan como ciclos; a la derecha, como detenciones.">
            <Distribucion series={series} corte={corte} faenas={faenas} nombreFaena={nombreFaena} />
          </Bloque>

          {/* Tabla por dumper */}
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs tabular-nums min-w-[900px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Faena</th>
                  <th className="px-3 py-2 text-left">Dumper</th>
                  <th className="px-3 py-2 text-left">Operador</th>
                  <th className="px-3 py-2 text-right">Días</th>
                  <th className="px-3 py-2 text-right">Vueltas</th>
                  <th className="px-3 py-2 text-right">Ciclos</th>
                  <th className="px-3 py-2 text-right">Min/vuelta</th>
                  <th className="px-3 py-2 text-right">Mediana</th>
                  <th className="px-3 py-2 text-right">Más rápido</th>
                  <th className="px-3 py-2 text-right">Más lento</th>
                  <th className="px-3 py-2 text-right">Horas en ciclo</th>
                  <th className="px-3 py-2 text-right">Detenido</th>
                  <th className="px-3 py-2 text-right">Toneladas</th>
                  <th className="px-3 py-2 text-right">t/h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {porDumper.map((r) => (
                  <tr key={`${r.id_faena}-${r.dumper}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getFaenaColorsById(r.id_faena).primary }} />
                        {nombreFaena(r.id_faena)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                      Dumper {numDumper(r.dumper)}
                      {r.revisar > 0 && <span className="ml-1.5 rounded bg-red-100 text-red-700 px-1 text-[10px]">{r.revisar} revisar</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[220px]">{r.operadores.join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-right">{r.dias}</td>
                    <td className="px-3 py-2 text-right">{r.vueltas}</td>
                    <td className="px-3 py-2 text-right">{r.ciclos}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(r.prom)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.mediana, 0)}</td>
                    <td className="px-3 py-2 text-right">{r.rapido ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{r.lento ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.horasCiclo)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.detenido / 60)} h</td>
                    <td className="px-3 py-2 text-right">{fmt(r.ton)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.tph)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>Total</td>
                  <td className="px-3 py-2 text-right">{total.vueltas}</td>
                  <td className="px-3 py-2 text-right">{total.ciclos}</td>
                  <td className="px-3 py-2 text-right">{fmt(total.prom)}</td>
                  <td className="px-3 py-2 text-right">{fmt(total.mediana, 0)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">{fmt(total.horasCiclo)}</td>
                  <td className="px-3 py-2 text-right">{fmt(total.detenido / 60)} h</td>
                  <td className="px-3 py-2 text-right">{fmt(total.ton)}</td>
                  <td className="px-3 py-2 text-right">{fmt(total.tph)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
