<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class ConfiguracionSistema extends Model
{
    protected $table = 'configuraciones_sistema';

    protected $fillable = [
        'clave',
        'id_faena',
        'valor',
        'tipo',
        'descripcion',
        'updated_by',
    ];

    /**
     * Obtener valor de configuración con cache
     * Soporta configuraciones por faena con fallback a global
     *
     * @param string $clave
     * @param mixed $default Valor por defecto si no existe
     * @param int|null $idFaena ID de faena (null = buscar global)
     * @return mixed
     */
    public static function obtener($clave, $default = null, $idFaena = null)
    {
        $cacheKey = "config_{$clave}" . ($idFaena ? "_{$idFaena}" : "_global");

        return Cache::remember($cacheKey, 3600, function () use ($clave, $default, $idFaena) {
            // 1. Si se especifica faena, buscar config específica primero
            if ($idFaena) {
                $configFaena = self::where('clave', $clave)
                    ->where('id_faena', $idFaena)
                    ->first();

                if ($configFaena) {
                    return self::convertirValor($configFaena->valor, $configFaena->tipo);
                }
            }

            // 2. Fallback: buscar config global (id_faena = null)
            $configGlobal = self::where('clave', $clave)
                ->whereNull('id_faena')
                ->first();

            if ($configGlobal) {
                return self::convertirValor($configGlobal->valor, $configGlobal->tipo);
            }

            return $default;
        });
    }

    /**
     * Establecer valor de configuración y limpiar cache
     * Soporta configuraciones por faena
     *
     * @param string $clave
     * @param mixed $valor
     * @param int|null $userId
     * @param int|null $idFaena ID de faena (null = configuración global)
     * @return bool
     */
    public static function establecer($clave, $valor, $userId = null, $idFaena = null)
    {
        $config = self::updateOrCreate(
            ['clave' => $clave, 'id_faena' => $idFaena],
            [
                'valor' => (string) $valor,
                'updated_by' => $userId,
            ]
        );

        // Limpiar cache específico
        $cacheKey = "config_{$clave}" . ($idFaena ? "_{$idFaena}" : "_global");
        Cache::forget($cacheKey);

        // También limpiar cache de "todas las configuraciones" si existe
        Cache::forget('configuraciones_todas');
        if ($idFaena) {
            Cache::forget("configuraciones_todas_{$idFaena}");
        }

        return $config->wasRecentlyCreated || $config->wasChanged();
    }

    /**
     * Convertir valor según su tipo (interno)
     */
    protected static function convertirValor($valor, $tipo)
    {
        return self::convertirValorPublic($valor, $tipo);
    }

    /**
     * Convertir valor según su tipo (público)
     *
     * @param mixed $valor
     * @param string $tipo
     * @return mixed
     */
    public static function convertirValorPublic($valor, $tipo)
    {
        switch ($tipo) {
            case 'number':
                return (float) $valor;
            case 'boolean':
                return filter_var($valor, FILTER_VALIDATE_BOOLEAN);
            case 'json':
                return json_decode($valor, true);
            default:
                return $valor;
        }
    }

    /**
     * Limpiar todo el cache de configuraciones
     */
    public static function limpiarCache()
    {
        $configs = self::all();
        foreach ($configs as $config) {
            $cacheKey = "config_{$config->clave}" . ($config->id_faena ? "_{$config->id_faena}" : "_global");
            Cache::forget($cacheKey);
        }
        Cache::forget('configuraciones_todas');
    }

    /**
     * Obtener todas las configuraciones del sistema como array clave => valor
     * Soporta obtener configuraciones específicas de una faena con fallback a globales
     *
     * @param int|null $idFaena ID de faena para obtener configs específicas
     * @return array
     */
    public static function obtenerTodas($idFaena = null)
    {
        $cacheKey = $idFaena ? "configuraciones_todas_{$idFaena}" : 'configuraciones_todas';

        return Cache::remember($cacheKey, 3600, function () use ($idFaena) {
            $resultado = [];

            // Primero obtener todas las globales
            $configsGlobales = self::whereNull('id_faena')->get();
            foreach ($configsGlobales as $config) {
                $resultado[$config->clave] = self::convertirValor($config->valor, $config->tipo);
            }

            // Si hay faena, sobrescribir con las específicas
            if ($idFaena) {
                $configsFaena = self::where('id_faena', $idFaena)->get();
                foreach ($configsFaena as $config) {
                    $resultado[$config->clave] = self::convertirValor($config->valor, $config->tipo);
                }
            }

            return $resultado;
        });
    }

    /**
     * Verificar si el sistema de acopios está activado
     *
     * @return bool
     */
    public static function usarSistemaAcopios()
    {
        return self::obtener('usar_sistema_acopios', false);
    }
}
