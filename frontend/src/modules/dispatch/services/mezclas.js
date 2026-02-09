import api from '../../../core/services/api';

class MezclasService {
  // ==========================
  // MEZCLAS
  // ==========================

  /**
   * Obtener todas las mezclas con filtros opcionales
   * @param {Object} params - Parámetros de filtrado (fecha_desde, fecha_hasta, estado, codigo)
   */
  async getMezclas(params = {}) {
    const response = await api.get('/dispatch/mezclas', { params });
    return response.data;
  }

  /**
   * Obtener una mezcla específica por ID
   * @param {number} id - ID de la mezcla
   */
  async getMezcla(id) {
    const response = await api.get(`/dispatch/mezclas/${id}`);
    return response.data;
  }

  /**
   * Crear una nueva mezcla
   * @param {Object} data - Datos de la mezcla
   * @example
   * {
   *   codigo: 'CZ1224',
   *   fecha: '2025-11-17',
   *   dumpadas: [4157, 4158, 4159],
   *   lotes_venta_remanentes: [1],  // Opcional
   *   remanentes_manuales: [...],    // Opcional
   *   observaciones: 'Texto'         // Opcional
   * }
   */
  async createMezcla(data) {
    const response = await api.post('/dispatch/mezclas', data);
    return response.data;
  }

  /**
   * Actualizar una mezcla
   * @param {number} id - ID de la mezcla
   * @param {Object} data - Datos a actualizar
   */
  async updateMezcla(id, data) {
    const response = await api.put(`/dispatch/mezclas/${id}`, data);
    return response.data;
  }

  /**
   * Eliminar una mezcla
   * @param {number} id - ID de la mezcla
   */
  async deleteMezcla(id) {
    const response = await api.delete(`/dispatch/mezclas/${id}`);
    return response.data;
  }

  /**
   * Actualizar ley de laboratorio de una mezcla
   * @param {number} id - ID de la mezcla
   * @param {number} ley_lab - Ley de laboratorio
   */
  async actualizarLeyLaboratorio(id, ley_lab) {
    const response = await api.post(`/dispatch/mezclas/${id}/ley-laboratorio`, { ley_lab });
    return response.data;
  }

  /**
   * Agregar dumpadas a una mezcla existente
   * @param {number} id - ID de la mezcla
   * @param {Array} dumpadas - Array de IDs de dumpadas
   */
  async agregarDumpadas(id, dumpadas) {
    const response = await api.post(`/dispatch/mezclas/${id}/agregar-dumpadas`, { dumpadas });
    return response.data;
  }

  /**
   * Agregar remanente manual a una mezcla
   * @param {number} id - ID de la mezcla
   * @param {Object} remanente - Datos del remanente
   */
  async agregarRemanente(id, remanente) {
    const response = await api.post(`/dispatch/mezclas/${id}/agregar-remanente`, remanente);
    return response.data;
  }

  /**
   * Editar un detalle (dumpada o remanente) de una mezcla
   * @param {number} mezclaId - ID de la mezcla
   * @param {number} detalleId - ID del detalle a editar
   * @param {Object} data - Datos del detalle a actualizar
   * @example
   * {
   *   toneladas: 45.25,
   *   ley_dump: 1.470,        // Se aplicará ajuste x0.9 automáticamente
   *   ley_visual: 1.240,
   *   ley_lote: 1.117,
   *   origen: 'Acopios 12-14'
   * }
   */
  async editarDetalle(mezclaId, detalleId, data) {
    const response = await api.put(`/dispatch/mezclas/${mezclaId}/detalles/${detalleId}`, data);
    return response.data;
  }

  /**
   * Eliminar un detalle (dumpada o remanente) de una mezcla
   * @param {number} mezclaId - ID de la mezcla
   * @param {number} detalleId - ID del detalle a eliminar
   */
  async eliminarDetalle(mezclaId, detalleId) {
    const response = await api.delete(`/dispatch/mezclas/${mezclaId}/detalles/${detalleId}`);
    return response.data;
  }

  /**
   * Obtener dumpadas disponibles (no asignadas a mezclas)
   * @param {Object} params - Parámetros de filtrado
   */
  async getDumpadasDisponibles(params = {}) {
    console.log('🔍 [MEZCLAS SERVICE] Solicitando dumpadas disponibles', params);
    try {
      const response = await api.get('/dispatch/mezclas/dumpadas-disponibles', { params });
      console.log('✅ [MEZCLAS SERVICE] Respuesta recibida:', {
        cantidad: response.data?.length || 0,
        data: response.data
      });
      return response.data;
    } catch (error) {
      console.error('❌ [MEZCLAS SERVICE] Error al obtener dumpadas:', error);
      throw error;
    }
  }

