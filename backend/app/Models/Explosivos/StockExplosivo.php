<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockExplosivo extends Model
{
    use HasFactory;

    protected $table = 'stock_explosivos';

    protected $fillable = [
        'id_polvorin',
        'id_tipo_explosivo',
        'cantidad',
        'cantidad_reservada',
        'id_faena',
    ];

    protected $casts = [
        'cantidad' => 'decimal:2',
        'cantidad_reservada' => 'decimal:2',
    ];

    /**
     * RELACIONES
     */
    public function polvorin()
    {
        return $this->belongsTo(Polvorin::class, 'id_polvorin');
    }

    public function tipoExplosivo()
    {
        return $this->belongsTo(TipoExplosivo::class, 'id_tipo_explosivo');
    }

    /**
     * SCOPES
     */
    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    public function scopeConStock($query)
    {
        return $query->where('cantidad', '>', 0);
    }

    public function scopeBajoMinimo($query)
    {
        return $query->whereHas('tipoExplosivo', function ($q) {
            $q->whereRaw('stock_explosivos.cantidad < tipos_explosivos.stock_minimo');
        });
    }

    /**
     * ATRIBUTOS CALCULADOS
     */
    public function getCantidadDisponibleAttribute()
    {
        return max(0, $this->cantidad - $this->cantidad_reservada);
    }

    public function getEstaBajoMinimoAttribute()
    {
        $tipoExplosivo = $this->tipoExplosivo;
        if (!$tipoExplosivo || !$tipoExplosivo->stock_minimo) {
            return false;
        }
        return $this->cantidad < $tipoExplosivo->stock_minimo;
    }

    public function getEstaSobreMaximoAttribute()
    {
        $tipoExplosivo = $this->tipoExplosivo;
        if (!$tipoExplosivo || !$tipoExplosivo->stock_maximo) {
            return false;
        }
        return $this->cantidad > $tipoExplosivo->stock_maximo;
    }

    /**
     * MÉTODOS ESTÁTICOS
     */
    public static function obtenerOCrear($idPolvorin, $idTipoExplosivo, $idFaena)
    {
        return self::firstOrCreate(
            [
                'id_polvorin' => $idPolvorin,
                'id_tipo_explosivo' => $idTipoExplosivo,
            ],
            [
                'cantidad' => 0,
                'cantidad_reservada' => 0,
                'id_faena' => $idFaena,
            ]
        );
    }

    /**
     * MÉTODOS DE NEGOCIO
     */
    public function incrementar($cantidad)
    {
        $this->cantidad += $cantidad;
        $this->save();
        return $this;
    }

    public function decrementar($cantidad)
    {
        if ($cantidad > $this->cantidad_disponible) {
            throw new \Exception("Stock insuficiente. Disponible: {$this->cantidad_disponible}");
        }
        $this->cantidad -= $cantidad;
        $this->save();
        return $this;
    }

    public function reservar($cantidad)
    {
        if ($cantidad > $this->cantidad_disponible) {
            throw new \Exception("No se puede reservar. Disponible: {$this->cantidad_disponible}");
        }
        $this->cantidad_reservada += $cantidad;
        $this->save();
        return $this;
    }

    public function liberarReserva($cantidad)
    {
        $this->cantidad_reservada = max(0, $this->cantidad_reservada - $cantidad);
        $this->save();
        return $this;
    }
}
