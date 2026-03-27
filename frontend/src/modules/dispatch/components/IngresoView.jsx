import { useState } from 'react';
import { HiDocumentPlus, HiTrash, HiDocumentDuplicate, HiInformationCircle, HiBolt, HiChevronDown, HiChevronUp } from 'react-icons/hi2';
import Button from '../../../shared/components/atoms/Button';
import Input from '../../../shared/components/atoms/Input';
import Card from '../../../shared/components/atoms/Card';
import SearchableSelect from '../../../shared/components/atoms/SearchableSelect';
import AcopioSelectionModal from '../../../shared/components/molecules/AcopioSelectionModal';
import ProgressIndicator from '../../../shared/components/molecules/ProgressIndicator';
import useToast from '../../../hooks/useToast';
import dispatchService from '../services/dispatch';
import acopiosService from '../../../services/acopios';

export default function IngresoView({
  frentes,
  jornadas,
  maquinas,
  tonelajeDumpadaDefault,
  usarSistemaAcopios,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showLote, setShowLote] = useState(false);

  const [formsIngresoMasivo, setFormsIngresoMasivo] = useState([{
    id: 1, id_frente_trabajo: '', jornada: '', ley_visual: '', id_maquina: '', nombre_maquina: '', ton: '',
  }]);

  const [ingresoRapido, setIngresoRapido] = useState({
    id_frente_trabajo: '', jornada: '', cantidad: 1, ley_visual: '',
  });

  const [showAcopioModal, setShowAcopioModal] = useState(false);
  const [gruposDetectados, setGruposDetectados] = useState([]);
  const [dumpadasPendientes, setDumpadasPendientes] = useState([]);
  const [progressInfo, setProgressInfo] = useState({ show: false, steps: [] });

  const resetFormIngreso = () => {
    setFormsIngresoMasivo([{
      id: 1, id_frente_trabajo: '', jornada: '', ley_visual: '', id_maquina: '', nombre_maquina: '', ton: '',
    }]);
  };

  const agregarFilaIngreso = () => {
    const newId = Math.max(...formsIngresoMasivo.map(f => f.id)) + 1;
    setFormsIngresoMasivo([...formsIngresoMasivo, {
      id: newId, id_frente_trabajo: '', jornada: '', ley_visual: '', id_maquina: '', nombre_maquina: '', ton: '',
    }]);
  };

  const eliminarFilaIngreso = (id) => {
    if (formsIngresoMasivo.length > 1) {
      setFormsIngresoMasivo(formsIngresoMasivo.filter(f => f.id !== id));
    }
  };

  const actualizarFilaIngreso = (id, field, value) => {
    setFormsIngresoMasivo(formsIngresoMasivo.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const duplicarFilaIngreso = (id) => {
    const filaToDuplicate = formsIngresoMasivo.find(f => f.id === id);
    if (filaToDuplicate) {
      const newId = Math.max(...formsIngresoMasivo.map(f => f.id)) + 1;
      setFormsIngresoMasivo([...formsIngresoMasivo, {
        id: newId,
        id_frente_trabajo: filaToDuplicate.id_frente_trabajo,
        jornada: filaToDuplicate.jornada,
        ley_visual: filaToDuplicate.ley_visual,
        id_maquina: filaToDuplicate.id_maquina,
        nombre_maquina: filaToDuplicate.nombre_maquina,
        ton: filaToDuplicate.ton,
      }]);
      toast.success('Fila duplicada', 'Se ha agregado una nueva fila con los mismos datos');
    }
  };

  const handleIngresoRapido = () => {
    if (!ingresoRapido.id_frente_trabajo || !ingresoRapido.jornada || !ingresoRapido.ley_visual) {
      toast.warning('Atención', 'Debes completar Frente, Jornada y Ley Visual para el ingreso rápido');
      return;
    }
    const cantidad = parseInt(ingresoRapido.cantidad) || 1;
    if (cantidad < 1 || cantidad > 50) {
      toast.warning('Atención', 'La cantidad debe estar entre 1 y 50');
      return;
    }
    const maxId = formsIngresoMasivo.length > 0 ? Math.max(...formsIngresoMasivo.map(f => f.id)) : 0;
    const nuevasFilas = [];
    for (let i = 1; i <= cantidad; i++) {
      nuevasFilas.push({
        id: maxId + i,
        id_frente_trabajo: ingresoRapido.id_frente_trabajo,
        jornada: ingresoRapido.jornada,
        ley_visual: ingresoRapido.ley_visual,
        id_maquina: '', nombre_maquina: '', ton: '',
      });
    }
    setFormsIngresoMasivo([...formsIngresoMasivo, ...nuevasFilas]);
    toast.success(
      `${cantidad} dumpada(s) agregadas`,
      `Se agregaron ${cantidad} fila(s) con Frente: ${frentes.find(f => f.id === ingresoRapido.id_frente_trabajo)?.codigo_completo || ''}, Jornada: ${ingresoRapido.jornada}`
    );
    setIngresoRapido({ id_frente_trabajo: '', jornada: '', cantidad: 1, ley_visual: '' });
  };

  const handleSubmitIngresoMasivo = async (e) => {
    e.preventDefault();
    setLoading(true);
    const filasValidas = formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual && f.id_maquina && f.ton);
    if (filasValidas.length === 0) {
      toast.warning('Atención', 'Debes completar al menos una fila para guardar');
      setLoading(false);
      return;
    }
    const steps = usarSistemaAcopios
      ? [
          { id: 1, label: `Creando ${filasValidas.length} dumpada(s)...`, status: 'loading' },
          { id: 2, label: 'Detectando acopios existentes...', status: 'pending' },
          { id: 3, label: 'Asignando a acopios...', status: 'pending' },
        ]
      : [{ id: 1, label: `Creando ${filasValidas.length} dumpada(s)...`, status: 'loading' }];

    setProgressInfo({ show: true, steps });

    try {
      const dumpadasData = filasValidas.map(form => ({
        id_frente_trabajo: form.id_frente_trabajo,
        jornada: form.jornada,
        ley_visual: form.ley_visual,
        id_maquina: form.id_maquina ? parseInt(form.id_maquina) : null,
        nombre_maquina: form.nombre_maquina || null,
        ton: form.ton ? parseFloat(form.ton) : tonelajeDumpadaDefault,
      }));

      const bulkResponse = await dispatchService.createDumpadasBulk(dumpadasData);
      const dumpadasCreadas = bulkResponse.data;

      if (!usarSistemaAcopios) {
        setProgressInfo(prev => ({ ...prev, steps: prev.steps.map(s => ({ ...s, status: 'completed' })) }));
        toast.success('Éxito', `${dumpadasCreadas.length} dumpada(s) creadas correctamente`);
        setTimeout(() => setProgressInfo({ show: false, steps: [] }), 1500);
        resetFormIngreso();
        setLoading(false);
        return;
      }

      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.id === 1 ? { ...s, status: 'completed' } : s.id === 2 ? { ...s, status: 'loading' } : s
        ),
      }));

      const dumpadasParaDeteccion = filasValidas.map(form => ({
        id_frente_trabajo: form.id_frente_trabajo,
        jornada: form.jornada,
        fecha: new Date().toISOString().split('T')[0],
      }));
      const deteccionResponse = await acopiosService.detectarAcopiosExistentes(dumpadasParaDeteccion);
      const grupos = deteccionResponse.data || [];

      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.id === 2 ? { ...s, status: 'completed' } : s.id === 3 ? { ...s, status: 'loading' } : s
        ),
      }));

      const hayAcopiosExistentes = grupos.some(g => g.acopio_existente);
      if (hayAcopiosExistentes) {
        setProgressInfo({ show: false, steps: [] });
        setGruposDetectados(grupos);
        setDumpadasPendientes(dumpadasCreadas);
        setShowAcopioModal(true);
        setLoading(false);
      } else {
        await crearAcopiosAutomaticos(grupos, dumpadasCreadas, filasValidas);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message ||
        JSON.stringify(error.response?.data?.errors) ||
        error.message ||
        'Error al guardar dumpadas';
      toast.error('Error al guardar', errorMsg);
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    }
  };

  const crearAcopiosAutomaticos = async (grupos, dumpadasCreadas, filasValidas) => {
    try {
      for (const grupo of grupos) {
        const acopioResponse = await acopiosService.crearAcopioAutomatico({
          id_frente_trabajo: grupo.id_frente_trabajo,
          jornada: grupo.jornada,
          fecha: grupo.fecha,
        });
        const acopio = acopioResponse.data;
        const dumpadaIds = dumpadasCreadas
          .filter((_, index) => {
            const fila = filasValidas[index];
            return fila.id_frente_trabajo === grupo.id_frente_trabajo && fila.jornada === grupo.jornada;
          })
          .map(d => d.id);
        if (dumpadaIds.length > 0) {
          await acopiosService.agregarDumpadas(acopio.id, dumpadaIds);
        }
      }
      setProgressInfo(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === 3 ? { ...s, status: 'completed' } : s),
      }));
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success(`${dumpadasCreadas.length} dumpada(s) ingresadas`, `Agrupadas en ${grupos.length} acopio(s) automático(s)`);
      resetFormIngreso();
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    } catch (error) {
      toast.error('Error al crear acopios', error.response?.data?.message || error.message);
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    }
  };

  const handleAcopioModalConfirm = async (decisiones) => {
    setShowAcopioModal(false);
    setLoading(true);
    setProgressInfo({ show: true, steps: [{ id: 1, label: 'Procesando decisiones de acopios...', status: 'loading' }] });
    try {
      const filasValidas = formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual && f.id_maquina && f.ton);
      for (let grupoIndex = 0; grupoIndex < gruposDetectados.length; grupoIndex++) {
        const grupo = gruposDetectados[grupoIndex];
        const decision = decisiones[grupoIndex];
        const dumpadaIds = dumpadasPendientes
          .filter((_, index) => {
            const fila = filasValidas[index];
            return fila.id_frente_trabajo === grupo.id_frente_trabajo && fila.jornada === grupo.jornada;
          })
          .map(d => d.id);
        if (decision === 'AGREGAR_EXISTENTE' && grupo.acopio_existente) {
          await acopiosService.agregarDumpadas(grupo.acopio_existente.id, dumpadaIds);
        } else if (decision === 'CREAR_NUEVO') {
          const acopioResponse = await acopiosService.crearAcopioAutomatico({
            id_frente_trabajo: grupo.id_frente_trabajo,
            jornada: grupo.jornada,
            fecha: grupo.fecha,
          });
          await acopiosService.agregarDumpadas(acopioResponse.data.id, dumpadaIds);
        }
      }
      setProgressInfo(prev => ({ ...prev, steps: prev.steps.map(s => ({ ...s, status: 'completed' })) }));
      await new Promise(resolve => setTimeout(resolve, 600));
      toast.success(`${dumpadasPendientes.length} dumpada(s) procesadas`, 'Acopios configurados correctamente');
      resetFormIngreso();
      setGruposDetectados([]);
      setDumpadasPendientes([]);
    } catch (error) {
      toast.error('Error al procesar acopios', error.response?.data?.message || error.message);
    } finally {
      setProgressInfo({ show: false, steps: [] });
      setLoading(false);
    }
  };

  const handleAcopioModalCancel = () => {
    setShowAcopioModal(false);
    setGruposDetectados([]);
    setDumpadasPendientes([]);
    toast.info('Cancelado', 'Las dumpadas fueron creadas pero no se asignaron a acopios');
    resetFormIngreso();
  };

  return (
    <>
      <AcopioSelectionModal
        show={showAcopioModal}
        grupos={gruposDetectados}
        onConfirm={handleAcopioModalConfirm}
        onCancel={handleAcopioModalCancel}
      />
      <ProgressIndicator show={progressInfo.show} steps={progressInfo.steps} />


      {/* Card principal: Ingreso de Dumpadas */}
      <Card className="border-l-4 border-orange-400">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Ingreso de Dumpadas</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {formsIngresoMasivo.length} fila(s) · {formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual && f.id_maquina && f.ton).length} lista(s) para registrar
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowLote(v => !v); setShowInfo(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                showLote
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50'
              }`}
            >
              <HiBolt className="w-4 h-4" />
              Ingreso masivo
              {showLote ? <HiChevronUp className="w-3.5 h-3.5" /> : <HiChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={agregarFilaIngreso}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <HiDocumentPlus className="w-4 h-4" />
              Agregar fila
            </button>
            <button
              type="button"
              onClick={() => { setShowInfo(v => !v); setShowLote(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                showInfo
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
              }`}
              title="Ver flujo del dato"
            >
              <HiInformationCircle className="w-4 h-4" />
              <span className="hidden sm:inline">¿Cómo funciona?</span>
            </button>
          </div>
        </div>

        {/* Panel: Ingreso Masivo (colapsable) */}
        {showLote && (
          <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-3">
              Agregar varias dumpadas de la misma frente y jornada
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <SearchableSelect
                label="Frente *"
                options={frentes.map(frente => ({ value: frente.id, label: frente.codigo_completo }))}
                value={ingresoRapido.id_frente_trabajo}
                onChange={(value) => setIngresoRapido({ ...ingresoRapido, id_frente_trabajo: value })}
                placeholder="Buscar frente..."
                emptyMessage="No hay frentes disponibles"
              />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Jornada <span className="text-red-500">*</span>
                </label>
                <select
                  value={ingresoRapido.jornada}
                  onChange={(e) => setIngresoRapido({ ...ingresoRapido, jornada: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                >
                  <option value="">Seleccione...</option>
                  {jornadas.map((jornada) => (
                    <option key={jornada} value={jornada}>{jornada}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Cantidad *"
                type="number"
                min="1"
                max="50"
                value={ingresoRapido.cantidad}
                onChange={(e) => setIngresoRapido({ ...ingresoRapido, cantidad: e.target.value })}
                placeholder="Ej: 10"
              />
              <Input
                label="Ley Visual (%)"
                type="number"
                step="0.001"
                value={ingresoRapido.ley_visual}
                onChange={(e) => setIngresoRapido({ ...ingresoRapido, ley_visual: e.target.value })}
                placeholder="Ej: 2.300"
              />
              <Button
                type="button"
                variant="success"
                onClick={handleIngresoRapido}
                disabled={loading}
                className="h-[42px]"
              >
                ⚡ Añadir {ingresoRapido.cantidad || 1} fila(s)
              </Button>
            </div>
          </div>
        )}

        {/* Panel: Flujo del dato (colapsable) */}
        {showInfo && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">¿Qué ocurre con la dumpada después del ingreso?</p>
            <div className="space-y-1.5">

              {/* Paso 1 */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                <div className="flex-1 bg-white border border-orange-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-orange-700">Ingreso <span className="font-normal text-gray-400 ml-1">— estás aquí</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">Se registra Frente, Jornada y Ley Visual. Si no se indica tonelaje se usa el valor por defecto de {tonelajeDumpadaDefault} ton. La dumpada queda en estado <strong className="text-yellow-600">Ingresado</strong>.</p>
                </div>
              </div>

              <div className="ml-2.5 text-gray-300 text-sm leading-none pl-0.5">▼</div>

              {/* Paso 2 */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                <div className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-blue-700">Envío de Muestras</p>
                  <p className="text-xs text-gray-500 mt-0.5">Desde el módulo <strong>Envío de Muestras</strong> se selecciona cuáles dumpadas se enviarán a analizar.</p>
                </div>
              </div>

              <div className="ml-2.5 text-gray-300 text-sm leading-none pl-0.5">▼</div>

              {/* Paso 3 */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                <div className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-green-700">Análisis de Laboratorio</p>
                  <p className="text-xs text-gray-500 mt-0.5">El laboratorio ingresa Cu Total y Cu Soluble. El sistema calcula automáticamente Cu Insoluble. La dumpada pasa a estado <strong className="text-green-600">Completado</strong>.</p>
                </div>
              </div>

              <div className="ml-2.5 text-gray-300 text-sm leading-none pl-0.5">▼</div>

              {/* Paso 4 */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
                <div className="flex-1 bg-white border border-purple-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-purple-700">Mezcla</p>
                  <p className="text-xs text-gray-500 mt-0.5">Las dumpadas se combinan para formar una mezcla. Pueden usarse con ley de laboratorio o solo con ley visual. El sistema calcula el promedio ponderado por tonelaje.</p>
                </div>
              </div>

              <div className="ml-2.5 text-gray-300 text-sm leading-none pl-0.5">▼</div>

              {/* Paso 5 */}
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-gray-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</div>
                <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-gray-700">Despacho</p>
                  <p className="text-xs text-gray-500 mt-0.5">Las mezclas se despachan en camionadas agrupadas en un lote hacia la planta de destino.</p>
                </div>
              </div>

            </div>
          </div>
        )}

        <form onSubmit={handleSubmitIngresoMasivo} className="space-y-3">
          {/* Filas */}
          <div className="space-y-3">
            {formsIngresoMasivo.map((form, index) => (
              <div
                key={form.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:border-orange-200 transition-colors"
              >
                {/* Número */}
                <div className="flex-shrink-0 w-7 h-7 mt-1 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                {/* Campos */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <SearchableSelect
                    label="Frente de Trabajo *"
                    options={frentes.map(frente => ({ value: frente.id, label: frente.codigo_completo }))}
                    value={form.id_frente_trabajo}
                    onChange={(value) => actualizarFilaIngreso(form.id, 'id_frente_trabajo', value)}
                    placeholder="Buscar frente..."
                    emptyMessage="No hay frentes disponibles"
                    required
                  />

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Jornada <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.jornada}
                      onChange={(e) => actualizarFilaIngreso(form.id, 'jornada', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white text-sm"
                    >
                      <option value="">Seleccione...</option>
                      {jornadas.map((jornada) => (
                        <option key={jornada} value={jornada}>{jornada}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Ley Visual (%)"
                    type="number"
                    step="0.001"
                    value={form.ley_visual}
                    onChange={(e) => actualizarFilaIngreso(form.id, 'ley_visual', e.target.value)}
                    placeholder="Ej: 2.300"
                    required
                  />

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Máquina/Dumper <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.id_maquina}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const maquina = maquinas.find(m => String(m.id_maquina) === selectedId);
                        setFormsIngresoMasivo(prev => prev.map(f =>
                          f.id === form.id
                            ? { ...f, id_maquina: selectedId, nombre_maquina: maquina?.nombre_maquina || '', ton: maquina ? String(maquina.tonelaje) : f.ton }
                            : f
                        ));
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white text-sm"
                    >
                      <option value="">Seleccione...</option>
                      {maquinas.map((m) => (
                        <option key={m.id_maquina} value={m.id_maquina}>
                          {m.nombre_maquina}{m.patente ? ` (${m.patente})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Tonelaje (ton) *"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.ton}
                    onChange={(e) => actualizarFilaIngreso(form.id, 'ton', e.target.value)}
                    placeholder="Ej: 30.00"
                    required
                  />
                </div>

                {/* Acciones fila */}
                <div className="flex-shrink-0 flex flex-col gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => duplicarFilaIngreso(form.id)}
                    className="w-8 h-8 bg-gray-100 hover:bg-purple-100 text-gray-400 hover:text-purple-600 rounded-lg flex items-center justify-center transition-colors"
                    title="Duplicar fila"
                  >
                    <HiDocumentDuplicate className="w-4 h-4" />
                  </button>
                  {formsIngresoMasivo.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarFilaIngreso(form.id)}
                      className="w-8 h-8 bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-lg flex items-center justify-center transition-colors"
                      title="Eliminar fila"
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
              Fecha: hoy · Tonelaje default: {tonelajeDumpadaDefault} ton · N° acopio: automático
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={resetFormIngreso}>
                Limpiar
              </Button>
              <Button type="submit" variant="success" disabled={loading}>
                {loading ? 'Guardando...' : `Registrar ${formsIngresoMasivo.filter(f => f.id_frente_trabajo && f.jornada && f.ley_visual && f.id_maquina && f.ton).length} Dumpada(s)`}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </>
  );
}
