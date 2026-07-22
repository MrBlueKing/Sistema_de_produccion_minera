<?php

namespace App\Services\Laboratorio;

use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\Camionada;
use App\Models\Laboratorio\CamionadaMovimiento;
use App\Models\Laboratorio\Lote;
use Illuminate\Support\Facades\DB;
use Exception;

class CamionadaService
{
    /**
     * Crear una nueva camionada con una o más mezclas de origen.
     *
     * @param array $datos [
     *   'mezclas' => [['mezcla_id' => 1, 'toneladas' => 20], ...],
     *   'lote_id' => 1,
     *   'patente' => 'FVGY-94',
     *   'fecha_despacho' => '2025-11-19',
     *   'peso' => 35.6,
     *   ...
     * ]
     */
    public function crearCamionada(array $datos)
    {
        DB::beginTransaction();

        try {
            $mezclasData = $datos['mezclas'] ?? [];

            if (empty($mezclasData)) {
                throw new Exception('Debe seleccionar al menos una mezcla para la camionada');
            }

            // Validar y cargar todas las mezclas
            $mezclas = [];
            foreach ($mezclasData as $item) {
                $mezcla = Mezcla::findOrFail($item['mezcla_id']);
                $mezclas[] = ['mezcla' => $mezcla, 'toneladas' => (float) $item['toneladas']];
            }

            // Obtener el lote
            if (empty($datos['lote_id'])) {
                throw new Exception('Debe seleccionar un lote para la camionada');
            }

            // Lock de la fila del lote: serializa requests concurrentes que
            // intenten crear camionadas en el mismo lote al mismo tiempo,
            // para que el cálculo de numero_camionada de abajo sea seguro.
            $lote = Lote::where('id', $datos['lote_id'])->lockForUpdate()->firstOrFail();
            $lote->load(['planta', 'empresa']);

            if ($lote->estado !== Lote::ESTADO_ABIERTO) {
                throw new Exception('El lote seleccionado no está abierto');
            }

            // Número correlativo por lote (lote ya bloqueado arriba)
            $numeroCamionada = $this->siguienteNumeroCamionada($lote->id);

            // Calcular ley_mezcla promedio ponderado por toneladas
            $totalTon = array_sum(array_column($mezclasData, 'toneladas'));
            $sumaLeyLote = 0;
            $sumaLeyVisual = 0;

            foreach ($mezclas as $item) {
                $m = $item['mezcla'];
                $ton = $item['toneladas'];
                $sumaLeyLote += ($m->ley_prom_lote ?? $m->ley_lab ?? 0) * $ton;
                $sumaLeyVisual += ($m->ley_prom_visual ?? $m->ley_lab ?? 0) * $ton;
            }

            $leyMezcla = $totalTon > 0 ? round($sumaLeyLote / $totalTon, 4) : null;
            $leyVisual = $totalTon > 0 ? round($sumaLeyVisual / $totalTon, 4) : null;

            // Crear la camionada
            $camionada = Camionada::create([
                'lote_id'          => $lote->id,
                'numero_camionada' => $numeroCamionada,
                'patente'          => $datos['patente'],
                'cliente'          => $datos['cliente'] ?? $lote->empresa->nombre,
                'planta'           => $datos['planta'] ?? $lote->planta->nombre,
                'ticket'           => $datos['ticket'] ?? null,
                'numero_guia'      => $datos['numero_guia'] ?? null,
                'fecha_despacho'   => $datos['fecha_despacho'] ?? now(),
                'hora_despacho'    => $datos['hora_despacho'] ?? now()->toTimeString(),
                'peso'             => $datos['peso'],
                'ley_mezcla'       => $datos['ley_mezcla'] ?? $leyMezcla,
                'ley_visual'       => $datos['ley_visual'] ?? $leyVisual,
                'user_id'          => $datos['user_id'] ?? null,
                'observaciones'    => $datos['observaciones'] ?? null,
                'estado'           => Camionada::ESTADO_DESPACHADO,
            ]);

            // Insertar registros en la pivot
            foreach ($mezclas as $item) {
                DB::table('camionada_mezcla')->insert([
                    'camionada_id' => $camionada->id,
                    'mezcla_id'    => $item['mezcla']->id,
                    'toneladas'    => $item['toneladas'],
                    'ley_mezcla'   => $item['mezcla']->ley_prom_lote ?? $item['mezcla']->ley_lab,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }

            // Calcular diferencia y error de peso
            $camionada->calcularDiferencia();
            $camionada->calcularPorcentajeError();
            $camionada->save();

            // Las toneladas se descuentan al recepcionar, no al crear

            DB::commit();

            return $camionada->fresh(['mezclas', 'lote.planta', 'lote.empresa']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Mover una o varias camionadas a otro lote (reasignación manual).
     * No toca tonelaje de mezclas: el descuento es por camionada al
     * recepcionar, no por lote, así que moverla de lote no lo afecta.
     *
     * @param array $camionadaIds IDs de camionadas a mover
     * @param int $loteDestinoId Lote destino (debe estar Abierto)
     * @param int|null $userId Usuario que realiza el movimiento (para auditoría)
     * @return \Illuminate\Support\Collection Camionadas movidas, frescas
     */
    public function moverCamionadas(array $camionadaIds, int $loteDestinoId, ?int $userId = null)
    {
        if (empty($camionadaIds)) {
            throw new Exception('Debe indicar al menos una camionada para mover');
        }

        DB::beginTransaction();

        try {
            $camionadas = Camionada::whereIn('id', $camionadaIds)->get();

            if ($camionadas->count() !== count($camionadaIds)) {
                throw new Exception('Alguna camionada indicada no existe');
            }

            // Bloquear todos los lotes involucrados (origen + destino) en
            // orden ascendente de ID para evitar deadlocks si dos
            // movimientos cruzados ocurren al mismo tiempo.
            $loteIds = $camionadas->pluck('lote_id')
                ->push($loteDestinoId)
                ->filter()
                ->unique()
                ->sort()
                ->values();

            $lotesBloqueados = Lote::whereIn('id', $loteIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $loteDestino = $lotesBloqueados->get($loteDestinoId);

            if (!$loteDestino) {
                throw new Exception('El lote destino no existe');
            }

            if ($loteDestino->estado !== Lote::ESTADO_ABIERTO) {
                throw new Exception('El lote destino no está abierto');
            }

            // El destino puede ser de otra planta/empresa que el origen, así
            // que hay que refrescar los campos denormalizados de la camionada.
            $loteDestino->load(['planta', 'empresa']);

            $loteOrigenIdsAfectados = [];

            foreach ($camionadas as $camionada) {
                if ($camionada->lote_id === $loteDestinoId) {
                    continue; // ya está en el lote destino, nada que hacer
                }

                $loteOrigenId = $camionada->lote_id;
                $loteOrigenIdsAfectados[] = $loteOrigenId;
                $nuevoNumero = $this->siguienteNumeroCamionada($loteDestinoId);

                $camionada->lote_id = $loteDestinoId;
                $camionada->numero_camionada = $nuevoNumero;
                if ($loteDestino->planta) {
                    $camionada->planta = $loteDestino->planta->nombre;
                }
                if ($loteDestino->empresa) {
                    $camionada->cliente = $loteDestino->empresa->nombre;
                }
                $camionada->save();

                CamionadaMovimiento::create([
                    'camionada_id'    => $camionada->id,
                    'lote_origen_id'  => $loteOrigenId,
                    'lote_destino_id' => $loteDestinoId,
                    'user_id'         => $userId,
                ]);
            }

            // Cerrar huecos de numeración en los lotes de origen (las
            // camionadas que quedaron vuelven a numerarse 1..N sin saltos)
            foreach (array_unique($loteOrigenIdsAfectados) as $origenId) {
                $this->renumerarSecuencial($origenId);
            }

            DB::commit();

            return Camionada::whereIn('id', $camionadaIds)->with(['mezclas', 'lote'])->get();

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Actualizar datos generales de una camionada (patente, peso, fechas, etc.)
     * No modifica las mezclas asociadas.
     */
    public function actualizarCamionada($camionadaId, array $datos)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::findOrFail($camionadaId);

            $camionada->update($datos);

            $camionada->calcularDiferencia();
            $camionada->calcularPorcentajeError();
            $camionada->save();

            DB::commit();

            return $camionada->fresh(['mezclas']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Marcar camionada como recibida
     */
    public function marcarComoRecibida($camionadaId, array $datos)
    {
        $camionada = Camionada::findOrFail($camionadaId);

        $camionada->marcarComoRecibida(
            $datos['fecha_recepcion'] ?? null,
            $datos['hora_recepcion'] ?? null
        );

        return $camionada;
    }

    /**
     * Actualizar ley de laboratorio de una camionada
     */
    public function actualizarLeyLaboratorio($camionadaId, $leyLab)
    {
        $camionada = Camionada::findOrFail($camionadaId);
        $camionada->actualizarLeyLaboratorio($leyLab);
        $camionada->estado = Camionada::ESTADO_COMPLETADO;
        $camionada->save();

        return $camionada;
    }

    /**
     * Eliminar una camionada.
     * Si fue recepcionada, restaura las toneladas a cada mezcla de forma proporcional.
     */
    public function eliminarCamionada($camionadaId)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::with('mezclas')->findOrFail($camionadaId);
            $pesoReal = $camionada->peso_real;

            // Eliminar primero (cascade borra la pivot)
            $resultado = $camionada->delete();

            // Restaurar toneladas solo si fue recepcionada
            if ($pesoReal !== null && $pesoReal > 0) {
                $this->restaurarToneladasProporcionales($camionada->mezclas, $camionada->peso, $pesoReal);
            }

            DB::commit();

            return $resultado;

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Recepcionar camionada: registrar peso real y descontar toneladas de las mezclas.
     * Las toneladas se distribuyen proporcionalmente según la pivot.
     */
    public function recepcionarCamionada($camionadaId, array $datos)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::with('mezclas')->findOrFail($camionadaId);

            $horaRecepcion = $datos['hora_recepcion'] ?? now()->format('H:i:s');
            if ($horaRecepcion && strlen($horaRecepcion) === 5) {
                $horaRecepcion .= ':00';
            }

            $camionada->fecha_recepcion = $datos['fecha_recepcion'] ?? now();
            $camionada->hora_recepcion  = $horaRecepcion;
            $camionada->peso_real       = $datos['peso_real'];
            $camionada->estado          = Camionada::ESTADO_RECIBIDO;

            if (isset($datos['ticket'])) {
                $camionada->ticket = $datos['ticket'];
            }

            if (isset($datos['ley_lab_camion'])) {
                $camionada->ley_lab_camion = $datos['ley_lab_camion'];
            }

            $camionada->calcularDiferencia();
            $camionada->calcularPorcentajeError();

            if ($camionada->ley_lab_camion) {
                $camionada->calcularDiferenciaLey();
            }

            $camionada->save();

            // Asignar nombre al lote si corresponde
            if (!empty($datos['numero_lote']) && $camionada->lote_id) {
                $lote = Lote::find($camionada->lote_id);
                if ($lote && empty($lote->numero_lote)) {
                    $lote->numero_lote = $datos['numero_lote'];
                    $lote->save();
                }
            }

            // Descontar toneladas de cada mezcla proporcionalmente
            $pesoReal = (float) $datos['peso_real'];
            $this->descontarToneladasProporcionales($camionada->mezclas, $camionada->peso, $pesoReal);

            DB::commit();
            return $camionada->fresh(['mezclas', 'lote']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Anular la recepción de una camionada.
     * Restaura las toneladas descontadas a cada mezcla de forma proporcional.
     */
    public function anularRecepcion($camionadaId)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::with('mezclas')->findOrFail($camionadaId);

            if ($camionada->peso_real === null) {
                throw new Exception('La camionada no ha sido recepcionada.');
            }

            $pesoReal = (float) $camionada->peso_real;

            // Restaurar toneladas a cada mezcla
            $this->restaurarToneladasProporcionales($camionada->mezclas, $camionada->peso, $pesoReal);

            $camionada->peso_real       = null;
            $camionada->fecha_recepcion = null;
            $camionada->hora_recepcion  = null;
            $camionada->ticket          = null;
            $camionada->estado          = Camionada::ESTADO_DESPACHADO;
            $camionada->save();

            DB::commit();
            return $camionada->fresh(['mezclas', 'lote']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Obtener resumen de camionadas de una mezcla
     */
    public function obtenerResumenPorMezcla($mezclaId)
    {
        $mezcla = Mezcla::with('camionadas')->findOrFail($mezclaId);

        return [
            'mezcla' => [
                'codigo'    => $mezcla->codigo,
                'total_ton' => $mezcla->total_ton,
                'ley_lab'   => $mezcla->ley_lab,
            ],
            'peso_despachado'    => $mezcla->getPesoDespachado(),
            'peso_remanente'     => $mezcla->getPesoRemanente(),
            'numero_camionadas'  => $mezcla->getNumeroCamionadas(),
            'camionadas'         => $mezcla->camionadas->map(function ($c) {
                return [
                    'id'            => $c->id,
                    'patente'       => $c->patente,
                    'cliente'       => $c->cliente,
                    'fecha_despacho'=> $c->fecha_despacho->format('d-m-Y'),
                    'peso'          => $c->peso,
                    'estado'        => $c->estado,
                ];
            }),
        ];
    }

    /**
     * Obtener mezclas con remanente disponible para despacho
     */
    public function obtenerMezclasConRemanente($faenaId = null, bool $todas = false)
    {
        $mezclas = Mezcla::select([
                'id', 'codigo', 'fecha', 'total_ton',
                'toneladas_disponibles', 'toneladas_despachadas',
                'ley_lab', 'ley_prom_visual', 'ley_prom_lote',
                'estado', 'es_remanente', 'mezcla_origen_id'
            ])
            ->withCount('camionadas')
            ->when(!$todas, fn($q) => $q->where('toneladas_disponibles', '>', 0.01))
            ->when($faenaId, fn($q, $id) => $q->where('id_faena', $id))
            ->orderBy('fecha', 'desc')
            ->get();

        return $mezclas->map(function ($mezcla) {
            return [
                'id'                   => $mezcla->id,
                'codigo'               => $mezcla->codigo,
                'fecha'                => $mezcla->fecha->format('d-m-Y'),
                'total_ton'            => round((float) $mezcla->total_ton, 2),
                'toneladas_disponibles'=> round((float) ($mezcla->toneladas_disponibles ?? 0), 2),
                'toneladas_despachadas'=> round((float) ($mezcla->toneladas_despachadas ?? 0), 2),
                'peso_despachado'      => round((float) ($mezcla->toneladas_despachadas ?? 0), 2),
                'peso_remanente'       => round((float) ($mezcla->toneladas_disponibles ?? 0), 2),
                'ley_lab'              => round((float) ($mezcla->ley_lab ?? 0), 2),
                'ley_visual'           => round((float) ($mezcla->ley_prom_visual ?? $mezcla->ley_lab ?? 0), 2),
                'ley_lote'             => round((float) ($mezcla->ley_prom_lote ?? $mezcla->ley_lab ?? 0), 2),
                'numero_camionadas'    => $mezcla->camionadas_count,
                'estado'               => $mezcla->estado,
                'es_remanente'         => $mezcla->es_remanente,
            ];
        })->values();
    }

    // -----------------------------------------------------------------------
    // Helpers privados
    // -----------------------------------------------------------------------

    /**
     * Calcula el próximo numero_camionada correlativo de un lote.
     * Debe llamarse con el lote ya bloqueado (lockForUpdate) por el caller
     * dentro de una transacción, para que sea seguro ante concurrencia.
     */
    private function siguienteNumeroCamionada(int $loteId): int
    {
        $ultima = Camionada::where('lote_id', $loteId)
            ->orderBy('numero_camionada', 'desc')
            ->first();

        return $ultima ? ($ultima->numero_camionada + 1) : 1;
    }

    /**
     * Renumera secuencialmente (1, 2, 3...) las camionadas de un lote,
     * cerrando huecos dejados por camionadas que se movieron o eliminaron.
     * Debe llamarse con el lote ya bloqueado por el caller. Al procesar en
     * orden ascendente, cada número nuevo asignado siempre es <= al número
     * viejo de esa fila, así que nunca choca con el índice único.
     */
    private function renumerarSecuencial(int $loteId): void
    {
        $restantes = Camionada::where('lote_id', $loteId)
            ->orderBy('numero_camionada', 'asc')
            ->get();

        $siguiente = 1;
        foreach ($restantes as $camionada) {
            if ((int) $camionada->numero_camionada !== $siguiente) {
                $camionada->numero_camionada = $siguiente;
                $camionada->save();
            }
            $siguiente++;
        }
    }

    /**
     * Descuenta peso_real de cada mezcla en la pivot, proporcionalmente a sus toneladas.
     */
    private function descontarToneladasProporcionales($mezclas, float $pesoTeorico, float $pesoReal): void
    {
        $totalPivot = $mezclas->sum('pivot.toneladas');

        if ($totalPivot <= 0) {
            return;
        }

        foreach ($mezclas as $mezcla) {
            $proporcion = $mezcla->pivot->toneladas / $totalPivot;
            $mezcla->descontarToneladas(round($pesoReal * $proporcion, 4));
        }
    }

    /**
     * Restaura peso a cada mezcla en la pivot, proporcionalmente a sus toneladas.
     */
    private function restaurarToneladasProporcionales($mezclas, float $pesoTeorico, float $pesoReal): void
    {
        $totalPivot = $mezclas->sum('pivot.toneladas');

        if ($totalPivot <= 0) {
            return;
        }

        foreach ($mezclas as $mezcla) {
            $proporcion = $mezcla->pivot->toneladas / $totalPivot;
            $mezcla->restaurarToneladas(round($pesoReal * $proporcion, 4));
        }
    }
}
