import api from '../../../core/services/api';

class IngenieriaService {
  // Tipos de Frente
  async getTiposFrente() {
    const response = await api.get('/ingenieria/tipos-frente');
    return response.data;
  }

  async createTipoFrente(data) {
    const response = await api.post('/ingenieria/tipos-frente', data);
    return response.data;
  }

  // Frentes de Trabajo
  async getFrentesTrabajo() {
    const response = await api.get('/ingenieria/frentes-trabajo');
    return response.data;
  }

  async createFrenteTrabajo(data) {
    const response = await api.post('/ingenieria/frentes-trabajo', data);
    return response.data;
  }

  async updateFrenteTrabajo(id, data) {
    const response = await api.put(`/ingenieria/frentes-trabajo/${id}`, data);
    return response.data;
  }

  async deleteFrenteTrabajo(id) {
    const response = await api.delete(`/ingenieria/frentes-trabajo/${id}`);
    return response.data;
  }
}

export default new IngenieriaService();