import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiHome, HiOutlineCalendarDays, HiChevronLeft, HiChevronRight, HiLockClosed, HiLockOpen } from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import useToast from '../../../hooks/useToast';
import { FAENA_COLORS } from '../../../contexts/faenaColor';
import gerencialService from '../services/gerencialService';
import planificacionService from '../services/planificacionService';
import GrillaPlan from '../components/planificacion/GrillaPlan';
import SupuestosPlan from '../components/planificacion/SupuestosPlan';
import ImportarPlan from '../components/planificacion/ImportarPlan';
import { ACTIVIDAD, MESES, capacidadFaena, esMineral, fmt } from '../utils/planCalculos';

// Tile "Planificación" del Dashboard Gerencial: programa de producción mensual
// por faena. Borrador → Publicado (bloqueado). Reabrir exige motivo y queda en
// el historial. Lo publicado es contra lo que mide Operaciones → Plan vs Real.

const TABS = [
  { id: 'grilla', label: 'Programa por frente' },
  { id: 'supuestos', label: 'Supuestos y capacidad' },
  { id: 'importar', label: 'Importar desde Excel' },
];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** Plan del backend → estado editable de la pantalla. */
function aEstado(plan) {
  return {
    ton_por_disparo: plan.ton_por_disparo ?? '',
    tronaduras_por_perforista: plan.tronaduras_por_perforista ?? '',
    observaciones: plan.observaciones ?? '',
    dias: plan.dias.map((d) => ({ ...d })),
    rutas: plan.rutas.map((r) => ({ ...r })),
    frentes: plan.frentes.map((f, i) => ({
      key: `f${f.id ?? i}`,
      id_frente_trabajo: f.id_frente_trabajo,
      frente: f.frente,
      actividad: f.actividad,
      ley_esperada: f.ley_esperada ?? '',
      celdas: Object.fromEntries(f.celdas.map((c) => [`${c.dia}|${c.turno}`, f.actividad === 'fortificacion' ? 'X' : String(c.toneladas)])),
    })),
  };
}

/** Estado de la pantalla → payload del PUT, o { error } si algo no es número. */
function aPayload(e) {
  const errores = [];
  const frentes = e.frentes.map((f, i) => {
    if (!f.id_frente_trabajo) errores.push(`La fila ${i + 1} no tiene frente elegido.`);
    const ley = num(f.ley_esperada);
    if (Number.isNaN(ley)) errores.push(`${f.frente ?? `Fila ${i + 1}`}: la ley "${f.ley_esperada}" no es un número.`);
    const celdas = [];
    Object.entries(f.celdas).forEach(([k, v]) => {
      const [dia, turno] = k.split('|');
      if (f.actividad === 'fortificacion') { celdas.push({ dia: +dia, turno, toneladas: null }); return; }
      const t = num(v);
      if (Number.isNaN(t) || t < 0) errores.push(`${f.frente ?? `Fila ${i + 1}`}, día ${dia} ${turno}: "${v}" no es un tonelaje válido.`);
      else if (t > 0) celdas.push({ dia: +dia, turno, toneladas: t });
    });
    return { id_frente_trabajo: f.id_frente_trabajo, actividad: f.actividad, ley_esperada: Number.isNaN(ley) ? null : ley, celdas };
  });
  const dias = e.dias.map((d) => {
    const p = num(d.perforistas);
    if (Number.isNaN(p)) errores.push(`Día ${d.dia}: perforistas "${d.perforistas}" no es un número.`);
    return { dia: d.dia, tipo: d.tipo, perforistas: d.tipo === 'libre' ? 0 : (Number.isNaN(p) ? 0 : p ?? 0), turnos: d.turnos || [] };
  });
  const rutas = e.rutas.map((r) => {
    const v = { nombre: r.nombre, ciclo_min: num(r.ciclo_min), dumpers: num(r.dumpers), peso_ton: num(r.peso_ton), horas: num(r.horas), cuenta_capacidad: r.cuenta_capacidad !== false };
    if (!r.nombre || ['ciclo_min', 'dumpers', 'peso_ton', 'horas'].some((c) => !(v[c] > 0))) errores.push(`Ruta "${r.nombre || 'sin nombre'}": ciclo, dumpers, peso y horas tienen que ser mayores que 0.`);
    return v;
  });
  const tpd = num(e.ton_por_disparo);
  const tpp = num(e.tronaduras_por_perforista);
  if (Number.isNaN(tpd)) errores.push('Ton por disparo no es un número.');
  if (Number.isNaN(tpp)) errores.push('Tronaduras por perforista no es un número.');
  if (errores.length) return { errores };
  return {
    payload: {
      ton_por_disparo: tpd, tronaduras_por_perforista: tpp, observaciones: e.observaciones || null,
      dias, frentes, rutas,
    },
  };
}

