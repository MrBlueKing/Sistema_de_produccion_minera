import { useCallback, useEffect, useState } from 'react';
import { HiHome } from 'react-icons/hi2';
import { HiPlus } from 'react-icons/hi';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import api from '../../../core/services/api';
import secureStorage from '../../../core/services/secureStorage';
import { useFaena } from '../../../contexts/FaenaContext';
import useToast from '../../../hooks/useToast';
import ingenieriaService from '../../ingenieria/services/ingenieria';
import configuracionService from '../../../services/configuracion';
import cytService from '../services/cyt';
import FormularioCyt from '../components/cyt/FormularioCyt';
import ModalAutorizarPala from '../components/cyt/ModalAutorizarPala';

// Report de Ciclo Carguío y Transporte (rol SAC supervisor_cyt). El supervisor
// trabaja en su faena; con supervisor_cyt_multifaena (o un rol global) elige.
const ROL_MULTIFAENA = 'supervisor_cyt_multifaena';
const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ddmmyyyy = (iso) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '—');
const nombreDeFaena = (f) => f?.ubicacion || f?.nombre || `Faena ${f?.id}`;

function ReportsAnteriores({ idFaena, version, onAbrir }) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    setLista(null);
    cytService.reportes(idFaena).then((r) => setLista(r.data || [])).catch(() => setLista([]));
  }, [idFaena, version]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      {lista === null && <p className="py-6 text-center text-sm text-gray-500">Cargando reports…</p>}
      {lista?.length === 0 && <p className="py-6 text-center text-sm text-gray-500">Todavía no hay reports en esta faena.</p>}
      {lista?.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Jornada</th>
                <th className="px-3 py-2 text-right font-semibold">Cargas</th>
                <th className="px-3 py-2 text-right font-semibold">Paladas</th>
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
                <th className="px-3 py-2 text-left font-semibold">Supervisor</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{ddmmyyyy(r.fecha)}</td>
                  <td className="px-3 py-2">{r.jornada}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.cargas}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.paladas}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.estado === 'guardado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.estado === 'guardado' ? 'Guardado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.supervisor_nombre || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => onAbrir(r)} className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-white">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OperadoresPala({ nombreFaena, operadores, onAutorizar, onQuitar }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Operadores de pala de {nombreFaena}</h2>
        <button type="button" onClick={onAutorizar} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800">
          <HiPlus className="h-4 w-4" /> Autorizar operador de pala
        </button>
      </div>
      <p className="text-xs text-gray-500">Igual que los operadores de dumper de Dispatch: se eligen del personal de Petróleo y quedan disponibles en el report de esta faena. Los operadores de dumper siguen saliendo de la lista de Dispatch.</p>
      {operadores.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">Sin operadores de pala autorizados.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {operadores.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{o.nombre}</p>
                <p className="truncate text-xs text-gray-500">{[o.rut, o.cargo].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => onQuitar(o)} className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Quitar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ReporteCyt() {
  const toast = useToast();
  const { faenaUsuario, esUsuarioGlobal } = useFaena();
  const multifaena = esUsuarioGlobal || secureStorage.hasRole(ROL_MULTIFAENA);

  const [faenas, setFaenas] = useState([]);
  const [idFaena, setIdFaena] = useState(() => (multifaena ? null : Number(faenaUsuario) || null));
  const [tab, setTab] = useState('nuevo');
  const [fecha, setFecha] = useState(hoyLocal());
  const [jornada, setJornada] = useState('');
  const [versionLista, setVersionLista] = useState(0);
  const [modalPala, setModalPala] = useState(false);
  const [operadoresPala, setOperadoresPala] = useState([]);
  const [catalogos, setCatalogos] = useState({ frentes: [], palas: [], dumpers: [], operadoresDumper: [], pesoPalada: 1.82, petroleoSinPalas: false });

  useEffect(() => {
    api.get('/faenas').then((r) => setFaenas(r.data?.data || [])).catch(() => setFaenas([]));
  }, []);

  const cargarOperadoresPala = useCallback(() => {
    if (!idFaena) return;
    cytService.operadores(idFaena, 'pala').then((r) => setOperadoresPala(r.data || [])).catch(() => setOperadoresPala([]));
  }, [idFaena]);

  // Máquinas (Petróleo) aparte: el aviso de "sin palas" puede reintentar sin recargar la página.
  const cargarMaquinas = useCallback(() => cytService.maquinas()
    .then((m) => setCatalogos((c) => ({ ...c, palas: m.palas || [], dumpers: m.dumpers || [], petroleoSinPalas: !!m.petroleo_sin_palas })))
    .catch(() => setCatalogos((c) => ({ ...c, petroleoSinPalas: true }))), []);

  // Catálogos de la faena: frentes activos, máquinas (Petróleo), operadores y peso por palada.
  useEffect(() => {
    if (!idFaena) return;
    cargarOperadoresPala();
    Promise.allSettled([
      ingenieriaService.getFrentesTrabajo({ solo_activos: true, per_page: 1000, id_faena: idFaena }),
      cytService.maquinas(),
      cytService.operadores(idFaena, 'dumper'),
      configuracionService.get('toneladas_por_palada'),
    ]).then(([fr, maq, opD, palada]) => {
      setCatalogos({
        frentes: (fr.value?.data || []).slice().sort((a, b) => String(a.codigo_completo).localeCompare(String(b.codigo_completo), undefined, { numeric: true })),
        palas: maq.value?.palas || [],
        dumpers: maq.value?.dumpers || [],
        petroleoSinPalas: maq.status === 'rejected' || !!maq.value?.petroleo_sin_palas,
        operadoresDumper: opD.value?.data || [],
        pesoPalada: Number(palada.value) || 1.82,
        reintentarMaquinas: cargarMaquinas,
      });
      if (maq.status === 'rejected') toast.error('No se pudieron cargar las máquinas');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFaena]);

  const faenaActual = faenas.find((f) => Number(f.id) === Number(idFaena));
  const nombreFaena = faenaActual ? nombreDeFaena(faenaActual) : idFaena ? `Faena ${idFaena}` : '';

  const quitarOperador = async (o) => {
    if (!window.confirm(`¿Quitar a ${o.nombre} de los operadores de pala? Los reports ya guardados no cambian.`)) return;
    try {
      await cytService.quitarOperador(o.id);
      toast.success('Operador quitado de la lista');
      cargarOperadoresPala();
    } catch (e) {
      toast.error('No se pudo quitar', e.response?.data?.message);
    }
  };

  const TABS = [
    { id: 'nuevo', label: 'Report' },
    { id: 'anteriores', label: 'Reports anteriores' },
    { id: 'operadores', label: 'Operadores de pala' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <Breadcrumb
          items={[
            { label: 'Portal M3H', href: import.meta.env.VITE_CENTRAL_URL, onClick: (e) => { e.preventDefault(); window.location.href = import.meta.env.VITE_CENTRAL_URL; }, icon: HiHome },
            { label: 'Report CyT' },
          ]}
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report de Ciclo Carguío y Transporte</h1>
          <p className="mt-1 text-sm text-gray-600">Cada carga en la pala (mina → parrilla) y el estado de los dumpers en la jornada.</p>
        </div>

        {!idFaena ? (
          <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">¿De qué faena es el report?</h2>
              {!multifaena && <p className="mt-1 text-sm text-amber-700">Tu usuario no tiene una faena asignada en el SAC. Pide que te asignen una.</p>}
            </div>
            {multifaena && (
              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                {faenas.length === 0 && <p className="text-sm text-gray-500">Cargando faenas…</p>}
                {faenas.map((f) => (
                  <button key={f.id} type="button" onClick={() => { setIdFaena(Number(f.id)); setTab('nuevo'); }}
                    className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-teal-600 hover:ring-2 hover:ring-teal-100">
                    <span className="text-lg font-bold text-gray-900">{nombreDeFaena(f)}</span>
                    <span className="text-sm text-gray-500">Abrir report de esta faena</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="flex gap-1 border-b border-gray-200">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-teal-700 text-teal-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div hidden={tab !== 'nuevo'}>
              <FormularioCyt
                idFaena={idFaena}
                nombreFaena={nombreFaena}
                puedeCambiarFaena={multifaena}
                onCambiarFaena={() => setIdFaena(null)}
                fecha={fecha} setFecha={setFecha}
                jornada={jornada} setJornada={setJornada}
                catalogos={catalogos}
                operadoresPala={operadoresPala}
                onPedirAutorizarPala={() => setModalPala(true)}
                onGuardado={() => setVersionLista((v) => v + 1)}
              />
            </div>
            {tab === 'anteriores' && (
              <ReportsAnteriores idFaena={idFaena} version={versionLista}
                onAbrir={(r) => { setFecha(r.fecha); setJornada(r.jornada); setTab('nuevo'); }} />
            )}
            {tab === 'operadores' && (
              <OperadoresPala nombreFaena={nombreFaena} operadores={operadoresPala} onAutorizar={() => setModalPala(true)} onQuitar={quitarOperador} />
            )}
          </>
        )}
      </main>

      {modalPala && idFaena && (
        <ModalAutorizarPala idFaena={idFaena} onCerrar={() => setModalPala(false)} onAutorizado={cargarOperadoresPala} />
      )}
    </div>
  );
}
