<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Rango;
use Illuminate\Http\Request;

class RangoController extends Controller
{
    /**
     * Obtener todos los rangos ordenados
     */
    public function index()
    {
        $rangos = Rango::orderBy('orden', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $rangos
        ], 200);
    }

    /**
     * Obtener el rango correspondiente a una ley específica
     */
    public function getRangoByLey(Request $request)
    {
        $request->validate([
            'ley' => 'required|numeric|min:0'
        ]);

        $rango = Rango::obtenerRangoPorLey($request->ley);

        if (!$rango) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontró un rango para la ley proporcionada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $rango
        ], 200);
    }
}