function Modal({ titulo, children, onCerrar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-800">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

export default function DashboardPlanificacion() {
  const toast = useToast();
  const hoy = new Date();
  const [faenas, setFaenas] = useState([]);
  const [idFaena, setIdFaena] = useState(null);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [data, setData] = useState(null);
  const [estado, setEstadoInterno] = useState(null);
  const [sucio, setSucio] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tab, setTab] = useState('grilla');
  const [modal, setModal] = useState(null); // 'publicar' | 'reabrir' | 'eliminar'
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState([]);

  const setEstado = useCallback((fn) => {
    setEstadoInterno((e) => (typeof fn === 'function' ? fn(e) : fn));
    setSucio(true);
  }, []);

  useEffect(() => {
    gerencialService.getFaenas().then((r) => {
      const lista = (r.data || []).filter((id) => id != null).map((id) => ({ id, nombre: FAENA_COLORS[id]?.name ?? `Faena ${id}` }));
      setFaenas(lista);
      if (lista.length) setIdFaena(lista[0].id);
    }).catch(() => toast.error('No se pudieron cargar las faenas'));
  }, []);

  const cargar = useCallback(async () => {
    if (!idFaena) return;
    setCargando(true);
    try {
      const r = await planificacionService.obtener({ id_faena: idFaena, anio, mes });
      setData(r.data);
      setEstadoInterno(r.data.plan ? aEstado(r.data.plan) : null);
      setSucio(false);
      setErrores([]);
    } catch (e) {
      toast.error('No se pudo cargar el plan', e.response?.data?.message);
    } finally {
      setCargando(false);
    }
  }, [idFaena, anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!sucio) return undefined;
    const avisar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const confirmarSalida = () => !sucio || window.confirm('Hay cambios sin guardar en el plan. ¿Descartarlos?');
  const cambiarMes = (delta) => {
    if (!confirmarSalida()) return;
    const d = new Date(anio, mes - 1 + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth() + 1);
  };

  const plan = data?.plan;
  const publicado = plan?.estado === 'publicado';
  const editable = !!data?.puede_editar && !!plan && !publicado;
  const faenaNombre = faenas.find((f) => f.id === idFaena)?.nombre ?? '';

  const toneladasGrilla = useMemo(() => {
    const t = { mx: 0, ex: 0, porDia: {} };
    (estado?.frentes || []).forEach((f) => {
      if (ACTIVIDAD[f.actividad]?.sinToneladas) return;
      Object.entries(f.celdas).forEach(([k, v]) => {
        const n = num(v) || 0;
        if (esMineral(f.actividad)) t.mx += n; else t.ex += n;
        const d = k.split('|')[0];
        t.porDia[d] = (t.porDia[d] || 0) + n;
      });
    });
    return t;
  }, [estado?.frentes]);

  const crear = async () => {
    setGuardando(true);
    try {
      await planificacionService.crear({ id_faena: idFaena, anio, mes });
      toast.success('Plan creado en borrador');
      await cargar();
    } catch (e) {
      toast.error('No se pudo crear el plan', e.response?.data?.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async ({ silencioso = false } = {}) => {
    const { payload, errores: errs } = aPayload(estado);
    if (errs) {
      setErrores(errs);
      toast.error('Hay datos que corregir antes de guardar');
      return false;
    }
    setGuardando(true);
    try {
      const r = await planificacionService.guardar(plan.id, payload);
      setData((d) => ({ ...d, plan: r.data }));
      setEstadoInterno(aEstado(r.data));
      setSucio(false);
      setErrores([]);
      if (!silencioso) toast.success('Borrador guardado');
      return true;
    } catch (e) {
      toast.error('No se guardó el plan', e.response?.data?.message);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async () => {
    if (sucio && !(await guardar({ silencioso: true }))) return;
    setGuardando(true);
    try {
      const r = await planificacionService.publicar(plan.id);
      setData((d) => ({ ...d, plan: r.data }));
      setEstadoInterno(aEstado(r.data));
      setSucio(false);
      setModal(null);
      toast.success('Plan publicado', 'Queda bloqueado y es contra lo que se mide Plan vs Real.');
    } catch (e) {
      toast.error('No se publicó', e.response?.data?.message);
    } finally {
      setGuardando(false);
    }
  };

  const reabrir = async () => {
    setGuardando(true);
    try {
      const r = await planificacionService.reabrir(plan.id, motivo.trim());
      setData((d) => ({ ...d, plan: r.data }));
      setEstadoInterno(aEstado(r.data));
      setSucio(false);
      setModal(null);
      setMotivo('');
      toast.success('Plan reabierto', 'Corrige y vuelve a publicarlo.');
    } catch (e) {
      toast.error('No se reabrió', e.response?.data?.errors?.motivo?.[0] ?? e.response?.data?.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    setGuardando(true);
    try {
      await planificacionService.eliminar(plan.id);
      setModal(null);
      toast.success('Borrador eliminado');
      await cargar();
    } catch (e) {
      toast.error('No se eliminó', e.response?.data?.message);
    } finally {
      setGuardando(false);
    }
  };

  const cargarImportado = ({ frentes, dias, supuestos, turnosPorDia }) => {
    const ORDEN = data.turnos.map((t) => t.nombre);
    setEstado((e) => ({
      ...e,
      frentes: frentes.map((f, i) => ({
        key: `imp${Date.now()}${i}`,
        id_frente_trabajo: f.id_frente_trabajo,
        frente: f.frente,
        actividad: f.actividad,
        ley_esperada: f.ley_esperada ?? '',
        celdas: Object.fromEntries(f.celdas.map((c) => [`${c.dia}|${c.turno}`, f.actividad === 'fortificacion' ? 'X' : String(c.toneladas)])),
      })),
      // Tipo y perforistas de la hoja Dias; turnos de cada día según las columnas de la hoja Plan
      dias: e.dias.map((d) => {
        const imp = dias?.find((x) => x.dia === d.dia);
        const nd = imp ? { ...d, tipo: imp.tipo, perforistas: imp.perforistas } : { ...d };
        // Si el Excel trae columnas para el día, no puede quedar "libre" sin turnos
        if (turnosPorDia) nd.turnos = ORDEN.filter((t) => (turnosPorDia[d.dia] || []).includes(t));
        return nd;
      }),
      ton_por_disparo: supuestos?.ton_por_disparo ?? e.ton_por_disparo,
      tronaduras_por_perforista: supuestos?.tronaduras_por_perforista ?? e.tronaduras_por_perforista,
    }));
    setTab('grilla');
    toast.success('Excel cargado en la grilla', 'Revisa y guarda el borrador.');
  };

  const historial = plan?.auditoria ?? [];
  const accionLabel = { creado: 'Creado', publicado: 'Publicado', reabierto: 'Reabierto' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-50">
      <Header />
      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
        <Breadcrumb
          items={[
            { label: 'Portal M3H', href: import.meta.env.VITE_CENTRAL_URL, onClick: (e) => { e.preventDefault(); window.location.href = import.meta.env.VITE_CENTRAL_URL; }, icon: HiHome },
            { label: 'Planificación' },
          ]}
        />

        <div className="bg-white rounded-xl shadow-md px-5 py-4 border-l-4 border-sky-500 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HiOutlineCalendarDays className="w-7 h-7 text-sky-600 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-sky-700">Programa de producción</h2>
              <p className="text-gray-500 text-xs mt-0.5">Plan mensual por frente, día y turno. Al publicarlo queda fijo y Operaciones → Plan vs Real lo compara con lo extraído.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Faena"
              value={idFaena ?? ''}
              onChange={(e) => { if (confirmarSalida()) setIdFaena(+e.target.value); }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            >
              {faenas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
            <div className="flex items-center border border-gray-300 rounded-md">
              <button type="button" onClick={() => cambiarMes(-1)} className="p-1.5 hover:bg-gray-50" aria-label="Mes anterior"><HiChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 text-sm font-medium w-32 text-center">{MESES[mes - 1]} {anio}</span>
              <button type="button" onClick={() => cambiarMes(1)} className="p-1.5 hover:bg-gray-50" aria-label="Mes siguiente"><HiChevronRight className="w-4 h-4" /></button>
            </div>
            {plan && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${publicado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {publicado ? <HiLockClosed className="w-3.5 h-3.5" /> : <HiLockOpen className="w-3.5 h-3.5" />}
                {publicado ? `Publicado ${plan.publicado_en ?? ''}` : 'Borrador'}
              </span>
            )}
          </div>
        </div>

        {cargando && !data && <div className="text-sm text-gray-500 py-10 text-center">Cargando plan…</div>}

        {data && !plan && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center space-y-3">
            <div className="text-lg font-semibold text-gray-700">No hay plan de {MESES[mes - 1]} {anio} para {faenaNombre}</div>
            {data.puede_editar ? (
              <>
                <p className="text-sm text-gray-500">Se crea en borrador con los días de lunes a viernes hábiles. Los supuestos y las rutas se copian del último plan de la faena, si hay.</p>
                <button type="button" disabled={guardando} onClick={crear} className="text-sm px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
                  Crear plan de {MESES[mes - 1]}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">Solo quien tiene el rol de Planificación puede crearlo.</p>
            )}
          </div>
        )}

        {plan && estado && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-4 border-b border-gray-200">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`px-1 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {data.puede_editar && (
                <div className="flex flex-wrap items-center gap-2">
                  {publicado ? (
                    <button type="button" onClick={() => setModal('reabrir')} className="text-sm px-3 py-1.5 rounded-md border border-amber-400 text-amber-800 hover:bg-amber-50">
                      Reabrir para corregir…
                    </button>
                  ) : (
                    <>
                      {!historial.some((a) => a.accion === 'publicado') && (
                        <button type="button" onClick={() => setModal('eliminar')} className="text-sm px-3 py-1.5 rounded-md text-gray-500 hover:text-red-600">
                          Eliminar borrador
                        </button>
                      )}
                      <button type="button" disabled={!sucio || guardando} onClick={() => guardar()} className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40">
                        {guardando ? 'Guardando…' : sucio ? 'Guardar borrador' : 'Guardado'}
                      </button>
                      <button type="button" disabled={guardando} onClick={() => setModal('publicar')} className="text-sm px-3 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
                        Publicar plan
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {errores.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
                <div className="font-semibold mb-1">Corrige esto antes de guardar:</div>
                <ul className="list-disc pl-5 space-y-0.5">{errores.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}</ul>
                {errores.length > 12 && <div className="mt-1">…y {errores.length - 12} más.</div>}
              </div>
            )}

            {publicado && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-900">
                Publicado por <b>{plan.publicado_por}</b> el {plan.publicado_en}. Está bloqueado: para corregirlo hay que reabrirlo indicando el motivo.
              </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>Mineral <b className="tabular-nums text-amber-700">{fmt(toneladasGrilla.mx)} t</b></span>
              <span>Estéril <b className="tabular-nums text-slate-700">{fmt(toneladasGrilla.ex)} t</b></span>
              <span>Frentes <b className="tabular-nums">{estado.frentes.length}</b></span>
              <span>Capacidad de transporte <b className="tabular-nums">{fmt(capacidadFaena(estado.rutas))} t/día</b></span>
            </div>

            {tab === 'grilla' && (
              <GrillaPlan
                estado={estado}
                setEstado={setEstado}
                turnos={data.turnos}
                anio={anio}
                mes={mes}
                editable={editable}
                frentesDisponibles={data.frentes_disponibles}
                capacidad={capacidadFaena(estado.rutas)}
                leyesRef={data.leyes_mes_anterior ?? {}}
              />
            )}
            {tab === 'supuestos' && (
              <SupuestosPlan estado={estado} setEstado={setEstado} editable={editable} referencia={data.referencia} toneladasGrilla={toneladasGrilla} />
            )}
            {tab === 'importar' && (
              <ImportarPlan
                faena={faenaNombre}
                anio={anio}
                mes={mes}
                turnos={data.turnos.map((t) => t.nombre)}
                abreviaturas={Object.fromEntries(data.turnos.map((t) => [t.nombre, t.abreviatura]))}
                estado={estado}
                frentesDisponibles={data.frentes_disponibles}
                referencia={data.referencia}
                editable={editable}
                onCargar={cargarImportado}
              />
            )}

            {historial.length > 0 && (
              <details className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">Historial del plan ({historial.length})</summary>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {historial.map((a, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="tabular-nums text-gray-500">{a.fecha}</span>
                      <b className="text-gray-800">{accionLabel[a.accion] ?? a.accion}</b>
                      <span className="text-gray-600">por {a.usuario}</span>
                      {a.motivo && <span className="text-gray-700">— “{a.motivo}”</span>}
                      {a.cambios?.length > 0 && (
                        <ul className="basis-full mt-1 ml-4 list-disc pl-4 text-gray-600 space-y-0.5">
                          {a.cambios.map((c, j) => <li key={j}>{c}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>

      {modal === 'publicar' && (
        <Modal titulo={`Publicar plan de ${MESES[mes - 1]} · ${faenaNombre}`} onCerrar={() => setModal(null)}>
          <p className="text-sm text-gray-600">
            Al publicarlo queda <b>bloqueado</b> y es contra lo que se mide Plan vs Real todo el mes.
            Para cambiarlo después habrá que reabrirlo indicando el motivo.
          </p>
          <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
            {fmt(toneladasGrilla.mx)} t de mineral · {fmt(toneladasGrilla.ex)} t de estéril · {estado.frentes.length} frentes
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="text-sm px-3 py-1.5 rounded-md border border-gray-300">Cancelar</button>
            <button type="button" disabled={guardando} onClick={publicar} className="text-sm px-3 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
              {guardando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'reabrir' && (
        <Modal titulo="Reabrir plan publicado" onCerrar={() => setModal(null)}>
          <p className="text-sm text-gray-600">
            El plan vuelve a borrador para corregirlo. Queda registrado quién lo reabrió, cuándo y por qué. Al volver a publicarlo, el historial muestra qué cambió respecto de lo publicado.
          </p>
          <label htmlFor="plan-motivo" className="block text-sm font-medium text-gray-700">Motivo</label>
          <textarea
            id="plan-motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: se digitó mal el frente M3-12SE, iba en M3-12S"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="text-sm px-3 py-1.5 rounded-md border border-gray-300">Cancelar</button>
            <button type="button" disabled={guardando || motivo.trim().length < 10} onClick={reabrir} className="text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
              Reabrir
            </button>
          </div>
          {motivo.trim().length > 0 && motivo.trim().length < 10 && <p className="text-xs text-gray-500">Explica un poco más (mínimo 10 caracteres).</p>}
        </Modal>
      )}

      {modal === 'eliminar' && (
        <Modal titulo="Eliminar borrador" onCerrar={() => setModal(null)}>
          <p className="text-sm text-gray-600">Se borra el plan de {MESES[mes - 1]} {anio} de {faenaNombre}. Como nunca se publicó, no queda nada medido contra él.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="text-sm px-3 py-1.5 rounded-md border border-gray-300">Cancelar</button>
            <button type="button" disabled={guardando} onClick={eliminar} className="text-sm px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
