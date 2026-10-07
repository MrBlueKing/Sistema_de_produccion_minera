<?php

namespace App\Models\Planificacion;

use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Database\Eloquent\Model;

class PlanProduccionFrente extends Model
{
    protected $table = 'plan_produccion_frentes';
    public $timestamps = false;
    protected $fillable = ['plan_id', 'id_frente_trabajo', 'actividad', 'ley_esperada', 'orden'];
    protected $casts = ['id_frente_trabajo' => 'integer', 'ley_esperada' => 'float', 'orden' => 'integer'];

    public function celdas()
    {
        return $this->hasMany(PlanProduccionCelda::class, 'plan_frente_id')->orderBy('dia');
    }

    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo')->withTrashed();
    }
}
