import React, { useState, useEffect } from 'react';
import { HiPlus, HiX, HiTruck, HiSave, HiTrash, HiLightningBolt } from 'react-icons/hi';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../../../services/laboratorio';
import mezclasService from '../services/mezclas';
import configuracionService from '../../../services/configuracion';
import Button from '../../../shared/components/atoms/Button';

const mezclaVacia = () => ({ id: Date.now() + Math.random(), mezcla_id: '', toneladas: '' });

const CamionadasMultiplesForm = ({ onSuccess, onCancel, loteIdPreseleccionado = null }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [mezclas, setMezclas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [lotesAbiertos, setLotesAbiertos] = useState([]);
  const [cargandoMaquinas, setCargandoMaquinas] = useState(true);
  const [cargandoMezclas, setCargandoMezclas] = useState(true);
  const [pesoCamionDefault, setPesoCamionDefault] = useState(29);

  const [formGeneral, setFormGeneral] = useState({
    lote_id: loteIdPreseleccionado ? String(loteIdPreseleccionado) : '',
    fecha_despacho: new Date().toISOString().split('T')[0],
  });

  const [camionadas, setCamionadas] = useState([
    { id: 1, patente: '', peso: pesoCamionDefault, mezclas: [mezclaVacia()] }
  ]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      setCargandoMaquinas(true);
      const [mezclasRes, configRes, camionesRes, lotesRes] = await Promise.all([
        mezclasService.getMezclas(),
        configuracionService.getAll(),
        laboratorioService.getCamiones({ activos: true }),
        laboratorioService.getLotesAbiertos()
      ]);

      const mezclasData = mezclasRes.data?.data || mezclasRes.data || mezclasRes || [];
      setMezclas(mezclasData.filter(m => parseFloat(m.toneladas_disponibles ?? m.total_ton ?? 0) > 0));
      setCargandoMezclas(false);
      setMaquinas(camionesRes || []);
      setLotesAbiertos(lotesRes || []);

      const pesoDefault = configRes.peso_camion_default || 29;
      setPesoCamionDefault(pesoDefault);
      setCamionadas(prev => prev.map(c => ({ ...c, peso: c.peso || pesoDefault })));

      if (loteIdPreseleccionado && lotesRes) {
        const lotePresel = lotesRes.find(l => l.id === parseInt(loteIdPreseleccionado));
        if (lotePresel) {
          setFormGeneral(prev => ({ ...prev, lote_id: String(lotePresel.id) }));
        }
      }
    } catch (error) {
      toast.error('Error al cargar datos', error.message);
    } finally {
      setCargandoMaquinas(false);
    }
  };

  // ── Camionadas ──────────────────────────────────────────────────────────

  const agregarCamionada = () => {
    const nuevoId = Math.max(...camionadas.map(c => c.id), 0) + 1;
    setCamionadas([...camionadas, { id: nuevoId, patente: '', peso: pesoCamionDefault, mezclas: [mezclaVacia()] }]);
  };

  const quitarCamionada = (id) => {
    if (camionadas.length > 1) setCamionadas(camionadas.filter(c => c.id !== id));
  };

  const actualizarCamionada = (id, campo, valor) => {
    setCamionadas(camionadas.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  };

  // ── Mezclas por camionada ───────────────────────────────────────────────

  const agregarMezclaACamionada = (camionadaId) => {
    setCamionadas(camionadas.map(c =>
      c.id === camionadaId
        ? { ...c, mezclas: [...c.mezclas, mezclaVacia()] }
        : c
    ));
  };

  const quitarMezclaDeCamionada = (camionadaId, mezclaRowId) => {
    setCamionadas(camionadas.map(c => {
      if (c.id !== camionadaId) return c;
      if (c.mezclas.length <= 1) return c;
      return { ...c, mezclas: c.mezclas.filter(m => m.id !== mezclaRowId) };
    }));
  };

  const actualizarMezclaDeCamionada = (camionadaId, mezclaRowId, campo, valor) => {
    setCamionadas(prev => prev.map(c => {
      if (c.id !== camionadaId) return c;
      const nuevasMezclas = c.mezclas.map(m => m.id === mezclaRowId ? { ...m, [campo]: valor } : m);

      // Al seleccionar mezcla, autocompletar toneladas con el peso restante del camión
      if (campo === 'mezcla_id' && valor) {
        const peso = parseFloat(c.peso) || 0;
        const sumaOtras = nuevasMezclas
          .filter(m => m.id !== mezclaRowId)
          .reduce((s, m) => s + (parseFloat(m.toneladas) || 0), 0);
        const restante = Math.max(0, Math.round((peso - sumaOtras) * 100) / 100);
        return { ...c, mezclas: nuevasMezclas.map(m => m.id === mezclaRowId ? { ...m, toneladas: String(restante) } : m) };
      }

      return { ...c, mezclas: nuevasMezclas };
    }));
  };

  const distribuirToneladas = (camionadaId) => {
    setCamionadas(camionadas.map(c => {
      if (c.id !== camionadaId) return c;
      const peso = parseFloat(c.peso) || 0;
      const n = c.mezclas.length;
      if (n === 0 || peso === 0) return c;
      const porMezcla = Math.floor((peso / n) * 100) / 100;
      const resto = Math.round((peso - porMezcla * n) * 100) / 100;
      return {
        ...c,
        mezclas: c.mezclas.map((m, i) => ({
          ...m,
          toneladas: i === n - 1 ? String(porMezcla + resto) : String(porMezcla)
        }))
      };
    }));
  };

  // ── Cálculos ───────────────────────────────────────────────────────────

  const calcularTotalPeso = () => camionadas.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);

  const getMezclaInfo = (mezclaId) => mezclas.find(m => m.id === parseInt(mezclaId));

  // Toneladas asignadas en el formulario por mezcla (global, todas las camionadas)
  const toneladasAsignadas = camionadas.reduce((acc, c) => {
    c.mezclas.forEach(m => {
      if (!m.mezcla_id) return;
      acc[m.mezcla_id] = (acc[m.mezcla_id] || 0) + (parseFloat(m.toneladas) || 0);
    });
    return acc;
  }, {});

  const getDisponibleReal = (mezclaId) => {
    const m = getMezclaInfo(mezclaId);
    if (!m) return 0;
    const disponible = parseFloat(m.toneladas_disponibles ?? m.total_ton ?? 0);
    return disponible - (toneladasAsignadas[mezclaId] || 0);
  };

  const getSumaMezclasCamionada = (camionada) =>
    camionada.mezclas.reduce((s, m) => s + (parseFloat(m.toneladas) || 0), 0);

  const mezclasSumanCorrecto = (camionada) => {
    const peso = parseFloat(camionada.peso) || 0;
    const suma = getSumaMezclasCamionada(camionada);
    return Math.abs(peso - suma) < 0.01;
  };

  // ── Validación ─────────────────────────────────────────────────────────

  const validarFormulario = () => {
    if (!formGeneral.lote_id) { toast.warning('Selecciona un lote'); return false; }

    const validas = camionadas.filter(c => c.patente && parseFloat(c.peso) > 0);
    if (validas.length === 0) {
      toast.warning('Debes agregar al menos una camionada con patente y peso');
      return false;
    }

    for (const c of validas) {
      const mezclasValidas = c.mezclas.filter(m => m.mezcla_id && parseFloat(m.toneladas) > 0);
      if (mezclasValidas.length === 0) {
        toast.warning('Todas las camionadas deben tener al menos una mezcla con toneladas');
        return false;
      }
      if (!mezclasSumanCorrecto(c)) {
        toast.warning(`La suma de toneladas de mezclas debe coincidir con el peso del camión (${parseFloat(c.peso).toFixed(2)} t)`);
        return false;
      }
    }

    return true;
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setLoading(true);
    try {
      const camionadasValidas = camionadas.filter(c => c.patente && parseFloat(c.peso) > 0);

      const promesas = camionadasValidas.map(camionada =>
        laboratorioService.createCamionada({
          mezclas: camionada.mezclas
            .filter(m => m.mezcla_id && parseFloat(m.toneladas) > 0)
            .map(m => ({ mezcla_id: parseInt(m.mezcla_id), toneladas: parseFloat(m.toneladas) })),
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

  // ── Render ─────────────────────────────────────────────────────────────

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
              <p className="text-blue-100 text-sm mt-1">Cada camionada puede mezclar material de distintas mezclas</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lote *</label>
              <select
                value={formGeneral.lote_id}
                onChange={(e) => setFormGeneral({ ...formGeneral, lote_id: e.target.value })}
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {camionadas.map((camionada, index) => {
              const suma = getSumaMezclasCamionada(camionada);
              const peso = parseFloat(camionada.peso) || 0;
              const diferencia = suma - peso;
              const ok = Math.abs(diferencia) < 0.01;

              return (
                <div key={camionada.id} className="bg-white rounded-xl border-2 border-orange-200 shadow-sm overflow-hidden">
                  {/* Fila principal */}
                  <div className="grid grid-cols-[1.5rem_1fr_8rem_1.5rem] gap-2 items-center px-3 py-2 bg-orange-50">
                    <div className="w-6 h-6 bg-orange-500 text-white rounded-md flex items-center justify-center text-xs font-bold shrink-0">
                      {index + 1}
                    </div>

                    {/* Patente */}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Camión</label>
                      <select
                        value={camionada.patente}
                        onChange={(e) => actualizarCamionada(camionada.id, 'patente', e.target.value)}
                        disabled={cargandoMaquinas}
                        className="w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 font-mono text-sm disabled:bg-gray-100"
                      >
                        <option value="">{cargandoMaquinas ? 'Cargando...' : 'Seleccione...'}</option>
                        {maquinas.map(cam => (
                          <option key={cam.id} value={cam.patente}>
                            {cam.nombre} ({cam.patente})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Peso total */}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Peso (t)</label>
                      <input
                        type="number"
                        value={camionada.peso}
                        onChange={(e) => actualizarCamionada(camionada.id, 'peso', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 font-bold text-sm"
                      />
                    </div>

                    {/* Eliminar camionada */}
                    {camionadas.length > 1 ? (
                      <button type="button" onClick={() => quitarCamionada(camionada.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end">
                        <HiTrash className="w-4 h-4" />
                      </button>
                    ) : <div />}
                  </div>

                  {/* Sub-tabla de mezclas */}
                  <div className="p-3 space-y-2">

                    {/* Encabezado mezclas */}
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mezclas de origen</p>
                      <div className="flex items-center gap-2">
                        {camionada.mezclas.length > 1 && peso > 0 && (
                          <button
                            type="button"
                            onClick={() => distribuirToneladas(camionada.id)}
                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors"
                            title="Distribuir el peso equitativamente entre todas las mezclas"
                          >
                            <HiLightningBolt className="w-3 h-3" /> Distribuir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => agregarMezclaACamionada(camionada.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                        >
                          <HiPlus className="w-3 h-3" /> Agregar mezcla
                        </button>
                      </div>
                    </div>

                    {/* Cabecera columnas */}
                    <div className="grid grid-cols-[1fr_10rem_2rem] gap-2 px-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mezcla</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Toneladas</span>
                      <span />
                    </div>

                    {camionada.mezclas.map((mezclaRow) => {
                      const dispReal = mezclaRow.mezcla_id ? getDisponibleReal(mezclaRow.mezcla_id) : null;
                      const excede = dispReal !== null && dispReal < 0;

                      return (
                        <div key={mezclaRow.id} className="grid grid-cols-[1fr_10rem_2rem] gap-2 items-start">
                          {/* Select mezcla */}
                          <select
                            value={mezclaRow.mezcla_id}
                            onChange={(e) => actualizarMezclaDeCamionada(camionada.id, mezclaRow.id, 'mezcla_id', e.target.value)}
                            className={`w-full px-3 py-2 border-2 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-400 ${
                              mezclaRow.mezcla_id ? 'border-green-300 text-green-800 bg-green-50' : 'border-gray-200'
                            }`}
                          >
                            <option value="">{cargandoMezclas ? 'Cargando...' : '— Seleccionar —'}</option>
                            {mezclas.map(mx => {
                              const disp = parseFloat(mx.toneladas_disponibles ?? mx.total_ton ?? 0);
                              const asig = toneladasAsignadas[mx.id] || 0;
                              const libre = disp - asig;
                              return (
                                <option key={mx.id} value={mx.id}>
                                  {mx.codigo} · {libre.toFixed(1)} t libres
                                </option>
                              );
                            })}
                          </select>

                          {/* Toneladas de esta mezcla */}
                          <div>
                            <input
                              type="number"
                              value={mezclaRow.toneladas}
                              onChange={(e) => actualizarMezclaDeCamionada(camionada.id, mezclaRow.id, 'toneladas', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              className={`w-full px-3 py-2 border-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-400 ${
                                excede ? 'border-red-400 bg-red-50' : 'border-gray-200'
                              }`}
                            />
                            {excede && (
                              <p className="text-red-500 text-[10px] font-bold mt-0.5">⚠ excede {Math.abs(dispReal).toFixed(2)} t</p>
                            )}
                          </div>

                          {/* Quitar mezcla */}
                          {camionada.mezclas.length > 1 ? (
                            <button type="button" onClick={() => quitarMezclaDeCamionada(camionada.id, mezclaRow.id)} className="p-1 mt-2 text-gray-400 hover:text-red-500 transition-colors">
                              <HiX className="w-4 h-4" />
                            </button>
                          ) : <div />}
                        </div>
                      );
                    })}

                    {/* Barra de progreso toneladas asignadas */}
                    {peso > 0 && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs text-gray-500">Toneladas asignadas</span>
                          <span className={`text-xs font-bold ${ok ? 'text-green-600' : suma > peso ? 'text-red-500' : 'text-orange-500'}`}>
                            {suma.toFixed(2)} / {peso.toFixed(2)} t
                            {ok ? ' ✓' : suma > peso ? ' — excede' : ` — faltan ${(peso - suma).toFixed(2)} t`}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${ok ? 'bg-green-500' : suma > peso ? 'bg-red-500' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min((suma / peso) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="text-right mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {peso > 0 ? Math.round((suma / peso) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total general */}
          <div className="mt-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs uppercase tracking-wide">Total a despachar</p>
              <p className="text-3xl font-bold mt-0.5">{calcularTotalPeso().toFixed(2)} t</p>
            </div>
            <div className="text-right">
              <p className="text-orange-100 text-xs uppercase tracking-wide">Camionadas</p>
              <p className="text-3xl font-bold mt-0.5">{camionadas.filter(c => c.patente && parseFloat(c.peso) > 0).length}</p>
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
             `Crear ${camionadas.filter(c => c.patente && parseFloat(c.peso) > 0).length} Camionada(s)`}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CamionadasMultiplesForm;
