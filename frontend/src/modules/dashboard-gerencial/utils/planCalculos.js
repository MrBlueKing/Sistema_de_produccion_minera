// Cálculos del programa de producción, compartidos entre la pantalla de
// Planificación (armar el plan) y la pestaña Plan vs Real de Operaciones.

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DIA_CORTO = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Turno corto y turno largo son turnos del día (se agregan con "+"), no tipos de día.
export const TIPOS_DIA = [
  { id: 'habil', label: 'Hábil', corto: 'H' },
  { id: 'libre', label: 'No se trabaja', corto: '—' },
];

/** Etiqueta corta de un turno para la grilla: "Noche" se muestra TN, como en el Excel de P&T. */
export const etiquetaTurno = (nombre, abreviaturas = {}) =>
  nombre === 'Noche' ? 'TN' : nombre === 'Madrugada' ? 'Madr.' : abreviaturas[nombre] || nombre;

// desarrollo = estéril; preparación y cámara = mineral; fortificación sin toneladas
export const ACTIVIDADES = [
  { id: 'preparacion', label: 'Preparación', mineral: true },
  { id: 'camara', label: 'Cámara', mineral: true },
  { id: 'desarrollo', label: 'Desarrollo', mineral: false },
  { id: 'fortificacion', label: 'Fortificación', mineral: false, sinToneladas: true },
];
export const ACTIVIDAD = Object.fromEntries(ACTIVIDADES.map((a) => [a.id, a]));
export const esMineral = (actividad) => !!ACTIVIDAD[actividad]?.mineral;

export const diasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate();
export const diaSemana = (anio, mes, dia) => new Date(anio, mes - 1, dia).getDay();
export const esFinde = (anio, mes, dia) => [0, 6].includes(diaSemana(anio, mes, dia));

export const fmt = (v, dec = 0) =>
  v == null || Number.isNaN(v)
    ? '—'
    : Number(v).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Capacidad de una ruta en t/día: (60 ÷ ciclo) × dumpers × peso × horas. */
export const capacidadRuta = (r) =>
  r && +r.ciclo_min > 0 ? (60 / +r.ciclo_min) * (+r.dumpers || 0) * (+r.peso_ton || 0) * (+r.horas || 0) : 0;

/** Capacidad mina → cancha: solo las rutas que limitan lo que sale de la mina. */
export const capacidadFaena = (rutas = []) =>
  rutas.filter((r) => r.cuenta_capacidad !== false).reduce((s, r) => s + capacidadRuta(r), 0);

/**
 * Meta de perforación = Σ días trabajados × perforistas del día × tronaduras por
 * perforista × toneladas por disparo. Es el cálculo del Excel, pero día a día en
 * vez de tramos escritos a mano.
 */
export function metaPerforacion(dias = [], tonPorDisparo, tronadurasPorPerforista) {
  const trabajados = dias.filter((d) => d.tipo !== 'libre');
  const tronaduras = trabajados.reduce((s, d) => s + (+d.perforistas || 0) * (+tronadurasPorPerforista || 0), 0);
  return {
    trabajados: trabajados.length,
    // Días que tienen turno corto / turno largo entre sus turnos
    tc: trabajados.filter((d) => (d.turnos || []).includes('Turno corto')).length,
    tl: trabajados.filter((d) => (d.turnos || []).includes('Turno largo')).length,
    tronaduras,
    toneladas: tronaduras * (+tonPorDisparo || 0),
  };
}

/** Toneladas planificadas de un frente del plan (celdas como array). */
export const toneladasFrente = (f, hastaDia = 99) =>
  (f.celdas || []).reduce((s, c) => s + (c.dia <= hastaDia ? +c.toneladas || 0 : 0), 0);
