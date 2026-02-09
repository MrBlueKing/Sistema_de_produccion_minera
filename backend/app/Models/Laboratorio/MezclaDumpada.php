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
        'ley_dump_ajustada',
        'ley_visual',
        'ley_lote',
    ];

    protected $casts = [
        'toneladas' => 'decimal:2',
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
     * Método estático para crear un detalle desde una dumpada
     * IMPORTANTE: Guarda las leyes ORIGINALES sin ajustar, EXCEPTO ley_lote.
     * ley_lote se guarda CON factor 0.81 aplicado para coincidir con el preview.
     * El factor 0.9 adicional se aplica al calcular promedios en Mezcla::calcularTotales()
     */
    public static function desdeDumpada(Dumpada $dumpada, $mezclaId)
    {
        // Guardar leyes originales SIN aplicar factor
        $leyDump = $dumpada->ley;
        $leyVisual = $dumpada->ley_visual;

        // IMPORTANTE: ley_lote se guarda CON factor 0.81 (0.9 × 0.9) y REDONDEADO
        // Esto coincide con cómo se calcula en Acopio::recalcularTotales() línea 222 y 238
        // y con el preview en MezclasView.jsx que usa ley_lote_promedio del acopio
        $leyLote = $leyDump ? round($leyDump * 0.81, 2) : null;

        \Log::info('🔧 [MEZCLA DETALLE] Guardando dumpada en mezcla', [
            'dumpada_id' => $dumpada->id,
            'numero_dumpada' => $dumpada->numero_dumpada,
            'toneladas' => $dumpada->ton,
            'ley_dump_original' => $leyDump,
            'ley_lote_calculada' => $leyLote,
            'calculo' => $leyDump ? "{$leyDump} × 0.81 = " . ($leyDump * 0.81) . " → round = {$leyLote}" : 'NULL'
        ]);

        return self::create([
            'mezcla_id' => $mezclaId,
            'dumpada_id' => $dumpada->id,
            'tipo' => self::TIPO_DUMPADA,
            'origen' => $dumpada->acopios ?? "Dumpada #{$dumpada->numero_dumpada}",
            'toneladas' => $dumpada->ton,
            'ley_dump_ajustada' => $leyDump, // Guardar ley original (columna mantiene nombre legacy)
            'ley_visual' => $leyVisual, // Guardar ley visual original
            'ley_lote' => $leyLote, // Guardar con factor 0.81 aplicado
        ]);
    }

    /**
     * Método estático para crear un detalle de remanente
     *
     * IMPORTANTE: Este método recibe las leyes ORIGINALES (sin ajustar)
     * El factor 0.9 se aplicará al calcular promedios en Mezcla::calcularTotales()
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
