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
                $request->merge([
                    'auth_user' => $response->json('user'),
                    'auth_roles' => $response->json('roles'),
                    'auth_permisos' => $response->json('permisos'),
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
