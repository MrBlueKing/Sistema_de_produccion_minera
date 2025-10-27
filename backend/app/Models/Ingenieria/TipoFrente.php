<?php

namespace App\Models\Ingenieria;

use Illuminate\Database\Eloquent\Model;

class TipoFrente extends Model
{
    /**
     * Nombre de la tabla
     */
    protected $table = 'tipos_frente';

    /**
     * Atributos asignables en masa
     */
    protected $fillable = [
        'nombre',
        'abreviatura',
    ];

    /**
     * Relación: Un tipo de frente tiene muchos frentes de trabajo
     */
    public function frentesTrabajo()
    {
        return $this->hasMany(FrenteTrabajo::class, 'id_tipo_frente');
    }
}
