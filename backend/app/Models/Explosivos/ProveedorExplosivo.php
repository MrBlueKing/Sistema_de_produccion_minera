<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProveedorExplosivo extends Model
{
    use HasFactory;

    protected $table = 'proveedores_explosivos';

    protected $fillable = [
        'nombre',
        'rut',
        'direccion',
        'telefono',
        'contacto',
        'activo',
        'id_faena',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
