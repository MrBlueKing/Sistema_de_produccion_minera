import { memo, useCallback, useMemo, useState } from 'react';
import { HiPlus, HiTrash } from 'react-icons/hi2';
import SearchableSelect from '../../../../shared/components/atoms/SearchableSelect';
import { ACTIVIDADES, ACTIVIDAD, TIPOS_DIA, DIA_CORTO, diaSemana, esMineral, etiquetaTurno as etiquetaBase, fmt } from '../../utils/planCalculos';

// Grilla del programa: una fila por frente + actividad, columnas día × turno.
// Las celdas guardan texto mientras se escribe ("12," es válido a medio tipear);
// se convierte a número recién al guardar (ver DashboardPlanificacion.aPayload).
// Se puede pegar un bloque copiado desde Excel en cualquier celda: se reparte
// hacia la derecha (días/turnos) y hacia abajo (frentes siguientes).

const num = (v) => parseFloat(String(v).replace(',', '.')) || 0;

// Color por actividad: texto de las celdas, franja a la izquierda del frente y total de la fila.
const ESTILO_ACT = {
  mineral: { texto: 'text-amber-700', franja: 'border-l-amber-500', total: 'bg-amber-50 text-amber-800' },
  esteril: { texto: 'text-slate-600', franja: 'border-l-slate-500', total: 'bg-slate-100 text-slate-700' },
  fortificacion: { texto: 'text-gray-500', franja: 'border-l-gray-300', total: 'bg-gray-50 text-gray-500' },
};
const estiloAct = (a) => (a === 'fortificacion' ? ESTILO_ACT.fortificacion : esMineral(a) ? ESTILO_ACT.mineral : ESTILO_ACT.esteril);

// Tipo de día: etiqueta corta en la cabecera y color de fondo de la columna.
const TIPO_DIA_UI = {
  habil: { label: 'Hábil', cab: 'bg-white', celda: '' },
  libre: { label: 'Libre', cab: 'bg-gray-100 text-gray-400', celda: 'bg-gray-100' },
};

// Borde izquierdo de cada día: más marcado al empezar la semana (lunes).
const bordeDia = (anio, mes, dia) => (diaSemana(anio, mes, dia) === 1 && dia > 1 ? 'border-l-2 border-l-gray-400' : 'border-l border-l-gray-300');

// Cada día tiene sus propios turnos. Un día sin turnos (ej. libre) igual ocupa
// una columna angosta, para que se vea en la grilla.
const colsDia = (d) => (d.turnos?.length ? d.turnos : [null]);

// Bordes de una columna (día d, turno j): separador del día y, si es hoy, el
// contorno azul de toda la columna del día (izquierda en su primer turno,
// derecha en el último).
const HOY_IZQ = 'border-l-2 border-l-sky-500';
const HOY_DER = 'border-r-2 border-r-sky-500';
const bordeCol = (anio, mes, d, j, diaHoy) => {
  const hoy = d.dia === diaHoy;
  const izq = j === 0 ? (hoy ? HOY_IZQ : bordeDia(anio, mes, d.dia)) : '';
  const der = hoy && j === colsDia(d).length - 1 ? HOY_DER : '';
  return `${izq} ${der}`;
};
const bordeDiaCompleto = (anio, mes, d, diaHoy) => (d.dia === diaHoy ? `${HOY_IZQ} ${HOY_DER}` : bordeDia(anio, mes, d.dia));

