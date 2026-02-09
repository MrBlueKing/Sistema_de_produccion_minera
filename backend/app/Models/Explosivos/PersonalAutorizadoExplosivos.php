<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PersonalAutorizadoExplosivos extends Model
{
    use HasFactory;

    protected $table = 'personal_autorizado_explosivos';

    protected $fillable = [
        'id_personal_externo',
        'rut',
        'nombre',
        'apellido',
        'cargo',
        'id_faena',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    /**
     * Atributo calculado: nombre completo
     */
    public function getNombreCompletoAttribute(): string
    {
        return trim($this->nombre . ' ' . ($this->apellido ?? ''));
    }

    /**
     * Scope: filtrar por faena
     */
    public function scopePorFaena($query, $idFaena)
    {
        return $query->where('id_faena', $idFaena);
    }

    /**
     * Scope: solo activos
     */
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    /**
     * Relación con movimientos (como entregado_por)
     */
    public function movimientosEntregados()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_personal_entrega', 'id');
    }

    /**
     * Relación con movimientos (como recibido_por)
     */
    public function movimientosRecibidos()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_personal_recibe', 'id');
    }
}
