<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Model;

class AuditoriaReportePerforacion extends Model
{
    protected $table = 'auditoria_reportes_perforacion';

    protected $fillable = [
        'id_reporte',
        'accion',
        'usuario',
        'user_id',
        'cambios',
        'observaciones',
    ];

    protected $casts = [
        'cambios' => 'array',
    ];

    public function reporte()
    {
        return $this->belongsTo(ReportePerforacion::class, 'id_reporte');
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }
}
