<?php

namespace App\Models\Explosivos;

use App\Models\Ingenieria\FrenteTrabajo;
use App\Models\Ingenieria\TipoFrente;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LineaReportePerforacion extends Model
{
    use HasFactory;

    protected $table = 'lineas_reporte_perforacion';

    protected $fillable = [
        'id_reporte',
        'id_frente_trabajo',
        'id_personal',
        'id_tipo_frente',
        'seccion_ancho',
        'seccion_alto',
        'numero_tiros',
        'largo_perforacion',
        'barras_usadas',
        'material',
        'valores_editados',
        'observaciones',
    ];

    protected $casts = [
        'seccion_ancho' => 'decimal:2',
        'seccion_alto' => 'decimal:2',
        'numero_tiros' => 'integer',
        'largo_perforacion' => 'decimal:2',
        'barras_usadas' => 'array',
        'valores_editados' => 'boolean',
    ];

    // RELACIONES

    public function reporte()
    {
        return $this->belongsTo(ReportePerforacion::class, 'id_reporte');
    }

    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }

    public function personal()
    {
        return $this->belongsTo(PersonalAutorizadoExplosivos::class, 'id_personal');
    }

    public function tipoFrente()
    {
        return $this->belongsTo(TipoFrente::class, 'id_tipo_frente');
    }

    public function explosivos()
    {
        return $this->hasMany(ExplosivoLineaReporte::class, 'id_linea_reporte');
    }

    // MÉTODOS DE NEGOCIO

    public function calcularExplosivos($idFaena)
    {
        $formulas = FormulaExplosivo::where('id_tipo_frente', $this->id_tipo_frente)
            ->where('id_faena', $idFaena)
            ->get();

        $resultados = [];
        foreach ($formulas as $formula) {
            $calculada = round($this->numero_tiros * $formula->factor, 2);
            $resultados[] = [
                'id_tipo_explosivo' => $formula->id_tipo_explosivo,
                'cantidad_calculada' => $calculada,
                'cantidad_final' => $calculada,
            ];
        }

        return $resultados;
    }
}
