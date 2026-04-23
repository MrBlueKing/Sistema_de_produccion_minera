import React, { useState, useEffect } from 'react';
import { HiPlus, HiX, HiTruck, HiSave, HiTrash } from 'react-icons/hi';
import { BiCar } from 'react-icons/bi';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../../../services/laboratorio';
import mezclasService from '../services/mezclas';
import configuracionService from '../../../services/configuracion';
import Button from '../../../shared/components/atoms/Button';

const CamionadasMultiplesForm = ({ onSuccess, onCancel, loteIdPreseleccionado = null }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [mezclas, setMezclas] = useState([]);
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [lotesAbiertos, setLotesAbiertos] = useState([]);
  const [cargandoMaquinas, setCargandoMaquinas] = useState(true);
  const [cargandoMezclas, setCargandoMezclas] = useState(true);
  const [pesoCamionDefault, setPesoCamionDefault] = useState(29);

  const [formGeneral, setFormGeneral] = useState({
    mezcla_default_id: '',
    lote_id: loteIdPreseleccionado ? String(loteIdPreseleccionado) : '',
    fecha_despacho: new Date().toISOString().split('T')[0],
  });

  const [camionadas, setCamionadas] = useState([
    { id: 1, patente: '', peso: pesoCamionDefault, mezcla_id: '' }
  ]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      setCargandoMaquinas(true);
      const [mezclasRes, plantasRes, empresasRes, configRes, camionesRes, lotesRes] = await Promise.all([
        mezclasService.getMezclas(),
        laboratorioService.getPlantas({ activas: true }),
        laboratorioService.getEmpresas({ activas: true }),
        configuracionService.getAll(),
        laboratorioService.getCamiones({ activos: true }),
        laboratorioService.getLotesAbiertos()
      ]);

      const mezclasData = mezclasRes.data?.data || mezclasRes.data || mezclasRes || [];
      setMezclas(mezclasData.filter(m => parseFloat(m.toneladas_disponibles ?? m.total_ton ?? 0) > 0));
      setCargandoMezclas(false);
      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
      setMaquinas(camionesRes || []);
      setLotesAbiertos(lotesRes || []);

      const pesoDefault = configRes.peso_camion_default || 29;
      setPesoCamionDefault(pesoDefault);
      setCamionadas(prev => prev.map(c => ({ ...c, peso: c.peso || pesoDefault })));

      if (loteIdPreseleccionado && lotesRes) {
        const lotePresel = lotesRes.find(l => l.id === parseInt(loteIdPreseleccionado));
        if (lotePresel) {
          setFormGeneral(prev => ({
            ...prev,
            lote_id: String(lotePresel.id),
          }));
        }
      }
    } catch (error) {
      toast.error('Error al cargar datos', error.message);
    } finally {
      setCargandoMaquinas(false);
    }
  };

  const agregarCamionada = () => {
    const nuevoId = Math.max(...camionadas.map(c => c.id), 0) + 1;
    setCamionadas([...camionadas, {
      id: nuevoId,
      patente: '',
      peso: pesoCamionDefault,
      mezcla_id: formGeneral.mezcla_default_id
    }]);
  };

  const quitarCamionada = (id) => {
    if (camionadas.length > 1) setCamionadas(camionadas.filter(c => c.id !== id));
  };

  const actualizarCamionada = (id, campo, valor) => {
    setCamionadas(camionadas.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  };

  const aplicarMezclaPorDefecto = () => {
    if (!formGeneral.mezcla_default_id) return;
    setCamionadas(prev => prev.map(c => ({ ...c, mezcla_id: formGeneral.mezcla_default_id })));
    toast.success('Mezcla aplicada a todas las camionadas');
  };

  const calcularTotalPeso = () => camionadas.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);

  const validarFormulario = () => {
    if (!formGeneral.lote_id) { toast.warning('Selecciona un lote'); return false; }
    const invalidas = camionadas.filter(c => c.patente && c.peso > 0 && !c.mezcla_id);
    if (invalidas.length > 0) {
      toast.warning(`${invalidas.length} camionada(s) sin mezcla asignada`);
      return false;
    }
    const validas = camionadas.filter(c => c.patente && c.peso > 0 && c.mezcla_id);
    if (validas.length === 0) {
      toast.warning('Debes agregar al menos una camionada con patente, peso y mezcla');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setLoading(true);
    try {
      const camionadasValidas = camionadas.filter(c => c.patente && c.peso > 0 && c.mezcla_id);

      const promesas = camionadasValidas.map(camionada =>
        laboratorioService.createCamionada({
          mezcla_id: parseInt(camionada.mezcla_id),
          lote_id: parseInt(formGeneral.lote_id),
          patente: camionada.patente,
          peso: parseFloat(camionada.peso),
          fecha_despacho: formGeneral.fecha_despacho,
        })
      );

      await Promise.all(promesas);
      toast.success(`${camionadasValidas.length} camionada(s) creada(s)`, `Total: ${calcularTotalPeso().toFixed(2)} t`);
      onSuccess();
    } catch (error) {
      toast.error('Error al crear camionadas', error.response?.data?.mensaje || error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMezclaInfo = (mezclaId) => mezclas.find(m => m.id === parseInt(mezclaId));

  // Toneladas asignadas en el formulario por mezcla
  const toneladasAsignadas = camionadas.reduce((acc, c) => {
    if (!c.mezcla_id) return acc;
    acc[c.mezcla_id] = (acc[c.mezcla_id] || 0) + (parseFloat(c.peso) || 0);
    return acc;
  }, {});

  const getDisponibleReal = (mezcla) => {
    const disponible = parseFloat(mezcla.toneladas_disponibles ?? mezcla.total_ton ?? 0);
    const asignado = toneladasAsignadas[mezcla.id] || 0;
    return disponible - asignado;
  };

  // Resumen de mezclas usadas
  const resumenMezclas = camionadas.reduce((acc, c) => {
    if (!c.mezcla_id) return acc;
    if (!acc[c.mezcla_id]) acc[c.mezcla_id] = { count: 0, peso: 0 };
    acc[c.mezcla_id].count++;
    acc[c.mezcla_id].peso += parseFloat(c.peso) || 0;
    return acc;
  }, {});

  return (
    <div className="w-full bg-white rounded-lg shadow-lg border-2 border-blue-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <HiTruck className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Crear Camionadas</h2>
              <p className="text-blue-100 text-sm mt-1">Cada camionada puede tener su propia mezcla de origen</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <HiX className="w-6 h-6" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* Datos Generales */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <h3 className="font-bold text-blue-900 mb-3">Datos Generales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lote */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lote *</label>
              <select
                value={formGeneral.lote_id}
                onChange={(e) => {
                  const lote = lotesAbiertos.find(l => l.id === parseInt(e.target.value));
                  setFormGeneral({ ...formGeneral, lote_id: e.target.value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!!loteIdPreseleccionado}
                required
              >
                <option value="">Seleccionar lote...</option>
                {lotesAbiertos.map(lote => (
                  <option key={lote.id} value={lote.id}>
                    {lote.numero_lote} — {lote.planta?.nombre} ({lote.empresa?.nombre})
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Despacho *</label>
              <input
                type="date"
                value={formGeneral.fecha_despacho}
                onChange={(e) => setFormGeneral({ ...formGeneral, fecha_despacho: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Mezcla por defecto */}
          <div className="mt-4 pt-4 border-t border-blue-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mezcla por defecto <span className="text-gray-400 font-normal">(se aplica al agregar nuevas filas)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={formGeneral.mezcla_default_id}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormGeneral({ ...formGeneral, mezcla_default_id: val });
                  // Aplicar a filas que aún no tienen mezcla asignada
                  setCamionadas(prev => prev.map(c => c.mezcla_id ? c : { ...c, mezcla_id: val }));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{cargandoMezclas ? 'Cargando mezclas...' : 'Sin mezcla por defecto'}</option>
                {mezclas.map(m => {
                  const total = parseFloat(m.toneladas_disponibles ?? m.total_ton ?? 0);
                  const asig = toneladasAsignadas[m.id] || 0;
                  const libre = total - asig;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.codigo} — {total.toFixed(1)} t totales · {libre.toFixed(1)} t libres
                    </option>
                  );
                })}
              </select>
              {formGeneral.mezcla_default_id && (
                <button
                  type="button"
                  onClick={aplicarMezclaPorDefecto}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Aplicar a todas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Camionadas */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-400 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-orange-500 text-white p-2 rounded-lg">
                <HiTruck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-orange-900">Camionadas a Crear</h3>
                <p className="text-xs text-orange-700">{camionadas.length} camión(es) en lista</p>
              </div>
            </div>
            <Button type="button" variant="primary" size="sm" onClick={agregarCamionada} icon={HiPlus} className="bg-orange-500 hover:bg-orange-600">
              Agregar Camión
            </Button>
          </div>

          {/* Cabecera de columnas */}
          <div className="hidden md:grid md:grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-3 px-4 mb-1 text-xs font-semibold text-orange-700 uppercase tracking-wide">
            <div></div>
            <div>Camión / Patente</div>
            <div>Peso (ton)</div>
            <div>Mezcla de origen</div>
            <div></div>
          </div>

          <div className="space-y-2">
            {camionadas.map((camionada, index) => {
              const mezcla = getMezclaInfo(camionada.mezcla_id);
              return (
                <div
                  key={camionada.id}
                  className={`grid grid-cols-1 md:grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-3 items-center bg-white p-3 rounded-lg border-2 transition-all shadow-sm ${
                    camionada.mezcla_id ? 'border-orange-200' : 'border-red-200'
                  }`}
                >
                  {/* Número */}
                  <div className="hidden md:flex w-8 h-8 bg-orange-500 text-white rounded-lg items-center justify-center text-sm font-bold shrink-0">
                    {index + 1}
                  </div>

                  {/* Patente */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 md:hidden">Camión</label>
                    <select
                      value={camionada.patente}
                      onChange={(e) => actualizarCamionada(camionada.id, 'patente', e.target.value)}
                      disabled={cargandoMaquinas}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 font-mono text-sm disabled:bg-gray-100"
                    >
                      <option value="">{cargandoMaquinas ? 'Cargando...' : 'Seleccione...'}</option>
                      {maquinas.map(cam => (
                        <option key={cam.id} value={cam.patente}>
                          {cam.nombre} ({cam.patente})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Peso */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 md:hidden">Peso (ton)</label>
                    <input
                      type="number"
                      value={camionada.peso}
                      onChange={(e) => actualizarCamionada(camionada.id, 'peso', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 font-bold text-sm"
                    />
                  </div>

                  {/* Mezcla */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 md:hidden">Mezcla</label>
                    <select
                      value={camionada.mezcla_id}
                      onChange={(e) => actualizarCamionada(camionada.id, 'mezcla_id', e.target.value)}
                      className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-orange-400 text-sm font-semibold ${
                        camionada.mezcla_id ? 'border-green-300 text-green-800 bg-green-50' : 'border-red-300 bg-red-50 text-red-500'
                      }`}
                    >
                      <option value="">{cargandoMezclas ? 'Cargando mezclas...' : '— Sin mezcla —'}</option>
                      {mezclas.map(m => {
                        const disp = parseFloat(m.toneladas_disponibles ?? m.total_ton ?? 0);
                        const asig = toneladasAsignadas[m.id] || 0;
                        const resta = disp - asig;
                        return (
                          <option key={m.id} value={m.id}>
                            {m.codigo} · {resta.toFixed(1)} t libres
                          </option>
                        );
                      })}
                    </select>
                    {mezcla && (() => {
                      const total = parseFloat(mezcla.toneladas_disponibles ?? mezcla.total_ton ?? 0);
                      const asig = toneladasAsignadas[mezcla.id] || 0;
                      const libre = total - asig;
                      const excede = libre < 0;
                      return (
                        <div className="flex items-center justify-between text-[10px] mt-0.5 px-1">
                          <span className="text-gray-400">Total: <span className="font-semibold text-gray-600">{total.toFixed(1)} t</span></span>
                          <span className={excede ? 'text-red-500 font-bold' : 'text-green-600 font-semibold'}>
                            {excede ? `⚠ excede ${Math.abs(libre).toFixed(1)} t` : `${libre.toFixed(1)} t libres`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Eliminar */}
                  {camionadas.length > 1 ? (
                    <button type="button" onClick={() => quitarCamionada(camionada.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <HiTrash className="w-5 h-5" />
                    </button>
                  ) : <div />}
                </div>
              );
            })}
          </div>

          {/* Resumen por mezcla + total */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Resumen por mezcla */}
            {Object.keys(resumenMezclas).length > 0 && (
              <div className="bg-white rounded-xl border border-orange-200 p-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Por mezcla</p>
                <div className="space-y-1">
                  {Object.entries(resumenMezclas).map(([mezclaId, info]) => {
                    const m = getMezclaInfo(mezclaId);
                    const disp = parseFloat(m?.toneladas_disponibles ?? m?.total_ton ?? 0);
                    const libre = disp - info.peso;
                    const excede = libre < 0;
                    return (
                      <div key={mezclaId} className={`flex items-center justify-between text-sm py-1 px-2 rounded ${excede ? 'bg-red-50' : ''}`}>
                        <span className="font-mono font-bold text-indigo-700">{m?.codigo || mezclaId}</span>
                        <div className="text-right">
                          <span className="text-gray-500">{info.count} cam. · <span className="font-semibold text-gray-700">{info.peso.toFixed(2)} t</span></span>
                          {excede && (
                            <div className="text-red-500 font-bold text-xs">⚠ déficit {Math.abs(libre).toFixed(2)} t</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs uppercase tracking-wide">Total a despachar</p>
                <p className="text-3xl font-bold mt-0.5">{calcularTotalPeso().toFixed(2)} t</p>
              </div>
              <div className="text-right">
                <p className="text-orange-100 text-xs uppercase tracking-wide">Camionadas</p>
                <p className="text-3xl font-bold mt-0.5">{camionadas.filter(c => c.patente && c.peso > 0).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4 pt-4 border-t-2 border-gray-200">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading} className="px-8 py-3 text-lg">
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || cargandoMaquinas || maquinas.length === 0}
            icon={HiSave}
            className="px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Creando...' :
             cargandoMaquinas ? 'Cargando...' :
             maquinas.length === 0 ? 'Sin camiones disponibles' :
             `Crear ${camionadas.filter(c => c.patente && c.peso > 0 && c.mezcla_id).length} Camionada(s)`}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CamionadasMultiplesForm;
