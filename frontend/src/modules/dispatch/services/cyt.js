import api from '../../../core/services/api';

// Report de Ciclo Carguío y Transporte (Supervisor CyT). Todas las rutas llevan
// id_faena: el backend valida que sea la del usuario, salvo multifaena.
const base = '/dispatch/cyt';

const cytService = {
  reportes: (idFaena) => api.get(`${base}/reportes`, { params: { id_faena: idFaena } }).then((r) => r.data),
  buscar: (idFaena, fecha, jornada) => api.get(`${base}/reportes/buscar`, { params: { id_faena: idFaena, fecha, jornada } }).then((r) => r.data),
  guardar: (datos) => api.post(`${base}/reportes`, datos).then((r) => r.data),
  eliminar: (id) => api.delete(`${base}/reportes/${id}`).then((r) => r.data),
  maquinas: () => api.get(`${base}/maquinas`).then((r) => r.data),
  operadores: (idFaena, tipo) => api.get(`${base}/operadores`, { params: { id_faena: idFaena, tipo } }).then((r) => r.data),
  personalDisponible: (idFaena) => api.get(`${base}/operadores/disponibles`, { params: { id_faena: idFaena } }).then((r) => r.data),
  autorizarOperador: (idFaena, persona) => api.post(`${base}/operadores`, { ...persona, id_faena: idFaena }).then((r) => r.data),
  quitarOperador: (id) => api.delete(`${base}/operadores/${id}`).then((r) => r.data),
};

export default cytService;
