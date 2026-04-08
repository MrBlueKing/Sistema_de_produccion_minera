<?php

namespace App\Models\Laboratorio;

use App\Models\Dispatch\Dumpada;
use App\Config\MezclaConfig;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Mezcla extends Model
{
    use HasFactory;

    protected $table = 'mezclas';

    protected $fillable = [
        'codigo',
        'fecha',
        'id_faena',
        'planta_id',
        'total_ton',
        'toneladas_disponibles',
        'toneladas_despachadas',
        'ley_prom_dump',
        'ley_prom_visual',
        'ley_prom_lote',
        'ley_lab',
        'estado',
        'es_remanente',
        'es_descarte',
        'mezcla_origen_id',
        'lote_origen_id',
        'numero_paladas',
        'observaciones',
        'user_id',
        // Campos de ajuste de toneladas
        'ajuste_aplicado',
        'total_ton_original',
        'ajuste_toneladas',
        'toneladas_despachadas_al_ajustar',
        'motivo_ajuste',
        'ajustado_por_user_id',
        'fecha_ajuste',
        'ley_base',
    ];

    protected $casts = [
        'fecha' => 'date',
        'total_ton' => 'decimal:2',
        'toneladas_disponibles' => 'decimal:2',
        'toneladas_despachadas' => 'decimal:2',
        'ley_prom_dump' => 'decimal:2',
        'ley_prom_visual' => 'decimal:2',
        'ley_prom_lote' => 'decimal:2',
        'ley_lab' => 'decimal:2',
        'es_remanente' => 'boolean',
        'es_descarte' => 'boolean',
        // Casts de ajuste
        'ajuste_aplicado' => 'boolean',
        'total_ton_original' => 'decimal:2',
        'ajuste_toneladas' => 'decimal:2',
        'toneladas_despachadas_al_ajustar' => 'decimal:2',
        'fecha_ajuste' => 'datetime',
    ];

    // Constantes de estados
    const ESTADO_CONFIRMADO = 'Confirmado';
    const ESTADO_EN_DESPACHO = 'En Despacho';
    const ESTADO_DESPACHADO = 'Despachado';

    /**
     * Relación: una mezcla tiene muchos detalles (dumpadas/remanentes)
     */
    public function detalles()
    {
        return $this->hasMany(MezclaDumpada::class, 'mezcla_id');
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
     * Relación: obtener solo las dumpadas (sin remanentes)
     */
    public function dumpadas()
    {
        return $this->hasManyThrough(
            Dumpada::class,
            MezclaDumpada::class,
            'mezcla_id',  // FK en mezcla_dumpada
            'id',         // FK en dumpadas
            'id',         // PK en mezclas
            'dumpada_id'  // PK en mezcla_dumpada
        )->where('tipo', 'DUMP');
    }

    /**
     * Relación: obtener solo los remanentes
     */
    public function remanentes()
    {
        return $this->hasMany(MezclaDumpada::class, 'mezcla_id')
            ->where('tipo', 'REM');
    }

    /**
     * Relación: una mezcla pertenece a una planta
     */
    public function planta()
    {
        return $this->belongsTo(Planta::class, 'planta_id');
    }

    /**
     * Relación: mezcla de la cual proviene este remanente (si es remanente)
     */
    public function mezclaOrigen()
    {
        return $this->belongsTo(Mezcla::class, 'mezcla_origen_id');
    }

    /**
     * Relación: lote del cual se generó este remanente (si es remanente)
     */
    public function loteOrigen()
    {
        return $this->belongsTo(Lote::class, 'lote_origen_id');
    }

    /**
     * Relación: remanentes generados a partir de esta mezcla
     */
    public function remanentesGenerados()
    {
        return $this->hasMany(Mezcla::class, 'mezcla_origen_id');
    }

    /**
     * Relación: una mezcla tiene muchas camionadas (despachos)
     */
    public function camionadas()
    {
        return $this->hasMany(\App\Models\Laboratorio\Camionada::class, 'mezcla_id');
    }

    /**
     * Verificar si la mezcla ya tiene despachos (camionadas)
     */
    public function tieneDespachos()
    {
        return $this->camionadas()->exists();
    }

    /**
     * Calcular peso total despachado en todas las camionadas
     */
    public function getPesoDespachado()
    {
        return $this->camionadas()->sum('peso');
    }

    /**
     * Calcular peso remanente disponible de esta mezcla
     * Remanente = Total - Despachado en camionadas
     */
    public function getPesoRemanente()
    {
        $pesoDespachado = $this->getPesoDespachado();
        return max(0, $this->total_ton - $pesoDespachado);
    }

    /**
     * Verificar si tiene remanente disponible
     */
    public function tieneRemanente()
    {
        return $this->getPesoRemanente() > 0.01; // Tolerancia de 10kg
    }

    /**
     * Obtener número de camionadas despachadas
     */
    public function getNumeroCamionadas()
    {
        return $this->camionadas()->count();
    }

    /**
     * Calcular totales y promedios ponderados de la mezcla
     * Este método recalcula todos los valores basándose en los detalles
     *
     * IMPORTANTE:
     * - ley_dump_ajustada ya viene CON factor aplicado (lab×0.9, visual directo)
     * - ley_lote ya viene CON factor aplicado (lab×0.81, visual×0.9)
     * - Solo ley_prom_visual se le aplica factor ×0.9 aquí
     */
    public function calcularTotales()
    {
        $detalles = $this->detalles;

        if ($detalles->isEmpty()) {
            $this->total_ton = 0;
            $this->toneladas_disponibles = 0;
            $this->ley_prom_dump = null;
            $this->ley_prom_visual = null;
            $this->ley_prom_lote = null;
            return;
        }

        // Total de toneladas
        $totalTon = $detalles->sum('toneladas');

        // DEBUG: Log de cada detalle antes de calcular
        \Log::info('📊 [MEZCLA TOTALES] Calculando totales de mezcla', [
            'mezcla_id' => $this->id,
            'codigo' => $this->codigo,
            'cantidad_detalles' => $detalles->count(),
            'total_toneladas' => $totalTon
        ]);

        foreach ($detalles as $detalle) {
            \Log::info('  📦 Detalle', [
                'tipo' => $detalle->tipo,
                'origen' => $detalle->origen,
                'toneladas' => $detalle->toneladas,
                'ley_dump' => $detalle->ley_dump_ajustada,
                'ley_visual' => $detalle->ley_visual,
                'ley_lote' => $detalle->ley_lote,
                'contribucion_lote' => $detalle->toneladas * ($detalle->ley_lote ?? 0)
            ]);
        }

        // Promedios ponderados por toneladas (ley_dump y ley_lote ya tienen factores aplicados)
        $sumaDumpPonderada = $detalles->sum(function ($detalle) {
            return $detalle->toneladas * ($detalle->ley_dump_ajustada ?? 0);
        });

        $sumaVisualPonderada = $detalles->sum(function ($detalle) {
            return $detalle->toneladas * ($detalle->ley_visual ?? 0);
        });

        $sumaLotePonderada = $detalles->sum(function ($detalle) {
            return $detalle->toneladas * ($detalle->ley_lote ?? 0);
        });

        // Asignar valores calculados
        // IMPORTANTE: Si ya se aplicó un ajuste manual, NO sobrescribir total_ton
        // El ajuste manual tiene prioridad sobre el cálculo automático
        if (!$this->ajuste_aplicado) {
            $this->total_ton = round($totalTon, 2);
        } else {
            // Si hay ajuste, mantener total_ton actual (ya fue ajustado manualmente)
            // Solo recalcular si total_ton es null o 0 (caso edge)
            if (!$this->total_ton || $this->total_ton <= 0) {
                $this->total_ton = round($totalTon, 2);
            }
        }

        // Inicializar toneladas_disponibles igual al total si aún no se ha despachado nada
        // Usar <= 0.01 en vez de == 0 para manejar NULL y valores muy pequeños
        if (($this->toneladas_despachadas ?? 0) <= 0.01) {
            $this->toneladas_disponibles = $this->total_ton;
            $this->toneladas_despachadas = 0; // Asegurar que sea 0, no NULL
        }

        // Calcular promedios ponderados
        // IMPORTANTE:
        // - ley_prom_dump: los detalles ya tienen el factor aplicado (lab×0.9, visual directo), NO aplicar de nuevo
        // - ley_prom_visual: se aplica factor 0.9 al promedio
        // - ley_prom_lote: los detalles ya tienen factor aplicado (lab×0.81, visual×0.9), NO aplicar de nuevo
        $factor = MezclaConfig::getFactorAjusteLey();

        $this->ley_prom_dump = $totalTon > 0 ? round($sumaDumpPonderada / $totalTon, 2) : null;
        $this->ley_prom_visual = $totalTon > 0 ? round(($sumaVisualPonderada / $totalTon) * $factor, 2) : null;
        $this->ley_prom_lote = $totalTon > 0 ? round($sumaLotePonderada / $totalTon, 2) : null;

        // Calcular ley_lab = ley_prom_lote / (factor * factor) → inversa del camino lab
        $this->ley_lab = $this->ley_prom_lote
            ? round($this->ley_prom_lote / ($factor * $factor), 2)
            : null;

        \Log::info('📊 [MEZCLA TOTALES] Resultado final', [
            'suma_lote_ponderada' => $sumaLotePonderada,
            'total_toneladas' => $totalTon,
            'promedio_sin_redondear' => $totalTon > 0 ? ($sumaLotePonderada / $totalTon) : 0,
            'ley_prom_lote_final' => $this->ley_prom_lote,
            'calculo' => $totalTon > 0 ? "round({$sumaLotePonderada} / {$totalTon}, 2) = round(" . ($sumaLotePonderada / $totalTon) . ", 2) = {$this->ley_prom_lote}" : 'N/A',
            'ley_prom_dump' => $this->ley_prom_dump,
            'ley_prom_visual' => $this->ley_prom_visual
        ]);
    }

    /**
     * Descontar toneladas cuando se crea una camionada
     *
     * @param float $toneladas
     * @return void
     * @throws \Exception
     */
    public function descontarToneladas($toneladas)
    {
        if ($toneladas > $this->toneladas_disponibles) {
            throw new \Exception("No hay suficientes toneladas disponibles en la mezcla. Disponible: {$this->toneladas_disponibles} ton, Solicitado: {$toneladas} ton");
        }

        $this->toneladas_disponibles -= $toneladas;
        $this->toneladas_despachadas += $toneladas;

        // Actualizar estado si se despachó todo
        if ($this->toneladas_disponibles <= 0.01) { // Tolerancia de 10kg
            $this->estado = self::ESTADO_DESPACHADO;
        } elseif ($this->toneladas_despachadas > 0) {
            $this->estado = self::ESTADO_EN_DESPACHO;
        }

        $this->save();
    }

    /**
     * Restaurar toneladas cuando se elimina una camionada
     *
     * @param float $toneladas
     * @return void
     */
    public function restaurarToneladas($toneladas)
    {
        $this->toneladas_disponibles += $toneladas;
        $this->toneladas_despachadas -= $toneladas;

        // Recalcular estado
        if ($this->toneladas_despachadas <= 0) {
            $this->estado = self::ESTADO_CONFIRMADO;
        } elseif ($this->toneladas_disponibles > 0.01) {
            $this->estado = self::ESTADO_EN_DESPACHO;
        }

        $this->save();
    }

    /**
     * Verificar si tiene toneladas disponibles
     *
     * @return bool
     */
    public function tieneToneladasDisponibles()
    {
        return $this->toneladas_disponibles > 0.01; // Tolerancia de 10kg
    }

    /**
     * Scope: Obtener solo remanentes disponibles
     */
    public function scopeRemanentesDisponibles($query)
    {
        return $query->where('es_remanente', true)
                    ->where('toneladas_disponibles', '>', 0.01);
    }

    /**
     * Scope: Obtener mezclas con toneladas disponibles (no remanentes)
     */
    public function scopeConToneladasDisponibles($query)
    {
        return $query->where('es_remanente', false)
                    ->where('toneladas_disponibles', '>', 0.01);
    }

    /**
     * Aplicar ajuste manual de toneladas a la mezcla
     * Se usa cuando el inventario físico difiere del cálculo teórico
     *
     * @param float $toneladasRealesRemanente - Toneladas reales confirmadas que quedan
     * @param string $motivo - Motivo del ajuste
     * @param int $userId - ID del usuario que aplica el ajuste
     * @return void
     * @throws \Exception
     */
    public function aplicarAjusteToneladas($toneladasRealesRemanente, $motivo, $userId = null)
    {
        // Validar que la mezcla tenga camionadas despachadas
        if ($this->toneladas_despachadas <= 0) {
            throw new \Exception('Solo se puede ajustar una mezcla que ya tiene camionadas despachadas');
        }

        // Validar que no se haya aplicado ajuste previamente
        if ($this->ajuste_aplicado) {
            throw new \Exception('Esta mezcla ya tiene un ajuste aplicado. No se puede ajustar dos veces.');
        }

        // Validar que las toneladas reales sean positivas
        if ($toneladasRealesRemanente < 0) {
            throw new \Exception('Las toneladas reales del remanente no pueden ser negativas');
        }

        // Calcular el nuevo total confirmado
        // total_confirmado = toneladas_despachadas + remanente_real
        $totalConfirmado = $this->toneladas_despachadas + $toneladasRealesRemanente;

        // Calcular el ajuste (diferencia entre confirmado y teórico)
        $ajuste = $totalConfirmado - $this->total_ton;

        // Guardar el original antes de modificar
        $this->total_ton_original = $this->total_ton;
        $this->toneladas_despachadas_al_ajustar = $this->toneladas_despachadas;

        // Aplicar el ajuste
        $this->total_ton = $totalConfirmado;
        $this->toneladas_disponibles = $toneladasRealesRemanente;
        $this->ajuste_toneladas = $ajuste;
        $this->motivo_ajuste = $motivo;
        $this->ajustado_por_user_id = $userId;
        $this->fecha_ajuste = now();
        $this->ajuste_aplicado = true;

        $this->save();

        \Log::info('📝 [AJUSTE TONELADAS] Ajuste aplicado a mezcla', [
            'mezcla_codigo' => $this->codigo,
            'total_original' => $this->total_ton_original,
            'total_confirmado' => $this->total_ton,
            'toneladas_despachadas' => $this->toneladas_despachadas,
            'remanente_calculado_anterior' => $this->total_ton_original - $this->toneladas_despachadas,
            'remanente_real_confirmado' => $toneladasRealesRemanente,
            'ajuste_aplicado' => $ajuste,
            'motivo' => $motivo
        ]);
    }

    /**
     * Verificar si se puede aplicar ajuste de toneladas
     *
     * @return bool
     */
    public function puedeAplicarAjuste()
    {
        return !$this->ajuste_aplicado && $this->toneladas_despachadas > 0;
    }

    /**
     * Revertir el ajuste de toneladas aplicado
     * Restaura los valores originales antes del ajuste
     *
     * @param string $motivo - Motivo de la reversión
     * @param int $userId - ID del usuario que revierte
     * @return void
     * @throws \Exception
     */
    public function revertirAjuste($motivo, $userId = null)
    {
        // Validar que haya un ajuste aplicado
        if (!$this->ajuste_aplicado) {
            throw new \Exception('Esta mezcla no tiene un ajuste aplicado para revertir');
        }

        // Validar que no se haya usado el remanente en otras mezclas
        $remanenteUsado = \App\Models\Laboratorio\MezclaDumpada::where('tipo', 'REM')
            ->where('origen', 'like', '%' . $this->codigo . '%')
            ->exists();

        if ($remanenteUsado) {
            throw new \Exception('No se puede revertir el ajuste porque el remanente de esta mezcla ya fue usado en otras mezclas');
        }

        // Validar que el motivo no esté vacío
        if (empty(trim($motivo))) {
            throw new \Exception('Debe proporcionar un motivo para revertir el ajuste');
        }

        // Restaurar valores originales
        $totalAnterior = $this->total_ton;
        $this->total_ton = $this->total_ton_original;

        // Recalcular toneladas disponibles
        // Fórmula: disponibles = total_original - despachadas_actuales
        // Esta fórmula funciona correctamente en ambos casos:
        // 1. Si se revierte ANTES de eliminar mezclas que usan el remanente
        // 2. Si se revierte DESPUÉS de eliminar mezclas (restaurando toneladas)
        $this->toneladas_disponibles = max(0, $this->total_ton_original - $this->toneladas_despachadas);

        // Limpiar campos de ajuste pero guardar historial en observaciones
        $historialAjuste = "AJUSTE REVERTIDO el " . now()->format('d/m/Y H:i') . " por usuario ID: {$userId}. ";
        $historialAjuste .= "Total antes de revertir: {$totalAnterior} t, restaurado a: {$this->total_ton} t. ";
        $historialAjuste .= "Ajuste original: {$this->ajuste_toneladas} t. ";
        $historialAjuste .= "Motivo original: {$this->motivo_ajuste}. ";
        $historialAjuste .= "Motivo de reversión: {$motivo}.";

        // Agregar al campo de observaciones
        $this->observaciones = $this->observaciones
            ? $this->observaciones . "\n\n" . $historialAjuste
            : $historialAjuste;

        // Limpiar flags de ajuste (permitir volver a ajustar)
        $this->ajuste_aplicado = false;
        $this->total_ton_original = null;
        $this->ajuste_toneladas = null;
        $this->toneladas_despachadas_al_ajustar = null;
        $this->motivo_ajuste = null;
        $this->ajustado_por_user_id = null;
        $this->fecha_ajuste = null;

        // Actualizar estado si corresponde
        if ($this->toneladas_disponibles <= 0.01) {
            $this->estado = self::ESTADO_DESPACHADO;
        } elseif ($this->toneladas_despachadas > 0) {
            $this->estado = self::ESTADO_EN_DESPACHO;
        }

        $this->save();

        \Log::info('🔄 [REVERTIR AJUSTE] Ajuste revertido', [
            'mezcla_codigo' => $this->codigo,
            'total_anterior' => $totalAnterior,
            'total_restaurado' => $this->total_ton,
            'toneladas_disponibles' => $this->toneladas_disponibles,
            'motivo' => $motivo,
            'user_id' => $userId
        ]);
    }

    /**
     * Verificar si se puede revertir el ajuste
     *
     * @return bool
     */
    public function puedeRevertirAjuste()
    {
        if (!$this->ajuste_aplicado) {
            return false;
        }

        // Verificar que no se haya usado el remanente
        $remanenteUsado = \App\Models\Laboratorio\MezclaDumpada::where('tipo', 'REM')
            ->where('origen', 'like', '%' . $this->codigo . '%')
            ->exists();

        return !$remanenteUsado;
    }

    /**
     * Generar código único para la mezcla basado en la planta
     * Ejemplo: CZ1224, EN1001
     *
     * @param int|null $plantaId - ID de la planta
     * @param string $prefijoDefault - Prefijo por defecto si no hay planta
     * @return string
     */
    public static function generarCodigo($plantaId = null, $prefijoDefault = 'CZ')
    {
        // Obtener prefijo de la planta si existe
        $prefijo = $prefijoDefault;

        if ($plantaId) {
            $planta = Planta::find($plantaId);
            if ($planta && $planta->prefijo_codigo) {
                $prefijo = $planta->prefijo_codigo;
            }
        }

        // Obtener el último código con el mismo prefijo
        $ultimaMezcla = self::where('codigo', 'like', $prefijo . '%')
            ->orderBy('codigo', 'desc')
            ->first();

        if (!$ultimaMezcla) {
            return $prefijo . '1001';
        }

        // Extraer el número del código
        $ultimoNumero = (int) substr($ultimaMezcla->codigo, strlen($prefijo));
        $nuevoNumero = $ultimoNumero + 1;

        return $prefijo . $nuevoNumero;
    }
}
