<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class LoteExplosivo extends Model
{
    use HasFactory;

    protected $table = 'lotes_explosivos';

    protected $fillable = [
        'numero_lote',
        'id_tipo_explosivo',
        'id_polvorin',
        'fecha_fabricacion',
        'fecha_vencimiento',
        'fecha_ingreso',
        'guia_despacho',
        'proveedor',
        'cantidad_inicial',
        'cantidad_actual',
        'estado',
        'id_faena',
        'user_id',
        'observaciones',
    ];

    protected $casts = [
        'fecha_fabricacion' => 'date',
        'fecha_vencimiento' => 'date',
        'fecha_ingreso' => 'date',
        'cantidad_inicial' => 'decimal:2',
        'cantidad_actual' => 'decimal:2',
    ];

    // Estados del lote
    const ESTADO_ACTIVO = 'Activo';
    const ESTADO_AGOTADO = 'Agotado';
    const ESTADO_VENCIDO = 'Vencido';
    const ESTADO_DEVUELTO = 'Devuelto';

    /**
     * RELACIONES
     */
    public function tipoExplosivo()
    {
        return $this->belongsTo(TipoExplosivo::class, 'id_tipo_explosivo');
    }

    public function polvorin()
    {
        return $this->belongsTo(Polvorin::class, 'id_polvorin');
    }

    public function usuario()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_lote');
    }

    /**
     * SCOPES
     */
    public function scopeActivos($query)
    {
        return $query->where('estado', self::ESTADO_ACTIVO);
    }

    public function scopeConStock($query)
    {
        return $query->where('cantidad_actual', '>', 0);
    }

    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    public function scopeProximosVencer($query, $dias = 30)
    {
        return $query->whereNotNull('fecha_vencimiento')
            ->where('fecha_vencimiento', '<=', Carbon::now()->addDays($dias))
            ->where('fecha_vencimiento', '>=', Carbon::now());
    }

    public function scopeVencidos($query)
    {
        return $query->whereNotNull('fecha_vencimiento')
            ->where('fecha_vencimiento', '<', Carbon::now());
    }

    /**
     * MÉTODOS
     */
    public function estaVencido()
    {
        if (!$this->fecha_vencimiento) {
            return false;
        }
        return $this->fecha_vencimiento->isPast();
    }

    public function diasParaVencer()
    {
        if (!$this->fecha_vencimiento) {
            return null;
        }
        return Carbon::now()->diffInDays($this->fecha_vencimiento, false);
    }

    public function getPorcentajeConsumidoAttribute()
    {
        if ($this->cantidad_inicial == 0) {
            return 0;
        }
        $consumido = $this->cantidad_inicial - $this->cantidad_actual;
        return round(($consumido / $this->cantidad_inicial) * 100, 1);
    }

    public function getAlertaVencimientoAttribute()
    {
        $dias = $this->diasParaVencer();
        if ($dias === null) {
            return null;
        }
        if ($dias < 0) {
            return 'vencido';
        }
        $tipoExplosivo = $this->tipoExplosivo;
        if ($tipoExplosivo && $dias <= $tipoExplosivo->dias_alerta_vencimiento) {
            return 'proximo';
        }
        return 'ok';
    }

    /**
     * Descuenta cantidad del lote
     */
    public function descontar($cantidad)
    {
        if ($cantidad > $this->cantidad_actual) {
            throw new \Exception("No hay suficiente stock en el lote. Disponible: {$this->cantidad_actual}");
        }

        $this->cantidad_actual -= $cantidad;

        if ($this->cantidad_actual <= 0) {
            $this->cantidad_actual = 0;
            $this->estado = self::ESTADO_AGOTADO;
        }

        $this->save();
        return $this;
    }

    /**
     * Agrega cantidad al lote (para devoluciones)
     */
    public function agregar($cantidad)
    {
        $this->cantidad_actual += $cantidad;

        if ($this->estado === self::ESTADO_AGOTADO && $this->cantidad_actual > 0) {
            $this->estado = self::ESTADO_ACTIVO;
        }

        $this->save();
        return $this;
    }
}
