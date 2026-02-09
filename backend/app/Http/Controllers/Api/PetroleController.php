<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PetroleController extends Controller
{
    /**
     * Obtener máquinas disponibles desde el sistema de petróleo
     * Filtra solo camiones tolva (categoría 7)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function maquinas(Request $request)
    {
        try {
            Log::info('🔍 Intentando obtener camiones tolva', [
                'url_petroleo' => env('SISTEMA_PETROLEO_API'),
                'endpoint_completo' => env('SISTEMA_PETROLEO_API') . '/camiones-tolva'
            ]);

            // ✅ Endpoint público - NO requiere token
            $response = Http::timeout(10)
                ->get(env('SISTEMA_PETROLEO_API') . '/camiones-tolva');

            Log::info('📡 Respuesta del sistema de petróleo', [
                'status' => $response->status(),
                'successful' => $response->successful(),
                'body_preview' => substr($response->body(), 0, 200)
            ]);

            if ($response->successful()) {
                $responseData = $response->json();

                Log::info('✅ Camiones obtenidos exitosamente', [
                    'total' => $responseData['total'] ?? 0,
                    'cantidad_data' => count($responseData['data'] ?? [])
                ]);

                // El nuevo endpoint ya devuelve solo camiones tolva filtrados
                return response()->json([
                    'status' => 'success',
                    'data' => $responseData['data'] ?? [],
                    'total' => $responseData['total'] ?? 0
                ]);
            }

            Log::error('❌ Error al obtener camiones tolva de Petróleo', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            return response()->json([
                'message' => 'Error al obtener camiones del sistema de petróleo',
                'error' => $response->body()
            ], $response->status());

        } catch (\Exception $e) {
            Log::error('💥 Excepción al obtener camiones de Petróleo', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Error al conectar con el sistema de petróleo',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
