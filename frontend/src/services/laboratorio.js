import api from '../core/services/api';

class LaboratorioService {
  // ==================== EMPRESAS ====================
  async getEmpresas(params = {}) {
    const response = await api.get('/laboratorio/empresas', { params });
    return response.data;
  }

  async getEmpresa(id) {
    const response = await api.get(`/laboratorio/empresas/${id}`);
    return response.data;
  }

  async createEmpresa(data) {
    const response = await api.post('/laboratorio/empresas', data);
    return response.data;
  }

  async updateEmpresa(id, data) {
    const response = await api.put(`/laboratorio/empresas/${id}`, data);
    return response.data;
  }

  async deleteEmpresa(id) {
    const response = await api.delete(`/laboratorio/empresas/${id}`);
    return response.data;
  }

  // ==================== PLANTAS ====================
  async getPlantas(params = {}) {
    const response = await api.get('/laboratorio/plantas', { params });
    return response.data;
  }

  async getPlanta(id) {
    const response = await api.get(`/laboratorio/plantas/${id}`);
    return response.data;
  }

  async createPlanta(data) {
    const response = await api.post('/laboratorio/plantas', data);
    return response.data;
  }

  async updatePlanta(id, data) {
    const response = await api.put(`/laboratorio/plantas/${id}`, data);
    return response.data;
  }

  async deletePlanta(id) {
    const response = await api.delete(`/laboratorio/plantas/${id}`);
    return response.data;
  }

  // ==================== LOTES ====================
  async getLotes(params = {}) {
    const response = await api.get('/dispatch/lotes', { params });
    return response.data;
  }

  async getLote(id) {
    const response = await api.get(`/dispatch/lotes/${id}`);
    return response.data;
  }

  async createLote(data) {
    const response = await api.post('/dispatch/lotes', data);
    return response.data;
  }

  async updateLote(id, data) {
    const response = await api.put(`/dispatch/lotes/${id}`, data);
    return response.data;
  }

  async deleteLote(id, opcion = 'dejar_huerfanas') {
    const response = await api.delete(`/dispatch/lotes/${id}`, {
      params: { opcion }
    });
    return response.data;
  }

  async getResumenLote(id) {
    const response = await api.get(`/dispatch/lotes/${id}/resumen`);
    return response.data;
  }

  async getReconstruccionLote(id) {
    const response = await api.get(`/dispatch/lotes/${id}/reconstruccion`);
    return response.data;
  }

  async cerrarLote(id, datos = {}) {
    const response = await api.post(`/dispatch/lotes/${id}/cerrar`, datos);
    return response.data;
  }

  async getLotesAbiertosConCamionadas(params = {}) {
    const response = await api.get('/dispatch/lotes/abiertos-con-camionadas', { params });
    return response.data;
  }

  async getLotesAbiertos(params = {}) {
    const response = await api.get('/dispatch/lotes/abiertos', { params });
    return response.data;
  }

  // ==================== CAMIONADAS ====================
  async getCamionadas(params = {}) {
    const response = await api.get('/dispatch/camionadas', { params });
    return response.data;
  }

  async getCamionada(id) {
    const response = await api.get(`/dispatch/camionadas/${id}`);
    return response.data;
  }

  async createCamionada(data) {
    const response = await api.post('/dispatch/camionadas', data);
    return response.data;
  }

  async updateCamionada(id, data) {
    const response = await api.put(`/dispatch/camionadas/${id}`, data);
    return response.data;
  }

  async deleteCamionada(id) {
    const response = await api.delete(`/dispatch/camionadas/${id}`);
    return response.data;
  }

  async marcarCamionadaRecibida(id, data) {
    const response = await api.post(`/dispatch/camionadas/${id}/recibir`, data);
    return response.data;
  }

  async recepcionarCamionada(id, data) {
    const response = await api.post(`/dispatch/camionadas/${id}/recepcionar`, data);
    return response.data;
  }

  async anularRecepcionCamionada(id) {
    const response = await api.post(`/dispatch/camionadas/${id}/anular-recepcion`);
    return response.data;
  }

