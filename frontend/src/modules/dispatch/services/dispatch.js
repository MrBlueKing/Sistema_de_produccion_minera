import api from '../../../core/services/api';

class DispatchService {
  // Dumpadas
  async getDumpadas(params = {}) {
    const response = await api.get('/dispatch/dumpadas', { params });
    return response.data;
  }

  async getDumpada(id) {
    const response = await api.get(`/dispatch/dumpadas/${id}`);
    return response.data;
  }

  async createDumpada(data) {
    const response = await api.post('/dispatch/dumpadas', data);
    return response.data;
  }

  async createDumpadasBulk(dumpadas) {
    const response = await api.post('/dispatch/dumpadas/bulk', { dumpadas });
    return response.data;
  }

  async updateDumpada(id, data) {
    const response = await api.put(`/dispatch/dumpadas/${id}`, data);
    return response.data;
  }

  async deleteDumpada(id) {
    const response = await api.delete(`/dispatch/dumpadas/${id}`);
    return response.data;
  }

  async previsualizarAcopio(data) {
    const response = await api.post('/dispatch/dumpadas/previsualizar-acopio', data);
    return response.data;
  }

  async marcarMuestreo(ids, paraMuestreo) {
    const response = await api.post('/dispatch/dumpadas/marcar-muestreo', {
      ids,
      para_muestreo: paraMuestreo,
    });
    return response.data;
  }

  async getMaquinas() {
    const response = await api.get('/dispatch/tonelaje-maquinas');
    return response.data;
  }

  // Muestras Libres
  async getMuestrasLibres() {
    const response = await api.get('/dispatch/muestras-libres');
    return response.data;
  }

  async createMuestraLibre(data) {
    const response = await api.post('/dispatch/muestras-libres', data);
    return response.data;
  }

  async deleteMuestraLibre(id) {
    const response = await api.delete(`/dispatch/muestras-libres/${id}`);
    return response.data;
  }

  // Resumen semanal para el hub (agrupado por frente + jornada)
  async getResumenSemana(params = {}) {
    const response = await api.get('/dispatch/resumen-semana', { params });
    return response.data;
  }

  // Rangos
  async getRangos() {
    const response = await api.get('/dispatch/rangos');
    return response.data;
  }

  async getRangoByLey(ley) {
    const response = await api.post('/dispatch/rangos/by-ley', { ley });
    return response.data;
  }

  // Plantas
  async getPlantas(faenaId) {
    const response = await api.get('/dispatch/plantas', { params: { faena_id: faenaId } });
    return response.data;
  }

  // Importación desde Excel
  async importarPreview(faenaId, frentes) {
    const response = await api.post('/dispatch/importar/preview', {
      faena_id: faenaId,
      frentes,
    });
    return response.data;
  }

  async importarConfirmar(faenaId, tipoLey, dumpadas) {
    const response = await api.post('/dispatch/importar/confirmar', {
      faena_id: faenaId,
      tipo_ley: tipoLey,
      dumpadas,
    }, { timeout: 120000 });
    return response.data;
  }

  async importarMezclasPreview(faenaId, mezclas) {
    const response = await api.post('/dispatch/importar/mezclas/preview', {
      faena_id: faenaId,
      mezclas,
    });
    return response.data;
  }

  async importarMezclasConfirmar(faenaId, plantaId, mezclas) {
    const response = await api.post('/dispatch/importar/mezclas/confirmar', {
      faena_id: faenaId,
      planta_id: plantaId,
      mezclas,
    }, { timeout: 120000 });
    return response.data;
  }
}

export default new DispatchService();
