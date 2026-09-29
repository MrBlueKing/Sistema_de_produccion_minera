<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Camionada extends Model
{
    use HasFactory;

    protected $table = 'camionadas';

    protected $fillable = [
        'lote_id',
        'lote_venta_id',
        'id_faena',
        'numero_camionada',
        'ticket',
        'numero_guia',
        'patente_camion_2',
        'punto_transbordo_id',
        'patente',
        'planta',
        'cliente',
        'fecha_despacho',
        'fecha_recepcion',
        'hora_despacho',
        'hora_recepcion',
        'peso',
        'peso_real',
        'ley_mezcla',
        'ley_visual',
        'ley_lab_camion',
        'diferencia',
        'diferencia_ley',
        'porcentaje_error',
        'porcentaje_error_ley',
        'estado',
        'observaciones',
        'user_id',
    ];

    protected $casts = [
        'fecha_despacho' => 'date',
        'fecha_recepcion' => 'date',
        'peso' => 'decimal:2',
        'peso_real' => 'decimal:2',
        'ley_mezcla' => 'decimal:3',
        'ley_visual' => 'decimal:3',
        'ley_lab_camion' => 'decimal:3',
        'diferencia' => 'decimal:2',
        'diferencia_ley' => 'decimal:3',
        'porcentaje_error' => 'decimal:2',
        'porcentaje_error_ley' => 'decimal:2',
    ];

    // Constantes de estados
    const ESTADO_DESPACHADO = 'Despachado';
    const ESTADO_EN_TRANSITO = 'En Tránsito';
    const ESTADO_RECIBIDO = 'Recibido';
    const ESTADO_COMPLETADO = 'Completado';

    // Peso teórico por camionada (configurable)
    const PESO_TEORICO_CAMIONADA = 4.6;

    /**
     * Relación: una camionada pertenece a muchas mezclas (via pivot)
     */
    public function mezclas()
    {
        return $this->belongsToMany(Mezcla::class, 'camionada_mezcla')
                    ->withPivot(['toneladas', 'ley_mezcla'])
                    ->withTimestamps();
    }

    /**
     * Relación: una camionada pertenece a un lote
     */
    public function lote()
    {
        return $this->belongsTo(Lote::class, 'lote_id');
    }

    /**
     * Punto de transbordo (ej. Santa Ana) si ESTA camionada puntual pasó por
     * ahí antes de llegar a planta -- dato del viaje, no del Lote (un mismo
     * Lote puede tener recargos directos y recargos vía transbordo
     * mezclados). Null = viaje directo. Ver también patente_camion_2.
     */
    public function puntoTransbordo()
    {
        return $this->belongsTo(PuntoTransbordo::class, 'punto_transbordo_id');
    }

    /**
     * Scope: Filtrar por faena
     */
    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    /**
     * Calcular la diferencia entre peso teórico y real
     * Diferencia = Peso Real - Peso Teórico (4.6 ton)
     */
    public function calcularDiferencia()
    {
        $pesoTeorico = self::PESO_TEORICO_CAMIONADA;
        $this->diferencia = round($this->peso - $pesoTeorico, 2);
    }

    /**
     * Calcular el porcentaje de error entre peso teórico y real
     * Error% = (|Peso Real - Peso Teórico| / Peso Teórico) × 100
     */
    public function calcularPorcentajeError()
    {
        $pesoTeorico = self::PESO_TEORICO_CAMIONADA;

        if ($pesoTeorico == 0) {
            $this->porcentaje_error = 0;
            return;
        }

        $diferencia = abs($this->peso - $pesoTeorico);
        $this->porcentaje_error = round(($diferencia / $pesoTeorico) * 100, 2);
    }

    /**
     * Calcular diferencia entre ley esperada y ley laboratorio
     * Solo si tiene ley de laboratorio
     */
    public function calcularErrorLey()
    {
        if (!$this->ley_lab_camion || !$this->ley_mezcla) {
            return null;
        }

        $diferencia = abs($this->ley_lab_camion - $this->ley_mezcla);
        return round(($diferencia / $this->ley_mezcla) * 100, 2);
    }

    /**
     * Calcular diferencia absoluta entre ley esperada y ley laboratorio
     * Guarda el resultado en diferencia_ley
     */
    public function calcularDiferenciaLey()
    {
        if ($this->ley_mezcla && $this->ley_lab_camion) {
            $this->diferencia_ley = abs($this->ley_lab_camion - $this->ley_mezcla);
            $this->porcentaje_error_ley = ($this->diferencia_ley / $this->ley_mezcla) * 100;
        }
    }

    /**
     * Scope: camionadas que incluyen una mezcla específica (via pivot)
     */
    public function scopeDeMezcla($query, $mezclaId)
    {
        return $query->whereHas('mezclas', fn($q) => $q->where('mezclas.id', $mezclaId));
    }

    /**
     * Scope: camionadas de una planta específica
     */
    public function scopeDePlanta($query, $planta)
    {
        return $query->where('planta', $planta);
    }

    /**
     * Scope: camionadas despachadas
     */
    public function scopeDespachadas($query)
    {
        return $query->whereIn('estado', [
            self::ESTADO_DESPACHADO,
            self::ESTADO_EN_TRANSITO,
            self::ESTADO_RECIBIDO,
            self::ESTADO_COMPLETADO
        ]);
    }

    /**
     * Scope: camionadas recibidas
     */
    public function scopeRecibidas($query)
    {
        return $query->whereIn('estado', [
            self::ESTADO_RECIBIDO,
            self::ESTADO_COMPLETADO
        ]);
    }

    /**
     * Verificar si la camionada fue recibida
     */
    public function estaRecibida()
    {
        return in_array($this->estado, [
            self::ESTADO_RECIBIDO,
            self::ESTADO_COMPLETADO
        ]);
    }

    /**
     * Marcar como recibida con fecha y hora
     */
    public function marcarComoRecibida($fechaRecepcion = null, $horaRecepcion = null)
    {
        $this->fecha_recepcion = $fechaRecepcion ?? now()->toDateString();
        $this->hora_recepcion = $horaRecepcion ?? now()->toTimeString();
        $this->estado = self::ESTADO_RECIBIDO;
        $this->save();
    }

    /**
     * Actualizar ley de laboratorio del camión
     */
    public function actualizarLeyLaboratorio($leyLab)
    {
        $this->ley_lab_camion = $leyLab;
        $this->save();
    }

    /**
     * Recalcula ley_mezcla/ley_visual desde el estado ACTUAL de las mezclas asociadas
     * (promedio ponderado por toneladas de la pivot) — para cuando una mezcla actualiza
     * su ley después de que la camionada ya se despachó (antes quedaba "congelada" para
     * siempre con lo que había al momento de crearla). También refresca el ley_mezcla
     * guardado en el pivot camionada_mezcla, y si esta camionada ya tiene ley_lab_camion
     * propio, recalcula diferencia_ley/porcentaje_error_ley contra el valor nuevo.
     *
     * Se aplica sin importar el estado (Despachado/Recibido/Completado): cerrar o
     * recepcionar una camionada solo afecta sus toneladas, no la ley que le corresponde
     * según la mezcla que la compone.
     *
     * @return bool true si algún valor cambió (y se guardó), false si no había nada que actualizar.
     */
    public function refrescarLeyDesdeMezclas(): bool
    {
        $mezclas = $this->mezclas()->get();

        $totalTon = $mezclas->sum('pivot.toneladas');
        if ($totalTon <= 0) {
            return false;
        }

        $sumaLote = 0;
        $sumaVisual = 0;

        foreach ($mezclas as $mezcla) {
            $ton = $mezcla->pivot->toneladas;
            $leyLote = $mezcla->ley_prom_lote ?? $mezcla->ley_lab;
            $leyVisual = $mezcla->ley_prom_visual ?? $mezcla->ley_lab;

            $sumaLote += ($leyLote ?? 0) * $ton;
            $sumaVisual += ($leyVisual ?? 0) * $ton;

            DB::table('camionada_mezcla')
                ->where('camionada_id', $this->id)
                ->where('mezcla_id', $mezcla->id)
                ->update(['ley_mezcla' => $leyLote]);
        }

        $nuevaLeyMezcla = round($sumaLote / $totalTon, 4);
        $nuevaLeyVisual = round($sumaVisual / $totalTon, 4);

        $cambio = $this->ley_mezcla != $nuevaLeyMezcla || $this->ley_visual != $nuevaLeyVisual;

        if (!$cambio) {
            return false;
        }

        $this->ley_mezcla = $nuevaLeyMezcla;
        $this->ley_visual = $nuevaLeyVisual;

        if ($this->ley_lab_camion) {
            $this->calcularDiferenciaLey();
        }

        $this->save();

        return true;
    }
}
