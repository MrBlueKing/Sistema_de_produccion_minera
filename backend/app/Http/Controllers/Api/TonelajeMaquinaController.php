<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TonelajeMaquina;
use App\Models\ConfiguracionSistema;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Exception;

class TonelajeMaquinaController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/dispatch/tonelaje-maquinas
     * Listar todas las máquinas con su tonelaje configurado
     */
    public function index(Request $request)
    {
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

        try {
            // 1. Obtener dumpers desde petroleo (no crítico: si falla, lista vacía)
            try {
                $response = Http::timeout(5)->get(env('SISTEMA_PETROLEO_API') . '/dumpers');
                $maquinasPetroleo = $response->successful() ? ($response->json()['data'] ?? []) : [];
            } catch (\Exception $e) {
                $maquinasPetroleo = [];
            }

            // 2. Obtener configuraciones de tonelaje locales
            $tonelajesConfig = TonelajeMaquina::activos()
                ->where(function ($q) use ($idFaena) {
                    $q->where('id_faena', $idFaena)
                      ->orWhereNull('id_faena');
                })
                ->get()
                ->keyBy('id_maquina');

            // 3. Obtener tonelaje default del sistema
            $tonelajeDefault = ConfiguracionSistema::obtener('tonelaje_dumpada_default', 4.6, $idFaena);

            // 4. Combinar datos
            $resultado = collect($maquinasPetroleo)->map(function ($maquina) use ($tonelajesConfig, $tonelajeDefault, $idFaena) {
                $idMaquina = $maquina['id_maquina'];

                // Buscar config específica de faena primero
                $configFaena = $tonelajesConfig->get($idMaquina);

                // Si la config es de otra faena (global), buscar si hay una específica
                $tieneConfigEspecifica = false;
                $tonelaje = $tonelajeDefault;
                $configId = null;

                if ($configFaena) {
                    if ($configFaena->id_faena === $idFaena) {
                        // Config específica de esta faena
                        $tieneConfigEspecifica = true;
                        $tonelaje = (float) $configFaena->tonelaje;
                        $configId = $configFaena->id;
                    } elseif ($configFaena->id_faena === null) {
                        // Config global
                        $tonelaje = (float) $configFaena->tonelaje;
                        $configId = $configFaena->id;
                    }
                }

                return [
                    'id_maquina' => $idMaquina,
                    'nombre_maquina' => $maquina['nombre_maquina'] ?? "Máquina {$idMaquina}",
                    'patente' => $maquina['patente'] ?? null,
                    'tipo_maquina' => $maquina['tipo_maquina'] ?? null,
                    'tonelaje' => $tonelaje,
                    'tonelaje_default' => $tonelajeDefault,
                    'tiene_config_especifica' => $tieneConfigEspecifica,
                    'config_id' => $configId,
                ];
            })->values();

            return response()->json([
                'data' => $resultado,
                'tonelaje_default' => $tonelajeDefault,
                'total' => $resultado->count(),
            ]);

        } catch (Exception $e) {
            Log::error('Error al obtener tonelaje de máquinas', [
                'message' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Error de conexión',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/dispatch/tonelaje-maquinas
     * Establecer tonelaje para una máquina
     */
    public function store(Request $request)
    {
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

        $validator = Validator::make($request->all(), [
            'id_maquina' => 'required|integer',
            'nombre_maquina' => 'required|string|max:100',
            'tonelaje' => 'required|numeric|min:0.1|max:100',
            'patente' => 'nullable|string|max:20',
            'es_global' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            // Si es_global = true, guardar sin faena (aplica a todas)
            $faenaGuardar = $request->input('es_global', false) ? null : $idFaena;

            $config = TonelajeMaquina::establecerTonelaje(
                $request->id_maquina,
                $request->nombre_maquina,
                $request->tonelaje,
                $faenaGuardar,
                $request->patente
            );

            return response()->json([
                'mensaje' => 'Tonelaje configurado exitosamente',
                'config' => $config,
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al guardar tonelaje',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * DELETE /api/dispatch/tonelaje-maquinas/{id}
     * Eliminar configuración de tonelaje (vuelve a usar el default)
     */
    public function destroy($id)
    {
        $config = TonelajeMaquina::find($id);

        if (!$config) {
            return response()->json(['error' => 'Configuración no encontrada'], 404);
        }

        $config->delete();

        return response()->json(['mensaje' => 'Configuración eliminada, se usará el tonelaje por defecto']);
    }

    /**
     * GET /api/dispatch/tonelaje-maquina/{idMaquina}
     * Obtener tonelaje de una máquina específica
     */
    public function show(Request $request, $idMaquina)
    {
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;
        $tonelajeDefault = ConfiguracionSistema::obtener('tonelaje_dumpada_default', 4.6, $idFaena);

        $tonelaje = TonelajeMaquina::obtenerTonelaje($idMaquina, $idFaena, $tonelajeDefault);

        return response()->json([
            'id_maquina' => (int) $idMaquina,
            'tonelaje' => $tonelaje,
            'tonelaje_default' => $tonelajeDefault,
        ]);
    }
}
