// Revisión de la Hora CyT de una dumpada contra un momento de referencia
// (en Ciclos del Dumper, la hora en que se registró: created_at). Detecta los
// dos errores que aparecieron en los datos reales (05-10-2026):
//  - 'futura': la vuelta queda después del momento en que se registra, lo que
//    es imposible (13976: CyT 08:48, registrada 08:40);
//  - 'am_pm': la hora queda ~12 h antes del registro y sumándole 12 h calza
//    con él — se tipeó en formato de 12 h (13990: "02:09" registrada 14:18,
//    era 14:09).
// Madrugada: si la Fecha CyT es de un día anterior al de la referencia y la
// hora es antes de las 06:00, se lee como la madrugada que sigue a esa fecha
// (la Madrugada se anota en la página de la hoja del día anterior).

const TOLERANCIA_MIN = 5;        // reloj del PC / segundos de diferencia
const VENTANA_AM_PM_MIN = 90;    // registro hasta 1,5 h después de la hora corregida
const FIN_MADRUGADA = 6;

const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aMinutos = (fecha, hora) => Date.parse(`${fecha}T${hora.slice(0, 5)}:00`) / 60000;

/**
 * @param {string} fechaCyt   YYYY-MM-DD
 * @param {string} horaCyt    HH:MM o HH:MM:SS
 * @param {Date|string} referencia  Date, o 'YYYY-MM-DD HH:MM:SS' (created_at)
 * @returns {null | { tipo: 'futura'|'am_pm', referencia: string, sugerencia?: string }}
 */
export function revisarHoraCyt(fechaCyt, horaCyt, referencia) {
  if (!fechaCyt || !horaCyt || !referencia) return null;
  const refDate = referencia instanceof Date ? referencia : new Date(String(referencia).replace(' ', 'T'));
  const ref = refDate.getTime() / 60000;
  if (Number.isNaN(ref)) return null;
  const refHora = `${pad(refDate.getHours())}:${pad(refDate.getMinutes())}`;

  const h = +horaCyt.slice(0, 2);
  let vuelta = aMinutos(fechaCyt, horaCyt);
  if (Number.isNaN(vuelta)) return null;
  if (h < FIN_MADRUGADA && fechaCyt < isoLocal(refDate)) vuelta += 24 * 60;

  if (h < 12 && ref - vuelta > 6 * 60) {
    const sugerencia = `${pad(h + 12)}:${horaCyt.slice(3, 5)}`;
    const desfase = ref - aMinutos(fechaCyt, sugerencia);
    if (desfase >= -TOLERANCIA_MIN && desfase <= VENTANA_AM_PM_MIN) {
      return { tipo: 'am_pm', referencia: refHora, sugerencia };
    }
  }
  if (vuelta > ref + TOLERANCIA_MIN) return { tipo: 'futura', referencia: refHora };
  return null;
}
