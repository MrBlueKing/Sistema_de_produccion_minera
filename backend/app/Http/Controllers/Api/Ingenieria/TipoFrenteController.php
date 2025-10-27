<?php

namespace App\Http\Controllers\Api\Ingenieria;

use App\Http\Controllers\Controller;
use App\Models\Ingenieria\TipoFrente;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TipoFrenteController extends Controller
{
    /**
     * Listar todos los tipos de frente
     */
    public function index()
    {
        $tipos = TipoFrente::with('frentesTrabajo')->get();

        return response()->json([
            'success' => true,
            'data' => $tipos
        ], 200);
    }

   /**
     * Crear un nuevo tipo de frente
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100|unique:tipos_frente,nombre',
            'abreviatura' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $tipo = TipoFrente::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Tipo de frente creado exitosamente',
            'data' => $tipo
        ], 201);
    }

    /**
     * Mostrar un tipo de frente específico
     */
    public function show($id)
    {
        $tipo = TipoFrente::with('frentesTrabajo')->find($id);

        if (!$tipo) {
            return response()->json([
                'success' => false,
                'message' => 'Tipo de frente no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $tipo
        ], 200);
    }

    /**
     * Actualizar un tipo de frente
     */
    public function update(Request $request, $id)
    {
        $tipo = TipoFrente::find($id);

        if (!$tipo) {
            return response()->json([
                'success' => false,
                'message' => 'Tipo de frente no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100|unique:tipos_frente,nombre,' . $id,
            'abreviatura' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $tipo->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Tipo de frente actualizado exitosamente',
            'data' => $tipo
        ], 200);
    }

    /**
     * Eliminar un tipo de frente
     */
    public function destroy($id)
    {
        $tipo = TipoFrente::find($id);

        if (!$tipo) {
            return response()->json([
                'success' => false,
                'message' => 'Tipo de frente no encontrado'
            ], 404);
        }

        $tipo->delete();

        return response()->json([
            'success' => true,
            'message' => 'Tipo de frente eliminado exitosamente'
        ], 200);
    }
}
