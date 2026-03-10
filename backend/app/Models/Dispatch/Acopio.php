<?php

namespace App\Models\Dispatch;

use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Acopio extends Model
{
    use HasFactory;

    protected $table = 'acopios';

    protected $fillable = [
        'numero_acopio',
        'codigo_acopio',
        'nombre',
        'tipo',
        'id_frente_trabajo',
        'id_faena',
        'jornada',
        'fecha',
        'total_toneladas',
        'ley_promedio',
        'ley_visual_promedio',
        'ley_lote_promedio',
        'cantidad_dumpadas',
        'estado',
        'observaciones',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'date:d-m-Y',
        'total_toneladas' => 'decimal:2',
        'ley_promedio' => 'decimal:2',
        'ley_visual_promedio' => 'decimal:2',
        'ley_lote_promedio' => 'decimal:2',
        'cantidad_dumpadas' => 'integer',
    ];

    // Constantes de tipo
    const TIPO_AUTOMATICO = 'AUTOMATICO';
    const TIPO_MANUAL = 'MANUAL';

    // Constantes de estado
    const ESTADO_ABIERTO = 'ABIERTO';
    const ESTADO_CERRADO = 'CERRADO';
    const ESTADO_EN_MEZCLA = 'EN_MEZCLA';

    /**
     * Relación: un acopio pertenece a un frente de trabajo
     */
    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
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
     * Relación: un acopio tiene muchas dumpadas (a través de pivot)
     */
    public function dumpadas()
    {
        return $this->belongsToMany(
            Dumpada::class,
            'acopio_dumpada',
            'acopio_id',
            'dumpada_id'
        )->withTimestamps();
    }

    /**
     * Generar el siguiente número de acopio
     * Retorna solo el número (1, 2, 3...) sin prefijo
     */
    public static function generarNumeroAcopio()
    {
        $maxAcopio = self::whereNotNull('numero_acopio')
            ->where('numero_acopio', '!=', '')
            ->pluck('numero_acopio')
            ->map(function($val) {
                // Extraer el número (puede venir como "A-001" o "1")
                if (preg_match('/A-(\d+)/', $val, $matches)) {
                    return (int) $matches[1];
                }
                return (int) $val;
            })
            ->max();

        $siguiente = $maxAcopio ? ($maxAcopio + 1) : 1;
        return (string) $siguiente; // Retorna solo el número: "1", "2", "3"...
    }

    /**
     * Generar código completo del acopio
     * Para automáticos: {codigo_frente}-{turno}-{numero}-{fecha}
     * Ejemplo: "M51SH2L11-AM-1-27-11-2025"
     * Para manuales: MANUAL-{numero}-{fecha}
     */
    public static function generarCodigoAcopio($tipo, $numeroAcopio, $codigoFrente = null, $turno = null, $fecha = null)
    {
        $fechaFormateada = $fecha ? Carbon::parse($fecha)->format('d-m-Y') : Carbon::now()->format('d-m-Y');

        // El numeroAcopio ya viene como string ("1", "2", "3"...)
        // No necesita formateo adicional

        if ($tipo === self::TIPO_AUTOMATICO && $codigoFrente && $turno) {
            return "{$codigoFrente}-{$turno}-{$numeroAcopio}-{$fechaFormateada}";
        } else {
            return "MANUAL-{$numeroAcopio}-{$fechaFormateada}";
        }
    }

    /**
     * Buscar acopio abierto con los mismos criterios
     */
    public static function buscarAcopioAbierto($idFrenteTrabajo, $jornada, $fecha)
    {
        return self::where('tipo', self::TIPO_AUTOMATICO)
            ->where('estado', self::ESTADO_ABIERTO)
            ->where('id_frente_trabajo', $idFrenteTrabajo)
            ->where('jornada', $jornada)
            ->whereDate('fecha', $fecha)
            ->first();
    }

    /**
     * Recalcular totales del acopio basado en las dumpadas
     *
     * IMPORTANTE: Los promedios se guardan SIN el factor de ajuste (leyes originales).
     * El factor 0.9 se aplica solo al crear mezclas en Mezcla::calcularTotales()
     */
    public function recalcularTotales()
    {
        // Obtener TODAS las dumpadas del acopio
        $todasDumpadas = $this->dumpadas()->get();
        $cantidadDumpadas = $todasDumpadas->count();

        // Calcular total de toneladas de TODAS las dumpadas (no filtrar por estado)
        // porque un acopio debe sumar todas sus dumpadas independientemente del estado
        $totalToneladas = $todasDumpadas->sum(function($dumpada) {
            return floatval($dumpada->ton ?? 0);
        });

        // Calcular ley promedio ponderada SIN ajuste (ley original)
        $leyPromedio = null;
        if ($totalToneladas > 0) {
            $sumaLeyPonderada = $todasDumpadas->sum(function($dumpada) {
                $ton = floatval($dumpada->ton ?? 0);
                $ley = 0;

                // Usar ley original SIN aplicar factor
                if (!empty($dumpada->ley) && $dumpada->ley > 0) {
                    $ley = floatval($dumpada->ley);
                }

                return $ton * $ley;
            });

            // Calcular el promedio solo si hay dumpadas con ley de laboratorio
            $tonConLey = $todasDumpadas->sum(function($dumpada) {
                if (!empty($dumpada->ley) && $dumpada->ley > 0) {
                    return floatval($dumpada->ton ?? 0);
                }
                return 0;
            });

            if ($tonConLey > 0) {
                $leyPromedio = round($sumaLeyPonderada / $tonConLey, 2);
            }
        }

        // Calcular ley visual promedio ponderada SIN ajuste (ley original)
        $leyVisualPromedio = null;
        if ($totalToneladas > 0) {
            $sumaLeyVisualPonderada = $todasDumpadas->sum(function($dumpada) {
                $ton = floatval($dumpada->ton ?? 0);
                $leyVisual = 0;

                // Usar ley visual original SIN aplicar factor
                if (!empty($dumpada->ley_visual) && $dumpada->ley_visual > 0) {
                    $leyVisual = floatval($dumpada->ley_visual);
                }

                return $ton * $leyVisual;
            });

            // Calcular el promedio solo si hay dumpadas con ley visual
            $tonConLeyVisual = $todasDumpadas->sum(function($dumpada) {
                if (!empty($dumpada->ley_visual) && $dumpada->ley_visual > 0) {
                    return floatval($dumpada->ton ?? 0);
                }
                return 0;
            });

            if ($tonConLeyVisual > 0) {
                $leyVisualPromedio = round($sumaLeyVisualPonderada / $tonConLeyVisual, 2);
            }
        }

        // Calcular ley lote promedio
        // REGLA: ley_lab → ×0.81 (dos descuentos), ley_visual → ×0.9 (un descuento)
        $leyLotePromedio = null;
        if ($totalToneladas > 0) {
            $sumaLeyLotePonderada = $todasDumpadas->sum(function($dumpada) {
                $ton = floatval($dumpada->ton ?? 0);

                // ley lab: dos descuentos (×0.81), ley visual: un descuento (×0.9)
                if (!empty($dumpada->ley) && $dumpada->ley > 0) {
                    $leyLote = floatval($dumpada->ley) * 0.81;
                } elseif (!empty($dumpada->ley_visual) && $dumpada->ley_visual > 0) {
                    $leyLote = floatval($dumpada->ley_visual) * 0.9;
                } else {
                    $leyLote = 0;
                }

                return $ton * $leyLote;
            });

            // Calcular el promedio solo si hay dumpadas con ley
            $tonConLeyOVisual = $todasDumpadas->sum(function($dumpada) {
                $tieneLey = !empty($dumpada->ley) && $dumpada->ley > 0;
                $tieneLeyVisual = !empty($dumpada->ley_visual) && $dumpada->ley_visual > 0;
                if ($tieneLey || $tieneLeyVisual) {
                    return floatval($dumpada->ton ?? 0);
                }
                return 0;
            });

            if ($tonConLeyOVisual > 0) {
                $leyLotePromedio = round($sumaLeyLotePonderada / $tonConLeyOVisual, 2);
            }
        }

        $this->update([
            'total_toneladas' => $totalToneladas,
            'ley_promedio' => $leyPromedio,
            'ley_visual_promedio' => $leyVisualPromedio,
            'ley_lote_promedio' => $leyLotePromedio,
            'cantidad_dumpadas' => $cantidadDumpadas,
        ]);

        return $this->fresh();
    }

    /**
     * Verificar si el acopio puede cerrarse
     * Un acopio puede cerrarse si todas sus dumpadas tienen ley O ley visual
     */
    public function puedeCerrarse()
    {
        $dumpadas = $this->dumpadas;

        if ($dumpadas->count() === 0) {
            return false;
        }

        // Verificar que todas las dumpadas tengan ley O ley visual
        foreach ($dumpadas as $dumpada) {
            $tieneLey = !empty($dumpada->ley) && $dumpada->ley > 0;
            $tieneLeyVisual = !empty($dumpada->ley_visual) && $dumpada->ley_visual > 0;

            // Si no tiene ni ley ni ley visual, no puede cerrarse
            if (!$tieneLey && !$tieneLeyVisual) {
                return false;
            }
        }

        return true;
    }

    /**
     * Verificar si el acopio puede ser usado en una mezcla
     * Un acopio puede usarse en mezcla si está cerrado y tiene dumpadas con ley
     */
    public function puedeUsarseEnMezcla()
    {
        // Debe estar cerrado
        if ($this->estado !== self::ESTADO_CERRADO) {
            return false;
        }

        // Debe tener dumpadas
        if ($this->cantidad_dumpadas === 0) {
            return false;
        }

        // Debe tener ley promedio (calculada desde las dumpadas)
        if (empty($this->ley_promedio) || $this->ley_promedio <= 0) {
            return false;
        }

        return true;
    }

    /**
     * Cerrar el acopio
     * Solo puede cerrarse si cumple con los requisitos de ley
     */
    public function cerrar()
    {
        if (!$this->puedeCerrarse()) {
            throw new \Exception(
                "No se puede cerrar el acopio. Todas las dumpadas deben tener ley de laboratorio o ley visual."
            );
        }

        $this->update(['estado' => self::ESTADO_CERRADO]);
        return $this;
    }

    /**
     * Marcar como usado en mezcla
     */
    public function marcarEnMezcla()
    {
        $this->update(['estado' => self::ESTADO_EN_MEZCLA]);
        return $this;
    }
}
