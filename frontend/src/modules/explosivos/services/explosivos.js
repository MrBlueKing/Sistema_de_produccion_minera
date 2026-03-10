import api from '../../../core/services/api';

class ExplosivosService {
  // =============================================
  // CATEGORÍAS DE EXPLOSIVOS
  // =============================================
  async getCategorias(params = {}) {
    const response = await api.get('/explosivos/categorias', { params });
    return response.data;
  }

  async getCategoria(id) {
    const response = await api.get(`/explosivos/categorias/${id}`);
    return response.data;
  }

  async createCategoria(data) {
    const response = await api.post('/explosivos/categorias', data);
    return response.data;
  }

  async updateCategoria(id, data) {
    const response = await api.put(`/explosivos/categorias/${id}`, data);
    return response.data;
  }

  async deleteCategoria(id) {
    const response = await api.delete(`/explosivos/categorias/${id}`);
    return response.data;
  }

  // =============================================
  // TIPOS DE EXPLOSIVOS (Catálogo)
  // =============================================
  async getTipos(params = {}) {
    const response = await api.get('/explosivos/tipos', { params });
    return response.data;
  }

  async getTipo(id) {
    const response = await api.get(`/explosivos/tipos/${id}`);
    return response.data;
  }

  async createTipo(data) {
    const response = await api.post('/explosivos/tipos', data);
    return response.data;
  }

  async updateTipo(id, data) {
    const response = await api.put(`/explosivos/tipos/${id}`, data);
    return response.data;
  }

  async deleteTipo(id) {
    const response = await api.delete(`/explosivos/tipos/${id}`);
    return response.data;
  }

  // =============================================
  // POLVORINES
  // =============================================
  async getPolvorines(params = {}) {
    const response = await api.get('/explosivos/polvorines', { params });
    return response.data;
  }

  async getPolvorin(id) {
    const response = await api.get(`/explosivos/polvorines/${id}`);
    return response.data;
  }

  async getPolvorinPorFaena(idFaena) {
    const response = await api.get(`/explosivos/polvorines/por-faena/${idFaena}`);
    return response.data;
  }

  async createPolvorin(data) {
    const response = await api.post('/explosivos/polvorines', data);
    return response.data;
  }

  async updatePolvorin(id, data) {
    const response = await api.put(`/explosivos/polvorines/${id}`, data);
    return response.data;
  }

  async getPolvorinAlertas(id) {
    const response = await api.get(`/explosivos/polvorines/${id}/alertas`);
    return response.data;
  }

  // =============================================
  // LOTES DE EXPLOSIVOS
  // =============================================
  async getLotes(params = {}) {
    const response = await api.get('/explosivos/lotes', { params });
    return response.data;
  }

  async getLote(id) {
    const response = await api.get(`/explosivos/lotes/${id}`);
    return response.data;
  }

  async getLotesDisponibles(idTipoExplosivo, idPolvorin) {
    const response = await api.get('/explosivos/lotes/disponibles', {
      params: { id_tipo_explosivo: idTipoExplosivo, id_polvorin: idPolvorin }
    });
    return response.data;
  }

  async createLote(data) {
    const response = await api.post('/explosivos/lotes', data);
    return response.data;
  }

  async updateLote(id, data) {
    const response = await api.put(`/explosivos/lotes/${id}`, data);
    return response.data;
  }

  async marcarLoteVencido(id) {
    const response = await api.post(`/explosivos/lotes/${id}/marcar-vencido`);
    return response.data;
  }

  // =============================================
  // STOCK DE EXPLOSIVOS
  // =============================================
  async getStock(params = {}) {
    const response = await api.get('/explosivos/stock', { params });
    return response.data;
  }

  async getStockResumen(params = {}) {
    const response = await api.get('/explosivos/stock/resumen', { params });
    return response.data;
  }

  async getStockAlertas(params = {}) {
    const response = await api.get('/explosivos/stock/alertas', { params });
    return response.data;
  }

  async getStockPorTipo(idTipoExplosivo, params = {}) {
    const response = await api.get(`/explosivos/stock/por-tipo/${idTipoExplosivo}`, { params });
    return response.data;
  }

  // =============================================
  // MOVIMIENTOS DE EXPLOSIVOS
  // =============================================
  async getMovimientos(params = {}) {
    const response = await api.get('/explosivos/movimientos', { params });
    return response.data;
  }

  async getMovimiento(id) {
    const response = await api.get(`/explosivos/movimientos/${id}`);
    return response.data;
  }

  async getMovimientosPorTronadura(idTronadura) {
    const response = await api.get(`/explosivos/movimientos/por-tronadura/${idTronadura}`);
    return response.data;
  }

  async registrarEntrada(data) {
    const response = await api.post('/explosivos/movimientos/entrada', data);
    return response.data;
  }

