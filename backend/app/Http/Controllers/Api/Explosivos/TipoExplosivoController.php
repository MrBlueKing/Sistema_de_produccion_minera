<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\TipoExplosivo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class TipoExplosivoController extends Controller
{
    /**
     * GET /api/explosivos/tipos
     * Listar tipos de explosivos con filtros
     */
    public function index(Request $request)
    {
        $query = TipoExplosivo::with('categoria:id,nombre');

        if ($request->has('activo')) {
            $query->where('activo', $request->activo === 'true' || $request->activo === '1');
        }

        if ($request->has('id_categoria')) {
            $query->where('id_categoria', $request->id_categoria);
        }

        if ($request->has('buscar')) {
            $buscar = $request->buscar;
            $query->where(function ($q) use ($buscar) {
                $q->where('codigo', 'like', "%{$buscar}%")
                    ->orWhere('nombre', 'like', "%{$buscar}%");
            });
        }

        $tipos = $query->orderBy('codigo')->get();

        return response()->json($tipos);
    }

    /**
     * POST /api/explosivos/tipos
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'codigo' => 'required|string|max:30|unique:tipos_explosivos,codigo',
            'nombre' => 'required|string|max:150',
            'id_categoria' => 'required|integer|exists:categorias_explosivos,id',
            'unidad_medida' => 'required|string|in:kg,unidades,metros',
            'requiere_lote' => 'sometimes|boolean',
            'dias_alerta_vencimiento' => 'nullable|integer|min:1',
            'stock_minimo' => 'nullable|numeric|min:0',
            'stock_maximo' => 'nullable|numeric|min:0',
            'fabricante' => 'nullable|string|max:150',
            'clasificacion_onu' => 'nullable|string|max:50',
            'descripcion' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $tipo = TipoExplosivo::create([
                'codigo' => strtoupper($request->codigo),
                'nombre' => $request->nombre,
                'id_categoria' => $request->id_categoria,
                'unidad_medida' => $request->unidad_medida,
                'requiere_lote' => $request->requiere_lote ?? true,
                'dias_alerta_vencimiento' => $request->dias_alerta_vencimiento ?? 30,
                'stock_minimo' => $request->stock_minimo ?? 0,
                'stock_maximo' => $request->stock_maximo,
                'fabricante' => $request->fabricante,
                'clasificacion_onu' => $request->clasificacion_onu,
                'descripcion' => $request->descripcion,
                'activo' => true,
            ]);

            $tipo->load('categoria:id,nombre');

            return response()->json([
                'mensaje' => 'Tipo de explosivo creado exitosamente',
                'tipo' => $tipo
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear el tipo',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/tipos/{id}
     */
    public function show($id)
    {
        $tipo = TipoExplosivo::with('categoria:id,nombre')->find($id);

        if (!$tipo) {
            return response()->json(['error' => 'Tipo de explosivo no encontrado'], 404);
        }

        return response()->json($tipo);
    }

    /**
     * PUT /api/explosivos/tipos/{id}
     */
    public function update(Request $request, $id)
    {
        $tipo = TipoExplosivo::find($id);

        if (!$tipo) {
            return response()->json(['error' => 'Tipo de explosivo no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'codigo' => 'sometimes|string|max:30|unique:tipos_explosivos,codigo,' . $id,
            'nombre' => 'sometimes|string|max:150',
            'id_categoria' => 'sometimes|integer|exists:categorias_explosivos,id',
            'unidad_medida' => 'sometimes|string|in:kg,unidades,metros',
            'requiere_lote' => 'sometimes|boolean',
            'dias_alerta_vencimiento' => 'nullable|integer|min:1',
            'stock_minimo' => 'nullable|numeric|min:0',
            'stock_maximo' => 'nullable|numeric|min:0',
            'fabricante' => 'nullable|string|max:150',
            'clasificacion_onu' => 'nullable|string|max:50',
            'descripcion' => 'nullable|string',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $datos = $request->only([
                'nombre', 'id_categoria', 'unidad_medida', 'requiere_lote',
                'dias_alerta_vencimiento', 'stock_minimo', 'stock_maximo',
                'fabricante', 'clasificacion_onu', 'descripcion', 'activo'
            ]);

            if ($request->has('codigo')) {
                $datos['codigo'] = strtoupper($request->codigo);
            }

            $tipo->update($datos);
            $tipo->load('categoria:id,nombre');

            return response()->json([
                'mensaje' => 'Tipo de explosivo actualizado',
                'tipo' => $tipo
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * DELETE /api/explosivos/tipos/{id}
     */
    public function destroy($id)
    {
        $tipo = TipoExplosivo::withCount(['lotes', 'movimientos'])->find($id);

        if (!$tipo) {
            return response()->json(['error' => 'Tipo de explosivo no encontrado'], 404);
        }

        if ($tipo->lotes_count > 0 || $tipo->movimientos_count > 0) {
            return response()->json([
                'error' => 'No se puede eliminar',
                'mensaje' => 'El tipo tiene lotes o movimientos asociados. Desactívelo en su lugar.'
            ], 422);
        }

        $tipo->delete();

        return response()->json(['mensaje' => 'Tipo de explosivo eliminado']);
    }
}
