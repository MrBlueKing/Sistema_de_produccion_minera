import api from '../core/services/api';

const faenaService = {
  /**
   * Obtener todas las faenas activas desde el sistema central
   */
  getFaenas: async () => {
    try {
      const response = await api.get('/faenas');
      return response.data;
    } catch (error) {
      console.error('Error al obtener faenas:', error);
      throw error;
    }
  },

  /**
   * Obtener una faena específica por ID
   */
  getFaena: async (id) => {
    try {
      const response = await api.get(`/faenas/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener faena:', error);
      throw error;
    }
  },
};

export default faenaService;
