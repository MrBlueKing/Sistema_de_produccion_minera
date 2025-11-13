<?php

namespace App\Http\Controllers\Api\Ingenieria;

use App\Http\Controllers\Controller;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Models\Ingenieria\AuditoriaFrenteTrabajo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class FrenteTrabajoController extends Controller
{
    /**
     * Listar todos los frentes de trabajo con paginación y filtros
     */
    public function index(Request $request)
    {
        Log::info('Accediendo al método index de FrenteTrabajoController.');

        // Parámetros de paginación
        $perPage = $request->get('per_page', 15);
        $page = $request->get('page', 1);

        // Parámetros de filtros
        $search = $request->get('search');
        $idTipoFrente = $request->get('id_tipo_frente');
        $manto = $request->get('manto');
        $idFaena = $request->get('id_faena');
        $estado = $request->get('estado');
        $soloActivos = $request->get('solo_activos', false); // Por defecto mostrar todos

        // Construir query
        $query = FrenteTrabajo::with('tipoFrente')
            ->orderBy('created_at', 'desc');

        // Filtro por estado activo (útil para selectores en formularios)
        if ($soloActivos) {
            $query->activos();
        }

        // Filtro por faena
        if ($idFaena) {
            $query->porFaena($idFaena);
        }

        // Filtro por estado específico
        if ($estado) {
            $query->where('estado', $estado);
        }

        // Aplicar búsqueda general (busca en código completo, manto, calle, hebra)
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('codigo_completo', 'like', '%' . $search . '%')
                    ->orWhere('manto', 'like', '%' . $search . '%')
                    ->orWhere('calle', 'like', '%' . $search . '%')
                    ->orWhere('hebra', 'like', '%' . $search . '%')
                    ->orWhere('numero_frente', 'like', '%' . $search . '%');
            });
        }

        // Filtro por tipo de frente
        if ($idTipoFrente) {
            $query->where('id_tipo_frente', $idTipoFrente);
        }

        // Filtro por manto
        if ($manto) {
            $query->where('manto', 'like', '%' . $manto . '%');
        }

        // Paginar resultados
        $frentes = $query->paginate($perPage, ['*'], 'page', $page);

        // Cargar datos de faenas desde el sistema central
        $frentesConFaenas = $this->cargarFaenasDesdeApiCentral($frentes->items(), $request->bearerToken());

        Log::info('Se recuperaron ' . $frentes->total() . ' frentes de trabajo (página ' . $page . ').');

        return response()->json([
            'success' => true,
            'data' => $frentesConFaenas,
            'pagination' => [
                'total' => $frentes->total(),
                'per_page' => $frentes->perPage(),
                'current_page' => $frentes->currentPage(),
                'last_page' => $frentes->lastPage(),
                'from' => $frentes->firstItem(),
                'to' => $frentes->lastItem()
            ]
        ], 200);
    }

    /**
     * Crear un nuevo frente de trabajo
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'manto' => 'required|string|max:10',
            'calle' => 'nullable|string|max:20',
            'hebra' => 'nullable|string|max:10',
            'numero_frente' => 'nullable|string|max:10',
            'id_tipo_frente' => 'required|exists:tipos_frente,id',
            'id_faena' => 'nullable|integer',
            'estado' => 'nullable|in:activo,inactivo',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Generar código completo automáticamente
        $codigo = $this->generarCodigoCompleto(
            $request->manto,
            $request->calle,
            $request->hebra,
            $request->numero_frente,
            $request->id_tipo_frente
        );

        // Validar que el código no exista
        $codigoExistente = FrenteTrabajo::where('codigo_completo', $codigo)->first();
        if ($codigoExistente) {
            return response()->json([
                'success' => false,
                'message' => 'Ya existe un frente con el código: ' . $codigo
            ], 422);
        }

        $frente = FrenteTrabajo::create([
            'manto' => $request->manto,
            'calle' => $request->calle,
            'hebra' => $request->hebra,
            'numero_frente' => $request->numero_frente,
            'codigo_completo' => $codigo,
            'id_tipo_frente' => $request->id_tipo_frente,
            'id_faena' => $request->id_faena,
            'estado' => $request->estado ?? 'activo',
        ]);

        // Registrar en auditoría
        AuditoriaFrenteTrabajo::registrar(
            $frente->id,
            'creado',
            null,
            $frente->toArray(),
            $request->user()->name ?? 'Sistema',
            'Frente de trabajo creado'
        );

        $frente->load('tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo creado exitosamente',
            'data' => $frente
        ], 201);
    }

    /**
     * Mostrar un frente de trabajo específico
     */
    public function show($id)
    {
        $frente = FrenteTrabajo::with('tipoFrente')->find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente de trabajo no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $frente
        ], 200);
    }

    /**
     * Actualizar un frente de trabajo
     */
    public function update(Request $request, $id)
    {
        $frente = FrenteTrabajo::find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente de trabajo no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'manto' => 'required|string|max:10',
            'calle' => 'nullable|string|max:20',
            'hebra' => 'nullable|string|max:10',
            'numero_frente' => 'nullable|string|max:10',
            'id_tipo_frente' => 'required|exists:tipos_frente,id',
            'id_faena' => 'nullable|integer',
            'estado' => 'nullable|in:activo,inactivo',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Guardar estado anterior para auditoría
        $datosAnteriores = $frente->toArray();

        // Generar código completo automáticamente
        $codigo = $this->generarCodigoCompleto(
            $request->manto,
            $request->calle,
            $request->hebra,
            $request->numero_frente,
            $request->id_tipo_frente
        );

        // Validar que el código no exista (excepto para el registro actual)
        $codigoExistente = FrenteTrabajo::where('codigo_completo', $codigo)
            ->where('id', '!=', $id)
            ->first();
        if ($codigoExistente) {
            return response()->json([
                'success' => false,
                'message' => 'Ya existe un frente con el código: ' . $codigo
            ], 422);
        }

        $frente->update([
            'manto' => $request->manto,
            'calle' => $request->calle,
            'hebra' => $request->hebra,
            'numero_frente' => $request->numero_frente,
            'codigo_completo' => $codigo,
            'id_tipo_frente' => $request->id_tipo_frente,
            'id_faena' => $request->id_faena,
            'estado' => $request->estado ?? $frente->estado,
        ]);

        // Registrar cambios en auditoría
        AuditoriaFrenteTrabajo::registrar(
            $frente->id,
            'actualizado',
            $datosAnteriores,
            $frente->fresh()->toArray(),
            $request->user()->name ?? 'Sistema',
            'Frente de trabajo actualizado'
        );

        $frente->load('tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo actualizado exitosamente',
            'data' => $frente
        ], 200);
    }

    /**
     * Eliminar un frente de trabajo (soft delete)
     */
    public function destroy(Request $request, $id)
    {
        $frente = FrenteTrabajo::find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente de trabajo no encontrado'
            ], 404);
        }

        // Guardar información de quién eliminó y por qué
        $usuario = $request->user()->name ?? 'Sistema';
        $frente->deleted_by = $usuario;
        $frente->deletion_reason = $request->input('reason', null);
        $frente->save();

        // Registrar en auditoría antes de eliminar
        AuditoriaFrenteTrabajo::registrar(
            $frente->id,
            'eliminado',
            $frente->toArray(),
            null,
            $usuario,
            'Frente de trabajo eliminado (soft delete)'
        );

        // Soft delete
        $frente->delete();

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo eliminado exitosamente'
        ], 200);
    }

    /**
     * Listar frentes eliminados (historial)
     */
    public function trashed()
    {
        $frentesEliminados = FrenteTrabajo::onlyTrashed()
            ->with('tipoFrente')
            ->orderBy('deleted_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $frentesEliminados
        ], 200);
    }

    /**
     * Restaurar un frente eliminado
     */
    public function restore($id)
    {
        $frente = FrenteTrabajo::onlyTrashed()->find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente eliminado no encontrado'
            ], 404);
        }

        // Guardar datos antes de restaurar
        $datosAnteriores = $frente->toArray();

        // Limpiar datos de eliminación al restaurar
        $frente->deleted_by = null;
        $frente->deletion_reason = null;
        $frente->restore();

        // Registrar restauración en auditoría
        AuditoriaFrenteTrabajo::registrar(
            $frente->id,
            'restaurado',
            $datosAnteriores,
            $frente->fresh()->toArray(),
            'Sistema',
            'Frente de trabajo restaurado'
        );

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo restaurado exitosamente',
            'data' => $frente->load('tipoFrente')
        ], 200);
    }

    /**
     * Obtener historial de cambios de un frente
     */
    public function historial($id)
    {
        $frente = FrenteTrabajo::withTrashed()->find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente de trabajo no encontrado'
            ], 404);
        }

        $auditorias = AuditoriaFrenteTrabajo::where('id_frente_trabajo', $id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($auditoria) {
                return [
                    'id' => $auditoria->id,
                    'accion' => $auditoria->accion,
                    'usuario' => $auditoria->usuario,
                    'fecha' => $auditoria->created_at,
                    'observaciones' => $auditoria->observaciones,
                    'cambios' => $auditoria->getTodosCambios(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'frente' => $frente,
                'historial' => $auditorias
            ]
        ], 200);
    }

    /**
     * Revertir a un estado anterior del historial
     */
    public function revertir(Request $request, $id, $auditoriaId)
    {
        $frente = FrenteTrabajo::find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente de trabajo no encontrado'
            ], 404);
        }

        $auditoria = AuditoriaFrenteTrabajo::find($auditoriaId);

        if (!$auditoria || $auditoria->id_frente_trabajo != $id) {
            return response()->json([
                'success' => false,
                'message' => 'Registro de auditoría no encontrado'
            ], 404);
        }

        // Validar que haya datos anteriores para revertir
        if (!$auditoria->datos_anteriores) {
            return response()->json([
                'success' => false,
                'message' => 'No hay datos anteriores para revertir'
            ], 400);
        }

        // Guardar estado actual antes de revertir
        $estadoActual = $frente->toArray();

        // Revertir a datos anteriores
        $datosAnteriores = $auditoria->datos_anteriores;

        // Regenerar código si es necesario
        if (isset($datosAnteriores['manto']) && isset($datosAnteriores['id_tipo_frente'])) {
            $codigo = $this->generarCodigoCompleto(
                $datosAnteriores['manto'],
                $datosAnteriores['calle'] ?? null,
                $datosAnteriores['hebra'] ?? null,
                $datosAnteriores['numero_frente'] ?? null,
                $datosAnteriores['id_tipo_frente']
            );
            $datosAnteriores['codigo_completo'] = $codigo;
        }

        // Actualizar frente
        $frente->update([
            'manto' => $datosAnteriores['manto'] ?? $frente->manto,
            'calle' => $datosAnteriores['calle'] ?? $frente->calle,
            'hebra' => $datosAnteriores['hebra'] ?? $frente->hebra,
            'numero_frente' => $datosAnteriores['numero_frente'] ?? $frente->numero_frente,
            'codigo_completo' => $datosAnteriores['codigo_completo'] ?? $frente->codigo_completo,
            'id_tipo_frente' => $datosAnteriores['id_tipo_frente'] ?? $frente->id_tipo_frente,
        ]);

        // Registrar la reversión en auditoría
        AuditoriaFrenteTrabajo::registrar(
            $frente->id,
            'actualizado',
            $estadoActual,
            $frente->fresh()->toArray(),
            $request->user()->name ?? 'Sistema',
            "Revertido al estado del " . $auditoria->created_at->format('d/m/Y H:i')
        );

        $frente->load('tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Frente revertido exitosamente al estado anterior',
            'data' => $frente
        ], 200);
    }

    /**
     * Eliminar permanentemente un frente
     */
    public function forceDestroy($id)
    {
        $frente = FrenteTrabajo::onlyTrashed()->find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente eliminado no encontrado'
            ], 404);
        }

        $frente->forceDelete();

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo eliminado permanentemente'
        ], 200);
    }

    /**
     * Cargar datos de faenas desde el sistema central y mapearlos a los frentes
     */
    private function cargarFaenasDesdeApiCentral($frentes, $token)
    {
        // Extraer IDs de faena únicos (excluyendo nulls)
        $idsFaena = collect($frentes)
            ->pluck('id_faena')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        // Si no hay IDs de faena, retornar frentes sin modificar
        if (empty($idsFaena)) {
            return $frentes;
        }

        try {
            // Hacer petición al sistema central para obtener todas las faenas
            $response = Http::withToken($token)
                ->get(env('SISTEMA_CENTRAL_API') . '/faenas');

            if ($response->successful()) {
                $todasLasFaenas = $response->json('data', []);

                // Crear mapa de faenas por ID para búsqueda rápida
                $faenasMap = collect($todasLasFaenas)->keyBy('id');

                // Mapear faenas a frentes
                foreach ($frentes as $frente) {
                    if ($frente->id_faena && isset($faenasMap[$frente->id_faena])) {
                        $frente->faena = $faenasMap[$frente->id_faena];
                    } else {
                        $frente->faena = null;
                    }
                }
            } else {
                Log::warning('No se pudieron cargar faenas del sistema central', [
                    'status' => $response->status()
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error al cargar faenas del sistema central', [
                'message' => $e->getMessage()
            ]);
        }

        return $frentes;
    }

    /**
     * Generar código completo del frente de trabajo
     * Formato: M5-1SH1AL7 (sin espacios)
     * Donde L7 es el tipo de frente (L) + número (7)
     */
    private function generarCodigoCompleto($manto, $calle, $hebra, $numeroFrente, $idTipoFrente)
    {
        $partes = [];

        // Manto (obligatorio)
        $partes[] = $manto;

        // Calle (opcional)
        if (!empty($calle)) {
            $partes[] = $calle;
        }

        // Hebra (opcional)
        if (!empty($hebra)) {
            $partes[] = $hebra;
        }

        // Tipo de frente + número (opcional)
        // El tipo de frente puede tener o no número: L7, REC, DF3, etc.
        $tipoFrente = \App\Models\Ingenieria\TipoFrente::find($idTipoFrente);
        if ($tipoFrente && !empty(trim($tipoFrente->abreviatura))) {
            // Concatenar tipo de frente con número (si existe)
            $tipoConNumero = $tipoFrente->abreviatura;
            if (!empty($numeroFrente)) {
                $tipoConNumero .= $numeroFrente;
            }
            $partes[] = $tipoConNumero;
        }

        return implode('', $partes); // Sin espacios
    }
}
