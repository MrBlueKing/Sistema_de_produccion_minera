<?php

namespace App\Models\Dispatch;

use Illuminate\Database\Eloquent\Model;

/** Una carga en la pala dentro de un Report CyT. hora_llegada = llegada del dumper a la pala. */
class ReporteCytCarga extends Model
{
    protected $table = 'reporte_cyt_cargas';

    protected $fillable = [
        'id_reporte', 'orden', 'id_frente_trabajo', 'id_pala', 'nombre_pala', 'id_operador_pala',
        'nombre_operador_pala', 'hora_llegada', 'tiempo_carguio', 'paladas', 'id_dumper', 'nombre_dumper',
        'id_operador_dumper', 'nombre_operador_dumper',
    ];

    protected $casts = [
        'tiempo_carguio' => 'float',
        'paladas'        => 'integer',
    ];

    public function frenteTrabajo()
    {
        return $this->belongsTo(\App\Models\Ingenieria\FrenteTrabajo::class, 'id_frente_trabajo');
    }
}
