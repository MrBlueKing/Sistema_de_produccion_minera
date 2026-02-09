import api from '../../../core/services/api';

class MapaTerrenoService {
  /**
   * Obtener vista completa del mapa (zonas + dumpadas)
   * @returns {Promise<Object>} Datos completos del mapa
   */
  async getMapaCompleto() {
    try {
      const response = await api.get('/dispatch/mapa-terreno');
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo mapa completo:', error);
      throw error;
    }
  }

  /**
   * Actualizar posición de una dumpada en el mapa
   * @param {number} id - ID de la dumpada
   * @param {Object} posicion - {posicion_x, posicion_y, zona_id}
   * @returns {Promise<Object>} Dumpada actualizada
   */
  async actualizarPosicionDumpada(id, posicion) {
    try {
      if (!id) {
        throw new Error('ID de dumpada es requerido');
      }

      const response = await api.put(`/dispatch/mapa-terreno/dumpadas/${id}/posicion`, posicion);
      return response.data;
    } catch (error) {
      console.error(`❌ Error actualizando posición de dumpada ${id}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar posición de una dumpada del mapa
   * @param {number} id - ID de la dumpada
   * @returns {Promise<Object>} Resultado de la operación
   */
  async eliminarPosicionDumpada(id) {
    try {
      if (!id) {
        throw new Error('ID de dumpada es requerido');
      }

      const response = await api.put(`/dispatch/mapa-terreno/dumpadas/${id}/posicion`, {
        posicion_x: null,
        posicion_y: null,
        zona_id: null,
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error eliminando posición de dumpada ${id}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar todas las posiciones de dumpadas del mapa
   * @param {Array<number>} ids - Array de IDs de dumpadas
   * @returns {Promise<Array>} Resultados de las operaciones
   */
  async eliminarTodasPosiciones(ids) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Se requiere un array de IDs válido');
      }

      const promesas = ids.map(id => this.eliminarPosicionDumpada(id));
      return await Promise.all(promesas);
    } catch (error) {
      console.error('❌ Error eliminando posiciones de dumpadas:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las zonas del terreno
   * @returns {Promise<Array>} Lista de zonas
   */
  async getZonas() {
    try {
      const response = await api.get('/dispatch/mapa-terreno/zonas');
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo zonas:', error);
      throw error;
    }
  }

  /**
   * Crear nueva zona en el terreno
   * @param {Object} zona - {nombre, color, coordenadas, descripcion, activa}
   * @returns {Promise<Object>} Zona creada
   */
  async crearZona(zona) {
    try {
      if (!zona.nombre || !zona.coordenadas) {
        throw new Error('Nombre y coordenadas son requeridos');
      }

      const response = await api.post('/dispatch/mapa-terreno/zonas', zona);
      return response.data;
    } catch (error) {
      console.error('❌ Error creando zona:', error);
      throw error;
    }
  }

  /**
   * Actualizar zona existente
   * @param {number} id - ID de la zona
   * @param {Object} zona - Datos a actualizar
   * @returns {Promise<Object>} Zona actualizada
   */
  async actualizarZona(id, zona) {
    try {
      if (!id) {
        throw new Error('ID de zona es requerido');
      }

      const response = await api.put(`/dispatch/mapa-terreno/zonas/${id}`, zona);
      return response.data;
    } catch (error) {
      console.error(`❌ Error actualizando zona ${id}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar zona del terreno
   * @param {number} id - ID de la zona
   * @returns {Promise<Object>} Resultado de la operación
   */
  async eliminarZona(id) {
    try {
      if (!id) {
        throw new Error('ID de zona es requerido');
      }

      const response = await api.delete(`/dispatch/mapa-terreno/zonas/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error eliminando zona ${id}:`, error);
      throw error;
    }
  }
}

export default new MapaTerrenoService();
