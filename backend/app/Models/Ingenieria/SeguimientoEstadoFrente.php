<?php

namespace App\Models\Ingenieria;

use Illuminate\Database\Eloquent\Model;

class SeguimientoEstadoFrente extends Model
{
    protected $table = 'seguimiento_estado_frentes';

    protected $fillable = [
        'frente_trabajo_id',
        'ventilacion',
        'estabilidad',
        'duracion_estimada',
        'fecha_inicio_estimada',
        'fecha_inicio_real',
        'observaciones',
        'registrado_por',
    ];

    protected $casts = [
        'fecha_inicio_estimada' => 'date',
        'fecha_inicio_real'     => 'date',
        'ventilacion'           => 'integer',
        'duracion_estimada'     => 'integer',
    ];

    // Etiquetas legibles para estabilidad
    public const ESTABILIDAD_LABELS = [
        'FC' => 'Frente Cerrada',
        'PM' => 'PM',
        'AC' => 'Acuñadura',
        'CH' => 'CH',
        'FO' => 'Frente Observación',
    ];

    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'frente_trabajo_id');
    }

    // Desvío en días entre fecha estimada y real (positivo = atraso)
    public function getDesvioAttribute(): ?int
    {
        if (!$this->fecha_inicio_real) {
            return null;
        }
        return $this->fecha_inicio_estimada->diffInDays($this->fecha_inicio_real, false);
    }

    protected $appends = ['desvio'];
}
