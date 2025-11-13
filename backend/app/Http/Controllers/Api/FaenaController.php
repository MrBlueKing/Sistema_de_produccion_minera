<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FaenaController extends Controller
{
    /**
     * Obtener lista de faenas desde el sistema central
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        try {
            $token = $request->bearerToken();

            if (!$token) {
                return response()->json([
                    'message' => 'Token no proporcionado'
                ], 401);
            }

            // Hacer petición al sistema central para obtener faenas
            $response = Http::withToken($token)
                ->get(env('SISTEMA_CENTRAL_API') . '/faenas');

            if ($response->successful()) {
                $faenas = $response->json('data', []);

                // Filtrar solo faenas activas (estado puede ser true o 'activo')
                $faenasActivas = array_filter($faenas, function($faena) {
                    return isset($faena['estado']) && ($faena['estado'] === true || $faena['estado'] === 1 || $faena['estado'] === 'activo');
                });

                return response()->json([
                    'data' => array_values($faenasActivas)
                ]);
            }

            Log::error('Error al obtener faenas del sistema central', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);

            return response()->json([
                'message' => 'Error al obtener faenas del sistema central',
                'error' => $response->body()
            ], $response->status());

        } catch (\Exception $e) {
            Log::error('Excepción al obtener faenas', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Error al obtener faenas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener una faena específica por ID
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        try {
            $token = $request->bearerToken();

            if (!$token) {
                return response()->json([
                    'message' => 'Token no proporcionado'
                ], 401);
            }

            // Hacer petición al sistema central
            $response = Http::withToken($token)
                ->get(env('SISTEMA_CENTRAL_API') . "/faenas/{$id}");

            if ($response->successful()) {
                return response()->json([
                    'data' => $response->json('data')
                ]);
            }

            return response()->json([
                'message' => 'Faena no encontrada'
            ], 404);

        } catch (\Exception $e) {
            Log::error('Error al obtener faena específica', [
                'id' => $id,
                'message' => $e->getMessage()
            ]);

            return response()->json([
                'message' => 'Error al obtener faena',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
