<?php

namespace App\Services\Dispatch;

use App\Models\Dispatch\Acopio;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class AcopioService
{
    /**
     * Detectar si existen acopios abiertos para los criterios dados
     * Agrupa dumpadas por frente + jornada + fecha
     *
     * @param array $dumpadasData Array de dumpadas con id_frente_trabajo, jornada, fecha
     * @return array Grupos con información de acopios existentes
     */
    public function detectarAcopiosExistentes(array $dumpadasData)
    {
        $grupos = [];

        // Agrupar dumpadas por criterios
        foreach ($dumpadasData as $dumpada) {
            $key = "{$dumpada['id_frente_trabajo']}-{$dumpada['jornada']}-{$dumpada['fecha']}";

            if (!isset($grupos[$key])) {
                $grupos[$key] = [
                    'id_frente_trabajo' => $dumpada['id_frente_trabajo'],
                    'jornada' => $dumpada['jornada'],
                    'fecha' => $dumpada['fecha'],
                    'dumpadas' => [],
                    'acopio_existente' => null,
                ];
            }

            $grupos[$key]['dumpadas'][] = $dumpada;
        }

        // Para cada grupo, buscar si existe un acopio abierto
        foreach ($grupos as $key => &$grupo) {
            $acopioExistente = Acopio::buscarAcopioAbierto(
                $grupo['id_frente_trabajo'],
                $grupo['jornada'],
                $grupo['fecha']
            );

            if ($acopioExistente) {
                $acopioExistente->load('frenteTrabajo', 'dumpadas');
                $grupo['acopio_existente'] = $acopioExistente;
            }
        }

        return array_values($grupos);
    }

    /**
     * Crear un nuevo acopio automático
     *
     * @param int $idFrenteTrabajo
     * @param string $jornada
     * @param string $fecha
     * @param int|null $userId
     * @return Acopio
     */
    public function crearAcopioAutomatico($idFrenteTrabajo, $jornada, $fecha, $userId = null)
    {
        DB::beginTransaction();

        try {
            $frente = FrenteTrabajo::findOrFail($idFrenteTrabajo);

            // Generar número y código de acopio
            $numeroAcopio = Acopio::generarNumeroAcopio();
            $codigoAcopio = Acopio::generarCodigoAcopio(
                Acopio::TIPO_AUTOMATICO,
                $numeroAcopio,
                $frente->codigo_completo,
                $jornada,
                $fecha
            );

            $acopio = Acopio::create([
                'numero_acopio' => $numeroAcopio,
                'codigo_acopio' => $codigoAcopio,
                'tipo' => Acopio::TIPO_AUTOMATICO,
                'id_frente_trabajo' => $idFrenteTrabajo,
                'jornada' => $jornada,
                'fecha' => $fecha,
                'estado' => Acopio::ESTADO_ABIERTO,
                'user_id' => $userId,
                'total_toneladas' => 0,
                'ley_promedio' => null,
                'cantidad_dumpadas' => 0,
            ]);

            DB::commit();

            return $acopio->load('frenteTrabajo');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al crear acopio automático', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Crear un acopio manual
     *
     * @param array $data Datos del acopio
     * @param array $dumpadaIds IDs de dumpadas a incluir
     * @param int|null $userId
     * @return Acopio
     */
    public function crearAcopioManual(array $data, array $dumpadaIds, $userId = null)
    {
        DB::beginTransaction();

        try {
            // Generar número y código de acopio
            $numeroAcopio = Acopio::generarNumeroAcopio();
            $codigoAcopio = Acopio::generarCodigoAcopio(
                Acopio::TIPO_MANUAL,
                $numeroAcopio,
                null,
                null,
                now()
            );

            $acopio = Acopio::create([
                'numero_acopio' => $numeroAcopio,
                'codigo_acopio' => $codigoAcopio,
                'nombre' => $data['nombre'] ?? null,
                'tipo' => Acopio::TIPO_MANUAL,
                'estado' => Acopio::ESTADO_CERRADO, // Los manuales se crean cerrados
                'observaciones' => $data['observaciones'] ?? null,
                'user_id' => $userId,
                'total_toneladas' => 0,
                'ley_promedio' => null,
                'cantidad_dumpadas' => 0,
            ]);

            // Agregar dumpadas al acopio
            if (!empty($dumpadaIds)) {
                $this->agregarDumpadas($acopio->id, $dumpadaIds);
            }

            DB::commit();

            return $acopio->fresh()->load('frenteTrabajo', 'dumpadas');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al crear acopio manual', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Agregar dumpadas a un acopio existente
     *
     * @param int $acopioId
     * @param array $dumpadaIds
     * @return Acopio
     */
    public function agregarDumpadas($acopioId, array $dumpadaIds)
    {
        DB::beginTransaction();

        try {
            $acopio = Acopio::findOrFail($acopioId);

            // Validar que las dumpadas no estén en otro acopio
            foreach ($dumpadaIds as $dumpadaId) {
                $dumpada = Dumpada::findOrFail($dumpadaId);

                if ($dumpada->estaEnAcopio()) {
                    throw new \Exception("La dumpada #{$dumpadaId} ya está en un acopio");
                }

                if ($dumpada->estaEnMezcla()) {
                    throw new \Exception("La dumpada #{$dumpadaId} ya está en una mezcla");
                }
            }

            // Agregar dumpadas al acopio
            $acopio->dumpadas()->attach($dumpadaIds);

            // Asignar el código COMPLETO del acopio a cada dumpada
            foreach ($dumpadaIds as $dumpadaId) {
                $dumpada = Dumpada::find($dumpadaId);
                if ($dumpada) {
                    $dumpada->update(['acopios' => $acopio->codigo_acopio]);
                }
            }

            // Recalcular totales
            $acopio->recalcularTotales();

            DB::commit();

            return $acopio->fresh()->load('dumpadas');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al agregar dumpadas al acopio', [
                'acopio_id' => $acopioId,
                'dumpada_ids' => $dumpadaIds,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Quitar dumpadas de un acopio
     *
     * @param int $acopioId
     * @param array $dumpadaIds
     * @return Acopio
     */
    public function quitarDumpadas($acopioId, array $dumpadaIds)
    {
        DB::beginTransaction();

        try {
            $acopio = Acopio::findOrFail($acopioId);

            if ($acopio->estado === Acopio::ESTADO_EN_MEZCLA) {
                throw new \Exception("No se pueden quitar dumpadas de un acopio que ya está en una mezcla");
            }

            // Quitar dumpadas
            $acopio->dumpadas()->detach($dumpadaIds);

            // Limpiar el código del acopio en cada dumpada
            foreach ($dumpadaIds as $dumpadaId) {
                $dumpada = Dumpada::find($dumpadaId);
                if ($dumpada) {
                    $dumpada->update(['acopios' => null]);
                }
            }

            // Recalcular totales
            $acopio->recalcularTotales();

            DB::commit();

            return $acopio->fresh()->load('dumpadas');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al quitar dumpadas del acopio', [
                'acopio_id' => $acopioId,
                'dumpada_ids' => $dumpadaIds,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Cerrar un acopio
     *
     * @param int $acopioId
     * @return Acopio
     */
    public function cerrarAcopio($acopioId)
    {
        $acopio = Acopio::findOrFail($acopioId);

        if ($acopio->estado !== Acopio::ESTADO_ABIERTO) {
            throw new \Exception("Solo se pueden cerrar acopios en estado ABIERTO");
        }

        $acopio->cerrar();

        return $acopio->fresh();
    }

    /**
     * Reabrir un acopio cerrado
     *
     * @param int $acopioId
     * @return Acopio
     */
    public function reabrirAcopio($acopioId)
    {
        $acopio = Acopio::findOrFail($acopioId);

        if ($acopio->estado === Acopio::ESTADO_EN_MEZCLA) {
            throw new \Exception("No se puede reabrir un acopio que está en una mezcla");
        }

        if ($acopio->tipo === Acopio::TIPO_MANUAL) {
            throw new \Exception("Los acopios manuales no se pueden reabrir");
        }

        $acopio->update(['estado' => Acopio::ESTADO_ABIERTO]);

        return $acopio->fresh();
    }

    /**
     * Obtener acopios disponibles para usar en mezclas
     * Solo retorna acopios CERRADOS que tengan ley
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function obtenerAcopiosDisponibles()
    {
        // Obtener solo acopios CERRADOS con dumpadas
        $acopios = Acopio::with('frenteTrabajo', 'dumpadas')
            ->where('estado', Acopio::ESTADO_CERRADO)
            ->where('cantidad_dumpadas', '>', 0)
            ->orderBy('created_at', 'desc')
            ->get();

        // Recalcular totales de cada acopio para asegurar que estén actualizados
        $acopios->each(function ($acopio) {
            $acopio->recalcularTotales();
        });

        // Recargar la colección desde la BD para obtener los valores actualizados
        $acopiosActualizados = Acopio::with('frenteTrabajo', 'dumpadas')
            ->whereIn('id', $acopios->pluck('id'))
            ->orderBy('created_at', 'desc')
            ->get();

        // Filtrar solo acopios que pueden usarse en mezclas
        // (tienen ley promedio calculada desde dumpadas con ley o ley visual)
        return $acopiosActualizados->filter(function ($acopio) {
            return $acopio->puedeUsarseEnMezcla();
        });
    }

    /**
     * Obtener dumpadas sin acopio asignado
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function obtenerDumpadasSinAcopio()
    {
        return Dumpada::with('frenteTrabajo')
            ->whereDoesntHave('acopio')
            ->whereDoesntHave('mezclaDumpada')
            ->orderBy('fecha', 'desc')
            ->get();
    }
}
