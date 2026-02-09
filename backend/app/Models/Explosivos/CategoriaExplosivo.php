<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CategoriaExplosivo extends Model
{
    use HasFactory;

    protected $table = 'categorias_explosivos';

    protected $fillable = [
        'nombre',
        'descripcion',
        'orden',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'orden' => 'integer',
    ];

    /**
     * RELACIONES
     */
    public function tiposExplosivos()
    {
        return $this->hasMany(TipoExplosivo::class, 'id_categoria');
    }

    /**
     * SCOPES
     */
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeOrdenado($query)
    {
        return $query->orderBy('orden')->orderBy('nombre');
    }
}
