<?php

namespace App\Models\Ingenieria;

use App\Models\Dispatch\Dumpada;
use Illuminate\Database\Eloquent\Model;

class FrenteTrabajo extends Model
{
    /**
     * Nombre de la tabla
     */
    protected $table = 'frentes_trabajo';

    /**
     * Atributos asignables en masa
     */
    protected $fillable = [
        'nombre',
        'id_tipo_frente',
    ];

    /**
     * Relación: Un frente de trabajo pertenece a un tipo de frente
     */
    public function tipoFrente()
    {
        return $this->belongsTo(TipoFrente::class, 'id_tipo_frente');
    }

    public function dumpadas()
    {
        return $this->hasMany(Dumpada::class, 'id_frente_trabajo');
    }
}
