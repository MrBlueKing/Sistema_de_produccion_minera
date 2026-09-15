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
        'ley_lab_capado',
        'ley_visual',
        'ley_lote',
    ];

    protected $casts = [
        'toneladas' => 'decimal:2',
        'numero_paladas' => 'decimal:2',
        'toneladas_reales_origen' => 'decimal:2',
        'ley_dump_ajustada' => 'decimal:2',
        'ley_lab_capado' => 'decimal:3',
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
     * Calcula ley_lab_capado / ley_visual / ley_lote para una dumpada dada, según el
     * ley_base de la mezcla. Extraído de desdeDumpada() para poder reusarlo también
     * al RECALCULAR un detalle ya existente cuando Laboratorio actualiza la dumpada
     * después (ver refrescarDesdeDumpada() más abajo) — una sola fuente de verdad
     * para esta regla de negocio, no dos copias que se puedan desincronizar.
     *
     * REGLA DE NEGOCIO (vigente desde 2026-08): "ley dumpada" ya no existe como concepto
     * intermedio. ley_dump_ajustada queda SIEMPRE null para mezclas nuevas (se conserva la
     * columna solo por compatibilidad con mezclas viejas).
     *
     * REGLA DE NEGOCIO para ley_lote (un solo paso, por DIVISIÓN, unificado):
     *   - Si tiene ley lab: ley_lab_capado ("ley cupping") ÷ factor_ley_lote
     *   - Si solo tiene ley visual: ley_visual ÷ factor_ley_lote (misma división que con lab)
     *
     * @return array{ley_lab_capado: float|null, ley_visual: float|null, ley_lote: float|null, fuente_ley: string}
     */
    public static function calcularLeyes(Dumpada $dumpada, string $leyBase = 'auto'): array
    {
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
        $factorLeyLote = \App\Config\MezclaConfig::getFactorLeyLote();

        // ley_lote: un solo paso, por división, unificado (con o sin lab)
        if ($leyLab) {
            $leyLote = round($leyLab / $factorLeyLote, 2);
        } elseif ($leyVisual) {
            $leyLote = round($leyVisual / $factorLeyLote, 2);
        } else {
            $leyLote = null;
        }

        return [
            'ley_lab_capado' => $leyLab ?: null,
            'ley_visual'     => $leyVisual,
            'ley_lote'       => $leyLote,
            'fuente_ley'     => $fuenteLey,
        ];
    }

    /**
     * Método estático para crear un detalle desde una dumpada.
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

        $leyes = self::calcularLeyes($dumpada, $leyBase);

        \Log::info('🔧 [MEZCLA DETALLE] Guardando dumpada en mezcla', [
            'dumpada_id'       => $dumpada->id,
            'numero_dumpada'   => $dumpada->numero_dumpada,
            'toneladas'        => $toneladas,
            'numero_paladas'   => $numeroPaladas,
            'ley_base'         => $leyBase,
            'fuente_ley'       => $leyes['fuente_ley'],
            'ley_lab'          => $leyes['ley_lab_capado'],
            'ley_visual'       => $leyes['ley_visual'],
            'ley_lote'         => $leyes['ley_lote'],
            'fuente'           => $leyes['ley_lab_capado'] ? 'LAB' : 'VISUAL',
        ]);

        return self::create([
            'mezcla_id' => $mezclaId,
            'dumpada_id' => $dumpada->id,
            'tipo' => self::TIPO_DUMPADA,
            'origen' => $dumpada->acopios ?? "Dumpada #{$dumpada->numero_dumpada}",
            'toneladas' => $toneladas,
            'numero_paladas' => $numeroPaladas,
            'ley_dump_ajustada' => null, // retirado: siempre null en mezclas nuevas
            'ley_lab_capado' => $leyes['ley_lab_capado'], // ley cupping real, guardada tal cual (evita reconstruirla desde ley_lote)
            'ley_visual' => $leyes['ley_visual'],
            'ley_lote' => $leyes['ley_lote'], // (lab capado o visual) / factor_ley_lote
        ]);
    }

    /**
     * Recalcula ley_lab_capado/ley_visual/ley_lote de ESTE detalle desde el estado
     * ACTUAL de su dumpada — para cuando Laboratorio carga la ley real después de
     * que la dumpada ya estaba en una mezcla (antes quedaba "congelada" para siempre
     * con lo que había al momento de armar la mezcla). No toca toneladas/paladas.
     *
     * @return bool true si algún valor cambió (y se guardó), false si no había nada que actualizar.
     */
    public function refrescarDesdeDumpada(): bool
    {
        if ($this->tipo !== self::TIPO_DUMPADA || !$this->dumpada_id) {
            return false;
        }

        $dumpada = $this->dumpada ?? $this->dumpada()->first();
        if (!$dumpada) {
            return false;
        }

        $leyBase = $this->mezcla?->ley_base ?? 'auto';
        $leyes = self::calcularLeyes($dumpada, $leyBase);

        $cambio = $this->ley_lab_capado != $leyes['ley_lab_capado']
            || $this->ley_visual != $leyes['ley_visual']
            || $this->ley_lote != $leyes['ley_lote'];

        if (!$cambio) {
            return false;
        }

        $this->ley_lab_capado = $leyes['ley_lab_capado'];
        $this->ley_visual = $leyes['ley_visual'];
        $this->ley_lote = $leyes['ley_lote'];
        $this->save();

        return true;
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
