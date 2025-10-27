<?php

namespace App\Http\Controllers\Api\Ingenieria;

use App\Http\Controllers\Controller;
use App\Models\Ingenieria\FrenteTrabajo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class FrenteTrabajoController extends Controller
{
  /**
     * Listar todos los frentes de trabajo
     */
    public function index()
    {
        $frentes = FrenteTrabajo::with('tipoFrente')->get();
        
        return response()->json([
            'success' => true,
            'data' => $frentes
        ], 200);
    }

    /**
     * Crear un nuevo frente de trabajo
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'id_tipo_frente' => 'required|exists:tipos_frente,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $frente = FrenteTrabajo::create($request->all());
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
            'nombre' => 'required|string|max:100',
            'id_tipo_frente' => 'required|exists:tipos_frente,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $frente->update($request->all());
        $frente->load('tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo actualizado exitosamente',
            'data' => $frente
        ], 200);
    }

    /**
     * Eliminar un frente de trabajo
     */
    public function destroy($id)
    {
        $frente = FrenteTrabajo::find($id);

        if (!$frente) {
            return response()->json([
                'success' => false,
                'message' => 'Frente de trabajo no encontrado'
            ], 404);
        }

        $frente->delete();

        return response()->json([
            'success' => true,
            'message' => 'Frente de trabajo eliminado exitosamente'
        ], 200);
    }
}
