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

  // Editar análisis de una dumpada del historial
  async editarAnalisis(id, data) {
    const response = await api.put(`/laboratorio/historial/${id}`, data);
    return response.data;
  }

  // Revertir análisis de una dumpada a Pendiente (solo si no tiene certificado)
  async revertirAnalisis(id) {
    const response = await api.put(`/laboratorio/historial/${id}/revertir`);
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

  // Generar certificado (no descarga el PDF, queda disponible en la pestaña Certificados)
  async generarCertificadoPdf(dumpadaIds = [], numeroCertificado = null, muestraLibreIds = [], para = null) {
    const body = {};
    if (numeroCertificado) body.numero_certificado = numeroCertificado;
    if (dumpadaIds.length > 0) body.dumpada_ids = dumpadaIds;
    if (muestraLibreIds.length > 0) body.muestra_libre_ids = muestraLibreIds;
    if (para) body.para = para;

    const response = await api.post('/laboratorio/certificados/generar', body);
    return response.data;
  }

  // Previsualizar certificado PDF (abre en nueva pestaña)
  async previsualizarCertificadoPdf(dumpadaIds = [], numeroCertificado = null, muestraLibreIds = []) {
    const body = {};
    if (dumpadaIds.length > 0) body.dumpada_ids = dumpadaIds;
    if (muestraLibreIds.length > 0) body.muestra_libre_ids = muestraLibreIds;
    if (numeroCertificado) body.numero_certificado = numeroCertificado;

    const response = await api.post('/laboratorio/certificados/previsualizar', body, {
      responseType: 'blob'
    });
    return response;
  }

  // Listar certificados PDF ya generados (agrupados por número)
  async getCertificadosGenerados(params = {}) {
    const response = await api.get('/laboratorio/certificados/generados', { params });
    return response.data;
  }

  // Obtener las dumpadas/muestras de un certificado específico
  async getDumpadasPorCertificado(numeroCertificado) {
    const response = await api.get(`/laboratorio/certificados/${numeroCertificado}/dumpadas`);
    return response.data;
  }

  // Regenerar certificado existente (descarga PDF de un certificado ya generado)
  async regenerarCertificado(numeroCertificado, para = null) {
    const response = await api.post(`/laboratorio/certificados/${numeroCertificado}/regenerar`, { para }, {
      responseType: 'blob'
    });
    return response;
  }

  // Cambiar el destinatario ("Para") de un certificado ya generado
  async actualizarDestinatarioCertificado(numeroCertificado, destino) {
    const response = await api.patch(`/laboratorio/certificados/${numeroCertificado}/destinatario`, { destino });
    return response.data;
  }

  // Aprobar certificado (visto bueno)
  async aprobarCertificado(numeroCertificado) {
    const response = await api.post(`/laboratorio/certificados/${numeroCertificado}/aprobar`);
    return response.data;
  }

  // Rechazar certificado con motivo
  async rechazarCertificado(numeroCertificado, motivo) {
    const response = await api.post(`/laboratorio/certificados/${numeroCertificado}/rechazar`, { motivo });
    return response.data;
  }

  // Enviar certificado ya aprobado por correo electrónico
  async enviarCorreoCertificado(numeroCertificado, destinatarios, mensaje = null) {
    const response = await api.post(`/laboratorio/certificados/${numeroCertificado}/enviar-correo`, { destinatarios, mensaje });
    return response.data;
  }

  // Enviar varios certificados en un solo correo (todos con sus PDF adjuntos)
  async enviarCorreoMultipleCertificados(numeros, destinatarios, mensaje = null) {
    const response = await api.post('/laboratorio/certificados/enviar-correo-multiple', { numeros, destinatarios, mensaje });
    return response.data;
  }

  // ========================================
  // MÓDULO: MUESTRAS LIBRES
  // ========================================

  // Completar análisis de una muestra libre
  async completarMuestraLibre(id, data) {
    const response = await api.put(`/laboratorio/muestras-libres/${id}/completar`, data);
    return response.data;
  }

  // Editar análisis de una muestra libre ya completada
  async editarMuestraLibre(id, data) {
    const response = await api.put(`/laboratorio/muestras-libres/${id}/editar`, data);
    return response.data;
  }

  // Revertir análisis de una muestra libre a Pendiente (solo si no tiene certificado)
  async revertirMuestraLibre(id) {
    const response = await api.put(`/laboratorio/muestras-libres/${id}/revertir`);
    return response.data;
  }
}

export default new LaboratorioService();
