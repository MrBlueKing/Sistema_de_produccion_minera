<?php

namespace App\Models\Laboratorio;

use App\Models\Dispatch\Dumpada;
use App\Config\MezclaConfig;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MezclaDumpada extends Model
{
    use HasFactory;

    protected $table = 'mezcla_dumpada';

    protected $fillable = [
        'mezcla_id',
        'dumpada_id',
        'tipo',
        'origen',
        'toneladas',
        'numero_paladas',
        'toneladas_reales_origen',
        'ley_dump_ajustada',
        'ley_visual',
        'ley_lote',
    ];

    protected $casts = [
        'toneladas' => 'decimal:2',
        'numero_paladas' => 'decimal:2',
        'toneladas_reales_origen' => 'decimal:2',
        'ley_dump_ajustada' => 'decimal:2',
        'ley_visual' => 'decimal:2',
        'ley_lote' => 'decimal:2',
    ];

    // Constantes de tipo
    const TIPO_DUMPADA = 'DUMP';
    const TIPO_REMANENTE = 'REM';

    /**
     * Relación: pertenece a una mezcla
     */
    public function mezcla()
    {
        return $this->belongsTo(Mezcla::class, 'mezcla_id');
    }

    /**
     * Relación: pertenece a una dumpada (puede ser NULL si es remanente)
     */
    public function dumpada()
    {
        return $this->belongsTo(Dumpada::class, 'dumpada_id');
    }

    /**
     * Scope: filtrar solo dumpadas
     */
    public function scopeSoloDumpadas($query)
    {
        return $query->where('tipo', self::TIPO_DUMPADA);
    }

    /**
     * Scope: filtrar solo remanentes
     */
    public function scopeSoloRemanentes($query)
    {
        return $query->where('tipo', self::TIPO_REMANENTE);
    }

    /**
     * Método estático para crear un detalle desde una dumpada.
     *
     * REGLA DE NEGOCIO para ley_dump_ajustada:
     *   - Si tiene ley lab: ley_lab × factor (0.9)
     *   - Si solo tiene ley visual: ley_visual SIN descuento
     *
     * REGLA DE NEGOCIO para ley_lote (siempre se aplica descuento):
     *   - Si tiene ley lab: ley_lab × factor × factor (0.81)
     *   - Si solo tiene ley visual: ley_visual × factor (0.9)
     *
     * @param Dumpada $dumpada
     * @param int $mezclaId
     * @param float|null $numeroPaladas Número de paladas a tomar. NULL = dumpada completa (legado).
     *                                  Si se especifica, las toneladas se calculan como paladas × ton_por_palada.
     */
    public static function desdeDumpada(Dumpada $dumpada, $mezclaId, $numeroPaladas = null, $leyBase = 'auto')
    {
        // Calcular toneladas según modo (completo o parcial por paladas)
        if ($numeroPaladas !== null) {
            $tonPorPalada = (float) \App\Models\ConfiguracionSistema::obtener('toneladas_por_palada', 1.82, $dumpada->id_faena);
            $toneladas = round($numeroPaladas * $tonPorPalada, 2);
        } else {
            $toneladas = $dumpada->ton;
        }

        // Determinar la ley efectiva según ley_base de la mezcla
        // Solo aplica si la dumpada tiene datos de cu_soluble/cu_insoluble (sistema nuevo)
        // Para dumpadas antiguas sin esos datos → usa ley directo (comportamiento legado)
        $cuInsoluble = $dumpada->cu_insoluble;
        $cuSoluble   = $dumpada->cu_soluble;
        $tieneFraccion = $cuInsoluble !== null || $cuSoluble !== null;

        if ($tieneFraccion) {
            switch ($leyBase) {
                case 'cu_insoluble':
                    $leyEfectiva = $cuInsoluble;
                    $fuenteLey   = 'CU_INSOLUBLE';
                    break;
                case 'cu_soluble':
                    $leyEfectiva = $cuSoluble;
                    $fuenteLey   = 'CU_SOLUBLE';
                    break;
                case 'cu_total':
                    $leyEfectiva = $dumpada->ley;
                    $fuenteLey   = 'CU_TOTAL';
                    break;
                case 'auto':
                default:
                    // Usar la fracción más alta disponible
                    $ins = $cuInsoluble ?? 0;
                    $sol = $cuSoluble   ?? 0;
                    if ($ins >= $sol) {
                        $leyEfectiva = $cuInsoluble ?? $dumpada->ley;
                        $fuenteLey   = 'AUTO→CU_INSOLUBLE';
                    } else {
                        $leyEfectiva = $cuSoluble ?? $dumpada->ley;
                        $fuenteLey   = 'AUTO→CU_SOLUBLE';
                    }
                    break;
            }
        } else {
            // Dumpada antigua: sin fracciones → comportamiento histórico
            $leyEfectiva = $dumpada->ley;
            $fuenteLey   = 'LEGACY';
        }

        // Aplicar capping a la ley efectiva
        $leyLab = $leyEfectiva;
        if ($leyLab) {
            $leyLab = Dumpada::calcularCapping($leyLab, $dumpada->id_faena);
        }
        $leyVisual = $dumpada->ley_visual;
        $factor = \App\Config\MezclaConfig::getFactorAjusteLey();

        // ley_dump_ajustada: lab se descuenta, visual NO se descuenta
        if ($leyLab) {
            $leyDumpAjustada = round($leyLab * $factor, 2);
        } else {
            $leyDumpAjustada = $leyVisual; // sin descuento
        }

        // ley_lote: siempre se aplica descuento
        // lab pasa por dos descuentos (×0.9×0.9 = ×0.81), visual por uno (×0.9)
        if ($leyLab) {
            $leyLote = round($leyLab * $factor * $factor, 2);
        } elseif ($leyVisual) {
            $leyLote = round($leyVisual * $factor, 2);
        } else {
            $leyLote = null;
        }

        \Log::info('🔧 [MEZCLA DETALLE] Guardando dumpada en mezcla', [
            'dumpada_id'       => $dumpada->id,
            'numero_dumpada'   => $dumpada->numero_dumpada,
            'toneladas'        => $toneladas,
            'numero_paladas'   => $numeroPaladas,
            'ley_base'         => $leyBase,
            'ley_efectiva'     => $leyEfectiva,
            'fuente_ley'       => $fuenteLey,
            'ley_lab'          => $leyLab,
            'ley_visual'       => $leyVisual,
            'ley_dump_ajustada'=> $leyDumpAjustada,
            'ley_lote'         => $leyLote,
            'fuente'           => $leyLab ? 'LAB' : 'VISUAL',
        ]);

        return self::create([
            'mezcla_id' => $mezclaId,
            'dumpada_id' => $dumpada->id,
            'tipo' => self::TIPO_DUMPADA,
            'origen' => $dumpada->acopios ?? "Dumpada #{$dumpada->numero_dumpada}",
            'toneladas' => $toneladas,
            'numero_paladas' => $numeroPaladas,
            'ley_dump_ajustada' => $leyDumpAjustada, // lab×0.9 o visual directo
            'ley_visual' => $leyVisual,
            'ley_lote' => $leyLote, // lab×0.81 o visual×0.9
        ]);
    }

    /**
     * Método estático para crear un detalle de remanente
     *
     * IMPORTANTE: ley_dump_ajustada y ley_lote deben llegar CON factores ya aplicados.
     * calcularTotales() ya NO aplica factor adicional a ley_prom_dump ni ley_prom_lote.
     */
    public static function desdeRemanente($mezclaId, $toneladas, $leyDump, $leyVisual, $leyLote, $origen)
    {
        return self::create([
            'mezcla_id' => $mezclaId,
            'dumpada_id' => null,
            'tipo' => self::TIPO_REMANENTE,
            'origen' => $origen,
            'toneladas' => $toneladas,
            'ley_dump_ajustada' => $leyDump,    // Ley original (columna mantiene nombre legacy)
            'ley_visual' => $leyVisual,          // Ley original
            'ley_lote' => $leyLote,              // Ley original
        ]);
    }

    /**
     * Aplica el factor de ajuste a la ley dump
     * @param float|null $ley
     * @return float|null
     */
    public static function aplicarAjusteLey($ley)
    {
        if ($ley === null) {
            return null;
        }

        return round($ley * MezclaConfig::getFactorAjusteLey(), 2);
    }
}
