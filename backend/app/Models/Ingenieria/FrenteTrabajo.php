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
        'id_faena',
        'estado',
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
     * Atributos por defecto
     */
    protected $attributes = [
        'estado' => 'activo',
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

    /**
     * Scope: Filtrar solo frentes activos
     */
    public function scopeActivos($query)
    {
        return $query->where('estado', 'activo');
    }

    /**
     * Scope: Filtrar por faena
     */
    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    /**
     * Accessor: Obtener nombre del estado
     */
    public function getEstadoNombreAttribute()
    {
        return $this->estado === 'activo' ? 'Activo' : 'Inactivo';
    }
}
