<?php

namespace App\Models\Laboratorio;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lote extends Model
{
    use HasFactory;

    protected $table = 'lotes';

    protected $fillable = [
        'numero_lote',
        'planta_id',
        'empresa_id',
        'id_faena',
        'fecha_creacion',
        'fecha_estimada_llegada',
        'estado',
        'observaciones',
        'user_id',
    ];

    protected $casts = [
        'fecha_creacion' => 'date',
        'fecha_estimada_llegada' => 'date',
    ];

    // Estados del lote
    const ESTADO_ABIERTO = 'Abierto';
    const ESTADO_COMPLETADO = 'Completado';

    public function planta()
    {
        return $this->belongsTo(Planta::class, 'planta_id');
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class, 'empresa_id');
    }

    public function camionadas()
    {
        return $this->hasMany(Camionada::class, 'lote_id');
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

    public function getPesoTotal()
    {
        return $this->camionadas()->sum('peso');
    }

    public function getPesoRecibido()
    {
        return $this->camionadas()
            ->whereNotNull('peso_real')
            ->sum('peso_real');
    }

    public function getNumeroCamionadas()
    {
        return $this->camionadas()->count();
    }

    /**
     * Calcular remanente del lote
     * Remanente = Peso Teórico Total - Peso Real Total
     * Positivo: quedó material de sobra en origen
     * Negativo: llegó más material del esperado
     */
    public function getRemanente()
    {
        $pesoTeorico = $this->camionadas()->sum('peso');
        $pesoReal = $this->camionadas()
            ->whereNotNull('peso_real')
            ->sum('peso_real');

        return round($pesoTeorico - $pesoReal, 2);
    }

    /**
     * Verificar si todas las camionadas están recepcionadas
     * Una camionada está recepcionada cuando su estado es "Recibido" o "Completado"
     */
    public function todasCamionadasRecepcionadas()
    {
        $total = $this->camionadas()->count();
        $recepcionadas = $this->camionadas()
            ->whereIn('estado', [
                \App\Models\Laboratorio\Camionada::ESTADO_RECIBIDO,
                \App\Models\Laboratorio\Camionada::ESTADO_COMPLETADO
            ])
            ->count();

        return $total > 0 && $total === $recepcionadas;
    }

    /**
     * Cerrar lote (cambiar estado a Completado)
     * Identifica mezclas con toneladas disponibles (remanentes)
     * Opcionalmente crea una nueva mezcla de remanente basada en paladas recogidas
     *
     * @param array $datos Datos opcionales:
     *   - numero_paladas: Número de paladas recogidas
     *   - toneladas_remanente: Toneladas directas (si no se usan paladas)
     *   - observaciones_remanente: Observaciones del remanente
     * @return array
     */
    public function cerrar(array $datos = [])
    {
        if (!$this->todasCamionadasRecepcionadas()) {
            throw new \Exception('No se puede cerrar el lote. Aún hay camionadas sin recepcionar.');
        }

        \DB::beginTransaction();

        try {
            // Obtener todas las mezclas únicas usadas en este lote
            $mezclasIds = $this->camionadas()
                ->distinct()
                ->pluck('mezcla_id')
                ->toArray();

            $mezclasConRemanente = [];

            // Por cada mezcla, verificar si tiene remanente disponible
            foreach ($mezclasIds as $mezclaId) {
                $mezcla = Mezcla::find($mezclaId);

                if (!$mezcla) {
                    continue;
                }

                // Si la mezcla tiene toneladas disponibles, agregar a la lista
                if ($mezcla->tieneToneladasDisponibles()) {
                    $mezclasConRemanente[] = [
                        'mezcla_id' => $mezcla->id,
                        'codigo' => $mezcla->codigo,
                        'toneladas_disponibles' => $mezcla->toneladas_disponibles,
                        'ley_prom_dump' => $mezcla->ley_prom_dump,
                        'ley_prom_visual' => $mezcla->ley_prom_visual,
                        'ley_prom_lote' => $mezcla->ley_prom_lote,
                    ];
                }
            }

            // Crear remanente basado en paladas si viene el dato
            $remanenteCreado = null;
            if (!empty($datos['numero_paladas']) || !empty($datos['toneladas_remanente'])) {
                $remanenteCreado = $this->crearRemanenteDesdelLote($datos);
            }

            // Cambiar estado del lote a Completado
            $this->estado = self::ESTADO_COMPLETADO;
            $this->save();

            \DB::commit();

            return [
                'lote' => $this,
                'remanentes_disponibles' => $mezclasConRemanente,
                'remanente_creado' => $remanenteCreado
            ];

        } catch (\Exception $e) {
            \DB::rollBack();
            throw $e;
        }
    }

    /**
     * Crear una mezcla de remanente desde el lote
     * Basado en paladas o toneladas directas
     *
     * @param array $datos
     * @return Mezcla
     */
    protected function crearRemanenteDesdelLote(array $datos)
    {
        // Obtener configuración de toneladas por palada
        $config = \App\Models\ConfiguracionSistema::where('clave', 'toneladas_por_palada')->first();
        $toneladasPorPalada = $config ? (float) $config->valor : 1.82;

        // Calcular toneladas
        if (!empty($datos['numero_paladas'])) {
            // Usar paladas
            $numeroPaladas = (int) $datos['numero_paladas'];
            $toneladas = $numeroPaladas * $toneladasPorPalada;
        } else {
            // Usar toneladas directas
            $toneladas = (float) $datos['toneladas_remanente'];
            $numeroPaladas = null;
        }

        // Obtener la mezcla más usada en el lote para heredar planta y leyes promedio
        $mezclaBase = $this->camionadas()
            ->with('mezcla')
            ->get()
            ->groupBy('mezcla_id')
            ->sortByDesc(function ($camionadas) {
                return $camionadas->count();
            })
            ->first()
            ?->first()
            ?->mezcla;

        if (!$mezclaBase) {
            throw new \Exception('No se pudo determinar la mezcla base para crear el remanente');
        }

        // Generar código para el remanente
        $codigo = Mezcla::generarCodigo($mezclaBase->planta_id, 'REM');

        // Crear nueva mezcla de remanente
        $remanente = Mezcla::create([
            'codigo' => $codigo,
            'fecha' => now(),
            'planta_id' => $mezclaBase->planta_id,
            'total_ton' => $toneladas,
            'toneladas_disponibles' => $toneladas,
            'toneladas_despachadas' => 0,
            'ley_prom_dump' => $mezclaBase->ley_prom_dump,
            'ley_prom_visual' => $mezclaBase->ley_prom_visual,
            'ley_prom_lote' => $mezclaBase->ley_prom_lote,
            'ley_lab' => $mezclaBase->ley_lab,
            'estado' => Mezcla::ESTADO_CONFIRMADO,
            'es_remanente' => true,
            'lote_origen_id' => $this->id,
            'numero_paladas' => $numeroPaladas,
            'observaciones' => $datos['observaciones_remanente'] ?? "Remanente del lote {$this->numero_lote}",
        ]);

        return $remanente->fresh('planta');
    }


    /**
     * Obtener lotes abiertos para una combinación de planta + empresa
     */
    public static function obtenerLotesAbiertos($plantaId, $empresaId)
    {
        return self::where('planta_id', $plantaId)
            ->where('empresa_id', $empresaId)
            ->where('estado', self::ESTADO_ABIERTO)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Obtener o crear un lote abierto para una combinación de planta + empresa
     * Si existe un lote abierto, lo devuelve. Si no, crea uno nuevo.
     */
    public static function obtenerOCrearLote($plantaId, $empresaId)
    {
        // Buscar lote abierto existente para esta combinación
        $loteAbierto = self::where('planta_id', $plantaId)
            ->where('empresa_id', $empresaId)
            ->where('estado', self::ESTADO_ABIERTO)
            ->orderBy('created_at', 'desc')
            ->first();

        // Si existe, devolverlo con relaciones
        if ($loteAbierto) {
            return $loteAbierto->load(['planta', 'empresa']);
        }

        // Si no existe, crear uno nuevo
        $numeroLote = self::generarNumeroLote($plantaId, $empresaId);

        $nuevoLote = self::create([
            'numero_lote' => $numeroLote,
            'planta_id' => $plantaId,
            'empresa_id' => $empresaId,
            'fecha_creacion' => now(),
            'estado' => self::ESTADO_ABIERTO,
        ]);

        return $nuevoLote->load(['planta', 'empresa']);
    }

    /**
     * Generar número de lote basado en planta y empresa
     */
    public static function generarNumeroLote($plantaId, $empresaId)
    {
        $planta = Planta::find($plantaId);
        $empresa = Empresa::find($empresaId);

        $prefijoPlanta = $planta->codigo ?? 'P';
        $prefijoEmpresa = $empresa->codigo ?? 'E';

        $prefijo = $prefijoPlanta . '-' . $prefijoEmpresa . '-';

        $ultimoLote = self::where('numero_lote', 'like', $prefijo . '%')
            ->orderBy('numero_lote', 'desc')
            ->first();

        if (!$ultimoLote) {
            return $prefijo . '001';
        }

        $ultimoNumero = (int) substr($ultimoLote->numero_lote, strlen($prefijo));
        $nuevoNumero = $ultimoNumero + 1;

        return $prefijo . str_pad($nuevoNumero, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Obtener nombre descriptivo del lote
     */
    public function getNombreCompletoAttribute()
    {
        return "{$this->planta->nombre} - {$this->empresa->nombre}";
    }

    /**
     * Calcular ley lote promedio ponderada
     * Promedio ponderado de ley_prom_lote de las mezclas por tonelaje de camionadas recepcionadas
     *
     * @return float|null
     */
    public function getLeyLotePromedio()
    {
        // Obtener camionadas recepcionadas con sus mezclas
        $camionadas = $this->camionadas()
            ->with('mezcla')
            ->whereNotNull('peso_real')
            ->get();

        if ($camionadas->isEmpty()) {
            return null;
        }

        $sumaProductos = 0;
        $sumaToneladas = 0;

        foreach ($camionadas as $camionada) {
            if ($camionada->mezcla && $camionada->mezcla->ley_prom_lote !== null) {
                $tonelaje = $camionada->peso_real;
                $ley = $camionada->mezcla->ley_prom_lote;

                $sumaProductos += ($tonelaje * $ley);
                $sumaToneladas += $tonelaje;
            }
        }

        if ($sumaToneladas == 0) {
            return null;
        }

        return round($sumaProductos / $sumaToneladas, 2);
    }

    /**
     * Calcular ley visual promedio ponderada
     * Promedio ponderado de ley_prom_visual de las mezclas por tonelaje de camionadas recepcionadas
     *
     * @return float|null
     */
    public function getLeyVisualPromedio()
    {
        // Obtener camionadas recepcionadas con sus mezclas
        $camionadas = $this->camionadas()
            ->with('mezcla')
            ->whereNotNull('peso_real')
            ->get();

        if ($camionadas->isEmpty()) {
            return null;
        }

        $sumaProductos = 0;
        $sumaToneladas = 0;

        foreach ($camionadas as $camionada) {
            if ($camionada->mezcla && $camionada->mezcla->ley_prom_visual !== null) {
                $tonelaje = $camionada->peso_real;
                $ley = $camionada->mezcla->ley_prom_visual;

                $sumaProductos += ($tonelaje * $ley);
                $sumaToneladas += $tonelaje;
            }
        }

        if ($sumaToneladas == 0) {
            return null;
        }

        return round($sumaProductos / $sumaToneladas, 2);
    }
}
