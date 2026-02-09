import React, { useState, useEffect } from 'react';
import { HiSave, HiX, HiTruck, HiOfficeBuilding, HiBriefcase } from 'react-icons/hi';
import { BiCar } from 'react-icons/bi';
import useToast from '../../../hooks/useToast';
import laboratorioService from '../../../services/laboratorio';
import configuracionService from '../../../services/configuracion';

const CamionadaFormMejorado = ({ onSuccess, onCancel, camionadaEditar = null }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [mezclas, setMezclas] = useState([]);
  const [plantas, setPlantas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [cargandoMaquinas, setCargandoMaquinas] = useState(false);
  const [mezclaSeleccionada, setMezclaSeleccionada] = useState(null);
  const [pesoCamionDefault, setPesoCamionDefault] = useState(29);

  const [formData, setFormData] = useState({
    mezcla_id: '',
    planta_id: '',
    empresa_id: '',
    patente: '',
    fecha_despacho: new Date().toISOString().split('T')[0],
    hora_despacho: new Date().toTimeString().slice(0, 5),
    peso: pesoCamionDefault, // ✅ Peso desde configuración
    ley_visual: '',
    ley_mezcla: '',
    observaciones: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (camionadaEditar) {
      setFormData({
        mezcla_id: camionadaEditar.mezcla_id || '',
        planta_id: camionadaEditar.lote?.planta_id || '',
        empresa_id: camionadaEditar.lote?.empresa_id || '',
        patente: camionadaEditar.patente || '',
        fecha_despacho: camionadaEditar.fecha_despacho || '',
        hora_despacho: camionadaEditar.hora_despacho || '',
        peso: camionadaEditar.peso || '',
        ley_visual: camionadaEditar.ley_visual || '',
        ley_mezcla: camionadaEditar.ley_mezcla || '',
        observaciones: camionadaEditar.observaciones || ''
      });
    }
  }, [camionadaEditar]);

  useEffect(() => {
    if (formData.mezcla_id) {
      const mezcla = mezclas.find(m => m.id === parseInt(formData.mezcla_id));
      setMezclaSeleccionada(mezcla);

      // Auto-completar leyes desde la mezcla
      if (mezcla && !camionadaEditar) {
        console.log('🔍 Mezcla seleccionada:', mezcla);
        console.log('📊 Ley visual:', mezcla.ley_visual);
        console.log('📊 Ley lote:', mezcla.ley_lote);
        console.log('📊 Ley lab:', mezcla.ley_lab);

        // Redondear a 2 decimales
        const leyVisual = mezcla.ley_visual ? parseFloat(mezcla.ley_visual).toFixed(2) : '';
        const leyMezcla = (mezcla.ley_lote || mezcla.ley_lab) ? parseFloat(mezcla.ley_lote || mezcla.ley_lab).toFixed(2) : '';

        setFormData(prev => ({
          ...prev,
          ley_visual: leyVisual,
          ley_mezcla: leyMezcla
        }));
      }
    } else {
      setMezclaSeleccionada(null);
    }
  }, [formData.mezcla_id, mezclas, camionadaEditar]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setCargandoMaquinas(true);

      const [mezclasRes, plantasRes, empresasRes, configRes, maquinasRes] = await Promise.all([
        laboratorioService.getMezclasDisponibles(),
        laboratorioService.getPlantas({ activas: true }),
        laboratorioService.getEmpresas({ activas: true }),
        configuracionService.getAll(),
        laboratorioService.getMaquinasDisponibles().catch(err => {
          console.error('Error cargando máquinas:', err);
          toast.error('No se pueden cargar las máquinas del sistema de petróleo. No se puede crear camionada.');
          return { data: [] };
        })
      ]);

      console.log('✅ Mezclas cargadas:', mezclasRes);
      console.log('✅ Plantas cargadas:', plantasRes);
      console.log('✅ Empresas cargadas:', empresasRes);
      console.log('✅ Configuraciones cargadas:', configRes);
      console.log('✅ Máquinas cargadas:', maquinasRes);

      setMezclas(mezclasRes || []);
      setPlantas(plantasRes || []);
      setEmpresas(empresasRes || []);
      setMaquinas(maquinasRes.data || []);

      // Establecer peso predefinido desde configuración
      const pesoDefault = configRes.peso_camion_default || 29;
      setPesoCamionDefault(pesoDefault);

      // Si no hay camionada a editar, actualizar el peso en el formulario
      if (!camionadaEditar) {
        setFormData(prev => ({
          ...prev,
          peso: pesoDefault
        }));
      }
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      toast.error('Error al cargar los datos iniciales');
    } finally {
      setLoading(false);
      setCargandoMaquinas(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.mezcla_id) {
      toast.error('Debe seleccionar una mezcla');
      return;
    }
    if (!formData.planta_id) {
      toast.error('Debe seleccionar una planta destino');
      return;
    }
    if (!formData.empresa_id) {
      toast.error('Debe seleccionar una empresa');
      return;
    }
    if (!formData.patente.trim()) {
      toast.error('La patente es requerida');
      return;
    }
    if (!formData.peso || parseFloat(formData.peso) <= 0) {
      toast.error('El peso debe ser mayor a 0');
      return;
    }

    // Validar que no supere las toneladas disponibles
    if (mezclaSeleccionada) {
      const peso = parseFloat(formData.peso);
      const toneladasDisponibles = mezclaSeleccionada.toneladas_disponibles ?? mezclaSeleccionada.peso_remanente ?? 0;

      if (peso > toneladasDisponibles) {
        toast.error(
          `El peso (${peso} t) supera las toneladas disponibles (${toneladasDisponibles.toFixed(2)} t)`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const dataToSend = {
        mezcla_id: parseInt(formData.mezcla_id),
        planta_id: parseInt(formData.planta_id),
        empresa_id: parseInt(formData.empresa_id),
        patente: formData.patente.trim().toUpperCase(),
        fecha_despacho: formData.fecha_despacho,
        hora_despacho: formData.hora_despacho || null,
        peso: parseFloat(formData.peso),
        ley_visual: formData.ley_visual ? parseFloat(formData.ley_visual) : null,
        ley_mezcla: formData.ley_mezcla ? parseFloat(formData.ley_mezcla) : null,
        observaciones: formData.observaciones?.trim() || null,
      };

      let response;
      if (camionadaEditar) {
        response = await laboratorioService.updateCamionada(camionadaEditar.id, dataToSend);
      } else {
        response = await laboratorioService.createCamionada(dataToSend);
      }

      toast.success(
        camionadaEditar ? 'Camionada actualizada' : 'Camionada registrada',
        response.mensaje || 'Operación exitosa'
      );

      if (onSuccess) {
        onSuccess(response.camionada || response);
      }

      // Resetear formulario si es creación
      if (!camionadaEditar) {
        setFormData({
          mezcla_id: formData.mezcla_id, // Mantener la mezcla seleccionada
          planta_id: formData.planta_id, // Mantener la planta
          empresa_id: formData.empresa_id, // Mantener la empresa
          patente: '',
          fecha_despacho: new Date().toISOString().split('T')[0],
          hora_despacho: new Date().toTimeString().slice(0, 5),
          peso: pesoCamionDefault, // ✅ Peso desde configuración
          ley_visual: formData.ley_visual, // Mantener las leyes de la mezcla
          ley_mezcla: formData.ley_mezcla,
          observaciones: ''
        });

        // Recargar mezclas para actualizar remanente
        const mezclasRes = await laboratorioService.getMezclasDisponibles();
        setMezclas(mezclasRes || []);
      }
    } catch (error) {
      console.error('Error al guardar camionada:', error);
      toast.error(
        'Error al guardar',
        error.response?.data?.mensaje || error.response?.data?.message || 'Error al guardar la camionada'
      );
    } finally {
      setLoading(false);
    }
  };

  const plantaSeleccionada = plantas.find(p => p.id === parseInt(formData.planta_id));
  const empresaSeleccionada = empresas.find(e => e.id === parseInt(formData.empresa_id));

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg border-2 border-blue-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <HiTruck className="text-blue-600" />
          {camionadaEditar ? 'Editar Camionada' : 'Registrar Nueva Camionada'}
        </h3>
      </div>

      {/* Sección: Destino */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-200">
        <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
          <HiOfficeBuilding />
          DESTINO DE LA CARGA
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mezcla */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mezcla (Origen) *
            </label>
            <select
              name="mezcla_id"
              value={formData.mezcla_id}
              onChange={handleChange}
              disabled={!!camionadaEditar}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            >
              <option value="">Seleccione una mezcla...</option>
              {mezclas.map(mezcla => (
                <option key={mezcla.id} value={mezcla.id}>
                  {mezcla.codigo} - {(mezcla.toneladas_disponibles ?? mezcla.peso_remanente ?? 0).toFixed(2)} t disponibles
                </option>
              ))}
            </select>
            {mezclaSeleccionada && (
              <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Total:</span> {parseFloat(mezclaSeleccionada.total_ton || 0).toFixed(2)} t |
                  <span className="font-semibold"> Despachadas:</span> {parseFloat(mezclaSeleccionada.toneladas_despachadas ?? mezclaSeleccionada.peso_despachado ?? 0).toFixed(2)} t |
                  <span className="font-semibold text-green-600"> Disponibles:</span> {parseFloat(mezclaSeleccionada.toneladas_disponibles ?? mezclaSeleccionada.peso_remanente ?? 0).toFixed(2)} t
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-semibold">Ley Lab:</span> {parseFloat(mezclaSeleccionada.ley_lab || 0).toFixed(2)}% |
                  <span className="font-semibold"> Camionadas:</span> {mezclaSeleccionada.numero_camionadas || 0}
                </p>
              </div>
            )}
          </div>

          {/* Planta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Planta Destino *
            </label>
            <select
              name="planta_id"
              value={formData.planta_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccione una planta...</option>
              {plantas.map(planta => (
                <option key={planta.id} value={planta.id}>
                  {planta.nombre} ({planta.codigo})
                </option>
              ))}
            </select>
            {plantaSeleccionada && (
              <p className="text-xs text-gray-500 mt-1">
                {plantaSeleccionada.descripcion || 'Planta seleccionada'}
              </p>
            )}
          </div>

          {/* Empresa */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <HiBriefcase className="text-gray-600" />
              Empresa Vendedora *
            </label>
            <select
              name="empresa_id"
              value={formData.empresa_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccione una empresa...</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre} ({empresa.codigo})
                </option>
              ))}
            </select>
            {plantaSeleccionada && empresaSeleccionada && (
              <div className="mt-2 p-2 bg-green-50 rounded border border-green-300">
                <p className="text-xs text-green-800 font-semibold">
                  📋 Lote: {plantaSeleccionada.codigo}-{empresaSeleccionada.codigo} ({plantaSeleccionada.nombre} - {empresaSeleccionada.nombre})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección: Datos del Camión */}
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4 mb-6 border border-orange-200">
        <h4 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-2">
          <HiTruck />
          DATOS DEL CAMIÓN
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Camión / Patente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <BiCar className="inline mr-1" />
              Camión / Patente *
            </label>
            <select
              name="patente"
              value={formData.patente}
              onChange={handleChange}
              disabled={!!camionadaEditar || cargandoMaquinas}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 font-mono"
              required
            >
              <option value="">
                {cargandoMaquinas ? 'Cargando camiones...' : 'Seleccione un camión...'}
              </option>
              {maquinas.map((maquina) => (
                <option key={maquina.id_maquina} value={maquina.patente}>
                  {maquina.nombre_maquina} ({maquina.patente}) - {maquina.nombre_categoria || 'Sin categoría'}
                </option>
              ))}
            </select>

            {maquinas.length === 0 && !cargandoMaquinas && (
              <p className="text-xs text-red-600 mt-1 font-semibold">
                ⚠️ No se pudieron cargar los camiones. Verifique la conexión con el sistema de petróleo.
              </p>
            )}
          </div>

          {/* Peso Teórico */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Peso Teórico (toneladas) *
            </label>
            <input
              type="number"
              name="peso"
              value={formData.peso}
              onChange={handleChange}
              step="0.01"
              min="0"
              max={mezclaSeleccionada?.peso_remanente || 999}
              placeholder={pesoCamionDefault}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Peso predefinido: {pesoCamionDefault} ton (capacidad camión)</p>
          </div>

          {/* Ley Visual (Auto-completada de la mezcla) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ley Visual (%)
            </label>
            <input
              type="number"
              name="ley_visual"
              value={formData.ley_visual}
              onChange={handleChange}
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              readOnly
            />
            <p className="text-xs text-blue-600 mt-1">Auto-completada de la mezcla</p>
          </div>

          {/* Ley Lote/Mezcla (Auto-completada de la mezcla) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ley Lote (%)
            </label>
            <input
              type="number"
              name="ley_mezcla"
              value={formData.ley_mezcla}
              onChange={handleChange}
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              readOnly
            />
            <p className="text-xs text-blue-600 mt-1">Auto-completada de la mezcla</p>
          </div>

          {/* Fecha Despacho (Automática) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Despacho *
            </label>
            <input
              type="date"
              name="fecha_despacho"
              value={formData.fecha_despacho}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Fecha automática</p>
          </div>

          {/* Hora Despacho (Automática) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora Despacho
            </label>
            <input
              type="time"
              name="hora_despacho"
              value={formData.hora_despacho}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Hora automática</p>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones
        </label>
        <textarea
          name="observaciones"
          value={formData.observaciones}
          onChange={handleChange}
          rows="2"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Observaciones adicionales..."
        />
      </div>

      {/* Botones */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || (maquinas.length === 0 && !camionadaEditar)}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            <HiSave className="text-xl" />
            {loading ? 'Guardando...' :
             maquinas.length === 0 && !camionadaEditar ? 'Esperando camiones...' :
             (camionadaEditar ? 'Actualizar Camionada' : 'Registrar Camionada')}
          </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-2 bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 transition-colors font-semibold"
          >
            <HiX className="text-xl" />
            Cancelar
          </button>
        )}
        </div>

        {maquinas.length === 0 && !loading && !camionadaEditar && (
          <p className="text-center text-red-600 text-sm font-semibold bg-red-50 p-3 rounded-md border border-red-200">
            ⚠️ No se puede crear camionada sin conexión al sistema de petróleo
          </p>
        )}
      </div>
    </form>
  );
};

export default CamionadaFormMejorado;