  /**
   * Obtener mezclas con remanente disponible (para usar en nuevas mezclas)
   * @returns {Array} Lista de mezclas con toneladas disponibles
   */
  async getRemanentesDisponibles() {
    console.log('🔍 [MEZCLAS SERVICE] Solicitando remanentes disponibles');
    try {
      const response = await api.get('/dispatch/mezclas/remanentes-disponibles');
      console.log('✅ [MEZCLAS SERVICE] Remanentes recibidos:', {
        cantidad: response.data?.length || 0,
        data: response.data
      });
      return response.data;
    } catch (error) {
      console.error('❌ [MEZCLAS SERVICE] Error al obtener remanentes:', error);
      throw error;
    }
  }

  /**
   * Generar reporte de una mezcla
   * @param {number} id - ID de la mezcla
   */
  async generarReporte(id) {
    const response = await api.get(`/dispatch/mezclas/${id}/reporte`);
    return response.data;
  }

  /**
   * Marcar remanente como descarte (no utilizable)
   * @param {number} id - ID de la mezcla con remanente
   * @returns {Object} Respuesta con la mezcla actualizada
   */
  async marcarDescarte(id) {
    const response = await api.post(`/dispatch/mezclas/${id}/marcar-descarte`);
    return response.data;
  }

  /**
   * Aplicar ajuste manual de toneladas a una mezcla
   * @param {number} id - ID de la mezcla
   * @param {Object} data - Datos del ajuste
   * @example
   * {
   *   toneladas_reales_remanente: 14.00,
   *   motivo: 'Inventario físico confirma más material del calculado'
   * }
   */
  async aplicarAjusteToneladas(id, data) {
    const response = await api.post(`/dispatch/mezclas/${id}/ajustar-toneladas`, data);
    return response.data;
  }

  /**
   * Revertir el ajuste de toneladas de una mezcla
   * @param {number} id - ID de la mezcla
   * @param {Object} data - Datos de la reversión
   * @example
   * {
   *   motivo: 'Error en la medición inicial, se corrige'
   * }
   */
  async revertirAjusteToneladas(id, data) {
    const response = await api.post(`/dispatch/mezclas/${id}/revertir-ajuste`, data);
    return response.data;
  }


  // ==========================
  // CAMIONADAS (DESPACHOS)
  // Sistema simplificado: despachos directos desde mezclas
  // ==========================

  /**
   * Obtener todas las camionadas con filtros opcionales
   * @param {Object} params - Parámetros de filtrado (mezcla_id, cliente, planta, patente, fecha_desde, fecha_hasta, estado)
   */
  async getCamionadas(params = {}) {
    const response = await api.get('/dispatch/camionadas', { params });
    return response.data;
  }

  /**
   * Obtener una camionada específica
   * @param {number} id - ID de la camionada
   */
  async getCamionada(id) {
    const response = await api.get(`/dispatch/camionadas/${id}`);
    return response.data;
  }

  /**
   * Obtener mezclas con remanente disponible para despacho
   * @returns {Array} Lista de mezclas con remanente
   */
  async getMezclasDisponiblesParaDespacho() {
    const response = await api.get('/dispatch/camionadas/mezclas-disponibles');
    return response.data;
  }

  /**
   * Crear una nueva camionada (despacho directo desde mezcla)
   * @param {Object} data - Datos de la camionada
   * @example
   * {
   *   mezcla_id: 1,
   *   patente: 'FVGY-94',
   *   cliente: 'MDF Inés',
   *   planta: 'SyC Juan',
   *   fecha_despacho: '2025-11-19',
   *   peso: 35.6,
   *   ticket: '12345',        // Opcional
   *   numero_guia: 'G-001',   // Opcional
   *   ley_visual: 1.2,        // Opcional
   *   observaciones: '...'    // Opcional
   * }
   */
  async createCamionada(data) {
    const response = await api.post('/dispatch/camionadas', data);
    return response.data;
  }

  /**
   * Actualizar una camionada
   * @param {number} id - ID de la camionada
   * @param {Object} data - Datos a actualizar
   */
  async updateCamionada(id, data) {
    const response = await api.put(`/dispatch/camionadas/${id}`, data);
    return response.data;
  }

  /**
   * Eliminar una camionada
   * @param {number} id - ID de la camionada
   */
  async deleteCamionada(id) {
    const response = await api.delete(`/dispatch/camionadas/${id}`);
    return response.data;
  }

