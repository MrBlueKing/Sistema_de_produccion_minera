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
        'user_id',
        'faena',
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
        'fecha' => 'date:d-m-Y',
        'ton' => 'decimal:2',
        'ley' => 'decimal:3',
        'ley_cup' => 'decimal:3',
    ];

    protected $dateFormat = 'Y-m-d';

    // Constantes de estados
    // Solo se usan 2 estados porque el laboratorio siempre envía los 3 datos juntos
    const ESTADO_INGRESADO = 'Ingresado';      // Muestra enviada al laboratorio (sin resultados)
    const ESTADO_EN_ANALISIS = 'En Análisis';  // NO SE USA (por compatibilidad con BD)
    const ESTADO_COMPLETADO = 'Completado';    // Resultados recibidos del laboratorio

    // Relación: una dumpada pertenece a un frente de trabajo
    public function frenteTrabajo()
    {
        return $this->belongsTo(FrenteTrabajo::class, 'id_frente_trabajo');
    }

    /**
     * Genera automáticamente el siguiente número de acopio global (para todas las dumpadas)
     * El número de acopio es único y secuencial independiente del frente de trabajo
     *
     * @param int $idFrenteTrabajo (no se usa, se mantiene por compatibilidad)
     * @return int
     */
    public static function generarNumeroAcopio($idFrenteTrabajo = null)
    {
        // Obtener el último número de acopio global (de todas las dumpadas)
        $ultimaDumpada = self::orderBy('n_acop', 'desc')->first();

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
        // Formato de fecha: d-m-Y (día-mes-año)
        $fechaFormateada = $fecha ? Carbon::parse($fecha)->format('d-m-Y') : Carbon::now()->format('d-m-Y');
        $nAcopioFormateado = str_pad($nAcopio, 3, '0', STR_PAD_LEFT);

        return "{$codigoFrente}-{$turno}-{$nAcopioFormateado}-{$fechaFormateada}";
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
