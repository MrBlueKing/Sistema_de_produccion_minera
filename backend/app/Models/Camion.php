<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Camion extends Model
{
    use HasFactory;

    protected $table = 'camiones';

    protected $fillable = [
        'patente',
        'nombre',
        'categoria',
        'tonelaje',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'tonelaje' => 'decimal:2',
    ];

    /**
     * Scope: camiones activos
     */
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
