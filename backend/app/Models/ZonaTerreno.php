<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ZonaTerreno extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'zonas_terreno';

    protected $fillable = [
        'nombre',
        'color',
        'coordenadas',
        'descripcion',
        'activa',
        'id_faena',
    ];

    protected $casts = [
        'coordenadas' => 'array', // Convierte JSON a array automáticamente
        'activa' => 'boolean',
    ];

    /**
     * Relación: una zona puede tener muchas dumpadas
     */
    public function dumpadas()
    {
        return $this->hasMany(\App\Models\Dispatch\Dumpada::class, 'zona_id');
    }

    /**
     * Scope: Solo zonas activas
     */
    public function scopeActivas($query)
    {
        return $query->where('activa', true);
    }

    /**
     * Calcular área del polígono (opcional, para estadísticas)
     */
    public function calcularArea()
    {
        if (!$this->coordenadas || count($this->coordenadas) < 3) {
            return 0;
        }

        // Fórmula del área de polígono (Shoelace formula)
        $area = 0;
        $coords = $this->coordenadas;
        $n = count($coords);

        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $area += $coords[$i]['x'] * $coords[$j]['y'];
            $area -= $coords[$j]['x'] * $coords[$i]['y'];
        }

        return abs($area / 2);
    }
}
