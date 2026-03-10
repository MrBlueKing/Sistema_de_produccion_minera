<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExplosivoLineaReporte extends Model
{
    use HasFactory;

    protected $table = 'explosivos_linea_reporte';

    protected $fillable = [
        'id_linea_reporte',
        'id_tipo_explosivo',
        'cantidad_calculada',
        'cantidad_final',
    ];

    protected $casts = [
        'cantidad_calculada' => 'decimal:2',
        'cantidad_final' => 'decimal:2',
    ];

    public function lineaReporte()
    {
        return $this->belongsTo(LineaReportePerforacion::class, 'id_linea_reporte');
    }

    public function tipoExplosivo()
    {
        return $this->belongsTo(TipoExplosivo::class, 'id_tipo_explosivo');
    }
}
