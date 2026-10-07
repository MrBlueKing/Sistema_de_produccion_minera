import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiHome } from 'react-icons/hi2';
import { HiArrowUp, HiArrowDown, HiPencil, HiPlus, HiX } from 'react-icons/hi';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import useToast from '../../../hooks/useToast';
import jornadasService from '../../../services/jornadas';

// Formularios donde se elige una jornada. 'dumpadas' también arma los filtros
// de Dispatch y Laboratorio (ver hooks/useJornadas.js).
const FORMULARIOS = [
  { id: 'dumpadas', label: 'Ingreso de Dumpadas', modulo: 'Dispatch · también filtros de Laboratorio', campo: 'Jornada' },
  { id: 'perforacion', label: 'Perforación y Tronadura', modulo: 'Explosivos / Ingeniería', campo: 'Turno', codigo: true },
  { id: 'cyt', label: 'Report CyT', modulo: 'Dispatch · Supervisor CyT', campo: 'Jornada' },
];

const VACIA = { nombre: '', abreviatura: '', color: '#64748b', formularios: [] };

function Interruptor({ activo, onChange, etiqueta, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${activo ? 'bg-green-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${activo ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function ModalJornada({ inicial, onCerrar, onGuardar, guardando }) {
  const [datos, setDatos] = useState(inicial);
  const esNueva = !inicial.id;
  const set = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onSubmit={(e) => { e.preventDefault(); onGuardar(datos); }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{esNueva ? 'Nueva jornada' : `Editar ${inicial.nombre}`}</h3>
          <button type="button" onClick={onCerrar} className="p-1 text-gray-400 hover:text-gray-600" title="Cerrar"><HiX className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="j-nombre" className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
            <input id="j-nombre" required maxLength={50} value={datos.nombre} onChange={(e) => set('nombre', e.target.value)}
              placeholder="Ej: Turno corto"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
            {!esNueva && <p className="mt-1 text-xs text-gray-500">Si ya hay registros con esta jornada, el nombre no se puede cambiar.</p>}
          </div>
          <div>
            <label htmlFor="j-abrev" className="mb-1 block text-sm font-medium text-gray-700">Abreviatura</label>
            <input id="j-abrev" required maxLength={20} value={datos.abreviatura} onChange={(e) => set('abreviatura', e.target.value.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, ''))}
              placeholder="Ej: TC"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
            <p className="mt-1 text-xs text-gray-500">Va en el código del reporte de P&amp;T. Solo letras y números.</p>
          </div>
          <div>
            <label htmlFor="j-color" className="mb-1 block text-sm font-medium text-gray-700">Color</label>
            <input id="j-color" type="color" value={datos.color || '#64748b'} onChange={(e) => set('color', e.target.value)}
              className="h-9 w-16 cursor-pointer rounded border border-gray-300" />
          </div>
          {esNueva && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-gray-700">Aparece en</legend>
              {FORMULARIOS.map((f) => (
                <label key={f.id} className="flex items-center gap-2 py-1 text-sm text-gray-700">
                  <input type="checkbox" className="h-4 w-4 accent-blue-600"
                    checked={datos.formularios.includes(f.id)}
                    onChange={(e) => set('formularios', e.target.checked ? [...datos.formularios, f.id] : datos.formularios.filter((x) => x !== f.id))} />
                  {f.label}
                </label>
              ))}
            </fieldset>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={guardando} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {guardando ? 'Guardando…' : esNueva ? 'Crear jornada' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ConfiguracionGeneral() {
  const toast = useToast();
  const [jornadas, setJornadas] = useState([]);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null); // id de la fila que se está guardando
  const [modal, setModal] = useState(null);
  const [guardandoModal, setGuardandoModal] = useState(false);
  const [formPrevia, setFormPrevia] = useState('perforacion');
  const [turnoPrevio, setTurnoPrevio] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await jornadasService.getTodas(true);
      setJornadas(res.data || []);
      setPuedeEditar(!!res.puede_editar);
    } catch {
      toast.error('No se pudieron cargar las jornadas');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarFila = async (j, cambios) => {
    setOcupado(j.id);
    try {
      const res = await jornadasService.actualizar(j.id, cambios);
      setJornadas((lista) => lista.map((x) => (x.id === j.id ? res.data : x)));
    } catch (e) {
      toast.error('No se guardó el cambio', e.response?.data?.message);
    } finally {
      setOcupado(null);
    }
  };

  const toggleFormulario = (j, form) => {
    const formularios = j.formularios.includes(form) ? j.formularios.filter((f) => f !== form) : [...j.formularios, form];
    guardarFila(j, { formularios });
  };

  const mover = async (i, delta) => {
    const nueva = [...jornadas];
    [nueva[i], nueva[i + delta]] = [nueva[i + delta], nueva[i]];
    setJornadas(nueva);
    try {
      const res = await jornadasService.ordenar(nueva.map((j) => j.id));
      setJornadas(res.data);
    } catch (e) {
      toast.error('No se guardó el orden', e.response?.data?.message);
      cargar();
    }
  };

  const guardarModal = async (datos) => {
    setGuardandoModal(true);
    try {
      const payload = { nombre: datos.nombre.trim(), abreviatura: datos.abreviatura, color: datos.color };
      if (datos.id) {
        await jornadasService.actualizar(datos.id, payload);
        toast.success('Jornada actualizada');
      } else {
        await jornadasService.crear({ ...payload, formularios: datos.formularios, activa: true });
        toast.success('Jornada creada');
      }
      setModal(null);
      cargar();
    } catch (e) {
      toast.error('No se guardó la jornada', e.response?.data?.message);
    } finally {
      setGuardandoModal(false);
    }
  };

  const form = FORMULARIOS.find((f) => f.id === formPrevia);
  const opcionesPrevia = useMemo(
    () => jornadas.filter((j) => j.activa && j.formularios.includes(formPrevia)),
    [jornadas, formPrevia],
  );
  const turnoElegido = opcionesPrevia.find((j) => j.nombre === turnoPrevio) || opcionesPrevia[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Breadcrumb
          items={[
            {
              label: 'Portal M3H',
              href: import.meta.env.VITE_CENTRAL_URL,
              onClick: (e) => { e.preventDefault(); window.location.href = import.meta.env.VITE_CENTRAL_URL; },
              icon: HiHome,
            },
            { label: 'Configuración General' },
          ]}
        />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración General</h1>
          <p className="mt-1 text-sm text-gray-600">
            Ajustes que usan varios módulos a la vez. Lo propio de cada módulo (tonelaje, capping, factor de ley) sigue en su propia configuración.
          </p>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          <span className="border-b-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-700">Jornadas</span>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Jornadas y turnos</h2>
                <p className="text-sm text-gray-600">Marca en qué formularios aparece cada jornada. Si apagas una, deja de ofrecerse en todos lados.</p>
              </div>
              {puedeEditar && (
                <button type="button" onClick={() => setModal({ ...VACIA })}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <HiPlus className="h-4 w-4" /> Nueva jornada
                </button>
              )}
            </div>

            {!puedeEditar && !cargando && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Solo lectura: para hacer cambios necesitas el rol Administrador Configuración.</p>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Orden</th>
                    <th className="px-3 py-2 text-left font-semibold">Jornada</th>
                    <th className="px-3 py-2 text-left font-semibold">Abrev.</th>
                    <th className="px-3 py-2 text-left font-semibold">Activa</th>
                    {FORMULARIOS.map((f) => (
                      <th key={f.id} className="w-36 px-3 py-2 text-center font-semibold leading-tight">
                        {f.label}
                        <span className="block font-normal">{f.modulo}</span>
                      </th>
                    ))}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cargando && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Cargando jornadas…</td></tr>
                  )}
                  {jornadas.map((j, i) => (
                    <tr key={j.id} className={ocupado === j.id ? 'opacity-60' : ''}>
                      <td className="px-3 py-2">
                        <div className="flex gap-0.5">
                          <button type="button" disabled={!puedeEditar || i === 0} onClick={() => mover(i, -1)} title="Subir"
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><HiArrowUp className="h-4 w-4" /></button>
                          <button type="button" disabled={!puedeEditar || i === jornadas.length - 1} onClick={() => mover(i, 1)} title="Bajar"
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><HiArrowDown className="h-4 w-4" /></button>
                        </div>
                      </td>
                      <td className={`px-3 py-2 ${j.activa ? '' : 'opacity-50'}`}>
                        <span className="flex items-center gap-2 font-semibold text-gray-900">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: j.color || '#94a3b8' }} />
                          {j.nombre}
                        </span>
                      </td>
                      <td className={`px-3 py-2 ${j.activa ? '' : 'opacity-50'}`}>
                        <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">{j.abreviatura}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 text-xs text-gray-500">
                          <Interruptor activo={j.activa} etiqueta={`Activar ${j.nombre}`} disabled={!puedeEditar || ocupado === j.id}
                            onChange={() => guardarFila(j, { activa: !j.activa })} />
                          {j.activa ? 'Activa' : 'Apagada'}
                        </span>
                      </td>
                      {FORMULARIOS.map((f) => (
                        <td key={f.id} className={`px-3 py-2 text-center ${j.activa ? '' : 'opacity-50'}`}>
                          <input type="checkbox" className="h-4 w-4 cursor-pointer accent-blue-600"
                            aria-label={`${j.nombre} en ${f.label}`}
                            checked={j.formularios.includes(f.id)}
                            disabled={!puedeEditar || !j.activa || ocupado === j.id}
                            onChange={() => toggleFormulario(j, f.id)} />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {puedeEditar && (
                          <button type="button" onClick={() => setModal({ ...j })}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            <HiPencil className="h-3.5 w-3.5" /> Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-1 text-sm text-gray-600">
              <li><b className="font-semibold text-gray-800">Lo que ya está guardado no cambia.</b> Un reporte antiguo en "AM" se sigue viendo como AM aunque apagues esa jornada.</li>
              <li><b className="font-semibold text-gray-800">Filtros y listados</b> muestran también las jornadas apagadas, porque puede haber registros con ellas.</li>
              <li><b className="font-semibold text-gray-800">Orden</b>: el de esta tabla se usa en las listas, los filtros y el certificado PDF.</li>
            </ul>
          </section>

          <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Así se ve en el formulario</h3>
            <div>
              <label htmlFor="prev-form" className="mb-1 block text-sm font-medium text-gray-700">Formulario</label>
              <select id="prev-form" value={formPrevia} onChange={(e) => setFormPrevia(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {FORMULARIOS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="prev-turno" className="mb-1 block text-sm font-medium text-gray-700">{form.campo}</label>
              <select id="prev-turno" value={turnoElegido?.nombre || ''} onChange={(e) => setTurnoPrevio(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {opcionesPrevia.map((j) => <option key={j.id} value={j.nombre}>{j.nombre}</option>)}
              </select>
              {opcionesPrevia.length === 0 && !cargando && (
                <p className="mt-1 text-sm text-amber-700">Este formulario quedó sin jornadas: no se podría guardar un registro.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {opcionesPrevia.map((j) => (
                <span key={j.id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                  <span className="h-2 w-2 rounded-full" style={{ background: j.color || '#94a3b8' }} />{j.nombre}
                </span>
              ))}
            </div>
            {form.codigo && turnoElegido && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Código del reporte</h3>
                <div className="break-all rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2.5 font-mono text-sm text-gray-800">
                  {new Date().toISOString().slice(0, 10)}-{turnoElegido.abreviatura}-Polvorín-0001
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {modal && (
        <ModalJornada inicial={modal} guardando={guardandoModal} onCerrar={() => setModal(null)} onGuardar={guardarModal} />
      )}
    </div>
  );
}
