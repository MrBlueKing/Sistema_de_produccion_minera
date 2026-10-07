<?php

namespace App\Models\Planificacion;

use Illuminate\Database\Eloquent\Model;

class PlanProduccionRuta extends Model
{
    protected $table = 'plan_produccion_rutas';
    public $timestamps = false;
    protected $fillable = ['plan_id', 'nombre', 'ciclo_min', 'dumpers', 'peso_ton', 'horas', 'cuenta_capacidad', 'orden'];
    protected $casts = [
        'ciclo_min' => 'float', 'dumpers' => 'float', 'peso_ton' => 'float', 'horas' => 'float',
        'cuenta_capacidad' => 'boolean', 'orden' => 'integer',
    ];
}
