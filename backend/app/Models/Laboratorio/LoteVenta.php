<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoteVenta extends Model
{
    use HasFactory;

    protected $table = 'lotes_venta';

    protected $fillable = [
        'numero_lote',
        'cliente',
        'fecha_creacion',
        'estado',
        'observaciones',
        'user_id',
    ];

    protected $casts = [
        'fecha_creacion' => 'date',
    ];

    // Constantes de estados
    const ESTADO_PREPARADO = 'Preparado';
    const ESTADO_ENVIADO = 'Enviado';
    const ESTADO_COMPLETADO = 'Completado';

    /**
     * Relación: un lote puede tener muchas mezclas (muchos a muchos)
     */
    public function mezclas()
    {
        return $this->belongsToMany(
            Mezcla::class,
            'lote_mezcla',
            'lote_id',
            'mezcla_id'
        )->withPivot('peso_usado', 'ley_mezcla')
          ->withTimestamps();
    }

    /**
     * Relación: un lote tiene muchas camionadas
     */
    public function camionadas()
    {
        return $this->hasMany(Camionada::class, 'lote_venta_id');
    }

    /**
     * Relación: obtener los detalles de las mezclas usadas
     */
    public function loteMezclas()
    {
        return $this->hasMany(LoteMezcla::class, 'lote_id');
    }

    /**
     * Generar número de lote único
     * Ejemplo: L1001, L1002, etc.
     */
    public static function generarNumeroLote($prefijo = 'L')
    {
        $ultimoLote = self::where('numero_lote', 'like', $prefijo . '%')
            ->orderBy('numero_lote', 'desc')
            ->first();

        if (!$ultimoLote) {
            return $prefijo . '1001';
        }

        // Extraer el número del código
        $ultimoNumero = (int) substr($ultimoLote->numero_lote, strlen($prefijo));
        $nuevoNumero = $ultimoNumero + 1;

        return $prefijo . $nuevoNumero;
    }

    /**
     * Calcular el peso total despachado en todas las camionadas
     */
    public function getPesoDespachado()
    {
        return $this->camionadas()->sum('peso');
    }

    /**
     * Calcular el peso total teórico (suma de todas las mezclas usadas)
     */
    public function getPesoTotalMezclas()
    {
        return $this->loteMezclas()->sum('peso_usado');
    }

    /**
     * Calcular el peso restante por despachar
     * Restante = Peso total de mezclas - Peso despachado
     */
    public function getPesoRestante()
    {
        $pesoTotal = $this->getPesoTotalMezclas();
        $pesoDespachado = $this->getPesoDespachado();
        return max(0, $pesoTotal - $pesoDespachado);
    }

    /**
     * Verificar si el lote está completamente despachado
     */
    public function estaCompleto()
    {
        return $this->getPesoRestante() <= 0.01; // Tolerancia de 10kg
    }

    /**
     * Obtener número de camionadas
     */
    public function getNumeroCamionadas()
    {
        return $this->camionadas()->count();
    }

    /**
     * Calcular ley promedio ponderada de todas las mezclas del lote
     */
    public function getLeyPromedio()
    {
        $loteMezclas = $this->loteMezclas;

        if ($loteMezclas->isEmpty()) {
            return 0;
        }

        $pesoTotal = 0;
        $sumaPonderada = 0;

        foreach ($loteMezclas as $lm) {
            $pesoTotal += $lm->peso_usado;
            $sumaPonderada += ($lm->peso_usado * $lm->ley_mezcla);
        }

        return $pesoTotal > 0 ? round($sumaPonderada / $pesoTotal, 2) : 0;
    }

    /**
     * Obtener resumen del lote
     */
    public function getResumen()
    {
        return [
            'numero_lote' => $this->numero_lote,
            'cliente' => $this->cliente,
            'mezclas_codigos' => $this->mezclas->pluck('codigo')->toArray(),
            'peso_total_mezclas' => $this->getPesoTotalMezclas(),
            'peso_despachado' => $this->getPesoDespachado(),
            'peso_restante' => $this->getPesoRestante(),
            'numero_camionadas' => $this->getNumeroCamionadas(),
            'ley_promedio' => $this->getLeyPromedio(),
            'esta_completo' => $this->estaCompleto(),
            'estado' => $this->estado,
        ];
    }
}
