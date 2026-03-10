<?php

namespace App\Config;

use App\Models\ConfiguracionSistema;

/**
 * Configuración centralizada para cálculos de mezclas
 *
 * IMPORTANTE: El factor de ajuste ahora se lee desde la base de datos.
 * Para cambiarlo, ejecutar:
 * UPDATE configuraciones_sistema SET valor = '0.85' WHERE clave = 'factor_ajuste_ley';
 *
 * El valor por defecto (0.9) se usa solo si no existe en BD
 */
class MezclaConfig
{
    /**
     * Factor de ajuste por defecto (usado solo si no existe en BD)
     *
     * @var float
     */
    const FACTOR_AJUSTE_LEY_DEFAULT = 0.9;

    /**
     * Obtener factor de ajuste desde BD (con cache)
     *
     * Se usa en:
     * - Ley lab → ley_dump_ajustada (ley_lab × FACTOR)
     * - Ley visual → ley_dump_ajustada (SIN descuento, directo)
     * - Ley lab → ley_lote (ley_lab × FACTOR × FACTOR)
     * - Ley visual → ley_lote (ley_visual × FACTOR)
     *
     * @return float
     */
    public static function getFactorAjusteLey()
    {
        return ConfiguracionSistema::obtener('factor_ajuste_ley', self::FACTOR_AJUSTE_LEY_DEFAULT);
    }

    /**
     * Alias para compatibilidad - propiedad estática simulada
     * Uso: MezclaConfig::FACTOR_AJUSTE_LEY
     *
     * @deprecated Usar getFactorAjusteLey() para leer desde BD
     */
    const FACTOR_AJUSTE_LEY = self::FACTOR_AJUSTE_LEY_DEFAULT;

    /**
     * Factor por defecto para calcular ley visual de remanentes
     * (usado solo si no existe en BD)
     *
     * @var float
     */
    const FACTOR_REMANENTE_VISUAL_DEFAULT = 1.11;

    /**
     * Obtener factor para calcular ley visual de remanentes desde BD
     *
     * Se usa en:
     * - Remanentes: ley_visual = ley_lote × FACTOR (1.11 por defecto)
     *
     * @return float
     */
    public static function getFactorRemanenteVisual()
    {
        return ConfiguracionSistema::obtener('factor_remanente_visual', self::FACTOR_REMANENTE_VISUAL_DEFAULT);
    }
}
