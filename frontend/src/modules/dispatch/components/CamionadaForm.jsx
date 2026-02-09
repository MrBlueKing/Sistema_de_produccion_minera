import React, { useState, useEffect } from 'react';
import { HiSave, HiX } from 'react-icons/hi';
import useToast from '../../../hooks/useToast';
import mezclasService from '../services/mezclas';

const CamionadaForm = ({ loteVentaId, onSuccess, onCancel, camionadaEditar = null }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [lotesVenta, setLotesVenta] = useState([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);

  const [formData, setFormData] = useState({
    lote_venta_id: loteVentaId || '',
    patente: '',
    fecha_despacho: new Date().toISOString().split('T')[0],
    hora_despacho: '',
    peso: '',
    ticket: '',
    ley_mezcla: '',
    ley_visual: '',
    ley_lab_camion: '',
    fecha_recepcion: '',
    hora_recepcion: '',
    observaciones: ''
  });

  useEffect(() => {
    cargarLotesVenta();
  }, []);

  useEffect(() => {
    if (camionadaEditar) {
      setFormData({
        lote_venta_id: camionadaEditar.lote_venta_id,
        patente: camionadaEditar.patente || '',
        fecha_despacho: camionadaEditar.fecha_despacho || '',
        hora_despacho: camionadaEditar.hora_despacho || '',
        peso: camionadaEditar.peso || '',
        ticket: camionadaEditar.ticket || '',
        ley_mezcla: camionadaEditar.ley_mezcla || '',
        ley_visual: camionadaEditar.ley_visual || '',
        ley_lab_camion: camionadaEditar.ley_lab_camion || '',
        fecha_recepcion: camionadaEditar.fecha_recepcion || '',
        hora_recepcion: camionadaEditar.hora_recepcion || '',
        observaciones: camionadaEditar.observaciones || ''
      });
    }
  }, [camionadaEditar]);

  useEffect(() => {
    if (formData.lote_venta_id) {
      const lote = lotesVenta.find(l => l.id === parseInt(formData.lote_venta_id));
      setLoteSeleccionado(lote);

      // Auto-rellenar ley_mezcla si está disponible
      if (lote && lote.mezcla && !formData.ley_mezcla) {
        setFormData(prev => ({
          ...prev,
          ley_mezcla: lote.mezcla.ley_prom_dump || ''
        }));
      }
    }
  }, [formData.lote_venta_id, lotesVenta]);

  const cargarLotesVenta = async () => {
    try {
      const response = await mezclasService.getLotesVenta({ estado: 'Enviado,Preparado' });
      if (response.success) {
        setLotesVenta(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando lotes de venta:', error);
      toast.error('Error al cargar los lotes de venta');
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
    if (!formData.lote_venta_id) {
      toast.error('Debe seleccionar un lote de venta');
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

    setLoading(true);
    try {
      let response;
      const dataToSend = {
        ...formData,
        peso: parseFloat(formData.peso),
        ley_mezcla: formData.ley_mezcla ? parseFloat(formData.ley_mezcla) : null,
        ley_visual: formData.ley_visual ? parseFloat(formData.ley_visual) : null,
        ley_lab_camion: formData.ley_lab_camion ? parseFloat(formData.ley_lab_camion) : null,
      };

      if (camionadaEditar) {
        response = await mezclasService.updateCamionada(camionadaEditar.id, dataToSend);
      } else {
        response = await mezclasService.createCamionada(dataToSend);
      }

      if (response.success) {
        toast.success(response.message || 'Camionada registrada exitosamente');
        onSuccess(response.data);

        // Resetear formulario si es creación
        if (!camionadaEditar) {
          setFormData({
            lote_venta_id: loteVentaId || formData.lote_venta_id,
            patente: '',
            fecha_despacho: new Date().toISOString().split('T')[0],
            hora_despacho: '',
            peso: '',
            ticket: '',
            ley_mezcla: loteSeleccionado?.mezcla?.ley_prom_dump || '',
            ley_visual: '',
            ley_lab_camion: '',
            fecha_recepcion: '',
            hora_recepcion: '',
            observaciones: ''
          });
        }
      } else {
        toast.error(response.message || 'Error al procesar la camionada');
      }
    } catch (error) {
      console.error('Error al guardar camionada:', error);
      toast.error(error.response?.data?.message || 'Error al guardar la camionada');
    } finally {
      setLoading(false);
    }
  };

  const pesoRestante = loteSeleccionado
    ? (loteSeleccionado.mezcla?.total_ton || 0) - (loteSeleccionado.peso_despachado || 0)
    : 0;

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold mb-4 text-gray-800">
        {camionadaEditar ? 'Editar Camionada' : 'Registrar Nueva Camionada'}
      </h3>

      {/* Lote de Venta */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Lote de Venta *
        </label>
        <select
          name="lote_venta_id"
          value={formData.lote_venta_id}
          onChange={handleChange}
          disabled={!!loteVentaId || !!camionadaEditar}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          required
        >
          <option value="">Seleccione un lote...</option>
          {lotesVenta.map(lote => (
            <option key={lote.id} value={lote.id}>
              {lote.numero_lote} - {lote.cliente} ({lote.mezcla?.codigo || 'Sin mezcla'})
            </option>
          ))}
        </select>
        {loteSeleccionado && (
          <p className="text-xs text-gray-500 mt-1">
            Mezcla: {loteSeleccionado.mezcla?.codigo || 'N/A'} |
            Restante: <span className="font-bold">{pesoRestante.toFixed(2)} ton</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Patente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Patente *
          </label>
          <input
            type="text"
            name="patente"
            value={formData.patente}
            onChange={handleChange}
            placeholder="FVGY-94"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Ticket */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ticket
          </label>
          <input
            type="text"
            name="ticket"
            value={formData.ticket}
            onChange={handleChange}
            placeholder="12345"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Fecha Despacho */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha Despacho *
          </label>
          <input
            type="date"
            name="fecha_despacho"
            value={formData.fecha_despacho}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Hora Despacho */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora Despacho
          </label>
          <input
            type="time"
            name="hora_despacho"
            value={formData.hora_despacho}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Peso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Peso (ton) *
          </label>
          <input
            type="number"
            name="peso"
            value={formData.peso}
            onChange={handleChange}
            step="0.01"
            min="0"
            placeholder="4.6"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Teórico: 4.6 ton</p>
        </div>

        {/* Ley Mezcla */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ley Mezcla
          </label>
          <input
            type="number"
            name="ley_mezcla"
            value={formData.ley_mezcla}
            onChange={handleChange}
            step="0.001"
            placeholder="0.000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Ley Visual */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ley Visual
          </label>
          <input
            type="number"
            name="ley_visual"
            value={formData.ley_visual}
            onChange={handleChange}
            step="0.001"
            placeholder="0.000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Ley Lab Camión */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ley Lab Camión
          </label>
          <input
            type="number"
            name="ley_lab_camion"
            value={formData.ley_lab_camion}
            onChange={handleChange}
            step="0.001"
            placeholder="0.000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Fecha Recepción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha Recepción
          </label>
          <input
            type="date"
            name="fecha_recepcion"
            value={formData.fecha_recepcion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Hora Recepción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora Recepción
          </label>
          <input
            type="time"
            name="hora_recepcion"
            value={formData.hora_recepcion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Observaciones */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones
        </label>
        <textarea
          name="observaciones"
          value={formData.observaciones}
          onChange={handleChange}
          rows="3"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Observaciones adicionales..."
        />
      </div>

      {/* Botones */}
      <div className="flex gap-2 mt-6">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <HiSave className="text-lg" />
          {loading ? 'Guardando...' : (camionadaEditar ? 'Actualizar' : 'Registrar')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
          >
            <HiX className="text-lg" />
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};

export default CamionadaForm;
