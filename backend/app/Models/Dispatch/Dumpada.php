<?php

namespace App\Models\Dispatch;

use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Dumpada extends Model
{
    use HasFactory;

    protected $table = 'dumpadas';

    protected $fillable = [
        'id_frente_trabajo',
        'n_acop',
        'acopios',
        'jornada',
        'fecha',
        'ton',
        'ley',
        'ley_cup',
        'certificado',
        'ley_visual',
        'rango',
        'estado',
    ];

    protected $casts = [
        'fecha' => 'date',
        'ton' => 'decimal:2',
        'ley' => 'decimal:3',
        'ley_cup' => 'decimal:3',
    ];

    // Constantes de estados
    const ESTADO_INGRESADO = 'Ingresado';
    const ESTADO_EN_ANALISIS = 'En Análisis';
    const ESTADO_COMPLETADO = 'Completado';

    // Relación: una dumpada pertenece a un frente de trabajo
    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }

    /**
     * Genera automáticamente el siguiente número de acopio para un frente específico
     *
     * @param int $idFrenteTrabajo
     * @return int
     */
    public static function generarNumeroAcopio($idFrenteTrabajo)
    {
        $ultimaDumpada = self::where('id_frente_trabajo', $idFrenteTrabajo)
                             ->orderBy('n_acop', 'desc')
                             ->first();

        return $ultimaDumpada ? ((int) $ultimaDumpada->n_acop + 1) : 1;
    }

    /**
     * Genera el código completo de acopios
     * Formato: {codigo_frente}-{turno}-{n_acopio}-{fecha}
     *
     * @param string $codigoFrente
     * @param string $turno
     * @param int $nAcopio
     * @param string $fecha
     * @return string
     */
    public static function generarCodigoAcopios($codigoFrente, $turno, $nAcopio, $fecha = null)
    {
        $fecha = $fecha ?? Carbon::now()->format('Y-m-d');
        $nAcopioFormateado = str_pad($nAcopio, 3, '0', STR_PAD_LEFT);

        return "{$codigoFrente}-{$turno}-{$nAcopioFormateado}-{$fecha}";
    }

    /**
     * Determinar el rango automáticamente basado en la ley
     *
     * @param float $ley
     * @return string|null
     */
    public static function determinarRango($ley)
    {
        $rango = Rango::obtenerRangoPorLey($ley);
        return $rango ? $rango->nomenclatura : null;
    }
}
