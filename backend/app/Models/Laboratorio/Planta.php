<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Planta extends Model
{
    use HasFactory;

    protected $table = 'plantas';

    protected $fillable = [
        'nombre',
        'codigo',
        'prefijo_codigo',
        'descripcion',
        'direccion',
        'capacidad_diaria',
        'distancia_km',
        'id_faena',
        'id_empresa',
        'activo',
    ];

    protected $casts = [
        'capacidad_diaria' => 'decimal:2',
        'distancia_km' => 'decimal:2',
        'activo' => 'boolean',
    ];

    public function lotes()
    {
        return $this->hasMany(Lote::class, 'planta_id');
    }

    public function mezclas()
    {
        return $this->hasMany(Mezcla::class, 'planta_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }
}
