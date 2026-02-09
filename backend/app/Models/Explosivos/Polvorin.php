<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Polvorin extends Model
{
    use HasFactory;

    protected $table = 'polvorines';

    protected $fillable = [
        'codigo',
        'nombre',
        'ubicacion',
        'capacidad_maxima_kg',
        'responsable',
        'telefono_responsable',
        'id_faena',
        'observaciones',
        'activo',
    ];

    protected $casts = [
        'capacidad_maxima_kg' => 'decimal:2',
        'activo' => 'boolean',
    ];

    /**
     * RELACIONES
     */
    public function lotes()
    {
        return $this->hasMany(LoteExplosivo::class, 'id_polvorin');
    }

    public function lotesActivos()
    {
        return $this->hasMany(LoteExplosivo::class, 'id_polvorin')
            ->where('estado', 'Activo');
    }

    public function stocks()
    {
        return $this->hasMany(StockExplosivo::class, 'id_polvorin');
    }

    public function movimientosOrigen()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_polvorin_origen');
    }

    public function movimientosDestino()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_polvorin_destino');
    }

    /**
     * SCOPES
     */
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    /**
     * MÉTODOS ESTÁTICOS
     */
    public static function generarCodigo($idFaena)
    {
        $año = Carbon::now()->year;
        $prefijo = "POL-{$idFaena}-";

        $ultimoNumero = self::where('codigo', 'like', $prefijo . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(codigo, " . (strlen($prefijo) + 1) . ") AS UNSIGNED)) as max_num")
            ->value('max_num');

        $nuevoNumero = ($ultimoNumero ?? 0) + 1;

        return $prefijo . str_pad($nuevoNumero, 3, '0', STR_PAD_LEFT);
    }

    /**
     * MÉTODOS DE NEGOCIO
     */
    public function getStockTotal()
    {
        return $this->stocks()->sum('cantidad');
    }

    public function getLotesProximosVencer($dias = 30)
    {
        return $this->lotesActivos()
            ->whereNotNull('fecha_vencimiento')
            ->where('fecha_vencimiento', '<=', Carbon::now()->addDays($dias))
            ->where('fecha_vencimiento', '>=', Carbon::now())
            ->with('tipoExplosivo:id,codigo,nombre')
            ->get();
    }

    public function getLotesVencidos()
    {
        return $this->lotes()
            ->whereNotNull('fecha_vencimiento')
            ->where('fecha_vencimiento', '<', Carbon::now())
            ->where('cantidad_actual', '>', 0)
            ->with('tipoExplosivo:id,codigo,nombre')
            ->get();
    }
}
