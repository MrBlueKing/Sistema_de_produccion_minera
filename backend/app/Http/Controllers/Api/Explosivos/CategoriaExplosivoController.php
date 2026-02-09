<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\CategoriaExplosivo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class CategoriaExplosivoController extends Controller
{
    /**
     * GET /api/explosivos/categorias
     * Listar todas las categorías
     */
    public function index(Request $request)
    {
        $query = CategoriaExplosivo::withCount('tiposExplosivos');

        if ($request->has('activo')) {
            $query->where('activo', $request->activo === 'true' || $request->activo === '1');
        }

        $categorias = $query->ordenado()->get();

        return response()->json($categorias);
    }

    /**
     * POST /api/explosivos/categorias
     * Crear una nueva categoría
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100|unique:categorias_explosivos,nombre',
            'descripcion' => 'nullable|string',
            'orden' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $categoria = CategoriaExplosivo::create([
                'nombre' => $request->nombre,
                'descripcion' => $request->descripcion,
                'orden' => $request->orden ?? 0,
                'activo' => true,
            ]);

            return response()->json([
                'mensaje' => 'Categoría creada exitosamente',
                'categoria' => $categoria
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear la categoría',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/categorias/{id}
     */
    public function show($id)
    {
        $categoria = CategoriaExplosivo::with('tiposExplosivos:id,codigo,nombre,id_categoria,activo')
            ->find($id);

        if (!$categoria) {
            return response()->json(['error' => 'Categoría no encontrada'], 404);
        }

        return response()->json($categoria);
    }

    /**
     * PUT /api/explosivos/categorias/{id}
     */
    public function update(Request $request, $id)
    {
        $categoria = CategoriaExplosivo::find($id);

        if (!$categoria) {
            return response()->json(['error' => 'Categoría no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:100|unique:categorias_explosivos,nombre,' . $id,
            'descripcion' => 'nullable|string',
            'orden' => 'nullable|integer|min:0',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $categoria->update($request->only(['nombre', 'descripcion', 'orden', 'activo']));

            return response()->json([
                'mensaje' => 'Categoría actualizada',
                'categoria' => $categoria
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * DELETE /api/explosivos/categorias/{id}
     */
    public function destroy($id)
    {
        $categoria = CategoriaExplosivo::withCount('tiposExplosivos')->find($id);

        if (!$categoria) {
            return response()->json(['error' => 'Categoría no encontrada'], 404);
        }

        if ($categoria->tipos_explosivos_count > 0) {
            return response()->json([
                'error' => 'No se puede eliminar',
                'mensaje' => 'La categoría tiene tipos de explosivos asociados'
            ], 422);
        }

        $categoria->delete();

        return response()->json(['mensaje' => 'Categoría eliminada']);
    }
}
