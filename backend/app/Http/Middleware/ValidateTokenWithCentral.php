<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class ValidateTokenWithCentral
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Token no proporcionado'], 401);
        }

        // Leer modulo_id del header
        $moduloId = $request->header('X-Modulo-ID');

        if (!$moduloId) {
            return response()->json(['message' => 'Módulo no especificado'], 400);
        }

        try {
            $response = Http::withToken($token)
                ->post(env('SISTEMA_CENTRAL_API') . '/validar-token', [
                    'modulo_id' => $moduloId,
                ]);

            if ($response->successful() && $response->json('valid')) {
                $userData = $response->json('user');

                // Log para depuración - ver qué datos vienen del usuario
                Log::info('Datos del usuario desde sistema central:', [
                    'user_data' => $userData,
                    'tiene_faena' => isset($userData['faena']),
                ]);

                // Extraer faena como string (puede ser un array u objeto)
                $faena = null;
                if (isset($userData['faena'])) {
                    if (is_array($userData['faena'])) {
                        // Si es array, intentar obtener ubicacion, nombre o ID
                        $faena = $userData['faena']['ubicacion'] ?? $userData['faena']['nombre'] ?? $userData['faena']['id'] ?? null;
                    } else {
                        // Si ya es un valor simple (string/número), usarlo directamente
                        $faena = $userData['faena'];
                    }
                }

                // Log adicional para depuración - ver qué valor se extrae de faena
                Log::info('Valor de faena extraído:', [
                    'faena_original' => $userData['faena'] ?? 'NO EXISTE',
                    'faena_procesada' => $faena,
                    'es_array' => isset($userData['faena']) ? is_array($userData['faena']) : 'N/A',
                ]);

                $request->merge([
                    'auth_user' => $userData,
                    'auth_roles' => $response->json('roles'),
                    'auth_permisos' => $response->json('permisos'),
                    'auth_user_id' => $userData['id'] ?? null,
                    'auth_faena' => $faena,
                ]);

                return $next($request);
            }

            return response()->json([
                'message' => 'Token inválido o acceso denegado'
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error validando token: ' . $e->getMessage());
            return response()->json(['message' => 'Error al validar token'], 500);
        }
    }
}
