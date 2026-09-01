<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Model;

class Tarifa extends Model
{
    protected $fillable = [
        'mes',
        'anio',
        'tarifa_base',
        'escala',
        'fondo_estabilizacion',
        'ley_base',
        'iva_porcentaje',
        'observaciones',
    ];

    protected $casts = [
        'mes' => 'integer',
        'anio' => 'integer',
        'tarifa_base' => 'float',
        'escala' => 'float',
        'fondo_estabilizacion' => 'float',
        'ley_base' => 'float',
        'iva_porcentaje' => 'float',
    ];

    /**
     * Tarifa vigente para una fecha dada (mes/año calendario de esa fecha).
     * ENAMI define la vigencia por el mes en que se cierra el lote, no por
     * cuándo se liquida — ver Circular Nº 27, punto 1: "se aplicarán ...
     * a todos los ... lotes que se cierren a partir del mes que corresponda".
     */
    public static function vigentePara($fecha): ?self
    {
        if (!$fecha) {
            return null;
        }

        $fecha = \Carbon\Carbon::parse($fecha);

        return self::where('mes', $fecha->month)
            ->where('anio', $fecha->year)
            ->first();
    }
}
