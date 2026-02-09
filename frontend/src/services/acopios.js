import api from '../core/services/api';

const acopiosService = {
  /**
   * Listar acopios con filtros y paginación
   */
  getAcopios: async (params = {}) => {
    const response = await api.get('/dispatch/acopios', { params });
    return response.data;
  },

  /**
   * Obtener un acopio específico por ID
   */
  getAcopio: async (id) => {
    const response = await api.get(`/dispatch/acopios/${id}`);
    return response.data;
  },

  /**
   * Detectar acopios existentes para un conjunto de dumpadas
   * @param {Array} dumpadas - Array de objetos con {id_frente_trabajo, jornada, fecha}
   */
  detectarAcopiosExistentes: async (dumpadas) => {
    const response = await api.post('/dispatch/acopios/detectar-existentes', { dumpadas });
    return response.data;
  },

  /**
   * Crear un acopio automático
   */
  crearAcopioAutomatico: async (data) => {
    const response = await api.post('/dispatch/acopios/automatico', data);
    return response.data;
  },

  /**
   * Crear un acopio manual
   * @param {Object} data - {nombre, observaciones, dumpada_ids}
   */
  crearAcopioManual: async (data) => {
    const response = await api.post('/dispatch/acopios/manual', data);
    return response.data;
  },

  /**
   * Agregar dumpadas a un acopio existente
   */
  agregarDumpadas: async (acopioId, dumpadaIds) => {
    const response = await api.post(`/dispatch/acopios/${acopioId}/agregar-dumpadas`, {
      dumpada_ids: dumpadaIds
    });
    return response.data;
  },

  /**
   * Quitar dumpadas de un acopio
   */
  quitarDumpadas: async (acopioId, dumpadaIds) => {
    const response = await api.post(`/dispatch/acopios/${acopioId}/quitar-dumpadas`, {
      dumpada_ids: dumpadaIds
    });
    return response.data;
  },

  /**
   * Verificar si un acopio puede cerrarse
   */
  puedeCerrarse: async (acopioId) => {
    const response = await api.get(`/dispatch/acopios/${acopioId}/puede-cerrarse`);
    return response.data;
  },

  /**
   * Cerrar un acopio (no se pueden agregar más dumpadas)
   */
  cerrarAcopio: async (acopioId) => {
    const response = await api.post(`/dispatch/acopios/${acopioId}/cerrar`);
    return response.data;
  },

  /**
   * Reabrir un acopio cerrado
   */
  reabrirAcopio: async (acopioId) => {
    const response = await api.post(`/dispatch/acopios/${acopioId}/reabrir`);
    return response.data;
  },

  /**
   * Obtener acopios disponibles para usar en mezclas (cerrados o abiertos, pero no en mezcla)
   */
  getAcopiosDisponibles: async () => {
    const response = await api.get('/dispatch/acopios/disponibles');
    return response.data;
  },

  /**
   * Obtener acopios disponibles para crear mezclas (más flexible)
   */
  getAcopiosParaMezclas: async (params = {}) => {
    const response = await api.get('/dispatch/acopios/para-mezclas', { params });
    return response.data;
  },

  /**
   * Obtener dumpadas que no tienen acopio asignado
   */
  getDumpadasSinAcopio: async () => {
    const response = await api.get('/dispatch/acopios/dumpadas-sin-acopio');
    return response.data;
  },

  /**
   * Eliminar un acopio
   */
  eliminarAcopio: async (acopioId) => {
    const response = await api.delete(`/dispatch/acopios/${acopioId}`);
    return response.data;
  },
};

export default acopiosService;
