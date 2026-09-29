import React, { useState, useEffect, useCallback } from 'react';
import { HiUserGroup, HiPlus, HiX, HiSearch, HiInformationCircle, HiRefresh } from 'react-icons/hi';
import Card from '../../../shared/components/atoms/Card';
import Button from '../../../shared/components/atoms/Button';
import useToast from '../../../hooks/useToast';
import { useFaena } from '../../../contexts/FaenaContext';
import dispatchService from '../services/dispatch';
import api from '../../../core/services/api';

/**
 * Despachos → Plantas (Gestión de Maestros) → Operadores.
 * Solo las personas de esta lista aparecen en "Operador" del Ingreso de Dumpadas.
 * Se eligen del personal interno de Petróleo, por faena (mismo patrón que
 * Explosivos → Personal Autorizado).
 */
const OperadoresAutorizadosSection = ({ className = '' }) => {
  const toast = useToast();
  const { esUsuarioGlobal, faenas, faenaUsuario } = useFaena();

  // Usuario global elige la faena acá (no hay lista "global": cada faena tiene la suya)
  const [faenaElegida, setFaenaElegida] = useState(null);
  const idFaena = esUsuarioGlobal ? faenaElegida : faenaUsuario;
  const params = esUsuarioGlobal && idFaena ? { faena_id: idFaena } : {};

  const [autorizados, setAutorizados] = useState([]);
  const [loading, setLoading] = useState(false);

  const [agregando, setAgregando] = useState(false);
  const [disponibles, setDisponibles] = useState([]);
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [errorDisp, setErrorDisp] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);
  const [confirmarQuitarId, setConfirmarQuitarId] = useState(null);

  const cargarAutorizados = useCallback(async () => {
    if (!idFaena) { setAutorizados([]); return; }
    setLoading(true);
    try {
      const res = await dispatchService.getOperadores(esUsuarioGlobal ? { faena_id: idFaena } : {});
      setAutorizados(res?.data || []);
    } catch (e) {
      toast.error('Error', 'No se pudo cargar la lista de operadores');
    } finally {
      setLoading(false);
    }
  }, [idFaena, esUsuarioGlobal]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarDisponibles = useCallback(async () => {
    setLoadingDisp(true);
    setErrorDisp(null);
    try {
      const res = await dispatchService.getOperadoresDisponibles(esUsuarioGlobal ? { faena_id: idFaena } : {});
      setDisponibles(res?.data || []);
    } catch (e) {
      setDisponibles([]);
      setErrorDisp(e.response?.data?.mensaje || 'No se pudo conectar con el sistema de Petróleo');
    } finally {
      setLoadingDisp(false);
    }
  }, [idFaena, esUsuarioGlobal]);

  useEffect(() => {
    cargarAutorizados();
    setAgregando(false);
    setBusqueda('');
  }, [cargarAutorizados]);

  const abrirAgregar = () => {
    setAgregando(true);
    setBusqueda('');
    cargarDisponibles();
  };

  const autorizar = async (persona) => {
    setGuardandoId(persona.id_personal_externo);
    try {
      await dispatchService.autorizarOperador({
        id_personal_externo: persona.id_personal_externo,
        rut: persona.rut,
        nombre: persona.nombre,
        cargo: persona.cargo,
      }, params);
      toast.success('Operador autorizado', persona.nombre);
      setDisponibles(prev => prev.map(p => p.id_personal_externo === persona.id_personal_externo ? { ...p, ya_autorizado: true } : p));
      cargarAutorizados();
    } catch (e) {
      toast.error('No se pudo autorizar', e.response?.data?.mensaje || 'Intenta de nuevo');
    } finally {
      setGuardandoId(null);
    }
  };

  const quitar = async (operador) => {
    setGuardandoId(operador.id_operador);
    try {
      await dispatchService.quitarOperador(operador.id, params);
      toast.success('Operador quitado', `${operador.nombre} ya no aparece en el Ingreso de Dumpadas`);
      setConfirmarQuitarId(null);
      setDisponibles(prev => prev.map(p => p.id_personal_externo === operador.id_operador ? { ...p, ya_autorizado: false } : p));
      cargarAutorizados();
    } catch (e) {
      toast.error('No se pudo quitar', e.response?.data?.mensaje || 'Intenta de nuevo');
    } finally {
      setGuardandoId(null);
    }
  };

  const texto = busqueda.trim().toLowerCase();
  const disponiblesFiltrados = disponibles
    .filter(p => !p.ya_autorizado)
    .filter(p => !texto || p.nombre.toLowerCase().includes(texto) || (p.cargo || '').toLowerCase().includes(texto) || (p.rut || '').toLowerCase().includes(texto));

  // FaenaContext solo carga la lista de faenas para usuarios globales; un usuario
  // de faena (ej. admin_dispatch) solo tiene el id — se pide la lista acá para el nombre.
  const [faenasLocal, setFaenasLocal] = useState([]);
  useEffect(() => {
    if (esUsuarioGlobal || faenas.length > 0) return;
    api.get('/faenas')
      .then(res => setFaenasLocal(res.data?.data || []))
      .catch(() => setFaenasLocal([]));
  }, [esUsuarioGlobal, faenas.length]);

  const nombreFaena = (id) => {
    const f = [...faenas, ...faenasLocal].find(x => String(x.id ?? x.id_faena) === String(id));
    return f ? (f.ubicacion || f.nombre) : `Faena ${id}`;
  };

  return (
    <Card className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
            <HiUserGroup className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Operadores autorizados</h3>
            <p className="text-sm text-gray-500">
              Solo estas personas aparecen en "Operador" al ingresar dumpadas
              {idFaena && <> · <strong>{nombreFaena(idFaena)}</strong></>}
            </p>
          </div>
        </div>
        {idFaena && !agregando && (
          <Button variant="primary" onClick={abrirAgregar} className="bg-teal-600 hover:bg-teal-700 shrink-0">
            <HiPlus className="w-4 h-4 mr-1" /> Agregar operador
          </Button>
        )}
      </div>

      {esUsuarioGlobal && (
        <div className="mb-4">
          <label htmlFor="faena-operadores" className="block text-sm font-medium text-gray-700 mb-1">Faena</label>
          <select
            id="faena-operadores"
            value={faenaElegida || ''}
            onChange={(e) => setFaenaElegida(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">-- Selecciona una faena --</option>
            {faenas.map(f => (
              <option key={f.id || f.id_faena} value={f.id || f.id_faena}>{f.ubicacion || f.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {!idFaena ? (
        <p className="text-sm text-gray-500 py-4">Selecciona una faena para ver y editar su lista de operadores.</p>
      ) : (
        <>
          {/* Panel para agregar: personal de Petróleo */}
          {agregando && (
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <HiSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="buscar-operador-petroleo"
                    type="text"
                    autoFocus
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, cargo o RUT en el personal de Petróleo..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  />
                </div>
                <button type="button" onClick={cargarDisponibles} className="p-2 text-gray-500 hover:text-teal-700 hover:bg-white rounded-lg" title="Recargar desde Petróleo">
                  <HiRefresh className={`w-4 h-4 ${loadingDisp ? 'animate-spin' : ''}`} />
                </button>
                <button type="button" onClick={() => setAgregando(false)} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg" title="Cerrar">
                  <HiX className="w-4 h-4" />
                </button>
              </div>

              {loadingDisp ? (
                <p className="text-sm text-gray-500 py-3 text-center">Cargando personal desde Petróleo...</p>
              ) : errorDisp ? (
                <p className="text-sm text-red-600 py-3 text-center">{errorDisp}</p>
              ) : disponiblesFiltrados.length === 0 ? (
                <p className="text-sm text-gray-500 py-3 text-center">
                  {texto ? 'Nadie coincide con la búsqueda' : 'Todo el personal de esta faena ya está autorizado'}
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y divide-teal-100 bg-white rounded-lg border border-teal-100">
                  {disponiblesFiltrados.map(p => (
                    <li key={p.id_personal_externo} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {p.cargo || 'Sin cargo'}{p.rut ? ` · ${p.rut}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => autorizar(p)}
                        disabled={guardandoId === p.id_personal_externo}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-50"
                      >
                        {guardandoId === p.id_personal_externo ? 'Autorizando...' : 'Autorizar'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Lista de autorizados */}
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Cargando...</p>
          ) : autorizados.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <HiUserGroup className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Todavía no hay operadores autorizados en esta faena</p>
              <p className="text-sm">Mientras la lista esté vacía, no se pueden registrar dumpadas (el operador es obligatorio)</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Operador</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Cargo</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-700 w-40"></th>
                  </tr>
                </thead>
                <tbody>
                  {autorizados.map(o => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{o.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{o.cargo || '-'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {confirmarQuitarId === o.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs text-gray-600">¿Quitar?</span>
                            <button type="button" onClick={() => quitar(o)} disabled={guardandoId === o.id_operador} className="px-2 py-1 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">Sí</button>
                            <button type="button" onClick={() => setConfirmarQuitarId(null)} className="px-2 py-1 rounded text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">No</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setConfirmarQuitarId(o.id)} className="px-2.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50">
                            Quitar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 p-3 bg-teal-50 rounded-lg text-sm text-teal-800">
            <HiInformationCircle className="w-5 h-5 inline mr-2" />
            La lista sale del personal del sistema de Petróleo. Quitar a alguien no cambia las dumpadas que ya registró.
          </div>
        </>
      )}
    </Card>
  );
};

export default OperadoresAutorizadosSection;