  async reordenarCamionada(camionadaId, direccion) {
    const response = await api.post('/dispatch/camionadas/reordenar', {
      camionada_id: camionadaId,
      direccion,
    });
    return response.data;
  }

  async actualizarLeyLaboratorio(id, leyLabCamion) {
    const response = await api.post(`/dispatch/camionadas/${id}/ley-laboratorio`, {
      ley_lab_camion: leyLabCamion
    });
    return response.data;
  }

  async getMezclasDisponibles() {
    const response = await api.get('/dispatch/camionadas/mezclas-disponibles');
    return response.data;
  }

  async getResumenCamionadasPorMezcla(mezclaId) {
    const response = await api.get(`/dispatch/mezclas/${mezclaId}/resumen-camionadas`);
    return response.data;
  }

  // ==================== CAMIONES (Tabla local) ====================
  async getCamiones(params = {}) {
    const response = await api.get('/dispatch/camiones', { params });
    return response.data;
  }

  async createCamion(data) {
    const response = await api.post('/dispatch/camiones', data);
    return response.data;
  }

  async updateCamion(id, data) {
    const response = await api.put(`/dispatch/camiones/${id}`, data);
    return response.data;
  }

  async deleteCamion(id) {
    const response = await api.delete(`/dispatch/camiones/${id}`);
    return response.data;
  }

  // ==================== MÁQUINAS (SISTEMA PETRÓLEO - LEGACY) ====================
  async getMaquinasDisponibles() {
    // Now uses local camiones table
    const camiones = await this.getCamiones({ activos: true });
    // Transform to match old API shape for backward compatibility
    return {
      data: (camiones || []).map(c => ({
        id_maquina: c.id,
        patente: c.patente,
        nombre_maquina: c.nombre,
        nombre_categoria: c.categoria || 'Tolva',
      }))
    };
  }

  // ==================== CERTIFICADOS PDF ====================
  /**
   * Obtener dumpadas disponibles para generar certificado
   */
  async getDumpadasDisponiblesCertificado(params = {}) {
    const response = await api.get('/laboratorio/certificados/dumpadas', { params });
    return response.data;
  }

  /**
   * Validar selección de dumpadas antes de generar certificado
   * Detecta si ya tienen certificado y qué acción se puede tomar
   */
  async validarSeleccionCertificado(dumpadaIds) {
    const response = await api.post('/laboratorio/certificados/validar', {
      dumpada_ids: dumpadaIds
    });
    return response.data;
  }

  /**
   * Obtener lista de certificados PDF generados
   */
  async getCertificadosGenerados(params = {}) {
    const response = await api.get('/laboratorio/certificados/generados', { params });
    return response.data;
  }

  /**
   * Obtener dumpadas de un certificado específico
   */
  async getDumpadasPorCertificado(numeroCertificado) {
    const response = await api.get(`/laboratorio/certificados/${numeroCertificado}/dumpadas`);
    return response.data;
  }

  /**
   * Generar certificado PDF
   * @param {Array} dumpadaIds - IDs de las dumpadas a incluir
   * @param {string|null} numeroCertificado - Número de certificado (opcional)
   */
  async generarCertificadoPdf(dumpadaIds, numeroCertificado = null) {
    const response = await api.post('/laboratorio/certificados/generar', {
      dumpada_ids: dumpadaIds,
      numero_certificado: numeroCertificado
    }, {
      responseType: 'blob'
    });
    return response;
  }

  /**
   * Regenerar certificado PDF existente
   */
  async regenerarCertificadoPdf(numeroCertificado) {
    const response = await api.get(`/laboratorio/certificados/${numeroCertificado}/regenerar`, {
      responseType: 'blob'
    });
    return response;
  }

  /**
   * Previsualizar certificado PDF (sin guardar)
   */
  async previsualizarCertificadoPdf(dumpadaIds, numeroCertificado = null) {
    const response = await api.post('/laboratorio/certificados/previsualizar', {
      dumpada_ids: dumpadaIds,
      numero_certificado: numeroCertificado
    }, {
      responseType: 'blob'
    });
    return response;
  }
}

export default new LaboratorioService();
