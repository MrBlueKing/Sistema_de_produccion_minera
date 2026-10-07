import { HiPlus, HiTrash } from 'react-icons/hi2';
import { MESES, capacidadRuta, capacidadFaena, metaPerforacion, fmt } from '../../utils/planCalculos';

// Supuestos de perforación y de transporte del plan. Debajo de cada supuesto va
// lo que dio en la realidad el mes anterior (Reportes de Perforación + dumpadas),
// para que el plan parta de algo medido.

function Campo({ id, label, value, onChange, editable, referencia, refTexto }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        id={id}
        disabled={!editable}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-full border border-gray-300 rounded-md px-2 py-1.5 tabular-nums disabled:bg-gray-50"
      />
      <span className="text-xs text-gray-500">
        {referencia != null ? <>Mes anterior real: <b className="text-gray-700 tabular-nums">{fmt(referencia, 2)}</b> <span className="text-gray-400">{refTexto}</span></> : 'Mes anterior: sin datos'}
      </span>
    </label>
  );
}

export default function SupuestosPlan({ estado, setEstado, editable, referencia, toneladasGrilla }) {
  const set = (campo, valor) => setEstado((e) => ({ ...e, [campo]: valor }));
  const meta = metaPerforacion(estado.dias, parseFloat(String(estado.ton_por_disparo).replace(',', '.')), parseFloat(String(estado.tronaduras_por_perforista).replace(',', '.')));
  const grilla = toneladasGrilla.mx + toneladasGrilla.ex;
  const dif = grilla - meta.toneladas;
  const descuadre = meta.toneladas > 0 && Math.abs(dif) > meta.toneladas * 0.02;
  const cap = capacidadFaena(estado.rutas);
  const picos = Object.entries(toneladasGrilla.porDia).filter(([, v]) => cap > 0 && v > cap);
  const refMes = referencia ? `${MESES[referencia.mes - 1]}` : '';

  const setRuta = (i, campo, valor) => setEstado((e) => ({ ...e, rutas: e.rutas.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)) }));
  const agregarRuta = () => setEstado((e) => ({ ...e, rutas: [...e.rutas, { nombre: 'Mina → Cancha', ciclo_min: 15, dumpers: 2, peso_ton: 4, horas: 7, cuenta_capacidad: true }] }));
  const quitarRuta = (i) => setEstado((e) => ({ ...e, rutas: e.rutas.filter((_, j) => j !== i) }));

  const inputRuta = 'w-16 border border-gray-200 rounded px-1 py-0.5 text-right tabular-nums disabled:bg-transparent disabled:border-transparent';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-800">Perforación</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="sup-ton-disparo" label="Ton por disparo" editable={editable}
            value={estado.ton_por_disparo} onChange={(v) => set('ton_por_disparo', v)}
            referencia={referencia?.ton_por_disparo}
            refTexto={referencia?.disparos ? `(${refMes}: ${fmt(referencia.toneladas)} t / ${referencia.disparos} disparos)` : ''}
          />
          <Campo
            id="sup-tronaduras" label="Tronaduras por perforista al día" editable={editable}
            value={estado.tronaduras_por_perforista} onChange={(v) => set('tronaduras_por_perforista', v)}
            referencia={referencia?.tronaduras_por_perforista}
            refTexto={referencia?.perforista_dias ? `(${refMes}: ${referencia.disparos} disparos / ${referencia.perforista_dias} días-perforista)` : ''}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="[&_td]:py-1.5 [&_td]:border-b [&_td]:border-gray-100">
              <tr><td className="text-gray-600">Días trabajados <span className="text-gray-400">(con turno corto / con turno largo)</span></td><td className="text-right tabular-nums">{meta.trabajados} <span className="text-gray-400">({meta.tc} / {meta.tl})</span></td></tr>
              <tr><td className="text-gray-600">Tronaduras planificadas (Σ perforistas del día × tronaduras)</td><td className="text-right tabular-nums">{fmt(meta.tronaduras)}</td></tr>
              <tr><td className="font-semibold text-gray-800">Meta de perforación</td><td className="text-right font-semibold tabular-nums">{fmt(meta.toneladas)} t</td></tr>
              <tr><td className="text-gray-600">Grilla: mineral + estéril</td><td className="text-right tabular-nums">{fmt(toneladasGrilla.mx)} + {fmt(toneladasGrilla.ex)} = {fmt(grilla)} t</td></tr>
            </tbody>
          </table>
        </div>
        {meta.toneladas > 0 && (
          <div className={`rounded-lg px-3 py-2 text-sm ${descuadre ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
            {descuadre
              ? <>La grilla y la meta de perforación no calzan: diferencia de <b className="tabular-nums">{dif > 0 ? '+' : ''}{fmt(dif)} t</b>. Revisa perforistas por día, los supuestos o las toneladas de la grilla.</>
              : <>La grilla calza con la meta de perforación.</>}
          </div>
        )}
        <p className="text-xs text-gray-500">Los perforistas y el tipo de cada día se cambian en la cabecera de la grilla (pestaña Programa por frente).</p>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-800">Transporte (capacidad por día)</h3>
          {editable && (
            <button type="button" onClick={agregarRuta} className="flex items-center gap-1 text-sm px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50">
              <HiPlus className="w-4 h-4" /> Ruta
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-left">
                <th className="py-1 pr-2 font-medium">Ruta</th>
                <th className="py-1 px-1 font-medium text-right">Ciclo (min)</th>
                <th className="py-1 px-1 font-medium text-right">Dumpers</th>
                <th className="py-1 px-1 font-medium text-right">Peso (t)</th>
                <th className="py-1 px-1 font-medium text-right">Horas</th>
                <th className="py-1 px-1 font-medium text-right">t/día</th>
                <th className="py-1 px-1 font-medium text-center" title="Desmárcala para rutas de re-manejo (ej. Cancha A → Cancha B), que no limitan lo que sale de la mina">Limita mina</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {estado.rutas.length === 0 && (
                <tr><td colSpan={8} className="py-3 text-gray-500">Sin rutas: no se puede revisar la capacidad de transporte.</td></tr>
              )}
              {estado.rutas.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1 pr-2">
                    <input aria-label="Nombre de la ruta" disabled={!editable} value={r.nombre} onChange={(e) => setRuta(i, 'nombre', e.target.value)} className="w-full min-w-[140px] border border-gray-200 rounded px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {['ciclo_min', 'dumpers', 'peso_ton', 'horas'].map((c) => (
                    <td key={c} className="py-1 px-1 text-right">
                      <input aria-label={c} disabled={!editable} value={r[c] ?? ''} onChange={(e) => setRuta(i, c, e.target.value)} inputMode="decimal" className={inputRuta} />
                    </td>
                  ))}
                  <td className="py-1 px-1 text-right tabular-nums font-semibold">{fmt(capacidadRuta({ ...r, ciclo_min: parseFloat(r.ciclo_min), dumpers: parseFloat(r.dumpers), peso_ton: parseFloat(r.peso_ton), horas: parseFloat(r.horas) }), 1)}</td>
                  <td className="py-1 px-1 text-center">
                    <input type="checkbox" aria-label="Limita lo que sale de la mina" disabled={!editable} checked={r.cuenta_capacidad !== false} onChange={(e) => setRuta(i, 'cuenta_capacidad', e.target.checked)} />
                  </td>
                  {editable && (
                    <td className="py-1 pl-1"><button type="button" onClick={() => quitarRuta(i)} className="p-1 text-gray-300 hover:text-red-600" title="Quitar ruta"><HiTrash className="w-4 h-4" /></button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`rounded-lg px-3 py-2 text-sm ${picos.length ? 'bg-red-50 text-red-900' : 'bg-gray-50 text-gray-700'}`}>
          Capacidad mina → cancha: <b className="tabular-nums">{fmt(cap)} t/día</b>.{' '}
          {picos.length
            ? <>Hay <b>{picos.length} días</b> que piden más de lo que se puede transportar ({picos.map(([d]) => d).join(', ')}).</>
            : cap > 0 ? 'Ningún día supera la capacidad.' : ''}
        </div>
        <p className="text-xs text-gray-500">Capacidad = (60 ÷ ciclo) × dumpers × peso × horas. El ciclo real se puede ver en Operaciones → Ciclos del Dumper.</p>
      </section>
    </div>
  );
}
