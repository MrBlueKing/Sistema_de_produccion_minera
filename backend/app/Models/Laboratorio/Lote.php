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
        'fecha_cierre',
        'observaciones',
        'user_id',
        'ley_paquete_primera',
        'fecha_ley_paquete_primera',
        'ley_paquete_segunda',
        'fecha_ley_paquete_segunda',
        'ley_paquete_segunda_prima',
        'fecha_ley_paquete_segunda_prima',
        'ley_canje',
        'fecha_ley_canje',
        'enviado_a_tercero',
        'ley_paquete_tercera',
        'fecha_ley_paquete_tercera',
        'estado_laboratorio',
        'liquidacion_numero',
        'liquidacion_tasa_cambio',
        'liquidacion_saldo_real_usd',
        'liquidacion_saldo_real_clp',
        'liquidacion_saldo_calculado_usd',
        'liquidacion_saldo_calculado_clp',
        'fecha_liquidacion',
        'anticipo_monto',
        'fecha_anticipo',
        'pago_monto',
        'fecha_pago',
    ];

    protected $casts = [
        'fecha_creacion' => 'date',
        'fecha_apertura' => 'datetime',
        'fecha_estimada_llegada' => 'date',
        'fecha_cierre' => 'date',
        'ley_paquete_primera' => 'float',
        'fecha_ley_paquete_primera' => 'datetime',
        'ley_paquete_segunda' => 'float',
        'fecha_ley_paquete_segunda' => 'datetime',
        'ley_paquete_segunda_prima' => 'float',
        'fecha_ley_paquete_segunda_prima' => 'datetime',
        'ley_canje' => 'float',
        'fecha_ley_canje' => 'datetime',
        'enviado_a_tercero' => 'boolean',
        'ley_paquete_tercera' => 'float',
        'fecha_ley_paquete_tercera' => 'datetime',
        'liquidacion_tasa_cambio' => 'float',
        'liquidacion_saldo_real_usd' => 'float',
        'liquidacion_saldo_real_clp' => 'float',
        'liquidacion_saldo_calculado_usd' => 'float',
        'liquidacion_saldo_calculado_clp' => 'float',
        'fecha_liquidacion' => 'datetime',
        'anticipo_monto' => 'float',
        'fecha_anticipo' => 'datetime',
        'pago_monto' => 'float',
        'fecha_pago' => 'datetime',
    ];

    /**
     * Apertura del lote = momento en que recibe su número de lote (al crearlo ya
     * numerado, al editarlo o al importarlo). Si se le quita el número vuelve a
     * quedar sin apertura, y se registra de nuevo cuando lo reciba.
     */
    protected static function booted(): void
    {
        static::saving(function (Lote $lote) {
            $tieneNumero = trim((string) $lote->numero_lote) !== '';
            $teniaNumero = trim((string) $lote->getOriginal('numero_lote')) !== '';

            if (!$tieneNumero) {
                $lote->fecha_apertura = null;
            } elseif (!$teniaNumero || !$lote->fecha_apertura) {
                $lote->fecha_apertura = now();
            }
        });
    }

    // Estados del lote (Dispatch)
    const ESTADO_ABIERTO = 'Abierto';
    const ESTADO_COMPLETADO = 'Completado';

    // Estados de la reconciliación de leyes (Laboratorio) — independientes de `estado`.
    // Solo cambian en 2 hitos: cargar Segunda, y cargar Canje (o mandar a Tercero).
    // Cargar Segunda Prima o Primera NO mueve el estado — son pasos intermedios.
    const ESTADO_LAB_CERRADO = 'Cerrado';
    const ESTADO_LAB_CON_SEGUNDA = 'Con Paquete Segunda';
    const ESTADO_LAB_CANJEADO = 'Canjeado';
    const ESTADO_LAB_EN_TERCERO = 'En Tercero';
    const ESTADO_LAB_RESUELTO_TERCERO = 'Resuelto por Tercero';

    // Continuación comercial (cuaderno del usuario), después de resuelto el canje.
    const ESTADO_LAB_LIQUIDADO = 'Liquidado';
    const ESTADO_LAB_CON_ANTICIPO = 'Con Anticipo';
    const ESTADO_LAB_PAGADO = 'Pagado';

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
        return $this->hasMany(Camionada::class, 'lote_id')->orderBy('numero_camionada', 'asc');
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
        return $this->camionadas->sum('peso');
    }

    public function getPesoRecibido()
    {
        return $this->camionadas
            ->whereNotNull('peso_real')
            ->sum('peso_real');
    }

    /**
     * Peso teórico PENDIENTE: solo el peso declarado de camionadas que
     * TODAVÍA no se recepcionan (peso_real IS NULL). A diferencia de
     * getPesoTotal() (que suma el teórico de TODAS, recepcionadas o no —
     * se usa para el Remanente), este método es para "Despachado = Real +
     * Teórico", donde una camionada ya recepcionada deja de contar como
     * teórico y pasa completa a Real.
     */
    public function getPesoTeoricoPendiente()
    {
        return $this->camionadas
            ->whereNull('peso_real')
            ->sum('peso');
    }

    /**
     * Despachado = Real + Teórico: peso real de las camionadas ya recepcionadas
     * más el teórico declarado de las que aún no llegan — converge hacia
     * getPesoRecibido() a medida que se recepcionan, nunca al revés. Mismo
     * criterio que reporteProduccion()/buscarLotes() en GerencialController;
     * NO usar getPesoTotal() para esto, que es el teórico de TODAS las
     * camionadas sin importar si ya se recepcionaron (sirve para Remanente,
     * no para "Despachado").
     */
    public function getPesoDespachado()
    {
        return $this->getPesoRecibido() + $this->getPesoTeoricoPendiente();
    }

    public function getNumeroCamionadas()
    {
        return $this->camionadas->count();
    }

    /**
     * Calcular remanente del lote
     * Remanente = Peso Teórico Total - Peso Real Total
     * Positivo: quedó material de sobra en origen
     * Negativo: llegó más material del esperado
     */
    public function getRemanente()
    {
        return round($this->getPesoTotal() - $this->getPesoRecibido(), 2);
    }

    /**
     * Verificar si todas las camionadas están recepcionadas
     * Una camionada está recepcionada cuando su estado es "Recibido" o "Completado"
     */
    public function todasCamionadasRecepcionadas()
    {
        $total = $this->camionadas->count();
        $recepcionadas = $this->camionadas
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
            // Obtener todas las mezclas únicas usadas en este lote (via pivot)
            $camionadaIds = $this->camionadas()->pluck('camionadas.id');
            $mezclasIds = \DB::table('camionada_mezcla')
                ->whereIn('camionada_id', $camionadaIds)
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
            // fecha_cierre = fecha real de la última camionada recepcionada, no now():
            // si el lote se reabre y se vuelve a cerrar sin agregar camionadas nuevas,
            // queda con la fecha operativa real en vez de la fecha de la acción administrativa.
            $this->estado = self::ESTADO_COMPLETADO;
            $this->fecha_cierre = $this->camionadas()->max('fecha_recepcion') ?? now()->toDateString();
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
     * Reabrir un lote Completado (volverlo a Abierto).
     *
     * Se bloquea si el lote ya generó una mezcla de remanente al cerrarse
     * (basada en paladas contadas a mano) porque no hay forma segura de
     * revertir eso automáticamente: esa mezcla puede ya haberse usado en
     * camionadas posteriores.
     */
    public function reabrir()
    {
        if ($this->estado !== self::ESTADO_COMPLETADO) {
            throw new \Exception('Solo se puede reabrir un lote Completado.');
        }

        $tieneRemanente = Mezcla::where('lote_origen_id', $this->id)
            ->where('es_remanente', true)
            ->exists();

        if ($tieneRemanente) {
            throw new \Exception('Este lote generó una mezcla de remanente al cerrarse y no se puede reabrir automáticamente. Contacta al administrador.');
        }

        $this->estado = self::ESTADO_ABIERTO;
        $this->fecha_cierre = null;
        $this->save();

        return $this;
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
        $mezclaBase = \DB::table('camionada_mezcla')
            ->whereIn('camionada_id', $this->camionadas()->pluck('camionadas.id'))
            ->select('mezcla_id', \DB::raw('COUNT(*) as total'))
            ->groupBy('mezcla_id')
            ->orderByDesc('total')
            ->first();

        $mezclaBase = $mezclaBase ? \App\Models\Laboratorio\Mezcla::find($mezclaBase->mezcla_id) : null;

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
        $numeroLote = self::generarNumeroLote($plantaId);

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
     * Generar número de lote basado solo en planta
     * Formato: {planta.codigo}-{###} correlativo global por planta
     * Ejemplo: CN-001, CN-002
     */
    public static function generarNumeroLote($plantaId)
    {
        $planta = Planta::find($plantaId);
        $prefijoPlanta = $planta->codigo ?? 'P';
        $prefijo = $prefijoPlanta . '-';

        $ultimoLote = self::where('numero_lote', 'like', $prefijo . '%')
            ->orderByRaw("CAST(SUBSTRING(numero_lote, ?) AS UNSIGNED) DESC", [strlen($prefijo) + 1])
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
        $camionadas = $this->camionadas->whereNotNull('peso_real');

        if ($camionadas->isEmpty()) {
            return null;
        }

        $sumaProductos = 0;
        $sumaToneladas = 0;

        foreach ($camionadas as $camionada) {
            $totalPivot = $camionada->mezclas->sum('pivot.toneladas');
            if ($totalPivot <= 0) continue;

            foreach ($camionada->mezclas as $mezcla) {
                if ($mezcla->ley_prom_lote === null) continue;
                $ton = $camionada->peso_real * ($mezcla->pivot->toneladas / $totalPivot);
                $sumaProductos += $ton * $mezcla->ley_prom_lote;
                $sumaToneladas += $ton;
            }
        }

        return $sumaToneladas == 0 ? null : round($sumaProductos / $sumaToneladas, 2);
    }

    /**
     * Calcular ley lab promedio ponderada
     * Promedio ponderado de ley_lab de las mezclas por tonelaje de camionadas recepcionadas
     *
     * @return float|null
     */
    public function getLeyLabPromedio()
    {
        $camionadas = $this->camionadas->whereNotNull('peso_real');

        if ($camionadas->isEmpty()) {
            return null;
        }

        $sumaProductos = 0;
        $sumaToneladas = 0;

        foreach ($camionadas as $camionada) {
            $totalPivot = $camionada->mezclas->sum('pivot.toneladas');
            if ($totalPivot <= 0) continue;

            foreach ($camionada->mezclas as $mezcla) {
                if ($mezcla->ley_lab === null) continue;
                $ton = $camionada->peso_real * ($mezcla->pivot->toneladas / $totalPivot);
                $sumaProductos += $ton * $mezcla->ley_lab;
                $sumaToneladas += $ton;
            }
        }

        return $sumaToneladas == 0 ? null : round($sumaProductos / $sumaToneladas, 2);
    }

    /**
     * Calcular ley visual promedio ponderada
     * Promedio ponderado de ley_prom_visual de las mezclas por tonelaje de camionadas recepcionadas
     *
     * @return float|null
     */
    public function getLeyVisualPromedio()
    {
        $camionadas = $this->camionadas->whereNotNull('peso_real');

        if ($camionadas->isEmpty()) {
            return null;
        }

        $sumaProductos = 0;
        $sumaToneladas = 0;

        foreach ($camionadas as $camionada) {
            $totalPivot = $camionada->mezclas->sum('pivot.toneladas');
            if ($totalPivot <= 0) continue;

            foreach ($camionada->mezclas as $mezcla) {
                if ($mezcla->ley_prom_visual === null) continue;
                $ton = $camionada->peso_real * ($mezcla->pivot->toneladas / $totalPivot);
                $sumaProductos += $ton * $mezcla->ley_prom_visual;
                $sumaToneladas += $ton;
            }
        }

        return $sumaToneladas == 0 ? null : round($sumaProductos / $sumaToneladas, 2);
    }

    /**
     * Recalcular `estado_laboratorio`. Solo cambia en hitos concretos: cargar
     * la Ley Paquete Segunda, llegar a Canje (o mandar a Tercero cuando no
     * hay acuerdo), y después la parte comercial (Liquidado -> Con Anticipo
     * -> Pagado). Cargar Segunda Prima o Primera NO mueve el estado — son
     * datos intermedios que se acumulan antes del canje, no un hito propio.
     */
    public function actualizarEstadoLaboratorio(): void
    {
        if ($this->pago_monto !== null) {
            $this->estado_laboratorio = self::ESTADO_LAB_PAGADO;
        } elseif ($this->anticipo_monto !== null) {
            $this->estado_laboratorio = self::ESTADO_LAB_CON_ANTICIPO;
        } elseif ($this->liquidacion_numero !== null) {
            $this->estado_laboratorio = self::ESTADO_LAB_LIQUIDADO;
        } elseif ($this->ley_paquete_tercera !== null) {
            $this->estado_laboratorio = self::ESTADO_LAB_RESUELTO_TERCERO;
        } elseif ($this->enviado_a_tercero) {
            $this->estado_laboratorio = self::ESTADO_LAB_EN_TERCERO;
        } elseif ($this->ley_canje !== null) {
            $this->estado_laboratorio = self::ESTADO_LAB_CANJEADO;
        } elseif ($this->ley_paquete_segunda !== null) {
            $this->estado_laboratorio = self::ESTADO_LAB_CON_SEGUNDA;
        } else {
            $this->estado_laboratorio = self::ESTADO_LAB_CERRADO;
        }

        $this->save();
    }

    /**
     * Calcula el Saldo Líquido esperado de la liquidación de este lote,
     * replicando la fórmula de la Circular de Tarifas ENAMI (ver Excel de
     * verificación del usuario, calza 100% contra la liquidación real L
     * 41356). Usa la ley YA RESUELTA del paquete (Canje, o Tercera si no
     * hubo acuerdo) y el peso realmente recibido de las camionadas.
     *
     * Sin `$tasaCambio` (es semanal, no vive en la Tarifa mensual) solo se
     * puede devolver el valor en USD — sirve como preview antes de tener la
     * liquidación real, que es la que trae la tasa de cambio aplicada.
     *
     * @param float|null $tasaCambio
     * @return array{valor_unitario_cobre: float, importe_usd: float, iva_usd: float, fondo_estabilizacion_usd: float, saldo_liquido_usd: float, saldo_liquido_clp: float|null}|array{error: string}
     */
    public function calcularSaldoLiquidoEsperado(?float $tasaCambio = null): array
    {
        $leyResuelta = $this->ley_canje ?? $this->ley_paquete_tercera;
        if ($leyResuelta === null) {
            return ['error' => 'El lote todavía no tiene una ley resuelta (Canje o Tercera).'];
        }

        $pesoRecibido = $this->getPesoRecibido();
        if (!$pesoRecibido) {
            return ['error' => 'El lote no tiene peso recibido (camionadas sin recepcionar).'];
        }

        $tarifa = Tarifa::vigentePara($this->fecha_cierre);
        if (!$tarifa) {
            $mesAnio = $this->fecha_cierre ? \Carbon\Carbon::parse($this->fecha_cierre)->format('m/Y') : 'sin fecha de cierre';
            return ['error' => "No hay una tarifa cargada para {$mesAnio}."];
        }

        $diferenciaLey = $tarifa->ley_base - $leyResuelta;
        $ajusteEscala = $diferenciaLey * $tarifa->escala;
        $valorUnitarioCobre = $tarifa->tarifa_base - $ajusteEscala;
        $importeUsd = $valorUnitarioCobre * $pesoRecibido;
        $ivaUsd = $importeUsd * $tarifa->iva_porcentaje;
        $totalFacturaUsd = $importeUsd + $ivaUsd;
        // El Fondo de Estabilización se SUMA al Subtotal y se RESTA como descuento en la
        // liquidación real de ENAMI — efecto neto CERO. No se resta del saldo líquido; se
        // sigue calculando/mostrando solo como referencia. Verificado contra 2 liquidaciones
        // reales (L 41356 y L 41394, ver session_produccion_2026_08_28) — restarlo dejaba el
        // saldo ~8% bajo lo que ENAMI realmente paga.
        $fondoEstabilizacionUsd = $leyResuelta * $tarifa->fondo_estabilizacion * $pesoRecibido;
        $saldoLiquidoUsd = $totalFacturaUsd;

        return [
            'ley_usada' => $leyResuelta,
            'diferencia_ley' => round($diferenciaLey, 4),
            'ajuste_escala' => round($ajusteEscala, 2),
            'valor_unitario_cobre' => round($valorUnitarioCobre, 2),
            'importe_usd' => round($importeUsd, 2),
            'iva_usd' => round($ivaUsd, 2),
            'total_factura_usd' => round($totalFacturaUsd, 2),
            'fondo_estabilizacion_usd' => round($fondoEstabilizacionUsd, 2),
            'saldo_liquido_usd' => round($saldoLiquidoUsd, 2),
            'saldo_liquido_clp' => $tasaCambio ? round($saldoLiquidoUsd * $tasaCambio, 2) : null,
            'peso_recibido' => round($pesoRecibido, 2),
            'tarifa' => [
                'tarifa_base' => $tarifa->tarifa_base,
                'escala' => $tarifa->escala,
                'fondo_estabilizacion' => $tarifa->fondo_estabilizacion,
                'ley_base' => $tarifa->ley_base,
                'iva_porcentaje' => $tarifa->iva_porcentaje,
            ],
        ];
    }

    /**
     * Saldo Líquido preliminar ANTES de que exista Canje o Tercera — usa la
     * misma fórmula de calcularSaldoLiquidoEsperado() pero con las leyes que
     * ya haya disponibles del lado de Laboratorio (Segunda/Segunda Prima) y
     * de la Planta (Primera). Pedido explícito de gerencia: saber cuánto se
     * va a pagar aproximadamente antes de que se resuelva el Canje.
     *
     * Si hay Segunda Y Primera (las dos posiciones reales de la negociación),
     * devuelve un RANGO entre ambas en vez de un solo número — es más honesto
     * que un valor único, porque el Canje es justamente la negociación entre
     * esos dos extremos. Con una sola ley disponible, devuelve un solo valor
     * identificando de qué etapa salió.
     *
     * @return array{tipo: 'rango', min: array, max: array}|array{tipo: 'unico', etapa: string, valor: array}|array{error: string}
     */
    public function calcularSaldoPreliminar(): array
    {
        $candidatos = [];
        if ($this->ley_paquete_primera !== null) {
            $candidatos['Primera'] = $this->ley_paquete_primera;
        }
        if ($this->ley_paquete_segunda_prima !== null) {
            $candidatos['Segunda Prima'] = $this->ley_paquete_segunda_prima;
        }
        if ($this->ley_paquete_segunda !== null) {
            $candidatos['Segunda'] = $this->ley_paquete_segunda;
        }

        if (empty($candidatos)) {
            return ['error' => 'El lote todavía no tiene ninguna ley cargada.'];
        }

        $pesoRecibido = $this->getPesoRecibido();
        if (!$pesoRecibido) {
            return ['error' => 'El lote no tiene peso recibido (camionadas sin recepcionar).'];
        }

        $tarifa = Tarifa::vigentePara($this->fecha_cierre);
        if (!$tarifa) {
            $mesAnio = $this->fecha_cierre ? \Carbon\Carbon::parse($this->fecha_cierre)->format('m/Y') : 'sin fecha de cierre';
            return ['error' => "No hay una tarifa cargada para {$mesAnio}."];
        }

        // Devuelve también los pasos intermedios (no solo el saldo final) para poder
        // mostrar el mismo desglose paso a paso del Excel de verificación del usuario.
        $calcularConLey = function (float $ley) use ($tarifa, $pesoRecibido): array {
            $diferenciaLey = $tarifa->ley_base - $ley;
            $ajusteEscala = $diferenciaLey * $tarifa->escala;
            $valorUnitarioCobre = $tarifa->tarifa_base - $ajusteEscala;
            $importeUsd = $valorUnitarioCobre * $pesoRecibido;
            $ivaUsd = $importeUsd * $tarifa->iva_porcentaje;
            $totalFacturaUsd = $importeUsd + $ivaUsd;
            // Mismo criterio que calcularSaldoLiquidoEsperado(): el Fondo se suma y se resta
            // en la liquidación real (neto cero), no se descuenta acá — ver esa función.
            $fondoEstabilizacionUsd = $ley * $tarifa->fondo_estabilizacion * $pesoRecibido;
            $saldoLiquidoUsd = $totalFacturaUsd;
            return [
                'ley' => $ley,
                'diferencia_ley' => round($diferenciaLey, 4),
                'ajuste_escala' => round($ajusteEscala, 2),
                'valor_unitario_cobre' => round($valorUnitarioCobre, 2),
                'importe_usd' => round($importeUsd, 2),
                'iva_usd' => round($ivaUsd, 2),
                'total_factura_usd' => round($totalFacturaUsd, 2),
                'fondo_estabilizacion_usd' => round($fondoEstabilizacionUsd, 2),
                'saldo_liquido_usd' => round($saldoLiquidoUsd, 2),
            ];
        };

        $tarifaSnapshot = [
            'tarifa_base' => $tarifa->tarifa_base,
            'escala' => $tarifa->escala,
            'fondo_estabilizacion' => $tarifa->fondo_estabilizacion,
            'ley_base' => $tarifa->ley_base,
            'iva_porcentaje' => $tarifa->iva_porcentaje,
        ];

        // Rango solo tiene sentido entre las 2 posiciones reales de la negociación:
        // la propia (Segunda) y la de la contraparte (Primera). Segunda Prima es un
        // ajuste interno antes de ir a la mesa, no un dato independiente para el rango.
        if (isset($candidatos['Segunda']) && isset($candidatos['Primera'])) {
            $conSegunda = $calcularConLey($candidatos['Segunda']);
            $conPrimera = $calcularConLey($candidatos['Primera']);
            $min = $conSegunda['saldo_liquido_usd'] <= $conPrimera['saldo_liquido_usd'] ? $conSegunda : $conPrimera;
            $max = $conSegunda['saldo_liquido_usd'] <= $conPrimera['saldo_liquido_usd'] ? $conPrimera : $conSegunda;
            $min['etapa'] = $min === $conSegunda ? 'Segunda' : 'Primera';
            $max['etapa'] = $max === $conSegunda ? 'Segunda' : 'Primera';
            return [
                'tipo' => 'rango',
                'min' => $min,
                'max' => $max,
                'peso_recibido' => round($pesoRecibido, 2),
                'tarifa' => $tarifaSnapshot,
            ];
        }

        // Una sola ley disponible: se usa la más avanzada (Primera > Segunda Prima > Segunda).
        $etapa = array_key_first($candidatos);
        $valor = $calcularConLey($candidatos[$etapa]);
        return [
            'tipo' => 'unico',
            'etapa' => $etapa,
            'valor' => $valor,
            'peso_recibido' => round($pesoRecibido, 2),
            'tarifa' => $tarifaSnapshot,
        ];
    }

    /**
     * Registrar la liquidación real del lote (documento de ENAMI). Calcula
     * el saldo esperado con la tasa de cambio informada y lo guarda como
     * snapshot junto al saldo real, para poder comparar ambos después sin
     * que un cambio posterior en la Tarifa altere la comparación ya hecha.
     */
    public function registrarLiquidacion(string $numero, float $tasaCambio, ?float $saldoRealUsd, ?float $saldoRealClp): void
    {
        if ($this->ley_canje === null && $this->ley_paquete_tercera === null) {
            throw new \Exception('El lote todavía no tiene una ley resuelta (Canje o Tercera), no se puede liquidar.');
        }

        $calculado = $this->calcularSaldoLiquidoEsperado($tasaCambio);
        if (isset($calculado['error'])) {
            throw new \Exception($calculado['error']);
        }

        $this->liquidacion_numero = $numero;
        $this->liquidacion_tasa_cambio = $tasaCambio;
        $this->liquidacion_saldo_real_usd = $saldoRealUsd;
        $this->liquidacion_saldo_real_clp = $saldoRealClp;
        $this->liquidacion_saldo_calculado_usd = $calculado['saldo_liquido_usd'];
        $this->liquidacion_saldo_calculado_clp = $calculado['saldo_liquido_clp'];
        $this->fecha_liquidacion = now();

        $this->actualizarEstadoLaboratorio();
    }

    /**
     * Registrar el anticipo pagado. Requiere que ya exista la liquidación
     * (según el cuaderno del usuario, la liquidación llega antes del anticipo).
     */
    public function registrarAnticipo(float $monto): void
    {
        if ($this->liquidacion_numero === null) {
            throw new \Exception('Falta cargar la Liquidación antes de registrar el Anticipo.');
        }

        $this->anticipo_monto = $monto;
        $this->fecha_anticipo = now();

        $this->actualizarEstadoLaboratorio();
    }

    /**
     * Registrar el pago final. Requiere que ya exista el anticipo.
     */
    public function registrarPago(float $monto): void
    {
        if ($this->anticipo_monto === null) {
            throw new \Exception('Falta registrar el Anticipo antes de registrar el Pago.');
        }

        $this->pago_monto = $monto;
        $this->fecha_pago = now();

        $this->actualizarEstadoLaboratorio();
    }

    /**
     * Marcar el lote como enviado a laboratorio externo (Paquete Tercera).
     * Es la alternativa a llegar a acuerdo en el canje: requiere que ya esté
     * cargada la Ley Paquete Primera (último paso antes del canje en el
     * orden secuencial: Segunda → Segunda Prima → Primera → Canje/Tercero).
     */
    public function enviarATercero(): void
    {
        if ($this->ley_paquete_primera === null) {
            throw new \Exception('Falta cargar la Ley Paquete Primera antes de poder enviar a Tercero.');
        }
        if ($this->ley_canje !== null) {
            throw new \Exception('Este lote ya fue canjeado, no corresponde enviarlo a Tercero.');
        }
        if ($this->enviado_a_tercero) {
            throw new \Exception('Este lote ya fue enviado a Tercero.');
        }

        $this->enviado_a_tercero = true;
        $this->actualizarEstadoLaboratorio();
    }
}
