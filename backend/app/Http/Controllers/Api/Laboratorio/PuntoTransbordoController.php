<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\PuntoTransbordo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PuntoTransbordoController extends Controller
{
    public function index(Request $request)
    {
        $query = PuntoTransbordo::query();

        if ($request->has('activos')) {
            $query->activos();
        }

        $puntos = $query->orderBy('nombre')->get();
        return response()->json($puntos);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:150|unique:puntos_transbordo,nombre',
            'id_faena' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $punto = PuntoTransbordo::create($request->all());

        return response()->json([
            'mensaje' => 'Punto de transbordo creado exitosamente',
            'punto_transbordo' => $punto
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $punto = PuntoTransbordo::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:150|unique:puntos_transbordo,nombre,' . $id,
            'id_faena' => 'nullable|integer',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $punto->update($request->all());

        return response()->json([
            'mensaje' => 'Punto de transbordo actualizado exitosamente',
            'punto_transbordo' => $punto
        ]);
    }

    public function destroy($id)
    {
        $punto = PuntoTransbordo::findOrFail($id);

        if ($punto->camionadas()->exists()) {
            return response()->json([
                'error' => 'No se puede eliminar',
                'mensaje' => 'El punto de transbordo tiene camionadas asociadas. Puedes desactivarlo en vez de eliminarlo.'
            ], 400);
        }

        $punto->delete();

        return response()->json([
            'mensaje' => 'Punto de transbordo eliminado exitosamente'
        ]);
    }
}
