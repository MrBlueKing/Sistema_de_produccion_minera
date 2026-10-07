import { useEffect, useMemo, useState } from 'react';
import { HiX } from 'react-icons/hi';
import cytService from '../../services/cyt';
import useToast from '../../../../hooks/useToast';

/**
 * Buscar en el personal de Petróleo y autorizar operadores de pala para la faena.
 * Mismo patrón que los operadores de dumper de Configuración de Dispatch.
 */
export default function ModalAutorizarPala({ idFaena, onCerrar, onAutorizado }) {
  const toast = useToast();
  const [personal, setPersonal] = useState(null);
  const [error, setError] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [ocupado, setOcupado] = useState(null);

  const cargar = () => {
    setError(null);
    cytService.personalDisponible(idFaena)
      .then((r) => setPersonal(r.data || []))
      .catch((e) => setError(e.response?.data?.message || 'No se pudo cargar el personal de Petróleo.'));
  };
  useEffect(cargar, [idFaena]);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (personal || []).filter((p) => !q || `${p.nombre} ${p.rut || ''}`.toLowerCase().includes(q));
  }, [personal, buscar]);

  const autorizar = async (p) => {
    setOcupado(p.id_personal_externo);
    try {
      await cytService.autorizarOperador(idFaena, { id_personal_externo: p.id_personal_externo, rut: p.rut, nombre: p.nombre, cargo: p.cargo });
      toast.success('Operador de pala autorizado', p.nombre);
      setPersonal((xs) => xs.map((x) => (x.id_personal_externo === p.id_personal_externo ? { ...x, ya_autorizado: true } : x)));
      onAutorizado?.(p);
    } catch (e) {
      toast.error('No se pudo autorizar', e.response?.data?.message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" role="dialog" aria-labelledby="titulo-autorizar-pala">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 id="titulo-autorizar-pala" className="text-base font-semibold text-gray-900">Autorizar operador de pala</h3>
          <button type="button" onClick={onCerrar} className="p-1 text-gray-400 hover:text-gray-600" title="Cerrar"><HiX className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-col gap-3 overflow-hidden px-5 py-4">
          <input
            autoFocus value={buscar} onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o RUT en el personal de Petróleo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          />
          <div className="-mx-1 overflow-y-auto px-1">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error} <button type="button" onClick={cargar} className="font-semibold underline">Reintentar</button>
              </div>
            )}
            {!error && personal === null && <p className="py-6 text-center text-sm text-gray-500">Cargando personal…</p>}
            {!error && personal && lista.length === 0 && <p className="py-6 text-center text-sm text-gray-500">Nadie coincide con la búsqueda.</p>}
            <ul className="divide-y divide-gray-100">
              {lista.map((p) => (
                <li key={p.id_personal_externo} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{p.nombre}</p>
                    <p className="truncate text-xs text-gray-500">{[p.rut, p.cargo].filter(Boolean).join(' · ')}</p>
                  </div>
                  {p.ya_autorizado ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Autorizado</span>
                  ) : (
                    <button type="button" disabled={ocupado === p.id_personal_externo} onClick={() => autorizar(p)}
                      className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      Autorizar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
