import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiHome, HiMap, HiTag, HiClipboardDocumentList, HiInformationCircle,
} from 'react-icons/hi2';
import Header from '../../../shared/components/organisms/Header';
import Breadcrumb from '../../../shared/components/atoms/Breadcrumb';
import Card from '../../../shared/components/atoms/Card';
import EstadoFrentesView from '../components/EstadoFrentesView';
import { useAuth } from '../../../core/context/AuthContext';
import ingenieriaService from '../services/ingenieria';
import faenaService from '../../../services/faenaService';
import { FaenaProvider, useFaena } from '../../../contexts/FaenaContext';

const FAENAS_VISIBLES = [1, 2, 4];

function IngenieriaContent() {
  const navigate = useNavigate();
  const { getUserInfo } = useAuth();
  const { faenaUsuario } = useFaena();

  const userInfo = getUserInfo();
  const userNombre = userInfo?.nombre || '';

  const getSaludo = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const [vistaActual, setVistaActual] = useState('menu');
  const [frentes, setFrentes] = useState([]);
  const [loadingFrentes, setLoadingFrentes] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ingenieriaService.getFrentesTrabajo({ solo_activos: true, per_page: 999 });
        setFrentes(res.data || []);
      } catch {
        // silencioso
      } finally {
        setLoadingFrentes(false);
      }
    };
    load();
  }, []);

  const handleGoBack = () => {
    window.location.href = import.meta.env.VITE_CENTRAL_URL;
  };

  const VISTA_LABELS = {
    estado: 'Estado de Frentes',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            items={[
              {
                label: 'Portal M3H',
                href: import.meta.env.VITE_CENTRAL_URL,
                onClick: (e) => { e.preventDefault(); handleGoBack(); },
                icon: HiHome,
              },
              ...(vistaActual !== 'menu'
                ? [
                    {
                      label: 'Ingeniería',
                      href: '#',
                      onClick: (e) => { e.preventDefault(); setVistaActual('menu'); },
                    },
                    { label: VISTA_LABELS[vistaActual] ?? vistaActual },
                  ]
                : [{ label: 'Ingeniería' }]
              ),
            ]}
          />
        </div>

        {/* ── MENÚ ── */}
        {vistaActual === 'menu' && (
          <div className="space-y-5">

            {/* Hero banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
              <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-blue-500/10" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-blue-500/5" />

              <div className="relative px-6 py-7">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Módulo Ingeniería</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {getSaludo()}{userNombre ? `, ${userNombre.split(' ')[0]}` : ''}
                </h1>
                <p className="text-slate-400 text-sm mt-1 capitalize">
                  {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Botón ¿Cómo funciona? */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  showInfo
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
                }`}
                title="Ver rol del módulo"
              >
                <HiInformationCircle className="w-4 h-4" />
                <span>¿Cómo funciona?</span>
              </button>
            </div>

            {/* Panel ¿Cómo funciona? */}
            {showInfo && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="mb-4 pb-4 border-b border-blue-100">
                  <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2.5">Relación con el flujo de producción</p>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center" style={{ minWidth: '70px' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-slate-600">ING</div>
                      <span className="mt-1 text-[9px] font-semibold text-center leading-tight text-gray-700">Ingeniería<br />(config.)</span>
                    </div>
                    <div className="flex-1 h-px bg-gray-300 min-w-[24px]" />
                    <span className="text-[9px] text-gray-400 font-semibold">define frentes</span>
                    <div className="flex-1 h-px bg-gray-300 min-w-[24px]" />
                    <div className="flex flex-col items-center opacity-60" style={{ minWidth: '70px' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-orange-500">1</div>
                      <span className="mt-1 text-[9px] font-semibold text-center leading-tight text-gray-500">Dispatch<br />Ingreso</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2.5">¿Cómo funciona Ingeniería?</p>
                <div className="space-y-2">
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-bold text-slate-700">Qué gestiona este módulo</p>
                    <p className="text-xs text-gray-500 mt-0.5"><strong>Frentes de Trabajo</strong> (catálogo de ubicaciones de extracción activas), <strong>Tipos de Frente</strong> (catálogo de categorías que se asignan a cada frente) y <strong>Estado de Frentes</strong> (seguimiento de avance real vs. planificado).</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-bold text-slate-700">Dónde se usa lo que configuras acá</p>
                    <p className="text-xs text-gray-500 mt-0.5">Los frentes que creas en "Frentes de Trabajo" son los que el operador elige en Dispatch al registrar una dumpada — por eso mantenerlos al día evita errores de digitación en terreno.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

              {/* Frentes de Trabajo */}
              <button
                onClick={() => navigate('/ingenieria/frentes-trabajo')}
                className="group bg-blue-50 rounded-xl border border-blue-100 shadow-sm p-4 text-left hover:bg-blue-100 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.97]"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors shadow-sm">
                  <HiMap className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-blue-900 text-sm leading-tight">Frentes de Trabajo</p>
                <p className="text-blue-400 text-xs mt-0.5">Gestión y configuración</p>
              </button>

              {/* Estado de Frentes */}
              <button
                onClick={() => setVistaActual('estado')}
                className="group bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm p-4 text-left hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.97]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors shadow-sm">
                    <HiClipboardDocumentList className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">En desarrollo</span>
                </div>
                <p className="font-bold text-indigo-900 text-sm leading-tight">Estado de Frentes</p>
                <p className="text-indigo-400 text-xs mt-0.5">Seguimiento y análisis</p>
              </button>

              {/* Tipos de Frente */}
              <button
                onClick={() => navigate('/ingenieria/tipos-frente')}
                className="group bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 text-left hover:bg-slate-100 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.97]"
              >
                <div className="w-10 h-10 bg-slate-500 rounded-xl flex items-center justify-center mb-3 group-hover:bg-slate-600 transition-colors shadow-sm">
                  <HiTag className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-slate-900 text-sm leading-tight">Tipos de Frente</p>
                <p className="text-slate-400 text-xs mt-0.5">Catálogo</p>
              </button>

            </div>
          </div>
        )}

        {/* ── ESTADO DE FRENTES ── */}
        {vistaActual === 'estado' && (
          <EstadoFrentesView
            frentes={frentes}
            faenaFiltro={null}
          />
        )}

      </main>
    </div>
  );
}

export default function Ingenieria() {
  return (
    <FaenaProvider>
      <IngenieriaContent />
    </FaenaProvider>
  );
}
