import api from '../core/services/api';

/**
 * Servicio para obtener configuraciones del sistema desde la API
 * Soporta configuraciones por faena
 */
class ConfiguracionService {
  // Cache en memoria para evitar llamadas repetidas
  static cache = {};
  static cacheTime = {};
  static CACHE_DURATION = 60 * 60 * 1000; // 1 hora

  /**
   * Obtener todas las configuraciones
   * @param {number|null} idFaena - ID de faena para obtener config específica (opcional)
   */
  async getAll(idFaena = null) {
    const cacheKey = idFaena ? `all_${idFaena}` : 'all';

    // Verificar cache
    if (ConfiguracionService.cache[cacheKey] &&
        Date.now() - ConfiguracionService.cacheTime[cacheKey] < ConfiguracionService.CACHE_DURATION) {
      return ConfiguracionService.cache[cacheKey];
    }

    const params = idFaena ? `?id_faena=${idFaena}` : '';
    const response = await api.get(`/configuraciones${params}`);

    // Guardar en cache
    ConfiguracionService.cache[cacheKey] = response.data;
    ConfiguracionService.cacheTime[cacheKey] = Date.now();

    return response.data;
  }

  /**
   * Obtener una configuración específica
   * @param {string} clave - Clave de la configuración
   * @param {number|null} idFaena - ID de faena (opcional)
   */
  async get(clave, idFaena = null) {
    const cacheKey = idFaena ? `config_${clave}_${idFaena}` : `config_${clave}`;

    // Verificar cache
    if (ConfiguracionService.cache[cacheKey] &&
        Date.now() - ConfiguracionService.cacheTime[cacheKey] < ConfiguracionService.CACHE_DURATION) {
      return ConfiguracionService.cache[cacheKey];
    }

    const params = idFaena ? `?id_faena=${idFaena}` : '';
    const response = await api.get(`/configuraciones/${clave}${params}`);

    // Guardar en cache
    ConfiguracionService.cache[cacheKey] = response.data.valor;
    ConfiguracionService.cacheTime[cacheKey] = Date.now();

    return response.data.valor;
  }

  /**
   * Actualizar una configuración específica
   * @param {string} clave - Clave de la configuración
   * @param {any} valor - Nuevo valor
   * @param {number|null} idFaena - ID de faena (null = global)
   */
  async update(clave, valor, idFaena = null) {
    const response = await api.put(`/configuraciones/${clave}`, {
      valor,
      id_faena: idFaena
    });

    // Limpiar cache después de actualizar
    this.clearCache();

    return response.data;
  }

  /**
   * Obtener todas las configuraciones de una clave por todas las faenas
   * Útil para Encargado Dispatch que necesita ver/editar todas las faenas
   * @param {string} clave - Clave de la configuración
   */
  async getByKeyAllFaenas(clave) {
    const response = await api.get(`/configuraciones/${clave}/faenas`);
    return response.data;
  }

  /**
   * Limpiar cache
   */
  clearCache() {
    ConfiguracionService.cache = {};
    ConfiguracionService.cacheTime = {};
  }

  // =============================================
  // TONELAJE POR MÁQUINA
  // =============================================

  /**
   * Obtener todas las máquinas con su tonelaje configurado
   */
  async getTonelajeMaquinas() {
    const response = await api.get('/dispatch/tonelaje-maquinas');
    return response.data;
  }

  /**
   * Obtener tonelaje de una máquina específica
   * @param {number} idMaquina - ID de la máquina
   */
  async getTonelajeMaquina(idMaquina) {
    const response = await api.get(`/dispatch/tonelaje-maquinas/${idMaquina}`);
    return response.data;
  }

  /**
   * Configurar tonelaje para una máquina
   * @param {object} data - { id_maquina, nombre_maquina, tonelaje, patente?, es_global? }
   */
  async setTonelajeMaquina(data) {
    const response = await api.post('/dispatch/tonelaje-maquinas', data);
    return response.data;
  }

  /**
   * Eliminar configuración de tonelaje de una máquina (vuelve a usar default)
   * @param {number} configId - ID de la configuración a eliminar
   */
  async deleteTonelajeMaquina(configId) {
    const response = await api.delete(`/dispatch/tonelaje-maquinas/${configId}`);
    return response.data;
  }
}

export default new ConfiguracionService();