  /**
   * Marcar camionada como recibida
   * @param {number} id - ID de la camionada
   * @param {Object} data - Datos de recepción (fecha_recepcion, hora_recepcion)
   */
  async marcarCamionadaRecibida(id, data) {
    const response = await api.post(`/dispatch/camionadas/${id}/recibir`, data);
    return response.data;
  }

  /**
   * Actualizar ley de laboratorio de camionada
   * @param {number} id - ID de la camionada
   * @param {number} ley_lab_camion - Ley de laboratorio
   */
  async actualizarLeyLaboratorioCamionada(id, ley_lab_camion) {
    const response = await api.post(`/dispatch/camionadas/${id}/ley-laboratorio`, { ley_lab_camion });
    return response.data;
  }

  /**
   * Obtener resumen de camionadas por mezcla
   * @param {number} mezclaId - ID de la mezcla
   * @returns {Object} Resumen con peso despachado, remanente, número de camionadas, etc.
   */
  async getResumenCamionadasMezcla(mezclaId) {
    const response = await api.get(`/dispatch/mezclas/${mezclaId}/resumen-camionadas`);
    return response.data;
  }

  /**
   * Recepcionar camionada con peso real y datos de recepción
   * @param {number} id - ID de la camionada
   * @param {Object} data - Datos de recepción
   * @example
   * {
   *   peso_real: 34.8,
   *   fecha_recepcion: '2025-11-19',
   *   hora_recepcion: '14:30:00',
   *   ley_lab_camion: 1.25  // Opcional
   * }
   */
  async recepcionarCamionada(id, data) {
    const response = await api.post(`/dispatch/camionadas/${id}/recepcionar`, data);
    return response.data;
  }


  // ==========================
  // PLANTAS
  // ==========================

  /**
   * Obtener todas las plantas
   */
  async getPlantas() {
    const response = await api.get('/dispatch/plantas');
    return response.data;
  }

  /**
   * Obtener una planta específica
   * @param {number} id - ID de la planta
   */
  async getPlanta(id) {
    const response = await api.get(`/dispatch/plantas/${id}`);
    return response.data;
  }

  /**
   * Crear una nueva planta
   * @param {Object} data - Datos de la planta
   */
  async createPlanta(data) {
    const response = await api.post('/dispatch/plantas', data);
    return response.data;
  }

  /**
   * Actualizar una planta
   * @param {number} id - ID de la planta
   * @param {Object} data - Datos a actualizar
   */
  async updatePlanta(id, data) {
    const response = await api.put(`/dispatch/plantas/${id}`, data);
    return response.data;
  }

  /**
   * Eliminar una planta
   * @param {number} id - ID de la planta
   */
  async deletePlanta(id) {
    const response = await api.delete(`/dispatch/plantas/${id}`);
    return response.data;
  }


  // ==========================
  // LOTES
  // ==========================

  /**
   * Obtener todos los lotes con filtros opcionales
   * @param {Object} params - Parámetros de filtrado (planta_id, estado, fecha_desde, fecha_hasta)
   */
  async getLotes(params = {}) {
    const response = await api.get('/dispatch/lotes', { params });
    return response.data;
  }

  /**
   * Obtener un lote específico
   * @param {number} id - ID del lote
   */
  async getLote(id) {
    const response = await api.get(`/dispatch/lotes/${id}`);
    return response.data;
  }

  /**
   * Crear un nuevo lote
   * @param {Object} data - Datos del lote
   */
  async createLote(data) {
    const response = await api.post('/dispatch/lotes', data);
    return response.data;
  }

  /**
   * Actualizar un lote
   * @param {number} id - ID del lote
   * @param {Object} data - Datos a actualizar
   */
  async updateLote(id, data) {
    const response = await api.put(`/dispatch/lotes/${id}`, data);
    return response.data;
  }

  /**
   * Eliminar un lote
   * @param {number} id - ID del lote
   */
  async deleteLote(id) {
    const response = await api.delete(`/dispatch/lotes/${id}`);
    return response.data;
  }

  /**
   * Marcar lote como despachado
   * @param {number} id - ID del lote
   */
  async despacharLote(id) {
    const response = await api.post(`/dispatch/lotes/${id}/despachar`);
    return response.data;
  }

  /**
   * Obtener resumen del lote
   * @param {number} id - ID del lote
   */
  async getResumenLote(id) {
    const response = await api.get(`/dispatch/lotes/${id}/resumen`);
    return response.data;
  }


  // ==========================
  // LOTES DE VENTA (Legacy - para compatibilidad)
  // ==========================

  /**
   * Obtener lotes de venta (sistema antiguo - mantenido para compatibilidad)
   */
  async getLotesVenta() {
    // Retornar estructura vacía para mantener compatibilidad
    return { success: true, data: [] };
  }
}

export default new MezclasService();
