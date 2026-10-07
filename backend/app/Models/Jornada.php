<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * Jornada/turno configurable desde Configuración General.
 * `formularios` = dónde se ofrece: 'cyt' (Report CyT), 'dumpadas' (Ingreso/edición de dumpadas,
 * y los filtros de Dispatch y Laboratorio) y 'perforacion' (reporte de P&T).
 */
class Jornada extends Model
{
    public const FORMULARIOS = ['dumpadas', 'perforacion', 'cyt'];

    protected $table = 'jornadas';

    protected $fillable = ['nombre', 'abreviatura', 'color', 'orden', 'activa', 'formularios'];

    protected $casts = [
        'activa'      => 'boolean',
        'formularios' => 'array',
        'orden'       => 'integer',
    ];

    public static function ordenadas(): Collection
    {
        return self::orderBy('orden')->orderBy('id')->get();
    }

    /** Las que se pueden elegir hoy en ese formulario. */
    public static function activasPara(string $formulario): Collection
    {
        return self::ordenadas()->filter(fn($j) => $j->activa && in_array($formulario, $j->formularios ?? []))->values();
    }

    /**
     * Regla de validación del campo jornada/turno de un formulario. `$actual` es el
     * valor ya guardado al editar: se acepta aunque esa jornada se haya apagado
     * después, para no bloquear la edición de registros antiguos.
     */
    public static function regla(string $formulario, ?string $actual = null)
    {
        $nombres = self::activasPara($formulario)->pluck('nombre');
        if ($actual !== null && $actual !== '') {
            $nombres->push($actual);
        }
        return Rule::in($nombres->unique()->all());
    }

    /** Todas las que existen (sin importar si están activas): para acopios, que heredan la jornada de sus dumpadas. */
    public static function reglaExistente()
    {
        return Rule::in(self::pluck('nombre')->all());
    }

    /** Abreviatura para códigos; si la jornada no existe en la tabla, el nombre tal cual. */
    public static function abreviatura(?string $nombre): ?string
    {
        if ($nombre === null) {
            return null;
        }
        return self::where('nombre', $nombre)->value('abreviatura') ?? $nombre;
    }

    /**
     * Texto libre de un Excel ("am", "MADRUGADA", "tc") → nombre de la jornada.
     * Compara contra nombre y abreviatura sin importar mayúsculas.
     */
    public static function normalizar(?string $texto, string $porDefecto = 'AM'): string
    {
        $t = mb_strtoupper(trim((string) $texto));
        foreach (self::ordenadas() as $j) {
            if (mb_strtoupper($j->nombre) === $t || mb_strtoupper($j->abreviatura) === $t) {
                return $j->nombre;
            }
        }
        return $porDefecto;
    }
}
