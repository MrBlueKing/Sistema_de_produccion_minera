<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Planta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PlantaController extends Controller
{
    public function index(Request $request)
    {
        $query = Planta::query();

        // Filtrar solo plantas activas si se solicita
        if ($request->has('activas')) {
            $query->activas();
        }

        $plantas = $query->orderBy('nombre')->get();
        return response()->json($plantas);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:150|unique:plantas,nombre',
            'codigo' => 'nullable|string|max:50|unique:plantas,codigo',
            'descripcion' => 'nullable|string',
            'direccion' => 'nullable|string',
            'capacidad_diaria' => 'nullable|numeric|min:0',
            'distancia_km' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $planta = Planta::create($request->all());

        return response()->json([
            'mensaje' => 'Planta creada exitosamente',
            'planta' => $planta
        ], 201);
    }

    public function show($id)
    {
        $planta = Planta::with('lotes')->findOrFail($id);
        return response()->json($planta);
    }

    public function update(Request $request, $id)
    {
        $planta = Planta::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:150|unique:plantas,nombre,' . $id,
            'codigo' => 'nullable|string|max:50|unique:plantas,codigo,' . $id,
            'descripcion' => 'nullable|string',
            'direccion' => 'nullable|string',
            'capacidad_diaria' => 'nullable|numeric|min:0',
            'distancia_km' => 'nullable|numeric|min:0',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $planta->update($request->all());

        return response()->json([
            'mensaje' => 'Planta actualizada exitosamente',
            'planta' => $planta
        ]);
    }

    public function destroy($id)
    {
        $planta = Planta::findOrFail($id);

        if ($planta->lotes()->exists()) {
            return response()->json([
                'error' => 'No se puede eliminar',
                'mensaje' => 'La planta tiene lotes asociados'
            ], 400);
        }

        $planta->delete();

        return response()->json([
            'mensaje' => 'Planta eliminada exitosamente'
        ]);
    }
}
