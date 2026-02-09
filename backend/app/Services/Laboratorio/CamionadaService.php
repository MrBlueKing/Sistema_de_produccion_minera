<?php

namespace App\Services\Laboratorio;

use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\Camionada;
use App\Models\Laboratorio\Lote;
use Illuminate\Support\Facades\DB;
use Exception;

class CamionadaService
{
    /**
     * Crear una nueva camionada (despacho) desde una mezcla
     *
     * @param array $datos [
     *   'mezcla_id' => 1,
     *   'planta_id' => 1,  (Planta destino: Enami, Cenizas)
     *   'empresa_id' => 1, (Empresa vendedora: Santa Ana, MDF Inés, etc)
     *   'patente' => 'FVGY-94',
     *   'cliente' => 'MDF Inés', (opcional, se toma de empresa)
     *   'planta' => 'Enami', (opcional, se toma de planta)
     *   'fecha_despacho' => '2025-11-19',
     *   'peso' => 35.6,
     *   'ticket' => '12345' (opcional),
     *   'numero_guia' => 'G-001' (opcional),
     *   'ley_visual' => 1.2 (opcional),
     *   'observaciones' => 'Texto opcional',
     *   'user_id' => 1
     * ]
     * @return Camionada
     * @throws Exception
     */
    public function crearCamionada(array $datos)
    {
        DB::beginTransaction();

        try {
            // 1. Verificar que exista la mezcla
            $mezcla = Mezcla::findOrFail($datos['mezcla_id']);

            // 2. Si no viene planta_id, tomar de la mezcla
            if (!isset($datos['planta_id']) || empty($datos['planta_id'])) {
                $datos['planta_id'] = $mezcla->planta_id;
            }

            // 3. Obtener o crear el lote para esta combinación planta + empresa
            $lote = Lote::obtenerOCrearLote($datos['planta_id'], $datos['empresa_id']);

            // 4. Calcular el número de camionada (correlativo por lote)
            $ultimaCamionada = Camionada::where('lote_id', $lote->id)
                ->orderBy('numero_camionada', 'desc')
                ->first();

            $numeroCamionada = $ultimaCamionada ? ($ultimaCamionada->numero_camionada + 1) : 1;

            // 5. Obtener nombres de planta y empresa si no se proporcionan
            $nombreCliente = $datos['cliente'] ?? $lote->empresa->nombre;
            $nombrePlanta = $datos['planta'] ?? $lote->planta->nombre;

            // 6. Crear la camionada
            $camionada = Camionada::create([
                'mezcla_id' => $mezcla->id,
                'lote_id' => $lote->id,
                'numero_camionada' => $numeroCamionada,
                'patente' => $datos['patente'],
                'cliente' => $nombreCliente,
                'planta' => $nombrePlanta,
                'ticket' => $datos['ticket'] ?? null,
                'numero_guia' => $datos['numero_guia'] ?? null,
                'fecha_despacho' => $datos['fecha_despacho'] ?? now(),
                'hora_despacho' => $datos['hora_despacho'] ?? now()->toTimeString(),
                'peso' => $datos['peso'],
                'ley_mezcla' => $datos['ley_mezcla'] ?? $mezcla->ley_prom_lote ?? $mezcla->ley_lab, // Ley lote al momento del despacho
                'ley_visual' => $datos['ley_visual'] ?? $mezcla->ley_prom_visual ?? $mezcla->ley_lab,
                'user_id' => $datos['user_id'] ?? null,
                'observaciones' => $datos['observaciones'] ?? null,
                'estado' => Camionada::ESTADO_DESPACHADO,
            ]);

            // 7. Calcular diferencia y error de peso
            $camionada->calcularDiferencia();
            $camionada->calcularPorcentajeError();
            $camionada->save();

            // NOTA: Las toneladas NO se descuentan al crear la camionada
            // Se descontarán al recepcionar con el peso_real

            DB::commit();

            return $camionada->fresh(['mezcla', 'lote.planta', 'lote.empresa']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Actualizar una camionada
     *
     * @param int $camionadaId
     * @param array $datos
     * @return Camionada
     */
    public function actualizarCamionada($camionadaId, array $datos)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::findOrFail($camionadaId);
            $mezcla = $camionada->mezcla;
            $pesoAnterior = $camionada->peso;

            // Si se actualiza el peso, ajustar toneladas de la mezcla
            if (isset($datos['peso']) && $datos['peso'] != $pesoAnterior) {
                $diferenciaPeso = $datos['peso'] - $pesoAnterior;

                // Si aumenta el peso, validar que haya toneladas disponibles
                if ($diferenciaPeso > 0 && $diferenciaPeso > $mezcla->toneladas_disponibles) {
                    throw new Exception("El aumento de peso ({$diferenciaPeso} t) supera las toneladas disponibles ({$mezcla->toneladas_disponibles} t)");
                }

                // Restaurar el peso anterior
                $mezcla->restaurarToneladas($pesoAnterior);

                // Descontar el nuevo peso
                $mezcla->descontarToneladas($datos['peso']);
            }

            $camionada->update($datos);

            // Recalcular diferencias
            $camionada->calcularDiferencia();
            $camionada->calcularPorcentajeError();
            $camionada->save();

            DB::commit();

            return $camionada->fresh(['mezcla']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Marcar camionada como recibida
     *
     * @param int $camionadaId
     * @param array $datos
     * @return Camionada
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
     *
     * @param int $camionadaId
     * @param float $leyLab
     * @return Camionada
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
     * Eliminar una camionada
     *
     * @param int $camionadaId
     * @return bool
     */
    public function eliminarCamionada($camionadaId)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::findOrFail($camionadaId);
            $mezcla = $camionada->mezcla;

            // Solo restaurar si fue recepcionada (tiene peso_real)
            // Si solo fue despachada (sin peso_real), no restaurar porque nunca se descontó
            $pesoARestaurar = $camionada->peso_real;

            // Eliminar la camionada
            $resultado = $camionada->delete();

            // Restaurar toneladas a la mezcla solo si fue recepcionada
            if ($mezcla && $pesoARestaurar !== null && $pesoARestaurar > 0) {
                $mezcla->restaurarToneladas($pesoARestaurar);
            }

            DB::commit();

            return $resultado;

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Obtener resumen de camionadas de una mezcla
     *
     * @param int $mezclaId
     * @return array
     */
    public function obtenerResumenPorMezcla($mezclaId)
    {
        $mezcla = Mezcla::with('camionadas')->findOrFail($mezclaId);

        return [
            'mezcla' => [
                'codigo' => $mezcla->codigo,
                'total_ton' => $mezcla->total_ton,
                'ley_lab' => $mezcla->ley_lab,
            ],
            'peso_despachado' => $mezcla->getPesoDespachado(),
            'peso_remanente' => $mezcla->getPesoRemanente(),
            'numero_camionadas' => $mezcla->getNumeroCamionadas(),
            'camionadas' => $mezcla->camionadas->map(function ($c) {
                return [
                    'id' => $c->id,
                    'patente' => $c->patente,
                    'cliente' => $c->cliente,
                    'fecha_despacho' => $c->fecha_despacho->format('d-m-Y'),
                    'peso' => $c->peso,
                    'estado' => $c->estado,
                ];
            }),
        ];
    }

    /**
     * Obtener mezclas con remanente disponible para despacho
     * OPTIMIZADO: Solo carga el peso despachado, no todas las camionadas
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function obtenerMezclasConRemanente()
    {
        // Usar los campos toneladas_disponibles y toneladas_despachadas
        // Obtener solo mezclas con toneladas disponibles
        $mezclas = Mezcla::select([
                'id',
                'codigo',
                'fecha',
                'total_ton',
                'toneladas_disponibles',
                'toneladas_despachadas',
                'ley_lab',
                'ley_prom_visual',
                'ley_prom_lote',
                'estado',
                'es_remanente',
                'mezcla_origen_id'
            ])
            ->where('toneladas_disponibles', '>', 0.01) // Tolerancia de 10kg
            ->orderBy('fecha', 'desc')
            ->get();

        return $mezclas->map(function ($mezcla) {
            return [
                'id' => $mezcla->id,
                'codigo' => $mezcla->codigo,
                'fecha' => $mezcla->fecha->format('d-m-Y'),
                'total_ton' => round((float) $mezcla->total_ton, 2),
                'toneladas_disponibles' => round((float) ($mezcla->toneladas_disponibles ?? 0), 2),
                'toneladas_despachadas' => round((float) ($mezcla->toneladas_despachadas ?? 0), 2),
                'peso_despachado' => round((float) ($mezcla->toneladas_despachadas ?? 0), 2), // Alias para compatibilidad
                'peso_remanente' => round((float) ($mezcla->toneladas_disponibles ?? 0), 2), // Alias para compatibilidad
                'ley_lab' => round((float) ($mezcla->ley_lab ?? 0), 2),
                'ley_visual' => round((float) ($mezcla->ley_prom_visual ?? $mezcla->ley_lab ?? 0), 2),
                'ley_lote' => round((float) ($mezcla->ley_prom_lote ?? $mezcla->ley_lab ?? 0), 2),
                'numero_camionadas' => $mezcla->camionadas()->count(),
                'estado' => $mezcla->estado,
                'es_remanente' => $mezcla->es_remanente,
            ];
        })->values();
    }

    /**
     * Recepcionar camionada (actualizar con datos reales)
     *
     * @param int $camionadaId
     * @param array $datos [
     *   'peso_real' => 34.8,
     *   'fecha_recepcion' => '2025-11-19',
     *   'hora_recepcion' => '14:30:00',
     *   'ley_lab_camion' => 1.25 (opcional),
     *   'ticket' => '12345' (opcional)
     * ]
     * @return Camionada
     * @throws Exception
     */
    public function recepcionarCamionada($camionadaId, array $datos)
    {
        DB::beginTransaction();

        try {
            $camionada = Camionada::findOrFail($camionadaId);
            $mezcla = $camionada->mezcla;

            // Guardar peso teórico anterior
            $pesoTeorico = $camionada->peso;

            // Actualizar con datos de recepción
            $camionada->fecha_recepcion = $datos['fecha_recepcion'] ?? now();
            // Si viene hora en formato H:i, agregar :00 para H:i:s
            $horaRecepcion = $datos['hora_recepcion'] ?? now()->format('H:i:s');
            if ($horaRecepcion && strlen($horaRecepcion) === 5) {
                $horaRecepcion .= ':00'; // Convertir H:i a H:i:s
            }
            $camionada->hora_recepcion = $horaRecepcion;
            $camionada->peso_real = $datos['peso_real'];
            $camionada->estado = Camionada::ESTADO_RECIBIDO;

            // Actualizar ticket si viene (número de romana)
            if (isset($datos['ticket'])) {
                $camionada->ticket = $datos['ticket'];
            }

            // Actualizar ley de laboratorio si viene
            if (isset($datos['ley_lab_camion'])) {
                $camionada->ley_lab_camion = $datos['ley_lab_camion'];
            }

            // Recalcular diferencias de peso
            $camionada->calcularDiferencia();
            $camionada->calcularPorcentajeError();

            // Recalcular diferencias de ley si hay ley de laboratorio
            if ($camionada->ley_lab_camion) {
                $camionada->calcularDiferenciaLey();
            }

            $camionada->save();

            // DESCONTAR TONELADAS DE LA MEZCLA con el peso_real
            // Al crear la camionada NO se descuenta nada
            // Aquí se descuenta por primera vez con el peso real recepcionado
            if ($mezcla) {
                $pesoReal = (float) $datos['peso_real'];

                // Validar que haya suficientes toneladas disponibles
                if ($pesoReal > $mezcla->toneladas_disponibles) {
                    throw new Exception("El peso real ({$pesoReal} t) supera las toneladas disponibles ({$mezcla->toneladas_disponibles} t) de la mezcla {$mezcla->codigo}");
                }

                // Descontar el peso real
                $mezcla->descontarToneladas($pesoReal);
            }

            DB::commit();
            return $camionada->fresh(['mezcla', 'lote']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
