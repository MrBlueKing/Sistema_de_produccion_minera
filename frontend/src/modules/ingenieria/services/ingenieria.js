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

  async updateTipoFrente(id, data) {
    const response = await api.put(`/ingenieria/tipos-frente/${id}`, data);
    return response.data;
  }

  async deleteTipoFrente(id) {
    const response = await api.delete(`/ingenieria/tipos-frente/${id}`);
    return response.data;
  }

  // Frentes de Trabajo
  async getFrentesTrabajo(params = {}) {
    const response = await api.get('/ingenieria/frentes-trabajo', { params });
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

  // Historial de Frentes Eliminados
  async getTrashedFrentesTrabajo() {
    const response = await api.get('/ingenieria/frentes-trabajo/trashed');
    return response.data;
  }

  async restoreFrenteTrabajo(id) {
    const response = await api.post(`/ingenieria/frentes-trabajo/${id}/restore`);
    return response.data;
  }

  async forceDeleteFrenteTrabajo(id) {
    const response = await api.delete(`/ingenieria/frentes-trabajo/${id}/force`);
    return response.data;
  }

  // Historial de Cambios
  async getHistorialFrenteTrabajo(id) {
    const response = await api.get(`/ingenieria/frentes-trabajo/${id}/historial`);
    return response.data;
  }

  async revertirFrenteTrabajo(id, auditoriaId) {
    const response = await api.post(`/ingenieria/frentes-trabajo/${id}/revertir/${auditoriaId}`);
    return response.data;
  }

  // Seguimiento Estado Frentes
  async getSeguimientos(params = {}) {
    const response = await api.get('/ingenieria/seguimiento-estado', { params });
    return response.data;
  }

  async createSeguimiento(data) {
    const response = await api.post('/ingenieria/seguimiento-estado', data);
    return response.data;
  }

  async updateSeguimiento(id, data) {
    const response = await api.put(`/ingenieria/seguimiento-estado/${id}`, data);
    return response.data;
  }

  async marcarInicioReal(id, fecha) {
    const response = await api.post(`/ingenieria/seguimiento-estado/${id}/marcar-inicio`, { fecha_inicio_real: fecha });
    return response.data;
  }

  async deleteSeguimiento(id) {
    const response = await api.delete(`/ingenieria/seguimiento-estado/${id}`);
    return response.data;
  }

  async getEstadisticasSeguimiento(params = {}) {
    const response = await api.get('/ingenieria/seguimiento-estado/estadisticas', { params });
    return response.data;
  }
}

export default new IngenieriaService();