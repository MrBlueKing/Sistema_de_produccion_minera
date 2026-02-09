import api from '../../../core/services/api';

class LaboratorioService {
  // ========================================
  // MÓDULO: ANÁLISIS DE MUESTRAS
  // ========================================

  // Dumpadas pendientes de análisis
  async getDumpadasPendientes(params = {}) {
    const response = await api.get('/laboratorio/dumpadas', { params });
    return response.data;
  }

  // Completar análisis individual
  async completarAnalisis(id, data) {
    const response = await api.put(`/laboratorio/dumpadas/${id}/completar`, data);
    return response.data;
  }

  // Completar múltiples análisis
  async completarMultiplesAnalisis(analisis) {
    const response = await api.post('/laboratorio/dumpadas/completar-multiples', { analisis });
    return response.data;
  }

  // Estadísticas del laboratorio
  async getEstadisticas() {
    const response = await api.get('/laboratorio/estadisticas');
    return response.data;
  }

  // Historial de análisis completados (para reportes/PDF)
  async getHistorialAnalisis(params = {}) {
    const response = await api.get('/laboratorio/historial', { params });
    return response.data;
  }

  // ========================================
  // MÓDULO: MUESTREO
  // ========================================

  // Dumpadas pendientes de muestreo (sin leyes)
  async getDumpadasMuestreo(params = {}) {
    const response = await api.get('/laboratorio/muestreo', { params });
    return response.data;
  }

  // Estadísticas de muestreo
  async getEstadisticasMuestreo() {
    const response = await api.get('/laboratorio/muestreo/estadisticas');
    return response.data;
  }

  // Actualizar estado de muestreo
  async actualizarEstadoMuestreo(id, estado) {
    const response = await api.put(`/laboratorio/muestreo/${id}/estado`, { estado });
    return response.data;
  }

  // Actualizar estado de múltiples dumpadas (muestreo)
  async actualizarEstadoMuestreoMultiple(ids, estado) {
    const response = await api.post('/laboratorio/muestreo/actualizar-estado-multiple', { ids, estado });
    return response.data;
  }

  // ========================================
  // MÓDULO: CERTIFICADOS PDF
  // ========================================

  // Obtener dumpadas disponibles para certificado (con análisis completo)
  async getDumpadasParaCertificado(params = {}) {
    const response = await api.get('/laboratorio/certificados/dumpadas', { params });
    return response.data;
  }

  // Preview de datos del certificado (sin generar PDF)
  async previewCertificado(dumpadaIds) {
    const response = await api.post('/laboratorio/certificados/preview', { dumpada_ids: dumpadaIds });
    return response.data;
  }

  // Generar y descargar certificado PDF
  async generarCertificadoPdf(dumpadaIds, numeroCertificado = null) {
    const response = await api.post('/laboratorio/certificados/generar', {
      dumpada_ids: dumpadaIds,
      numero_certificado: numeroCertificado
    }, {
      responseType: 'blob' // Para descargar el PDF
    });
    return response;
  }

  // Previsualizar certificado PDF (abre en nueva pestaña)
  async previsualizarCertificadoPdf(dumpadaIds, numeroCertificado = null) {
    const response = await api.post('/laboratorio/certificados/previsualizar', {
      dumpada_ids: dumpadaIds,
      numero_certificado: numeroCertificado
    }, {
      responseType: 'blob'
    });
    return response;
  }

  // Regenerar certificado existente (descarga PDF de un certificado ya generado)
  async regenerarCertificado(numeroCertificado) {
    const response = await api.get(`/laboratorio/certificados/${numeroCertificado}/regenerar`, {
      responseType: 'blob'
    });
    return response;
  }
}

export default new LaboratorioService();
