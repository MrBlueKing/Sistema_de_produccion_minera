import { useState, useEffect } from 'react';

/**
 * Hook personalizado para debounce
 * Retrasa la actualización de un valor hasta que el usuario deje de escribir
 *
 * @param {any} value - Valor a hacer debounce
 * @param {number} delay - Tiempo de espera en milisegundos (default: 500ms)
 * @returns {any} - Valor con debounce aplicado
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   // Esta función solo se ejecuta después de 500ms de que el usuario deje de escribir
 *   fetchData(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Establece un temporizador para actualizar el valor después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpia el temporizador si value o delay cambian antes de que se cumpla el timeout
    // Esto previene que el valor se actualice si el usuario sigue escribiendo
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
