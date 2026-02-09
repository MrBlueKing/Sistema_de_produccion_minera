<?php

namespace App\Models\Dispatch;

use App\Models\Ingenieria\FrenteTrabajo;
use App\Models\Laboratorio\MezclaDumpada;
use App\Models\ConfiguracionSistema;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Dumpada extends Model
{
    use HasFactory;

    protected $table = 'dumpadas';

    protected $fillable = [
        'id_frente_trabajo',
        'tronadura_id',
        'user_id',
        'id_faena',
        'faena', // Deprecated: Usar id_faena en su lugar
        'numero_dumpada', // Número consecutivo único de la dumpada (antes n_acop)
        'acopios', // Código COMPLETO del acopio (ej: "ZN-PM-DIA-A001-27-11-2025")
        'jornada',
        'numero_jornada', // Número secuencial por frente+jornada+fecha
        'fecha',
        'ton',
        'ley',
        'ley_cup',
        'cu_soluble',
        'cu_insoluble',
        'certificado',
        'numero_certificado_pdf',
        'fecha_certificado_pdf',
        'ley_visual',
        'rango',
        'estado',
        // Campos para mapa de terreno
        'posicion_x',
        'posicion_y',
        'zona_id',
    ];

    protected $casts = [
        'fecha' => 'date:d-m-Y',
        'fecha_certificado_pdf' => 'datetime',
        'ton' => 'decimal:2',
        'ley' => 'decimal:3',
        'ley_cup' => 'decimal:3',
        'cu_soluble' => 'decimal:3',
        'cu_insoluble' => 'decimal:3',
    ];

    /**
     * Serializar fechas para JSON sin convertir a UTC
     * Esto evita que JavaScript interprete las fechas como UTC
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

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
     * Relación: una dumpada puede pertenecer a una tronadura
     */
    public function tronadura()
    {
        return $this->belongsTo(Tronadura::class, 'tronadura_id');
    }

    /**
     * Relación: una dumpada puede estar en una mezcla
     * Retorna el registro de mezcla_dumpada si existe
     */
    public function mezclaDumpada()
    {
        return $this->hasOne(MezclaDumpada::class, 'dumpada_id');
    }

    /**
     * Relación: obtener la mezcla a la que pertenece esta dumpada
     */
    public function mezcla()
    {
        return $this->hasOneThrough(
            \App\Models\Laboratorio\Mezcla::class,
            MezclaDumpada::class,
            'dumpada_id',  // FK en mezcla_dumpada
            'id',          // FK en mezclas
            'id',          // PK en dumpadas
            'mezcla_id'    // PK en mezcla_dumpada
        );
    }

    /**
     * Relación: zona de terreno a la que pertenece la dumpada
     */
    public function zona()
    {
        return $this->belongsTo(\App\Models\ZonaTerreno::class, 'zona_id');
    }

    /**
     * Relación: un dumpada puede pertenecer a un acopio (a través de pivot)
     */
    public function acopio()
    {
        return $this->belongsToMany(
            Acopio::class,
            'acopio_dumpada',
            'dumpada_id',
            'acopio_id'
        )->withTimestamps();
    }

    /**
     * Obtener el acopio al que pertenece (solo uno)
     */
    public function getAcopioAsignado()
    {
        return $this->acopio()->first();
    }

    /**
     * Verificar si la dumpada está incluida en alguna mezcla
     */
    public function estaEnMezcla()
    {
        return $this->mezclaDumpada()->exists();
    }

    /**
     * Verificar si la dumpada está en un acopio
     */
    public function estaEnAcopio()
    {
        return $this->acopio()->exists();
    }

    /**
     * Genera automáticamente el siguiente número de dumpada global
     * El número de dumpada es único y secuencial independiente del frente de trabajo
     *
     * @return int
     */
    public static function generarNumeroDumpada()
    {
        // IMPORTANTE: numero_dumpada es tipo string en la BD, pero contiene números
        // MAX() sobre strings ordena alfabéticamente: "999" > "4307" (incorrecto)
        // Solución: Obtener TODOS los valores, convertir a int y obtener el máximo en PHP

        $maxDumpada = self::whereNotNull('numero_dumpada')
            ->where('numero_dumpada', '!=', '')
            ->pluck('numero_dumpada')
            ->map(fn($val) => (int) $val) // Convertir cada valor a entero
            ->max(); // Obtener el máximo numérico real

        // Si no hay registros, empezar en 1
        return $maxDumpada ? ($maxDumpada + 1) : 1;
    }

    /**
     * DEPRECATED: Usar generarNumeroDumpada() en su lugar
     * Se mantiene por compatibilidad con código antiguo
     */
    public static function generarNumeroAcopio($idFrenteTrabajo = null)
    {
        return self::generarNumeroDumpada();
    }

    /**
     * Genera el siguiente número de jornada para una combinación específica de:
     * frente de trabajo + jornada + fecha
     *
     * El número se reinicia a 1 cuando cambia cualquiera de estos 3 parámetros
     *
     * @param int $idFrenteTrabajo
     * @param string $jornada (AM, PM, Madrugada, Noche)
     * @param string $fecha (formato Y-m-d)
     * @return int
     */
    public static function generarNumeroJornada($idFrenteTrabajo, $jornada, $fecha)
    {
        $maxNumero = self::where('id_frente_trabajo', $idFrenteTrabajo)
            ->where('jornada', $jornada)
            ->whereDate('fecha', $fecha)
            ->max('numero_jornada');

        return $maxNumero ? ($maxNumero + 1) : 1;
    }

    /**
     * DEPRECATED: Ya no se genera el código completo de acopios en el modelo Dumpada
     * Ahora el campo 'acopios' almacena solo el código del acopio (ej: "A-001")
     * El código completo se maneja en el modelo Acopio
     */

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

    /**
     * Calcular el capping de la ley (ley_cup)
     * Si la ley supera el máximo configurado, se limita a ese valor
     *
     * @param float $ley
     * @param int|null $idFaena
     * @return float
     */
    public static function calcularCapping($ley, $idFaena = null)
    {
        $cappingMaximo = ConfiguracionSistema::obtener('ley_capping_maximo', 3, $idFaena);

        return $ley > $cappingMaximo ? $cappingMaximo : $ley;
    }

    /**
     * Generar el código completo de la dumpada
     * Formato: "{codigo_frente} {fecha} {jornada} {numero_jornada}"
     * Ejemplo: "M3 -11N 29.09.2025 PM 1"
     *
     * @return string|null
     */
    public function generarCodigoCompleto()
    {
        $frente = $this->frenteTrabajo;

        if (!$frente) {
            return null;
        }

        $codigoFrente = $frente->codigo_completo ?? $frente->codigo ?? '';
        $fecha = $this->fecha ? Carbon::parse($this->fecha)->format('d.m.Y') : '';
        $jornada = $this->jornada ?? '';
        $numeroJornada = $this->numero_jornada ?? '';

        return trim("{$codigoFrente} {$fecha} {$jornada} {$numeroJornada}");
    }

    /**
     * Accessor para obtener el código completo de la dumpada
     */
    public function getCodigoCompletoAttribute()
    {
        return $this->generarCodigoCompleto();
    }

    /**
     * Verificar si la dumpada tiene análisis de laboratorio completo
     * (tiene ley, cu_soluble, cu_insoluble y certificado)
     *
     * @return bool
     */
    public function tieneAnalisisCompleto()
    {
        return !is_null($this->ley)
            && !is_null($this->cu_soluble)
            && !is_null($this->cu_insoluble)
            && !is_null($this->certificado);
    }

    /**
     * Scope para filtrar dumpadas con análisis completo (para certificados)
     */
    public function scopeConAnalisisCompleto($query)
    {
        return $query->whereNotNull('ley')
            ->whereNotNull('cu_soluble')
            ->whereNotNull('cu_insoluble')
            ->whereNotNull('certificado');
    }

    /**
     * Scope para filtrar dumpadas por número de certificado PDF
     */
    public function scopePorCertificadoPdf($query, $numeroCertificado)
    {
        return $query->where('numero_certificado_pdf', $numeroCertificado);
    }

    /**
     * Verificar si la dumpada tiene certificado PDF generado
     */
    public function tieneCertificadoPdf()
    {
        return !is_null($this->numero_certificado_pdf);
    }
}
