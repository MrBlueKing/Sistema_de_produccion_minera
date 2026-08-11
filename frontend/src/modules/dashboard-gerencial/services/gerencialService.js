import api from '../../../core/services/api';

/**
 * Servicios del Dashboard Gerencial (Operaciones + Certificados y Leyes).
 * Todas las llamadas van contra /gerencial/* del propio backend (mismo origen,
 * autenticadas vía el interceptor de core/services/api.js).
 */
const gerencialService = {
  getResumen: async (params = {}, signal) => {
    const response = await api.get('/gerencial/resumen', { params, signal });
    return response.data;
  },

  getFaenas: async () => {
    const response = await api.get('/gerencial/faenas');
    return response.data;
  },

  getReporteProduccion: async (params = {}, signal) => {
    const response = await api.get('/gerencial/reporte-produccion', { params, signal });
    return response.data;
  },

  getLotes: async (params = {}) => {
    const response = await api.get('/gerencial/lotes', { params });
    return response.data;
  },

  getLote: async (id) => {
    const response = await api.get(`/gerencial/lotes/${id}`);
    return response.data;
  },

  getReconstruccionLote: async (id) => {
    const response = await api.get(`/gerencial/lotes/${id}/reconstruccion`);
    return response.data;
  },

  getAnalisisLotes: async (params = {}, signal) => {
    const response = await api.get('/gerencial/analisis-lotes', { params, signal });
    return response.data;
  },

  getEficiencia: async (params = {}, signal) => {
    const response = await api.get('/gerencial/eficiencia', { params, signal });
    return response.data;
  },

  getDumpadasDiarias: async (params = {}, signal) => {
    const response = await api.get('/gerencial/dumpadas-diarias', { params, signal });
    return response.data;
  },

  getPlantas: async () => {
    const response = await api.get('/gerencial/plantas');
    return response.data;
  },

  getEmpresas: async () => {
    const response = await api.get('/gerencial/empresas');
    return response.data;
  },

  getCertificadosResumen: async (params = {}) => {
    const response = await api.get('/gerencial/certificados-resumen', { params });
    return response.data;
  },

  // Listado y detalle de certificados (solo lectura, sin generar/descargar PDF)
  getCertificados: async (params = {}) => {
    const response = await api.get('/gerencial/certificados', { params });
    return response.data;
  },

  getCertificadoDetalle: async (numeroCertificado) => {
    const response = await api.get(`/gerencial/certificados/${numeroCertificado}`);
    return response.data;
  },

  previsualizarCertificado: async (numeroCertificado) => {
    const response = await api.get(`/gerencial/certificados/${numeroCertificado}/previsualizar`, {
      responseType: 'blob',
    });
    return response;
  },
};

export default gerencialService;
