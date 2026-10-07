import { useEffect, useMemo, useState } from 'react';
import jornadasService from '../services/jornadas';

// Mientras carga (o si la API falla) se usan las 4 de siempre, para que ningún
// formulario quede con la lista vacía.
const RESPALDO = [
  { nombre: 'AM', abreviatura: 'AM', color: '#2a78d6', activa: true, formularios: ['dumpadas', 'perforacion', 'cyt'] },
  { nombre: 'PM', abreviatura: 'PM', color: '#eb6834', activa: true, formularios: ['dumpadas', 'perforacion', 'cyt'] },
  { nombre: 'Noche', abreviatura: 'Noche', color: '#1baf7a', activa: true, formularios: ['dumpadas', 'perforacion', 'cyt'] },
  { nombre: 'Madrugada', abreviatura: 'Madrugada', color: '#eda100', activa: true, formularios: ['dumpadas', 'perforacion', 'cyt'] },
];

/**
 * Jornadas de un formulario ('dumpadas' | 'perforacion' | 'cyt'), desde Configuración General.
 *
 * - `nombres`: las que se pueden elegir hoy (activas) → selects de los formularios.
 * - `nombresFiltro`: también las apagadas → filtros y listados, que pueden tener
 *   registros antiguos con una jornada que ya no se ofrece.
 * - `color(nombre)`: color configurado, o null.
 */
export default function useJornadas(formulario) {
  const [todas, setTodas] = useState(RESPALDO);

  useEffect(() => {
    let vivo = true;
    jornadasService.getTodas()
      .then((res) => { if (vivo && res?.success) setTodas(res.data); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  return useMemo(() => {
    const delForm = formulario ? todas.filter((j) => (j.formularios || []).includes(formulario)) : todas;
    const activas = delForm.filter((j) => j.activa);
    const colores = Object.fromEntries(todas.map((j) => [j.nombre, j.color]));
    return {
      jornadas: activas,
      nombres: activas.map((j) => j.nombre),
      nombresFiltro: delForm.map((j) => j.nombre),
      color: (nombre) => colores[nombre] || null,
    };
  }, [todas, formulario]);
}
