<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\PersonalAutorizadoExplosivos;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Exception;

class PersonalAutorizadoController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/explosivos/personal-autorizado
     * Listar personal autorizado para la faena actual
     */
    public function index(Request $request)
    {
        $query = PersonalAutorizadoExplosivos::query();

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('activo')) {
            $activo = $request->activo === 'true' || $request->activo === '1';
            $query->where('activo', $activo);
        } else {
            // Por defecto solo activos
            $query->where('activo', true);
        }

        $personal = $query->orderBy('nombre')->get();

        // Agregar nombre_completo a cada registro
        $personal->each(function ($p) {
            $p->nombre_completo = $p->nombre_completo;
        });

        return response()->json($personal);
    }

    /**
     * GET /api/explosivos/personal-disponible
     * Obtener TODO el personal disponible desde el sistema de petroleo (sin filtrar por faena)
     */
    public function disponible(Request $request)
    {
        // Obtener la faena actual solo para marcar quiénes ya están autorizados
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

        try {
            // Consultar TODO el personal de petroleo (sin filtro de faena)
            $response = Http::timeout(10)
                ->withHeaders([
                    'X-API-Key' => config('services.petroleo_api_key')
                ])
                ->get(config('services.petroleo_api') . '/personal-interno-disponible');

            if (!$response->successful()) {
                return response()->json([
                    'error' => 'Error al conectar con el sistema de petroleo',
                    'mensaje' => $response->json('message') ?? 'Error desconocido'
                ], $response->status());
            }

            $data = $response->json();
            $personalPetroleo = $data['data'] ?? [];

            // Obtener IDs ya autorizados en ESTA faena (para marcarlos)
            $autorizadosIds = [];
            if ($idFaena) {
                $autorizadosIds = PersonalAutorizadoExplosivos::where('id_faena', $idFaena)
                    ->where('activo', true)
                    ->pluck('id_personal_externo')
                    ->toArray();
            }

            // Marcar cuales ya están autorizados en esta faena
            $personalConEstado = collect($personalPetroleo)->map(function ($persona) use ($autorizadosIds) {
                $persona['ya_autorizado'] = in_array($persona['id_personal_interno'], $autorizadosIds);
                return $persona;
            });

            return response()->json([
                'data' => $personalConEstado,
                'total' => count($personalConEstado)
            ]);

        } catch (Exception $e) {
            Log::error('Error al obtener personal desde petroleo', [
                'message' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Error de conexión',
                'mensaje' => 'No se pudo conectar con el sistema de petroleo'
            ], 500);
        }
    }

    /**
     * POST /api/explosivos/personal-autorizado
     * Agregar una persona a la lista de autorizados
     */
    public function store(Request $request)
    {
        $idFaena = $this->getFaenaParaFiltrar($request);

        if (!$idFaena) {
            $idFaena = $request->auth_faena;
        }

        if (!$idFaena) {
            return response()->json(['error' => 'Faena no especificada'], 400);
        }

        $validator = Validator::make($request->all(), [
            'id_personal_externo' => 'required|integer',
            'rut' => 'required|string|max:12',
            'nombre' => 'required|string|max:255',
            'apellido' => 'nullable|string|max:255',
            'cargo' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        // Verificar si ya existe (activo o inactivo)
        $existente = PersonalAutorizadoExplosivos::where('id_personal_externo', $request->id_personal_externo)
            ->where('id_faena', $idFaena)
            ->first();

        try {
            if ($existente) {
                // Reactivar si estaba inactivo
                if (!$existente->activo) {
                    $existente->update([
                        'activo' => true,
                        'nombre' => $request->nombre,
                        'apellido' => $request->apellido,
                        'cargo' => $request->cargo,
                    ]);

                    return response()->json([
                        'mensaje' => 'Personal reactivado exitosamente',
                        'personal' => $existente
                    ]);
                }

                return response()->json([
                    'error' => 'Esta persona ya está autorizada'
                ], 422);
            }

            $personal = PersonalAutorizadoExplosivos::create([
                'id_personal_externo' => $request->id_personal_externo,
                'rut' => $request->rut,
                'nombre' => $request->nombre,
                'apellido' => $request->apellido,
                'cargo' => $request->cargo,
                'id_faena' => $idFaena,
                'activo' => true,
            ]);

            return response()->json([
                'mensaje' => 'Personal autorizado exitosamente',
                'personal' => $personal
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al autorizar personal',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * DELETE /api/explosivos/personal-autorizado/{id}
     * Desactivar (no eliminar) a una persona de la lista
     */
    public function destroy($id)
    {
        $personal = PersonalAutorizadoExplosivos::find($id);

        if (!$personal) {
            return response()->json(['error' => 'Personal no encontrado'], 404);
        }

        $personal->update(['activo' => false]);

        return response()->json(['mensaje' => 'Autorización removida']);
    }

    /**
     * PUT /api/explosivos/personal-autorizado/{id}/reactivar
     * Reactivar una autorización
     */
    public function reactivar($id)
    {
        $personal = PersonalAutorizadoExplosivos::find($id);

        if (!$personal) {
            return response()->json(['error' => 'Personal no encontrado'], 404);
        }

        $personal->update(['activo' => true]);

        return response()->json([
            'mensaje' => 'Autorización reactivada',
            'personal' => $personal
        ]);
    }
}
