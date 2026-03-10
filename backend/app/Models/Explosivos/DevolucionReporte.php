<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DevolucionReporte extends Model
{
    use HasFactory;

    protected $table = 'devoluciones_reporte';

    protected $fillable = [
        'id_reporte',
        'id_tipo_explosivo',
        'cantidad',
        'id_personal',
        'motivo',
        'id_movimiento',
    ];

    protected $casts = [
        'cantidad' => 'decimal:2',
    ];

    public function reporte()
    {
        return $this->belongsTo(ReportePerforacion::class, 'id_reporte');
    }

    public function tipoExplosivo()
    {
        return $this->belongsTo(TipoExplosivo::class, 'id_tipo_explosivo');
    }

    public function personal()
    {
        return $this->belongsTo(PersonalAutorizadoExplosivos::class, 'id_personal');
    }

    public function movimiento()
    {
        return $this->belongsTo(MovimientoExplosivo::class, 'id_movimiento');
    }
}
