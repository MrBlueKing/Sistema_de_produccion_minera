import React, { useState, useEffect } from 'react';
import { HiPlus, HiX, HiTruck, HiSave, HiTrash, HiOfficeBuilding } from 'react-icons/hi';
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
  const [cargandoMaquinas, setCargandoMaquinas] = useState(false);
  const [mezclaSeleccionada, setMezclaSeleccionada] = useState(null);
  const [pesoCamionDefault, setPesoCamionDefault] = useState(29);

  const [formGeneral, setFormGeneral] = useState({
    mezcla_id: '',
    lote_id: loteIdPreseleccionado ? String(loteIdPreseleccionado) : '',
    planta_id: '',
    empresa_id: '',
    fecha_despacho: new Date().toISOString().split('T')[0],
  });

  const [camionadas, setCamionadas] = useState([
    { id: 1, patente: '', peso: pesoCamionDefault }
  ]);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (formGeneral.mezcla_id) {
      const mezcla = mezclas.find(m => m.id === parseInt(formGeneral.mezcla_id));
      setMezclaSeleccionada(mezcla);
      // Solo auto-completar planta si no viene de un lote
      if (mezcla && mezcla.planta_id && !formGeneral.lote_id) {
        setFormGeneral(prev => ({ ...prev, planta_id: String(mezcla.planta_id) }));
      }
    } else {
      setMezclaSeleccionada(null);
    }
  }, [formGeneral.mezcla_id, mezclas]);

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

      // Obtener data o data.data dependiendo de la respuesta
      const mezclasData = mezclasRes.data?.data || mezclasRes.data || mezclasRes || [];
      setMezclas(mezclasData);
      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
      setMaquinas(camionesRes || []);
      setLotesAbiertos(lotesRes || []);

      const pesoDefault = configRes.peso_camion_default || 29;
      setPesoCamionDefault(pesoDefault);

      // Actualizar peso en camionadas existentes
      setCamionadas(prev => prev.map(c => ({ ...c, peso: c.peso || pesoDefault })));

      // Si hay lote preseleccionado, auto-completar planta y empresa
      if (loteIdPreseleccionado && lotesRes) {
        const lotePresel = lotesRes.find(l => l.id === parseInt(loteIdPreseleccionado));
        if (lotePresel) {
          setFormGeneral(prev => ({
            ...prev,
            lote_id: String(lotePresel.id),
            planta_id: String(lotePresel.planta_id),
            empresa_id: String(lotePresel.empresa_id),
          }));
        }
      }

    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar datos', error.message);
    } finally {
      setCargandoMaquinas(false);
    }
  };

  const agregarCamionada = () => {
    const nuevoId = Math.max(...camionadas.map(c => c.id), 0) + 1;
    setCamionadas([...camionadas, { id: nuevoId, patente: '', peso: pesoCamionDefault }]);
  };

  const quitarCamionada = (id) => {
    if (camionadas.length > 1) {
      setCamionadas(camionadas.filter(c => c.id !== id));
    }
  };

  const actualizarCamionada = (id, campo, valor) => {
    setCamionadas(camionadas.map(c =>
      c.id === id ? { ...c, [campo]: valor } : c
    ));
  };

  const calcularTotalPeso = () => {
    return camionadas.reduce((sum, c) => sum + (parseFloat(c.peso) || 0), 0);
  };

  const validarFormulario = () => {
    if (!formGeneral.lote_id) {
      toast.warning('Selecciona un lote');
      return false;
    }

    if (!formGeneral.mezcla_id) {
      toast.warning('Selecciona una mezcla');
      return false;
    }

    const camionadasValidas = camionadas.filter(c => c.patente && c.peso > 0);
    if (camionadasValidas.length === 0) {
      toast.warning('Debes agregar al menos una camionada con patente y peso');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      return;
    }

    // Verificar si el peso teórico excede toneladas disponibles
    const totalPeso = calcularTotalPeso();
    const toneladasDisponibles = parseFloat(mezclaSeleccionada?.toneladas_disponibles ?? mezclaSeleccionada?.total_ton ?? 0);
    const excedeTeorico = totalPeso > toneladasDisponibles;

    if (excedeTeorico) {
      toast.warning(
        '⚠️ Peso teórico excede estimado',
        `Total: ${totalPeso.toFixed(2)} t | Disponible: ${toneladasDisponibles.toFixed(2)} t. Se validará con peso real en recepción.`,
        { duration: 5000 }
      );
    }

    setLoading(true);

    try {
      const camionadasValidas = camionadas.filter(c => c.patente && c.peso > 0);

      // Crear cada camionada
      const promesas = camionadasValidas.map(camionada =>
        laboratorioService.createCamionada({
          mezcla_id: parseInt(formGeneral.mezcla_id),
          lote_id: parseInt(formGeneral.lote_id),
          planta_id: formGeneral.planta_id ? parseInt(formGeneral.planta_id) : null,
          empresa_id: formGeneral.empresa_id ? parseInt(formGeneral.empresa_id) : null,
          patente: camionada.patente,
          peso: parseFloat(camionada.peso),
          fecha_despacho: formGeneral.fecha_despacho,
        })
      );

      await Promise.all(promesas);

      toast.success(
        `${camionadasValidas.length} camionada(s) creada(s)`,
        `Total despachado (teórico): ${calcularTotalPeso().toFixed(2)} t`
      );

      onSuccess();
    } catch (error) {
      console.error('Error creando camionadas:', error);
      toast.error(
        'Error al crear camionadas',
        error.response?.data?.mensaje || error.message
      );
    } finally {
      setLoading(false);
    }
  };

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
              <p className="text-blue-100 text-sm mt-1">Despachar múltiples camiones de una mezcla</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Datos Generales */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <h3 className="font-bold text-blue-900 mb-3">📋 Datos Generales</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Lote */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lote *
              </label>
              <select
                value={formGeneral.lote_id}
                onChange={(e) => {
                  const loteId = e.target.value;
                  const lote = lotesAbiertos.find(l => l.id === parseInt(loteId));
                  setFormGeneral({
                    ...formGeneral,
                    lote_id: loteId,
                    planta_id: lote ? String(lote.planta_id) : '',
                    empresa_id: lote ? String(lote.empresa_id) : '',
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!!loteIdPreseleccionado}
                required
              >
                <option value="">Seleccionar lote...</option>
                {lotesAbiertos.map(lote => (
                  <option key={lote.id} value={lote.id}>
                    {lote.numero_lote} - {lote.planta?.nombre || ''} ({lote.empresa?.nombre || ''})
                  </option>
                ))}
              </select>
              {formGeneral.lote_id && (() => {
                const lote = lotesAbiertos.find(l => l.id === parseInt(formGeneral.lote_id));
                return lote ? (
                  <p className="text-xs text-blue-600 mt-1">
                    Planta: {lote.planta?.nombre} | Empresa: {lote.empresa?.nombre}
                  </p>
                ) : null;
              })()}
            </div>

            {/* Mezcla */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mezcla *
              </label>
              <select
                value={formGeneral.mezcla_id}
                onChange={(e) => setFormGeneral({ ...formGeneral, mezcla_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar mezcla...</option>
                {mezclas.map(mezcla => (
                  <option key={mezcla.id} value={mezcla.id}>
                    {mezcla.codigo} - {parseFloat(mezcla.toneladas_disponibles ?? mezcla.total_ton ?? 0).toFixed(2)} t
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Despacho *
              </label>
              <input
                type="date"
                value={formGeneral.fecha_despacho}
                onChange={(e) => setFormGeneral({ ...formGeneral, fecha_despacho: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Info de Mezcla Seleccionada */}
          {mezclaSeleccionada && (
            <div className="mt-4 space-y-2">
              <div className="p-4 bg-gradient-to-r from-white to-blue-50 rounded-lg border-2 border-blue-300 shadow-sm">
                <div className="flex items-center gap-3">
                  <HiOfficeBuilding className="w-6 h-6 text-blue-600" />
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600 font-medium uppercase">Total Mezcla (Estimado)</p>
                      <p className="text-lg font-bold text-gray-900">
                        {parseFloat(mezclaSeleccionada.total_ton || 0).toFixed(2)} t
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-700 font-medium uppercase">Disponibles (Estimado)</p>
                      <p className="text-lg font-bold text-green-600">
                        {parseFloat(mezclaSeleccionada.toneladas_disponibles ?? mezclaSeleccionada.total_ton ?? 0).toFixed(2)} t
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-blue-600 text-lg flex-shrink-0">ℹ️</span>
                <p className="text-xs text-blue-800">
                  <strong>Nota:</strong> Los pesos que ingreses aquí son <strong>teóricos/estimados</strong>.
                  El sistema descontará las toneladas reales cuando recibas cada camionada en la planta.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Advertencia si excede toneladas disponibles */}
        {mezclaSeleccionada && calcularTotalPeso() > parseFloat(mezclaSeleccionada.toneladas_disponibles ?? mezclaSeleccionada.total_ton ?? 0) && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-yellow-900 mb-1">Peso Teórico Excede Toneladas Estimadas</h4>
              <p className="text-sm text-yellow-800">
                El total de <strong>{calcularTotalPeso().toFixed(2)} t</strong> excede las{' '}
                <strong>{parseFloat(mezclaSeleccionada.toneladas_disponibles ?? mezclaSeleccionada.total_ton ?? 0).toFixed(2)} t</strong> disponibles.
                Los pesos teóricos son estimaciones, se validará con el <strong>peso real en recepción</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Lista de Camionadas */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-400 p-5 rounded-lg shadow-sm">
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={agregarCamionada}
              icon={HiPlus}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Agregar Camión
            </Button>
          </div>

          <div className="space-y-3">
            {camionadas.map((camionada, index) => (
              <div
                key={camionada.id}
                className="flex items-center gap-4 bg-white p-4 rounded-lg border-2 border-orange-200 hover:border-orange-400 transition-all shadow-sm"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl flex items-center justify-center text-xl font-bold shadow-md">
                  {index + 1}
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      <BiCar className="inline mr-1" />
                      Camión / Patente *
                    </label>
                    <select
                      value={camionada.patente}
                      onChange={(e) => actualizarCamionada(camionada.id, 'patente', e.target.value)}
                      disabled={cargandoMaquinas}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono font-bold disabled:bg-gray-100"
                    >
                      <option value="">
                        {cargandoMaquinas ? 'Cargando camiones...' : 'Seleccione un camión...'}
                      </option>
                      {maquinas.map((camion) => (
                        <option key={camion.id} value={camion.patente}>
                          {camion.nombre} ({camion.patente}){camion.categoria ? ` - ${camion.categoria}` : ''}
                        </option>
                      ))}
                    </select>
                    {maquinas.length === 0 && !cargandoMaquinas && (
                      <p className="text-xs text-red-600 mt-1 font-semibold">
                        ⚠️ No hay camiones disponibles
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Peso (toneladas) *
                    </label>
                    <input
                      type="number"
                      value={camionada.peso}
                      onChange={(e) => actualizarCamionada(camionada.id, 'peso', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-bold"
                    />
                  </div>
                </div>

                {camionadas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarCamionada(camionada.id)}
                    className="flex-shrink-0 p-3 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Quitar camionada"
                  >
                    <HiTrash className="w-6 h-6" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-5 p-5 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium uppercase">Total a Despachar (Teórico)</p>
                <p className="text-4xl font-bold mt-1">
                  {calcularTotalPeso().toFixed(2)} t
                </p>
              </div>
              {mezclaSeleccionada && (() => {
                const disponibles = parseFloat(mezclaSeleccionada.toneladas_disponibles ?? mezclaSeleccionada.total_ton ?? 0);
                const total = calcularTotalPeso();
                const remanente = disponibles - total;
                const excede = remanente < 0;

                return (
                  <div className="text-right">
                    <p className={`text-sm font-medium uppercase ${excede ? 'text-red-200' : 'text-orange-100'}`}>
                      {excede ? '⚠️ Excede Estimado' : 'Quedarán Disponibles'}
                    </p>
                    <p className={`text-3xl font-bold mt-1 ${excede ? 'text-red-300' : 'text-white'}`}>
                      {excede ? `+${Math.abs(remanente).toFixed(2)}` : remanente.toFixed(2)} t
                    </p>
                    {excede && (
                      <p className="text-xs text-red-200 mt-2 max-w-xs">
                        Se validará con peso real en recepción
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-end gap-4 pt-4 border-t-2 border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
              className="px-8 py-3 text-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || maquinas.length === 0}
              icon={HiSave}
              className="px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creando...' :
               maquinas.length === 0 ? 'Sin camiones disponibles' :
               `Crear ${camionadas.filter(c => c.patente && c.peso > 0).length} Camionada(s)`}
            </Button>
          </div>

          {maquinas.length === 0 && !loading && (
            <p className="text-center text-red-600 text-sm font-semibold bg-red-50 p-3 rounded-md border border-red-200">
              No hay camiones registrados. Registre camiones en la pestaña Plantas &gt; Camiones.
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default CamionadasMultiplesForm;
