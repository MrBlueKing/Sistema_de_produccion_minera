<?php

namespace App\Models\Planificacion;

use Illuminate\Database\Eloquent\Model;

class PlanProduccionDia extends Model
{
    protected $table = 'plan_produccion_dias';
    public $timestamps = false;
    protected $fillable = ['plan_id', 'dia', 'tipo', 'perforistas', 'turnos'];
    protected $casts = ['dia' => 'integer', 'perforistas' => 'float', 'turnos' => 'array'];
}
