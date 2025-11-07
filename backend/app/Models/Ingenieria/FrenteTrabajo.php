<?php

namespace App\Models\Ingenieria;

use App\Models\Dispatch\Dumpada;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FrenteTrabajo extends Model
{
    use SoftDeletes;

    /**
     * Nombre de la tabla
     */
    protected $table = 'frentes_trabajo';

    /**
     * Atributos asignables en masa
     */
    protected $fillable = [
        'manto',
        'calle',
        'hebra',
        'numero_frente',
        'codigo_completo',
        'id_tipo_frente',
        'deleted_by',
        'deletion_reason',
    ];

    /**
     * Atributos que deben ser casteados a tipos nativos
     */
    protected $casts = [
        'deleted_at' => 'datetime',
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

    /**
     * Relación: Un frente tiene muchas auditorías
     */
    public function auditorias()
    {
        return $this->hasMany(AuditoriaFrenteTrabajo::class, 'id_frente_trabajo')->orderBy('created_at', 'desc');
    }
}
