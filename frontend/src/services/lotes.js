import api from '../core/services/api';

/**
 * Servicio para gestión de lotes
 */
class LotesService {
  /**
   * Obtener todos los lotes con filtros
   */
  async getLotes(params = {}) {
    const response = await api.get('/dispatch/lotes', { params });
    return response.data;
  }

  /**
   * Obtener un lote específico
   */
  async getLote(id) {
    const response = await api.get(`/dispatch/lotes/${id}`);
    return response.data;
  }

  /**
   * Crear nuevo lote
   */
  async crearLote(data) {
    const response = await api.post('/dispatch/lotes', data);
    return response.data;
  }

  /**
   * Actualizar lote
   */
  async actualizarLote(id, data) {
    const response = await api.put(`/dispatch/lotes/${id}`, data);
    return response.data;
  }

  /**
   * Eliminar lote con opción para camionadas
   * @param {number} id - ID del lote
   * @param {string} opcion - 'reasignar' | 'eliminar_camionadas' | 'dejar_huerfanas'
   */
  async eliminarLote(id, opcion = 'dejar_huerfanas') {
    const response = await api.delete(`/dispatch/lotes/${id}`, {
      params: { opcion }
    });
    return response.data;
  }

  /**
   * Cerrar lote
   */
  async cerrarLote(id) {
    const response = await api.post(`/dispatch/lotes/${id}/cerrar`);
    return response.data;
  }

  /**
   * Obtener lotes abiertos por planta y empresa
   */
  async getLotesAbiertos(plantaId, empresaId) {
    const response = await api.get('/dispatch/lotes/abiertos', {
      params: { planta_id: plantaId, empresa_id: empresaId }
    });
    return response.data;
  }

  /**
   * Obtener resumen del lote
   */
  async getResumen(id) {
    const response = await api.get(`/dispatch/lotes/${id}/resumen`);
    return response.data;
  }
}

export default new LotesService();
