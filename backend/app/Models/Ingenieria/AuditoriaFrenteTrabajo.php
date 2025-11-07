<?php

namespace App\Models\Ingenieria;

use Illuminate\Database\Eloquent\Model;

class AuditoriaFrenteTrabajo extends Model
{
    /**
     * Nombre de la tabla
     */
    protected $table = 'auditoria_frentes_trabajo';

    /**
     * Atributos asignables en masa
     */
    protected $fillable = [
        'id_frente_trabajo',
        'accion',
        'usuario',
        'datos_anteriores',
        'datos_nuevos',
        'observaciones',
    ];

    /**
     * Atributos que deben ser casteados a tipos nativos
     */
    protected $casts = [
        'datos_anteriores' => 'array',
        'datos_nuevos' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relación: Una auditoría pertenece a un frente de trabajo
     */
    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }

    /**
     * Registrar un cambio en el historial
     */
    public static function registrar($idFrente, $accion, $datosAnteriores = null, $datosNuevos = null, $usuario = 'Sistema', $observaciones = null)
    {
        return self::create([
            'id_frente_trabajo' => $idFrente,
            'accion' => $accion,
            'usuario' => $usuario,
            'datos_anteriores' => $datosAnteriores,
            'datos_nuevos' => $datosNuevos,
            'observaciones' => $observaciones,
        ]);
    }

    /**
     * Obtener cambios de un campo específico
     */
    public function getCambio($campo)
    {
        $anterior = $this->datos_anteriores[$campo] ?? null;
        $nuevo = $this->datos_nuevos[$campo] ?? null;

        if ($anterior === $nuevo) {
            return null; // No hubo cambio
        }

        return [
            'campo' => $campo,
            'anterior' => $anterior,
            'nuevo' => $nuevo,
        ];
    }

    /**
     * Obtener todos los cambios
     */
    public function getTodosCambios()
    {
        if (!$this->datos_anteriores || !$this->datos_nuevos) {
            return [];
        }

        $cambios = [];
        $campos = array_unique(array_merge(
            array_keys($this->datos_anteriores),
            array_keys($this->datos_nuevos)
        ));

        foreach ($campos as $campo) {
            $cambio = $this->getCambio($campo);
            if ($cambio) {
                $cambios[] = $cambio;
            }
        }

        return $cambios;
    }
}
