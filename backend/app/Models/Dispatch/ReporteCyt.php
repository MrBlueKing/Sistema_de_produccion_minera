<?php

namespace App\Models\Dispatch;

use Illuminate\Database\Eloquent\Model;

/**
 * Report de Ciclo Carguío y Transporte: hoja del Supervisor CyT en la pala
 * (mina → Parrilla A), una por faena + fecha + jornada.
 */
class ReporteCyt extends Model
{
    public const ESTADO_BORRADOR = 'borrador';
    public const ESTADO_GUARDADO = 'guardado';

    protected $table = 'reportes_cyt';

    protected $fillable = [
        'id_faena', 'fecha', 'jornada', 'supervisor_id', 'supervisor_nombre', 'estado', 'observaciones',
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
    ];

    public function cargas()
    {
        return $this->hasMany(ReporteCytCarga::class, 'id_reporte')->orderBy('orden');
    }

    public function dumpers()
    {
        return $this->hasMany(ReporteCytDumper::class, 'id_reporte')->orderBy('nombre_dumper');
    }
}