  async registrarEntradaGuia(data) {
    const response = await api.post('/explosivos/movimientos/entrada-guia', data);
    return response.data;
  }

  async registrarSalida(data) {
    const response = await api.post('/explosivos/movimientos/salida', data);
    return response.data;
  }

  async registrarSalidaMultiple(data) {
    const response = await api.post('/explosivos/movimientos/salida-multiple', data);
    return response.data;
  }

  async registrarAjuste(data) {
    const response = await api.post('/explosivos/movimientos/ajuste', data);
    return response.data;
  }

  async getReporteMovimientos(params) {
    const response = await api.get('/explosivos/movimientos/reporte', { params });
    return response.data;
  }

  // =============================================
  // PERSONAL AUTORIZADO PARA SOLICITAR EXPLOSIVOS
  // =============================================
  async getPersonalAutorizado(params = {}) {
    const response = await api.get('/explosivos/personal-autorizado', { params });
    return response.data;
  }

  async getPersonalDisponible() {
    const response = await api.get('/explosivos/personal-autorizado/disponible');
    return response.data;
  }

  async autorizarPersonal(data) {
    const response = await api.post('/explosivos/personal-autorizado', data);
    return response.data;
  }

  async desautorizarPersonal(id) {
    const response = await api.delete(`/explosivos/personal-autorizado/${id}`);
    return response.data;
  }

  async reactivarPersonal(id) {
    const response = await api.put(`/explosivos/personal-autorizado/${id}/reactivar`);
    return response.data;
  }

  // =============================================
  // FÓRMULAS DE EXPLOSIVOS
  // =============================================
  async getFormulas(params = {}) {
    const response = await api.get('/explosivos/formulas', { params });
    return response.data;
  }

  async guardarFormulas(data) {
    const response = await api.post('/explosivos/formulas', data);
    return response.data;
  }

  // =============================================
  // REPORTES DE PERFORACIÓN Y TRONADURA
  // =============================================
  async getReportes(params = {}) {
    const response = await api.get('/explosivos/reportes-perforacion', { params });
    return response.data;
  }

  async createReporte(data) {
    const response = await api.post('/explosivos/reportes-perforacion', data);
    return response.data;
  }

  async getReporte(id) {
    const response = await api.get(`/explosivos/reportes-perforacion/${id}`);
    return response.data;
  }

  async updateReporte(id, data) {
    const response = await api.put(`/explosivos/reportes-perforacion/${id}`, data);
    return response.data;
  }

  async deleteReporte(id) {
    const response = await api.delete(`/explosivos/reportes-perforacion/${id}`);
    return response.data;
  }

  async agregarLinea(reporteId, data) {
    const response = await api.post(`/explosivos/reportes-perforacion/${reporteId}/lineas`, data);
    return response.data;
  }

  async actualizarLinea(reporteId, lineaId, data) {
    const response = await api.put(`/explosivos/reportes-perforacion/${reporteId}/lineas/${lineaId}`, data);
    return response.data;
  }

  async eliminarLinea(reporteId, lineaId) {
    const response = await api.delete(`/explosivos/reportes-perforacion/${reporteId}/lineas/${lineaId}`);
    return response.data;
  }

  async calcularExplosivos(data) {
    const response = await api.post('/explosivos/reportes-perforacion/calcular', data);
    return response.data;
  }

  async confirmarReporte(id, data = {}) {
    const response = await api.post(`/explosivos/reportes-perforacion/${id}/confirmar`, data);
    return response.data;
  }

  async registrarDevoluciones(id, devoluciones) {
    const response = await api.post(`/explosivos/reportes-perforacion/${id}/devoluciones`, { devoluciones });
    return response.data;
  }

  async cerrarReporte(id) {
    const response = await api.post(`/explosivos/reportes-perforacion/${id}/cerrar`);
    return response.data;
  }

  async anularReporte(id) {
    const response = await api.post(`/explosivos/reportes-perforacion/${id}/anular`);
    return response.data;
  }

  async getEstadisticasReportes(params = {}) {
    const response = await api.get('/explosivos/reportes-perforacion/estadisticas', { params });
    return response.data;
  }

  async getHistorialReporte(id) {
    const response = await api.get(`/explosivos/reportes-perforacion/${id}/historial`);
    return response.data;
  }

  // =============================================
  // PROVEEDORES DE EXPLOSIVOS
  // =============================================
  async getProveedores(params = {}) {
    const response = await api.get('/explosivos/proveedores', { params });
    return response.data;
  }

  async createProveedor(data) {
    const response = await api.post('/explosivos/proveedores', data);
    return response.data;
  }

  async updateProveedor(id, data) {
    const response = await api.put(`/explosivos/proveedores/${id}`, data);
    return response.data;
  }

  async deleteProveedor(id) {
    const response = await api.delete(`/explosivos/proveedores/${id}`);
    return response.data;
  }
}

export default new ExplosivosService();
