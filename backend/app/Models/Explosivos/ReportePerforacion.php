<?php

namespace App\Models\Explosivos;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportePerforacion extends Model
{
    use HasFactory;

    protected $table = 'reportes_perforacion';

    protected $fillable = [
        'codigo',
        'fecha',
        'turno',
        'estado',
        'observaciones',
        'confirmado_por',
        'fecha_confirmacion',
        'id_polvorin',
        'id_faena',
        'user_id',
        'en_correccion',
        'correccion_estado_previo',
        'correccion_snapshot',
        'correccion_por',
        'correccion_iniciada_en',
        'corregido_en',
        'corregido_por',
        'corregido_toco_devoluciones',
    ];

    protected $casts = [
        'fecha' => 'date',
        'fecha_confirmacion' => 'datetime',
        'en_correccion' => 'boolean',
        'correccion_snapshot' => 'array',
        'correccion_iniciada_en' => 'datetime',
        'corregido_en' => 'datetime',
        'corregido_toco_devoluciones' => 'boolean',
    ];

    const ESTADO_BORRADOR = 'borrador';
    const ESTADO_CONFIRMADO = 'confirmado';
    const ESTADO_CERRADO = 'cerrado';

    // RELACIONES

    public function lineas()
    {
        return $this->hasMany(LineaReportePerforacion::class, 'id_reporte');
    }

    public function devoluciones()
    {
        return $this->hasMany(DevolucionReporte::class, 'id_reporte');
    }

