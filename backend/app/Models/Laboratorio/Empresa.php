<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Empresa extends Model
{
    use HasFactory;

    protected $table = 'empresas';

    protected $fillable = [
        'nombre',
        'codigo',
        'rut',
        'contacto',
        'telefono',
        'email',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    /**
     * Relación: una empresa tiene muchos lotes
     */
    public function lotes()
    {
        return $this->hasMany(Lote::class, 'empresa_id');
    }

    /**
     * Scope: empresas activas
     */
    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }

    /**
     * Obtener lotes de esta empresa en una planta específica
     */
    public function getLotesEnPlanta($plantaId)
    {
        return $this->lotes()->where('planta_id', $plantaId)->get();
    }
}
