<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TipoExplosivo extends Model
{
    use HasFactory;

    protected $table = 'tipos_explosivos';

    protected $fillable = [
        'codigo',
        'nombre',
        'id_categoria',
        'unidad_medida',
        'requiere_lote',
        'dias_alerta_vencimiento',
        'stock_minimo',
        'stock_maximo',
        'fabricante',
        'clasificacion_onu',
        'descripcion',
        'activo',
    ];

    protected $casts = [
        'requiere_lote' => 'boolean',
        'dias_alerta_vencimiento' => 'integer',
        'stock_minimo' => 'decimal:2',
        'stock_maximo' => 'decimal:2',
        'activo' => 'boolean',
    ];

    // Unidades de medida permitidas
    const UNIDAD_KG = 'kg';
    const UNIDAD_UNIDADES = 'unidades';
    const UNIDAD_METROS = 'metros';

    /**
     * RELACIONES
     */
    public function categoria()
    {
        return $this->belongsTo(CategoriaExplosivo::class, 'id_categoria');
    }

    public function lotes()
    {
        return $this->hasMany(LoteExplosivo::class, 'id_tipo_explosivo');
    }

    public function stocks()
    {
        return $this->hasMany(StockExplosivo::class, 'id_tipo_explosivo');
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_tipo_explosivo');
    }

    /**
     * SCOPES
     */
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopePorCategoria($query, $idCategoria)
    {
        if ($idCategoria) {
            return $query->where('id_categoria', $idCategoria);
        }
        return $query;
    }

    /**
     * MÉTODOS
     */
    public function getNombreCompletoAttribute()
    {
        return "{$this->codigo} - {$this->nombre}";
    }

    public function getUnidadAbreviadaAttribute()
    {
        $abreviaturas = [
            'kg' => 'kg',
            'unidades' => 'un',
            'metros' => 'm',
        ];
        return $abreviaturas[$this->unidad_medida] ?? $this->unidad_medida;
    }
}
