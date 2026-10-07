import api from '../../../core/services/api';

/**
 * Programa de producción mensual (tile "Planificación" del Dashboard Gerencial).
 * Backend: Api\Planificacion\PlanProduccionController. Leer: cualquier sesión;
 * crear/guardar/publicar/reabrir: rol PlanificadorProduccion.
 */
const planificacionService = {
  /** { plan|null, referencia, frentes_disponibles, turnos, dias_mes, puede_editar } */
  obtener: async ({ id_faena, anio, mes }) => {
    const r = await api.get('/planificacion/planes', { params: { id_faena, anio, mes } });
    return r.data;
  },
  crear: async ({ id_faena, anio, mes }) => {
    const r = await api.post('/planificacion/planes', { id_faena, anio, mes });
    return r.data;
  },
  guardar: async (id, datos) => {
    const r = await api.put(`/planificacion/planes/${id}`, datos);
    return r.data;
  },
  publicar: async (id) => {
    const r = await api.post(`/planificacion/planes/${id}/publicar`);
    return r.data;
  },
  reabrir: async (id, motivo) => {
    const r = await api.post(`/planificacion/planes/${id}/reabrir`, { motivo });
    return r.data;
  },
  eliminar: async (id) => {
    const r = await api.delete(`/planificacion/planes/${id}`);
    return r.data;
  },
};

export default planificacionService;
