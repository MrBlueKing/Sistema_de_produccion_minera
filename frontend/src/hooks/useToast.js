import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/**
 * Hook para utilizar el sistema de notificaciones Toast
 *
 * @returns {object} Objeto con métodos para mostrar toasts
 * - success(message, description?) - Muestra toast de éxito
 * - error(message, description?) - Muestra toast de error
 * - warning(message, description?) - Muestra toast de advertencia
 * - info(message, description?) - Muestra toast de información
 *
 * @example
 * const toast = useToast();
 * toast.success('¡Operación exitosa!', 'Los datos se guardaron correctamente');
 * toast.error('Error al guardar', 'Por favor intente nuevamente');
 */
export default function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast debe ser usado dentro de un ToastProvider');
  }

  return context;
}
