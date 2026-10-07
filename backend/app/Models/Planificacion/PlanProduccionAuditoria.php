<?php

namespace App\Models\Planificacion;

use Illuminate\Database\Eloquent\Model;

class PlanProduccionAuditoria extends Model
{
    protected $table = 'plan_produccion_auditoria';
    public const UPDATED_AT = null;
    protected $fillable = ['plan_id', 'accion', 'motivo', 'snapshot', 'cambios', 'usuario_id', 'usuario'];
    protected $casts = ['snapshot' => 'array', 'cambios' => 'array'];
    protected $hidden = ['snapshot'];
}
