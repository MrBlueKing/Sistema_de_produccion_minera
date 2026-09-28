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

  getLotes: async (params = {}, signal) => {
    const response = await api.get('/gerencial/lotes', { params, signal });
    return response.data;
  },

  // Resumen de dumpadas por frente + jornada, con rango de fechas y faenas
  // elegidos desde el Dashboard Gerencial. Endpoint propio (no el de Dispatch
  // /dispatch/resumen-semana): ese bloquea a usuarios no-globales a su propia
  // faena e ignora el id_faena de la query, lo que rompía el selector
  // multi-faena de este dashboard.
  getResumenDumpadas: async (params = {}, signal) => {
    const response = await api.get('/gerencial/resumen-dumpadas', { params, signal });
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

  getDumpadasDetalle: async (params = {}) => {
    const response = await api.get('/gerencial/dumpadas-detalle', { params });
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

  // ── Tarifas y Liquidación/Anticipo/Pago (apartado "Tarifas y Liquidaciones") ──
  // Estos pegan directo a /dispatch/lotes y /dispatch/tarifas: es el mismo
  // Lote/Tarifa que usa Laboratorio, no un controller paralelo bajo /gerencial.
  getLotesComercial: async (params = {}) => {
    const response = await api.get('/dispatch/lotes', {
      params: {
        estado: 'Completado',
        estado_laboratorio: 'Con Paquete Segunda,Canjeado,En Tercero,Resuelto por Tercero,Liquidado,Con Anticipo,Pagado',
        ...params,
      },
    });
    return response.data;
  },

  getTarifas: async () => {
    const response = await api.get('/dispatch/tarifas');
    return response.data;
  },

  crearTarifa: async (data) => {
    const response = await api.post('/dispatch/tarifas', data);
    return response.data;
  },

  actualizarTarifa: async (id, data) => {
    const response = await api.put(`/dispatch/tarifas/${id}`, data);
    return response.data;
  },

  eliminarTarifa: async (id) => {
    const response = await api.delete(`/dispatch/tarifas/${id}`);
    return response.data;
  },

  // Extrae los valores desde el PDF de la Circular ENAMI — solo previsualiza,
  // no guarda nada (el usuario revisa y confirma con crearTarifa()).
  previsualizarTarifaPdf: async (file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await api.post('/dispatch/tarifas/previsualizar-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  actualizarLiquidacion: async (loteId, data) => {
    const response = await api.put(`/dispatch/lotes/${loteId}/liquidacion`, data);
    return response.data;
  },

  registrarAnticipo: async (loteId, data) => {
    const response = await api.put(`/dispatch/lotes/${loteId}/anticipo`, data);
    return response.data;
  },

  registrarPago: async (loteId, data) => {
    const response = await api.put(`/dispatch/lotes/${loteId}/pago`, data);
    return response.data;
  },
};

export default gerencialService;
