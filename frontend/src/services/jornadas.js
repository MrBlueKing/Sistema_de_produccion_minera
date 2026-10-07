import api from '../core/services/api';

/**
 * Jornadas/turnos configurables (módulo Configuración General).
 * La lista completa se pide una sola vez por carga de página y se comparte
 * entre todos los formularios y filtros (ver hooks/useJornadas.js).
 */
let cache = null;

const jornadasService = {
  /** Todas las jornadas (activas e inactivas), en orden. */
  getTodas(forzar = false) {
    if (!cache || forzar) {
      cache = api.get('/jornadas').then((r) => r.data).catch((e) => {
        cache = null;
        throw e;
      });
    }
    return cache;
  },

  async crear(datos) {
    const r = await api.post('/jornadas', datos);
    cache = null;
    return r.data;
  },

  async actualizar(id, datos) {
    const r = await api.put(`/jornadas/${id}`, datos);
    cache = null;
    return r.data;
  },

  async ordenar(ids) {
    const r = await api.put('/jornadas/orden', { ids });
    cache = null;
    return r.data;
  },
};

export default jornadasService;
