<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PuntoTransbordo extends Model
{
    use HasFactory;

    protected $table = 'puntos_transbordo';

    protected $fillable = [
        'nombre',
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

    public function camionadas()
    {
        return $this->hasMany(Camionada::class, 'punto_transbordo_id');
    }
}
