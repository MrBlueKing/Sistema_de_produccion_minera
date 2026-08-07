<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\AutoridadFiscalizadora;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class AutoridadFiscalizadoraController extends Controller
{
    public function index(Request $request)
    {
        $query = AutoridadFiscalizadora::query();

        if ($request->has('activo')) {
            $query->where('activo', $request->activo === 'true' || $request->activo === '1');
        }

        return response()->json($query->orderBy('nombre')->get());
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'codigo' => 'required|string|max:20',
            'nombre' => 'required|string|max:150',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $autoridad = AutoridadFiscalizadora::create([
                'codigo' => $request->codigo,
                'nombre' => $request->nombre,
            ]);

            return response()->json([
                'mensaje' => 'Autoridad Fiscalizadora creada exitosamente',
                'autoridad' => $autoridad
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear la Autoridad Fiscalizadora',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $autoridad = AutoridadFiscalizadora::find($id);

        if (!$autoridad) {
            return response()->json(['error' => 'Autoridad Fiscalizadora no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'codigo' => 'sometimes|string|max:20',
            'nombre' => 'sometimes|string|max:150',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $autoridad->update($request->only(['codigo', 'nombre', 'activo']));

            return response()->json([
                'mensaje' => 'Autoridad Fiscalizadora actualizada',
                'autoridad' => $autoridad
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        $autoridad = AutoridadFiscalizadora::find($id);

        if (!$autoridad) {
            return response()->json(['error' => 'Autoridad Fiscalizadora no encontrada'], 404);
        }

        $autoridad->delete();

        return response()->json(['mensaje' => 'Autoridad Fiscalizadora eliminada']);
    }
}