    public function extras()
    {
        return $this->hasMany(ExtraReporte::class, 'id_reporte');
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoExplosivo::class, 'id_reporte_perforacion');
    }

    public function polvorin()
    {
        return $this->belongsTo(Polvorin::class, 'id_polvorin');
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    public function auditoria()
    {
        return $this->hasMany(AuditoriaReportePerforacion::class, 'id_reporte');
    }

    // SCOPES

    public function scopePorFaena($query, $idFaena)
    {
        if ($idFaena) {
            return $query->where('id_faena', $idFaena);
        }
        return $query;
    }

    public function scopePorEstado($query, $estado)
    {
        if ($estado) {
            return $query->where('estado', $estado);
        }
        return $query;
    }

    public function scopeEntreFechas($query, $fechaDesde, $fechaHasta)
    {
        if ($fechaDesde) {
            $query->where('fecha', '>=', $fechaDesde);
        }
        if ($fechaHasta) {
            $query->where('fecha', '<=', $fechaHasta);
        }
        return $query;
    }

    // MÉTODOS ESTÁTICOS

    public static function generarCodigo($fecha, $turno, $polvorinNombre)
    {
        // Correlativo global (no se reinicia por fecha/turno/polvorín/año): se extrae el
        // último segmento de CUALQUIER código existente, sin importar el prefijo, porque
        // el prefijo ahora cambia en cada reporte.
        $ultimoNumero = self::selectRaw("MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)) as max_num")
            ->value('max_num');

        $nuevoNumero = ($ultimoNumero ?? 0) + 1;

        return self::armarCodigo($fecha, $turno, $polvorinNombre, str_pad($nuevoNumero, 4, '0', STR_PAD_LEFT));
    }

    public static function armarCodigo($fecha, $turno, $polvorinNombre, $correlativo)
    {
        $fechaFmt = Carbon::parse($fecha)->format('Y-m-d');
        return "{$fechaFmt}-{$turno}-{$polvorinNombre}-{$correlativo}";
    }

    // MÉTODOS DE NEGOCIO

    public function calcularTotalesExplosivos()
    {
        $totales = [];

        foreach ($this->lineas as $linea) {
            foreach ($linea->explosivos as $exp) {
                $idTipo = $exp->id_tipo_explosivo;
                if (!isset($totales[$idTipo])) {
                    $totales[$idTipo] = [
                        'id_tipo_explosivo' => $idTipo,
                        'tipo_explosivo' => $exp->tipoExplosivo,
                        'cantidad_total' => 0,
                    ];
                }
                $totales[$idTipo]['cantidad_total'] += $exp->cantidad_final;
            }
        }

        return array_values($totales);
    }

    /**
     * Igual que calcularTotalesExplosivos() pero sumando los extras encima —
     * el total real consumido, para vistas de resumen (listado de reportes).
     * calcularTotalesExplosivos() se deja intacta porque confirmar() la usa
     * para validar stock y generar movimientos, y en ese momento no debe
     * saber nada de extras (no pueden existir todavía).
     */
    public function calcularTotalesConExtras()
    {
        $totales = $this->calcularTotalesExplosivos();
        $map = [];
        foreach ($totales as $t) {
            $map[$t['id_tipo_explosivo']] = $t;
        }

        foreach ($this->extras as $extra) {
            $idTipo = $extra->id_tipo_explosivo;
            if (!isset($map[$idTipo])) {
                $map[$idTipo] = [
                    'id_tipo_explosivo' => $idTipo,
                    'tipo_explosivo' => $extra->tipoExplosivo,
                    'cantidad_total' => 0,
                ];
            }
            $map[$idTipo]['cantidad_total'] += (float) $extra->cantidad;
        }

        return array_values($map);
    }

    /**
     * Confirmar NO descuenta stock — solo deja las líneas planificadas
     * inmutables y pasa el reporte a Confirmado. El descuento real recién
     * pasa al cerrar() (cuando el polvorinero marca lo realizado y las
     * devoluciones): antes de eso el material no ha salido físicamente del
     * polvorín, así que el stock no debe reflejarlo todavía.
     */
    public function confirmar($confirmadoPor)
    {
        $this->estado = self::ESTADO_CONFIRMADO;
        $this->confirmado_por = $confirmadoPor;
        $this->fecha_confirmacion = Carbon::now();
        $this->save();

        return $this;
    }

    /**
     * Registra un extra: material solicitado DESPUÉS de confirmado el reporte,
     * sin tocar las cantidades ya anotadas en las líneas. Genera una salida de
     * stock real (igual que confirmar()) y queda como un registro propio, con
     * su motivo y responsable — nunca se fusiona con cantidad_final.
     *
     * @param string|null $fechaMovimiento Fecha para el movimiento — null usa hoy.
     *   Se pasa explícita al restaurar extras desde un snapshot de corrección,
     *   para que el Libro del mes original quede coherente.
     */
    public function agregarExtra(
        int $idTipoExplosivo,
        float $cantidad,
        ?string $motivo = null,
        ?int $idLineaReporte = null,
        ?string $fechaMovimiento = null
    ): ExtraReporte {
        if ($this->estado !== self::ESTADO_CONFIRMADO) {
            throw new \Exception('Solo se pueden solicitar extras en reportes Confirmados.');
        }

        // El operador queda ligado a la línea (frente) que necesitó el extra —
        // no se pregunta aparte, se saca de la línea elegida.
        $idPersonal = $idLineaReporte
            ? optional($this->lineas()->find($idLineaReporte))->id_personal
            : null;

        return DB::transaction(function () use ($idTipoExplosivo, $cantidad, $motivo, $idPersonal, $idLineaReporte, $fechaMovimiento) {
            $stock = StockExplosivo::where('id_polvorin', $this->id_polvorin)
                ->where('id_tipo_explosivo', $idTipoExplosivo)
                ->first();

            if (!$stock) {
                throw new \Exception('No hay stock registrado para este explosivo en el polvorín.');
            }

            $movimiento = MovimientoExplosivo::create([
                'codigo' => MovimientoExplosivo::generarCodigo(),
                'tipo' => MovimientoExplosivo::TIPO_SALIDA,
                'id_polvorin_origen' => $this->id_polvorin,
                'id_tipo_explosivo' => $idTipoExplosivo,
                'cantidad' => $cantidad,
                'id_reporte_perforacion' => $this->id,
                'fecha' => $fechaMovimiento ?? Carbon::now()->toDateString(),
                'hora' => Carbon::now()->format('H:i'),
                'motivo' => $motivo ? "Extra reporte {$this->codigo}: {$motivo}" : "Extra reporte {$this->codigo}",
                'id_faena' => $this->id_faena,
                'user_id' => auth()->id(),
            ]);

            // decrementar() valida stock disponible y tira excepción si no alcanza.
            $stock->decrementar($cantidad);

            return ExtraReporte::create([
                'id_reporte' => $this->id,
                'id_linea_reporte' => $idLineaReporte,
                'id_tipo_explosivo' => $idTipoExplosivo,
                'cantidad' => $cantidad,
                'id_personal' => $idPersonal,
                'motivo' => $motivo,
                'id_movimiento' => $movimiento->id,
            ]);
        });
    }

    public function anular()
    {
        return DB::transaction(function () {
            // Obtener movimientos de salida del reporte
            $movimientosSalida = $this->movimientos()
                ->where('tipo', MovimientoExplosivo::TIPO_SALIDA)
                ->get();

            foreach ($movimientosSalida as $movimiento) {
                // Devolver al stock
                $stock = StockExplosivo::obtenerOCrear(
                    $this->id_polvorin,
                    $movimiento->id_tipo_explosivo,
                    $this->id_faena
                );
                $stock->incrementar($movimiento->cantidad);

                // Crear movimiento de ajuste
                MovimientoExplosivo::create([
                    'codigo' => MovimientoExplosivo::generarCodigo(),
                    'tipo' => MovimientoExplosivo::TIPO_AJUSTE,
                    'id_polvorin_destino' => $this->id_polvorin,
                    'id_tipo_explosivo' => $movimiento->id_tipo_explosivo,
                    'cantidad' => $movimiento->cantidad,
                    'id_reporte_perforacion' => $this->id,
                    'fecha' => Carbon::now()->toDateString(),
                    'hora' => Carbon::now()->format('H:i'),
                    'motivo' => "Anulación reporte {$this->codigo}",
                    'id_faena' => $this->id_faena,
                    'user_id' => auth()->id(),
                ]);
            }

            // Resetear estado
            $this->estado = self::ESTADO_BORRADOR;
            $this->confirmado_por = null;
            $this->fecha_confirmacion = null;
            $this->save();

            return $this;
        });
    }

    /**
     * Cerrar es cuando el polvorinero marca el reporte como realizado y
     * declara las devoluciones — y es acá, no en confirmar(), donde se
     * genera la salida real de stock: planificado en las líneas MENOS lo
     * devuelto, en un solo movimiento neto por tipo de explosivo. Antes de
     * este punto el material nunca salió de stock, así que no hay nada que
     * "devolver" — la devolución queda como registro histórico (explica por
     * qué la salida es menor a lo planificado), pero ya no genera su propio
     * movimiento de entrada.
     *
     * @param array $devoluciones
     * @param string|null $fechaMovimiento Fecha para los movimientos generados.
     *   En un cierre normal es hoy (null). En una corrección se pasa la fecha del
     *   reporte para que el Libro del mes original quede coherente.
     */
    public function cerrar($devoluciones = [], ?string $fechaMovimiento = null)
    {
        $fechaMov = $fechaMovimiento ?? Carbon::now()->toDateString();

        return DB::transaction(function () use ($devoluciones, $fechaMov) {
            // lockForUpdate cierra la ventana de carrera de 2 clicks casi
            // simultaneos (doble click, o un reintento del navegador por mala
            // conexion): sin el lock, ambas peticiones pueden leer estado=
            // Confirmado en el controlador ANTES de que la primera termine de
            // guardar, y las dos ejecutan cerrar() completo -- descuento doble.
            $fresco = self::where('id', $this->id)->lockForUpdate()->first();
            if ($fresco->estado !== self::ESTADO_CONFIRMADO) {
                throw new \Exception('Este reporte ya no esta en estado Confirmado -- puede haberse cerrado recien desde otra pestana, sesion o dispositivo. Recarga la pagina antes de reintentar.');
            }

            // Salvaguarda independiente del estado: si el reporte ya tiene
            // movimientos de salida vigentes de un cierre anterior (por ejemplo
            // porque su estado se toco a mano fuera de la app, sin pasar por
            // "Habilitar correccion" -- que si limpia los movimientos viejos --
            // no volver a descontar. Ver incidente real 2026-08-31/09-03,
            // documentado en memoria bug_explosivos_preparado_descuento_excesivo.
            $yaTieneSalida = $this->movimientos()
                ->where('tipo', MovimientoExplosivo::TIPO_SALIDA)
                ->where('motivo', 'like', 'Salida por reporte%')
                ->exists();
            if ($yaTieneSalida) {
                throw new \Exception('Este reporte ya tiene movimientos de salida registrados de un cierre anterior -- no se puede cerrar de nuevo. Usa "Habilitar correccion" si necesitas rehacer el cierre.');
            }

            $devueltoPorTipo = [];
            foreach ($devoluciones as $dev) {
                $idTipo = $dev['id_tipo_explosivo'];
                $devueltoPorTipo[$idTipo] = ($devueltoPorTipo[$idTipo] ?? 0) + (float) $dev['cantidad'];
            }

            foreach ($this->calcularTotalesExplosivos() as $total) {
                $idTipo = $total['id_tipo_explosivo'];
                $neto = round((float) $total['cantidad_total'] - ($devueltoPorTipo[$idTipo] ?? 0), 2);
                if ($neto <= 0) continue;

                $stock = StockExplosivo::where('id_polvorin', $this->id_polvorin)
                    ->where('id_tipo_explosivo', $idTipo)
                    ->first();

                if (!$stock || $stock->cantidad_disponible < $neto) {
                    $nombre = $total['tipo_explosivo']->nombre ?? 'Desconocido';
                    $disponible = $stock ? $stock->cantidad_disponible : 0;
                    throw new \Exception("Stock insuficiente de {$nombre} para cerrar. Disponible: {$disponible}, Requerido: {$neto}");
                }

                MovimientoExplosivo::create([
                    'codigo' => MovimientoExplosivo::generarCodigo(),
                    'tipo' => MovimientoExplosivo::TIPO_SALIDA,
                    'id_polvorin_origen' => $this->id_polvorin,
                    'id_tipo_explosivo' => $idTipo,
                    'cantidad' => $neto,
                    'id_reporte_perforacion' => $this->id,
                    'fecha' => $fechaMov,
                    'hora' => Carbon::now()->format('H:i'),
                    'motivo' => "Salida por reporte {$this->codigo}",
                    'id_faena' => $this->id_faena,
                    'user_id' => auth()->id(),
                ]);

                $stock->decrementar($neto);
            }

            foreach ($devoluciones as $dev) {
                DevolucionReporte::create([
                    'id_reporte' => $this->id,
                    'id_tipo_explosivo' => $dev['id_tipo_explosivo'],
                    'cantidad' => $dev['cantidad'],
                    'id_personal' => $dev['id_personal'] ?? null,
                    'motivo' => $dev['motivo'] ?? null,
                    'id_movimiento' => null,
                ]);
            }

            $this->estado = self::ESTADO_CERRADO;
            $this->save();

            return $this;
        });
    }

    /**
     * Reabre un reporte Cerrado, devolviéndolo a Confirmado para poder anularlo
     * y editar sus líneas. Revierte la salida neta que generó cerrar() (la de
     * líneas menos devoluciones) con un movimiento de ajuste compensatorio —
     * no se borra el historial (ni la devolución ni la salida original), solo
     * se compensa el stock. Los extras quedan intactos: son independientes
     * del cierre, no se tocan al reabrir.
     */
    public function reabrir()
    {
        return DB::transaction(function () {
            $idsMovimientosExtras = $this->extras()->pluck('id_movimiento')->filter();

            $movimientosCierre = $this->movimientos()
                ->where('tipo', MovimientoExplosivo::TIPO_SALIDA)
                ->whereNotIn('id', $idsMovimientosExtras)
                ->get();

            foreach ($movimientosCierre as $mov) {
                $stock = StockExplosivo::obtenerOCrear(
                    $this->id_polvorin,
                    $mov->id_tipo_explosivo,
                    $this->id_faena
                );
                $stock->incrementar($mov->cantidad);

                MovimientoExplosivo::create([
                    'codigo' => MovimientoExplosivo::generarCodigo(),
                    'tipo' => MovimientoExplosivo::TIPO_AJUSTE,
                    'id_polvorin_destino' => $this->id_polvorin,
                    'id_tipo_explosivo' => $mov->id_tipo_explosivo,
                    'cantidad' => $mov->cantidad,
                    'id_reporte_perforacion' => $this->id,
                    'fecha' => Carbon::now()->toDateString(),
                    'hora' => Carbon::now()->format('H:i'),
                    'motivo' => "Reapertura reporte {$this->codigo}: revierte salida del cierre",
                    'id_faena' => $this->id_faena,
                    'user_id' => auth()->id(),
                ]);
            }

            $this->estado = self::ESTADO_CONFIRMADO;
            $this->save();

            return $this;
        });
    }

    // ---------------------------------------------------------------------
    // MODO CORRECCIÓN
    // ---------------------------------------------------------------------

    /**
     * Serializa líneas (con sus explosivos) y devoluciones tal como están ahora,
     * para poder restaurar el reporte a este punto si la corrección se descarta
     * o queda a medias.
     */
    public function tomarSnapshotCorreccion(): array
    {
        $this->load(['lineas.explosivos', 'devoluciones', 'extras']);

        return [
            'lineas' => $this->lineas->map(fn ($l) => [
                'id_frente_trabajo' => $l->id_frente_trabajo,
                'id_personal' => $l->id_personal,
                'id_tipo_frente' => $l->id_tipo_frente,
                'seccion_ancho' => $l->seccion_ancho,
                'seccion_alto' => $l->seccion_alto,
                'numero_tiros' => $l->numero_tiros,
                'largo_perforacion' => $l->largo_perforacion,
                'barras_usadas' => $l->barras_usadas,
                'material' => $l->material,
                'observaciones' => $l->observaciones,
                'valores_editados' => $l->valores_editados,
                'explosivos' => $l->explosivos->map(fn ($e) => [
                    'id_tipo_explosivo' => $e->id_tipo_explosivo,
                    'cantidad_calculada' => $e->cantidad_calculada,
                    'cantidad_final' => $e->cantidad_final,
                ])->toArray(),
            ])->toArray(),
            'devoluciones' => $this->devoluciones->map(fn ($d) => [
                'id_tipo_explosivo' => $d->id_tipo_explosivo,
                'cantidad' => (float) $d->cantidad,
                'id_personal' => $d->id_personal,
                'motivo' => $d->motivo,
            ])->toArray(),
            'extras' => $this->extras->map(fn ($e) => [
                'id_tipo_explosivo' => $e->id_tipo_explosivo,
                'cantidad' => (float) $e->cantidad,
                // id_linea_reporte NO se restaura solo: al descartar, las líneas se
                // recrean con id nuevo (ver más abajo), así que no hay forma
                // confiable de re-ligar el extra a "la misma" línea. Se guarda
                // igual acá por trazabilidad de qué línea era originalmente.
                'id_linea_reporte_original' => $e->id_linea_reporte,
                'motivo' => $e->motivo,
            ])->toArray(),
        ];
    }

    /**
     * Entra en modo corrección: devuelve al stock el efecto NETO vivo de los
     * movimientos del reporte y BORRA esos movimientos (salidas y devoluciones),
     * dejando el reporte en borrador editable. Al confirmar se regeneran limpios
     * con la fecha del reporte, no con la de hoy — así el Libro de Explosivos del
     * mes original queda con las cantidades corregidas y sin ruido en el mes en
     * que se hizo la corrección. El rastro de "esto se corrigió" queda en la
     * auditoría del reporte.
     *
     * "Revertir" es solo sobre el CONTADOR de stock actual del polvorín: se
     * recalcula como si el reporte no existiera. No se re-fechan movimientos ni
     * aparecen datos viejos en el mes actual.
     *
     * Guarda un snapshot para poder descartar o recuperar si queda a medias.
     */
    public function habilitarCorreccion(string $usuario): self
    {
        if (!in_array($this->estado, [self::ESTADO_CONFIRMADO, self::ESTADO_CERRADO], true)) {
            throw new \Exception('Solo se puede corregir un reporte Confirmado o Cerrado.');
        }
        if ($this->en_correccion) {
            throw new \Exception('Este reporte ya está en corrección.');
        }

        return DB::transaction(function () use ($usuario) {
            $estadoPrevio = $this->estado;
            $snapshot = $this->tomarSnapshotCorreccion();

            $this->revertirYLimpiarMovimientos();

            $this->estado = self::ESTADO_BORRADOR;
            $this->confirmado_por = null;
            $this->fecha_confirmacion = null;
            $this->en_correccion = true;
            $this->correccion_estado_previo = $estadoPrevio;
            $this->correccion_snapshot = $snapshot;
            $this->correccion_por = $usuario;
            $this->correccion_iniciada_en = Carbon::now();
            $this->save();

            return $this;
        });
    }

    /**
     * Neto que los movimientos vivos de este reporte descuentan hoy del stock
     * del polvorín, por tipo: Σ(cantidad con origen = polvorín) − Σ(cantidad con
     * destino = polvorín). Positivo = salió y hay que devolverlo.
     */
    protected function netoEnStockPorTipo(): array
    {
        $neto = [];
        foreach ($this->movimientos()->get() as $m) {
            $t = $m->id_tipo_explosivo;
            $neto[$t] = $neto[$t] ?? 0;
            if ((int) $m->id_polvorin_origen === (int) $this->id_polvorin) {
                $neto[$t] += (float) $m->cantidad;
            }
            if ((int) $m->id_polvorin_destino === (int) $this->id_polvorin) {
                $neto[$t] -= (float) $m->cantidad;
            }
        }
        return $neto;
    }

    /**
     * Recalcula el stock del polvorín como si el reporte no existiera (aplica el
     * neto vivo a la inversa) y borra los movimientos y devoluciones del reporte.
     * Se usa al entrar en corrección: los movimientos se regeneran limpios al
     * confirmar.
     */
    protected function revertirYLimpiarMovimientos(): void
    {
        foreach ($this->netoEnStockPorTipo() as $idTipo => $neto) {
            $neto = round($neto, 2);
            if (abs($neto) < 0.01) {
                continue;
            }
            $stock = StockExplosivo::obtenerOCrear($this->id_polvorin, $idTipo, $this->id_faena);
            if ($neto > 0) {
                $stock->incrementar($neto);
            } else {
                // neto negativo: se había devuelto de más; se quita del stock.
                $stock->cantidad = max(0, $stock->cantidad - abs($neto));
                $stock->save();
            }
        }

        // Devoluciones y extras primero (FK RESTRICT sobre id_movimiento), luego movimientos.
        DevolucionReporte::where('id_reporte', $this->id)->delete();
        ExtraReporte::where('id_reporte', $this->id)->delete();
        $this->movimientos()->delete();
    }

    /**
     * Cierra la corrección aplicando las líneas actuales: regenera los movimientos
     * de salida y, si el reporte venía Cerrado, lo vuelve a cerrar con las
     * devoluciones que la operadora revisó (NO se recalculan solas: una devolución
     * es un conteo físico que el sistema no puede adivinar).
     *
     * @param array $devoluciones Devoluciones revisadas (obligatorio si venía Cerrado).
     */
    public function confirmarCorreccion(string $confirmadoPor, array $devoluciones = []): self
    {
        if (!$this->en_correccion) {
            throw new \Exception('Este reporte no está en corrección.');
        }

        return DB::transaction(function () use ($confirmadoPor, $devoluciones) {
            $veniaCerrado = $this->correccion_estado_previo === self::ESTADO_CERRADO;
            $tocoDevoluciones = $veniaCerrado && $this->devolucionesCambiaron($devoluciones);

            // Limpia cualquier movimiento/devolución/extra que haya quedado del
            // reporte (el stock ya está en el estado "revertido" desde habilitar).
            // Los extras NO se regeneran solos: igual que una devolución, son un
            // hecho físico (a alguien se le entregó más material) que la operadora
            // debe volver a pedir si sigue aplicando tras la corrección.
            DevolucionReporte::where('id_reporte', $this->id)->delete();
            ExtraReporte::where('id_reporte', $this->id)->delete();
            $this->movimientos()->delete();

            $this->confirmar($confirmadoPor);

            if ($veniaCerrado) {
                $this->cerrar($devoluciones, $this->fecha->toDateString());
            }

            $this->corregido_en = Carbon::now();
            $this->corregido_por = $confirmadoPor;
            $this->corregido_toco_devoluciones = $tocoDevoluciones;

            $this->limpiarCorreccion();

            return $this;
        });
    }

    /**
     * Descarta la corrección: restaura líneas y devoluciones desde el snapshot y
     * devuelve el reporte a su estado original (Confirmado o Cerrado) con sus
     * movimientos de stock regenerados. Usada por "Descartar y salir" y para
     * recuperar un reporte que quedó a medio corregir.
     */
    public function descartarCorreccion(string $confirmadoPor): self
    {
        if (!$this->en_correccion) {
            throw new \Exception('Este reporte no está en corrección.');
        }

        return DB::transaction(function () use ($confirmadoPor) {
            $snap = $this->correccion_snapshot ?? ['lineas' => [], 'devoluciones' => []];
            $veniaCerrado = $this->correccion_estado_previo === self::ESTADO_CERRADO;

            foreach ($this->lineas()->get() as $linea) {
                $linea->explosivos()->delete();
                $linea->delete();
            }

            foreach ($snap['lineas'] as $ld) {
                $explosivos = $ld['explosivos'] ?? [];
                unset($ld['explosivos']);
                $linea = $this->lineas()->create($ld);
                foreach ($explosivos as $ed) {
                    $linea->explosivos()->create($ed);
                }
            }

            $this->load('lineas.explosivos');

            DevolucionReporte::where('id_reporte', $this->id)->delete();
            ExtraReporte::where('id_reporte', $this->id)->delete();
            $this->movimientos()->delete();

            $this->confirmar($confirmadoPor);

            // Restaura los extras que existían antes de entrar en corrección —
            // a diferencia de confirmarCorreccion(), acá se está deshaciendo la
            // corrección, así que la cantidad/motivo/tipo debe volver a ser
            // EXACTAMENTE lo que había. La línea a la que estaban ligados NO se
            // puede restaurar (las líneas se recrearon arriba con id nuevo), así
            // que quedan sin línea asociada — el resto del dato es idéntico.
            foreach ($snap['extras'] ?? [] as $ex) {
                $this->agregarExtra(
                    $ex['id_tipo_explosivo'],
                    $ex['cantidad'],
                    $ex['motivo'] ?? null,
                    null,
                    $this->fecha->toDateString()
                );
            }

            if ($veniaCerrado) {
                $this->cerrar($snap['devoluciones'] ?? [], $this->fecha->toDateString());
            }

            $this->limpiarCorreccion();

            return $this;
        });
    }

    /**
     * ¿Las devoluciones que se van a registrar difieren de las que tenía el
     * cierre original (guardadas en el snapshot)? Compara por tipo y cantidad.
     */
    protected function devolucionesCambiaron(array $nuevas): bool
    {
        $normalizar = function ($lista) {
            $map = [];
            foreach ($lista as $d) {
                $tipo = (int) ($d['id_tipo_explosivo'] ?? 0);
                $map[$tipo] = round((float) ($d['cantidad'] ?? 0), 2) + ($map[$tipo] ?? 0);
            }
            ksort($map);
            return $map;
        };

        $previas = $this->correccion_snapshot['devoluciones'] ?? [];

        return $normalizar($previas) != $normalizar($nuevas);
    }

    protected function limpiarCorreccion(): void
    {
        $this->en_correccion = false;
        $this->correccion_estado_previo = null;
        $this->correccion_snapshot = null;
        $this->correccion_por = null;
        $this->correccion_iniciada_en = null;
        $this->save();
    }

    /**
     * Elimina el reporte en cualquier estado. Si tenía movimientos de stock
     * (Confirmado/Cerrado), primero los revierte con el mismo cálculo de neto
     * que la corrección; los movimientos quedan como historial huérfano (con su
     * motivo) para no romper el Kardex. Líneas, explosivos, devoluciones y
     * auditoría caen por CASCADE.
     */
    public function eliminarConReversa(string $usuario): void
    {
        DB::transaction(function () use ($usuario) {
            if ($this->estado !== self::ESTADO_BORRADOR) {
                // Ajuste compensatorio por el neto vivo, para que el stock quede
                // como si el reporte no existiera y el Libro siga cuadrando.
                foreach ($this->netoEnStockPorTipo() as $idTipo => $neto) {
                    $neto = round($neto, 2);
                    if (abs($neto) < 0.01) {
                        continue;
                    }
                    $stock = StockExplosivo::obtenerOCrear($this->id_polvorin, $idTipo, $this->id_faena);

                    MovimientoExplosivo::create([
                        'codigo' => MovimientoExplosivo::generarCodigo(),
                        'tipo' => MovimientoExplosivo::TIPO_AJUSTE,
                        'id_polvorin_origen' => $neto < 0 ? $this->id_polvorin : null,
                        'id_polvorin_destino' => $neto > 0 ? $this->id_polvorin : null,
                        'id_tipo_explosivo' => $idTipo,
                        'cantidad' => abs($neto),
                        'fecha' => Carbon::now()->toDateString(),
                        'hora' => Carbon::now()->format('H:i'),
                        'motivo' => "Eliminación reporte {$this->codigo} por {$usuario}: revierte stock",
                        'id_faena' => $this->id_faena,
                        'user_id' => auth()->id(),
                    ]);

                    if ($neto > 0) {
                        $stock->incrementar($neto);
                    } else {
                        $stock->decrementar(abs($neto));
                    }
                }
            }

            // Desligar los movimientos del reporte: se conservan como historial.
            $this->movimientos()->update(['id_reporte_perforacion' => null]);

            $this->delete();
        });
    }
}
