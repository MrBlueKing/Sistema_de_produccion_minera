<?php

namespace App\Models\Dispatch;

use Illuminate\Database\Eloquent\Model;

/** Estado de un dumper en la jornada de un Report CyT (las horas fuera de servicio se restan de las operativas). */
class ReporteCytDumper extends Model
{
    public const ESTADOS = ['Operativo', 'Mantención', 'Falla', 'Sin operador', 'Otro'];

    protected $table = 'reporte_cyt_dumpers';

    protected $fillable = ['id_reporte', 'id_dumper', 'nombre_dumper', 'estado', 'horas_fuera', 'motivo'];

    protected $casts = [
        'horas_fuera' => 'float',
    ];
}
