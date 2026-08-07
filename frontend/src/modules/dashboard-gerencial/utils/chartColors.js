/**
 * Paleta categórica única para todos los gráficos del Dashboard Gerencial.
 * Orden fijo, validado contra daltonismo (skill dataviz, modo claro —
 * este dashboard no tiene modo oscuro): peor par adyacente CVD ΔE 9.1,
 * visión normal ΔE 19.6. No ciclar ni generar tonos nuevos más allá de 8.
 */
export const CATEGORICAL = [
  '#2a78d6', // azul
  '#eb6834', // naranjo
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
];

export const GRAY_OTHER = '#6b7280';

const MAX_COLORED = 7; // el 8vo tono queda de reserva; sobre 7 frentes, el resto va a "Otros"

/**
 * Devuelve un asignador de color por frente con memoria propia: la primera
 * vez que ve un frente le asigna el siguiente tono libre y lo recuerda para
 * siempre — así su color no cambia si después queda fuera de un filtro y
 * vuelve a aparecer, ni si otros frentes entran o salen de la lista
 * (evita "recolor-on-filter": los sobrevivientes no cambian de color).
 * Crear UNA instancia por componente (ej. con useRef) y compartirla entre
 * todos los gráficos del dashboard que coloreen por frente.
 */
export function crearAsignadorDeFrentes() {
  const mapa = {};
  let siguiente = 0;
  return function obtenerColorFrente(frente) {
    if (mapa[frente]) return mapa[frente];
    const color = siguiente < MAX_COLORED ? CATEGORICAL[siguiente++] : GRAY_OTHER;
    mapa[frente] = color;
    return color;
  };
}
