<?php

namespace App\Models\Planificacion;

use App\Models\Jornada;
use Illuminate\Database\Eloquent\Model;

/**
 * Programa de producción de una faena para un mes (ver migración
 * 2026_10_07_100000_create_planes_produccion_tables).
 */
class PlanProduccion extends Model
{
    public const BORRADOR  = 'borrador';
    public const PUBLICADO = 'publicado';

    // Hábil = se trabaja (con los turnos que tenga ese día) / libre = no se trabaja.
    // Turno corto y turno largo son turnos del día, no tipos de día.
    public const TIPOS_DIA   = ['habil', 'libre'];
    public const TURNOS_POR_DEFECTO = ['AM', 'PM'];
    // desarrollo = estéril; preparación y cámara = mineral; fortificación sin toneladas
    public const ACTIVIDADES = ['preparacion', 'camara', 'desarrollo', 'fortificacion'];
    public const ACTIVIDADES_MINERAL = ['preparacion', 'camara'];

    protected $table = 'planes_produccion';

    protected $fillable = [
        'id_faena', 'anio', 'mes', 'estado', 'ton_por_disparo', 'tronaduras_por_perforista',
        'observaciones', 'creado_por_id', 'creado_por', 'publicado_en', 'publicado_por',
    ];

    protected $casts = [
        'id_faena'                  => 'integer',
        'anio'                      => 'integer',
        'mes'                       => 'integer',
        'ton_por_disparo'           => 'float',
        'tronaduras_por_perforista' => 'float',
        'publicado_en'              => 'datetime',
    ];

    /**
     * Turnos que se pueden planificar: TODAS las jornadas activas de Configuración
     * General (sin mirar en qué formularios están prendidas), en su orden. Mismos
     * nombres que dumpadas.jornada y reportes_perforacion.turno, así Plan vs Real
     * compara directo. "Noche" es el "TN" del Excel.
     */
    public static function turnosDisponibles()
    {
        return Jornada::ordenadas()->where('activa', true)->values()
            ->map(fn ($j) => ['nombre' => $j->nombre, 'abreviatura' => $j->abreviatura, 'color' => $j->color]);
    }

    public function dias()
    {
        return $this->hasMany(PlanProduccionDia::class, 'plan_id')->orderBy('dia');
    }

    public function frentes()
    {
        return $this->hasMany(PlanProduccionFrente::class, 'plan_id')->orderBy('orden')->orderBy('id');
    }

    public function rutas()
    {
        return $this->hasMany(PlanProduccionRuta::class, 'plan_id')->orderBy('orden')->orderBy('id');
    }

    public function auditoria()
    {
        return $this->hasMany(PlanProduccionAuditoria::class, 'plan_id')->orderByDesc('id');
    }

    public function estaPublicado(): bool
    {
        return $this->estado === self::PUBLICADO;
    }

    /** Todo lo necesario para mostrarlo (o guardar la foto al reabrir). */
    public function cargarCompleto(): self
    {
        return $this->load(['dias', 'frentes.celdas', 'frentes.frenteTrabajo:id,codigo_completo,id_faena,estado', 'rutas', 'auditoria']);
    }

    public static function esMineral(string $actividad): bool
    {
        return in_array($actividad, self::ACTIVIDADES_MINERAL, true);
    }
}
