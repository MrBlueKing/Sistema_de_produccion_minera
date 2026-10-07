<?php

namespace App\Models\Planificacion;

use Illuminate\Database\Eloquent\Model;

class PlanProduccionCelda extends Model
{
    protected $table = 'plan_produccion_celdas';
    public $timestamps = false;
    protected $fillable = ['plan_frente_id', 'dia', 'turno', 'toneladas'];
    protected $casts = ['dia' => 'integer', 'toneladas' => 'float'];
}
