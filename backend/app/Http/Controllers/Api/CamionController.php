<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Camion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CamionController extends Controller
{
    /**
     * Listar camiones
     * GET /api/dispatch/camiones
     */
    public function index(Request $request)
    {
        $query = Camion::query();

        if ($request->has('activos')) {
            $query->activos();
        }

        $camiones = $query->orderBy('nombre')->get();

        return response()->json($camiones);
    }

    /**
     * Crear un nuevo camión
     * POST /api/dispatch/camiones
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'patente' => 'required|string|max:20|unique:camiones,patente',
            'nombre' => 'required|string|max:150',
            'categoria' => 'nullable|string|max:100',
            'tonelaje' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $camion = Camion::create($request->all());

        return response()->json([
            'mensaje' => 'Camión creado exitosamente',
            'camion' => $camion
        ], 201);
    }

    /**
     * Actualizar un camión existente
     * PUT /api/dispatch/camiones/{id}
     */
    public function update(Request $request, $id)
    {
        $camion = Camion::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'patente' => 'sometimes|string|max:20|unique:camiones,patente,' . $id,
            'nombre' => 'sometimes|string|max:150',
            'categoria' => 'nullable|string|max:100',
            'tonelaje' => 'nullable|numeric|min:0',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $camion->update($request->all());

        return response()->json([
            'mensaje' => 'Camión actualizado exitosamente',
            'camion' => $camion
        ]);
    }

    /**
     * Eliminar un camión
     * DELETE /api/dispatch/camiones/{id}
     */
    public function destroy($id)
    {
        $camion = Camion::findOrFail($id);
        $camion->delete();

        return response()->json([
            'mensaje' => 'Camión eliminado exitosamente'
        ]);
    }
}
