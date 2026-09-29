<?php

namespace App\Models\Dispatch;

use Illuminate\Database\Eloquent\Model;

/**
 * Operador autorizado para aparecer en el Ingreso de Dumpadas de una faena.
 * id_personal_externo = personal_interno.id_personal_interno del sistema de
 * Petróleo — es el mismo valor que se guarda en dumpadas.id_operador.
 */
class OperadorAutorizado extends Model
{
    protected $table = 'operadores_autorizados_dispatch';

    protected $fillable = [
        'id_personal_externo',
        'rut',
        'nombre',
        'cargo',
        'id_faena',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
