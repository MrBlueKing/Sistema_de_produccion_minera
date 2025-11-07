<?php

namespace App\Models\Dispatch;

use Illuminate\Database\Eloquent\Model;

class Rango extends Model
{
    protected $fillable = [
        'nomenclatura',
        'limite_inferior',
        'limite_superior',
        'amplitud',
        'descripcion',
        'orden',
    ];

    protected $casts = [
        'limite_inferior' => 'decimal:2',
        'limite_superior' => 'decimal:2',
        'amplitud' => 'decimal:2',
        'orden' => 'integer',
    ];

    /**
     * Obtener el rango correspondiente a una ley específica
     *
     * @param float $ley
     * @return Rango|null
     */
    public static function obtenerRangoPorLey($ley)
    {
        return self::where('limite_inferior', '<=', $ley)
                   ->where('limite_superior', '>=', $ley)
                   ->first();
    }

    /**
     * Obtener todos los rangos ordenados
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public static function obtenerRangosOrdenados()
    {
        return self::orderBy('orden', 'asc')->get();
    }
}
