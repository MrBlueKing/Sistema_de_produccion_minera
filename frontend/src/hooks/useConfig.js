import { useState, useEffect, useCallback } from 'react';
import configuracionService from '../services/configuracion';

/**
 * Hook para obtener configuraciones del sistema
 * Soporta configuraciones por faena con fallback a global
 *
 * @param {number|null} idFaena - ID de faena para obtener config específica (opcional)
 * @returns {Object} { factorAjusteLey, factorRemanenteVisual, toneladas_por_palada, tonelajeDumpadaDefault, usarSistemaAcopios, loading, error, recargar, actualizarTonelaje }
 */
export function useConfig(idFaena = null) {
  const [config, setConfig] = useState({
    factorAjusteLey: 0.9, // Valor por defecto
    factorRemanenteVisual: 1.11, // Valor por defecto
    toneladas_por_palada: 1.82, // Valor por defecto
    tonelajeDumpadaDefault: 4.6, // Valor por defecto
    leyCappingMaximo: 3, // Valor por defecto
    usarSistemaAcopios: false, // Por defecto FALSE (usar dumpadas directas)
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await configuracionService.getAll(idFaena);
      setConfig({
        factorAjusteLey: data.factor_ajuste_ley || 0.9,
        factorRemanenteVisual: data.factor_remanente_visual || 1.11,
        toneladas_por_palada: data.toneladas_por_palada || 1.82,
        tonelajeDumpadaDefault: data.tonelaje_dumpada_default || 4.6,
        leyCappingMaximo: data.ley_capping_maximo || 3,
        usarSistemaAcopios: data.usar_sistema_acopios || false,
      });
    } catch (err) {
      console.error('Error cargando configuracion:', err);
      setError(err);
      // Mantener valores por defecto en caso de error
    } finally {
      setLoading(false);
    }
  }, [idFaena]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * Actualizar el tonelaje de dumpada para una faena específica
   * @param {number} nuevoValor - Nuevo valor de tonelaje
   * @param {number|null} faenaId - ID de faena (null = global)
   */
  const actualizarTonelaje = useCallback(async (nuevoValor, faenaId = null) => {
    try {
      await configuracionService.update('tonelaje_dumpada_default', nuevoValor, faenaId);
      // Limpiar cache y recargar
      configuracionService.clearCache();
      await loadConfig();
      return { success: true };
    } catch (err) {
      console.error('Error actualizando tonelaje:', err);
      return { success: false, error: err };
    }
  }, [loadConfig]);

  /**
   * Forzar recarga de configuraciones
   */
  const recargar = useCallback(async () => {
    configuracionService.clearCache();
    await loadConfig();
  }, [loadConfig]);

  return {
    ...config,
    loading,
    error,
    recargar,
    actualizarTonelaje,
  };
}