const FilaFrente = memo(function FilaFrente({ fila, idx, dias, anio, mes, diaHoy, editable, opcionesFrente, leyRef, onCampo, onCelda, onPegar, onQuitar }) {
  const total = Object.values(fila.celdas).reduce((s, v) => s + num(v), 0);
  const sinTon = ACTIVIDAD[fila.actividad]?.sinToneladas;
  const est = estiloAct(fila.actividad);
  const vacia = !sinTon && total === 0;
  return (
    <tr className="group">
      <td className={`sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 border-l-4 ${est.franja} px-2 py-1 align-top`}>
        <div className="flex items-start gap-1.5 w-[250px]">
          <div className="flex-1 min-w-0 space-y-1">
            {editable ? (
              <SearchableSelect
                size="sm"
                options={opcionesFrente}
                value={fila.id_frente_trabajo ?? ''}
                onChange={(v) => onCampo(idx, 'id_frente_trabajo', v ? +v : null)}
                placeholder="Elegir frente…"
              />
            ) : (
              <div className="text-sm font-semibold text-gray-800 truncate" title={fila.frente}>{fila.frente}</div>
            )}
            <div className="flex items-center gap-1">
              <select
                aria-label="Actividad"
                disabled={!editable}
                value={fila.actividad}
                onChange={(e) => onCampo(idx, 'actividad', e.target.value)}
                className={`text-xs border border-gray-200 rounded px-1 py-0.5 bg-white disabled:bg-transparent disabled:border-transparent ${est.texto}`}
              >
                {ACTIVIDADES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <input
                aria-label="Ley esperada %"
                disabled={!editable || sinTon}
                value={fila.ley_esperada ?? ''}
                onChange={(e) => onCampo(idx, 'ley_esperada', e.target.value)}
                placeholder={sinTon ? '' : leyRef ? fmt(leyRef.ley, 2) : 'Ley %'}
                title={leyRef ? `Mes anterior real: ${fmt(leyRef.ley, 2)} % (${fmt(leyRef.toneladas)} t con resultado de Lab)` : undefined}
                className="w-16 text-xs border border-gray-200 rounded px-1 py-0.5 tabular-nums placeholder:text-sky-400 disabled:bg-transparent disabled:border-transparent"
              />
              {!sinTon && leyRef && editable && (fila.ley_esperada === '' || fila.ley_esperada == null) && (
                <button
                  type="button"
                  onClick={() => onCampo(idx, 'ley_esperada', String(leyRef.ley))}
                  title={`Usar la ley real del mes anterior (${fmt(leyRef.toneladas)} t con resultado de Lab)`}
                  className="text-[11px] text-sky-600 hover:underline whitespace-nowrap"
                >
                  usar {fmt(leyRef.ley, 2)}
                </button>
              )}
              {!sinTon && leyRef && fila.ley_esperada !== '' && fila.ley_esperada != null && (
                <span className="text-[11px] text-gray-400 whitespace-nowrap" title="Ley real del mes anterior">ant. {fmt(leyRef.ley, 2)}</span>
              )}
              {vacia && <span className="text-[11px] text-red-600" title="Esta fila no tiene toneladas: quítala o llénala">sin toneladas</span>}
            </div>
          </div>
          {editable && (
            <button type="button" onClick={() => onQuitar(idx)} title="Quitar frente" className="mt-1 p-1 text-gray-300 hover:text-red-600">
              <HiTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
      {dias.map((d) => colsDia(d).map((t, j) => {
        if (!t) {
          return <td key={`${d.dia}|-`} className={`border-b border-gray-100 ${bordeCol(anio, mes, d, 0, diaHoy)} ${TIPO_DIA_UI[d.tipo]?.celda}`}><div className="w-6" /></td>;
        }
        const k = `${d.dia}|${t}`;
        const v = fila.celdas[k];
        const enLibre = d.tipo === 'libre' && v;
        return (
          <td
            key={k}
            title={enLibre ? 'Hay toneladas en un día marcado "Libre": cambia el tipo de día o borra la celda' : undefined}
            className={`border-b border-gray-100 p-0 ${bordeCol(anio, mes, d, j, diaHoy)} ${enLibre ? 'bg-red-100' : TIPO_DIA_UI[d.tipo]?.celda}`}
          >
            <input
              aria-label={`${fila.frente ?? 'Frente'} día ${d.dia} ${t}`}
              disabled={!editable}
              value={v ?? ''}
              onChange={(e) => onCelda(idx, k, e.target.value)}
              onPaste={(e) => onPegar(e, idx, d.dia, t)}
              inputMode="decimal"
              className={`w-10 text-center text-xs tabular-nums py-1.5 bg-transparent focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400 ${v ? `font-semibold ${enLibre ? 'text-red-700' : est.texto}` : ''}`}
            />
          </td>
        );
      }))}
      <td className={`border-b border-l border-gray-200 px-2 text-right text-xs font-semibold tabular-nums whitespace-nowrap ${est.total}`}>
        {sinTon ? `${Object.keys(fila.celdas).filter((k) => fila.celdas[k]).length} turnos` : fmt(total)}
      </td>
    </tr>
  );
});

export default function GrillaPlan({ estado, setEstado, turnos: turnosConfig, anio, mes, editable, frentesDisponibles, capacidad, leyesRef = {} }) {
  const { dias, frentes } = estado;
  // turnosConfig = jornadas activas de Configuración General [{ nombre, abreviatura, color }]
  const turnos = useMemo(() => turnosConfig.map((t) => t.nombre), [turnosConfig]);
  const abrev = useMemo(() => Object.fromEntries(turnosConfig.map((t) => [t.nombre, t.abreviatura])), [turnosConfig]);
  const colorTurno = useMemo(() => Object.fromEntries(turnosConfig.map((t) => [t.nombre, t.color])), [turnosConfig]);
  const etiquetaTurno = (t) => etiquetaBase(t, abrev);
  const ordenar = (lista) => [...turnos.filter((t) => lista.includes(t)), ...lista.filter((t) => !turnos.includes(t))];
  const [semanaOrigen, setSemanaOrigen] = useState('');
  const hoy = new Date();
  const diaHoy = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes ? hoy.getDate() : null;

  const opcionesFrente = useMemo(
    () => frentesDisponibles.map((f) => ({ value: f.id, label: f.codigo })),
    [frentesDisponibles],
  );

  const setFrentes = useCallback((fn) => setEstado((e) => ({ ...e, frentes: fn(e.frentes) })), [setEstado]);

  const onCampo = useCallback((idx, campo, valor) => setFrentes((fs) => fs.map((f, i) => {
    if (i !== idx) return f;
    const nf = { ...f, [campo]: valor };
    if (campo === 'id_frente_trabajo') nf.frente = frentesDisponibles.find((x) => x.id === valor)?.codigo ?? null;
    return nf;
  })), [setFrentes, frentesDisponibles]);

  const onCelda = useCallback((idx, k, valor) => setFrentes((fs) => fs.map((f, i) => {
    if (i !== idx) return f;
    const celdas = { ...f.celdas };
    const v = valor.trim();
    if (!v) delete celdas[k]; else celdas[k] = v;
    return { ...f, celdas };
  })), [setFrentes]);

  // Orden plano de columnas (día, turno) para repartir lo pegado desde Excel.
  const columnas = useMemo(() => dias.flatMap((d) => (d.turnos || []).map((t) => `${d.dia}|${t}`)), [dias]);

  const onPegar = useCallback((e, idx, dia, turno) => {
    const texto = e.clipboardData.getData('text');
    if (!texto.includes('\t') && !texto.includes('\n')) return; // un solo valor: pegado normal
    e.preventDefault();
    const filas = texto.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((r) => r.split('\t'));
    const c0 = columnas.indexOf(`${dia}|${turno}`);
    setFrentes((fs) => fs.map((f, i) => {
      const r = filas[i - idx];
      if (i < idx || !r) return f;
      const celdas = { ...f.celdas };
      r.forEach((v, j) => {
        const k = columnas[c0 + j];
        if (!k) return;
        const val = String(v).trim();
        if (!val) delete celdas[k]; else celdas[k] = val;
      });
      return { ...f, celdas };
    }));
  }, [setFrentes, columnas]);

  const onQuitar = useCallback((idx) => setFrentes((fs) => fs.filter((_, i) => i !== idx)), [setFrentes]);
  // Llena las leyes vacías (filas de mineral) con la ley real del mes anterior de cada frente.
  const sinLey = frentes.filter((f) => esMineral(f.actividad) && (f.ley_esperada === '' || f.ley_esperada == null) && leyesRef[f.id_frente_trabajo]).length;
  const usarLeyesAnteriores = () => setFrentes((fs) => fs.map((f) => (
    esMineral(f.actividad) && (f.ley_esperada === '' || f.ley_esperada == null) && leyesRef[f.id_frente_trabajo]
      ? { ...f, ley_esperada: String(leyesRef[f.id_frente_trabajo].ley) }
      : f
  )));
  const agregar = () => setFrentes((fs) => [...fs, { key: `n${Date.now()}`, id_frente_trabajo: null, frente: null, actividad: 'preparacion', ley_esperada: '', celdas: {} }]);

  const setDia = (dia, campo, valor) => setEstado((e) => ({
    ...e,
    dias: e.dias.map((d) => {
      if (d.dia !== dia) return d;
      const nd = { ...d, [campo]: valor };
      // Un día que pasa de libre a trabajado parte con AM y PM
      if (campo === 'tipo' && valor !== 'libre' && !(d.turnos || []).length) nd.turnos = ['AM', 'PM'];
      return nd;
    }),
  }));

  const agregarTurno = (dia, turno) => setEstado((e) => ({
    ...e,
    dias: e.dias.map((d) => (d.dia === dia ? { ...d, turnos: ordenar([...(d.turnos || []), turno]) } : d)),
  }));

  const quitarTurno = (dia, turno) => {
    const k = `${dia}|${turno}`;
    const conDatos = frentes.filter((f) => f.celdas[k]).length;
    if (conDatos && !window.confirm(`El turno ${etiquetaTurno(turno)} del día ${dia} tiene datos en ${conDatos} ${conDatos === 1 ? 'frente' : 'frentes'}. ¿Quitarlo y borrar esas celdas?`)) return;
    setEstado((e) => ({
      ...e,
      dias: e.dias.map((d) => (d.dia === dia ? { ...d, turnos: (d.turnos || []).filter((t) => t !== turno) } : d)),
      frentes: e.frentes.map((f) => {
        if (!f.celdas[k]) return f;
        const celdas = { ...f.celdas };
        delete celdas[k];
        return { ...f, celdas };
      }),
    }));
  };

  // Semanas de lunes a domingo, para "Repetir semana".
  const semanas = useMemo(() => {
    const out = [];
    let ini = 1;
    for (let d = 1; d <= dias.length; d++) {
      if (diaSemana(anio, mes, d) === 0 || d === dias.length) { out.push({ desde: ini, hasta: d }); ini = d + 1; }
    }
    return out;
  }, [dias.length, anio, mes]);

  const repetirSemana = () => {
    const s = semanas[+semanaOrigen];
    if (!s) return;
    const porDia = Object.fromEntries(dias.map((d) => [d.dia, d]));
    // Día destino → día de la semana origen que le corresponde (mismo día de la semana)
    const destinos = [];
    for (let d = s.hasta + 1; d <= dias.length; d++) {
      if (porDia[d].tipo === 'libre') continue;
      const fuente = s.desde + ((diaSemana(anio, mes, d) - diaSemana(anio, mes, s.desde) + 7) % 7);
      if (fuente <= s.hasta) destinos.push([d, fuente]); // si no, ese día no estaba en la semana origen (semana incompleta)
    }
    setEstado((e) => ({
      ...e,
      // Los días destino toman los turnos del día origen
      dias: e.dias.map((d) => {
        const par = destinos.find(([x]) => x === d.dia);
        return par ? { ...d, turnos: [...(porDia[par[1]].turnos || [])] } : d;
      }),
      frentes: e.frentes.map((f) => {
        const celdas = { ...f.celdas };
        destinos.forEach(([d, fuente]) => {
          // Se borran los turnos que tenía el día destino y se copian los del origen
          Object.keys(celdas).filter((k) => k.startsWith(`${d}|`)).forEach((k) => delete celdas[k]);
          (porDia[fuente].turnos || []).forEach((t) => {
            const v = f.celdas[`${fuente}|${t}`];
            if (v) celdas[`${d}|${t}`] = v;
          });
        });
        return { ...f, celdas };
      }),
    }));
  };

  // Totales por turno (mineral / estéril) y por día vs capacidad de transporte.
  const totales = useMemo(() => {
    const t = { MX: {}, EX: {}, dia: {}, mx: 0, ex: 0 };
    frentes.forEach((f) => {
      if (ACTIVIDAD[f.actividad]?.sinToneladas) return;
      const g = esMineral(f.actividad) ? 'MX' : 'EX';
      Object.entries(f.celdas).forEach(([k, v]) => {
        const n = num(v);
        t[g][k] = (t[g][k] || 0) + n;
        const dia = k.split('|')[0];
        t.dia[dia] = (t.dia[dia] || 0) + n;
        if (g === 'MX') t.mx += n; else t.ex += n;
      });
    });
    return t;
  }, [frentes]);

  // Color del total del día según qué tan cerca está de la capacidad de transporte.
  const colorCapacidad = (v) => {
    if (!v || !capacidad) return 'text-gray-700';
    if (v > capacidad) return 'bg-red-100 text-red-700';
    if (v > capacidad * 0.9) return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-50 text-emerald-800';
  };

  const celdaCab = (d, extra = '') => `${bordeDiaCompleto(anio, mes, d, diaHoy)} border-b border-gray-200 px-1 text-center ${TIPO_DIA_UI[d.tipo]?.cab ?? ''} ${extra}`;
  const stickyCab = 'sticky left-0 z-30 bg-white border-b border-r border-gray-200 px-2 text-left text-[11px] font-semibold text-gray-600';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-amber-100 border-l-4 border-amber-500" />Mineral (preparación, cámara)</span>
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-slate-100 border-l-4 border-slate-500" />Estéril (desarrollo)</span>
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300" />Libre (no se trabaja)</span>
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-red-100 border border-red-400" />Sobre la capacidad / toneladas en día libre</span>
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Semana a repetir"
              value={semanaOrigen}
              onChange={(e) => setSemanaOrigen(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            >
              <option value="">Repetir semana…</option>
              {semanas.slice(0, -1).map((s, i) => <option key={i} value={i}>Semana del {s.desde} al {s.hasta}</option>)}
            </select>
            <button
              type="button"
              disabled={semanaOrigen === ''}
              onClick={repetirSemana}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
              title="Copia las toneladas de esa semana, día por día, a las semanas siguientes del mes (sin tocar los días libres)"
            >
              Copiar al resto del mes
            </button>
            {sinLey > 0 && (
              <button
                type="button"
                onClick={usarLeyesAnteriores}
                title="Pone en cada frente de mineral sin ley esperada el Cu Insoluble real que dio el mes anterior"
                className="text-sm px-3 py-1.5 rounded-md border border-sky-300 text-sky-700 bg-white hover:bg-sky-50"
              >
                Usar ley del mes anterior ({sinLey})
              </button>
            )}
            <button type="button" onClick={agregar} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
              <HiPlus className="w-4 h-4" /> Agregar frente
            </button>
          </div>
        )}
      </div>

      <div className="overflow-auto max-h-[65vh] border border-gray-200 rounded-lg bg-white">
        <table className="border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-white">
            {/* Día */}
            <tr>
              <th className={`${stickyCab} py-1 text-xs`}>Frente · actividad · ley esperada</th>
              {dias.map((d) => {
                const faltan = turnos.filter((t) => !(d.turnos || []).includes(t));
                return (
                  <th key={d.dia} colSpan={colsDia(d).length} className={celdaCab(d, `py-1 font-semibold text-gray-700 ${d.dia === diaHoy ? 'border-t-2 border-t-sky-500 bg-sky-50' : ''}`)}>
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <span className="text-gray-500 font-medium">{DIA_CORTO[diaSemana(anio, mes, d.dia)]}</span>
                      <span
                        title={d.dia === diaHoy ? 'Hoy' : undefined}
                        className={d.dia === diaHoy ? 'text-sky-700' : ''}
                      >
                        {d.dia}
                      </span>
                      {editable && faltan.length > 0 && (
                        <select
                          aria-label={`Agregar turno al día ${d.dia}`}
                          title="Agregar un turno a este día"
                          value=""
                          onChange={(e) => e.target.value && agregarTurno(d.dia, e.target.value)}
                          className="w-5 h-5 appearance-none text-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded cursor-pointer hover:bg-emerald-100"
                        >
                          <option value="">+</option>
                          {faltan.map((t) => <option key={t} value={t}>{etiquetaTurno(t) !== t ? `${etiquetaTurno(t)} (${t})` : t}</option>)}
                        </select>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="border-b border-l border-gray-200 px-2 text-right font-semibold text-gray-600" rowSpan={4}>Total</th>
            </tr>
            {/* Tipo de día */}
            <tr>
              <th className={stickyCab} title="Hábil, turno corto, turno largo o libre (no se trabaja)">Tipo de día</th>
              {dias.map((d) => (
                <th key={d.dia} colSpan={colsDia(d).length} className={celdaCab(d, 'pb-0.5 font-normal')}>
                  {editable ? (
                    <select
                      aria-label={`Tipo de día ${d.dia}`}
                      value={d.tipo}
                      onChange={(e) => setDia(d.dia, 'tipo', e.target.value)}
                      title={TIPOS_DIA.find((t) => t.id === d.tipo)?.label}
                      className="w-full text-[11px] border border-gray-200 rounded bg-white/70"
                    >
                      {TIPOS_DIA.map((t) => <option key={t.id} value={t.id}>{TIPO_DIA_UI[t.id].label}</option>)}
                    </select>
                  ) : (
                    <span className="text-[11px]">{TIPO_DIA_UI[d.tipo]?.label}</span>
                  )}
                </th>
              ))}
            </tr>
            {/* Perforistas */}
            <tr>
              <th className={stickyCab}>Perforistas</th>
              {dias.map((d) => (
                <th key={d.dia} colSpan={colsDia(d).length} className={celdaCab(d, 'pb-0.5 font-normal')}>
                  {d.tipo === 'libre' ? (
                    <span className="text-gray-300">—</span>
                  ) : editable ? (
                    <input
                      aria-label={`Perforistas día ${d.dia}`}
                      value={d.perforistas ?? ''}
                      onChange={(e) => setDia(d.dia, 'perforistas', e.target.value)}
                      inputMode="decimal"
                      className="w-9 text-center text-[11px] border border-gray-200 rounded tabular-nums bg-white/70"
                    />
                  ) : (
                    <span className="text-[11px] tabular-nums">{d.perforistas}</span>
                  )}
                </th>
              ))}
            </tr>
            {/* Turnos */}
            <tr>
              <th className={stickyCab}>Turno</th>
              {dias.map((d) => colsDia(d).map((t, j) => (
                <th key={`${d.dia}|${t ?? '-'}`} className={`group/t border-b border-gray-200 px-0.5 py-0.5 text-[10px] font-medium text-gray-500 ${bordeCol(anio, mes, d, j, diaHoy)} ${TIPO_DIA_UI[d.tipo]?.cab ?? ''}`}>
                  {!t ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5" title={t}>
                      <span style={colorTurno[t] && !['AM', 'PM'].includes(t) ? { color: colorTurno[t], fontWeight: 600 } : undefined}>{etiquetaTurno(t)}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => quitarTurno(d.dia, t)}
                          title={`Quitar el turno ${etiquetaTurno(t)} del día ${d.dia}`}
                          aria-label={`Quitar turno ${etiquetaTurno(t)} del día ${d.dia}`}
                          className="text-gray-300 hover:text-red-600 opacity-0 group-hover/t:opacity-100 focus:opacity-100"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  )}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {frentes.length === 0 && (
              <tr>
                <td className="sticky left-0 bg-white px-3 py-6 text-sm text-gray-500" colSpan={2}>
                  Sin frentes todavía. {editable ? 'Usa "Agregar frente" o importa la plantilla Excel.' : ''}
                </td>
              </tr>
            )}
            {frentes.map((f, i) => (
              <FilaFrente
                key={f.key}
                fila={f}
                idx={i}
                dias={dias}
                anio={anio}
                mes={mes}
                editable={editable}
                opcionesFrente={opcionesFrente}
                leyRef={leyesRef[f.id_frente_trabajo]}
                diaHoy={diaHoy}
                onCampo={onCampo}
                onCelda={onCelda}
                onPegar={onPegar}
                onQuitar={onQuitar}
              />
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            {[
              ['MX', 'Total mineral (t)', totales.mx, 'bg-amber-50 text-amber-800', 'border-l-amber-500'],
              ['EX', 'Total estéril (t)', totales.ex, 'bg-slate-100 text-slate-700', 'border-l-slate-500'],
            ].map(([g, lbl, tot, color, franja]) => (
              <tr key={g} className={color}>
                <td className={`sticky left-0 z-10 border-t border-r border-gray-200 border-l-4 ${franja} px-2 py-1 font-semibold ${color}`}>{lbl}</td>
                {dias.map((d) => colsDia(d).map((t, j) => (
                  <td key={`${d.dia}|${t ?? '-'}`} className={`border-t border-gray-200 text-center tabular-nums text-[11px] font-medium ${bordeCol(anio, mes, d, j, diaHoy)}`}>
                    {t && totales[g][`${d.dia}|${t}`] ? fmt(totales[g][`${d.dia}|${t}`]) : ''}
                  </td>
                )))}
                <td className="border-t border-l border-gray-200 px-2 text-right font-bold tabular-nums">{fmt(tot)}</td>
              </tr>
            ))}
            <tr className="bg-white">
              <td className="sticky left-0 z-10 bg-white border-t-2 border-t-gray-300 border-r border-gray-200 border-l-4 border-l-gray-700 px-2 py-1 font-semibold text-gray-800">
                Total del día <span className="font-normal text-gray-500">(capacidad {capacidad ? `${fmt(capacidad)} t` : 'sin rutas'})</span>
              </td>
              {dias.map((d) => {
                const v = totales.dia[d.dia] || 0;
                return (
                  <td
                    key={d.dia}
                    colSpan={colsDia(d).length}
                    title={v && capacidad ? `${fmt(v)} t de ${fmt(capacidad)} t de capacidad (${fmt((v / capacidad) * 100)} %)` : undefined}
                    className={`border-t-2 border-t-gray-300 ${bordeDiaCompleto(anio, mes, d, diaHoy)} ${d.dia === diaHoy ? 'border-b-2 border-b-sky-500' : ''} text-center tabular-nums text-[11px] font-bold ${colorCapacidad(v)}`}
                  >
                    {v ? fmt(v) : ''}
                  </td>
                );
              })}
              <td className="border-t-2 border-t-gray-300 border-l border-gray-200 px-2 text-right font-bold tabular-nums text-gray-900">{fmt(totales.mx + totales.ex)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {editable && (
        <p className="text-xs text-gray-500">
          Cada día tiene sus turnos: con <b>+</b> en la cabecera del día agregas TN, Madrugada, Turno corto o Turno largo (las jornadas activas de Configuración General), y con <b>×</b> (al pasar el mouse sobre el turno) lo quitas. Puedes pegar un bloque copiado desde Excel: se reparte desde la celda donde pegas hacia la derecha y hacia abajo.
          El total del día se pinta verde, ámbar (sobre 90 % de la capacidad) o rojo (sobre la capacidad).
        </p>
      )}
    </div>
  );
}
